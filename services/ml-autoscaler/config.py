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

# Target column
TARGET_COLUMN = 'replica_count'

# Model Configuration
# PCA Configuration
PCA_PARAMS = {
    'n_components': 30,         # Increased from 25 to retain more information
    'whiten': True,             # Whiten to normalize variance
    'random_state': 42
}

# Transformer Configuration
TRANSFORMER_PARAMS = {
    'sequence_length': 12,      # Use last 12 time steps (6 minutes at 30s interval)
    'lookahead': 20,            # Predict 20 steps ahead (10 minutes)
    'd_model': 128,             # Model dimension
    'num_heads': 4,             # Number of attention heads
    'num_layers': 3,            # 3 layers for better feature extraction
    'dff': 512,                 # Larger feedforward for complex patterns
    'dropout_rate': 0.2,        # Standard dropout
    'learning_rate': 0.0005,    # Lower learning rate for stability
    'batch_size': 64,           # Batch size for stability
    'epochs': 100,
    'early_stopping_patience': 20,
    'discrete_penalty': 0.5     # Penalty weight for non-integer predictions (encourage integers)
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
    'cpu_usage_percent': 60,     # Lower than typical 70-80% - scale earlier
    'ram_usage_percent': 65,     # Lower than typical 75-80% - scale earlier
    'response_time_ms': 400,     # Lower than typical 500ms - detect slowdown earlier
    'error_rate': 0.03           # Lower than typical 0.05 - catch errors earlier
}

SCALE_DOWN_THRESHOLDS = {
    'cpu_usage_percent': 25,     # More conservative than 30% - avoid thrashing
    'ram_usage_percent': 30,     # More conservative - avoid thrashing
    'response_time_ms': 80,      # Only scale down when really underutilized
    'request_count_per_second': 0.5  # Very low traffic
}

# Proactive scaling parameters
LOOKAHEAD_MINUTES = 10           # Predict 10 minutes into the future
LOOKAHEAD_SAMPLES = 20           # At 30s interval, 20 samples = 10 minutes

