# Ball & Beer - Cloud-Native Microservices Platform

A production-ready e-commerce and booking platform for sports facilities and products, built with microservices architecture and deployed on AWS EKS. Features ML-based predictive autoscaling, event-driven architecture, and comprehensive observability.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Technology Stack](#technology-stack)
- [Microservices](#microservices)
- [Infrastructure](#infrastructure)
- [ML-Based Autoscaling](#ml-based-autoscaling)
- [Observability & Monitoring](#observability--monitoring)
- [CI/CD Pipeline](#cicd-pipeline)
- [Local Development](#local-development)
- [Deployment](#deployment)

## Architecture Overview

The platform consists of 7 core microservices, a Next.js frontend, and infrastructure services running on AWS EKS. It implements:

- **Microservices Architecture**: Domain-driven service separation with REST APIs
- **Event-Driven Communication**: Kafka/Redpanda for async messaging between services
- **ML-Powered Autoscaling**: Transformer-based predictive scaling using KEDA
- **GitOps Deployment**: ArgoCD for declarative Kubernetes deployments
- **Secrets Management**: HashiCorp Vault for secure credential storage
- **Full Observability**: Prometheus + Grafana stack for metrics and visualization

### High-Level Architecture

```
                    ┌─────────────────┐
                    │  AWS Route53    │
                    │  + CloudFront   │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ NGINX Ingress   │
                    │ + TLS/SSL       │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────▼─────┐      ┌──────▼──────┐      ┌─────▼─────┐
   │ Frontend │      │  Microsvcs  │      │    ML     │
   │ (Next.js)│      │  (Node.js)  │      │ Services  │
   └──────────┘      └─────┬───────┘      └───────────┘
                           │
                    ┌──────▼──────┐
                    │   MongoDB   │
                    └─────────────┘
```

## Technology Stack

### Frontend
- **Next.js 15**: React-based SSR framework
- **TailwindCSS**: Utility-first CSS framework
- **Firebase Auth**: Client-side authentication

### Backend Services
- **Node.js + Express**: REST API framework
- **MongoDB + Mongoose**: Primary database
- **JWT**: Authentication/authorization
- **KafkaJS**: Event streaming (order processing)

### ML & Data Services
- **Python + FastAPI**: ML inference services
- **TensorFlow + Keras 3**: Transformer models
- **Pandas + NumPy**: Data processing
- **Scikit-learn**: Feature engineering

### Infrastructure
- **AWS EKS**: Managed Kubernetes (v1.33)
- **Terraform**: Infrastructure as Code
- **ArgoCD**: GitOps continuous delivery
- **KEDA**: Kubernetes-based event-driven autoscaling
- **HashiCorp Vault**: Secrets management
- **Redpanda**: Kafka-compatible event streaming

### Observability
- **Prometheus**: Metrics collection
- **Grafana**: Visualization and dashboards
- **NGINX Ingress**: L7 load balancing + metrics
- **Kube-State-Metrics**: Kubernetes resource metrics

### CI/CD
- **Jenkins**: Build, test, security scanning
- **Docker Hub**: Container registry
- **SonarQube**: Code quality analysis
- **Trivy + Snyk**: Security vulnerability scanning

## Microservices

### Core Services

| Service | Port | Technology | Description |
|---------|------|------------|-------------|
| `frontend` | 80 | Next.js | Web UI, SSR, client-side routing |
| `authen` | 4000 | Node.js + Express | User authentication, JWT token management |
| `booking` | 4001 | Node.js + Express | Sports facility booking and scheduling |
| `order` | 4002 | Node.js + Express + Kafka | Order processing with event-driven workflows |
| `product` | 4003 | Node.js + Express | Product catalog and inventory management |
| `profile` | 4004 | Node.js + Express | User profile and preferences |
| `recommender` | 4005 | Python + FastAPI | ML-based product recommendations (TensorFlow) |

### Supporting Services

| Service | Technology | Description |
|---------|------------|-------------|
| `collector` | Python + Prometheus API | Metrics collection, aggregation, S3 export for ML training |
| `ml-autoscaler` | Python + FastAPI | Transformer-based predictive autoscaling service |

### Service Communication

- **Synchronous**: REST APIs via NGINX Ingress
- **Asynchronous**: Kafka/Redpanda for order events
- **Service Discovery**: Kubernetes DNS

## Infrastructure

### AWS Resources (Terraform-managed)

#### EKS Cluster Configuration
- **Kubernetes Version**: 1.33
- **Node Groups**:
  - **Infrastructure Nodes**: 2x t4g.medium (On-Demand, ARM64)
    - Tainted for infrastructure workloads (Vault, Redpanda, monitoring)
  - **Application Nodes**: 1-5x t4g.small (Spot, ARM64, autoscaling)
- **Networking**: Custom VPC with public/private subnets across 3 AZs
- **Storage**: EBS CSI driver for persistent volumes

#### IAM Roles (IRSA)
- **Cluster Autoscaler**: Node group scaling permissions
- **EBS CSI Driver**: Volume management
- **Recommender Service**: S3 access for model artifacts
- **Collector Service**: S3 access for metrics storage

#### Cost Optimization
- **Spot Instances**: Application nodes for cost reduction
- **ARM Architecture**: Graviton2 (t4g) for price-performance
- **Cluster Autoscaler**: Dynamic node scaling based on demand

### Kubernetes Resources

#### Namespaces
- `ballandbeer`: Application services
- `monitoring`: Prometheus + Grafana stack
- `argocd`: GitOps deployment controller
- `kube-system`: Cluster infrastructure

#### Storage
- **StorageClass**: gp3 EBS volumes with encryption
- **PersistentVolumes**: For stateful services (Vault, Redpanda, Prometheus)

#### Ingress & Networking
- **NGINX Ingress Controller**: L7 routing, TLS termination
- **Cert-Manager**: Automated Let's Encrypt certificates
- **Network Policies**: Service-to-service traffic control

## ML-Based Autoscaling

The platform implements a novel ML-powered autoscaling system that predicts resource needs 10 minutes ahead using a Transformer model.

### Architecture

```
Prometheus → Collector → S3 → ML Training
                ↓
         ml-autoscaler (FastAPI)
                ↓
        KEDA ScaledObjects
                ↓
        Kubernetes HPA
```

### Components

#### 1. Metrics Collector
- Collects metrics every 30 seconds (6 AM - 10 PM)
- Sources: Prometheus (CPU/RAM) + NGINX Ingress (request/response metrics)
- Exports daily CSV to S3 for model training
- **Metrics tracked per service**:
  - CPU/RAM usage, requests, limits
  - Request rate, response time (P95), error rate
  - Queue length, replica count
  - Time features (hour, day of week, holidays)

#### 2. ML Autoscaler Service
- **Model**: Transformer Decoder with PCA dimensionality reduction
- **Input**: 12 time steps (6 minutes of historical data)
- **Output**: Predicted replica count for 10 minutes ahead
- **Inference**: Every 30 seconds per service
- **Metrics Endpoint**: Exposes Prometheus metrics for KEDA

#### 3. KEDA Integration
- Queries `ml_predicted_replicas` metric from ml-autoscaler
- Scales deployments based on ML predictions
- Replaces traditional CPU/memory-based HPA
- Configuration: 1-5 replicas per service, 30s polling, 300s cooldown

### Training Process

```bash
# 1. Collect production metrics
kubectl logs -n ballandbeer deployment/collector -f

# 2. Generate training data
aws s3 sync s3://ballandbeer-metrics/metrics/ ./data/

# 3. Train Transformer model
cd services/ml-autoscaler
python training/transformer_decoder.py

# Outputs: transformer_model.keras, transformer_pca.joblib, transformer_scaler.joblib
```

### Benefits
- **Proactive Scaling**: Anticipates traffic spikes before they occur
- **Cost Optimization**: More accurate scaling = fewer wasted resources
- **Performance**: Reduces cold start delays and latency spikes
- **Adaptability**: Learns seasonal patterns and business hours

## Observability & Monitoring

### Prometheus Stack (kube-prometheus-stack)

**Components**:
- **Prometheus**: Metrics database (7-day retention, 10GB)
- **Grafana**: Dashboards and visualization
- **Node Exporter**: Host-level metrics
- **Kube-State-Metrics**: Kubernetes resource state
- **Alertmanager**: Disabled (alerts handled externally)

**Access Grafana**:
```bash
# Get admin password
kubectl get secret -n monitoring kube-prometheus-stack-grafana \
  -o jsonpath="{.data.admin-password}" | base64 -d

# Port forward
kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3000:80
# Open http://localhost:3000 (admin/<password>)
```

### Key Metrics Monitored

**Infrastructure**:
- Node CPU/memory usage
- Pod resource usage vs requests/limits
- Network I/O, disk I/O

**Application**:
- HTTP request rate, latency (P50/P95/P99)
- Error rates (4xx/5xx)
- Active connections, queue depth

**Autoscaling**:
- Current vs predicted replicas
- Scaling events and reasons
- ML model prediction accuracy

## CI/CD Pipeline

### Jenkins Pipeline Stages

```
┌─────────────────────────────────────────────┐
│ 1. Checkout & Detect Changed Services      │
├─────────────────────────────────────────────┤
│ 2. Static Analysis (Parallel)              │
│    - SonarQube code quality                 │
│    - Trivy filesystem scan                  │
│    - Snyk dependency scan                   │
├─────────────────────────────────────────────┤
│ 3. Build & Push Docker Images              │
│    - Timestamped + latest tags              │
│    - Push to Docker Hub                     │
├─────────────────────────────────────────────┤
│ 4. Security Scans (Parallel)               │
│    - Trivy container image scan             │
│    - Snyk container scan                    │
└─────────────────────────────────────────────┘
```

### Deployment Flow

```
GitHub Push → Jenkins Build → Docker Hub → ArgoCD Sync → EKS Deployment
```

**ArgoCD Applications**:
- Monitors Git repository for Kubernetes manifests
- Auto-syncs changes to cluster (configurable)
- Health status tracking per service
- Rollback capabilities

**Access ArgoCD**:
```bash
kubectl get secret -n argocd argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d

kubectl port-forward -n argocd svc/argocd-server 8080:80
# Open http://localhost:8080 (admin/<password>)
```

## Local Development

### Prerequisites
- Docker & Docker Compose
- Node.js 18+
- Python 3.9+
- AWS CLI (for cloud resources)
- kubectl (for cluster interaction)

### Quick Start

```bash
# 1. Clone repository
git clone https://github.com/haihhdev/ballandbeer.git
cd ballandbeer

# 2. Start infrastructure services
cd services
docker-compose up -d
# Starts: Redpanda (Kafka), Vault

# 3. Run individual services
cd services/authen
npm install
npm start  # Runs on port 4000

# Frontend
cd frontend
npm install
npm run dev  # Runs on port 3000
```

### Environment Configuration

Each service requires environment variables (stored in Vault in production):

```bash
# Example .env for backend services
PORT=4000
MONGODB_URI=mongodb://localhost:27017/ballandbeer
JWT_SECRET=your-secret
VAULT_ADDR=http://localhost:8200
VAULT_TOKEN=root
```

### Local Testing

```bash
# Run load tests with K6
cd services/collector/k6
kubectl apply -f k6-weekday-job.yaml

# Watch autoscaling behavior
watch kubectl get hpa -n ballandbeer
kubectl top pods -n ballandbeer
```

## Deployment

### Infrastructure Provisioning

```bash
cd ops/tf-aws-eks

# Initialize Terraform
terraform init

# Create workspace
terraform workspace new dev
terraform workspace select dev

# Plan and apply
terraform plan -var-file=variables/dev.tfvars
terraform apply -var-file=variables/dev.tfvars

# Configure kubectl
aws eks update-kubeconfig --name ballandbeer-dev-eks --region us-east-1
```

### Install Core Components

```bash
# 1. NGINX Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/aws/deploy.yaml

# 2. Cert-Manager (TLS certificates)
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
kubectl apply -f ops/k8s/cluster-issuer.yaml

# 3. Prometheus Stack
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace \
  -f ops/monitoring/kube-prometheus-stack-values.yaml

# 4. ArgoCD
helm repo add argo https://argoproj.github.io/argo-helm
helm install argocd argo/argo-cd \
  -n argocd --create-namespace \
  -f ops/argocd/argocd-values.yaml

# 5. KEDA (event-driven autoscaling)
helm repo add kedacore https://kedacore.github.io/charts
helm install keda kedacore/keda -n kube-system

# 6. Cluster Autoscaler
helm repo add autoscaler https://kubernetes.github.io/autoscaler
helm install cluster-autoscaler autoscaler/cluster-autoscaler \
  -n kube-system \
  -f ops/k8s/infra/cluster-autoscaler-values.yaml
```

### Deploy Applications

```bash
# Apply all ArgoCD applications
kubectl apply -f ops/k8s/frontend/overlays/dev/argocd-app.yaml -n argocd
kubectl apply -f ops/k8s/authen/overlays/dev/argocd-app.yaml -n argocd
kubectl apply -f ops/k8s/booking/overlays/dev/argocd-app.yaml -n argocd
kubectl apply -f ops/k8s/order/overlays/dev/argocd-app.yaml -n argocd
kubectl apply -f ops/k8s/product/overlays/dev/argocd-app.yaml -n argocd
kubectl apply -f ops/k8s/profile/overlays/dev/argocd-app.yaml -n argocd
kubectl apply -f ops/k8s/recommender/overlays/dev/argocd-app.yaml -n argocd
kubectl apply -f ops/k8s/collector/overlays/dev/argocd-app.yaml -n argocd
kubectl apply -f ops/k8s/ml-autoscaler/overlays/dev/argocd-app.yaml -n argocd

# Verify deployments
kubectl get pods -n ballandbeer
kubectl get ingress -n ballandbeer
```

## Project Structure

```
ballandbeer/
├── frontend/                 # Next.js web application
├── services/                 # Backend microservices
│   ├── authen/              # Authentication service
│   ├── booking/             # Booking service
│   ├── order/               # Order service (+ Kafka)
│   ├── product/             # Product service
│   ├── profile/             # Profile service
│   ├── recommender/         # ML recommendation service
│   ├── collector/           # Metrics collection service
│   ├── ml-autoscaler/       # ML autoscaling service
│   └── docker-compose.yaml  # Local dev infrastructure
├── ops/                     # Operations and infrastructure
│   ├── tf-aws-eks/          # Terraform EKS cluster
│   ├── k8s/                 # Kubernetes manifests (Kustomize)
│   ├── argocd/              # ArgoCD configuration
│   ├── monitoring/          # Prometheus/Grafana config
│   └── Jenkinsfile          # CI/CD pipeline definition
└── modules/                 # Additional modules
```

## License

This project is proprietary and confidential.

## Contributors

Built by the Ball & Beer engineering team.