# ML Autoscaler

Machine Learning-based proactive autoscaling service for Kubernetes using Transformer architecture. Predicts optimal replica counts 5 minutes ahead to enable preemptive scaling decisions.

## Architecture

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Prometheus    │─────>│  ML Autoscaler  │─────>│      KEDA       │
│    (metrics)    │      │  (predictions)  │      │   (scaling)     │
└─────────────────┘      └─────────────────┘      └─────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │  Per-Service Models   │
                    │  (7 Transformers)     │
                    └───────────────────────┘
```

## Project Structure

```
ml-autoscaler/
├── training/
│   ├── transformer_per_service.py  # Main training script
│   ├── filter_metrics.py           # Data preprocessing pipeline
│   ├── analyze_metrics.py          # Data quality analysis
│   └── download_data.sh            # Download metrics from S3
├── metrics/
│   ├── filtered/                   # Cleaned data for training
│   └── *.csv                       # Raw metrics files
├── models/
│   ├── transformer_model_{service}.keras
│   └── transformer_scaler_{service}.joblib
├── plots/                          # Training visualizations
├── config.py                       # Configuration parameters
├── data_preprocessor.py            # Feature engineering
├── inference.py                    # Prediction service
├── app.py                          # FastAPI application
└── Dockerfile
```

## Model Architecture

### Transformer Decoder-Only

Each service has its own Transformer model optimized for time series forecasting:

```
Input: [batch, sequence_length=40, n_features=27]
                    │
                    ▼
┌─────────────────────────────────────┐
│      Linear Projection (d_model)    │
│              + Positional Encoding  │
└─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────┐
│      Transformer Block x2           │
│  ┌─────────────────────────────┐    │
│  │  Multi-Head Attention (4h)  │    │
│  │  + Causal Mask              │    │
│  │  + Residual + LayerNorm     │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │  FFN (GELU activation)      │    │
│  │  + Residual + LayerNorm     │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────┐
│      Take Last Timestep [:, -1, :]  │
└─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────┐
│      Prediction Head                │
│      Dense(64) → Dense(32) → Dense(1)│
└─────────────────────────────────────┘
                    │
                    ▼
Output: Predicted replica count (1-5)
```

### Model Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `sequence_length` | 40 | 20 minutes of history (30s intervals) |
| `lookahead` | 10 | Predict 5 minutes ahead |
| `d_model` | 128 | Internal model dimension |
| `num_heads` | 4 | Multi-head attention heads |
| `num_layers` | 2 | Transformer blocks |
| `dff` | 256 | Feed-forward network dimension |
| `dropout` | 0.2 | Regularization dropout rate |

### Positional Encoding

Sinusoidal positional encoding captures temporal relationships:

```python
PE(pos, 2i)   = sin(pos / 10000^(2i/d_model))
PE(pos, 2i+1) = cos(pos / 10000^(2i/d_model))
```

## Training Techniques

### 1. TimeSeriesSplit Cross-Validation

Unlike random K-Fold, TimeSeriesSplit respects temporal order to prevent data leakage:

```
Fold 1: [Train: ████░░░░░░░░░░] [Val: ███░░░░░░░]
Fold 2: [Train: ████████░░░░░░] [Val: ███░░░░░░░]
Fold 3: [Train: ████████████░░] [Val: ███░░░░░░░]
```

Data split strategy:
- 80% for training + validation (TimeSeriesSplit with 3 folds)
- 20% for final testing (held out, never seen during training)

### 2. Feature Normalization (StandardScaler)

All features are normalized to zero mean and unit variance:

```python
X_scaled = (X - mean) / std
```

Benefits:
- Faster convergence during training
- Prevents features with large values from dominating
- Required for neural networks to work effectively

### 3. Class Weights for Imbalanced Data

Replica distribution is typically imbalanced (many replica=1, fewer replica=4,5):

```python
# Compute balanced weights
class_weights = compute_class_weight('balanced', classes=unique_classes, y=y_train)

# Boost minority classes (replica > 1) by 15%
class_weights = {c: w * 1.15 for c, w in class_weights.items() if c > 1}
```

### 4. Custom Loss Function

Combined loss with three components:

```python
def custom_loss(y_true, y_pred):
    # 1. Base MSE loss
    mse = (y_true - y_pred)^2
    
    # 2. Discrete penalty - encourage integer predictions
    discrete_penalty = 0.3 * (y_pred - round(y_pred))^2
    
    # 3. Asymmetric weight - penalize under-prediction more
    # Under-predicting replicas is worse than over-predicting
    asymmetric_weight = 1.0 + 0.2 * (y_true > y_pred)
    
    return mean(mse * asymmetric_weight + discrete_penalty)
```

### 5. Training Callbacks

**Early Stopping:**
- Monitor: `val_loss`
- Patience: 15 epochs
- Restore best weights automatically

**Learning Rate Reduction:**
- Monitor: `val_loss`
- Factor: 0.5 (halve LR when plateau)
- Patience: 5 epochs
- Minimum LR: 1e-6

### 6. Strict Rounding for Predictions

Conservative rounding strategy to prevent over-scaling:

```python
# Require 0.6 threshold to round up (instead of 0.5)
predictions = floor(pred) + (pred % 1 >= 0.6)
predictions = clip(predictions, 1, 10)
```

## Feature Engineering

### Input Features (14 base features)

| Feature | Description |
|---------|-------------|
| `cpu_usage_percent` | Current CPU usage |
| `cpu_usage_percent_last_5_min` | 5-minute rolling average CPU |
| `cpu_usage_percent_slope` | CPU trend (derivative) |
| `ram_usage_percent` | Current RAM usage |
| `ram_usage_percent_last_5_min` | 5-minute rolling average RAM |
| `ram_usage_percent_slope` | RAM trend (derivative) |
| `request_count_per_second` | Current RPS |
| `request_count_per_second_last_5_min` | 5-minute rolling average RPS |
| `response_time_ms` | Average response time |
| `cpu_request` | Kubernetes CPU request |
| `cpu_limit` | Kubernetes CPU limit |
| `ram_request` | Kubernetes RAM request |
| `ram_limit` | Kubernetes RAM limit |

### Engineered Features (13 additional)

Created by `data_preprocessor.py`:

| Feature | Formula |
|---------|---------|
| `cpu_utilization_ratio` | cpu_usage / cpu_limit |
| `ram_utilization_ratio` | ram_usage / ram_limit |
| `cpu_headroom` | 1 - cpu_utilization_ratio |
| `ram_headroom` | 1 - ram_utilization_ratio |
| `cpu_change_rate` | cpu_slope / cpu_usage |
| `ram_change_rate` | ram_slope / ram_usage |
| `request_intensity` | rps / response_time |
| `resource_pressure` | (cpu_util + ram_util) / 2 |
| `scaling_signal` | cpu_slope + ram_slope |
| `cpu_per_replica` | cpu_usage / replica_count |
| `ram_per_replica` | ram_usage / replica_count |
| `rps_per_replica` | rps / replica_count |
| `response_per_replica` | response_time / replica_count |

## Data Preprocessing

### Filter Pipeline (`filter_metrics.py`)

```
Raw CSV → Remove Invalid → Remove Errors → Trim Cold-Start → Reduce Idle → Filtered CSV
```

Operations:
1. **Remove replica=0**: Invalid training target
2. **Remove all-zero metrics**: Collector errors
3. **Remove high error rate (>30%)**: Anomalous data
4. **Trim cold-start**: Initial period where all services have replica=1
5. **Reduce idle periods**: Remove 50% of long idle periods (>5 minutes)

### Data Quality Metrics

| Metric | Formula | Good Value |
|--------|---------|------------|
| Imbalance Ratio (IR) | max_class / min_class | < 20 |
| Gini Coefficient | Distribution inequality | < 0.3 |
| Usable Rows % | valid_rows / total_rows | > 90% |

## Training Pipeline

```
1. Collect metrics (collector + k6 load test)
        │
        ▼
2. Filter data (filter_metrics.py)
   - Remove invalid rows
   - Trim cold-start periods
        │
        ▼
3. Analyze quality (analyze_metrics.py)
   - Check imbalance ratio
   - Verify per-service distribution
        │
        ▼
4. Train models (transformer_per_service.py)
   - For each service:
     a. Filter service data
     b. TimeSeriesSplit cross-validation
     c. StandardScaler normalization
     d. Create sequences (40 timesteps)
     e. Compute class weights
     f. Train Transformer model
     g. Evaluate on test set
     h. Save model and scaler
        │
        ▼
5. Output
   - models/transformer_model_{service}.keras (7 files)
   - models/transformer_scaler_{service}.joblib (7 files)
   - models/per_service_metrics.json
   - plots/training_history_all_services.png
   - plots/predictions_per_service.png
```

## Evaluation Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| Exact Accuracy | pred == actual | > 60% |
| Within-1 Accuracy | \|pred - actual\| <= 1 | > 90% |
| MAE | Mean Absolute Error | < 0.5 |
| RMSE | Root Mean Square Error | < 0.7 |
| R² | Coefficient of Determination | > 0.7 |

## Quick Start

### 1. Install Dependencies

```bash
cd services/ml-autoscaler
pip install -r requirements.txt
```

### 2. Prepare and Filter Data

```bash
cd training
python filter_metrics.py
python analyze_metrics.py ../metrics/filtered/*.csv
```

### 3. Train Models

```bash
python transformer_per_service.py
```

### 4. Deploy

```bash
docker build -t hao1706/ml-autoscaler:latest .
docker push hao1706/ml-autoscaler:latest
kubectl apply -k ops/k8s/ml-autoscaler/base
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/metrics` | GET | Prometheus metrics (for KEDA) |
| `/predictions` | GET | All service predictions |
| `/predictions/{service}` | GET | Single service prediction |
| `/predict` | POST | Manual prediction |
| `/docs` | GET | Swagger API documentation |

## KEDA Integration

Service exposes `ml_predicted_replicas` gauge metric:

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: product-scaledobject
spec:
  scaleTargetRef:
    name: product
  minReplicaCount: 1
  maxReplicaCount: 5
  triggers:
    - type: prometheus
      metadata:
        serverAddress: http://ml-autoscaler.ballandbeer.svc:8080
        metricName: ml_predicted_replicas
        query: ml_predicted_replicas{service="product"}
        threshold: "1"
```

## Services

| Service | Scaling Pattern | Notes |
|---------|-----------------|-------|
| authen | Low-medium | Authentication, burst during login peaks |
| booking | Medium-high | Booking transactions |
| order | High | Order processing, correlates with traffic |
| product | High | Product catalog, most accessed |
| profile | Constant | User profiles, rarely scales |
| frontend | Medium | Web frontend, follows user traffic |
| recommender | Medium | ML recommendations, batch processing |
