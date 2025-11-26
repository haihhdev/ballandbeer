#!/bin/bash

################################################################################
# Ball and Beer - Application Cleanup Script
# This script removes all applications and infrastructure components from EKS
################################################################################

set -e  # Exit on error

# Configuration
AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-ap-southeast-1}"
CLUSTER_NAME="${CLUSTER_NAME:-ballandbeer-dev-eks}"

# Get the project root directory (3 levels up from script location)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

################################################################################
# Cleanup Functions
################################################################################

confirm_cleanup() {
    echo "WARNING: This will delete all applications from cluster: ${CLUSTER_NAME}"
    echo ""
    read -p "Type 'yes' to confirm: " confirmation
    
    if [ "$confirmation" != "yes" ]; then
        echo "Cleanup cancelled"
        exit 0
    fi
    
    echo "Starting cleanup..."
}

update_kubeconfig() {
    echo "Stage: Updating Kubeconfig"
    aws eks update-kubeconfig --name "${CLUSTER_NAME}" --region "${AWS_DEFAULT_REGION}" || true
}

delete_argocd_applications() {
    echo "Stage: Deleting ArgoCD Applications"
    local apps=('authen' 'booking' 'order' 'product' 'profile' 'frontend' 'recommender' 'infra' 'collector')
    
    for svc in "${apps[@]}"; do
        echo "  Deleting: ${svc}"
        kubectl delete -f "${PROJECT_ROOT}/ops/k8s/${svc}/overlays/dev/argocd-app.yaml" -n argocd --ignore-not-found=true || true
    done
    
    sleep 10
}

cleanup_loadbalancers() {
    echo "Stage: Cleaning Up LoadBalancers"
    kubectl delete svc argocd-server -n argocd --ignore-not-found=true || true
    kubectl delete svc redpanda-console -n redpanda --ignore-not-found=true || true
    kubectl delete svc ingress-nginx-controller -n ingress-nginx --ignore-not-found=true || true
    sleep 30
}

uninstall_helm_releases() {
    echo "Stage: Uninstalling Helm Releases"
    helm uninstall keda -n keda || true
    helm uninstall cluster-autoscaler -n kube-system || true
    helm uninstall k6-operator -n k6-operator-system || true
    helm uninstall argocd -n argocd || true
    helm uninstall redpanda -n redpanda || true
    helm uninstall kube-prometheus-stack -n monitoring || true
}

delete_k6_operator() {
    echo "Stage: Deleting K6 Operator"
    curl -s https://raw.githubusercontent.com/grafana/k6-operator/main/bundle.yaml | kubectl delete -f - || true
}

delete_metrics_server() {
    echo "Stage: Deleting Metrics Server"
    kubectl delete -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml || true
}

delete_nginx_ingress() {
    echo "Stage: Deleting NGINX Ingress Controller"
    kubectl delete -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.1/deploy/static/provider/aws/deploy.yaml || true
}

delete_namespaces() {
    echo "Stage: Deleting Namespaces"
    local namespaces=('ballandbeer' 'monitoring' 'argocd' 'redpanda' 'keda' 'k6-operator-system')
    
    for ns in "${namespaces[@]}"; do
        echo "  Deleting namespace: ${ns}"
        kubectl delete namespace "${ns}" --ignore-not-found=true || true
    done
    
    sleep 10
}

delete_pvcs_and_pvs() {
    echo "Stage: Cleaning Up Persistent Volumes"
    kubectl delete pvc --all -n monitoring --ignore-not-found=true || true
    kubectl delete pvc --all -n redpanda --ignore-not-found=true || true
    kubectl delete pvc --all -n ballandbeer --ignore-not-found=true || true
    sleep 10
}

show_cleanup_status() {
    echo ""
    echo "========== CLEANUP STATUS =========="
    echo ""
    echo "Remaining LoadBalancers:"
    kubectl get svc --all-namespaces -o wide | grep LoadBalancer || echo "None"
    echo ""
    echo "Remaining application namespaces:"
    kubectl get namespaces | grep -E "ballandbeer|monitoring|argocd|redpanda|keda|k6-operator" || echo "None"
    echo ""
    echo "Cleanup completed!"
    echo "Note: Some resources may take a few minutes to fully terminate"
}

################################################################################
# Main Execution
################################################################################

main() {
    echo "Starting cleanup for ${CLUSTER_NAME} in ${AWS_DEFAULT_REGION}"
    echo ""
    
    cd "${PROJECT_ROOT}"
    
    confirm_cleanup
    update_kubeconfig
    delete_argocd_applications
    cleanup_loadbalancers
    uninstall_helm_releases
    delete_k6_operator
    delete_metrics_server
    delete_nginx_ingress
    delete_pvcs_and_pvs
    delete_namespaces
    show_cleanup_status
    
    echo ""
    echo "All cleanup stages completed!"
}

main "$@"

