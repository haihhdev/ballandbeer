"""
Train separate transformer model for each service
Using classification approach with standard categorical crossentropy

Optimized configuration for maximum accuracy (after fixing data leakage):
- FIXED: Removed cpu/ram/requests_per_replica features (data leakage removed!)
- Sequence stride=1: Maximum samples (standard sliding window)
- Model size: d_model=64, num_heads=4, dff=128, num_blocks=2 (full capacity)
- Classification head: 2 dense layers (128→64) for maximum representation
- Dropout=0.2: Minimal dropout to maximize learning
- No label smoothing: Maximize accuracy
- Batch size=64: Stable training with larger batches
- Learning rate=0.0005: Lower LR for precise learning
- Epochs=100, patience=20: Allow sufficient training time
- No oversampling/class weights: Natural distribution learning
- Day-based test split: Full replica coverage (R1-R5)
"""

import pandas as pd
import numpy as np
import tensorflow as tf
import keras
from keras import layers, models, callbacks, optimizers
from sklearn.model_selection import train_test_split, TimeSeriesSplit
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score, accuracy_score
from sklearn.utils.class_weight import compute_class_weight
import joblib
import logging
from pathlib import Path
import json
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend to avoid tkinter issues
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

# Classification config
NUM_CLASSES = 5  # Replicas 1-5
MIN_REPLICA = 1
MAX_REPLICA = 5

# GPU Configuration
gpus = tf.config.list_physical_devices('GPU')
if gpus:
    try:
        for gpu in gpus:
            tf.config.experimental.set_memory_growth(gpu, True)
        logger.info(f"GPU Available: {len(gpus)} GPU(s) - {[gpu.name for gpu in gpus]}")
    except RuntimeError as e:
        logger.warning(f"GPU setup error: {e}")
else:
    logger.warning("No GPU found. Training will use CPU (slower).")


def oversample_minority_classes(X, y, target_ratio=0.5):
    """
    Oversample minority classes to balance the dataset
    target_ratio: minority classes should be at least this ratio of majority class
    """
    unique, counts = np.unique(y, return_counts=True)
    max_count = counts.max()
    target_count = int(max_count * target_ratio)
    
    X_resampled = [X]
    y_resampled = [y]
    
    for class_val, count in zip(unique, counts):
        if count < target_count:
            # Find indices of this class
            indices = np.where(y == class_val)[0]
            # Calculate how many samples to add
            n_to_add = target_count - count
            # Randomly sample with replacement
            add_indices = np.random.choice(indices, size=n_to_add, replace=True)
            
            # Add noise to avoid exact duplicates
            X_add = X[add_indices].copy()
            noise = np.random.normal(0, 0.01, X_add.shape)
            X_add = X_add + noise
            
            X_resampled.append(X_add)
            y_resampled.append(np.full(n_to_add, class_val))
    
    X_final = np.concatenate(X_resampled, axis=0)
    y_final = np.concatenate(y_resampled, axis=0)
    
    # Shuffle
    shuffle_idx = np.random.permutation(len(X_final))
    return X_final[shuffle_idx], y_final[shuffle_idx]


def focal_loss(gamma=2.0, alpha=0.25):
    """
    Focal Loss for multi-class classification
    Focuses on hard examples by down-weighting easy ones
    """
    def focal_loss_fn(y_true, y_pred):
        # Clip predictions to avoid log(0)
        y_pred = tf.clip_by_value(y_pred, 1e-7, 1 - 1e-7)
        
        # Calculate cross entropy
        ce = -y_true * tf.math.log(y_pred)
        
        # Calculate focal weight
        p_t = tf.reduce_sum(y_true * y_pred, axis=-1)
        focal_weight = tf.pow(1 - p_t, gamma)
        
        # Apply focal weight
        loss = alpha * focal_weight * tf.reduce_sum(ce, axis=-1)
        
        return tf.reduce_mean(loss)
    
    return focal_loss_fn


class ServiceTransformer:
    """Transformer for single service using classification approach"""
    
    def __init__(self, service_name, n_features=27, sequence_length=20, d_model=64, 
                 num_heads=4, dff=128, num_blocks=2, dropout=0.2, stride=1):
        self.service_name = service_name
        self.n_features = n_features
        self.sequence_length = sequence_length  # 20 samples = 10 minutes
        self.stride = stride  # stride=1 for maximum samples (standard approach)
        self.d_model = d_model  # Increased to 64 for better representation
        self.num_heads = num_heads  # Increased to 4 for richer attention
        self.dff = dff  # Increased to 128 for more capacity
        self.num_blocks = num_blocks  # Increased to 2 for deeper model
        self.dropout = dropout  # Low dropout (0.2) to maximize learning
        self.scaler = StandardScaler()
        self.model = None
        self.history = None
    
    def build_model(self):
        """Build transformer with classification head"""
        inputs = layers.Input(shape=(self.sequence_length, self.n_features), name='sequence_input')
        
        # Batch normalization on input
        x = layers.BatchNormalization()(inputs)
        
        # Project to d_model
        x = layers.Dense(self.d_model)(x)
        
        # Positional encoding
        pos_enc = self._positional_encoding(self.sequence_length, self.d_model)
        x = x + pos_enc
        
        # Transformer blocks with residual connections
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
            
            # Feed-forward network
            ffn = keras.Sequential([
                layers.Dense(self.dff, activation='gelu'),
                layers.Dropout(self.dropout),
                layers.Dense(self.d_model)
            ], name=f'ffn_{i}')
            
            ffn_output = ffn(x)
            x = layers.LayerNormalization(epsilon=1e-6)(x + ffn_output)
        
        # Global context: combine last timestep with global average
        last_step = x[:, -1, :]
        avg_pool = layers.GlobalAveragePooling1D()(x)
        x = layers.Concatenate()([last_step, avg_pool])
        
        # Full classification head (2 layers for maximum capacity)
        x = layers.Dense(128, activation='gelu', name='dense1')(x)
        x = layers.Dropout(self.dropout)(x)
        x = layers.Dense(64, activation='gelu', name='dense2')(x)
        x = layers.Dropout(self.dropout)(x)
        
        # Output: softmax for 5 classes (replicas 1-5)
        output = layers.Dense(NUM_CLASSES, activation='softmax', name='replica_output')(x)
        
        self.model = models.Model(inputs=inputs, outputs=output, name=f'transformer_{self.service_name}')
        
        logger.info(f"[{self.service_name}] Model built: {self.model.count_params():,} params")
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
        """
        Create sequences for training with configurable stride
        Using stride > 1 reduces overlap and creates more independent samples
        This prevents artificial accuracy inflation from highly correlated test samples
        """
        sequences = []
        targets = []
        
        for i in range(0, len(X) - self.sequence_length, self.stride):
            seq = X[i:i+self.sequence_length]
            target = y[i+self.sequence_length]
            
            sequences.append(seq)
            targets.append(target)
        
        return np.array(sequences), np.array(targets)
    
    def to_categorical(self, y):
        """Convert replica values (1-5) to one-hot encoding"""
        # Shift to 0-indexed (1->0, 2->1, ..., 5->4)
        y_shifted = y.astype(int) - MIN_REPLICA
        y_shifted = np.clip(y_shifted, 0, NUM_CLASSES - 1)
        return keras.utils.to_categorical(y_shifted, num_classes=NUM_CLASSES)
    
    def train(self, X_train, y_train, X_val, y_val, class_weights=None, label_smoothing=0.0):
        """
        Train the model with standard categorical crossentropy (no focal loss tricks)
        
        Args:
            label_smoothing: Smoothing factor (0.0-0.1) to reduce overconfidence
                           Higher values (e.g., 0.1) further reduce accuracy
        """
        if self.model is None:
            self.build_model()
        
        # Convert targets to categorical
        y_train_cat = self.to_categorical(y_train)
        y_val_cat = self.to_categorical(y_val)
        
        # Use standard categorical crossentropy
        loss_fn = keras.losses.CategoricalCrossentropy(label_smoothing=label_smoothing)
        
        # Lower learning rate (0.0005) for more precise learning
        self.model.compile(
            optimizer=optimizers.Adam(learning_rate=0.0005),
            loss=loss_fn,
            metrics=['accuracy']
        )
        
        if label_smoothing > 0:
            logger.info(f"[{self.service_name}] Using label smoothing: {label_smoothing} (reduces overconfidence)")
        
        early_stop = callbacks.EarlyStopping(
            monitor='val_accuracy',
            patience=20,  # Increased patience to train longer
            restore_best_weights=True,
            mode='max',
            verbose=0
        )
        
        reduce_lr = callbacks.ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=7,  # More patience before reducing LR
            min_lr=1e-7,
            verbose=0
        )
        
        self.history = self.model.fit(
            X_train, y_train_cat,
            validation_data=(X_val, y_val_cat),
            epochs=100,  # More epochs for better convergence
            batch_size=64,  # Larger batch size for more stable training
            class_weight=class_weights,  # Will be None
            callbacks=[early_stop, reduce_lr],
            verbose=0
        )
        
        return self.history
    
    def predict(self, X):
        """Predict class with probability threshold"""
        probs = self.model.predict(X, verbose=0)
        # Get class with highest probability
        predictions = np.argmax(probs, axis=1) + MIN_REPLICA  # Convert back to 1-5
        return predictions
    
    def predict_proba(self, X):
        """Get prediction probabilities"""
        return self.model.predict(X, verbose=0)
    
    def evaluate(self, X_test, y_test):
        """Evaluate model with per-class accuracy"""
        predictions = self.predict(X_test)
        
        mae = mean_absolute_error(y_test, predictions)
        rmse = np.sqrt(mean_squared_error(y_test, predictions))
        r2 = r2_score(y_test, predictions)
        exact_acc = accuracy_score(y_test, predictions)
        within_1 = (np.abs(y_test - predictions) <= 1).mean()
        
        # Per-class accuracy for each replica level
        per_class_acc = {}
        for replica in range(MIN_REPLICA, MAX_REPLICA + 1):
            mask = y_test == replica
            if np.sum(mask) > 0:
                class_acc = accuracy_score(y_test[mask], predictions[mask])
                per_class_acc[f'replica_{replica}_acc'] = float(class_acc)
                per_class_acc[f'replica_{replica}_samples'] = int(np.sum(mask))
        
        return {
            'mae': float(mae),
            'rmse': float(rmse),
            'r2': float(r2),
            'exact_accuracy': float(exact_acc),
            'within_1_accuracy': float(within_1),
            'samples': len(y_test),
            'per_class_accuracy': per_class_acc
        }
    
    def save_model(self, model_dir):
        """Save model and scaler"""
        model_dir = Path(model_dir)
        model_dir.mkdir(parents=True, exist_ok=True)
        
        self.model.save(model_dir / f'transformer_model_{self.service_name}.keras')
        joblib.dump(self.scaler, model_dir / f'transformer_scaler_{self.service_name}.joblib')


def plot_all_services(results, plots_dir):
    """Plot results for all services"""
    plots_dir = Path(plots_dir)
    plots_dir.mkdir(parents=True, exist_ok=True)
    
    services = list(results.keys())
    n_services = len(services)
    
    # Calculate grid layout dynamically
    n_cols = min(4, n_services)
    n_rows = (n_services + n_cols - 1) // n_cols  # Ceiling division
    
    # 1. Training history for all services
    fig, axes = plt.subplots(n_rows, n_cols, figsize=(4 * n_cols, 4 * n_rows))
    axes = axes.flatten() if n_services > 1 else [axes]
    
    for i, service in enumerate(services):
        if service not in results:
            continue
        history = results[service]['history']
        
        epochs = range(1, len(history['loss']) + 1)
        # Plot accuracy instead of loss for better interpretation
        if 'accuracy' in history:
            axes[i].plot(epochs, history['accuracy'], 'b-', label='Train Acc', linewidth=1.5)
            axes[i].plot(epochs, history['val_accuracy'], 'r-', label='Val Acc', linewidth=1.5)
            axes[i].set_ylabel('Accuracy', fontsize=9)
        else:
            axes[i].plot(epochs, history['loss'], 'b-', label='Train', linewidth=1.5)
            axes[i].plot(epochs, history['val_loss'], 'r-', label='Val', linewidth=1.5)
            axes[i].set_ylabel('Loss', fontsize=9)
        axes[i].set_xlabel('Epoch', fontsize=9)
        axes[i].set_title(f'{service.capitalize()}', fontsize=10, fontweight='bold')
        axes[i].legend(fontsize=8)
        axes[i].grid(True, alpha=0.3)
    
    # Remove unused subplots
    for j in range(n_services, len(axes)):
        axes[j].remove()
    
    plt.suptitle('Training History - All Services', fontsize=14, fontweight='bold')
    plt.tight_layout()
    plt.savefig(plots_dir / 'training_history_all_services.png', dpi=150, bbox_inches='tight')
    logger.info("Saved training history plot")
    plt.close()
    
    # 2. Predictions bar chart
    fig, axes = plt.subplots(n_rows, n_cols, figsize=(4 * n_cols, 4 * n_rows))
    axes = axes.flatten() if n_services > 1 else [axes]
    
    for i, service in enumerate(services):
        if service not in results or 'predictions' not in results[service]:
            continue
        
        y_test = results[service]['y_test']
        predictions = results[service]['predictions']
        
        # Count distribution
        unique_replicas = sorted(set(y_test) | set(predictions))
        actual_counts = [np.sum(y_test == r) for r in unique_replicas]
        pred_counts = [np.sum(predictions == r) for r in unique_replicas]
        
        x = np.arange(len(unique_replicas))
        width = 0.35
        
        axes[i].bar(x - width/2, actual_counts, width, label='Actual', 
                   color='skyblue', edgecolor='navy', linewidth=1.5)
        axes[i].bar(x + width/2, pred_counts, width, label='Predicted', 
                   color='lightcoral', edgecolor='darkred', linewidth=1.5)
        
        metrics = results[service]['metrics']
        axes[i].set_xlabel('Replica Count', fontsize=9)
        axes[i].set_ylabel('Frequency', fontsize=9)
        axes[i].set_title(f'{service.capitalize()}\nExact: {metrics["exact_accuracy"]:.1%} | Within-1: {metrics["within_1_accuracy"]:.1%}', 
                         fontsize=10, fontweight='bold')
        axes[i].set_xticks(x)
        axes[i].set_xticklabels(unique_replicas)
        axes[i].legend(fontsize=8)
        axes[i].grid(True, alpha=0.3, axis='y')
    
    # Remove unused subplots
    for j in range(n_services, len(axes)):
        axes[j].remove()
    
    plt.suptitle('Per-Service Models: Prediction Distribution', fontsize=14, fontweight='bold')
    plt.tight_layout()
    plt.savefig(plots_dir / 'predictions_per_service.png', dpi=150, bbox_inches='tight')
    logger.info("Saved predictions plot")
    plt.close()
    
    # 3. Metrics summary table
    fig, ax = plt.subplots(figsize=(12, 6))
    ax.axis('tight')
    ax.axis('off')
    
    table_data = []
    for service in services:
        if service not in results:
            continue
        m = results[service]['metrics']
        table_data.append([
            service.capitalize(),
            f"{m['samples']}",
            f"{m['exact_accuracy']:.1%}",
            f"{m['within_1_accuracy']:.1%}",
            f"{m['mae']:.3f}",
            f"{m['rmse']:.3f}",
            f"{m['r2']:.3f}"
        ])
    
    table = ax.table(cellText=table_data,
                    colLabels=['Service', 'Samples', 'Exact Acc', 'Within-1 Acc', 'MAE', 'RMSE', 'R²'],
                    cellLoc='center',
                    loc='center',
                    colWidths=[0.15, 0.12, 0.15, 0.18, 0.12, 0.12, 0.12])
    
    table.auto_set_font_size(False)
    table.set_fontsize(10)
    table.scale(1, 2)
    
    # Color header
    for i in range(7):
        table[(0, i)].set_facecolor('#4CAF50')
        table[(0, i)].set_text_props(weight='bold', color='white')
    
    plt.title('Per-Service Model Performance Summary', fontsize=14, fontweight='bold', pad=20)
    plt.savefig(plots_dir / 'metrics_summary.png', dpi=150, bbox_inches='tight')
    logger.info("✓ Saved metrics summary")
    plt.close()
    
    # 4. Per-class accuracy (showing R1-R5 for each service)
    n_cols = min(4, n_services)
    n_rows = (n_services + n_cols - 1) // n_cols
    fig, axes = plt.subplots(n_rows, n_cols, figsize=(4 * n_cols, 4 * n_rows))
    axes = axes.flatten() if n_services > 1 else [axes]
    
    for i, service in enumerate(services):
        if service not in results:
            continue
        
        metrics = results[service]['metrics']
        per_class = metrics.get('per_class_accuracy', {})
        
        if per_class:
            replicas = []
            accuracies = []
            sample_counts = []
            
            for replica_num in range(MIN_REPLICA, MAX_REPLICA + 1):
                key = f'replica_{replica_num}_acc'
                count_key = f'replica_{replica_num}_samples'
                if key in per_class:
                    replicas.append(f'R{replica_num}')
                    accuracies.append(per_class[key])
                    sample_counts.append(per_class.get(count_key, 0))
            
            if replicas:
                colors = ['#E57373', '#FFB74D', '#FFF176', '#81C784', '#4CAF50'][:len(replicas)]
                bars = axes[i].bar(replicas, accuracies, color=colors, edgecolor='black', linewidth=1.5)
                
                # Add value labels with sample counts
                for j, bar in enumerate(bars):
                    height = bar.get_height()
                    axes[i].text(bar.get_x() + bar.get_width()/2., height,
                                f'{height:.1%}\n(n={sample_counts[j]})', 
                                ha='center', va='bottom', fontsize=7)
                
                axes[i].set_ylabel('Accuracy', fontsize=9)
                axes[i].set_xlabel('Replica Count', fontsize=9)
                axes[i].set_title(f'{service.capitalize()}\nOverall: {metrics["exact_accuracy"]:.1%}', 
                                 fontsize=10, fontweight='bold')
                axes[i].set_ylim(0, 1.1)
                axes[i].grid(True, alpha=0.3, axis='y')
    
    for j in range(n_services, len(axes)):
        axes[j].remove()
    
    plt.suptitle('Transformer: Per-Class Accuracy by Service (R1-R5)', fontsize=14, fontweight='bold')
    plt.tight_layout()
    plt.savefig(plots_dir / 'per_class_accuracy.png', dpi=150, bbox_inches='tight')
    logger.info("✓ Saved per-class accuracy plot")
    plt.close()


def main():
    logger.info("="*80)
    logger.info("TRAINING TRANSFORMER MODEL PER SERVICE (OPTIMIZED FOR MAX ACCURACY)")
    logger.info("="*80)
    logger.info("FIXED: Removed per_replica features (cpu/ram/requests_per_replica)")
    logger.info("       Data leakage eliminated!")
    logger.info("")
    logger.info("Optimized configuration for maximum accuracy:")
    logger.info("  - Stride=1: Maximum samples (standard sliding window)")
    logger.info("  - Model: d_model=64, heads=4, dff=128, blocks=2 (full capacity)")
    logger.info("  - Head: 2 dense layers (128→64)")
    logger.info("  - Dropout=0.2 (minimal for max learning)")
    logger.info("  - Batch size=64, LR=0.0005, Epochs=100")
    logger.info("  - No label smoothing, no class weights")
    logger.info("Goal: Achieve maximum realistic accuracy without data leakage")
    
    device = "GPU" if tf.config.list_physical_devices('GPU') else "CPU"
    logger.info(f"Training device: {device}\n")
    
    model_dir = Path(config.MODEL_OUTPUT_DIR) / 'transformer'
    plots_dir = Path(config.PLOTS_OUTPUT_DIR) / 'transformer'
    model_dir.mkdir(parents=True, exist_ok=True)
    plots_dir.mkdir(parents=True, exist_ok=True)
    
    # Load data - prioritize filtered data
    logger.info("[1/3] Loading data...")
    preprocessor = DataPreprocessor()
    
    # Priority: balanced_v2 > filtered > raw metrics
    if Path('metrics/balanced_v2').exists() or Path('../metrics/balanced_v2').exists():
        data_path = 'metrics/balanced_v2' if Path('metrics/balanced_v2').exists() else '../metrics/balanced_v2'
    elif Path('metrics/filtered').exists() or Path('../metrics/filtered').exists():
        data_path = 'metrics/filtered' if Path('metrics/filtered').exists() else '../metrics/filtered'
    else:
        data_path = 'metrics' if Path('metrics').exists() else '../metrics'
    
    logger.info(f"Using data from: {data_path}")
    
    # Load and preprocess data
    data = preprocessor.load_local_folder(data_path)
    data_clean = preprocessor.clean_data(data)
    data_features = preprocessor.engineer_features(data_clean)
    
    # Use actual replica_count as target (not computed target_replicas)
    # This gives more meaningful accuracy metrics
    y = data_features['replica_count'].astype(int)
    service_names = data_features['service_name'].values
    
    # Prepare features
    X, _ = preprocessor.prepare_features_and_target(
        preprocessor.create_target_labels(data_features)
    )
    
    # Remove service encoding columns from features (we train per-service)
    service_cols = [col for col in X.columns if col.startswith('service_')]
    X_no_service = X.drop(columns=service_cols)
    
    logger.info(f"Total samples: {len(X)}")
    logger.info(f"Features per service: {X_no_service.shape[1]} (removed service encoding)")
    logger.info(f"Services: {config.SERVICES}\n")
    
    # Train model for each service
    logger.info("[2/3] Training per-service models...")
    results = {}
    all_metrics = {}
    
    for service in config.SERVICES:
        logger.info(f"\n{'='*70}")
        logger.info(f"SERVICE: {service.upper()}")
        logger.info(f"{'='*70}")
        
        # Filter data for this service
        mask = service_names == service
        X_service = X_no_service.values[mask]
        y_service = y.values[mask]
        
        # Check if service has enough data and variance
        unique_replicas = np.unique(y_service)
        if len(unique_replicas) == 1:
            logger.warning(f"[{service}] Only 1 replica value ({unique_replicas[0]}) - SKIPPING")
            continue
        
        if len(X_service) < 100:
            logger.warning(f"[{service}] Only {len(X_service)} samples - SKIPPING")
            continue
        
        logger.info(f"[{service}] Samples: {len(X_service)}")
        logger.info(f"[{service}] Replica distribution: {dict(zip(*np.unique(y_service, return_counts=True)))}")
        
        # IMPROVED: Split by DAYS instead of samples (same as Random Forest & CatBoost)
        samples_per_day = 1700
        total_days = len(X_service) // samples_per_day
        
        if total_days >= 10:
            test_days = max(2, int(total_days * 0.2))
            test_start_idx = len(X_service) - (test_days * samples_per_day)
            
            X_train_val = X_service[:test_start_idx]
            y_train_val = y_service[:test_start_idx]
            X_test = X_service[test_start_idx:]
            y_test = y_service[test_start_idx:]
        else:
            test_split_idx = int(len(X_service) * 0.8)
            X_train_val = X_service[:test_split_idx]
            y_train_val = y_service[:test_split_idx]
            X_test = X_service[test_split_idx:]
            y_test = y_service[test_split_idx:]
        
        # TimeSeriesSplit for train/val (3 folds)
        n_splits = 3
        tscv = TimeSeriesSplit(n_splits=n_splits)
        
        # Get the last fold as final train/val split
        for train_idx, val_idx in tscv.split(X_train_val):
            X_train = X_train_val[train_idx]
            y_train = y_train_val[train_idx]
            X_val = X_train_val[val_idx]
            y_val = y_train_val[val_idx]
        
        # Log test set replica distribution
        test_replica_dist = dict(zip(*np.unique(y_test, return_counts=True)))
        logger.info(f"[{service}] Cross-validation: {n_splits} folds (TimeSeriesSplit)")
        logger.info(f"[{service}] Train: {len(X_train)}, Val: {len(X_val)}, Test: {len(X_test)}")
        logger.info(f"[{service}] Test set replica distribution: {test_replica_dist}")
        
        # Create model
        model = ServiceTransformer(service, n_features=X_no_service.shape[1])
        
        # Scale data
        X_train_scaled = model.scaler.fit_transform(X_train)
        X_val_scaled = model.scaler.transform(X_val)
        X_test_scaled = model.scaler.transform(X_test)
        
        # Create sequences
        X_train_seq, y_train_seq = model.create_sequences(X_train_scaled, y_train)
        X_val_seq, y_val_seq = model.create_sequences(X_val_scaled, y_val)
        X_test_seq, y_test_seq = model.create_sequences(X_test_scaled, y_test)
        
        # No oversampling - let model learn from natural distribution
        # No class weights boosting - prevents artificial accuracy inflation
        # Using stride=1 for maximum samples (standard approach)
        # FIXED: Removed per_replica features that caused data leakage
        # Optimized: Full model capacity + low dropout for maximum accuracy
        
        logger.info(f"[{service}] Sequences (stride={model.stride}) - Train: {X_train_seq.shape}, Val: {X_val_seq.shape}, Test: {X_test_seq.shape}")
        
        # Log sequence creation details
        original_samples = len(X_test) - model.sequence_length
        strided_samples = len(X_test_seq)
        overlap_pct = (model.sequence_length - model.stride) / model.sequence_length * 100
        logger.info(f"[{service}] Stride={model.stride}: {strided_samples} sequences created, Overlap {overlap_pct:.0f}% (maximized samples)")
        
        # Train with optimized hyperparameters for maximum accuracy
        # No label smoothing, no class weights - maximize natural learning
        logger.info(f"[{service}] Training...")
        model.train(X_train_seq, y_train_seq, X_val_seq, y_val_seq, class_weights=None, label_smoothing=0.0)
        
        # Evaluate
        metrics = model.evaluate(X_test_seq, y_test_seq)
        predictions = model.predict(X_test_seq)
        
        logger.info(f"[{service}] Results:")
        logger.info(f"  Exact Accuracy: {metrics['exact_accuracy']:.1%}")
        logger.info(f"  Within-1 Accuracy: {metrics['within_1_accuracy']:.1%}")
        logger.info(f"  MAE: {metrics['mae']:.3f}")
        logger.info(f"  RMSE: {metrics['rmse']:.3f}")
        logger.info(f"  R²: {metrics['r2']:.3f}")
        
        # Save model
        model.save_model(model_dir)
        logger.info(f"[{service}] ✓ Model saved")
        
        # Store results
        results[service] = {
            'model': model,
            'history': {
                'loss': [float(x) for x in model.history.history['loss']],
                'val_loss': [float(x) for x in model.history.history['val_loss']],
                'accuracy': [float(x) for x in model.history.history['accuracy']],
                'val_accuracy': [float(x) for x in model.history.history['val_accuracy']]
            },
            'metrics': metrics,
            'y_test': y_test_seq,
            'predictions': predictions
        }
        all_metrics[service] = metrics
    
    # Save all metrics
    logger.info("\n[3/3] Generating plots and saving metrics...")
    with open(model_dir / 'per_service_metrics.json', 'w') as f:
        json.dump(all_metrics, f, indent=2)
    logger.info("✓ Saved metrics")
    
    # Plot results
    plot_all_services(results, plots_dir)
    
    # Summary
    logger.info("\n" + "="*80)
    logger.info("TRAINING COMPLETED!")
    logger.info("="*80)
    logger.info(f"Models trained: {len(results)}/{len(config.SERVICES)}")
    logger.info(f"Model directory: {model_dir}")
    logger.info(f"Plots directory: {plots_dir}")
    logger.info("\nPer-Service Performance:")
    for service, metrics in all_metrics.items():
        logger.info(f"  {service:12s}: Exact={metrics['exact_accuracy']:.1%}, Within-1={metrics['within_1_accuracy']:.1%}, MAE={metrics['mae']:.3f}, R²={metrics['r2']:.3f}")
        
        # Log per-class accuracy to show full R1-R5 coverage
        per_class = metrics.get('per_class_accuracy', {})
        if per_class:
            class_accs = []
            for r in range(MIN_REPLICA, MAX_REPLICA + 1):
                key = f'replica_{r}_acc'
                count_key = f'replica_{r}_samples'
                if key in per_class:
                    acc = per_class[key]
                    count = per_class.get(count_key, 0)
                    class_accs.append(f"R{r}:{acc:.0%}(n={count})")
            if class_accs:
                logger.info(f"               Per-class: {', '.join(class_accs)}")
    logger.info("="*80)


if __name__ == '__main__':
    main()

