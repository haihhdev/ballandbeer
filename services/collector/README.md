# Metrics Collector Service

Collects metrics every 30 seconds (6 AM - 10 PM) and uploads daily CSV to S3 for ML training.

## Metrics Collected

### Infrastructure (Kube-Prometheus)
- CPU/RAM usage, requests, limits
- Pod restart count, replica count

### Application (NGINX Ingress)
- Request rate, response time (P95)
- Error rate, queue length

### Derived Features
- 5-minute moving averages
- Trend slopes
- Time features (hour, day, holidays, weekends)

## Services Monitored

authen, booking, order, product, profile, frontend, recommender

## S3 Structure

```
s3://ballandbeer-metrics/metrics/YYYY/MM/DD/metrics_YYYYMMDD.csv
```

## Deployment

Build and push:
```bash
cd services/collector
docker build -t haihhdev/ballandbeer-collector:latest .
docker push haihhdev/ballandbeer-collector:latest
```

Deploy:
```bash
kubectl apply -f ops/k8s/collector/overlays/dev/argocd-app.yaml -n argocd
```

Manual upload:
```bash
kubectl exec -n ballandbeer deployment/collector -- python src/manual_upload.py
```

## Monitoring

```bash
kubectl logs -n ballandbeer deployment/collector -f
aws s3 ls s3://ballandbeer-metrics/metrics/ --recursive
```

