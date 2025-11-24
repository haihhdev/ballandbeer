#!/bin/bash

# Monitor HPA and real-time CPU metrics
# Usage: ./monitor-hpa.sh [interval_seconds] [service_name]

INTERVAL=${1:-10}
SERVICE=${2:-all}

echo "Monitoring HPA metrics (interval: ${INTERVAL}s, service: ${SERVICE})"
echo "Press Ctrl+C to stop"
echo ""

while true; do
    clear
    echo "=== HPA Monitoring @ $(date '+%Y-%m-%d %H:%M:%S') ==="
    echo ""
    
    if [ "$SERVICE" = "all" ]; then
        SERVICES=("authen" "booking" "order" "product" "profile" "frontend" "recommender")
    else
        SERVICES=("$SERVICE")
    fi
    
    printf "%-12s | %-8s | %-8s | %-8s | %-8s | %-8s\n" "SERVICE" "CPU%" "MEMORY%" "CURR_REP" "DES_REP" "REAL_CPU"
    printf "%-12s-+-%-8s-+-%-8s-+-%-8s-+-%-8s-+-%-8s\n" "------------" "--------" "--------" "--------" "--------" "--------"
    
    for svc in "${SERVICES[@]}"; do
        # Get HPA metrics
        HPA_DATA=$(kubectl get hpa keda-hpa-${svc}-scaledobject -n ballandbeer -o json 2>/dev/null)
        
        if [ -n "$HPA_DATA" ]; then
            CPU=$(echo "$HPA_DATA" | jq -r '.status.currentMetrics[]? | select(.resource.name=="cpu") | .resource.current.averageUtilization // "N/A"')
            MEMORY=$(echo "$HPA_DATA" | jq -r '.status.currentMetrics[]? | select(.resource.name=="memory") | .resource.current.averageUtilization // "N/A"')
            CURR_REP=$(echo "$HPA_DATA" | jq -r '.status.currentReplicas // "N/A"')
            DES_REP=$(echo "$HPA_DATA" | jq -r '.status.desiredReplicas // "N/A"')
            
            # Get real-time CPU from kubectl top
            REAL_CPU=$(kubectl top pods -n ballandbeer -l app=${svc} --no-headers 2>/dev/null | awk '{sum+=$2} END {gsub(/m/,"",sum); printf "%.0fm", sum}')
            [ -z "$REAL_CPU" ] && REAL_CPU="N/A"
            
            printf "%-12s | %-8s | %-8s | %-8s | %-8s | %-8s\n" "$svc" "${CPU}%" "${MEMORY}%" "$CURR_REP" "$DES_REP" "$REAL_CPU"
        else
            printf "%-12s | %-8s | %-8s | %-8s | %-8s | %-8s\n" "$svc" "NO HPA" "-" "-" "-" "-"
        fi
    done
    
    echo ""
    echo "K6 Status:"
    kubectl logs -n ballandbeer -l job-name=k6-training-diverse --tail=2 2>/dev/null | grep "running" | tail -1
    
    echo ""
    echo "Last 3 CSV entries for ${SERVICE}:"
    COLLECTOR_POD=$(kubectl get pod -n ballandbeer -l app=collector -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    if [ -n "$COLLECTOR_POD" ]; then
        if [ "$SERVICE" = "all" ]; then
            kubectl exec -n ballandbeer $COLLECTOR_POD -- tail -7 /data/metrics_20251124.csv 2>/dev/null | awk -F',' '{printf "%s | %s | CPU:%.1f%% | Rep:%d\n", $1, $2, $3, $12}'
        else
            kubectl exec -n ballandbeer $COLLECTOR_POD -- awk -F',' -v svc="$SERVICE" '$2==svc {printf "%s | CPU:%.1f%% | Rep:%d\n", $1, $3, $12}' /data/metrics_20251124.csv 2>/dev/null | tail -3
        fi
    fi
    
    sleep $INTERVAL
done
