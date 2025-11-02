"""
Configuration for ML training pipeline
"""
from pathlib import Path

# Base directory (ml-autoscaler/)
BASE_DIR = Path(__file__).parent

# AWS S3 Configuration
S3_BUCKET = 'ballandbeer-metrics'
S3_PREFIX = 'metrics/'
AWS_REGION = 'ap-southeast-1'

# Data Configuration
SERVICES = ['authen', 'booking', 'order', 'product', 'profile', 'frontend', 'recommender']

# Features to use (excluding time-based features as per requirement)
FEATURE_COLUMNS = [
    # CPU metrics
    'cpu_usage_percent',
    'cpu_usage_percent_last_5_min',
    'cpu_usage_percent_slope',
    
    # RAM metrics
    'ram_usage_percent',
    'ram_usage_percent_last_5_min',
    'ram_usage_percent_slope',
    
    # Request metrics
    'request_count_per_second',
    'request_count_per_second_last_5_min',
    'response_time_ms',
    
    # Resource limits
    'cpu_request',
    'cpu_limit',
    'ram_request',
    'ram_limit',
    
    # Application metrics
    'queue_length',
    'error_rate',
    'pod_restart_count',
    
    # Node pressure flags
    'node_cpu_pressure_flag',
    'node_memory_pressure_flag',
]

# Minimal time features (only hour for basic cyclical pattern)
OPTIONAL_TIME_FEATURES = [
    'hour_sin',  # sin(hour * 2π / 24) - cyclical encoding
    'hour_cos',  # cos(hour * 2π / 24) - cyclical encoding
]

# Target column
TARGET_COLUMN = 'replica_count'

# Model Configuration
RANDOM_FOREST_PARAMS = {
    'n_estimators': 200,
    'max_depth': 15,
    'min_samples_split': 10,
    'min_samples_leaf': 4,
    'random_state': 42,
    'n_jobs': -1
}

LSTM_CNN_PARAMS = {
    'sequence_length': 12,  # Use last 12 time steps (6 minutes of data at 30s interval)
    'lstm_units': 128,
    'cnn_filters': 64,
    'cnn_kernel_size': 3,
    'dense_units': 64,
    'dropout_rate': 0.3,
    'learning_rate': 0.001,
    'batch_size': 64,
    'epochs': 100,
    'early_stopping_patience': 15
}

# Training Configuration
TEST_SIZE = 0.2
VALIDATION_SPLIT = 0.2
RANDOM_STATE = 42

# Output paths (absolute paths relative to ml-autoscaler/)
MODEL_OUTPUT_DIR = BASE_DIR / 'models'
METRICS_OUTPUT_DIR = BASE_DIR / 'evaluation'
PLOTS_OUTPUT_DIR = BASE_DIR / 'plots'
COMPARISON_OUTPUT_DIR = BASE_DIR / 'training' / 'comparison_results'

# Scaling thresholds for determining when to scale
SCALE_UP_THRESHOLDS = {
    'cpu_usage_percent': 70,
    'ram_usage_percent': 75,
    'response_time_ms': 500,
    'error_rate': 0.05
}

SCALE_DOWN_THRESHOLDS = {
    'cpu_usage_percent': 30,
    'ram_usage_percent': 35,
    'response_time_ms': 100,
    'request_count_per_second': 1
}

