# K6 Load Testing for Ball and Beer

Simulates realistic traffic patterns for football field booking platform.

## Scenarios

### Weekday Traffic (`weekday-traffic.js`)
Simulates normal business days (Mon-Fri) - 16 hours (6 AM - 10 PM)

**Traffic Pattern:**
- **06:00-09:00** (3h): 10-15 users - Light morning browsing
- **09:00-13:00** (4h): 30-40 users - Moderate activity
- **13:00-17:00** (4h): 60-80 users - Afternoon buildup for evening bookings
- **17:00-22:00** (5h): 120-200 users - Peak evening booking time

### Weekend Traffic (`weekend-traffic.js`)
Simulates high-traffic weekend days (Sat-Sun) - 16 hours (6 AM - 10 PM)

**Traffic Pattern:**
- **06:00-07:20** (1h20m): 40-60 users - Early morning rush for morning slots
- **07:20-09:40** (2h20m): 80-100 users - Late morning peak
- **09:40-12:50** (3h10m): 50-60 users - Midday moderate
- **12:50-18:20** (5h30m): 80-120 users - Afternoon buildup
- **18:20-22:00** (3h40m): 150-300 users - Super peak evening (highest load)

## Usage

### Local

```bash
# Weekday
k6 run weekday-traffic.js

# Weekend
k6 run weekend-traffic.js

# Custom URL
k6 run --env BASE_URL=http://your-domain.com weekday-traffic.js
```

### From Kubernetes

```bash
# Weekday
kubectl run k6-weekday-test --rm -i --tty \
  --image=grafana/k6:latest \
  --restart=Never \
  -- run --env BASE_URL=http://ingress-nginx-controller.ingress-nginx.svc.cluster.local \
  - < weekday-traffic.js

# Weekend
kubectl run k6-weekend-test --rm -i --tty \
  --image=grafana/k6:latest \
  --restart=Never \
  -- run --env BASE_URL=http://ingress-nginx-controller.ingress-nginx.svc.cluster.local \
  - < weekend-traffic.js
```

