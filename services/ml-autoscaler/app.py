"""
ML-Autoscaler Service - Real-time prediction service for K8s autoscaling

This service:
1. Fetches current metrics from Prometheus every 30s
2. Makes predictions using trained ML model
3. Exports predictions as Prometheus metrics for KEDA
4. Provides REST API for manual queries
"""

import os
import time
import logging
from datetime import datetime
from typing import Dict, List
from flask import Flask, jsonify, request
from prometheus_client import Gauge, Counter, generate_latest, REGISTRY
import requests
import pandas as pd
from inference import K8sAutoScalingPredictor
import config

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Flask app
app = Flask(__name__)

# Prometheus metrics
predicted_replicas_gauge = Gauge(
    'ml_predicted_replicas',
    'ML model predicted optimal replica count',
    ['service']
)

current_replicas_gauge = Gauge(
    'ml_current_replicas',
    'Current replica count',
    ['service']
)

prediction_confidence_gauge = Gauge(
    'ml_prediction_confidence',
    'Confidence score of ML prediction',
    ['service']
)

prediction_counter = Counter(
    'ml_predictions_total',
    'Total number of predictions made',
    ['service', 'action']
)

prediction_errors_counter = Counter(
    'ml_prediction_errors_total',
    'Total number of prediction errors',
    ['service', 'error_type']
)

# Configuration
PROMETHEUS_URL = os.getenv('PROMETHEUS_URL', 'http://kube-prometheus-stack-prometheus.monitoring.svc.cluster.local:9090')
KUBERNETES_API = os.getenv('KUBERNETES_API', 'https://kubernetes.default.svc')
NAMESPACE = os.getenv('NAMESPACE', 'ballandbeer')
MODEL_TYPE = os.getenv('MODEL_TYPE', 'random_forest')
PREDICTION_INTERVAL = int(os.getenv('PREDICTION_INTERVAL', '30'))  # seconds
SERVICES = config.SERVICES

# Initialize predictor
predictor = K8sAutoScalingPredictor(model_type=MODEL_TYPE)
logger.info(f"ML Predictor initialized with model type: {MODEL_TYPE}")

# Store last predictions
last_predictions = {}


def query_prometheus(query: str) -> Dict:
    """Query Prometheus and return results"""
    try:
        response = requests.get(
            f"{PROMETHEUS_URL}/api/v1/query",
            params={'query': query},
            timeout=10
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.error(f"Failed to query Prometheus: {e}")
        return None


def get_current_replicas(service: str) -> int:
    """Get current replica count from Prometheus metrics"""
    query = f'kube_deployment_status_replicas{{namespace="{NAMESPACE}",deployment="{service}"}}'
    result = query_prometheus(query)
    
    if result and result.get('status') == 'success':
        data = result.get('data', {}).get('result', [])
        if data:
            return int(data[0]['value'][1])
    
    logger.warning(f"Could not get current replicas for {service}, defaulting to 1")
    return 1


def collect_metrics_for_service(service: str) -> Dict:
    """Collect all required metrics for a service from Prometheus"""
    try:
        features = {'service_name': service}
        
        # CPU metrics
        cpu_query = f'rate(container_cpu_usage_seconds_total{{namespace="{NAMESPACE}",pod=~"{service}-.*"}}[5m]) * 100'
        cpu_result = query_prometheus(cpu_query)
        if cpu_result and cpu_result['status'] == 'success':
            data = cpu_result['data']['result']
            if data:
                features['cpu_usage_percent'] = float(data[0]['value'][1])
            else:
                features['cpu_usage_percent'] = 0.0
        
        # Memory metrics
        mem_query = f'container_memory_working_set_bytes{{namespace="{NAMESPACE}",pod=~"{service}-.*"}} / container_spec_memory_limit_bytes * 100'
        mem_result = query_prometheus(mem_query)
        if mem_result and mem_result['status'] == 'success':
            data = mem_result['data']['result']
            if data:
                features['ram_usage_percent'] = float(data[0]['value'][1])
            else:
                features['ram_usage_percent'] = 0.0
        
        # Request rate (from nginx ingress)
        req_query = f'rate(nginx_ingress_controller_requests{{service="{service}"}}[5m])'
        req_result = query_prometheus(req_query)
        if req_result and req_result['status'] == 'success':
            data = req_result['data']['result']
            if data:
                features['request_count_per_second'] = float(data[0]['value'][1])
            else:
                features['request_count_per_second'] = 0.0
        
        # Response time
        resp_query = f'histogram_quantile(0.95, rate(nginx_ingress_controller_request_duration_seconds_bucket{{service="{service}"}}[5m])) * 1000'
        resp_result = query_prometheus(resp_query)
        if resp_result and resp_result['status'] == 'success':
            data = resp_result['data']['result']
            if data:
                features['response_time_ms'] = float(data[0]['value'][1])
            else:
                features['response_time_ms'] = 0.0
        
        # Current replicas
        features['replica_count'] = get_current_replicas(service)
        
        # Fill in other required features with defaults
        # (In production, fetch these from Prometheus or calculate)
        features['cpu_usage_percent_last_5_min'] = features['cpu_usage_percent']
        features['cpu_usage_percent_slope'] = 0.0
        features['ram_usage_percent_last_5_min'] = features['ram_usage_percent']
        features['ram_usage_percent_slope'] = 0.0
        features['request_count_per_second_last_5_min'] = features['request_count_per_second']
        features['cpu_request'] = 0.5
        features['cpu_limit'] = 2.0
        features['ram_request'] = 512.0
        features['ram_limit'] = 2048.0
        features['queue_length'] = 0
        features['error_rate'] = 0.0
        features['pod_restart_count'] = 0
        features['node_cpu_pressure_flag'] = 0
        features['node_memory_pressure_flag'] = 0
        
        return features
        
    except Exception as e:
        logger.error(f"Error collecting metrics for {service}: {e}")
        prediction_errors_counter.labels(service=service, error_type='metric_collection').inc()
        return None


def make_predictions():
    """Make predictions for all services and update Prometheus metrics"""
    logger.info("Making predictions for all services...")
    
    for service in SERVICES:
        try:
            # Collect metrics
            features = collect_metrics_for_service(service)
            if not features:
                logger.warning(f"Skipping {service} due to missing metrics")
                continue
            
            # Make prediction
            decision = predictor.get_scaling_decision(features)
            
            # Update Prometheus metrics
            predicted_replicas_gauge.labels(service=service).set(decision['predicted_replicas'])
            current_replicas_gauge.labels(service=service).set(decision['current_replicas'])
            prediction_confidence_gauge.labels(service=service).set(decision['confidence'])
            prediction_counter.labels(service=service, action=decision['action']).inc()
            
            # Store last prediction
            last_predictions[service] = {
                'timestamp': datetime.now().isoformat(),
                **decision
            }
            
            logger.info(
                f"{service}: current={decision['current_replicas']}, "
                f"predicted={decision['predicted_replicas']}, "
                f"action={decision['action']}, "
                f"confidence={decision['confidence']}"
            )
            
        except Exception as e:
            logger.error(f"Error making prediction for {service}: {e}")
            prediction_errors_counter.labels(service=service, error_type='prediction').inc()


def prediction_loop():
    """Background loop for continuous predictions"""
    logger.info(f"Starting prediction loop (interval: {PREDICTION_INTERVAL}s)")
    
    while True:
        try:
            make_predictions()
        except Exception as e:
            logger.error(f"Error in prediction loop: {e}")
        
        time.sleep(PREDICTION_INTERVAL)


# REST API endpoints
@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'model_type': MODEL_TYPE})


@app.route('/metrics', methods=['GET'])
def metrics():
    """Prometheus metrics endpoint"""
    return generate_latest(REGISTRY)


@app.route('/predictions', methods=['GET'])
def get_predictions():
    """Get last predictions for all services"""
    return jsonify(last_predictions)


@app.route('/predictions/<service>', methods=['GET'])
def get_service_prediction(service):
    """Get last prediction for a specific service"""
    if service not in last_predictions:
        return jsonify({'error': f'No predictions found for service: {service}'}), 404
    return jsonify(last_predictions[service])


@app.route('/predict', methods=['POST'])
def predict():
    """Manual prediction endpoint (for testing)"""
    try:
        features = request.json
        if not features:
            return jsonify({'error': 'No features provided'}), 400
        
        decision = predictor.get_scaling_decision(features)
        return jsonify(decision)
    except Exception as e:
        logger.error(f"Error in manual prediction: {e}")
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    import threading
    
    # Start prediction loop in background thread
    prediction_thread = threading.Thread(target=prediction_loop, daemon=True)
    prediction_thread.start()
    
    # Start Flask app
    port = int(os.getenv('PORT', '8080'))
    app.run(host='0.0.0.0', port=port)
