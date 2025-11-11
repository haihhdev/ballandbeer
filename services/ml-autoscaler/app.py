""""""

ML-Autoscaler Service - Real-time prediction service for K8s autoscalingML-Autoscaler Service - Real-time prediction service for K8s autoscaling



This service:This service:

1. Fetches current metrics from Prometheus every 30s1. Fetches current metrics from Prometheus every 30s

2. Makes predictions using trained ML model2. Makes predictions using trained ML model

3. Exports predictions as Prometheus metrics for KEDA3. Exports predictions as Prometheus metrics for KEDA

4. Provides REST API for manual queries4. Provides REST API for manual queries

""""""



import osimport os

import timeimport time

import loggingimport logging

import asynciofrom datetime import datetime

from datetime import datetimefrom typing import Dict, List

from typing import Dict, List, Optionalfrom flask import Flask, jsonify, request

from contextlib import asynccontextmanagerfrom prometheus_client import Gauge, Counter, generate_latest, REGISTRY

import requests

from fastapi import FastAPI, HTTPExceptionimport pandas as pd

from fastapi.responses import PlainTextResponsefrom inference import K8sAutoScalingPredictor

from pydantic import BaseModel, Fieldimport config

import requests

logging.basicConfig(

from prometheus_client import Gauge, Counter, generate_latest, REGISTRY    level=logging.INFO,

    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'

from inference import K8sAutoScalingPredictor)

import configlogger = logging.getLogger(__name__)



# Logging setup# Flask app

logging.basicConfig(app = Flask(__name__)

    level=logging.INFO,

    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'# Prometheus metrics

)predicted_replicas_gauge = Gauge(

logger = logging.getLogger(__name__)    'ml_predicted_replicas',

    'ML model predicted optimal replica count',

# Configuration    ['service']

PROMETHEUS_URL = os.getenv('PROMETHEUS_URL', 'http://kube-prometheus-stack-prometheus.monitoring.svc.cluster.local:9090'))

NAMESPACE = os.getenv('NAMESPACE', 'ballandbeer')

MODEL_TYPE = os.getenv('MODEL_TYPE', 'random_forest')current_replicas_gauge = Gauge(

PREDICTION_INTERVAL = int(os.getenv('PREDICTION_INTERVAL', '30'))  # seconds    'ml_current_replicas',

SERVICES = config.SERVICES    'Current replica count',

    ['service']

# Prometheus metrics)

predicted_replicas_gauge = Gauge(

    'ml_predicted_replicas',prediction_confidence_gauge = Gauge(

    'ML model predicted optimal replica count',    'ml_prediction_confidence',

    ['service']    'Confidence score of ML prediction',

)    ['service']

)

current_replicas_gauge = Gauge(

    'ml_current_replicas',prediction_counter = Counter(

    'Current replica count',    'ml_predictions_total',

    ['service']    'Total number of predictions made',

)    ['service', 'action']

)

prediction_confidence_gauge = Gauge(

    'ml_prediction_confidence',prediction_errors_counter = Counter(

    'Confidence score of ML prediction',    'ml_prediction_errors_total',

    ['service']    'Total number of prediction errors',

)    ['service', 'error_type']

)

prediction_counter = Counter(

    'ml_predictions_total',# Configuration

    'Total number of predictions made',PROMETHEUS_URL = os.getenv('PROMETHEUS_URL', 'http://kube-prometheus-stack-prometheus.monitoring.svc.cluster.local:9090')

    ['service', 'action']KUBERNETES_API = os.getenv('KUBERNETES_API', 'https://kubernetes.default.svc')

)NAMESPACE = os.getenv('NAMESPACE', 'ballandbeer')

MODEL_TYPE = os.getenv('MODEL_TYPE', 'random_forest')

prediction_errors_counter = Counter(PREDICTION_INTERVAL = int(os.getenv('PREDICTION_INTERVAL', '30'))  # seconds

    'ml_prediction_errors_total',SERVICES = config.SERVICES

    'Total number of prediction errors',

    ['service', 'error_type']# Initialize predictor

)predictor = K8sAutoScalingPredictor(model_type=MODEL_TYPE)

logger.info(f"ML Predictor initialized with model type: {MODEL_TYPE}")

# Store last predictions

last_predictions: Dict[str, Dict] = {}# Store last predictions

last_predictions = {}

# Global predictor instance

predictor: Optional[K8sAutoScalingPredictor] = None

def query_prometheus(query: str) -> Dict:

# Background task    """Query Prometheus and return results"""

prediction_task: Optional[asyncio.Task] = None    try:

        response = requests.get(

            f"{PROMETHEUS_URL}/api/v1/query",

# Pydantic models            params={'query': query},

class PredictionResponse(BaseModel):            timeout=10

    service_name: str        )

    current_replicas: int        response.raise_for_status()

    predicted_replicas: int        return response.json()

    action: str    except Exception as e:

    change: int        logger.error(f"Failed to query Prometheus: {e}")

    reasoning: str        return None

    confidence: float

    timestamp: str

def get_current_replicas(service: str) -> int:

    """Get current replica count from Prometheus metrics"""

class PredictionRequest(BaseModel):    query = f'kube_deployment_status_replicas{{namespace="{NAMESPACE}",deployment="{service}"}}'

    service_name: str = Field(..., description="Service name")    result = query_prometheus(query)

    cpu_usage_percent: float = Field(0.0, ge=0, le=100)    

    ram_usage_percent: float = Field(0.0, ge=0, le=100)    if result and result.get('status') == 'success':

    request_count_per_second: float = Field(0.0, ge=0)        data = result.get('data', {}).get('result', [])

    response_time_ms: float = Field(0.0, ge=0)        if data:

    replica_count: int = Field(1, ge=1, le=10)            return int(data[0]['value'][1])

    cpu_usage_percent_last_5_min: Optional[float] = None    

    cpu_usage_percent_slope: Optional[float] = None    logger.warning(f"Could not get current replicas for {service}, defaulting to 1")

    ram_usage_percent_last_5_min: Optional[float] = None    return 1

    ram_usage_percent_slope: Optional[float] = None

    request_count_per_second_last_5_min: Optional[float] = None

    cpu_request: float = Field(0.5)def collect_metrics_for_service(service: str) -> Dict:

    cpu_limit: float = Field(2.0)    """Collect all required metrics for a service from Prometheus"""

    ram_request: float = Field(512.0)    try:

    ram_limit: float = Field(2048.0)        features = {'service_name': service}

    queue_length: int = Field(0, ge=0)        

    error_rate: float = Field(0.0, ge=0, le=1)        # CPU metrics

    pod_restart_count: int = Field(0, ge=0)        cpu_query = f'rate(container_cpu_usage_seconds_total{{namespace="{NAMESPACE}",pod=~"{service}-.*"}}[5m]) * 100'

    node_cpu_pressure_flag: int = Field(0, ge=0, le=1)        cpu_result = query_prometheus(cpu_query)

    node_memory_pressure_flag: int = Field(0, ge=0, le=1)        if cpu_result and cpu_result['status'] == 'success':

            data = cpu_result['data']['result']

            if data:

class HealthResponse(BaseModel):                features['cpu_usage_percent'] = float(data[0]['value'][1])

    status: str            else:

    model_type: str                features['cpu_usage_percent'] = 0.0

    model_loaded: bool        

    services: List[str]        # Memory metrics

        mem_query = f'container_memory_working_set_bytes{{namespace="{NAMESPACE}",pod=~"{service}-.*"}} / container_spec_memory_limit_bytes * 100'

        mem_result = query_prometheus(mem_query)

# Helper functions        if mem_result and mem_result['status'] == 'success':

def query_prometheus(query: str) -> Optional[Dict]:            data = mem_result['data']['result']

    """Query Prometheus and return results"""            if data:

    try:                features['ram_usage_percent'] = float(data[0]['value'][1])

        response = requests.get(            else:

            f"{PROMETHEUS_URL}/api/v1/query",                features['ram_usage_percent'] = 0.0

            params={'query': query},        

            timeout=10        # Request rate (from nginx ingress)

        )        req_query = f'rate(nginx_ingress_controller_requests{{service="{service}"}}[5m])'

        response.raise_for_status()        req_result = query_prometheus(req_query)

        return response.json()        if req_result and req_result['status'] == 'success':

    except Exception as e:            data = req_result['data']['result']

        logger.error(f"Failed to query Prometheus: {e}")            if data:

        return None                features['request_count_per_second'] = float(data[0]['value'][1])

            else:

                features['request_count_per_second'] = 0.0

def get_current_replicas(service: str) -> int:        

    """Get current replica count from Prometheus metrics"""        # Response time

    query = f'kube_deployment_status_replicas{{namespace="{NAMESPACE}",deployment="{service}"}}'        resp_query = f'histogram_quantile(0.95, rate(nginx_ingress_controller_request_duration_seconds_bucket{{service="{service}"}}[5m])) * 1000'

    result = query_prometheus(query)        resp_result = query_prometheus(resp_query)

            if resp_result and resp_result['status'] == 'success':

    if result and result.get('status') == 'success':            data = resp_result['data']['result']

        data = result.get('data', {}).get('result', [])            if data:

        if data:                features['response_time_ms'] = float(data[0]['value'][1])

            return int(data[0]['value'][1])            else:

                    features['response_time_ms'] = 0.0

    logger.warning(f"Could not get current replicas for {service}, defaulting to 1")        

    return 1        # Current replicas

        features['replica_count'] = get_current_replicas(service)

        

def collect_metrics_for_service(service: str) -> Optional[Dict]:        # Fill in other required features with defaults

    """Collect all required metrics for a service from Prometheus"""        # (In production, fetch these from Prometheus or calculate)

    try:        features['cpu_usage_percent_last_5_min'] = features['cpu_usage_percent']

        features = {'service_name': service}        features['cpu_usage_percent_slope'] = 0.0

                features['ram_usage_percent_last_5_min'] = features['ram_usage_percent']

        # CPU metrics        features['ram_usage_percent_slope'] = 0.0

        cpu_query = f'rate(container_cpu_usage_seconds_total{{namespace="{NAMESPACE}",pod=~"{service}-.*"}}[5m]) * 100'        features['request_count_per_second_last_5_min'] = features['request_count_per_second']

        cpu_result = query_prometheus(cpu_query)        features['cpu_request'] = 0.5

        if cpu_result and cpu_result['status'] == 'success':        features['cpu_limit'] = 2.0

            data = cpu_result['data']['result']        features['ram_request'] = 512.0

            features['cpu_usage_percent'] = float(data[0]['value'][1]) if data else 0.0        features['ram_limit'] = 2048.0

        else:        features['queue_length'] = 0

            features['cpu_usage_percent'] = 0.0        features['error_rate'] = 0.0

                features['pod_restart_count'] = 0

        # Memory metrics        features['node_cpu_pressure_flag'] = 0

        mem_query = f'container_memory_working_set_bytes{{namespace="{NAMESPACE}",pod=~"{service}-.*"}} / container_spec_memory_limit_bytes * 100'        features['node_memory_pressure_flag'] = 0

        mem_result = query_prometheus(mem_query)        

        if mem_result and mem_result['status'] == 'success':        return features

            data = mem_result['data']['result']        

            features['ram_usage_percent'] = float(data[0]['value'][1]) if data else 0.0    except Exception as e:

        else:        logger.error(f"Error collecting metrics for {service}: {e}")

            features['ram_usage_percent'] = 0.0        prediction_errors_counter.labels(service=service, error_type='metric_collection').inc()

                return None

        # Request rate (from nginx ingress)

        req_query = f'rate(nginx_ingress_controller_requests{{service="{service}"}}[5m])'

        req_result = query_prometheus(req_query)def make_predictions():

        if req_result and req_result['status'] == 'success':    """Make predictions for all services and update Prometheus metrics"""

            data = req_result['data']['result']    logger.info("Making predictions for all services...")

            features['request_count_per_second'] = float(data[0]['value'][1]) if data else 0.0    

        else:    for service in SERVICES:

            features['request_count_per_second'] = 0.0        try:

                    # Collect metrics

        # Response time            features = collect_metrics_for_service(service)

        resp_query = f'histogram_quantile(0.95, rate(nginx_ingress_controller_request_duration_seconds_bucket{{service="{service}"}}[5m])) * 1000'            if not features:

        resp_result = query_prometheus(resp_query)                logger.warning(f"Skipping {service} due to missing metrics")

        if resp_result and resp_result['status'] == 'success':                continue

            data = resp_result['data']['result']            

            features['response_time_ms'] = float(data[0]['value'][1]) if data else 0.0            # Make prediction

        else:            decision = predictor.get_scaling_decision(features)

            features['response_time_ms'] = 0.0            

                    # Update Prometheus metrics

        # Current replicas            predicted_replicas_gauge.labels(service=service).set(decision['predicted_replicas'])

        features['replica_count'] = get_current_replicas(service)            current_replicas_gauge.labels(service=service).set(decision['current_replicas'])

                    prediction_confidence_gauge.labels(service=service).set(decision['confidence'])

        # Fill in other required features with defaults            prediction_counter.labels(service=service, action=decision['action']).inc()

        features['cpu_usage_percent_last_5_min'] = features['cpu_usage_percent']            

        features['cpu_usage_percent_slope'] = 0.0            # Store last prediction

        features['ram_usage_percent_last_5_min'] = features['ram_usage_percent']            last_predictions[service] = {

        features['ram_usage_percent_slope'] = 0.0                'timestamp': datetime.now().isoformat(),

        features['request_count_per_second_last_5_min'] = features['request_count_per_second']                **decision

        features['cpu_request'] = 0.5            }

        features['cpu_limit'] = 2.0            

        features['ram_request'] = 512.0            logger.info(

        features['ram_limit'] = 2048.0                f"{service}: current={decision['current_replicas']}, "

        features['queue_length'] = 0                f"predicted={decision['predicted_replicas']}, "

        features['error_rate'] = 0.0                f"action={decision['action']}, "

        features['pod_restart_count'] = 0                f"confidence={decision['confidence']}"

        features['node_cpu_pressure_flag'] = 0            )

        features['node_memory_pressure_flag'] = 0            

                except Exception as e:

        return features            logger.error(f"Error making prediction for {service}: {e}")

                    prediction_errors_counter.labels(service=service, error_type='prediction').inc()

    except Exception as e:

        logger.error(f"Error collecting metrics for {service}: {e}")

        prediction_errors_counter.labels(service=service, error_type='metric_collection').inc()def prediction_loop():

        return None    """Background loop for continuous predictions"""

    logger.info(f"Starting prediction loop (interval: {PREDICTION_INTERVAL}s)")

    

async def make_predictions():    while True:

    """Make predictions for all services and update Prometheus metrics"""        try:

    logger.info("Making predictions for all services...")            make_predictions()

            except Exception as e:

    for service in SERVICES:            logger.error(f"Error in prediction loop: {e}")

        try:        

            # Collect metrics        time.sleep(PREDICTION_INTERVAL)

            features = collect_metrics_for_service(service)

            if not features:

                logger.warning(f"Skipping {service} due to missing metrics")# REST API endpoints

                continue@app.route('/health', methods=['GET'])

            def health():

            # Make prediction    """Health check endpoint"""

            decision = predictor.get_scaling_decision(features)    return jsonify({'status': 'healthy', 'model_type': MODEL_TYPE})

            

            # Update Prometheus metrics

            predicted_replicas_gauge.labels(service=service).set(decision['predicted_replicas'])@app.route('/metrics', methods=['GET'])

            current_replicas_gauge.labels(service=service).set(decision['current_replicas'])def metrics():

            prediction_confidence_gauge.labels(service=service).set(decision['confidence'])    """Prometheus metrics endpoint"""

            prediction_counter.labels(service=service, action=decision['action']).inc()    return generate_latest(REGISTRY)

            

            # Store last prediction

            last_predictions[service] = {@app.route('/predictions', methods=['GET'])

                'timestamp': datetime.now().isoformat(),def get_predictions():

                **decision    """Get last predictions for all services"""

            }    return jsonify(last_predictions)

            

            logger.info(

                f"{service}: current={decision['current_replicas']}, "@app.route('/predictions/<service>', methods=['GET'])

                f"predicted={decision['predicted_replicas']}, "def get_service_prediction(service):

                f"action={decision['action']}, "    """Get last prediction for a specific service"""

                f"confidence={decision['confidence']}"    if service not in last_predictions:

            )        return jsonify({'error': f'No predictions found for service: {service}'}), 404

                return jsonify(last_predictions[service])

        except Exception as e:

            logger.error(f"Error making prediction for {service}: {e}")

            prediction_errors_counter.labels(service=service, error_type='prediction').inc()@app.route('/predict', methods=['POST'])

def predict():

    """Manual prediction endpoint (for testing)"""

async def prediction_loop():    try:

    """Background task for continuous predictions"""        features = request.json

    logger.info(f"Starting prediction loop (interval: {PREDICTION_INTERVAL}s)")        if not features:

                return jsonify({'error': 'No features provided'}), 400

    while True:        

        try:        decision = predictor.get_scaling_decision(features)

            await make_predictions()        return jsonify(decision)

        except Exception as e:    except Exception as e:

            logger.error(f"Error in prediction loop: {e}")        logger.error(f"Error in manual prediction: {e}")

                return jsonify({'error': str(e)}), 500

        await asyncio.sleep(PREDICTION_INTERVAL)



if __name__ == '__main__':

@asynccontextmanager    import threading

async def lifespan(app: FastAPI):    

    """Lifecycle manager for startup and shutdown"""    # Start prediction loop in background thread

    global predictor, prediction_task    prediction_thread = threading.Thread(target=prediction_loop, daemon=True)

        prediction_thread.start()

    # Startup    

    logger.info(f"Starting ML-Autoscaler service with model type: {MODEL_TYPE}")    # Start Flask app

    predictor = K8sAutoScalingPredictor(model_type=MODEL_TYPE)    port = int(os.getenv('PORT', '8080'))

    logger.info("ML Predictor initialized successfully")    app.run(host='0.0.0.0', port=port)

    
    # Start background prediction task
    prediction_task = asyncio.create_task(prediction_loop())
    logger.info("Background prediction task started")
    
    yield
    
    # Shutdown
    logger.info("Shutting down ML-Autoscaler service...")
    if prediction_task:
        prediction_task.cancel()
        try:
            await prediction_task
        except asyncio.CancelledError:
            logger.info("Prediction task cancelled")


# FastAPI app
app = FastAPI(
    title="ML-Autoscaler Service",
    description="Real-time ML-based predictions for Kubernetes autoscaling",
    version="1.0.0",
    lifespan=lifespan
)


# API endpoints
@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        model_type=MODEL_TYPE,
        model_loaded=predictor is not None,
        services=SERVICES
    )


@app.get("/metrics", response_class=PlainTextResponse)
async def metrics():
    """Prometheus metrics endpoint"""
    return generate_latest(REGISTRY).decode('utf-8')


@app.get("/predictions", response_model=Dict[str, PredictionResponse])
async def get_predictions():
    """Get last predictions for all services"""
    if not last_predictions:
        raise HTTPException(status_code=404, detail="No predictions available yet")
    
    return {
        service: PredictionResponse(**pred)
        for service, pred in last_predictions.items()
    }


@app.get("/predictions/{service}", response_model=PredictionResponse)
async def get_service_prediction(service: str):
    """Get last prediction for a specific service"""
    if service not in last_predictions:
        raise HTTPException(
            status_code=404,
            detail=f"No predictions found for service: {service}"
        )
    
    return PredictionResponse(**last_predictions[service])


@app.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    """Manual prediction endpoint (for testing)"""
    try:
        features = request.model_dump()
        
        # Fill in missing optional fields
        if features['cpu_usage_percent_last_5_min'] is None:
            features['cpu_usage_percent_last_5_min'] = features['cpu_usage_percent']
        if features['cpu_usage_percent_slope'] is None:
            features['cpu_usage_percent_slope'] = 0.0
        if features['ram_usage_percent_last_5_min'] is None:
            features['ram_usage_percent_last_5_min'] = features['ram_usage_percent']
        if features['ram_usage_percent_slope'] is None:
            features['ram_usage_percent_slope'] = 0.0
        if features['request_count_per_second_last_5_min'] is None:
            features['request_count_per_second_last_5_min'] = features['request_count_per_second']
        
        decision = predictor.get_scaling_decision(features)
        decision['timestamp'] = datetime.now().isoformat()
        
        return PredictionResponse(**decision)
    except Exception as e:
        logger.error(f"Error in manual prediction: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "service": "ML-Autoscaler",
        "version": "1.0.0",
        "model_type": MODEL_TYPE,
        "prediction_interval": f"{PREDICTION_INTERVAL}s",
        "lookahead": f"{config.LOOKAHEAD_MINUTES} minutes",
        "services": SERVICES,
        "endpoints": {
            "health": "/health",
            "metrics": "/metrics",
            "predictions": "/predictions",
            "predict": "/predict",
            "docs": "/docs",
            "redoc": "/redoc"
        }
    }


if __name__ == '__main__':
    import uvicorn
    
    port = int(os.getenv('PORT', '8080'))
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=port,
        log_level="info",
        access_log=True
    )
