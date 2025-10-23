# K6 Load Testing for Ball and Beer

Simulates realistic traffic for football field booking platform from 6 AM to 10 PM (16 hours).

## Traffic Pattern

- **6:00-9:00 AM**: 10-15 users, light browsing
- **9:00-1:00 PM**: 30-40 users, moderate activity
- **1:00-5:00 PM**: 60-80 users, busy booking for evening
- **5:00-10:00 PM**: 120-200 users, peak booking (18:00-21:00 time slots)

## Usage

Full 16-hour simulation:
```bash
k6 run realistic-traffic.js
```

With custom URL:
```bash
k6 run --env BASE_URL=http://your-domain.com realistic-traffic.js
```

From Kubernetes:
```bash
kubectl run k6-test --rm -i --tty \
  --image=grafana/k6:latest \
  --restart=Never \
  -- run --env BASE_URL=http://ingress-nginx-controller.ingress-nginx.svc.cluster.local \
  - < realistic-traffic.js
```

