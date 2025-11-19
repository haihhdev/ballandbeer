"""
ML-Autoscaler Service - Real-time prediction service for K8s autoscaling

This service:
1. Fetches current metrics from Prometheus every 30s
2. Makes predictions using trained Transformer ML model
3. Exports predictions as Prometheus metrics for KEDA
4. Provides REST API for manual queries
5. Predicts 10 minutes ahead for proactive scaling
"""

import os
import time
import logging
import asyncio
from datetime import datetime
from typing import Dict, List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
import requests

from prometheus_client import Gauge, Counter, generate_latest, REGISTRY

from inference import K8sAutoScalingPredictor
import config

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
PROMETHEUS_URL = os.getenv('PROMETHEUS_URL', 'http://kube-prometheus-stack-prometheus.monitoring.svc.cluster.local:9090')
NAMESPACE = os.getenv('NAMESPACE', 'ballandbeer')
MODEL_TYPE = os.getenv('MODEL_TYPE', 'transformer')
PREDICTION_INTERVAL = int(os.getenv('PREDICTION_INTERVAL', '30'))  # seconds
SERVICES = config.SERVICES

# Prometheus metrics for KEDA
predicted_replicas_gauge = Gauge(
    'ml_predicted_replicas',
    'ML model predicted optimal replica count for next 10 minutes',
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

# Global state
predictor: Optional[K8sAutoScalingPredictor] = None
last_predictions: Dict[str, Dict] = {}
prediction_task: Optional[asyncio.Task] = None


# Pydantic models
class PredictionResponse(BaseModel):
    service_name: str
    current_replicas: int
    predicted_replicas: int
    action: str
    change: int
    reasoning: str
    confidence: float
    timestamp: str
    lookahead_minutes: int = 10


class PredictionRequest(BaseModel):
    service_name: str = Field(..., description="Service name")
    cpu_usage_percent: float = Field(0.0, ge=0, le=100)
    ram_usage_percent: float = Field(0.0, ge=0, le=100)
    request_count_per_second: float = Field(0.0, ge=0)
    response_time_ms: float = Field(0.0, ge=0)
    replica_count: int = Field(1, ge=1, le=10)
    cpu_usage_percent_last_5_min: Optional[float] = None
    cpu_usage_percent_slope: Optional[float] = None
    ram_usage_percent_last_5_min: Optional[float] = None
    ram_usage_percent_slope: Optional[float] = None
    request_count_per_second_last_5_min: Optional[float] = None
    cpu_request: float = Field(0.5)
    cpu_limit: float = Field(2.0)
    ram_request: float = Field(512.0)
    ram_limit: float = Field(2048.0)
    queue_length: int = Field(0, ge=0)
    error_rate: float = Field(0.0, ge=0, le=1)
    pod_restart_count: int = Field(0, ge=0)
    node_cpu_pressure_flag: int = Field(0, ge=0, le=1)
    node_memory_pressure_flag: int = Field(0, ge=0, le=1)


class HealthResponse(BaseModel):
    status: str
    model_type: str
    model_loaded: bool
    services: List[str]
    lookahead_minutes: int


# Helper functions
def query_prometheus(query: str) -> Optional[Dict]:
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


def collect_metrics_for_service(service: str) -> Optional[Dict]:
    """Collect all required metrics for a service from Prometheus"""
    try:
        features = {'service_name': service}
        
        # CPU metrics
        cpu_query = f'rate(container_cpu_usage_seconds_total{{namespace="{NAMESPACE}",pod=~"{service}-.*"}}[5m]) * 100'
        cpu_result = query_prometheus(cpu_query)
        if cpu_result and cpu_result['status'] == 'success':
            data = cpu_result['data']['result']
            features['cpu_usage_percent'] = float(data[0]['value'][1]) if data else 0.0
        else:
            features['cpu_usage_percent'] = 0.0
        
        # Memory metrics
        mem_query = f'container_memory_working_set_bytes{{namespace="{NAMESPACE}",pod=~"{service}-.*"}} / container_spec_memory_limit_bytes * 100'
        mem_result = query_prometheus(mem_query)
        if mem_result and mem_result['status'] == 'success':
            data = mem_result['data']['result']
            features['ram_usage_percent'] = float(data[0]['value'][1]) if data else 0.0
        else:
            features['ram_usage_percent'] = 0.0
        
        # Request rate (from nginx ingress)
        req_query = f'rate(nginx_ingress_controller_requests{{service="{service}"}}[5m])'
        req_result = query_prometheus(req_query)
        if req_result and req_result['status'] == 'success':
            data = req_result['data']['result']
            features['request_count_per_second'] = float(data[0]['value'][1]) if data else 0.0
        else:
            features['request_count_per_second'] = 0.0
        
        # Response time
        resp_query = f'histogram_quantile(0.95, rate(nginx_ingress_controller_request_duration_seconds_bucket{{service="{service}"}}[5m])) * 1000'
        resp_result = query_prometheus(resp_query)
        if resp_result and resp_result['status'] == 'success':
            data = resp_result['data']['result']
            features['response_time_ms'] = float(data[0]['value'][1]) if data else 0.0
        else:
            features['response_time_ms'] = 0.0
        
        # Current replicas
        features['replica_count'] = get_current_replicas(service)
        
        # Resource requests and limits (CRITICAL: Must query actual values from K8s)
        # Query CPU request/limit
        cpu_req_query = f'kube_deployment_spec_container_resource_requests{{namespace="{NAMESPACE}",deployment="{service}",resource="cpu"}}'
        cpu_req_result = query_prometheus(cpu_req_query)
        if cpu_req_result and cpu_req_result['status'] == 'success':
            data = cpu_req_result['data']['result']
            features['cpu_request'] = float(data[0]['value'][1]) if data else 0.05
        else:
            # Fallback defaults per service (from training data)
            features['cpu_request'] = 0.05 if service in ['authen', 'booking', 'product', 'profile', 'frontend'] else 0.1
        
        cpu_lim_query = f'kube_deployment_spec_container_resource_limits{{namespace="{NAMESPACE}",deployment="{service}",resource="cpu"}}'
        cpu_lim_result = query_prometheus(cpu_lim_query)
        if cpu_lim_result and cpu_lim_result['status'] == 'success':
            data = cpu_lim_result['data']['result']
            features['cpu_limit'] = float(data[0]['value'][1]) if data else 0.2
        else:
            # Fallback defaults per service
            features['cpu_limit'] = 0.2 if service in ['authen', 'booking', 'product', 'profile'] else 0.3 if service == 'frontend' else 0.5
        
        # Query RAM request/limit (CRITICAL FIX)
        ram_req_query = f'kube_deployment_spec_container_resource_requests{{namespace="{NAMESPACE}",deployment="{service}",resource="memory"}}'
        ram_req_result = query_prometheus(ram_req_query)
        if ram_req_result and ram_req_result['status'] == 'success':
            data = ram_req_result['data']['result']
            features['ram_request'] = float(data[0]['value'][1]) if data else 67108864.0
        else:
            # Fallback defaults per service (from training data)
            if service == 'recommender':
                features['ram_request'] = 402653184.0  # 384MB
            elif service in ['order', 'frontend']:
                features['ram_request'] = 134217728.0  # 128MB
            else:
                features['ram_request'] = 67108864.0  # 64MB
        
        ram_lim_query = f'kube_deployment_spec_container_resource_limits{{namespace="{NAMESPACE}",deployment="{service}",resource="memory"}}'
        ram_lim_result = query_prometheus(ram_lim_query)
        if ram_lim_result and ram_lim_result['status'] == 'success':
            data = ram_lim_result['data']['result']
            features['ram_limit'] = float(data[0]['value'][1]) if data else 134217728.0
        else:
            # Fallback defaults per service
            if service == 'recommender':
                features['ram_limit'] = 805306368.0  # 768MB
            elif service in ['order', 'frontend']:
                features['ram_limit'] = 268435456.0  # 256MB
            else:
                features['ram_limit'] = 134217728.0  # 128MB
        
        # Fill in other required features with defaults
        features['cpu_usage_percent_last_5_min'] = features['cpu_usage_percent']
        features['cpu_usage_percent_slope'] = 0.0
        features['ram_usage_percent_last_5_min'] = features['ram_usage_percent']
        features['ram_usage_percent_slope'] = 0.0
        features['request_count_per_second_last_5_min'] = features['request_count_per_second']
        features['queue_length'] = 0
        features['error_rate'] = 0.0
        features['pod_restart_count'] = 0
        features['node_cpu_pressure_flag'] = 0
        features['node_memory_pressure_flag'] = 0
        
        # Engineered features (required by model - 36 features total)
        cpu_pct = features['cpu_usage_percent']
        ram_pct = features['ram_usage_percent']
        replica_count = features['replica_count']
        req_rate = features['request_count_per_second']
        resp_time = features['response_time_ms']
        
        # Utilization ratios
        features['cpu_utilization_ratio'] = cpu_pct / 100 if cpu_pct > 0 else 0
        features['ram_utilization_ratio'] = ram_pct / 100 if ram_pct > 0 else 0
        
        # Change rates (defaults as no history yet)
        features['cpu_change_rate'] = 0.0
        features['ram_change_rate'] = 0.0
        features['request_change_rate'] = 0.0
        
        # Rolling stats (estimates based on current values)
        features['cpu_rolling_std'] = cpu_pct * 0.1
        features['ram_rolling_std'] = ram_pct * 0.1
        features['request_rolling_max'] = req_rate * 1.2
        features['response_time_rolling_p95'] = resp_time * 1.2
        
        # Per-replica metrics
        features['cpu_per_replica'] = cpu_pct / max(replica_count, 1)
        features['ram_per_replica'] = ram_pct / max(replica_count, 1)
        features['requests_per_replica'] = req_rate / max(replica_count, 1)
        
        # System pressure indicator
        pressure = 0
        if cpu_pct > 70: pressure += 1
        if ram_pct > 75: pressure += 1
        if resp_time > 500: pressure += 1
        if features['error_rate'] > 0.05: pressure += 1
        features['system_pressure'] = pressure
        
        # Incident flag
        features['is_incident'] = 0
        
        return features
        
    except Exception as e:
        logger.error(f"Error collecting metrics for {service}: {e}")
        prediction_errors_counter.labels(service=service, error_type='metric_collection').inc()
        return None


async def make_predictions():
    """Make predictions for all services and update Prometheus metrics"""
    logger.info("Making predictions for all services...")
    
    for service in SERVICES:
        try:
            # Collect metrics
            features = collect_metrics_for_service(service)
            if not features:
                logger.warning(f"Skipping {service} due to missing metrics")
                continue
            
            # Make prediction (predicts 10 minutes ahead based on model training)
            decision = predictor.get_scaling_decision(features)
            
            # Update Prometheus metrics (KEDA will read these)
            predicted_replicas_gauge.labels(service=service).set(decision['predicted_replicas'])
            current_replicas_gauge.labels(service=service).set(decision['current_replicas'])
            prediction_confidence_gauge.labels(service=service).set(decision['confidence'])
            prediction_counter.labels(service=service, action=decision['action']).inc()
            
            # Store last prediction
            last_predictions[service] = {
                'timestamp': datetime.now().isoformat(),
                'lookahead_minutes': config.LOOKAHEAD_MINUTES,
                **decision
            }
            
            logger.info(
                f"{service}: current={decision['current_replicas']}, "
                f"predicted={decision['predicted_replicas']} (10min ahead), "
                f"action={decision['action']}, "
                f"confidence={decision['confidence']}"
            )
            
        except Exception as e:
            logger.error(f"Error making prediction for {service}: {e}")
            prediction_errors_counter.labels(service=service, error_type='prediction').inc()


async def prediction_loop():
    """Background task for continuous predictions"""
    logger.info(f"Starting prediction loop (interval: {PREDICTION_INTERVAL}s)")
    
    while True:
        try:
            await make_predictions()
        except Exception as e:
            logger.error(f"Error in prediction loop: {e}")
        
        await asyncio.sleep(PREDICTION_INTERVAL)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for startup and shutdown"""
    global predictor, prediction_task
    
    # Startup
    logger.info(f"Starting ML-Autoscaler service with model type: {MODEL_TYPE}")
    predictor = K8sAutoScalingPredictor(model_type=MODEL_TYPE)
    logger.info("ML Predictor initialized successfully")
    
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
    description="Real-time ML-based predictions for Kubernetes autoscaling with KEDA integration",
    version="2.0.0",
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
        services=SERVICES,
        lookahead_minutes=config.LOOKAHEAD_MINUTES
    )


@app.get("/metrics", response_class=PlainTextResponse)
async def metrics():
    """
    Prometheus metrics endpoint for KEDA
    
    KEDA will scrape the 'ml_predicted_replicas' metric to scale deployments
    based on predicted load 10 minutes into the future.
    """
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
        decision['lookahead_minutes'] = config.LOOKAHEAD_MINUTES
        
        return PredictionResponse(**decision)
    except Exception as e:
        logger.error(f"Error in manual prediction: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "service": "ML-Autoscaler",
        "version": "2.0.0",
        "model_type": MODEL_TYPE,
        "prediction_interval": f"{PREDICTION_INTERVAL}s",
        "lookahead": f"{config.LOOKAHEAD_MINUTES} minutes",
        "services": SERVICES,
        "keda_integration": {
            "enabled": True,
            "metric_name": "ml_predicted_replicas",
            "scrape_endpoint": "/metrics",
            "description": "KEDA ScaledObject should target 'ml_predicted_replicas' metric"
        },
        "endpoints": {
            "health": "/health",
            "metrics": "/metrics (for KEDA)",
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
