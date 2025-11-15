"""
Test script for data preprocessing

Quick test to verify data preprocessing pipeline works correctly
"""

import pandas as pd
import numpy as np
from pathlib import Path
import logging

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from data_preprocessor import DataPreprocessor
import config

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def create_sample_data(n_samples: int = 1000) -> pd.DataFrame:
    """Create sample metrics data for testing"""
    logger.info(f"Creating sample data with {n_samples} samples...")
    
    services = config.SERVICES
    timestamps = pd.date_range('2024-10-30 06:00:00', periods=n_samples//len(services), freq='30S')
    
    data = []
    
    for service in services:
        for timestamp in timestamps:
            row = {
                'timestamp': timestamp,
                'service_name': service,
                'cpu_usage_percent': np.random.uniform(20, 80),
                'cpu_usage_percent_last_5_min': np.random.uniform(20, 80),
                'cpu_usage_percent_slope': np.random.uniform(-5, 5),
                'ram_usage_percent': np.random.uniform(30, 70),
                'ram_usage_percent_last_5_min': np.random.uniform(30, 70),
                'ram_usage_percent_slope': np.random.uniform(-5, 5),
                'request_count_per_second': np.random.uniform(0, 200),
                'request_count_per_second_last_5_min': np.random.uniform(0, 200),
                'response_time_ms': np.random.uniform(50, 600),
                'replica_count': np.random.randint(1, 5),
                'is_holiday': 0,
                'hour_of_day': timestamp.hour,
                'is_weekend': 1 if timestamp.weekday() >= 5 else 0,
                'cpu_request': 0.5,
                'cpu_limit': 2.0,
                'ram_request': 512,
                'ram_limit': 2048,
                'queue_length': np.random.randint(0, 50),
                'error_rate': np.random.uniform(0, 0.1),
                'pod_restart_count': 0,
                'node_cpu_pressure_flag': 0,
                'node_memory_pressure_flag': 0,
            }
            data.append(row)
    
    df = pd.DataFrame(data)
    logger.info(f"Sample data created: {df.shape}")
    return df


def test_preprocessing():
    """Test the preprocessing pipeline"""
    logger.info("="*80)
    logger.info("TESTING DATA PREPROCESSING PIPELINE")
    logger.info("="*80)
    
    # Create sample data
    logger.info("\n[Step 1] Creating sample data...")
    sample_data = create_sample_data(n_samples=1000)
    
    # Save to CSV for testing
    metrics_dir = Path('../metrics')
    metrics_dir.mkdir(exist_ok=True)
    sample_file = metrics_dir / 'test_metrics.csv'
    sample_data.to_csv(sample_file, index=False)
    logger.info(f"Sample data saved to: {sample_file}")
    
    # Initialize preprocessor
    logger.info("\n[Step 2] Initializing preprocessor...")
    preprocessor = DataPreprocessor()
    
    # Test feature engineering
    logger.info("\n[Step 3] Testing feature engineering...")
    engineered_data = preprocessor.engineer_features(sample_data)
    logger.info(f"Engineered data shape: {engineered_data.shape}")
    logger.info(f"New columns: {[col for col in engineered_data.columns if col not in sample_data.columns]}")
    
    # Test target creation
    logger.info("\n[Step 4] Testing target label creation...")
    labeled_data = preprocessor.create_target_labels(engineered_data)
    logger.info(f"Target replicas range: {labeled_data['target_replicas'].min():.0f} - {labeled_data['target_replicas'].max():.0f}")
    logger.info(f"Target replicas distribution:\n{labeled_data['target_replicas'].value_counts().sort_index()}")
    
    # Test feature preparation
    logger.info("\n[Step 5] Testing feature preparation...")
    X, y = preprocessor.prepare_features_and_target(labeled_data)
    logger.info(f"Feature matrix shape: {X.shape}")
    logger.info(f"Target vector shape: {y.shape}")
    logger.info(f"\nFeature columns ({len(X.columns)}):")
    for i, col in enumerate(X.columns, 1):
        print(f"  {i:2d}. {col}")
    
    # Check for NaN values
    logger.info("\n[Step 6] Checking data quality...")
    nan_count = X.isna().sum().sum()
    inf_count = np.isinf(X.values).sum()
    logger.info(f"NaN values: {nan_count}")
    logger.info(f"Inf values: {inf_count}")
    
    if nan_count > 0:
        logger.warning("Found NaN values in features!")
        logger.warning(f"Columns with NaN:\n{X.isna().sum()[X.isna().sum() > 0]}")
    
    if inf_count > 0:
        logger.warning("Found Inf values in features!")
    
    # Test full pipeline
    logger.info("\n[Step 7] Testing full pipeline...")
    X_full, y_full = preprocessor.process_full_pipeline(str(sample_file))
    logger.info(f"Full pipeline output: X={X_full.shape}, y={y_full.shape}")
    
    # Summary statistics
    logger.info("\n[Step 8] Summary statistics...")
    logger.info(f"Target variable statistics:")
    logger.info(f"  Mean: {y_full.mean():.2f}")
    logger.info(f"  Std: {y_full.std():.2f}")
    logger.info(f"  Min: {y_full.min():.0f}")
    logger.info(f"  Max: {y_full.max():.0f}")
    
    logger.info("\n" + "="*80)
    logger.info("PREPROCESSING TEST COMPLETED SUCCESSFULLY!")
    logger.info("="*80)
    logger.info("\nNext steps:")
    logger.info("1. Review feature engineering in data_preprocessor.py")
    logger.info("2. Adjust thresholds in config.py if needed")
    logger.info("3. Train model: python training/transformer_decoder.py")
    logger.info("="*80)


if __name__ == '__main__':
    test_preprocessing()

