# K6 Load Testing for Ball and Beer

Aggressive load testing to trigger HPA pod scaling and collect ML training data.

## 3 Load Testing Scenarios

### 1. Weekday Traffic (`weekday-traffic.js`)
**Purpose:** Simulate realistic Mon-Fri business patterns  
**Duration:** 16 hours (6 AM - 10 PM)  
**Load:** 30-500 VUs (natural daily cycle with evening peak)  
**Scaling:** Variable 1-4 replicas, fast transitions

### 2. Weekend Traffic (`weekend-traffic.js`)
**Purpose:** Simulate Sat-Sun with higher peak loads  
**Duration:** 16 hours (6 AM - 10 PM)  
**Load:** 80-600 VUs (early morning rush + super peak evening)  
**Scaling:** Aggressive 1-6 replicas, rapid scaling events

### 3. Training Traffic (`training-traffic.js`)
**Purpose:** Generate balanced ML training data with controlled patterns  
**Duration:** 11 hours  
**Load:** 8-115 VUs (gradual progression: 1→5→2→4→1 replicas)  
**Scaling:** Systematic 1 replica/hour, CPU-focused (memory stable)

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

### Resource Specifications (Updated)

**Current Resource Allocation:**
- **Most services** (authen, booking, product, profile): 128Mi RAM / 50m CPU request
- **Frontend**: 256Mi RAM / 50m CPU request  
- **Order**: 256Mi RAM / 100m CPU request
- **Recommender**: 1Gi RAM / 100m CPU request

**HPA Thresholds:**
- CPU: 70% utilization → triggers scaling
- Memory: 75% utilization → triggers scaling

**Scaling Triggers:**
- Most services: ~35m CPU or ~96Mi RAM usage per pod
- Order: ~70m CPU or ~192Mi RAM usage per pod
- Recommender: ~70m CPU or ~768Mi RAM usage per pod

### Training Progressive Traffic (`training-traffic.js`)
Specialized 11-hour load generator designed to create **gradual, controlled scaling patterns** for ML model training.

**Why 11-Hour Progressive Training?**
- Creates **balanced replica distribution** (1→5 replicas over time)
- Generates **gradual scaling patterns** (1 replica increase per hour)
- Focuses on **CPU-based scaling** (memory now more stable with 128-1024Mi requests)
- Avoids **memory pressure spikes** (can cause unwanted scaling)
- Produces **predictable patterns** for transformer model training

### 11 Progressive Phases (660 minutes total)

**1. Phase 1: Warm-up (0-60m)**
- **Pattern:** Light load 8-12 VUs
- **Goal:** Keep at 1 replica, establish baseline
- **Services:** Mixed light traffic (authen, booking, product)
- **Expected:** CPU ~10-20%, Memory ~30-40%

**2. Phase 2: Scale to 2 replicas (60-120m)**
- **Pattern:** Gradual 25-35 VUs
- **Goal:** Push past 70% CPU on 1 pod to trigger scale to 2
- **Services:** Mixed moderate traffic (40% booking, 25% product, 20% authen)
- **Expected:** CPU ~75-80%, triggers 2nd replica

**3. Phase 3: Scale to 3 replicas (120-180m)**
- **Pattern:** Medium 50-58 VUs
- **Goal:** ~105m CPU total (70% of 150m across 3 pods)
- **Services:** More booking/product requests, shorter sleep
- **Expected:** 2 replicas at 70-75% → triggers 3rd replica

**4. Phase 4: Scale to 4 replicas (180-240m)**
- **Pattern:** High 75-85 VUs
- **Goal:** ~140m CPU total (70% of 200m across 4 pods)
- **Services:** Higher request rate, mixed endpoints
- **Expected:** 3 replicas at 70-75% → triggers 4th replica

**5. Phase 5: Scale to 5 replicas (240-300m)**
- **Pattern:** Peak 105-115 VUs
- **Goal:** ~175m CPU total (70% of 250m across 5 pods)
- **Services:** Maximum concurrent requests, all endpoints
- **Expected:** 4 replicas at 70-75% → triggers 5th replica (max)

**6. Phase 6: Scale down to 2 replicas (300-360m)**
- **Pattern:** Gradual reduction 90→30 VUs
- **Goal:** Trigger scale-down with 5min stabilization window
- **Services:** Decreasing traffic to 2-replica level
- **Expected:** 5→4→3→2 replicas over 60 minutes

**7. Phase 7: Maintain 2 replicas (360-420m)**
- **Pattern:** Steady 28-32 VUs
- **Goal:** Stable 2-replica state
- **Services:** Consistent moderate load
- **Expected:** CPU ~60-70%, stays at 2 replicas

**8. Phase 8: Scale to 3 replicas again (420-480m)**
- **Pattern:** Ramp 50-56 VUs
- **Goal:** Return to 3-replica pattern
- **Services:** Medium load increase
- **Expected:** 2 replicas → 3 replicas

**9. Phase 9: Scale to 4 replicas again (480-540m)**
- **Pattern:** Push 78-84 VUs
- **Goal:** Reach 4-replica level again
- **Services:** High sustained load
- **Expected:** 3 replicas → 4 replicas

**10. Phase 10: Oscillate 3-4 replicas (540-600m)**
- **Pattern:** Variable 65-82 VUs
- **Goal:** Create scaling event patterns (up/down)
- **Services:** Alternating load levels
- **Expected:** Multiple 3↔4 replica transitions

**11. Phase 11: Cool down to 1 replica (600-660m)**
- **Pattern:** Gradual reduction 50→10 VUs
- **Goal:** Scale back to baseline
- **Services:** Decreasing to minimal load
- **Expected:** 4→3→2→1 replicas over 60 minutes

### Expected Training Data Improvements

**Training Strategy:**
- **11 hours total** = 660 minutes of controlled load
- **Each replica level**: ~60-120 minutes of sustained data
- **Gradual transitions**: Smooth scaling for better pattern learning
- **Repeat patterns**: Phases 6-9 repeat 2-4 replica patterns for data balance

**Expected Data Distribution:**
```
Replica 1: ~120 min (Phases 1, 11) - Baseline + Cooldown
Replica 2: ~180 min (Phases 2, 6, 7) - Moderate sustained load
Replica 3: ~120 min (Phases 3, 8, 10) - Medium load patterns
Replica 4: ~120 min (Phases 4, 9, 10) - High load patterns  
Replica 5: ~120 min (Phases 5, 6 start) - Peak load patterns

Target imbalance: < 2x (vs current 7.84x)
Scaling events: 20-30 per service (gradual transitions)
CPU-focused scaling: ✓ (memory now stable)
Predictable patterns: ✓ (transformer-friendly)
```

**Key Improvements:**
- **Balanced data**: Each replica level gets 90-180 minutes
- **Controlled scaling**: CPU-based, memory stable with new limits
- **Pattern repetition**: Phases 6-9 revisit 2-4 replicas for reinforcement
- **No memory spikes**: 128-1024Mi requests prevent memory-triggered scaling
- **Gradual changes**: 1 replica/hour prevents abrupt jumps

### Deployment

**Step 1: Create ConfigMap**
```bash
kubectl create configmap k6-training-script \
  --from-file=training-traffic.js \
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
kubectl logs -f job/k6-training-progressive -n ballandbeer

# Monitor HPA scaling (should see gradual 1→2→3→4→5 replica increases)
watch kubectl get hpa -n ballandbeer

# Check pod counts and CPU/Memory usage
kubectl top pods -n ballandbeer --sort-by=cpu
```

**Step 4: Collect Metrics**
After job completes (~11 hours):
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
kubectl delete job k6-training-progressive -n ballandbeer

# Delete configmap if needed
kubectl delete configmap k6-training-script -n ballandbeer
```

### Comparison: When to Use Each Script

| Feature | Weekday | Weekend | Training |
|---------|---------|---------|----------|
| **Purpose** | Realistic Mon-Fri | Realistic Sat-Sun | ML model training |
| **Duration** | 16h | 16h | 11h |
| **Load Pattern** | Natural cycle | Natural + spikes | Controlled progression |
| **VUs Range** | 30-500 | 80-600 | 8-115 |
| **Replicas** | 1-4 variable | 1-6 aggressive | 1→5→2→4→1 systematic |
| **Scaling Speed** | Fast (minutes) | Very fast | Slow (1/hour) |
| **Scaling Trigger** | CPU+Memory mix | CPU+Memory mix | CPU-only (memory stable) |
| **Scaling Events** | 10-25/service | 15-40/service | 20-30/service balanced |
| **Data Quality** | Realistic but imbalanced | Diverse but noisy | Balanced for ML training |
| **Use Case** | Production testing | Stress testing | Model retraining |

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

