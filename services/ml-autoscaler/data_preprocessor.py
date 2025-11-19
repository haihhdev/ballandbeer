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
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler
import joblib
import config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DataPreprocessor:
    def __init__(self):
        self.s3_client = boto3.client('s3', region_name=config.AWS_REGION)
        self.pca = None
        self.scaler = None
        
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
    
    def clean_data(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Clean data by removing invalid and erroneous data points
        
        Issues to fix:
        1. CPU/RAM usage > 100% (calculation errors)
        2. replica_count = 0 but has active metrics (CPU/RAM/requests)
        3. Zero resource limits
        4. High pod restart counts (unstable services)
        5. Incident periods (extreme error rates)
        6. Services with all-zero metrics (collector errors)
        7. Response time outliers (timeout values)
        """
        df = data.copy()
        initial_count = len(df)
        
        logger.info(f"Starting data cleaning. Initial rows: {initial_count}")
        
        # Rule 0: Cap CPU/RAM usage at 100% (fix calculation errors)
        cpu_over_100 = (df['cpu_usage_percent'] > 100).sum()
        ram_over_100 = (df['ram_usage_percent'] > 100).sum()
        
        if cpu_over_100 > 0:
            logger.warning(f"Found {cpu_over_100} rows with CPU >100%, capping at 100%")
            df.loc[df['cpu_usage_percent'] > 100, 'cpu_usage_percent'] = 100.0
        
        if ram_over_100 > 0:
            logger.warning(f"Found {ram_over_100} rows with RAM >100% (max: {df['ram_usage_percent'].max():.2f}%), capping at 100%")
            df.loc[df['ram_usage_percent'] > 100, 'ram_usage_percent'] = 100.0
        
        # Cap response time at 10000ms (timeout values)
        resp_outliers = (df['response_time_ms'] > 10000).sum()
        if resp_outliers > 0:
            logger.warning(f"Found {resp_outliers} rows with response time >10s, capping at 10000ms")
            df.loc[df['response_time_ms'] > 10000, 'response_time_ms'] = 10000.0
        
        # Rule 1: Remove replica_count=0 with active metrics (data inconsistency)
        invalid_mask = (
            (df['replica_count'] == 0) & 
            (
                (df['cpu_usage_percent'] > 0) | 
                (df['ram_usage_percent'] > 0) |
                (df['request_count_per_second'] > 0) |
                (df['response_time_ms'] > 0)
            )
        )
        removed_invalid = invalid_mask.sum()
        df = df[~invalid_mask].reset_index(drop=True)
        logger.info(f"Removed {removed_invalid} rows with replica_count=0 but active metrics")
        
        # Rule 2: Handle zero resource limits
        # Fill with service-specific medians (better than removing)
        zero_resources_mask = (
            (df['cpu_request'] == 0) & 
            (df['cpu_limit'] == 0) & 
            (df['ram_request'] == 0) & 
            (df['ram_limit'] == 0)
        )
        
        if zero_resources_mask.sum() > 0:
            logger.info(f"Found {zero_resources_mask.sum()} rows with zero resource limits")
            
            # Calculate service-specific medians
            for service in config.SERVICES:
                service_mask = (df['service_name'] == service) & (~zero_resources_mask)
                
                if service_mask.sum() > 0:
                    # Get medians from valid rows
                    cpu_request_median = df.loc[service_mask, 'cpu_request'].median()
                    cpu_limit_median = df.loc[service_mask, 'cpu_limit'].median()
                    ram_request_median = df.loc[service_mask, 'ram_request'].median()
                    ram_limit_median = df.loc[service_mask, 'ram_limit'].median()
                    
                    # Fill zeros for this service
                    service_zero_mask = (df['service_name'] == service) & zero_resources_mask
                    df.loc[service_zero_mask, 'cpu_request'] = cpu_request_median
                    df.loc[service_zero_mask, 'cpu_limit'] = cpu_limit_median
                    df.loc[service_zero_mask, 'ram_request'] = ram_request_median
                    df.loc[service_zero_mask, 'ram_limit'] = ram_limit_median
                    
                    if service_zero_mask.sum() > 0:
                        logger.info(f"  Filled {service_zero_mask.sum()} zero resource rows for {service}")
        
        # Rule 3: Flag (not remove) high restart counts - add as feature
        df['is_unstable'] = (df['pod_restart_count'] > 3).astype(int)
        high_restart_count = df['is_unstable'].sum()
        if high_restart_count > 0:
            logger.info(f"Flagged {high_restart_count} rows with high restart count (will be used as feature)")
        
        # Rule 4: Flag incident periods (extreme error rates)
        df['is_incident'] = (df['error_rate'] > 30.0).astype(int)
        incident_count = df['is_incident'].sum()
        if incident_count > 0:
            logger.info(f"Flagged {incident_count} rows as incident periods (will be used as feature)")
        
        # Rule 5: Remove rows where service has all-zero metrics (collector error)
        null_metrics_mask = (
            (df['cpu_usage_percent'] == 0) &
            (df['ram_usage_percent'] == 0) &
            (df['request_count_per_second'] == 0) &
            (df['response_time_ms'] == 0) &
            (df['replica_count'] > 0)  # Should have replicas running
        )
        removed_null = null_metrics_mask.sum()
        df = df[~null_metrics_mask].reset_index(drop=True)
        logger.info(f"Removed {removed_null} rows with all-zero metrics (collector errors)")
        
        final_count = len(df)
        removed_total = initial_count - final_count
        removed_pct = (removed_total / initial_count) * 100
        
        logger.info(f"Data cleaning completed:")
        logger.info(f"  Initial rows: {initial_count}")
        logger.info(f"  Final rows: {final_count}")
        logger.info(f"  Removed: {removed_total} ({removed_pct:.2f}%)")
        logger.info(f"  Data quality: {(final_count/initial_count)*100:.2f}%")
        
        # Check replica count distribution
        unique_replicas = sorted(df['replica_count'].unique())
        logger.info(f"  Unique replica counts: {unique_replicas}")
        
        if max(unique_replicas) <= 1:
            logger.warning("="*60)
            logger.warning("WARNING: Dataset only has replica_count of 0 or 1")
            logger.warning("No scaling data (2+ replicas) found in dataset!")
            logger.warning("Model will not learn proper scaling decisions")
            logger.warning("Recommendation: Collect data during high-load periods")
            logger.warning("="*60)
        
        return df
    
    def engineer_features(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Engineer features from raw metrics
        Focus on metrics-based features rather than time-based
        """
        df = data.copy()
        
        # Convert timestamp to datetime (use ISO8601 for flexible parsing)
        df['timestamp'] = pd.to_datetime(df['timestamp'], format='ISO8601')
        
        # Sort by service and timestamp
        df = df.sort_values(['service_name', 'timestamp']).reset_index(drop=True)
        
        # Normalize resource limit/request values (likely in bytes/millicores)
        # Convert to more reasonable scales to prevent extreme values
        df['cpu_request'] = np.clip(df['cpu_request'] / 1000, 0, 100)  # millicores to cores, cap at 100
        df['cpu_limit'] = np.clip(df['cpu_limit'] / 1000, 0, 100)      # millicores to cores, cap at 100
        df['ram_request'] = np.clip(df['ram_request'] / (1024**3), 0, 100)  # bytes to GB, cap at 100
        df['ram_limit'] = np.clip(df['ram_limit'] / (1024**3), 0, 100)      # bytes to GB, cap at 100
        
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
                5
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
            'cpu_utilization_ratio', 'ram_utilization_ratio',
            'cpu_change_rate', 'ram_change_rate', 'request_change_rate',
            'cpu_rolling_std', 'ram_rolling_std',
            'request_rolling_max', 'response_time_rolling_p95',
            'cpu_per_replica', 'ram_per_replica', 'requests_per_replica',
            'system_pressure',
            'is_unstable',
            'is_incident'
        ]
        
        all_features.extend(engineered_features)
        
        # One-hot encode service names
        service_dummies = pd.get_dummies(data['service_name'], prefix='service')
        
        # Combine features
        X = pd.concat([
            data[all_features],
            service_dummies
        ], axis=1)
        
        # Remove constant or near-constant features (std < 0.01)
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
    
    def load_local_folder(self, folder_path: str = 'metrics') -> pd.DataFrame:
        """Load and concatenate all CSV files from local folder"""
        from pathlib import Path
        
        folder = Path(folder_path)
        
        # If running from training/ subdirectory, go up one level
        if not folder.exists() and Path.cwd().name == 'training':
            folder = Path('..') / folder_path
        
        if not folder.exists():
            raise ValueError(f"Folder {folder_path} does not exist (looked in {folder.absolute()})")
        
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
    
    def fit_pca_transform(self, X: pd.DataFrame) -> pd.DataFrame:
        """
        Fit PCA and transform features
        
        Args:
            X: Feature dataframe
            
        Returns:
            Transformed features with PCA
        """
        logger.info("Fitting PCA for dimensionality reduction...")
        
        # Initialize scaler and PCA
        self.scaler = StandardScaler()
        self.pca = PCA(**config.PCA_PARAMS)
        
        # Scale features first
        X_scaled = self.scaler.fit_transform(X)
        
        # Apply PCA
        X_pca = self.pca.fit_transform(X_scaled)
        
        # Convert back to DataFrame
        pca_columns = [f'pca_{i}' for i in range(X_pca.shape[1])]
        X_pca_df = pd.DataFrame(X_pca, columns=pca_columns, index=X.index)
        
        # Log PCA results
        explained_variance = self.pca.explained_variance_ratio_
        cumulative_variance = np.cumsum(explained_variance)
        
        logger.info(f"PCA reduced dimensions from {X.shape[1]} to {X_pca.shape[1]}")
        logger.info(f"Total variance explained: {cumulative_variance[-1]:.4f}")
        logger.info(f"Top 5 components explain: {cumulative_variance[min(4, len(cumulative_variance)-1)]:.4f} of variance")
        
        return X_pca_df
    
    def transform_pca(self, X: pd.DataFrame) -> pd.DataFrame:
        """
        Transform features using fitted PCA
        
        Args:
            X: Feature dataframe
            
        Returns:
            Transformed features with PCA
        """
        if self.pca is None or self.scaler is None:
            raise ValueError("PCA not fitted. Call fit_pca_transform first.")
        
        # Scale and transform
        X_scaled = self.scaler.transform(X)
        X_pca = self.pca.transform(X_scaled)
        
        # Convert back to DataFrame
        pca_columns = [f'pca_{i}' for i in range(X_pca.shape[1])]
        X_pca_df = pd.DataFrame(X_pca, columns=pca_columns, index=X.index)
        
        return X_pca_df
    
    def save_pca(self, output_dir: str) -> None:
        """Save fitted PCA and scaler"""
        if self.pca is None or self.scaler is None:
            logger.warning("PCA or scaler not fitted, nothing to save")
            return
        
        from pathlib import Path
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        pca_path = output_path / 'preprocessor_pca.joblib'
        scaler_path = output_path / 'preprocessor_scaler.joblib'
        
        joblib.dump(self.pca, pca_path)
        joblib.dump(self.scaler, scaler_path)
        
        logger.info(f"PCA saved to {pca_path}")
        logger.info(f"Scaler saved to {scaler_path}")
    
    def load_pca(self, model_dir: str) -> None:
        """Load fitted PCA and scaler"""
        from pathlib import Path
        model_path = Path(model_dir)
        
        pca_path = model_path / 'preprocessor_pca.joblib'
        scaler_path = model_path / 'preprocessor_scaler.joblib'
        
        if pca_path.exists() and scaler_path.exists():
            self.pca = joblib.load(pca_path)
            self.scaler = joblib.load(scaler_path)
            logger.info("PCA and scaler loaded successfully")
        else:
            logger.warning("PCA or scaler files not found")
    
    def process_full_pipeline(self, data_source: str = 'local', 
                            apply_pca: bool = False) -> Tuple[pd.DataFrame, pd.Series]:
        """
        Run full preprocessing pipeline
        
        Args:
            data_source: 'local' (default, load from metrics/ folder), 
                        's3' (download from S3), 
                        or path to specific CSV file
            apply_pca: Whether to apply PCA for dimensionality reduction
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
        
        # Clean data (NEW: remove invalid/erroneous data points)
        data = self.clean_data(data)
        
        # Engineer features
        data = self.engineer_features(data)
        
        # Create target labels
        data = self.create_target_labels(data)
        
        # Prepare features and target
        X, y = self.prepare_features_and_target(data)
        
        # Apply PCA if requested
        if apply_pca:
            X = self.fit_pca_transform(X)
        
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

