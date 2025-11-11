# ML-Autoscaler Benchmark Guide

## 🎯 Objectives

Compare performance between two autoscaling strategies:
1. **Traditional HPA** - Scale based on realtime CPU/Memory metrics
2. **KEDA + ML Predictions** - Scale based on 10-minute ahead load predictions

## 📊 Metrics to Measure

### 1. Performance Metrics
- **Response Time** (P50, P95, P99)
- **Error Rate** (%)
- **Request Success Rate** (%)
- **Throughput** (requests/second)

### 2. Scaling Metrics
- **Scale-up Latency** - Time from load increase to new pod ready
- **Scale-down Latency** - Time from load decrease to pod termination
- **Number of Scaling Events** - Total scale up/down count
- **Pod Churn Rate** - Frequency of pod creation/deletion (lower is better)

### 3. Resource Metrics
- **CPU Utilization** - Average, Max
- **Memory Utilization** - Average, Max
- **Cost** - Total pod-hours consumed (cost = replicas × time)

### 4. Stability Metrics
- **Scaling Oscillation** - Number of rapid scale-up then scale-down cycles (thrashing)
- **Over-provisioning Time** - % of time with too many pods
- **Under-provisioning Time** - % of time with too few pods (degraded performance)

---

## 🔬 Phase 1: Benchmark Traditional HPA

### Step 1: Deploy Applications with HPA
```bash
# HPA is already deployed via ArgoCD
kubectl get hpa -n ballandbeer

# Expected output:
# authen-hpa     Deployment/authen     cpu: 0%/70%, memory: 0%/75%   1     5
# booking-hpa    Deployment/booking    cpu: 0%/70%, memory: 0%/75%   1     5
# order-hpa      Deployment/order      cpu: 0%/70%, memory: 0%/75%   1     5
# product-hpa    Deployment/product    cpu: 0%/70%, memory: 0%/75%   1     5
# profile-hpa    Deployment/profile    cpu: 0%/70%, memory: 0%/75%   1     5
# frontend-hpa   Deployment/frontend   cpu: 0%/70%, memory: 0%/75%   1     5
# recommender-hpa Deployment/recommender cpu: 0%/70%, memory: 0%/75%  1     5
```

### Step 2: Run Load Test
```bash
# Deploy K6 weekday test
kubectl apply -f services/collector/k6/k6-weekday-test.yaml

# Monitor HPA in realtime
kubectl get hpa -n ballandbeer -w

# Monitor pod scaling
kubectl get pods -n ballandbeer -w
```

### Step 3: Collect Data (30-60 minutes)

#### A. Export Prometheus Metrics
```bash
# Port-forward Prometheus
kubectl port-forward -n monitoring svc/kube-prometheus-stack-prometheus 9090:9090

# Query Grafana or export data
# Important metrics:
# - kube_deployment_status_replicas{namespace="ballandbeer"}
# - container_cpu_usage_seconds_total{namespace="ballandbeer"}
# - container_memory_working_set_bytes{namespace="ballandbeer"}
# - nginx_ingress_controller_request_duration_seconds{service=~"authen|booking|..."}
# - nginx_ingress_controller_requests{service=~"authen|booking|..."}
```

#### B. Export HPA Events
```bash
# Save HPA events
kubectl get events -n ballandbeer --field-selector involvedObject.kind=HorizontalPodAutoscaler \
  -o json > /tmp/hpa-events-phase1.json

# Or describe each HPA
for svc in authen booking order product profile frontend recommender; do
  kubectl describe hpa ${svc}-hpa -n ballandbeer > /tmp/hpa-${svc}-phase1.txt
done
```

#### C. Export Scaling Timeline
```bash
# Capture replica count every 30s throughout the test
while true; do
  echo "$(date -Iseconds)" >> /tmp/replicas-phase1.log
  kubectl get deployments -n ballandbeer -o json | \
    jq -r '.items[] | "\(.metadata.name): \(.status.replicas)"' >> /tmp/replicas-phase1.log
  sleep 30
done
```

### Step 4: Calculate Baseline Metrics

Create Python script for analysis:
```python
# analyze_phase1.py
import json
import pandas as pd
from datetime import datetime

# Load data
with open('/tmp/hpa-events-phase1.json') as f:
    events = json.load(f)

# Analyze scaling events
scale_ups = [e for e in events['items'] if 'scale up' in e['message'].lower()]
scale_downs = [e for e in events['items'] if 'scale down' in e['message'].lower()]

print(f"Phase 1 - Traditional HPA:")
print(f"  Total scale-up events: {len(scale_ups)}")
print(f"  Total scale-down events: {len(scale_downs)}")
print(f"  Total scaling events: {len(scale_ups) + len(scale_downs)}")

# Calculate pod-hours (cost proxy)
# Parse replicas-phase1.log and calculate total
```

### Step 5: Save Results
```bash
# Create results directory
mkdir -p /tmp/benchmark-results/phase1-hpa

# Copy all logs and metrics
cp /tmp/hpa-events-phase1.json /tmp/benchmark-results/phase1-hpa/
cp /tmp/replicas-phase1.log /tmp/benchmark-results/phase1-hpa/
cp /tmp/hpa-*-phase1.txt /tmp/benchmark-results/phase1-hpa/

# Export Grafana dashboard as JSON (manual)
# Or query Prometheus API to save metrics
```

---

## 🤖 Phase 2: Benchmark KEDA + ML Predictions

### Step 1: Update ML Config for 10-minute Prediction Window
```bash
cd services/ml-autoscaler

# Edit config.py to set 10-minute lookahead
cat > config_update.patch << 'EOF'
# Proactive scaling parameters
LOOKAHEAD_MINUTES = 10           # Predict 10 minutes into the future
LOOKAHEAD_SAMPLES = 20           # At 30s interval, 20 samples = 10 minutes
EOF

# Update config.py
nano config.py
# Change LOOKAHEAD_MINUTES from 5 to 10
# Change LOOKAHEAD_SAMPLES from 10 to 20
```

### Step 2: Train ML Model
```bash
cd services/ml-autoscaler

# Download training data from S3 (collected by collector service)
aws s3 sync s3://ballandbeer-metrics/metrics/ ./training/data/

# Ensure you have at least 24-48 hours of historical data
ls -lh training/data/

# Train Random Forest model
python training/random_forest.py

# Verify model is created
ls -lh models/
# Expected: random_forest_model.joblib, rf_feature_names.json
```

### Step 3: Build and Deploy ML-Autoscaler
```bash
# Build Docker image
cd services/ml-autoscaler
docker build -t hao1706/ml-autoscaler:latest .
docker push hao1706/ml-autoscaler:latest

# Deploy via ArgoCD
kubectl apply -f ops/k8s/ml-autoscaler/overlays/dev/argocd-app.yaml -n argocd

# Wait for ML-Autoscaler to be ready
kubectl wait --for=condition=ready pod -l app=ml-autoscaler -n ballandbeer --timeout=120s

# Verify predictions are being made
kubectl logs -f -l app=ml-autoscaler -n ballandbeer

# Port-forward to check predictions API
kubectl port-forward -n ballandbeer svc/ml-autoscaler 8080:8080
curl http://localhost:8080/predictions
```

### Step 4: Remove Traditional HPA
```bash
# Backup HPA configs before deletion
kubectl get hpa -n ballandbeer -o yaml > /tmp/backup-hpa.yaml

# Delete all HPA
kubectl delete hpa --all -n ballandbeer

# Verify no HPA remaining
kubectl get hpa -n ballandbeer
# Expected: No resources found
```

### Step 5: Deploy KEDA ScaledObjects
```bash
# Apply ScaledObjects for all services
kubectl apply -f ops/k8s/ml-autoscaler/scaledobjects/all-services.yaml

# Verify ScaledObjects are created
kubectl get scaledobject -n ballandbeer

# Expected output:
# NAME                   SCALETARGETKIND      SCALETARGETNAME   MIN   MAX   TRIGGERS     AUTHENTICATION   READY   ACTIVE   FALLBACK   PAUSED    AGE
# authen-ml-scaler       apps/v1.Deployment   authen            1     10    prometheus                    True    True     False      Unknown   10s
# booking-ml-scaler      apps/v1.Deployment   booking           1     10    prometheus                    True    True     False      Unknown   10s
# ...

# Verify KEDA created new HPA
kubectl get hpa -n ballandbeer

# Expected: New HPA with names like keda-hpa-{service}-ml-scaler
```

### Step 6: Run Load Test (Same as Phase 1)
```bash
# Delete old K6 test if still running
kubectl delete testrun -n ballandbeer --all

# Deploy new K6 weekday test
kubectl apply -f services/collector/k6/k6-weekday-test.yaml

# Monitor KEDA ScaledObjects
kubectl get scaledobject -n ballandbeer -w

# Monitor HPA created by KEDA
kubectl get hpa -n ballandbeer -w

# Monitor pod scaling
kubectl get pods -n ballandbeer -w

# Monitor ML predictions in realtime
kubectl logs -f -l app=ml-autoscaler -n ballandbeer | grep "predicted"
```

### Step 7: Collect Data (30-60 minutes)

#### A. Export Prometheus Metrics (Same as Phase 1 + ML metrics)
```bash
# Query additional ML prediction metrics:
# - ml_predicted_replicas{service="authen"}
# - ml_prediction_confidence{service="authen"}
# - ml_predictions_total{service="authen",action="scale_up"}
```

#### B. Export KEDA Events
```bash
# Save ScaledObject events
kubectl get events -n ballandbeer --field-selector involvedObject.kind=ScaledObject \
  -o json > /tmp/keda-events-phase2.json

# Describe ScaledObjects
for svc in authen booking order product profile frontend recommender; do
  kubectl describe scaledobject ${svc}-ml-scaler -n ballandbeer > /tmp/keda-${svc}-phase2.txt
done

# Export HPA events (created by KEDA)
kubectl get events -n ballandbeer --field-selector involvedObject.kind=HorizontalPodAutoscaler \
  -o json > /tmp/keda-hpa-events-phase2.json
```

#### C. Export Scaling Timeline
```bash
# Same as Phase 1
while true; do
  echo "$(date -Iseconds)" >> /tmp/replicas-phase2.log
  kubectl get deployments -n ballandbeer -o json | \
    jq -r '.items[] | "\(.metadata.name): \(.status.replicas)"' >> /tmp/replicas-phase2.log
  sleep 30
done
```

#### D. Export ML Predictions Timeline
```bash
# Query ML predictions from Prometheus
curl -G 'http://localhost:9090/api/v1/query_range' \
  --data-urlencode 'query=ml_predicted_replicas' \
  --data-urlencode 'start=2025-11-11T00:00:00Z' \
  --data-urlencode 'end=2025-11-11T23:59:59Z' \
  --data-urlencode 'step=30s' \
  > /tmp/ml-predictions-phase2.json
```

### Step 8: Save Results
```bash
# Create results directory
mkdir -p /tmp/benchmark-results/phase2-keda

# Copy all logs and metrics
cp /tmp/keda-events-phase2.json /tmp/benchmark-results/phase2-keda/
cp /tmp/keda-hpa-events-phase2.json /tmp/benchmark-results/phase2-keda/
cp /tmp/replicas-phase2.log /tmp/benchmark-results/phase2-keda/
cp /tmp/keda-*-phase2.txt /tmp/benchmark-results/phase2-keda/
cp /tmp/ml-predictions-phase2.json /tmp/benchmark-results/phase2-keda/
```

---

## 📈 Phase 3: Compare and Analyze

### Step 1: Aggregate Metrics from Prometheus

Create script to query Prometheus and export CSV:
```python
# export_metrics.py
import requests
import pandas as pd
from datetime import datetime, timedelta

PROMETHEUS_URL = "http://localhost:9090"

def query_range(query, start, end, step='30s'):
    params = {
        'query': query,
        'start': start.isoformat() + 'Z',
        'end': end.isoformat() + 'Z',
        'step': step
    }
    response = requests.get(f"{PROMETHEUS_URL}/api/v1/query_range", params=params)
    return response.json()

# Define time ranges
phase1_start = datetime(2025, 11, 11, 10, 0, 0)
phase1_end = phase1_start + timedelta(hours=1)

phase2_start = datetime(2025, 11, 11, 12, 0, 0)
phase2_end = phase2_start + timedelta(hours=1)

services = ['authen', 'booking', 'order', 'product', 'profile', 'frontend', 'recommender']

# Export metrics for each service
for service in services:
    # Replica count
    query = f'kube_deployment_status_replicas{{namespace="ballandbeer",deployment="{service}"}}'
    
    phase1_data = query_range(query, phase1_start, phase1_end)
    phase2_data = query_range(query, phase2_start, phase2_end)
    
    # Convert to DataFrame and save CSV
    # ... implementation ...

# Export response time
query = 'histogram_quantile(0.95, rate(nginx_ingress_controller_request_duration_seconds_bucket[5m]))'
# ... similar export ...
```

### Step 2: Analyze Scaling Behavior

```python
# analyze_comparison.py
import json
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

# Load data
with open('/tmp/benchmark-results/phase1-hpa/hpa-events-phase1.json') as f:
    phase1_events = json.load(f)

with open('/tmp/benchmark-results/phase2-keda/keda-hpa-events-phase2.json') as f:
    phase2_events = json.load(f)

# Parse scaling events
def parse_events(events):
    scale_ups = []
    scale_downs = []
    
    for event in events['items']:
        msg = event['message'].lower()
        timestamp = event['lastTimestamp']
        
        if 'scale up' in msg or 'scaled up' in msg:
            scale_ups.append(timestamp)
        elif 'scale down' in msg or 'scaled down' in msg:
            scale_downs.append(timestamp)
    
    return scale_ups, scale_downs

phase1_ups, phase1_downs = parse_events(phase1_events)
phase2_ups, phase2_downs = parse_events(phase2_events)

print("=" * 60)
print("SCALING EVENTS COMPARISON")
print("=" * 60)
print(f"Phase 1 (Traditional HPA):")
print(f"  Scale-up events:   {len(phase1_ups)}")
print(f"  Scale-down events: {len(phase1_downs)}")
print(f"  Total events:      {len(phase1_ups) + len(phase1_downs)}")
print()
print(f"Phase 2 (KEDA + ML):")
print(f"  Scale-up events:   {len(phase2_ups)}")
print(f"  Scale-down events: {len(phase2_downs)}")
print(f"  Total events:      {len(phase2_ups) + len(phase2_downs)}")
print()
print(f"Difference:")
print(f"  Fewer events by: {(len(phase1_ups) + len(phase1_downs)) - (len(phase2_ups) + len(phase2_downs))}")
reduction_pct = ((len(phase1_ups) + len(phase1_downs)) - (len(phase2_ups) + len(phase2_downs))) / (len(phase1_ups) + len(phase1_downs)) * 100
print(f"  Reduction:       {reduction_pct:.1f}%")
```

### Step 3: Calculate Cost Savings

```python
# calculate_cost.py
import pandas as pd

# Load replica timelines
phase1_df = pd.read_csv('/tmp/benchmark-results/phase1-hpa/replicas-phase1.csv')
phase2_df = pd.read_csv('/tmp/benchmark-results/phase2-keda/replicas-phase2.csv')

# Assumption: $0.05 per pod-hour
POD_HOUR_COST = 0.05

def calculate_pod_hours(df, duration_minutes=60):
    # Calculate total pod-hours
    total_pods = df['replicas'].sum()
    pod_hours = (total_pods * duration_minutes) / 60
    cost = pod_hours * POD_HOUR_COST
    return pod_hours, cost

phase1_pod_hours, phase1_cost = calculate_pod_hours(phase1_df)
phase2_pod_hours, phase2_cost = calculate_pod_hours(phase2_df)

print("=" * 60)
print("COST ANALYSIS")
print("=" * 60)
print(f"Phase 1 (Traditional HPA):")
print(f"  Total pod-hours: {phase1_pod_hours:.2f}")
print(f"  Estimated cost:  ${phase1_cost:.2f}")
print()
print(f"Phase 2 (KEDA + ML - 10min ahead):")
print(f"  Total pod-hours: {phase2_pod_hours:.2f}")
print(f"  Estimated cost:  ${phase2_cost:.2f}")
print()
print(f"Savings:")
print(f"  Pod-hours saved: {phase1_pod_hours - phase2_pod_hours:.2f}")
print(f"  Cost saved:      ${phase1_cost - phase2_cost:.2f}")
print(f"  Savings %:       {(phase1_cost - phase2_cost) / phase1_cost * 100:.1f}%")
```

### Step 4: Analyze Proactive Scaling Advantage

```python
# analyze_proactive_scaling.py
import pandas as pd
import numpy as np

# Load replica and load data
replicas_df = pd.read_csv('/tmp/benchmark-results/phase2-keda/replicas-phase2.csv')
predictions_df = pd.read_csv('/tmp/benchmark-results/phase2-keda/ml-predictions-phase2.csv')
actual_load_df = pd.read_csv('/tmp/benchmark-results/phase2-keda/actual-load-phase2.csv')

# Calculate how early ML predicted the need to scale
# For each scale-up event, find:
# 1. When did ML predict it? (prediction timestamp)
# 2. When did KEDA scale? (scaling timestamp)
# 3. When did load actually increase? (load spike timestamp)
# 4. Lead time = (load spike time) - (prediction time)

print("=" * 60)
print("PROACTIVE SCALING ANALYSIS (10-minute prediction window)")
print("=" * 60)
print(f"Average lead time: X.X minutes")
print(f"  ML predicted scale-up X.X minutes before load spike")
print(f"  Traditional HPA would react X.X minutes AFTER load spike")
print(f"  Advantage: ~X.X minutes earlier scaling")
print()
print(f"Impact on response time:")
print(f"  Phase 1 (HPA): P95 response time during spike = XXXms")
print(f"  Phase 2 (ML):  P95 response time during spike = XXXms")
print(f"  Improvement: XX% faster response time")
```

### Step 5: Visualization

```python
# visualize_comparison.py
import matplotlib.pyplot as plt
import pandas as pd

# Load data
phase1_df = pd.read_csv('/tmp/benchmark-results/phase1-hpa/replicas-phase1.csv')
phase2_df = pd.read_csv('/tmp/benchmark-results/phase2-keda/replicas-phase2.csv')
predictions_df = pd.read_csv('/tmp/benchmark-results/phase2-keda/ml-predictions-phase2.csv')

services = ['authen', 'booking', 'order', 'product', 'profile', 'frontend', 'recommender']

# Plot replica count over time
fig, axes = plt.subplots(len(services), 1, figsize=(12, 20))

for idx, service in enumerate(services):
    ax = axes[idx]
    
    # Phase 1 - Traditional HPA
    phase1_service = phase1_df[phase1_df['service'] == service]
    ax.plot(phase1_service['timestamp'], phase1_service['replicas'], 
            label='Traditional HPA', linewidth=2, alpha=0.7, color='blue')
    
    # Phase 2 - KEDA + ML
    phase2_service = phase2_df[phase2_df['service'] == service]
    ax.plot(phase2_service['timestamp'], phase2_service['replicas'], 
            label='KEDA + ML (10min ahead)', linewidth=2, alpha=0.7, color='green')
    
    # ML Predictions (dotted line to show prediction vs actual)
    pred_service = predictions_df[predictions_df['service'] == service]
    ax.plot(pred_service['timestamp'], pred_service['predicted_replicas'],
            label='ML Predictions', linestyle='--', linewidth=1.5, alpha=0.6, color='orange')
    
    ax.set_title(f'{service.capitalize()} - Replica Count Over Time')
    ax.set_xlabel('Time')
    ax.set_ylabel('Replicas')
    ax.legend()
    ax.grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig('/tmp/benchmark-results/comparison-replicas.png', dpi=150)
print("Saved comparison chart to /tmp/benchmark-results/comparison-replicas.png")

# Plot response time comparison
fig, ax = plt.subplots(figsize=(12, 6))
# ... plot P95 response time for both phases ...
plt.savefig('/tmp/benchmark-results/comparison-response-time.png', dpi=150)
```

### Step 6: Generate Final Report

```bash
# Run all analysis scripts
cd /tmp/benchmark-results
python analyze_comparison.py > comparison-report.txt
python calculate_cost.py >> comparison-report.txt
python analyze_proactive_scaling.py >> comparison-report.txt
python visualize_comparison.py

# Create summary report
cat > SUMMARY.md << 'EOF'
# ML-Autoscaler Benchmark Results

## Test Setup
- **Duration**: 1 hour per phase
- **Load Pattern**: K6 weekday traffic simulation
- **Services**: 7 microservices (authen, booking, order, product, profile, frontend, recommender)
- **ML Prediction Window**: 10 minutes ahead

## Phase 1: Traditional HPA (CPU/Memory based)
- **Thresholds**: CPU 70%, Memory 75%
- **Min replicas**: 1, Max replicas: 5
- **Scale-up**: 100% in 60s or +2 pods in 60s
- **Scale-down**: 50% in 60s, stabilization 300s
- **Behavior**: Reactive - scales AFTER resource utilization increases

## Phase 2: KEDA + ML Predictions
- **Model**: Random Forest trained on historical data
- **Prediction Window**: 10 minutes ahead
- **Polling Interval**: 30s
- **Same scale-up/down behavior** as HPA
- **Behavior**: Proactive - scales BEFORE load spike (10 min earlier)

## Key Results

### 1. Proactive Scaling Advantage
- ✅ **10-minute lead time**: ML predicts and scales before load increases
- ✅ **Smoother scaling**: Fewer oscillations and thrashing
- ✅ **Better user experience**: Pods ready when traffic arrives

### 2. Resource Efficiency
- ✅ **Fewer scaling events**: X% reduction in total scale up/down
- ✅ **Lower pod churn**: More stable replica count
- ✅ **Cost savings**: X% reduction in pod-hours

### 3. Performance Impact
- ✅ **Lower response time**: X% improvement during traffic spikes
- ✅ **Lower error rate**: X% fewer errors during scale-up
- ✅ **Higher throughput**: Consistent request handling

## Detailed Metrics

[Results will be filled by analysis scripts]

## Grafana Dashboards
- Phase 1: [Link to screenshot]
- Phase 2: [Link to screenshot]

## Conclusion

**KEDA + ML Predictions** outperforms traditional HPA by:
1. **Predicting 10 minutes ahead** - scales proactively before load spike
2. **Reducing resource waste** - more confident scale-down decisions
3. **Improving user experience** - lower latency during traffic surges

**Trade-offs**:
- Requires historical data for training (minimum 24-48 hours)
- ML model accuracy depends on data quality
- Cannot predict truly unexpected events (e.g., viral marketing)

**Recommendation**: Use KEDA + ML for predictable traffic patterns with historical data.
EOF

echo "Benchmark completed! Results saved to /tmp/benchmark-results/"
```

---

## 🎓 Expected Outcomes

### KEDA + ML Predictions (10-min ahead) should show:

1. **✅ Proactive Scaling (10 minutes earlier)**
   - ML predicts load spike 10 minutes before it happens
   - KEDA scales up pods 10 minutes before traffic arrives
   - Pods are already warmed up when requests come in
   - Traditional HPA would scale AFTER load increases (reactive)

2. **✅ Fewer Scaling Events**
   - Less oscillation/thrashing between scale-up and scale-down
   - More stable replica count over time
   - Reduction: Expected 20-40% fewer scaling events

3. **✅ Better Resource Utilization**
   - More confident scale-down decisions (predicts low traffic 10 min ahead)
   - Less over-provisioning during low traffic periods
   - Cost savings: Expected 15-35% fewer pod-hours

4. **✅ Lower Response Time**
   - Pods ready before traffic spike
   - No cold start delays during scale-up
   - P95 improvement: Expected 20-50% during spikes

5. **✅ Lower Error Rate**
   - No overload during scale-up lag
   - Smoother traffic distribution across pods
   - Error reduction: Expected 30-60% during spikes

### Potential Issues:

1. **❌ ML Model Accuracy**
   - If predictions are inaccurate → may cause under/over-provisioning
   - Requires at least 24-48 hours of quality training data
   - Model needs periodic retraining (weekly recommended)

2. **❌ Cold Start Period**
   - First 10-20 predictions may be inaccurate (not enough data in buffer)
   - ML-Autoscaler needs warmup time after restart

3. **❌ Unexpected Load**
   - ML cannot predict truly random events (e.g., breaking news, viral posts)
   - Traditional HPA still needed as fallback
   - Recommendation: Keep both HPA and KEDA (dual strategy)

4. **❌ Prediction Window Trade-off**
   - 10-minute window = earlier scaling but less accuracy
   - 5-minute window = better accuracy but less lead time
   - Need to tune based on your application's pod startup time

---

## 📋 Pre-requisites Checklist

### Before Starting:
- [ ] Cluster has sufficient capacity (check node resources)
- [ ] Collector service running and collecting metrics to S3 for at least 48 hours
- [ ] Prometheus scraping all services correctly
- [ ] Grafana dashboards configured
- [ ] K6 load tests validated and working
- [ ] ML training data available (minimum 24 hours of metrics)

### Phase 1:
- [ ] HPA deployed for all 7 services
- [ ] Load test running for minimum 1 hour
- [ ] Metrics exported from Prometheus
- [ ] Events and logs saved
- [ ] Baseline calculations completed

### Phase 2:
- [ ] ML model trained with sufficient data (>24 hours)
- [ ] Config updated to 10-minute prediction window
- [ ] ML-Autoscaler deployed and making predictions
- [ ] HPA removed and KEDA ScaledObjects deployed
- [ ] Load test running for 1 hour (same pattern as Phase 1)
- [ ] Metrics exported from Prometheus
- [ ] ML predictions timeline captured
- [ ] Events and logs saved

### Analysis:
- [ ] Metrics comparison completed
- [ ] Cost analysis completed
- [ ] Proactive scaling advantage quantified
- [ ] Visualizations generated
- [ ] Final report written with recommendations

---

## 🚀 Quick Start Commands

```bash
# ============================================================
# Phase 1: Traditional HPA Benchmark
# ============================================================

# Verify HPA is deployed
kubectl get hpa -n ballandbeer

# Run load test
kubectl apply -f services/collector/k6/k6-weekday-test.yaml

# Start monitoring (in separate terminals)
kubectl get hpa -n ballandbeer -w
kubectl get pods -n ballandbeer -w

# Collect data for 1 hour
# Then save results
mkdir -p /tmp/benchmark-results/phase1-hpa
kubectl get events -n ballandbeer --field-selector involvedObject.kind=HorizontalPodAutoscaler -o json > /tmp/benchmark-results/phase1-hpa/events.json

# ============================================================
# Phase 2: KEDA + ML Benchmark
# ============================================================

# Update config for 10-minute prediction
cd services/ml-autoscaler
nano config.py  # Change LOOKAHEAD_MINUTES to 10

# Train model
python training/random_forest.py

# Build and deploy
docker build -t hao1706/ml-autoscaler:latest .
docker push hao1706/ml-autoscaler:latest
kubectl apply -f ops/k8s/ml-autoscaler/overlays/dev/argocd-app.yaml -n argocd

# Remove HPA and deploy KEDA
kubectl delete hpa --all -n ballandbeer
kubectl apply -f ops/k8s/ml-autoscaler/scaledobjects/all-services.yaml

# Verify KEDA is working
kubectl get scaledobject -n ballandbeer
kubectl logs -f -l app=ml-autoscaler -n ballandbeer

# Run same load test
kubectl apply -f services/collector/k6/k6-weekday-test.yaml

# Monitor for 1 hour
kubectl get scaledobject -n ballandbeer -w

# Save results
mkdir -p /tmp/benchmark-results/phase2-keda
kubectl get events -n ballandbeer -o json > /tmp/benchmark-results/phase2-keda/events.json

# ============================================================
# Phase 3: Analysis and Comparison
# ============================================================

cd /tmp/benchmark-results
python analyze_comparison.py > comparison-report.txt
python calculate_cost.py >> comparison-report.txt
python analyze_proactive_scaling.py >> comparison-report.txt
python visualize_comparison.py

# View results
cat comparison-report.txt
```

---

## 📚 References

- [KEDA Documentation](https://keda.sh/docs/)
- [KEDA Prometheus Scaler](https://keda.sh/docs/latest/scalers/prometheus/)
- [Kubernetes HPA](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
- [Prometheus Queries](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [K6 Load Testing](https://k6.io/docs/)
- [Scikit-learn Random Forest](https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.RandomForestRegressor.html)

---

## 🔍 Troubleshooting

### ML-Autoscaler Issues

**Problem**: ML predictions are all 1 (minimum replicas)
```bash
# Check if metrics are being collected
kubectl logs -l app=ml-autoscaler -n ballandbeer | grep "collecting metrics"

# Verify Prometheus connectivity
kubectl exec -it -n ballandbeer deploy/ml-autoscaler -- curl http://kube-prometheus-stack-prometheus.monitoring.svc.cluster.local:9090/api/v1/query?query=up
```

**Problem**: KEDA not scaling based on predictions
```bash
# Check ScaledObject status
kubectl describe scaledobject authen-ml-scaler -n ballandbeer

# Verify metric is exported
kubectl port-forward -n ballandbeer svc/ml-autoscaler 8080:8080
curl http://localhost:8080/metrics | grep ml_predicted_replicas
```

**Problem**: Model accuracy is poor
```bash
# Check training data quality
aws s3 ls s3://ballandbeer-metrics/metrics/ --recursive | wc -l
# Should have hundreds of files (>24 hours of data)

# Retrain with more data or different features
cd services/ml-autoscaler
python training/random_forest.py --verbose
```

---

## 💡 Tips for Better Results

1. **Ensure Sufficient Training Data**
   - Minimum 24 hours, ideally 7 days
   - Include weekday AND weekend traffic
   - Include different traffic patterns (peak hours, off-hours)

2. **Tune Prediction Window**
   - 10 minutes works well for most workloads
   - If pods start up faster (<2 min), can use 5-minute window
   - If pods start up slower (>5 min), may need 15-minute window

3. **Monitor Model Drift**
   - Retrain model weekly with fresh data
   - Compare predicted vs actual replicas
   - If accuracy drops below 70%, retrain immediately

4. **Use Confidence Thresholds**
   - Only scale if prediction confidence > 0.7
   - For low confidence, let traditional HPA handle it
   - Implement in ML-Autoscaler service logic

5. **Test During Different Times**
   - Morning peak hours
   - Afternoon steady state
   - Evening wind-down
   - Weekend traffic patterns
