"""
Data preprocessing and feature engineering for K8s auto-scaling ML model

Optimized with best practices from research papers:
- RobustScaler for outlier handling (RF autoscaler paper)
- Enhanced time-based features: cyclical encoding, lag features
- Spike detection and burst indicators
- Proper handling of non-stationary time series
- Windowing aligned with time series best practices
"""

import pandas as pd
import numpy as np
from datetime import datetime
import boto3
from typing import List, Tuple, Optional
import logging
from pathlib import Path
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler, RobustScaler
import joblib
import config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DataPreprocessor:
    def __init__(self, use_robust_scaler=True):
        """
        Args:
            use_robust_scaler: Use RobustScaler (median/IQR) instead of StandardScaler.
                              More resilient to outliers (RF autoscaler paper).
        """
        self.s3_client = boto3.client('s3', region_name=config.AWS_REGION)
        self.pca = None
        self.scaler = RobustScaler() if use_robust_scaler else StandardScaler()
        self.use_robust_scaler = use_robust_scaler
        
    def download_data_from_s3(self, start_date: Optional[str] = None, 
                               end_date: Optional[str] = None) -> pd.DataFrame:
        """Download metrics data from S3"""
        logger.info(f"Downloading data from S3 bucket: {config.S3_BUCKET}")
        
        response = self.s3_client.list_objects_v2(
            Bucket=config.S3_BUCKET,
            Prefix=config.S3_PREFIX
        )
        
        if 'Contents' not in response:
            raise ValueError(f"No data found in S3 bucket {config.S3_BUCKET}")
        
        csv_files = [obj['Key'] for obj in response['Contents'] if obj['Key'].endswith('.csv')]
        logger.info(f"Found {len(csv_files)} CSV files in S3")
        
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
        
        data = pd.concat(dfs, ignore_index=True)
        logger.info(f"Total data loaded: {len(data)} rows")
        
        return data
    
    def load_local_data(self, file_path: str) -> pd.DataFrame:
        """Load data from local CSV file"""
        logger.info(f"Loading data from local file: {file_path}")
        data = pd.read_csv(file_path)
        logger.info(f"Loaded {len(data)} rows")
        return data
    
    def load_local_folder(self, folder_path: str = 'metrics') -> pd.DataFrame:
        """Load and concatenate all CSV files from a local folder"""
        folder = Path(folder_path)
        if not folder.exists():
            raise ValueError(f"Folder {folder_path} does not exist")
        
        csv_files = sorted(folder.glob('*.csv'))
        logger.info(f"Loading data from folder: {folder_path}")
        logger.info(f"Found {len(csv_files)} CSV files")
        
        dfs = []
        for csv_file in csv_files:
            try:
                df = pd.read_csv(csv_file)
                dfs.append(df)
                logger.info(f"Loaded: {csv_file.name} ({len(df)} rows)")
            except Exception as e:
                logger.error(f"Error loading {csv_file}: {e}")
        
        if not dfs:
            raise ValueError(f"No data could be loaded from {folder_path}")
        
        data = pd.concat(dfs, ignore_index=True)
        logger.info(f"Total data loaded: {len(data)} rows")
        
        return data
    
    def clean_data(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Clean data using robust outlier handling (Winsorization)
        Based on RF autoscaler paper - preserve zeros, handle outliers carefully
        """
        df = data.copy()
        initial_count = len(df)
        
        logger.info(f"Starting data cleaning. Initial rows: {initial_count}")
        
        # Winsorize CPU/RAM at 99th percentile (instead of hard capping at 100)
        for col in ['cpu_usage_percent', 'ram_usage_percent']:
            p99 = df[col].quantile(0.99)
            outliers = (df[col] > p99).sum()
            if outliers > 0:
                logger.info(f"Winsorizing {col}: {outliers} values > p99 ({p99:.1f})")
                df.loc[df[col] > p99, col] = p99
        
        # Winsorize response time at 95th percentile
        rt_p95 = df['response_time_ms'].quantile(0.95)
        rt_outliers = (df['response_time_ms'] > rt_p95).sum()
        if rt_outliers > 0:
            logger.info(f"Winsorizing response_time_ms: {rt_outliers} values > p95 ({rt_p95:.0f}ms)")
            df.loc[df['response_time_ms'] > rt_p95, 'response_time_ms'] = rt_p95
        
        # Remove data inconsistencies (replica=0 with active metrics)
        invalid_mask = (
            (df['replica_count'] == 0) & 
            (
                (df['cpu_usage_percent'] > 0) | 
                (df['ram_usage_percent'] > 0) |
                (df['request_count_per_second'] > 0)
            )
        )
        removed_invalid = invalid_mask.sum()
        df = df[~invalid_mask].reset_index(drop=True)
        logger.info(f"Removed {removed_invalid} rows with replica_count=0 but active metrics")
        
        # Remove all-zero metrics (collector errors)
        zero_metrics_mask = (
            (df['cpu_usage_percent'] == 0) &
            (df['ram_usage_percent'] == 0) &
            (df['request_count_per_second'] == 0) &
            (df['response_time_ms'] == 0) &
            (df['replica_count'] > 0)
        )
        removed_zeros = zero_metrics_mask.sum()
        if removed_zeros > 0:
            df = df[~zero_metrics_mask].reset_index(drop=True)
            logger.info(f"Removed {removed_zeros} rows with all-zero metrics (collector errors)")
        
        final_count = len(df)
        logger.info("Data cleaning completed:")
        logger.info(f"  Initial rows: {initial_count}")
        logger.info(f"  Final rows: {final_count}")
        logger.info(f"  Removed: {initial_count - final_count} ({(initial_count - final_count)/initial_count*100:.2f}%)")
        logger.info(f"  Data quality: {(final_count/initial_count)*100:.2f}%")
        logger.info(f"  Unique replica counts: {sorted(df['replica_count'].unique())}")
        
        return df
    
    def engineer_features(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Enhanced feature engineering based on research papers:
        1. Cyclical time encoding (hour, day of week)
        2. Lag features (t-1, t-5, t-10)
        3. Spike/burst detection
        4. Rolling statistics (mean, std, p95)
        5. Trend indicators (acceleration, deceleration)
        """
        df = data.copy()
        
        # Parse timestamp
        df['timestamp'] = pd.to_datetime(df['timestamp'], format='ISO8601')
        df = df.sort_values(['service_name', 'timestamp']).reset_index(drop=True)
        
        # Cyclical time encoding (sin/cos for smooth periodicity)
        df['hour'] = df['timestamp'].dt.hour
        df['day_of_week'] = df['timestamp'].dt.dayofweek
        df['hour_sin'] = np.sin(2 * np.pi * df['hour'] / 24)
        df['hour_cos'] = np.cos(2 * np.pi * df['hour'] / 24)
        df['dow_sin'] = np.sin(2 * np.pi * df['day_of_week'] / 7)
        df['dow_cos'] = np.cos(2 * np.pi * df['day_of_week'] / 7)
        
        # Normalize resource limits (millicores/bytes to cores/GB)
        df['cpu_request'] = np.clip(df['cpu_request'] / 1000, 0, 100)
        df['cpu_limit'] = np.clip(df['cpu_limit'] / 1000, 0, 100)
        df['ram_request'] = np.clip(df['ram_request'] / (1024**3), 0, 100)
        df['ram_limit'] = np.clip(df['ram_limit'] / (1024**3), 0, 100)
        
        # Per-service feature engineering
        for service in config.SERVICES:
            service_mask = df['service_name'] == service
            service_df = df[service_mask].copy()
            
            if len(service_df) < 2:
                continue
            
            # Resource utilization ratios
            df.loc[service_mask, 'cpu_utilization_ratio'] = (
                service_df['cpu_usage_percent'] / (service_df['cpu_limit'] + 1e-6)
            )
            df.loc[service_mask, 'ram_utilization_ratio'] = (
                service_df['ram_usage_percent'] / (service_df['ram_limit'] + 1e-6)
            )
            
            # Lag features (t-1, t-5, t-10 for capturing recent history)
            for lag in [1, 5, 10]:
                df.loc[service_mask, f'cpu_lag_{lag}'] = service_df['cpu_usage_percent'].shift(lag)
                df.loc[service_mask, f'ram_lag_{lag}'] = service_df['ram_usage_percent'].shift(lag)
                df.loc[service_mask, f'rps_lag_{lag}'] = service_df['request_count_per_second'].shift(lag)
            
            # Rate of change (first derivative)
            df.loc[service_mask, 'cpu_change_rate'] = service_df['cpu_usage_percent'].diff()
            df.loc[service_mask, 'ram_change_rate'] = service_df['ram_usage_percent'].diff()
            df.loc[service_mask, 'request_change_rate'] = service_df['request_count_per_second'].diff()
            
            # Acceleration (second derivative - trend change detection)
            df.loc[service_mask, 'cpu_acceleration'] = service_df['cpu_usage_percent'].diff().diff()
            df.loc[service_mask, 'rps_acceleration'] = service_df['request_count_per_second'].diff().diff()
            
            # Rolling statistics (10 samples = 5 minutes window)
            window_size = 10
            
            # Rolling mean for smoothing
            df.loc[service_mask, 'cpu_rolling_mean'] = (
                service_df['cpu_usage_percent'].rolling(window=window_size, min_periods=1).mean()
            )
            df.loc[service_mask, 'ram_rolling_mean'] = (
                service_df['ram_usage_percent'].rolling(window=window_size, min_periods=1).mean()
            )
            df.loc[service_mask, 'rps_rolling_mean'] = (
                service_df['request_count_per_second'].rolling(window=window_size, min_periods=1).mean()
            )
            
            # Rolling std for volatility detection
            df.loc[service_mask, 'cpu_rolling_std'] = (
                service_df['cpu_usage_percent'].rolling(window=window_size, min_periods=1).std()
            )
            df.loc[service_mask, 'ram_rolling_std'] = (
                service_df['ram_usage_percent'].rolling(window=window_size, min_periods=1).std()
            )
            df.loc[service_mask, 'rps_rolling_std'] = (
                service_df['request_count_per_second'].rolling(window=window_size, min_periods=1).std()
            )
            
            # Rolling max/p95 for peak detection
            df.loc[service_mask, 'request_rolling_max'] = (
                service_df['request_count_per_second'].rolling(window=window_size, min_periods=1).max()
            )
            df.loc[service_mask, 'response_time_rolling_p95'] = (
                service_df['response_time_ms'].rolling(window=window_size, min_periods=1).quantile(0.95)
            )
            
            # Spike/burst detection (values exceeding 1.5*std)
            cpu_mean = service_df['cpu_usage_percent'].rolling(window=window_size, min_periods=1).mean()
            cpu_std = service_df['cpu_usage_percent'].rolling(window=window_size, min_periods=1).std()
            df.loc[service_mask, 'cpu_spike_flag'] = (
                (service_df['cpu_usage_percent'] - cpu_mean) > 1.5 * cpu_std
            ).astype(int)
            
            rps_mean = service_df['request_count_per_second'].rolling(window=window_size, min_periods=1).mean()
            rps_std = service_df['request_count_per_second'].rolling(window=window_size, min_periods=1).std()
            df.loc[service_mask, 'rps_spike_flag'] = (
                (service_df['request_count_per_second'] - rps_mean) > 1.5 * rps_std
            ).astype(int)
            
            # System pressure indicator (combined thresholds)
            df.loc[service_mask, 'system_pressure'] = (
                (service_df['cpu_usage_percent'] > 70).astype(int) +
                (service_df['ram_usage_percent'] > 75).astype(int) +
                (service_df['response_time_ms'] > 500).astype(int) +
                (service_df['error_rate'] > 0.05).astype(int)
            )
        
        # Fill NaN (from lag/diff operations) with 0
        df = df.fillna(0)
        
        logger.info(f"Feature engineering completed. New shape: {df.shape}")
        return df
    
    def create_target_labels(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Create target labels - use actual replica_count
        (No future lookahead to avoid data leakage)
        """
        df = data.copy()
        df['target_replicas'] = df['replica_count'].astype(int)
        logger.info("Target labels created")
        return df
    
    def prepare_features_and_target(self, data: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series]:
        """Prepare final feature matrix and target variable"""
        
        # Select base features
        all_features = config.FEATURE_COLUMNS.copy()
        
        # Add engineered features
        engineered_features = [
            # Time encoding
            'hour_sin', 'hour_cos', 'dow_sin', 'dow_cos',
            # Utilization
            'cpu_utilization_ratio', 'ram_utilization_ratio',
            # Lag features
            'cpu_lag_1', 'cpu_lag_5', 'cpu_lag_10',
            'ram_lag_1', 'ram_lag_5', 'ram_lag_10',
            'rps_lag_1', 'rps_lag_5', 'rps_lag_10',
            # Rate of change
            'cpu_change_rate', 'ram_change_rate', 'request_change_rate',
            # Acceleration
            'cpu_acceleration', 'rps_acceleration',
            # Rolling statistics
            'cpu_rolling_mean', 'ram_rolling_mean', 'rps_rolling_mean',
            'cpu_rolling_std', 'ram_rolling_std', 'rps_rolling_std',
            'request_rolling_max', 'response_time_rolling_p95',
            # Spike detection
            'cpu_spike_flag', 'rps_spike_flag',
            # Pressure
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
        
        # Remove constant or near-constant features
        constant_features = []
        for col in X.columns:
            if X[col].std() < 0.01:
                constant_features.append(col)
        
        if constant_features:
            logger.info(f"Removing {len(constant_features)} constant features: {constant_features}")
            X = X.drop(columns=constant_features)
        
        # Target variable
        y = data['target_replicas']
        
        logger.info(f"Feature matrix shape: {X.shape}")
        logger.info(f"Target shape: {y.shape}")
        logger.info(f"Features: {list(X.columns)}")
        
        return X, y
