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

