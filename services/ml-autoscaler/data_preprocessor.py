"""
Data preprocessing and feature engineering for K8s auto-scaling ML model
"""

import pandas as pd
import numpy as np
from datetime import datetime
import boto3
from typing import List, Tuple, Optional
import logging
from pathlib import Path
import config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DataPreprocessor:
    def __init__(self):
        self.s3_client = boto3.client('s3', region_name=config.AWS_REGION)
        
    def download_data_from_s3(self, start_date: Optional[str] = None, 
                               end_date: Optional[str] = None) -> pd.DataFrame:
        """
        Download metrics data from S3
        
        Args:
            start_date: Start date in format 'YYYY-MM-DD'
            end_date: End date in format 'YYYY-MM-DD'
        """
        logger.info(f"Downloading data from S3 bucket: {config.S3_BUCKET}")
        
        # List all CSV files in S3
        response = self.s3_client.list_objects_v2(
            Bucket=config.S3_BUCKET,
            Prefix=config.S3_PREFIX
        )
        
        if 'Contents' not in response:
            raise ValueError(f"No data found in S3 bucket {config.S3_BUCKET}")
        
        # Filter CSV files
        csv_files = [obj['Key'] for obj in response['Contents'] if obj['Key'].endswith('.csv')]
        logger.info(f"Found {len(csv_files)} CSV files in S3")
        
        # Download and concatenate all CSV files
        dfs = []
        for file_key in csv_files:
            try:
                obj = self.s3_client.get_object(Bucket=config.S3_BUCKET, Key=file_key)
                df = pd.read_csv(obj['Body'])
                dfs.append(df)
                logger.info(f"Downloaded: {file_key} ({len(df)} rows)")
            except Exception as e:
                logger.error(f"Error downloading {file_key}: {e}")
        
        if not dfs:
            raise ValueError("No data could be loaded from S3")
        
        # Concatenate all dataframes
        data = pd.concat(dfs, ignore_index=True)
        logger.info(f"Total data loaded: {len(data)} rows")
        
        return data
    
    def load_local_data(self, file_path: str) -> pd.DataFrame:
        """Load data from local CSV file"""
        logger.info(f"Loading data from local file: {file_path}")
        data = pd.read_csv(file_path)
        logger.info(f"Loaded {len(data)} rows")
        return data
    
    def engineer_features(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Engineer features from raw metrics
        Focus on metrics-based features rather than time-based
        """
        df = data.copy()
        
        # Convert timestamp to datetime
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        
        # Sort by service and timestamp
        df = df.sort_values(['service_name', 'timestamp']).reset_index(drop=True)
        
        # Cyclical encoding of hour (minimal time feature)
        df['hour_of_day'] = df['timestamp'].dt.hour
        df['hour_sin'] = np.sin(2 * np.pi * df['hour_of_day'] / 24)
        df['hour_cos'] = np.cos(2 * np.pi * df['hour_of_day'] / 24)
        
        # Group by service for rolling features
        for service in config.SERVICES:
            service_mask = df['service_name'] == service
            service_df = df[service_mask].copy()
            
            if len(service_df) < 2:
                continue
            
            # Resource utilization metrics
            df.loc[service_mask, 'cpu_utilization_ratio'] = (
                service_df['cpu_usage_percent'] / (service_df['cpu_limit'] + 1e-6)
            )
            df.loc[service_mask, 'ram_utilization_ratio'] = (
                service_df['ram_usage_percent'] / (service_df['ram_limit'] + 1e-6)
            )
            
            # Rate of change features (detecting rapid changes)
            df.loc[service_mask, 'cpu_change_rate'] = service_df['cpu_usage_percent'].diff()
            df.loc[service_mask, 'ram_change_rate'] = service_df['ram_usage_percent'].diff()
            df.loc[service_mask, 'request_change_rate'] = service_df['request_count_per_second'].diff()
            
            # Rolling statistics (capturing recent behavior)
            window_size = 10  # 5 minutes at 30s interval
            
            df.loc[service_mask, 'cpu_rolling_std'] = (
                service_df['cpu_usage_percent'].rolling(window=window_size, min_periods=1).std()
            )
            df.loc[service_mask, 'ram_rolling_std'] = (
                service_df['ram_usage_percent'].rolling(window=window_size, min_periods=1).std()
            )
            df.loc[service_mask, 'request_rolling_max'] = (
                service_df['request_count_per_second'].rolling(window=window_size, min_periods=1).max()
            )
            df.loc[service_mask, 'response_time_rolling_p95'] = (
                service_df['response_time_ms'].rolling(window=window_size, min_periods=1).quantile(0.95)
            )
            
            # Load per replica metrics
            df.loc[service_mask, 'cpu_per_replica'] = (
                service_df['cpu_usage_percent'] / (service_df['replica_count'] + 1)
            )
            df.loc[service_mask, 'ram_per_replica'] = (
                service_df['ram_usage_percent'] / (service_df['replica_count'] + 1)
            )
            df.loc[service_mask, 'requests_per_replica'] = (
                service_df['request_count_per_second'] / (service_df['replica_count'] + 1)
            )
            
            # Pressure indicators (combined metrics)
            df.loc[service_mask, 'system_pressure'] = (
                (service_df['cpu_usage_percent'] > 70).astype(int) +
                (service_df['ram_usage_percent'] > 75).astype(int) +
                (service_df['response_time_ms'] > 500).astype(int) +
                (service_df['error_rate'] > 0.05).astype(int) +
                service_df['node_cpu_pressure_flag'] +
                service_df['node_memory_pressure_flag']
            )
        
        # Fill NaN values from diff and rolling operations
        df = df.fillna(0)
        
        logger.info(f"Feature engineering completed. New shape: {df.shape}")
        return df
    
    def create_target_labels(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Create target labels for scaling prediction
        Predict optimal replica count based on future metrics
        """
        df = data.copy()
        
        # For each service, we want to predict the optimal replica count
        # Look ahead to see if we need to scale
        for service in config.SERVICES:
            service_mask = df['service_name'] == service
            service_df = df[service_mask].copy()
            
            if len(service_df) < 2:
                continue
            
            # Look ahead 5 minutes (10 samples at 30s interval)
            lookahead = 10
            
            # Get future max metrics
            future_cpu_max = service_df['cpu_usage_percent'].rolling(
                window=lookahead, min_periods=1
            ).max().shift(-lookahead)
            
            future_ram_max = service_df['ram_usage_percent'].rolling(
                window=lookahead, min_periods=1
            ).max().shift(-lookahead)
            
            future_response_p95 = service_df['response_time_ms'].rolling(
                window=lookahead, min_periods=1
            ).quantile(0.95).shift(-lookahead)
            
            # Calculate optimal replicas based on resource usage
            current_replicas = service_df['replica_count']
            
            # Scale up logic
            scale_up_cpu = (future_cpu_max > config.SCALE_UP_THRESHOLDS['cpu_usage_percent'])
            scale_up_ram = (future_ram_max > config.SCALE_UP_THRESHOLDS['ram_usage_percent'])
            scale_up_response = (future_response_p95 > config.SCALE_UP_THRESHOLDS['response_time_ms'])
            
            # Scale down logic
            scale_down_cpu = (future_cpu_max < config.SCALE_DOWN_THRESHOLDS['cpu_usage_percent'])
            scale_down_ram = (future_ram_max < config.SCALE_DOWN_THRESHOLDS['ram_usage_percent'])
            
            # Determine target replicas
            target_replicas = current_replicas.copy()
            
            # Scale up if any critical metric is high
            should_scale_up = scale_up_cpu | scale_up_ram | scale_up_response
            target_replicas[should_scale_up] = np.minimum(
                current_replicas[should_scale_up] + 1, 
                10  # max replicas
            )
            
            # Scale down if all metrics are low
            should_scale_down = scale_down_cpu & scale_down_ram
            target_replicas[should_scale_down] = np.maximum(
                current_replicas[should_scale_down] - 1,
                1  # min replicas
            )
            
            df.loc[service_mask, 'target_replicas'] = target_replicas
        
        # Fill NaN from shift operation
        df['target_replicas'] = df['target_replicas'].fillna(df['replica_count'])
        
        logger.info("Target labels created")
        return df
    
    def prepare_features_and_target(self, data: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series]:
        """
        Prepare final feature matrix and target variable
        """
        # Select only the features we want to use
        all_features = config.FEATURE_COLUMNS.copy()
        
        # Add engineered features
        engineered_features = [
            'hour_sin', 'hour_cos',
            'cpu_utilization_ratio', 'ram_utilization_ratio',
            'cpu_change_rate', 'ram_change_rate', 'request_change_rate',
            'cpu_rolling_std', 'ram_rolling_std',
            'request_rolling_max', 'response_time_rolling_p95',
            'cpu_per_replica', 'ram_per_replica', 'requests_per_replica',
            'system_pressure'
        ]
        
        all_features.extend(engineered_features)
        
        # One-hot encode service names
        service_dummies = pd.get_dummies(data['service_name'], prefix='service')
        
        # Combine features
        X = pd.concat([
            data[all_features],
            service_dummies
        ], axis=1)
        
        # Target variable
        y = data['target_replicas']
        
        logger.info(f"Feature matrix shape: {X.shape}")
        logger.info(f"Target shape: {y.shape}")
        logger.info(f"Features: {list(X.columns)}")
        
        return X, y
    
    def load_local_folder(self, folder_path: str = 'metrics') -> pd.DataFrame:
        """Load and concatenate all CSV files from local folder"""
        from pathlib import Path
        
        folder = Path(folder_path)
        if not folder.exists():
            raise ValueError(f"Folder {folder_path} does not exist")
        
        csv_files = list(folder.glob('*.csv'))
        if not csv_files:
            raise ValueError(f"No CSV files found in {folder_path}")
        
        logger.info(f"Loading data from folder: {folder_path}")
        logger.info(f"Found {len(csv_files)} CSV files")
        
        dfs = []
        for csv_file in csv_files:
            try:
                df = pd.read_csv(csv_file)
                dfs.append(df)
                logger.info(f"Loaded: {csv_file.name} ({len(df)} rows)")
            except Exception as e:
                logger.error(f"Error loading {csv_file.name}: {e}")
        
        if not dfs:
            raise ValueError(f"No data could be loaded from {folder_path}")
        
        data = pd.concat(dfs, ignore_index=True)
        logger.info(f"Total data loaded: {len(data)} rows")
        
        return data
    
    def process_full_pipeline(self, data_source: str = 'local') -> Tuple[pd.DataFrame, pd.Series]:
        """
        Run full preprocessing pipeline
        
        Args:
            data_source: 'local' (default, load from metrics/ folder), 
                        's3' (download from S3), 
                        or path to specific CSV file
        """
        logger.info("Starting full preprocessing pipeline")
        
        # Load data
        if data_source == 's3':
            data = self.download_data_from_s3()
        elif data_source == 'local':
            data = self.load_local_folder('metrics')
        else:
            # Assume it's a file path
            from pathlib import Path
            path = Path(data_source)
            if path.is_dir():
                data = self.load_local_folder(data_source)
            else:
                data = self.load_local_data(data_source)
        
        # Engineer features
        data = self.engineer_features(data)
        
        # Create target labels
        data = self.create_target_labels(data)
        
        # Prepare features and target
        X, y = self.prepare_features_and_target(data)
        
        logger.info("Preprocessing pipeline completed")
        return X, y


if __name__ == '__main__':
    # Test the preprocessor
    preprocessor = DataPreprocessor()
    
    # Test with local file
    # X, y = preprocessor.process_full_pipeline('path/to/metrics.csv')
    
    # Test with S3
    # X, y = preprocessor.process_full_pipeline('s3')
    
    print("Preprocessor ready!")

