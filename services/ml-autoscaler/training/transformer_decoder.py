"""
Transformer Decoder-Only Model with PCA for K8s Auto-scaling

GPT-style architecture with causal attention for time series forecasting.
Predicts optimal replica count 10 minutes ahead.
"""

import pandas as pd
import numpy as np
import tensorflow as tf
import keras
from keras import layers, models, callbacks, optimizers
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
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

sys.path.insert(0, str(Path(__file__).parent.parent))

import config
from data_preprocessor import DataPreprocessor

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

np.random.seed(config.RANDOM_STATE)
tf.random.set_seed(config.RANDOM_STATE)


class GetItem(layers.Layer):
    """Get specific timestep from sequence"""
    def __init__(self, index=-1, **kwargs):
        super(GetItem, self).__init__(**kwargs)
        self.index = index
    
    def get_config(self):
        config_dict = super().get_config()
        config_dict.update({'index': self.index})
        return config_dict
    
    def call(self, inputs):
        if self.index == -1:
            return inputs[:, -1, :]
        else:
            return tf.gather(inputs, self.index, axis=1)


class PositionalEncoding(layers.Layer):
    """Positional encoding for transformer"""
    def __init__(self, sequence_length, d_model):
        super(PositionalEncoding, self).__init__()
        self.pos_encoding = self.positional_encoding(sequence_length, d_model)
    
    def get_angles(self, position, i, d_model):
        angles = 1 / tf.pow(10000.0, (2 * (i // 2)) / tf.cast(d_model, tf.float32))
        return position * angles
    
    def positional_encoding(self, sequence_length, d_model):
        angle_rads = self.get_angles(
            position=tf.range(sequence_length, dtype=tf.float32)[:, tf.newaxis],
            i=tf.range(d_model, dtype=tf.float32)[tf.newaxis, :],
            d_model=d_model
        )
        
        sines = tf.sin(angle_rads[:, 0::2])
        cosines = tf.cos(angle_rads[:, 1::2])
        
        pos_encoding = tf.concat([sines, cosines], axis=-1)
        pos_encoding = pos_encoding[tf.newaxis, ...]
        
        return tf.cast(pos_encoding, tf.float32)
    
    def call(self, inputs):
        return inputs + self.pos_encoding[:, :tf.shape(inputs)[1], :]


class TransformerDecoderBlock(layers.Layer):
    """Decoder block with causal attention (GPT-style)"""
    def __init__(self, d_model, num_heads, dff, dropout_rate=0.1):
        super(TransformerDecoderBlock, self).__init__()
        
        self.causal_attention = layers.MultiHeadAttention(
            num_heads=num_heads,
            key_dim=d_model // num_heads,
            dropout=dropout_rate
        )
        
        self.ffn = keras.Sequential([
            layers.Dense(dff, activation='gelu'),
            layers.Dropout(dropout_rate),
            layers.Dense(d_model)
        ])
        
        self.layernorm1 = layers.LayerNormalization(epsilon=1e-6)
        self.layernorm2 = layers.LayerNormalization(epsilon=1e-6)
        
        self.dropout1 = layers.Dropout(dropout_rate)
        self.dropout2 = layers.Dropout(dropout_rate)
    
    def get_causal_mask(self, sequence_length):
        """Lower triangular mask - prevent attending to future"""
        mask = tf.linalg.band_part(tf.ones((sequence_length, sequence_length)), -1, 0)
        return mask
    
    def call(self, inputs, training=False):
        seq_length = tf.shape(inputs)[1]
        causal_mask = self.get_causal_mask(seq_length)
        
        attn_output = self.causal_attention(
            query=inputs,
            key=inputs,
            value=inputs,
            attention_mask=causal_mask,
            training=training
        )
        attn_output = self.dropout1(attn_output, training=training)
        out1 = self.layernorm1(inputs + attn_output)
        
        ffn_output = self.ffn(out1, training=training)
        ffn_output = self.dropout2(ffn_output, training=training)
        out2 = self.layernorm2(out1 + ffn_output)
        
        return out2


class TransformerDecoderModel:
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.pca = None
        self.pca_scaler = None
        self.sequence_length = config.TRANSFORMER_PARAMS['sequence_length']
        self.metrics = {}
        self.history = None
        self.feature_names = None
        self.n_pca_components = None
        
    def apply_pca(self, X_train: np.ndarray, X_val: np.ndarray, 
                   X_test: np.ndarray) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Apply PCA dimensionality reduction with proper scaling"""
        logger.info("Applying PCA...")
        
        # Scale features BEFORE PCA (critical for PCA performance)
        self.pca_scaler = StandardScaler()
        X_train_scaled = self.pca_scaler.fit_transform(X_train)
        X_val_scaled = self.pca_scaler.transform(X_val)
        X_test_scaled = self.pca_scaler.transform(X_test)
        
        # Apply PCA to scaled data
        self.pca = PCA(**config.PCA_PARAMS)
        
        X_train_pca = self.pca.fit_transform(X_train_scaled)
        X_val_pca = self.pca.transform(X_val_scaled)
        X_test_pca = self.pca.transform(X_test_scaled)
        
        self.n_pca_components = X_train_pca.shape[1]
        
        explained_variance = self.pca.explained_variance_ratio_
        cumulative_variance = np.cumsum(explained_variance)
        
        logger.info(f"PCA: {X_train.shape[1]} -> {self.n_pca_components} dims")
        logger.info(f"Variance explained: {cumulative_variance[-1]:.4f}")
        logger.info(f"Top 5 components variance: {explained_variance[:5]}")
        
        return X_train_pca, X_val_pca, X_test_pca
        
    def create_sequences(self, X: np.ndarray, y: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """Create sequences for transformer with lookahead prediction"""
        lookahead = config.TRANSFORMER_PARAMS.get('lookahead', 0)
        X_seq, y_seq = [], []
        
        # Need enough data: sequence_length for input + lookahead for target
        for i in range(len(X) - self.sequence_length - lookahead + 1):
            X_seq.append(X[i:i + self.sequence_length])
            # Predict value at sequence_length + lookahead - 1
            target_idx = i + self.sequence_length + lookahead - 1
            y_seq.append(y[target_idx])
        
        logger.info(f"Created sequences with lookahead={lookahead} steps (~{lookahead*0.5:.1f} min)")
        return np.array(X_seq), np.array(y_seq)
    
    def build_model(self, input_shape: Tuple) -> keras.Model:
        """Build transformer decoder model"""
        params = config.TRANSFORMER_PARAMS
        sequence_length, n_features = input_shape
        
        inputs = layers.Input(shape=input_shape, name='input')
        
        # Project to d_model
        x = layers.Dense(params['d_model'], name='projection')(inputs)
        
        # Add positional encoding
        x = PositionalEncoding(sequence_length, params['d_model'])(x)
        x = layers.Dropout(params['dropout_rate'])(x)
        
        # Stack decoder blocks
        for i in range(params['num_layers']):
            x = TransformerDecoderBlock(
                d_model=params['d_model'],
                num_heads=params['num_heads'],
                dff=params['dff'],
                dropout_rate=params['dropout_rate']
            )(x)
        
        # Take last timestep (autoregressive) using GetItem layer for proper serialization
        x = GetItem(index=-1, name='get_item')(x)
        
        # Prediction head
        x = layers.Dense(256, activation='gelu')(x)
        x = layers.LayerNormalization()(x)
        x = layers.Dropout(params['dropout_rate'])(x)
        
        x = layers.Dense(128, activation='gelu')(x)
        x = layers.LayerNormalization()(x)
        x = layers.Dropout(params['dropout_rate'])(x)
        
        x = layers.Dense(64, activation='gelu')(x)
        x = layers.Dropout(params['dropout_rate'] / 2)(x)
        
        # Output layer - Unbounded regression with discrete-aware loss
        # Use ReLU to prevent negative predictions
        outputs = layers.Dense(1, activation='relu', name='output')(x)
        
        model = models.Model(inputs=inputs, outputs=outputs, name='TransformerDecoder')
        
        # Custom loss: MSE + penalty for non-integer values
        def discrete_aware_loss(y_true, y_pred):
            # Standard MSE
            mse = tf.reduce_mean(tf.square(y_true - y_pred))
            
            # Penalty for non-integer predictions (encourage integer outputs)
            discrete_penalty_weight = params.get('discrete_penalty', 0.5)
            rounded_pred = tf.round(y_pred)
            discrete_penalty = tf.reduce_mean(tf.square(y_pred - rounded_pred))
            
            return mse + discrete_penalty_weight * discrete_penalty
        
        optimizer = optimizers.Adam(learning_rate=params['learning_rate'], clipnorm=1.0)
        model.compile(
            optimizer=optimizer,
            loss=discrete_aware_loss,
            metrics=['mae', 'mse']
        )
        
        return model
    
    def train(self, X_train: np.ndarray, y_train: np.ndarray,
              X_val: np.ndarray, y_val: np.ndarray) -> None:
        """Train model with discrete-aware regression (unbounded) and class weighting"""
        logger.info("Training Transformer Decoder (Discrete-Aware Regression)...")
        logger.info(f"Train: {len(X_train)}, Val: {len(X_val)}")
        
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
        
        # Compute sample weights to balance classes
        unique, counts = np.unique(y_train, return_counts=True)
        class_dist = dict(zip(unique.astype(int), counts))
        logger.info(f"Target distribution: {class_dist}")
        logger.info(f"Target range: {y_train.min():.0f} - {y_train.max():.0f}")
        
        # Compute inverse frequency weights
        total_samples = len(y_train)
        class_weights = {}
        for replica_count, count in class_dist.items():
            # Weight = total / (n_classes * count)
            class_weights[replica_count] = total_samples / (len(unique) * count)
        
        logger.info(f"Class weights: {class_weights}")
        
        # Create sample weights array
        sample_weights = np.array([class_weights[int(y)] for y in y_train])
        
        # Callbacks
        early_stopping = callbacks.EarlyStopping(
            monitor='val_loss',
            patience=config.TRANSFORMER_PARAMS['early_stopping_patience'],
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
        
        # Train with sample weights
        self.history = self.model.fit(
            X_train_scaled, y_train,
            validation_data=(X_val_scaled, y_val),
            sample_weight=sample_weights,
            epochs=config.TRANSFORMER_PARAMS['epochs'],
            batch_size=config.TRANSFORMER_PARAMS['batch_size'],
            callbacks=[early_stopping, reduce_lr],
            verbose=1
        )
        
        logger.info("Training completed!")
    
    def evaluate(self, X_test: np.ndarray, y_test: np.ndarray) -> Dict:
        """Evaluate model with discrete-aware regression (unbounded)"""
        logger.info("Evaluating model...")
        
        X_test_scaled = self.scaler.transform(
            X_test.reshape(-1, X_test.shape[-1])
        ).reshape(X_test.shape)
        
        # Get predictions (unbounded, just round to nearest integer)
        y_pred = self.model.predict(X_test_scaled, verbose=0).flatten()
        y_pred_rounded = np.maximum(np.round(y_pred), 1)  # Only ensure minimum of 1 replica
        
        # Compute metrics
        mse = mean_squared_error(y_test, y_pred)
        rmse = np.sqrt(mse)
        mae = mean_absolute_error(y_test, y_pred)
        r2 = r2_score(y_test, y_pred)
        
        # Discrete accuracy metrics
        exact_accuracy = np.mean(y_pred_rounded == y_test)
        within_1_accuracy = np.mean(np.abs(y_pred_rounded - y_test) <= 1)
        
        # Average "integerity" - how close predictions are to integers
        integerity = 1 - np.mean(np.abs(y_pred - np.round(y_pred)))
        
        self.metrics = {
            'rmse': float(rmse),
            'mae': float(mae),
            'r2_score': float(r2),
            'exact_accuracy': float(exact_accuracy),
            'within_1_accuracy': float(within_1_accuracy),
            'integerity': float(integerity)
        }
        
        logger.info(f"RMSE: {rmse:.4f}, MAE: {mae:.4f}, R²: {r2:.4f}")
        logger.info(f"Exact Accuracy: {exact_accuracy:.4f}, Within-1: {within_1_accuracy:.4f}")
        logger.info(f"Integerity: {integerity:.4f} (closer to 1.0 = more integer-like)")
        
        return self.metrics
    
    def plot_training_history(self, output_dir: Path) -> None:
        """Plot training history"""
        output_dir.mkdir(parents=True, exist_ok=True)
        
        fig, axes = plt.subplots(1, 2, figsize=(15, 5))
        
        axes[0].plot(self.history.history['loss'], label='Train', linewidth=2)
        axes[0].plot(self.history.history['val_loss'], label='Val', linewidth=2)
        axes[0].set_xlabel('Epoch')
        axes[0].set_ylabel('Loss (Discrete-Aware MSE)')
        axes[0].set_title('Training and Validation Loss')
        axes[0].legend()
        axes[0].grid(True, alpha=0.3)
        
        # Plot MAE
        axes[1].plot(self.history.history['mae'], label='Train', linewidth=2)
        axes[1].plot(self.history.history['val_mae'], label='Val', linewidth=2)
        axes[1].set_xlabel('Epoch')
        axes[1].set_ylabel('MAE')
        axes[1].set_title('Training and Validation MAE')
        axes[1].legend()
        axes[1].grid(True, alpha=0.3)
        
        plt.tight_layout()
        plt.savefig(output_dir / 'transformer_training_history.png', dpi=300, bbox_inches='tight')
        plt.close()
        
        logger.info(f"Training history saved")
    
    def plot_pca_analysis(self, output_dir: Path) -> None:
        """Plot PCA analysis"""
        if self.pca is None:
            return
            
        output_dir.mkdir(parents=True, exist_ok=True)
        
        fig, axes = plt.subplots(1, 2, figsize=(15, 5))
        
        explained_var = self.pca.explained_variance_ratio_
        cumulative_var = np.cumsum(explained_var)
        
        axes[0].bar(range(1, len(explained_var) + 1), explained_var, alpha=0.7)
        axes[0].set_xlabel('Principal Component')
        axes[0].set_ylabel('Explained Variance Ratio')
        axes[0].set_title('PCA: Explained Variance')
        axes[0].grid(True, alpha=0.3)
        
        axes[1].plot(range(1, len(cumulative_var) + 1), cumulative_var, marker='o', linewidth=2)
        axes[1].axhline(y=0.95, color='r', linestyle='--', label='95%')
        axes[1].set_xlabel('Components')
        axes[1].set_ylabel('Cumulative Variance')
        axes[1].set_title('PCA: Cumulative Variance')
        axes[1].legend()
        axes[1].grid(True, alpha=0.3)
        
        plt.tight_layout()
        plt.savefig(output_dir / 'pca_analysis.png', dpi=300, bbox_inches='tight')
        plt.close()
        
        logger.info(f"PCA analysis saved")
    
    def plot_predictions(self, X_test: np.ndarray, y_test: np.ndarray, output_dir: Path) -> None:
        """Plot predictions"""
        output_dir.mkdir(parents=True, exist_ok=True)
        
        X_test_scaled = self.scaler.transform(
            X_test.reshape(-1, X_test.shape[-1])
        ).reshape(X_test.shape)
        
        y_pred = self.model.predict(X_test_scaled, verbose=0).flatten()
        y_pred_rounded = np.maximum(np.round(y_pred), 1)  # Only ensure minimum of 1 replica
        
        fig, axes = plt.subplots(1, 2, figsize=(15, 6))
        
        axes[0].scatter(y_test, y_pred_rounded, alpha=0.5, s=10)
        axes[0].plot([y_test.min(), y_test.max()], [y_test.min(), y_test.max()],
                     'r--', lw=2, label='Perfect')
        axes[0].set_xlabel('Actual Replicas')
        axes[0].set_ylabel('Predicted Replicas')
        axes[0].set_title(f'Predicted vs Actual (Data Range: {int(y_test.min())}-{int(y_test.max())})')
        axes[0].legend()
        axes[0].grid(True, alpha=0.3)
        
        bins = np.arange(int(y_test.min()) - 0.5, int(y_test.max()) + 1.5, 1)
        axes[1].hist(y_test, bins=bins, alpha=0.5, label='Actual', color='blue', edgecolor='black')
        axes[1].hist(y_pred_rounded, bins=bins, alpha=0.5, label='Predicted', color='orange', edgecolor='black')
        axes[1].set_xlabel('Replicas')
        axes[1].set_ylabel('Frequency')
        axes[1].set_title('Distribution')
        axes[1].legend()
        axes[1].grid(True, alpha=0.3, axis='y')
        
        plt.tight_layout()
        plt.savefig(output_dir / 'transformer_predictions.png', dpi=300, bbox_inches='tight')
        plt.close()
        
        logger.info(f"Predictions saved")
    
    def save_model(self, output_dir: Path) -> None:
        """Save model"""
        output_dir.mkdir(parents=True, exist_ok=True)
        
        self.model.save(output_dir / 'transformer_model.keras')
        joblib.dump(self.scaler, output_dir / 'transformer_scaler.joblib')
        
        if self.pca is not None:
            # Save PCA and its preprocessing scaler together
            pca_bundle = {
                'pca': self.pca,
                'pca_scaler': self.pca_scaler
            }
            joblib.dump(pca_bundle, output_dir / 'transformer_pca.joblib')
        
        with open(output_dir / 'transformer_metrics.json', 'w') as f:
            json.dump(self.metrics, f, indent=2)
        
        history_dict = {k: [float(v) for v in vals] for k, vals in self.history.history.items()}
        with open(output_dir / 'transformer_history.json', 'w') as f:
            json.dump(history_dict, f, indent=2)
        
        logger.info(f"Model saved to {output_dir}")
    
    def load_model(self, model_dir: Path) -> None:
        """Load model"""
        self.model = models.load_model(model_dir / 'transformer_model.keras', compile=False)
        self.scaler = joblib.load(model_dir / 'transformer_scaler.joblib')
        
        pca_path = model_dir / 'transformer_pca.joblib'
        if pca_path.exists():
            pca_bundle = joblib.load(pca_path)
            if isinstance(pca_bundle, dict):
                self.pca = pca_bundle['pca']
                self.pca_scaler = pca_bundle['pca_scaler']
            else:
                # Backward compatibility for old format
                self.pca = pca_bundle
                self.pca_scaler = StandardScaler()
        
        logger.info(f"Model loaded from {model_dir}")
    
    def predict(self, X: np.ndarray) -> np.ndarray:
        """Make predictions with discrete-aware regression (unbounded)"""
        X_scaled = self.scaler.transform(X.reshape(-1, X.shape[-1])).reshape(X.shape)
        
        # Get predictions - unbounded, only ensure minimum of 1 replica
        predictions = self.model.predict(X_scaled, verbose=0).flatten()
        predictions = np.maximum(np.round(predictions), 1)
        
        return predictions.astype(int)


def main():
    """Main training pipeline"""
    logger.info("=" * 80)
    logger.info("TRANSFORMER DECODER TRAINING")
    logger.info("=" * 80)
    
    model_dir = Path(config.MODEL_OUTPUT_DIR)
    plots_dir = Path(config.PLOTS_OUTPUT_DIR)
    model_dir.mkdir(parents=True, exist_ok=True)
    plots_dir.mkdir(parents=True, exist_ok=True)
    
    logger.info("\n[1/8] Loading data...")
    preprocessor = DataPreprocessor()
    
    try:
        X, y = preprocessor.process_full_pipeline('local')
    except Exception as e:
        logger.error(f"Error: {e}")
        logger.info("Ensure metrics CSV files exist in metrics/ folder")
        raise
    
    X_array = X.values
    y_array = y.values
    
    logger.info("\n[2/8] Splitting data...")
    split_idx = int(len(X_array) * (1 - config.TEST_SIZE))
    X_train_val = X_array[:split_idx]
    y_train_val = y_array[:split_idx]
    X_test_temp = X_array[split_idx:]
    y_test_temp = y_array[split_idx:]
    
    val_split_idx = int(len(X_train_val) * (1 - config.VALIDATION_SPLIT))
    X_train_temp = X_train_val[:val_split_idx]
    y_train_temp = y_train_val[:val_split_idx]
    X_val_temp = X_train_val[val_split_idx:]
    y_val_temp = y_train_val[val_split_idx:]
    
    transformer_model = TransformerDecoderModel()
    
    logger.info("\n[3/8] Applying PCA...")
    X_train_pca, X_val_pca, X_test_pca = transformer_model.apply_pca(
        X_train_temp, X_val_temp, X_test_temp
    )
    
    logger.info("\n[4/8] Creating sequences...")
    X_train, y_train = transformer_model.create_sequences(X_train_pca, y_train_temp)
    X_val, y_val = transformer_model.create_sequences(X_val_pca, y_val_temp)
    X_test, y_test = transformer_model.create_sequences(X_test_pca, y_test_temp)
    
    logger.info(f"Train: {X_train.shape}, Val: {X_val.shape}, Test: {X_test.shape}")
    
    logger.info("\n[5/8] Training...")
    transformer_model.train(X_train, y_train, X_val, y_val)
    
    logger.info("\n[6/8] Evaluating...")
    test_metrics = transformer_model.evaluate(X_test, y_test)
    
    logger.info("\n[7/8] Generating plots...")
    transformer_model.plot_training_history(plots_dir)
    transformer_model.plot_pca_analysis(plots_dir)
    transformer_model.plot_predictions(X_test, y_test, plots_dir)
    
    logger.info("\n[8/8] Saving model...")
    transformer_model.save_model(model_dir)
    
    logger.info("\n" + "=" * 80)
    logger.info("TRAINING COMPLETED!")
    logger.info("=" * 80)
    logger.info(f"Model: {model_dir}")
    logger.info(f"Plots: {plots_dir}")
    logger.info(f"\nMetrics:")
    for metric, value in test_metrics.items():
        logger.info(f"  {metric}: {value:.4f}" if isinstance(value, float) else f"  {metric}: {value}")


if __name__ == '__main__':
    main()

