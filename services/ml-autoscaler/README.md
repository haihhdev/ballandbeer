# ML Auto-Scaling for Kubernetes

ML models to predict optimal replica counts for proactive K8s scaling.

## Models

- **Random Forest** - Pattern-based, fast inference
- **LSTM-CNN** - Pattern + temporal, better accuracy

## Installation

```bash
cd services/ml-autoscaler
pip install -r requirements.txt
```

## Training

Dataset in `metrics/` folder (CSV files collected from K8s).

### Check CSV Quality

```bash
cd training
python analyze_csv.py ../metrics/metrics_20251105.csv
```

Shows usable rows count and data issues per file.

### Train Random Forest
```bash
cd training
python random_forest.py
```

**Output:**
- `models/random_forest_model.joblib`
- `models/rf_feature_names.json`
- `models/rf_metrics.json`
- `plots/rf_feature_importance.png`
- `plots/rf_predictions.png`

### Train LSTM-CNN
```bash
cd training
python lstm_cnn.py
```

**Output:**
- `models/lstm_cnn_model.keras`
- `models/lstm_cnn_scaler.joblib`
- `models/lstm_cnn_metrics.json`
- `plots/lstm_cnn_training_history.png`
- `plots/lstm_cnn_predictions.png`

## Inference

```python
from inference import K8sAutoScalingPredictor

# Load model (choose one)
predictor = K8sAutoScalingPredictor(model_type='random_forest')
# or
predictor = K8sAutoScalingPredictor(model_type='lstm_cnn')

# Get scaling decision
decision = predictor.get_scaling_decision({
    'service_name': 'product',
    'cpu_usage_percent': 65.0,
    'ram_usage_percent': 58.0,
    'request_count_per_second': 120.5,
    'response_time_ms': 380.0,
    'replica_count': 2,
    # ... other metrics from collector
})

# Output
print(decision['action'])           # 'scale_up', 'scale_down', 'no_change'
print(decision['predicted_replicas']) # 3
print(decision['reasoning'])        # 'High CPU usage (65%); Predicted increase'
print(decision['confidence'])       # 0.85
```

## Configuration

**File:** `config.py`

Key settings:
- `SCALE_UP_THRESHOLDS`: CPU 60%, RAM 65%, ResponseTime 400ms (proactive)
- `SCALE_DOWN_THRESHOLDS`: CPU 25%, RAM 30% (conservative)
- `LOOKAHEAD_MINUTES`: 5 (predict 5 minutes ahead)
- `LSTM_CNN_PARAMS['sequence_length']`: 6 (3 minutes of history)

## Data Processing

**Automatic cleaning in `data_preprocessor.py`:**
- Caps CPU/RAM usage at 100% (fixes calculation errors)
- Removes replica=0 with active metrics (inconsistent data)
- Fills zero resource limits with service medians
- Caps response time at 10,000ms (timeout values)
- Flags unstable services (pod restarts >3)
- Flags incidents (error rate >30%)
- Removes all-zero metrics (collector errors)
- Parses timestamps with ISO8601 format

**Known limitations:**
- Current dataset only has replica_count 0-1 (no scaling examples)
- Model needs data with 2+ replicas to learn proper scaling
- Collect metrics during high-load periods for better training

## Model Comparison

Compare in production by tracking:
- Actual scaling effectiveness
- Response time improvements
- Resource utilization
- Over/under scaling events

Use whichever performs better in real environment.
