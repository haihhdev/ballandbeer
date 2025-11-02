import os
from datetime import time

PROMETHEUS_URL = os.getenv('PROMETHEUS_URL', 'http://kube-prometheus-stack-prometheus.monitoring.svc.cluster.local:9090')
S3_BUCKET = os.getenv('S3_BUCKET', 'ballandbeer-metrics')
S3_REGION = os.getenv('S3_REGION', 'ap-southeast-1')
COLLECTION_INTERVAL = int(os.getenv('COLLECTION_INTERVAL', '30'))

COLLECTION_START_HOUR = 6
COLLECTION_END_HOUR = 22

SERVICES = [
    'authen',
    'booking',
    'order',
    'product',
    'profile',
    'frontend',
    'recommender'
]

NAMESPACE = os.getenv('NAMESPACE', 'ballandbeer')

CSV_COLUMNS = [
    'timestamp',
    'service_name',
    'cpu_usage_percent',
    'cpu_usage_percent_last_5_min',
    'cpu_usage_percent_slope',
    'ram_usage_percent',
    'ram_usage_percent_last_5_min',
    'ram_usage_percent_slope',
    'request_count_per_second',
    'request_count_per_second_last_5_min',
    'response_time_ms',
    'replica_count',
    'is_holiday',
    'is_weekend',
    'cpu_request',
    'cpu_limit',
    'ram_request',
    'ram_limit',
    'queue_length',
    'error_rate',
    'pod_restart_count',
    'node_cpu_pressure_flag',
    'node_memory_pressure_flag'
]
