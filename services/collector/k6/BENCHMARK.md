# K6 Benchmark Test

Deterministic load testing for comparing ML-Autoscaler vs Standard HPA.

## Overview

This benchmark ensures identical traffic patterns across multiple runs for fair comparison between:
- ML-Autoscaler enabled setup
- Standard HPA-only setup

## Test Configuration

### Duration
- Initial test: 138 minutes (2.3 hours) - 15min per stage
- Full test: 8 hours (to be configured after initial evaluation)

### Load Pattern

Ramp Up:
- Stage 1: 20 VUs (15 min)
- Stage 2: 40 VUs (15 min)
- Stage 3: 60 VUs (15 min)
- Stage 4: 80 VUs (15 min)
- Stage 5: 100 VUs (15 min)

Ramp Down:
- Stage 6: 80 VUs (15 min)
- Stage 7: 60 VUs (15 min)
- Stage 8: 40 VUs (15 min)
- Stage 9: 20 VUs (15 min)

### Workflows

1. Browse and Buy (35%): Frontend -> Product -> Recommender -> Order
2. Booking Journey (25%): Frontend -> Booking -> Authen
3. Profile and Orders (20%): Authen -> Profile -> Order
4. Product Discovery (20%): Frontend -> Product -> Recommender

## Deterministic Features

- Seeded random functions ensure reproducible behavior
- Fixed user pool (100 pre-authenticated users)
- Consistent workflow selection per VU/iteration
- Predictable think times and sleep durations

## Usage

### Apply to Kubernetes

```bash
# Step 1: Create ConfigMap from script file
kubectl create configmap k6-benchmark-script \
  --from-file=benchmark-traffic.js \
  --namespace=default \
  --dry-run=client -o yaml | kubectl apply -f -

# Step 2: Apply priority class and job
kubectl apply -f k6-priorityclass.yaml
kubectl apply -f k6-benchmark-job.yaml
```

### Monitor Progress

```bash
kubectl logs -f job/k6-benchmark-run -n default
```

### Check Results

```bash
kubectl get jobs -n default
kubectl describe job k6-benchmark-run -n default
```

### Cleanup

```bash
# Delete job when done
kubectl delete job k6-benchmark-run -n default

# Delete configmap if needed
kubectl delete configmap k6-benchmark-script -n default
```

## Running Locally

```bash
k6 run benchmark-traffic.js
```

## Metrics Collected

- Request rate per service
- Response times (p50, p95, p99)
- Error rates
- Resource utilization (CPU, Memory)
- Scaling events and timing

## Comparison Methodology

1. Run benchmark with ML-Autoscaler enabled
2. Record metrics via collector service
3. Disable ML-Autoscaler, enable standard HPA
4. Run same benchmark (deterministic traffic ensures identical load)
5. Compare:
   - Response times
   - Resource efficiency
   - Scaling accuracy
   - Cost metrics
