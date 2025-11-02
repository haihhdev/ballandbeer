"""
LSTM-CNN Hybrid Model for K8s Auto-scaling Prediction

This model combines:
- LSTM layers to capture temporal dependencies in metrics
- CNN layers to extract local patterns in time series
- Dense layers for final prediction

Focus on metrics-based patterns rather than time-based features.
"""

import pandas as pd
import numpy as np
import tensorflow as tf
import keras
from keras import layers, models, callbacks, optimizers
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import joblib
import logging
from pathlib import Path
import json
import matplotlib.pyplot as plt
import seaborn as sns
from typing import Dict, Tuple

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import config
from data_preprocessor import DataPreprocessor

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Set random seeds for reproducibility
np.random.seed(config.RANDOM_STATE)
tf.random.set_seed(config.RANDOM_STATE)


class LSTMCNNScalingModel:
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.sequence_length = config.LSTM_CNN_PARAMS['sequence_length']
        self.metrics = {}
        self.history = None
        self.feature_names = None
        
    def create_sequences(self, X: np.ndarray, y: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Create sequences for LSTM input
        
        Args:
            X: Feature array (n_samples, n_features)
            y: Target array (n_samples,)
            
        Returns:
            X_seq: Sequences (n_sequences, sequence_length, n_features)
            y_seq: Targets (n_sequences,)
        """
        X_seq, y_seq = [], []
        
        for i in range(len(X) - self.sequence_length + 1):
            X_seq.append(X[i:i + self.sequence_length])
            y_seq.append(y[i + self.sequence_length - 1])
        
        return np.array(X_seq), np.array(y_seq)
    
    def build_model(self, input_shape: Tuple) -> keras.Model:
        """
        Build LSTM-CNN hybrid architecture
        
        Architecture:
        1. CNN layers to extract local patterns
        2. LSTM layers to capture temporal dependencies
        3. Dense layers for final prediction
        """
        params = config.LSTM_CNN_PARAMS
        
        inputs = layers.Input(shape=input_shape, name='input')
        
        # Branch 1: CNN for local pattern extraction
        cnn = layers.Conv1D(
            filters=params['cnn_filters'],
            kernel_size=params['cnn_kernel_size'],
            activation='relu',
            padding='same',
            name='cnn_1'
        )(inputs)
        cnn = layers.BatchNormalization()(cnn)
        cnn = layers.Dropout(params['dropout_rate'])(cnn)
        
        cnn = layers.Conv1D(
            filters=params['cnn_filters'] * 2,
            kernel_size=params['cnn_kernel_size'],
            activation='relu',
            padding='same',
            name='cnn_2'
        )(cnn)
        cnn = layers.BatchNormalization()(cnn)
        cnn = layers.MaxPooling1D(pool_size=2)(cnn)
        cnn = layers.Dropout(params['dropout_rate'])(cnn)
        
        # Branch 2: LSTM for temporal dependencies
        lstm = layers.LSTM(
            params['lstm_units'],
            return_sequences=True,
            name='lstm_1'
        )(inputs)
        lstm = layers.BatchNormalization()(lstm)
        lstm = layers.Dropout(params['dropout_rate'])(lstm)
        
        lstm = layers.LSTM(
            params['lstm_units'] // 2,
            return_sequences=False,
            name='lstm_2'
        )(lstm)
        lstm = layers.BatchNormalization()(lstm)
        lstm = layers.Dropout(params['dropout_rate'])(lstm)
        
        # Flatten CNN output
        cnn_flat = layers.Flatten()(cnn)
        
        # Concatenate CNN and LSTM features
        merged = layers.Concatenate()([cnn_flat, lstm])
        
        # Dense layers for final prediction
        dense = layers.Dense(
            params['dense_units'],
            activation='relu',
            name='dense_1'
        )(merged)
        dense = layers.BatchNormalization()(dense)
        dense = layers.Dropout(params['dropout_rate'])(dense)
        
        dense = layers.Dense(
            params['dense_units'] // 2,
            activation='relu',
            name='dense_2'
        )(dense)
        dense = layers.Dropout(params['dropout_rate'] / 2)(dense)
        
        # Output layer (regression)
        outputs = layers.Dense(1, activation='linear', name='output')(dense)
        
        # Create model
        model = models.Model(inputs=inputs, outputs=outputs, name='LSTM_CNN_Scaling')
        
        # Compile model
        optimizer = optimizers.Adam(learning_rate=params['learning_rate'])
        model.compile(
            optimizer=optimizer,
            loss='huber',  # Robust to outliers
            metrics=['mae', 'mse']
        )
        
        return model
    
    def train(self, X_train: np.ndarray, y_train: np.ndarray,
              X_val: np.ndarray, y_val: np.ndarray) -> None:
        """Train the LSTM-CNN model"""
        logger.info("Training LSTM-CNN model...")
        logger.info(f"Training set size: {len(X_train)} samples")
        logger.info(f"Validation set size: {len(X_val)} samples")
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(
            X_train.reshape(-1, X_train.shape[-1])
        ).reshape(X_train.shape)
        
        X_val_scaled = self.scaler.transform(
            X_val.reshape(-1, X_val.shape[-1])
        ).reshape(X_val.shape)
        
        # Build model
        input_shape = (X_train.shape[1], X_train.shape[2])
        self.model = self.build_model(input_shape)
        
        logger.info("\nModel Architecture:")
        self.model.summary(print_fn=logger.info)
        
        # Callbacks
        early_stopping = callbacks.EarlyStopping(
            monitor='val_loss',
            patience=config.LSTM_CNN_PARAMS['early_stopping_patience'],
            restore_best_weights=True,
            verbose=1
        )
        
        reduce_lr = callbacks.ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=5,
            min_lr=1e-6,
            verbose=1
        )
        
        # Train model
        self.history = self.model.fit(
            X_train_scaled, y_train,
            validation_data=(X_val_scaled, y_val),
            epochs=config.LSTM_CNN_PARAMS['epochs'],
            batch_size=config.LSTM_CNN_PARAMS['batch_size'],
            callbacks=[early_stopping, reduce_lr],
            verbose=1
        )
        
        logger.info("Training completed!")
    
    def evaluate(self, X_test: np.ndarray, y_test: np.ndarray) -> Dict:
        """Evaluate model performance"""
        logger.info("Evaluating model performance...")
        
        # Scale features
        X_test_scaled = self.scaler.transform(
            X_test.reshape(-1, X_test.shape[-1])
        ).reshape(X_test.shape)
        
        # Predictions
        y_pred = self.model.predict(X_test_scaled, verbose=0).flatten()
        
        # Clip predictions to valid replica range [1, 10]
        y_pred_clipped = np.clip(np.round(y_pred), 1, 10)
        
        # Calculate metrics
        mse = mean_squared_error(y_test, y_pred)
        rmse = np.sqrt(mse)
        mae = mean_absolute_error(y_test, y_pred)
        r2 = r2_score(y_test, y_pred)
        
        # Accuracy for exact replica prediction
        accuracy = np.mean(y_pred_clipped == y_test)
        
        # Within-1 accuracy
        within_1_accuracy = np.mean(np.abs(y_pred_clipped - y_test) <= 1)
        
        self.metrics = {
            'mse': float(mse),
            'rmse': float(rmse),
            'mae': float(mae),
            'r2_score': float(r2),
            'exact_accuracy': float(accuracy),
            'within_1_accuracy': float(within_1_accuracy)
        }
        
        logger.info(f"Model Performance Metrics:")
        logger.info(f"  RMSE: {rmse:.4f}")
        logger.info(f"  MAE: {mae:.4f}")
        logger.info(f"  R² Score: {r2:.4f}")
        logger.info(f"  Exact Accuracy: {accuracy:.4f}")
        logger.info(f"  Within-1 Accuracy: {within_1_accuracy:.4f}")
        
        return self.metrics
    
    def plot_training_history(self, output_dir: Path) -> None:
        """Plot training history"""
        output_dir.mkdir(parents=True, exist_ok=True)
        
        fig, axes = plt.subplots(1, 2, figsize=(15, 5))
        
        # Loss
        axes[0].plot(self.history.history['loss'], label='Train Loss', linewidth=2)
        axes[0].plot(self.history.history['val_loss'], label='Val Loss', linewidth=2)
        axes[0].set_xlabel('Epoch', fontsize=12)
        axes[0].set_ylabel('Loss', fontsize=12)
        axes[0].set_title('LSTM-CNN: Training and Validation Loss', fontsize=14, fontweight='bold')
        axes[0].legend()
        axes[0].grid(True, alpha=0.3)
        
        # MAE
        axes[1].plot(self.history.history['mae'], label='Train MAE', linewidth=2)
        axes[1].plot(self.history.history['val_mae'], label='Val MAE', linewidth=2)
        axes[1].set_xlabel('Epoch', fontsize=12)
        axes[1].set_ylabel('MAE', fontsize=12)
        axes[1].set_title('LSTM-CNN: Training and Validation MAE', fontsize=14, fontweight='bold')
        axes[1].legend()
        axes[1].grid(True, alpha=0.3)
        
        plt.tight_layout()
        
        output_path = output_dir / 'lstm_cnn_training_history.png'
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        plt.close()
        
        logger.info(f"Training history plot saved to {output_path}")
    
    def plot_predictions(self, X_test: np.ndarray, y_test: np.ndarray,
                        output_dir: Path) -> None:
        """Plot prediction vs actual"""
        output_dir.mkdir(parents=True, exist_ok=True)
        
        X_test_scaled = self.scaler.transform(
            X_test.reshape(-1, X_test.shape[-1])
        ).reshape(X_test.shape)
        
        y_pred = self.model.predict(X_test_scaled, verbose=0).flatten()
        y_pred_clipped = np.clip(np.round(y_pred), 1, 10)
        
        fig, axes = plt.subplots(1, 2, figsize=(15, 6))
        
        # Scatter plot
        axes[0].scatter(y_test, y_pred_clipped, alpha=0.5, s=10)
        axes[0].plot([y_test.min(), y_test.max()],
                     [y_test.min(), y_test.max()],
                     'r--', lw=2, label='Perfect Prediction')
        axes[0].set_xlabel('Actual Replicas', fontsize=12)
        axes[0].set_ylabel('Predicted Replicas', fontsize=12)
        axes[0].set_title('LSTM-CNN: Predicted vs Actual Replicas', fontsize=14, fontweight='bold')
        axes[0].legend()
        axes[0].grid(True, alpha=0.3)
        
        # Distribution comparison
        bins = np.arange(0.5, 11.5, 1)
        axes[1].hist(y_test, bins=bins, alpha=0.5, label='Actual', color='blue', edgecolor='black')
        axes[1].hist(y_pred_clipped, bins=bins, alpha=0.5, label='Predicted', color='orange', edgecolor='black')
        axes[1].set_xlabel('Number of Replicas', fontsize=12)
        axes[1].set_ylabel('Frequency', fontsize=12)
        axes[1].set_title('Distribution of Actual vs Predicted Replicas', fontsize=14, fontweight='bold')
        axes[1].legend()
        axes[1].grid(True, alpha=0.3, axis='y')
        
        plt.tight_layout()
        
        output_path = output_dir / 'lstm_cnn_predictions.png'
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        plt.close()
        
        logger.info(f"Prediction plot saved to {output_path}")
    
    def save_model(self, output_dir: Path) -> None:
        """Save the trained model"""
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Save Keras model
        model_path = output_dir / 'lstm_cnn_model.keras'
        self.model.save(model_path)
        logger.info(f"Model saved to {model_path}")
        
        # Save scaler
        scaler_path = output_dir / 'lstm_cnn_scaler.joblib'
        joblib.dump(self.scaler, scaler_path)
        logger.info(f"Scaler saved to {scaler_path}")
        
        # Save metrics
        metrics_path = output_dir / 'lstm_cnn_metrics.json'
        with open(metrics_path, 'w') as f:
            json.dump(self.metrics, f, indent=2)
        logger.info(f"Metrics saved to {metrics_path}")
        
        # Save training history
        history_path = output_dir / 'lstm_cnn_history.json'
        history_dict = {k: [float(v) for v in vals] for k, vals in self.history.history.items()}
        with open(history_path, 'w') as f:
            json.dump(history_dict, f, indent=2)
        logger.info(f"Training history saved to {history_path}")
    
    def load_model(self, model_dir: Path) -> None:
        """Load a trained model"""
        model_path = model_dir / 'lstm_cnn_model.keras'
        scaler_path = model_dir / 'lstm_cnn_scaler.joblib'
        
        self.model = models.load_model(model_path)
        self.scaler = joblib.load(scaler_path)
        
        logger.info(f"Model loaded from {model_path}")
    
    def predict(self, X: np.ndarray) -> np.ndarray:
        """Make predictions"""
        X_scaled = self.scaler.transform(
            X.reshape(-1, X.shape[-1])
        ).reshape(X.shape)
        
        predictions = self.model.predict(X_scaled, verbose=0).flatten()
        # Clip and round to valid replica range
        return np.clip(np.round(predictions), 1, 10).astype(int)


def main():
    """Main training pipeline for LSTM-CNN model"""
    logger.info("=" * 80)
    logger.info("LSTM-CNN MODEL TRAINING FOR K8S AUTO-SCALING")
    logger.info("=" * 80)
    
    # Create output directories
    model_dir = Path(config.MODEL_OUTPUT_DIR)
    plots_dir = Path(config.PLOTS_OUTPUT_DIR)
    model_dir.mkdir(parents=True, exist_ok=True)
    plots_dir.mkdir(parents=True, exist_ok=True)
    
    # Load and preprocess data
    logger.info("\n[Step 1] Loading and preprocessing data...")
    preprocessor = DataPreprocessor()
    
    # Load from local metrics folder (default)
    # Or use 's3' to download from S3 bucket
    try:
        X, y = preprocessor.process_full_pipeline('local')
    except Exception as e:
        logger.error(f"Error loading data: {e}")
        logger.info("Make sure CSV files exist in metrics/ folder")
        logger.info("Run: cd training && ./download_data.sh")
        raise
    
    # Convert to numpy arrays
    X_array = X.values
    y_array = y.values
    
    # Split data (temporal split - no shuffling for time series)
    logger.info("\n[Step 2] Splitting data...")
    split_idx = int(len(X_array) * (1 - config.TEST_SIZE))
    X_train_val = X_array[:split_idx]
    y_train_val = y_array[:split_idx]
    X_test_temp = X_array[split_idx:]
    y_test_temp = y_array[split_idx:]
    
    # Further split train into train and validation
    val_split_idx = int(len(X_train_val) * (1 - config.VALIDATION_SPLIT))
    X_train_temp = X_train_val[:val_split_idx]
    y_train_temp = y_train_val[:val_split_idx]
    X_val_temp = X_train_val[val_split_idx:]
    y_val_temp = y_train_val[val_split_idx:]
    
    # Initialize model
    lstm_cnn_model = LSTMCNNScalingModel()
    
    # Create sequences
    logger.info("\n[Step 3] Creating sequences for LSTM...")
    X_train, y_train = lstm_cnn_model.create_sequences(X_train_temp, y_train_temp)
    X_val, y_val = lstm_cnn_model.create_sequences(X_val_temp, y_val_temp)
    X_test, y_test = lstm_cnn_model.create_sequences(X_test_temp, y_test_temp)
    
    logger.info(f"Training sequences: {X_train.shape}")
    logger.info(f"Validation sequences: {X_val.shape}")
    logger.info(f"Test sequences: {X_test.shape}")
    
    # Train model
    logger.info("\n[Step 4] Training LSTM-CNN model...")
    lstm_cnn_model.train(X_train, y_train, X_val, y_val)
    
    # Evaluate on test set
    logger.info("\n[Step 5] Evaluating on test set...")
    test_metrics = lstm_cnn_model.evaluate(X_test, y_test)
    
    # Generate plots
    logger.info("\n[Step 6] Generating visualizations...")
    lstm_cnn_model.plot_training_history(plots_dir)
    lstm_cnn_model.plot_predictions(X_test, y_test, plots_dir)
    
    # Save model
    logger.info("\n[Step 7] Saving model...")
    lstm_cnn_model.save_model(model_dir)
    
    logger.info("\n" + "=" * 80)
    logger.info("TRAINING COMPLETED SUCCESSFULLY!")
    logger.info("=" * 80)
    logger.info(f"\nModel saved to: {model_dir}")
    logger.info(f"Plots saved to: {plots_dir}")
    logger.info(f"\nFinal Test Metrics:")
    for metric, value in test_metrics.items():
        logger.info(f"  {metric}: {value:.4f}")


if __name__ == '__main__':
    main()

