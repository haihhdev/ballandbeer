import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from kubernetes import client, config as k8s_config
from prometheus_api_client import PrometheusConnect
import config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MetricsCollector:
    def __init__(self):
        try:
            k8s_config.load_incluster_config()
        except:
            k8s_config.load_kube_config()
        
        self.k8s_apps = client.AppsV1Api()
        self.k8s_core = client.CoreV1Api()
        self.prom = PrometheusConnect(url=config.PROMETHEUS_URL, disable_ssl=True)
        
    def collect_cpu_usage(self, service: str) -> Optional[float]:
        query = f'sum(rate(container_cpu_usage_seconds_total{{namespace="{config.NAMESPACE}", pod=~"{service}-.*", container="{service}"}}[1m])) * 100'
        result = self.prom.custom_query(query=query)
        
        if result and len(result) > 0:
            return float(result[0]['value'][1])
        return 0.0
    
    def collect_ram_usage(self, service: str) -> Optional[float]:
        query = f'sum(container_memory_working_set_bytes{{namespace="{config.NAMESPACE}", pod=~"{service}-.*", container="{service}"}}) / sum(container_spec_memory_limit_bytes{{namespace="{config.NAMESPACE}", pod=~"{service}-.*", container="{service}"}}) * 100'
        result = self.prom.custom_query(query=query)
        
        if result and len(result) > 0:
            return float(result[0]['value'][1])
        return 0.0
    
    def collect_request_rate(self, service: str) -> float:
        query = f'sum(rate(nginx_ingress_controller_requests{{service="{service}", namespace="{config.NAMESPACE}"}}[1m]))'
        result = self.prom.custom_query(query=query)
        
        if result and len(result) > 0:
            return float(result[0]['value'][1])
        return 0.0
    
    def collect_response_time(self, service: str) -> float:
        query = f'histogram_quantile(0.95, sum(rate(nginx_ingress_controller_request_duration_seconds_bucket{{service="{service}", namespace="{config.NAMESPACE}"}}[5m])) by (le)) * 1000'
        result = self.prom.custom_query(query=query)
        
        if result and len(result) > 0:
            return float(result[0]['value'][1])
        return 0.0
    
    def collect_error_rate(self, service: str) -> float:
        total_query = f'sum(rate(nginx_ingress_controller_requests{{service="{service}", namespace="{config.NAMESPACE}"}}[5m]))'
        error_query = f'sum(rate(nginx_ingress_controller_requests{{service="{service}", namespace="{config.NAMESPACE}", status=~"5.."}}[5m]))'
        
        total_result = self.prom.custom_query(query=total_query)
        error_result = self.prom.custom_query(query=error_query)
        
        if total_result and error_result and len(total_result) > 0 and len(error_result) > 0:
            total = float(total_result[0]['value'][1])
            errors = float(error_result[0]['value'][1])
            if total > 0:
                return (errors / total) * 100
        return 0.0
    
    def collect_queue_length(self, service: str) -> int:
        query = f'nginx_ingress_controller_nginx_process_connections{{service="{service}", namespace="{config.NAMESPACE}", state="active"}}'
        result = self.prom.custom_query(query=query)
        
        if result and len(result) > 0:
            return int(float(result[0]['value'][1]))
        return 0
    
    def collect_replica_count(self, service: str) -> int:
        try:
            deployment = self.k8s_apps.read_namespaced_deployment(
                name=service,
                namespace=config.NAMESPACE
            )
            return deployment.status.ready_replicas or 0
        except Exception as e:
            logger.warning(f"Failed to get replica count for {service}: {e}")
            return 0
    
    def collect_pod_restart_count(self, service: str) -> int:
        try:
            pods = self.k8s_core.list_namespaced_pod(
                namespace=config.NAMESPACE,
                label_selector=f"app={service}"
            )
            
            total_restarts = 0
            for pod in pods.items:
                if pod.status.container_statuses:
                    for container in pod.status.container_statuses:
                        total_restarts += container.restart_count
            
            return total_restarts
        except Exception as e:
            logger.warning(f"Failed to get restart count for {service}: {e}")
            return 0
    
    def collect_resource_requests_limits(self, service: str) -> Dict[str, float]:
        try:
            deployment = self.k8s_apps.read_namespaced_deployment(
                name=service,
                namespace=config.NAMESPACE
            )
            
            container = deployment.spec.template.spec.containers[0]
            resources = {
                'cpu_request': 0.0,
                'cpu_limit': 0.0,
                'ram_request': 0.0,
                'ram_limit': 0.0
            }
            
            if container.resources:
                if container.resources.requests:
                    cpu_req = container.resources.requests.get('cpu', '0')
                    resources['cpu_request'] = self._parse_cpu(cpu_req)
                    
                    mem_req = container.resources.requests.get('memory', '0')
                    resources['ram_request'] = self._parse_memory(mem_req)
                
                if container.resources.limits:
                    cpu_lim = container.resources.limits.get('cpu', '0')
                    resources['cpu_limit'] = self._parse_cpu(cpu_lim)
                    
                    mem_lim = container.resources.limits.get('memory', '0')
                    resources['ram_limit'] = self._parse_memory(mem_lim)
            
            return resources
        except Exception as e:
            logger.warning(f"Failed to get resources for {service}: {e}")
            return {
                'cpu_request': 0.0,
                'cpu_limit': 0.0,
                'ram_request': 0.0,
                'ram_limit': 0.0
            }
    
    def _parse_cpu(self, cpu_str: str) -> float:
        if isinstance(cpu_str, (int, float)):
            return float(cpu_str)
        
        cpu_str = str(cpu_str)
        if cpu_str.endswith('m'):
            return float(cpu_str[:-1]) / 1000
        return float(cpu_str)
    
    def _parse_memory(self, mem_str: str) -> float:
        if isinstance(mem_str, (int, float)):
            return float(mem_str)
        
        mem_str = str(mem_str)
        units = {
            'Ki': 1024,
            'Mi': 1024 ** 2,
            'Gi': 1024 ** 3,
            'K': 1000,
            'M': 1000 ** 2,
            'G': 1000 ** 3
        }
        
        for unit, multiplier in units.items():
            if mem_str.endswith(unit):
                return float(mem_str[:-len(unit)]) * multiplier
        
        return float(mem_str)
    
    def collect_all_metrics(self, service: str) -> Dict:
        logger.info(f"Collecting metrics for service: {service}")
        
        metrics = {
            'timestamp': datetime.now().isoformat(),
            'service_name': service,
            'cpu_usage_percent': self.collect_cpu_usage(service),
            'ram_usage_percent': self.collect_ram_usage(service),
            'request_count_per_second': self.collect_request_rate(service),
            'response_time_ms': self.collect_response_time(service),
            'replica_count': self.collect_replica_count(service),
            'error_rate': self.collect_error_rate(service),
            'queue_length': self.collect_queue_length(service),
            'pod_restart_count': self.collect_pod_restart_count(service)
        }
        
        resources = self.collect_resource_requests_limits(service)
        metrics.update(resources)
        
        return metrics
