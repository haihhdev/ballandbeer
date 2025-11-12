# K6 Load Testing for Ball and Beer

Aggressive load testing to trigger HPA pod scaling and collect ML training data.

## Scenarios

### Weekday Traffic (`weekday-traffic.js`)
High-load simulation for business days (Mon-Fri) - 16 hours (6 AM - 10 PM)

**Traffic Pattern:**
- **06:00-09:00** (3h): 30-50 VUs - Morning rush (3x baseline)
- **09:00-13:00** (4h): 80-120 VUs - Moderate load (3x baseline)
- **13:00-17:00** (4h): 150-250 VUs - Busy afternoon (3x baseline)
- **17:00-22:00** (5h): 300-500 VUs - Peak evening (2.5x baseline)

**Goal:** Trigger HPA scaling to 2-6 replicas per service for data collection.

### Weekend Traffic (`weekend-traffic.js`)
Maximum load simulation for weekend days (Sat-Sun) - 16 hours (6 AM - 10 PM)

**Traffic Pattern:**
- **06:00-07:20** (1h20m): 80-120 VUs - Early morning rush (2x baseline)
- **07:20-09:40** (2h20m): 150-200 VUs - Late morning peak (2x baseline)
- **09:40-12:50** (3h10m): 100-130 VUs - Midday moderate (2x baseline)
- **12:50-18:20** (5h30m): 180-280 VUs - Afternoon buildup (2.5x baseline)
- **18:20-22:00** (3h40m): 350-600 VUs - Super peak evening (2x baseline)

**Goal:** Trigger aggressive HPA scaling to collect diverse scaling patterns.

## Key Changes

**Increased Load:**
- Virtual Users (VUs): 2-3x higher than original
- Sleep Time: 60-80% reduced (from 1-5s to 0.2-0.8s)
- Request Rate: 3-5x higher per service

**Expected Results:**
- CPU usage: 70-100% (triggers HPA at 70%)
- Memory usage: 75-90% (triggers HPA at 75%)
- Pod scaling: 1 → 2-6 replicas depending on service
- Response time: < 2.5s (P95)

## Usage

### From Kubernetes (Recommended)

```bash
# Apply K6 Job for weekday test
kubectl apply -f services/collector/k6/k6-weekday-job.yaml

# Monitor HPA scaling
watch kubectl get hpa -n ballandbeer

# Check pod scaling
kubectl get pods -n ballandbeer -w

# View metrics
kubectl top pods -n ballandbeer
```

### Local Testing

```bash
# Weekday (16 hours full simulation)
k6 run weekday-traffic.js

# Weekend (16 hours full simulation)
k6 run weekend-traffic.js

# Custom URL
k6 run --env BASE_URL=http://your-domain.com weekday-traffic.js
```

### Quick Test (5 minutes)

```bash
# Test single scenario
k6 run --duration 5m --vus 100 weekday-traffic.js
```

## Monitoring

```bash
# Watch HPA
kubectl get hpa -n ballandbeer -w

# Check pod count
kubectl get pods -n ballandbeer | grep -E "authen|booking|order|product|profile|frontend|recommender"

# View CPU/RAM usage
kubectl top pods -n ballandbeer

# Check metrics being collected
kubectl logs -n ballandbeer deployment/collector -f
```

## ML Training Data Collection

### Training Diverse Traffic (`training-diverse-traffic.js`)
Specialized load generator designed to create **diverse, balanced training data** for ML model. Duration: ~5 hours (305 minutes).

**Why This Script?**
- Current data has **class imbalance** (Replica 1: 41%, Replica 6: 5%)
- Too few **scaling events** (Profile: 3 changes, Product: 25 changes)
- Missing **high-load scenarios** (insufficient 4-5 replica data)
- Traffic too **smooth** (lacks spikes and oscillations)

### 11 Diverse Scenarios

**1. Flash Sale Spike (0-15m)**
- **Pattern:** Sudden burst 50 → 400 VUs
- **Goal:** Force 4-5 replicas, create spike response data
- **Services:** Booking + Product heavy

**2. Gradual Ramp (15-60m)**
- **Pattern:** Step increase 30 → 350 → 30 VUs
- **Goal:** Create ALL replica levels (1-5) smoothly
- **Services:** All services mixed

**3. Oscillating Load (60-90m)**
- **Pattern:** Rapid up/down cycles
- **Goal:** Maximum scaling events for learning
- **Services:** Booking focused

**4. Booking Stress (90-110m)**
- **Pattern:** Constant 150 VUs
- **Goal:** Product service specific patterns
- **Services:** Product + Booking

**5. Browsing Stress (115-140m)**
- **Pattern:** Ramp 200 → 300 VUs
- **Goal:** Frontend service stress
- **Services:** Frontend heavy

**6. Recommendation Burst (145-160m)**
- **Pattern:** High req/s (100 → 300/s)
- **Goal:** Recommender service patterns
- **Services:** Recommender focused

**7. Profile Activity (160-175m)**
- **Pattern:** Constant 40 VUs
- **Goal:** Profile service data (usually low)
- **Services:** Profile focused

**8. Auth Burst (180-195m)**
- **Pattern:** Ramp 150 → 250 VUs
- **Goal:** Authen service stress
- **Services:** Authen focused

**9. Evening Peak Realistic (195-270m)**
- **Pattern:** 180 → 400 VUs realistic mix
- **Goal:** Production-like peak hour
- **Services:** 40% booking, 30% browsing, 30% others

**10. Stress Test Max (270-295m)**
- **Pattern:** Push to 500 VUs
- **Goal:** Force 5 replicas, test limits
- **Services:** All services stressed

**11. Idle Period (295-305m)**
- **Pattern:** Only 15 VUs
- **Goal:** Create low-load 1-replica data
- **Services:** Minimal health checks

### Expected Training Data Improvements

**Before (Current Data):**
```
Replica 1: 3113 samples (41.2%)
Replica 2: 1146 samples (15.2%)
Replica 3:  825 samples (10.9%)
Replica 4: 1399 samples (18.5%)
Replica 5:  681 samples (9.0%)
Replica 6:  397 samples (5.3%)  ← Shouldn't exist!

Imbalance ratio: 7.84x
Scaling events: 3-25 per service
```

**After (With New Script):**
```
Replica 1: More idle data
Replica 2: Gradual ramp data
Replica 3: Medium load sustained
Replica 4: Spike recovery, stress test
Replica 5: Peak load, max stress  ← More data!

Target imbalance: < 3x
Scaling events: 30-50 per service
Service-specific patterns: ✓
Spike handling: ✓
```

### Deployment

**Step 1: Create ConfigMap**
```bash
kubectl create configmap k6-training-script \
  --from-file=training-diverse-traffic.js \
  --namespace=ballandbeer \
  --dry-run=client -o yaml | kubectl apply -f -
```

**Step 2: Deploy Job**
```bash
kubectl apply -f k6-training-job.yaml
```

**Step 3: Monitor**
```bash
# Watch job progress
kubectl logs -f job/k6-training-diverse -n ballandbeer

# Monitor HPA scaling
watch kubectl get hpa -n ballandbeer

# Check pod counts
kubectl get pods -n ballandbeer -w
```

**Step 4: Collect Metrics**
After job completes (~5 hours):
```bash
# Trigger metrics collection
kubectl exec -it deployment/collector -n ballandbeer -- python collect_metrics.py

# Download metrics
kubectl cp ballandbeer/collector-xxx:/data/metrics_$(date +%Y%m%d).csv ./metrics/
```

**Step 5: Retrain Model**
```bash
cd services/ml-autoscaler
python training/transformer_decoder.py
```

### Cleanup

```bash
# Delete job when done
kubectl delete job k6-training-diverse -n ballandbeer

# Delete configmap if needed
kubectl delete configmap k6-training-script -n ballandbeer
```

### Key Differences from Weekday/Weekend

| Feature | Weekday/Weekend | Training Diverse |
|---------|-----------------|------------------|
| Duration | 16 hours | 5 hours |
| Purpose | Realistic simulation | ML data balance |
| Pattern | Smooth gradual | Spikes + oscillations |
| Replicas | Mostly 2-3 | Focus on 4-5 |
| Service Focus | Mixed realistic | Service-specific bursts |
| Scaling Events | ~10-25 per service | ~30-50 per service |
| Load Distribution | Natural | Engineered for balance |

### Monitoring Metrics Quality

After collection, analyze data:
```bash
python training/analyze_data.py
```

Look for:
- **Replica distribution:** Should be more balanced
- **Scaling events:** Each service should have 30+ changes
- **R² score improvement:** Target > 0.5 (current: 0.57)
- **Class imbalance:** Target < 3x (current: 7.84x)

