#!/bin/bash

################################################################################
# Ball and Beer - Application Deployment Script
# This script deploys all applications and infrastructure components to EKS
################################################################################

set -e  # Exit on error

# Configuration
AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-ap-southeast-1}"
CLUSTER_NAME="${CLUSTER_NAME:-ballandbeer-dev-eks}"
TERRAFORM_DIR="ops/tf-aws-eks"
MONITORING_NAMESPACE="monitoring"
ARGOCD_NAMESPACE="argocd"
KUBE_PROM_VALUES_FILE="ops/monitoring/kube-prometheus-stack-values.yaml"
ARGOCD_VALUES_FILE="ops/argocd/argocd-values.yaml"

# Get the project root directory (3 levels up from script location)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

################################################################################
# Helper Functions
################################################################################

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    echo "Checking prerequisites..."
    
    local missing_tools=()
    
    if ! command_exists kubectl; then
        missing_tools+=("kubectl")
    fi
    
    if ! command_exists helm; then
        missing_tools+=("helm")
    fi
    
    if ! command_exists aws; then
        missing_tools+=("aws")
    fi
    
    if ! command_exists terraform; then
        missing_tools+=("terraform")
    fi
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        echo "ERROR: Missing required tools: ${missing_tools[*]}"
        echo "Please install missing tools and try again"
        exit 1
    fi
    
    echo "Prerequisites check passed"
}

################################################################################
# Deployment Stages
################################################################################

update_kubeconfig() {
    echo "Stage: Updating Kubeconfig"
    aws eks update-kubeconfig --name "${CLUSTER_NAME}" --region "${AWS_DEFAULT_REGION}"
    kubectl cluster-info
}

setup_helm_repositories() {
    echo "Stage: Setting Up Helm Repositories"
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts || true
    helm repo add argo https://argoproj.github.io/argo-helm || true
    helm repo add autoscaler https://kubernetes.github.io/autoscaler || true
    helm repo add redpanda https://charts.redpanda.com || true
    helm repo add grafana https://grafana.github.io/helm-charts || true
    helm repo add kedacore https://kedacore.github.io/charts || true
    helm repo update
}

install_kube_prometheus_stack() {
    echo "Stage: Installing Kube-Prometheus-Stack"
    kubectl create namespace "${MONITORING_NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -
    helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
        --namespace "${MONITORING_NAMESPACE}" \
        -f "${PROJECT_ROOT}/${KUBE_PROM_VALUES_FILE}"
    kubectl wait --for=condition=ready pod -l "app.kubernetes.io/name=grafana" \
        -n "${MONITORING_NAMESPACE}" --timeout=120s || true
}

install_k6_operator() {
    echo "Stage: Installing K6 Operator"
    curl -s https://raw.githubusercontent.com/grafana/k6-operator/main/bundle.yaml | kubectl apply -f -
    kubectl wait --for=condition=ready pod -l "control-plane=controller-manager" \
        -n k6-operator-system --timeout=120s || true
}

install_infrastructure_prerequisites() {
    echo "Stage: Installing Infrastructure Prerequisites"
    kubectl create namespace ballandbeer --dry-run=client -o yaml | kubectl apply -f -
    kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.1/deploy/static/provider/aws/deploy.yaml
    kubectl wait --namespace ingress-nginx --for=condition=ready pod \
        --selector=app.kubernetes.io/component=controller --timeout=120s || true
    kubectl apply -f "${PROJECT_ROOT}/ops/monitoring/nginx-ingress-configmap.yaml"
    kubectl apply -f "${PROJECT_ROOT}/ops/monitoring/nginx-ingress-servicemonitor.yaml"
    kubectl wait --namespace ingress-nginx --for=condition=ready pod \
        --selector=app.kubernetes.io/component=controller --timeout=120s || true
}

enable_nginx_metrics() {
    echo "Stage: Enabling NGINX Metrics"
    kubectl patch deployment ingress-nginx-controller -n ingress-nginx --type='json' -p='[
        {
            "op": "add",
            "path": "/spec/template/spec/containers/0/ports/-",
            "value": {
                "containerPort": 10254,
                "name": "metrics",
                "protocol": "TCP"
            }
        }
    ]' || true
    
    # Enable metrics without jq dependency
    kubectl get deployment ingress-nginx-controller -n ingress-nginx -o yaml | \
        sed 's/--enable-metrics=false/--enable-metrics=true/' | \
        kubectl apply -f -
    
    kubectl rollout status deployment ingress-nginx-controller -n ingress-nginx --timeout=2m
}

install_cluster_autoscaler() {
    echo "Stage: Installing Cluster Autoscaler"
    cd "${PROJECT_ROOT}/${TERRAFORM_DIR}"
    CA_ROLE_ARN=$(terraform output -raw cluster_autoscaler_role_arn)
    cd "${PROJECT_ROOT}"
    
    helm upgrade --install cluster-autoscaler autoscaler/cluster-autoscaler \
        --version 9.51.0 \
        --namespace kube-system \
        -f "${PROJECT_ROOT}/ops/k8s/infra/cluster-autoscaler-values.yaml" \
        --set rbac.serviceAccount.annotations."eks\.amazonaws\.com/role-arn"="${CA_ROLE_ARN}"
    
    kubectl wait --for=condition=ready pod -l "app.kubernetes.io/name=aws-cluster-autoscaler" \
        -n kube-system --timeout=120s || true
}

install_metrics_server() {
    echo "Stage: Installing Metrics Server"
    kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
    kubectl wait --for=condition=ready pod -l "k8s-app=metrics-server" -n kube-system --timeout=120s || true
}

install_keda() {
    echo "Stage: Installing KEDA"
    helm install keda kedacore/keda --namespace keda --create-namespace
    kubectl wait --for=condition=ready pod -l "app.kubernetes.io/name=keda-operator" -n keda --timeout=120s || true
}

install_argocd() {
    echo "Stage: Installing ArgoCD"
    kubectl create namespace "${ARGOCD_NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -
    helm upgrade --install argocd argo/argo-cd \
        --namespace "${ARGOCD_NAMESPACE}" \
        -f "${PROJECT_ROOT}/${ARGOCD_VALUES_FILE}"
    kubectl wait --for=condition=ready pod -l "app.kubernetes.io/name=argocd-server" \
        -n "${ARGOCD_NAMESPACE}" --timeout=120s || true
}

install_redpanda() {
    echo "Stage: Installing Redpanda & Console"
    kubectl create namespace redpanda --dry-run=client -o yaml | kubectl apply -f -
    helm upgrade --install redpanda redpanda/redpanda \
        --namespace redpanda \
        -f "${PROJECT_ROOT}/ops/k8s/infra/redpanda-values.yaml"
    kubectl wait --for=condition=ready pod/redpanda-0 -n redpanda --timeout=300s
    kubectl exec -n redpanda redpanda-0 -- rpk topic create order-topic --brokers=localhost:9093 || true
}

deploy_argocd_applications() {
    echo "Stage: Deploying ArgoCD Applications"
    local apps=('authen' 'booking' 'order' 'product' 'profile' 'frontend' 'recommender' 'infra' 'collector' 'ml-autoscaler')
    
    for svc in "${apps[@]}"; do
        echo "  Deploying: ${svc}"
        kubectl apply -f "${PROJECT_ROOT}/ops/k8s/${svc}/overlays/dev/argocd-app.yaml" -n argocd || true
    done
}

setup_k6_infrastructure() {
    echo "Stage: Setting Up K6 Load Test Infrastructure"
    kubectl apply -f "${PROJECT_ROOT}/services/collector/k6/k6-priorityclass.yaml"
    kubectl create configmap k6-training-script -n ballandbeer \
        --from-file=training-traffic.js="${PROJECT_ROOT}/services/collector/k6/training-traffic.js" \
        --dry-run=client -o yaml | kubectl apply -f -
}

show_cluster_info() {
    echo "Stage: Showing Cluster Information"
    kubectl apply -f "${PROJECT_ROOT}/ops/k8s/ingress.yaml" -n ballandbeer
    
    echo ""
    echo "========== ACCESS INFORMATION =========="
    
    GRAFANA_PASS=$(kubectl get secret kube-prometheus-stack-grafana -n monitoring -o jsonpath="{.data.admin-password}" | base64 -d 2>/dev/null || echo "N/A")
    ARGOCD_PASS=$(kubectl get secret -n argocd argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d 2>/dev/null || echo "N/A")
    ARGOCD_URL=$(kubectl get svc argocd-server -n argocd -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "Pending")
    INGRESS_URL=$(kubectl get svc ingress-nginx-controller -n ingress-nginx -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "Pending")
    REDPANDA_URL=$(kubectl get svc redpanda-console -n redpanda -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "Pending")
    
    echo "Grafana: http://localhost:3000 (admin/${GRAFANA_PASS})"
    echo "  Port-forward: kubectl port-forward svc/kube-prometheus-stack-grafana -n monitoring 3000:80"
    echo ""
    echo "ArgoCD: http://${ARGOCD_URL} (admin/${ARGOCD_PASS})"
    echo "Ingress: ${INGRESS_URL}"
    echo "Redpanda: ${REDPANDA_URL}"
    echo ""
    
    echo "========== HPA STATUS =========="
    kubectl get hpa -n ballandbeer 2>/dev/null || echo "No HPAs found yet"
    echo ""
    echo "Deployment complete!"
}

################################################################################
# Main Execution
################################################################################

main() {
    echo "Starting deployment to ${CLUSTER_NAME} in ${AWS_DEFAULT_REGION}"
    echo ""
    
    cd "${PROJECT_ROOT}"
    
    check_prerequisites
    update_kubeconfig
    setup_helm_repositories
    install_kube_prometheus_stack
    install_k6_operator
    install_infrastructure_prerequisites
    enable_nginx_metrics
    install_cluster_autoscaler
    install_metrics_server
    install_keda
    install_argocd
    install_redpanda
    deploy_argocd_applications
    setup_k6_infrastructure
    show_cluster_info
    
    echo ""
    echo "All stages completed!"
}

main "$@"

