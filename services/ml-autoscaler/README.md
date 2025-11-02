# ML Auto-Scaling for Kubernetes

Predict optimal K8s replica counts using machine learning on infrastructure metrics.

## Models

- **Random Forest** - Fast inference (2-5ms), interpretable, production-ready
- **LSTM-CNN** - Higher accuracy, captures temporal patterns, slower (10-20ms)

## Quick Start

```bash
# 1. Install dependencies
cd services/ml-autoscaler
pip install -r requirements.txt

# 2. Download training data from S3
cd training
./download_data.sh -y

# 3. Train and compare both models
python compare_models.py

# Or use automated workflow
python quick_start.py --mode all
```

## Usage

### Manual Training

```bash
cd training

# Train individual models
python random_forest.py      # ~2 minutes
python lstm_cnn.py           # ~10 minutes

# Compare both models
python compare_models.py     # Full comparison + reports
```

### Inference

```python
from inference import K8sAutoScalingPredictor

# Load model
predictor = K8sAutoScalingPredictor(model_type='random_forest')

# Get scaling decision
decision = predictor.get_scaling_decision({
    'service_name': 'product',
    'cpu_usage_percent': 75.5,
    'ram_usage_percent': 68.2,
    'request_count_per_second': 150.5,
    # ... other metrics
})

# Returns: {action, current_replicas, predicted_replicas, confidence, reasoning}
```

## Project Structure

```
ml-autoscaler/
├── config.py                  # All configurations & paths
├── data_preprocessor.py       # Feature engineering pipeline
├── inference.py               # Production inference API
├── requirements.txt
├── metrics/                   # Downloaded CSV files
├── models/                    # Trained models (.keras, .joblib)
├── plots/                     # Training visualizations
└── training/
    ├── random_forest.py       # RF trainer
    ├── lstm_cnn.py            # LSTM-CNN trainer
    ├── compare_models.py      # Model comparison
    ├── quick_start.py         # Automated workflow
    └── download_data.sh       # S3 downloader
```

## Configuration (`config.py`)

- **Features**: 19 core metrics + 14 engineered features
- **Hyperparameters**: Random Forest (n_estimators=200), LSTM-CNN (sequence_length=12)
- **Thresholds**: Scale up (CPU>70%, RAM>75%), Scale down (CPU<30%, RAM<35%)
- **Paths**: All outputs use absolute paths from `BASE_DIR`

## Data Pipeline

```
Collector (K8s) → S3 (s3://ballandbeer-metrics/metrics/YYYY/MM/*.csv)
                          ↓
                   download_data.sh
                          ↓
                    metrics/*.csv
                          ↓
              Feature Engineering (33 features)
                          ↓
            ┌─────────────┴─────────────┐
      Random Forest                LSTM-CNN
    (shuffle split)            (temporal split)
            │                         │
            └──────────┬──────────────┘
                  Comparison
                       ↓
              Best Model → Inference
```

### Metrics Collected (23 columns)

- **Infrastructure**: CPU/RAM usage, requests, limits, pod restarts, node pressure
- **Application**: Request rate, response time (P95), error rate, queue length
- **Derived**: 5-min averages, trend slopes, rolling stats, per-replica metrics
- **Time**: Hour (sin/cos encoding only, minimal time dependency)

### Data Source Options

1. **S3 (Primary)**: `./download_data.sh` or `./download_data.sh 2024-10`
2. **Pod**: `kubectl cp ballandbeer/collector-xxx:/data/metrics_*.csv metrics/`
3. **Manual**: Place CSV files in `metrics/` folder

## Model Comparison

`compare_models.py` trains both models on same data and generates:

**Metrics Evaluated:**
- RMSE, MAE, R² Score
- Exact Accuracy (100% match)
- Within-1 Accuracy (±1 replica tolerance)
- Training time, Inference time

**Outputs:**
- `training/comparison_results/comparison_report.txt` - Text summary with recommendation
- `training/comparison_results/model_comparison.png` - Side-by-side metrics charts
- `training/comparison_results/prediction_comparison.png` - Prediction quality plots

**Expected Results:**
- **Random Forest**: Faster (2ms inference), simpler, good enough for production
- **LSTM-CNN**: More accurate, better temporal patterns, needs more resources

## Deployment

### Option 1: REST API Service

```python
from inference import K8sAutoScalingPredictor
from flask import Flask, request, jsonify

predictor = K8sAutoScalingPredictor(model_type='random_forest')

@app.route('/predict', methods=['POST'])
def predict():
    return jsonify(predictor.get_scaling_decision(request.json))
```

### Option 2: Integration with Collector

Import predictor in collector service for real-time predictions.

### Option 3: Custom Metrics for K8s HPA

Expose predictions as custom metrics for Horizontal Pod Autoscaler.
