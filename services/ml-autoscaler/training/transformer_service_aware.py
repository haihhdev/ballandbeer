"""
Service-Aware Transformer - Single model that learns service-specific patterns

Architecture:
- Uses service one-hot encoding as input features (already in data)
- Single prediction head (simpler than multi-head)
- Model learns service-specific patterns through attention mechanism
"""

import pandas as pd
import numpy as np
import tensorflow as tf
import keras
from keras import layers, models, callbacks, optimizers
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
from sklearn.utils.class_weight import compute_class_weight
import joblib
import logging
from pathlib import Path
import json
import matplotlib.pyplot as plt
import seaborn as sns

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

import config
from data_preprocessor import DataPreprocessor

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

np.random.seed(config.RANDOM_STATE)
tf.random.set_seed(config.RANDOM_STATE)


class ServiceAwareTransformer:
    """Transformer that learns service-specific patterns via service encoding features"""
    
    def __init__(self, n_features=34, sequence_length=12, d_model=64, num_heads=4, 
                 dff=128, num_blocks=2, dropout=0.2):
        self.n_features = n_features
        self.sequence_length = sequence_length
        self.d_model = d_model
        self.num_heads = num_heads
        self.dff = dff
        self.num_blocks = num_blocks
        self.dropout = dropout
        self.scaler = StandardScaler()
        self.model = None
        self.history = None
    
    def build_model(self):
        """Build service-aware transformer with single output"""
        
        # Input layer
        inputs = layers.Input(shape=(self.sequence_length, self.n_features), name='sequence_input')
        
        # Project to d_model dimensions
        x = layers.Dense(self.d_model)(inputs)
        
        # Positional encoding
        pos_enc = self._positional_encoding(self.sequence_length, self.d_model)
        x = x + pos_enc
        
        # Transformer blocks
        for i in range(self.num_blocks):
            # Multi-head attention with causal mask
            attn_output = layers.MultiHeadAttention(
                num_heads=self.num_heads,
                key_dim=self.d_model // self.num_heads,
                dropout=self.dropout,
                name=f'attention_{i}'
            )(x, x, use_causal_mask=True)
            
            attn_output = layers.Dropout(self.dropout)(attn_output)
            x = layers.LayerNormalization(epsilon=1e-6)(x + attn_output)
            
            # Feed forward
            ffn = keras.Sequential([
                layers.Dense(self.dff, activation='gelu'),
                layers.Dropout(self.dropout),
                layers.Dense(self.d_model)
            ], name=f'ffn_{i}')
            
            ffn_output = ffn(x)
            x = layers.LayerNormalization(epsilon=1e-6)(x + ffn_output)
        
        # Take last timestep
        x = x[:, -1, :]
        
        # Prediction head
        x = layers.Dense(128, activation='gelu', name='dense1')(x)
        x = layers.Dropout(self.dropout)(x)
        x = layers.Dense(64, activation='gelu', name='dense2')(x)
        x = layers.Dropout(self.dropout)(x)
        output = layers.Dense(1, name='replica_output')(x)
        
        self.model = models.Model(inputs=inputs, outputs=output, name='service_aware_transformer')
        
        logger.info("Service-aware transformer built")
        logger.info(f"Model will learn service-specific patterns from service encoding features")
        return self.model
    
    def _positional_encoding(self, sequence_length, d_model):
        """Sinusoidal positional encoding"""
        position = np.arange(sequence_length)[:, np.newaxis]
        div_term = np.exp(np.arange(0, d_model, 2) * -(np.log(10000.0) / d_model))
        
        pos_encoding = np.zeros((sequence_length, d_model))
        pos_encoding[:, 0::2] = np.sin(position * div_term)
        pos_encoding[:, 1::2] = np.cos(position * div_term)
        
        return tf.cast(pos_encoding[np.newaxis, :, :], dtype=tf.float32)
    
    def create_sequences(self, X, y):
        """Create sequences for training"""
        sequences = []
        targets = []
        
        for i in range(len(X) - self.sequence_length):
            seq = X[i:i+self.sequence_length]
            target = y[i+self.sequence_length]
            
            sequences.append(seq)
            targets.append(target)
        
        return np.array(sequences), np.array(targets)
    
    def train(self, X_train, y_train, X_val, y_val, class_weights=None):
        """Train the model"""
        
        if self.model is None:
            self.build_model()
        
        # Compile
        self.model.compile(
            optimizer=optimizers.Adam(learning_rate=0.001),
            loss='mse',
            metrics=['mae']
        )
        
        # Callbacks
        early_stop = callbacks.EarlyStopping(
            monitor='val_loss',
            patience=20,
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
        
        logger.info("Training service-aware transformer...")
        self.history = self.model.fit(
            X_train,
            y_train,
            validation_data=(X_val, y_val),
            epochs=100,
            batch_size=64,
            class_weight=class_weights,
            callbacks=[early_stop, reduce_lr],
            verbose=1
        )
        
        return self.history
    
    def predict(self, X):
        """Predict replica counts"""
        predictions = self.model.predict(X, verbose=0).flatten()
        predictions = np.clip(np.round(predictions), 1, 10)
        return predictions.astype(int)
    
    def evaluate(self, X_test, y_test, service_names_test):
        """Evaluate overall and per-service performance"""
        logger.info("Evaluating service-aware model...")
        
        predictions = self.predict(X_test)
        
        # Overall metrics
        mae = mean_absolute_error(y_test, predictions)
        rmse = np.sqrt(mean_squared_error(y_test, predictions))
        r2 = r2_score(y_test, predictions)
        exact_acc = (y_test == predictions).mean()
        within_1 = (np.abs(y_test - predictions) <= 1).mean()
        
        logger.info(f"\nOverall Performance:")
        logger.info(f"  MAE: {mae:.3f}")
        logger.info(f"  RMSE: {rmse:.3f}")
        logger.info(f"  R2: {r2:.3f}")
        logger.info(f"  Exact Accuracy: {exact_acc:.1%}")
        logger.info(f"  Within-1 Accuracy: {within_1:.1%}")
        
        # Per-service metrics
        logger.info(f"\nPer-Service Performance:")
        metrics_per_service = {}
        
        for service in config.SERVICES:
            mask = np.array([s == service for s in service_names_test])
            if mask.sum() == 0:
                continue
            
            y_service = y_test[mask]
            pred_service = predictions[mask]
            
            mae_svc = mean_absolute_error(y_service, pred_service)
            rmse_svc = np.sqrt(mean_squared_error(y_service, pred_service))
            exact_svc = (y_service == pred_service).mean()
            within_1_svc = (np.abs(y_service - pred_service) <= 1).mean()
            
            metrics_per_service[service] = {
                'mae': float(mae_svc),
                'rmse': float(rmse_svc),
                'exact_accuracy': float(exact_svc),
                'within_1_accuracy': float(within_1_svc),
                'samples': int(mask.sum())
            }
            
            logger.info(f"  {service}: MAE={mae_svc:.3f}, RMSE={rmse_svc:.3f}, Exact={exact_svc:.1%}, Within-1={within_1_svc:.1%} (n={mask.sum()})")
        
        return {
            'overall': {
                'mae': float(mae),
                'rmse': float(rmse),
                'r2': float(r2),
                'exact_accuracy': float(exact_acc),
                'within_1_accuracy': float(within_1)
            },
            'per_service': metrics_per_service
        }
    
    def save_model(self, model_dir):
        """Save model and scaler"""
        model_path = Path(model_dir) / 'transformer_model.keras'
        scaler_path = Path(model_dir) / 'transformer_scaler.joblib'
        
        self.model.save(model_path)
        joblib.dump(self.scaler, scaler_path)
        
        logger.info(f"Model saved to {model_dir}")


def plot_results(history, y_test, predictions, service_names_test, plots_dir):
    """Plot training history and prediction results"""
    
    # 1. Training History
    fig, axes = plt.subplots(1, 2, figsize=(12, 4))
    
    epochs = range(1, len(history.history['loss']) + 1)
    
    axes[0].plot(epochs, history.history['loss'], 'b-', label='Train Loss', linewidth=2)
    axes[0].plot(epochs, history.history['val_loss'], 'r-', label='Val Loss', linewidth=2)
    axes[0].set_xlabel('Epoch', fontsize=12)
    axes[0].set_ylabel('Loss (MSE)', fontsize=12)
    axes[0].set_title('Training History - Loss', fontsize=14, fontweight='bold')
    axes[0].legend(fontsize=10)
    axes[0].grid(True, alpha=0.3)
    
    axes[1].plot(epochs, history.history['mae'], 'b-', label='Train MAE', linewidth=2)
    axes[1].plot(epochs, history.history['val_mae'], 'r-', label='Val MAE', linewidth=2)
    axes[1].set_xlabel('Epoch', fontsize=12)
    axes[1].set_ylabel('MAE', fontsize=12)
    axes[1].set_title('Training History - MAE', fontsize=14, fontweight='bold')
    axes[1].legend(fontsize=10)
    axes[1].grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.savefig(Path(plots_dir) / 'transformer_training_history.png', dpi=150, bbox_inches='tight')
    logger.info(f"✓ Saved training history plot")
    plt.close()
    
    # 2a. Predictions vs Actual - Scatter Plot (per service)
    fig, axes = plt.subplots(2, 4, figsize=(16, 8))
    axes = axes.flatten()
    
    for i, service in enumerate(config.SERVICES):
        mask = np.array([s == service for s in service_names_test])
        if mask.sum() == 0:
            axes[i].text(0.5, 0.5, 'No data', ha='center', va='center', fontsize=14)
            axes[i].set_title(f'{service.capitalize()}', fontsize=12, fontweight='bold')
            continue
        
        y_svc = y_test[mask]
        pred_svc = predictions[mask]
        
        # Scatter plot
        axes[i].scatter(y_svc, pred_svc, alpha=0.4, s=30, c='blue', edgecolors='navy', linewidth=0.5)
        
        # Perfect prediction line
        axes[i].plot([1, 5], [1, 5], 'r--', lw=2, label='Perfect', alpha=0.7)
        
        # Calculate metrics
        exact_acc = (y_svc == pred_svc).mean()
        within_1 = (np.abs(y_svc - pred_svc) <= 1).mean()
        
        axes[i].set_xlabel('Actual Replicas', fontsize=10)
        axes[i].set_ylabel('Predicted Replicas', fontsize=10)
        axes[i].set_title(f'{service.capitalize()}\nExact: {exact_acc:.1%} | Within-1: {within_1:.1%}', 
                         fontsize=11, fontweight='bold')
        axes[i].set_xlim(0.5, 5.5)
        axes[i].set_ylim(0.5, 5.5)
        axes[i].set_xticks([1, 2, 3, 4, 5])
        axes[i].set_yticks([1, 2, 3, 4, 5])
        axes[i].grid(True, alpha=0.3, linestyle='--')
        axes[i].legend(fontsize=8)
    
    # Remove empty subplot
    axes[-1].remove()
    
    plt.suptitle('Service-Aware Transformer: Predictions vs Actual (Scatter)', 
                 fontsize=16, fontweight='bold', y=1.00)
    plt.tight_layout()
    plt.savefig(Path(plots_dir) / 'transformer_predictions_scatter.png', dpi=150, bbox_inches='tight')
    logger.info(f"✓ Saved predictions scatter plot")
    plt.close()
    
    # 2b. Predictions vs Actual - Bar Chart (per service)
    fig, axes = plt.subplots(2, 4, figsize=(16, 8))
    axes = axes.flatten()
    
    for i, service in enumerate(config.SERVICES):
        mask = np.array([s == service for s in service_names_test])
        if mask.sum() == 0:
            axes[i].text(0.5, 0.5, 'No data', ha='center', va='center', fontsize=14)
            axes[i].set_title(f'{service.capitalize()}', fontsize=12, fontweight='bold')
            continue
        
        y_svc = y_test[mask]
        pred_svc = predictions[mask]
        
        # Count distribution
        replicas = [1, 2, 3, 4, 5]
        actual_counts = [np.sum(y_svc == r) for r in replicas]
        pred_counts = [np.sum(pred_svc == r) for r in replicas]
        
        x = np.arange(len(replicas))
        width = 0.35
        
        bars1 = axes[i].bar(x - width/2, actual_counts, width, label='Actual', 
                           color='skyblue', edgecolor='navy', linewidth=1.5)
        bars2 = axes[i].bar(x + width/2, pred_counts, width, label='Predicted', 
                           color='lightcoral', edgecolor='darkred', linewidth=1.5)
        
        # Calculate metrics
        exact_acc = (y_svc == pred_svc).mean()
        within_1 = (np.abs(y_svc - pred_svc) <= 1).mean()
        
        axes[i].set_xlabel('Replica Count', fontsize=10)
        axes[i].set_ylabel('Frequency', fontsize=10)
        axes[i].set_title(f'{service.capitalize()}\nExact: {exact_acc:.1%} | Within-1: {within_1:.1%}', 
                         fontsize=11, fontweight='bold')
        axes[i].set_xticks(x)
        axes[i].set_xticklabels(replicas)
        axes[i].legend(fontsize=8)
        axes[i].grid(True, alpha=0.3, axis='y')
    
    # Remove empty subplot
    axes[-1].remove()
    
    plt.suptitle('Service-Aware Transformer: Distribution Comparison (Bar Chart)', 
                 fontsize=16, fontweight='bold', y=1.00)
    plt.tight_layout()
    plt.savefig(Path(plots_dir) / 'transformer_predictions.png', dpi=150, bbox_inches='tight')
    logger.info(f"✓ Saved predictions bar chart")
    plt.close()
    
    # 3. Error distribution per service
    fig, axes = plt.subplots(2, 4, figsize=(16, 8))
    axes = axes.flatten()
    
    for i, service in enumerate(config.SERVICES):
        mask = np.array([s == service for s in service_names_test])
        if mask.sum() == 0:
            continue
        
        y_svc = y_test[mask]
        pred_svc = predictions[mask]
        errors = pred_svc - y_svc
        
        # Histogram of errors
        axes[i].hist(errors, bins=np.arange(-3.5, 4.5, 1), alpha=0.7, color='skyblue', edgecolor='black')
        axes[i].axvline(0, color='red', linestyle='--', linewidth=2, label='Zero Error')
        axes[i].set_xlabel('Prediction Error', fontsize=10)
        axes[i].set_ylabel('Count', fontsize=10)
        axes[i].set_title(f'{service.capitalize()}\nMean Error: {errors.mean():.2f}', 
                         fontsize=11, fontweight='bold')
        axes[i].grid(True, alpha=0.3, axis='y')
        axes[i].legend(fontsize=8)
    
    axes[-1].remove()
    
    plt.suptitle('Prediction Error Distribution (Per Service)', 
                 fontsize=16, fontweight='bold', y=1.00)
    plt.tight_layout()
    plt.savefig(Path(plots_dir) / 'transformer_errors.png', dpi=150, bbox_inches='tight')
    logger.info(f"✓ Saved error distribution plot")
    plt.close()


def main():
    logger.info("="*80)
    logger.info("SERVICE-AWARE TRANSFORMER TRAINING")
    logger.info("="*80)
    
    model_dir = Path(config.MODEL_OUTPUT_DIR)
    plots_dir = Path(config.PLOTS_OUTPUT_DIR)
    model_dir.mkdir(parents=True, exist_ok=True)
    plots_dir.mkdir(parents=True, exist_ok=True)
    
    logger.info("\n[1/6] Loading and preprocessing data...")
    preprocessor = DataPreprocessor()
    
    # Use balanced data if available
    balanced_path = 'metrics/balanced' if Path('metrics/balanced').exists() else '../metrics/balanced' if Path('../metrics/balanced').exists() else None
    
    if balanced_path and Path(balanced_path).exists():
        logger.info(f"Using balanced data from: {balanced_path}")
        X, y = preprocessor.process_full_pipeline(balanced_path)
        data = preprocessor.load_local_folder(balanced_path)
    else:
        logger.info("Balanced data not found, using regular metrics")
        X, y = preprocessor.process_full_pipeline('local')
        data = preprocessor.load_local_folder('metrics' if Path('metrics').exists() else '../metrics')
    
    data_clean = preprocessor.clean_data(data)
    service_names = data_clean['service_name'].values
    
    X_array = X.values
    y_array = y.values
    
    logger.info(f"Total samples: {len(X_array)}")
    logger.info(f"Features: {X.shape[1]}")
    logger.info(f"Services: {sorted(set(service_names))}")
    
    # Check service features are in X
    service_features = [col for col in X.columns if col.startswith('service_')]
    logger.info(f"Service encoding features: {service_features}")
    
    logger.info("\n[2/6] Splitting data...")
    # Time-based split
    split_idx = int(len(X_array) * 0.8)
    val_split_idx = int(split_idx * 0.8)
    
    X_train = X_array[:val_split_idx]
    y_train = y_array[:val_split_idx]
    service_train = service_names[:val_split_idx]
    
    X_val = X_array[val_split_idx:split_idx]
    y_val = y_array[val_split_idx:split_idx]
    service_val = service_names[val_split_idx:split_idx]
    
    X_test = X_array[split_idx:]
    y_test = y_array[split_idx:]
    service_test = service_names[split_idx:]
    
    logger.info(f"Train: {len(X_train)}, Val: {len(X_val)}, Test: {len(X_test)}")
    
    # Compute class weights
    unique_classes = np.unique(y_train)
    class_weights_array = compute_class_weight('balanced', classes=unique_classes, y=y_train)
    class_weights = {int(c): w for c, w in zip(unique_classes, class_weights_array)}
    logger.info(f"Class weights: {class_weights}")
    
    logger.info("\n[3/6] Creating sequences...")
    model = ServiceAwareTransformer(n_features=X_array.shape[1])
    
    # Scale data
    X_train_scaled = model.scaler.fit_transform(X_train)
    X_val_scaled = model.scaler.transform(X_val)
    X_test_scaled = model.scaler.transform(X_test)
    
    X_train_seq, y_train_seq = model.create_sequences(X_train_scaled, y_train)
    X_val_seq, y_val_seq = model.create_sequences(X_val_scaled, y_val)
    X_test_seq, y_test_seq = model.create_sequences(X_test_scaled, y_test)
    
    # Adjust service_test for sequence offset
    service_train_seq = service_train[model.sequence_length:]
    service_val_seq = service_val[model.sequence_length:]
    service_test_seq = service_test[model.sequence_length:]
    
    logger.info(f"Sequences - Train: {X_train_seq.shape}, Val: {X_val_seq.shape}, Test: {X_test_seq.shape}")
    
    logger.info("\n[4/6] Training...")
    model.train(X_train_seq, y_train_seq, X_val_seq, y_val_seq, class_weights)
    
    logger.info("\n[5/6] Evaluating...")
    predictions = model.predict(X_test_seq)
    metrics = model.evaluate(X_test_seq, y_test_seq, service_test_seq)
    
    logger.info("\n[6/6] Saving...")
    model.save_model(model_dir)
    
    # Save metrics
    with open(model_dir / 'transformer_metrics.json', 'w') as f:
        json.dump(metrics, f, indent=2)
    logger.info("✓ Saved metrics")
    
    # Save training history
    history_dict = {
        'loss': [float(x) for x in model.history.history['loss']],
        'val_loss': [float(x) for x in model.history.history['val_loss']],
        'mae': [float(x) for x in model.history.history['mae']],
        'val_mae': [float(x) for x in model.history.history['val_mae']]
    }
    with open(model_dir / 'transformer_history.json', 'w') as f:
        json.dump(history_dict, f, indent=2)
    logger.info("✓ Saved training history")
    
    # Plot results
    logger.info("\nGenerating plots...")
    plot_results(model.history, y_test_seq, predictions, service_test_seq, plots_dir)
    
    logger.info("\n" + "="*80)
    logger.info("TRAINING COMPLETED!")
    logger.info(f"Model: {model_dir}")
    logger.info(f"Plots: {plots_dir}")
    logger.info("="*80)


if __name__ == '__main__':
    main()

