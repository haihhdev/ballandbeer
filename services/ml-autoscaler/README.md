# ML Auto-Scaling for Kubernetes

ML-based prediction service for proactive Kubernetes auto-scaling using Transformer model with PCA.

## Quick Start

### 1. Install Dependencies

```bash
cd services/ml-autoscaler
pip install -r requirements.txt
```

### 2. Train Model

Prepare your metrics data in `metrics/` folder, then run:

```bash
python training/transformer_decoder.py
```

Output files:
- `models/transformer_model.keras`
- `models/transformer_pca.joblib`
- `models/transformer_scaler.joblib`

### 3. Deploy Service

```bash
# Build image
docker build -t hao1706/ml-autoscaler:latest .
docker push hao1706/ml-autoscaler:latest

# Deploy to Kubernetes
kubectl apply -k ops/k8s/ml-autoscaler/base
```

### 4. Verify Deployment

```bash
# Check service status
kubectl get pods -n ballandbeer -l app=ml-autoscaler

# Check predictions
kubectl port-forward -n ballandbeer svc/ml-autoscaler 8080:8080
curl http://localhost:8080/predictions

# Check metrics for KEDA
curl http://localhost:8080/metrics | grep ml_predicted_replicas
```

## Configuration

Environment variables in deployment:

```yaml
- name: MODEL_TYPE
  value: "transformer"
- name: PROMETHEUS_URL
  value: "http://kube-prometheus-stack-prometheus.monitoring.svc.cluster.local:9090"
- name: NAMESPACE
  value: "ballandbeer"
- name: PREDICTION_INTERVAL
  value: "30"  # seconds
```

## API Endpoints

- `GET /health` - Health check
- `GET /metrics` - Prometheus metrics (for KEDA)
- `GET /predictions` - All predictions
- `GET /predictions/{service}` - Service-specific prediction
- `POST /predict` - Manual prediction
- `GET /docs` - API documentation

## KEDA Integration

Service exposes `ml_predicted_replicas` metric that KEDA uses to scale deployments 10 minutes ahead.

KEDA ScaledObjects are defined in `ops/k8s/ml-autoscaler/base/scaledobjects.yaml`.

## Manual Prediction

```python
from inference import K8sAutoScalingPredictor

predictor = K8sAutoScalingPredictor(model_type='transformer')

features = {
    'service_name': 'product',
    'cpu_usage_percent': 75.0,
    'ram_usage_percent': 68.0,
    'request_count_per_second': 150.0,
    'response_time_ms': 450.0,
    'replica_count': 2
}

decision = predictor.get_scaling_decision(features)
print(decision)
```

## Monitoring

```bash
# View metrics
curl http://ml-autoscaler:8080/metrics

# View predictions
curl http://ml-autoscaler:8080/predictions

# Check logs
kubectl logs -n ballandbeer -l app=ml-autoscaler -f
```

## Troubleshooting

**"Not enough samples"**: Wait 6 minutes for buffer to fill (12 time steps)

**"PCA not found"**: Re-run training: `python training/transformer_decoder.py`

**High errors**: Retrain with recent data or check feature consistency
