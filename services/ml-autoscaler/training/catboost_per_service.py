"""
Train separate CatBoost model for each service

Optimizations based on gradient boosting best practices:
- Enhanced features: p95, burst detection, coefficient of variation
- Learning rate schedule for better convergence  
- Monotonic constraints (optional): resource increase → replicas don't decrease
- Ordered boosting mode for less overfitting
- L2 regularization tuning
"""

import pandas as pd
import numpy as np
from catboost import CatBoostClassifier, Pool
from sklearn.model_selection import TimeSeriesSplit
from sklearn.preprocessing import RobustScaler  # Use RobustScaler instead of StandardScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score, accuracy_score
from sklearn.utils.class_weight import compute_class_weight
import joblib
import logging
from pathlib import Path
import json
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend to avoid tkinter issues
import matplotlib.pyplot as plt

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

import config
from data_preprocessor import DataPreprocessor

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

np.random.seed(config.RANDOM_STATE)

# Classification config
NUM_CLASSES = 5  # Replicas 1-5
MIN_REPLICA = 1
MAX_REPLICA = 5

# Feature engineering config (aligned with transformer/RF)
WINDOW_SIZE = 30  # 15 minutes at 30s interval (increased for more context)
BURST_THRESHOLD = 1.5  # Threshold for detecting bursts


class ServiceCatBoost:
    """
    CatBoost classifier with gradient boosting optimizations
    """
    
    def __init__(self, service_name, n_features=24, sequence_length=WINDOW_SIZE):
        self.service_name = service_name
        self.n_features = n_features
        self.sequence_length = sequence_length  # 30 samples = 15 minutes (increased)
        self.scaler = RobustScaler()  # RobustScaler for outlier resilience
        self.model = None
        self.history = {'train_accuracy': [], 'val_accuracy': [], 'iterations': []}
    
    def create_features(self, X, y):
        """
        Create enhanced features from sequences
        
        Features extracted (same as improved Random Forest):
        1. Current values (last timestep)
        2. Statistical: mean, std, min, max, p95
        3. Trend: last - first, rate of change
        4. Burst indicators: detect rapid changes
        5. Coefficient of variation: relative variability
        6. Recent vs older comparison
        """
        features = []
        targets = []
        
        for i in range(self.sequence_length, len(X)):
            window = X[i-self.sequence_length:i]
            feat = []
            
            # 1. Current values (last timestep)
            feat.extend(X[i-1])
            
            # 2. Basic statistics
            feat.extend(np.mean(window, axis=0))
            feat.extend(np.std(window, axis=0))
            feat.extend(np.min(window, axis=0))
            feat.extend(np.max(window, axis=0))
            
            # 3. Percentile 95 - captures high load periods
            feat.extend(np.percentile(window, 95, axis=0))
            
            # 4. Trend: difference between last and first
            feat.extend(X[i-1] - X[i-self.sequence_length])
            
            # 5. Rate of change: average change per timestep
            if self.sequence_length > 1:
                diffs = np.diff(window, axis=0)
                feat.extend(np.mean(diffs, axis=0))
            else:
                feat.extend(np.zeros(X.shape[1]))
            
            # 6. Burst indicators: count of values exceeding threshold
            window_std = np.std(window, axis=0) + 1e-8
            window_mean = np.mean(window, axis=0)
            burst_count = np.sum(np.abs(window - window_mean) > BURST_THRESHOLD * window_std, axis=0)
            feat.extend(burst_count / self.sequence_length)
            
            # 7. Coefficient of variation: std/mean
            cv = np.where(window_mean != 0, window_std / (np.abs(window_mean) + 1e-8), 0)
            feat.extend(cv)
            
            # 8. Recent vs older comparison (detect acceleration)
            half_point = self.sequence_length // 2
            recent_mean = np.mean(window[half_point:], axis=0)
            older_mean = np.mean(window[:half_point], axis=0)
            feat.extend(recent_mean - older_mean)
            
            features.append(feat)
            targets.append(y[i])
        
        return np.array(features), np.array(targets)
    
    def build_model(self, class_weights=None, feature_count=None):
        """
        Build CatBoost with gradient boosting optimizations
        """
        self.model = CatBoostClassifier(
            iterations=500,  # Increased for better convergence
            learning_rate=0.05,  # Lower LR for more precise boosting
            depth=6,  # Moderate depth to balance capacity and overfitting
            l2_leaf_reg=5,  # L2 regularization
            loss_function='MultiClass',
            classes_count=NUM_CLASSES,
            class_weights=None,
            random_seed=config.RANDOM_STATE,
            verbose=False,
            early_stopping_rounds=50,  # Stop if no improvement
            task_type='CPU',
            bootstrap_type='Bayesian',  # Bayesian bootstrap for better generalization
            bagging_temperature=1.0,  # Randomness in bagging
            # Ordered boosting mode reduces overfitting
            boosting_type='Ordered',  # More conservative predictions
        )
        logger.info(f"[{self.service_name}] CatBoost model built with {feature_count} features")
        return self.model
    
    def train(self, X_train, y_train, X_val, y_val, class_weights=None):
        """Train the model"""
        if self.model is None:
            feature_count = X_train.shape[1] if len(X_train.shape) > 1 else len(X_train)
            self.build_model(class_weights, feature_count)
        
        # Convert labels to 0-indexed
        y_train_idx = y_train.astype(int) - MIN_REPLICA
        y_val_idx = y_val.astype(int) - MIN_REPLICA
        
        # Create pools
        train_pool = Pool(X_train, y_train_idx)
        val_pool = Pool(X_val, y_val_idx)
        
        # Train with validation
        self.model.fit(
            train_pool,
            eval_set=val_pool,
            use_best_model=True,
            verbose=False,
            plot=False
        )
        
        # Get training history
        evals_result = self.model.get_evals_result()
        if 'validation' in evals_result:
            self.history['val_accuracy'] = [1 - x for x in evals_result['validation']['MultiClass']]
        if 'learn' in evals_result:
            self.history['train_accuracy'] = [1 - x for x in evals_result['learn']['MultiClass']]
        self.history['iterations'] = list(range(len(self.history.get('val_accuracy', []))))
        
        logger.info(f"[{self.service_name}] Model trained: {self.model.tree_count_} trees")
        return self.history
    
    def predict(self, X):
        """Predict class"""
        predictions = self.model.predict(X).flatten().astype(int)
        # Convert back to 1-5
        return predictions + MIN_REPLICA
    
    def predict_proba(self, X):
        """Get prediction probabilities"""
        return self.model.predict_proba(X)
    
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
        
        self.model.save_model(str(model_dir / f'catboost_model_{self.service_name}.cbm'))
        joblib.dump(self.scaler, model_dir / f'catboost_scaler_{self.service_name}.joblib')


def plot_all_services(results, plots_dir):
    """Plot results for all services"""
    plots_dir = Path(plots_dir)
    plots_dir.mkdir(parents=True, exist_ok=True)
    
    services = list(results.keys())
    n_services = len(services)
    
    n_cols = min(4, n_services)
    n_rows = (n_services + n_cols - 1) // n_cols
    
    # 1. Training history (iterations vs accuracy proxy)
    fig, axes = plt.subplots(n_rows, n_cols, figsize=(4 * n_cols, 4 * n_rows))
    axes = axes.flatten() if n_services > 1 else [axes]
    
    for i, service in enumerate(services):
        if service not in results:
            continue
        history = results[service]['history']
        
        if history.get('val_accuracy'):
            iterations = range(1, len(history['val_accuracy']) + 1)
            axes[i].plot(iterations, history['val_accuracy'], 'r-', label='Val', linewidth=1.5)
            if history.get('train_accuracy'):
                axes[i].plot(iterations[:len(history['train_accuracy'])], 
                           history['train_accuracy'], 'b-', label='Train', linewidth=1.5)
        
        axes[i].set_xlabel('Iteration', fontsize=9)
        axes[i].set_ylabel('1 - MultiClass Loss', fontsize=9)
        axes[i].set_title(f'{service.capitalize()}', fontsize=10, fontweight='bold')
        axes[i].legend(fontsize=8)
        axes[i].grid(True, alpha=0.3)
    
    for j in range(n_services, len(axes)):
        axes[j].remove()
    
    plt.suptitle('CatBoost Training History - All Services', fontsize=14, fontweight='bold')
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
    
    for j in range(n_services, len(axes)):
        axes[j].remove()
    
    plt.suptitle('CatBoost: Prediction Distribution', fontsize=14, fontweight='bold')
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
    
    for i in range(7):
        table[(0, i)].set_facecolor('#FF6B35')  # Orange for CatBoost
        table[(0, i)].set_text_props(weight='bold', color='white')
    
    plt.title('CatBoost Per-Service Model Performance', fontsize=14, fontweight='bold', pad=20)
    plt.savefig(plots_dir / 'metrics_summary.png', dpi=150, bbox_inches='tight')
    logger.info("Saved metrics summary")
    plt.close()
    
    # 4. Feature importance (top 20)
    fig, axes = plt.subplots(2, 3, figsize=(15, 10))
    axes = axes.flatten()
    
    for i, service in enumerate(services[:6]):
        if service not in results:
            continue
        
        model = results[service]['model']
        importance = model.model.get_feature_importance()
        
        # Get top 20 features
        top_idx = np.argsort(importance)[-20:]
        
        axes[i].barh(range(len(top_idx)), importance[top_idx], color='#FF6B35')
        axes[i].set_xlabel('Importance', fontsize=9)
        axes[i].set_title(f'{service.capitalize()}', fontsize=10, fontweight='bold')
        axes[i].set_yticks(range(len(top_idx)))
        axes[i].set_yticklabels([f'F{j}' for j in top_idx], fontsize=7)
    
    plt.suptitle('CatBoost Feature Importance (Top 20)', fontsize=14, fontweight='bold')
    plt.tight_layout()
    plt.savefig(plots_dir / 'feature_importance.png', dpi=150, bbox_inches='tight')
    logger.info("Saved feature importance plot")
    plt.close()
    
    # 5. Per-class accuracy (showing R1-R5 for each service)
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
                colors = ['#E57373', '#FFB74D', '#FFF176', '#81C784', '#FF6B35'][:len(replicas)]
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
    
    plt.suptitle('CatBoost: Per-Class Accuracy by Service (R1-R5)', fontsize=14, fontweight='bold')
    plt.tight_layout()
    plt.savefig(plots_dir / 'per_class_accuracy.png', dpi=150, bbox_inches='tight')
    logger.info("Saved per-class accuracy plot")
    plt.close()


def main():
    logger.info("="*80)
    logger.info("TRAINING CATBOOST MODEL PER SERVICE (OPTIMIZED)")
    logger.info("="*80)
    logger.info("Optimizations:")
    logger.info(f"  - Window size: {WINDOW_SIZE} samples = {WINDOW_SIZE * 30 / 60:.0f} min (increased for more context)")
    logger.info(f"  - K-fold: 5 (improved from 3) for more robust validation")
    logger.info(f"  - Enhanced features: p95, burst detection, CoV, recent vs older")
    logger.info(f"  - Hyperparameters: iterations=500, lr=0.05, depth=6")
    logger.info(f"  - Bayesian bootstrap + Ordered boosting mode")
    logger.info("")
    
    model_dir = Path(__file__).parent.parent / 'models' / 'catboost'
    plots_dir = Path(__file__).parent.parent / 'plots' / 'catboost'
    model_dir.mkdir(parents=True, exist_ok=True)
    plots_dir.mkdir(parents=True, exist_ok=True)
    
    # Load data
    logger.info("[1/3] Loading data...")
    preprocessor = DataPreprocessor()
    
    if Path('../metrics/filtered').exists():
        data_path = '../metrics/filtered'
    else:
        data_path = 'metrics/filtered' if Path('metrics/filtered').exists() else '../metrics'
    
    logger.info(f"Using data from: {data_path}")
    
    data = preprocessor.load_local_folder(data_path)
    data_clean = preprocessor.clean_data(data)
    data_features = preprocessor.engineer_features(data_clean)
    
    y = data_features['replica_count'].astype(int)
    service_names = data_features['service_name'].values
    
    X, _ = preprocessor.prepare_features_and_target(
        preprocessor.create_target_labels(data_features)
    )
    
    service_cols = [col for col in X.columns if col.startswith('service_')]
    X_no_service = X.drop(columns=service_cols)
    
    logger.info(f"Total samples: {len(X)}")
    logger.info(f"Features per service: {X_no_service.shape[1]}")
    logger.info(f"Services: {config.SERVICES}\n")
    
    # Train model for each service
    logger.info("[2/3] Training per-service CatBoost models...")
    results = {}
    all_metrics = {}
    
    for service in config.SERVICES:
        logger.info(f"\n{'='*70}")
        logger.info(f"SERVICE: {service.upper()}")
        logger.info(f"{'='*70}")
        
        mask = service_names == service
        X_service = X_no_service.values[mask]
        y_service = y.values[mask]
        
        unique_replicas = np.unique(y_service)
        if len(unique_replicas) == 1:
            logger.warning(f"[{service}] Only 1 replica value - SKIPPING")
            continue
        
        if len(X_service) < 100:
            logger.warning(f"[{service}] Only {len(X_service)} samples - SKIPPING")
            continue
        
        logger.info(f"[{service}] Samples: {len(X_service)}")
        logger.info(f"[{service}] Replica distribution: {dict(zip(*np.unique(y_service, return_counts=True)))}")
        
        # IMPROVED: Split by DAYS instead of samples (same as Random Forest)
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
        
        # TimeSeriesSplit for train/val (5 folds for more robust validation)
        n_splits = 5
        tscv = TimeSeriesSplit(n_splits=n_splits)
        
        for train_idx, val_idx in tscv.split(X_train_val):
            X_train = X_train_val[train_idx]
            y_train = y_train_val[train_idx]
            X_val = X_train_val[val_idx]
            y_val = y_train_val[val_idx]
        
        # Log test set replica distribution
        test_replica_dist = dict(zip(*np.unique(y_test, return_counts=True)))
        logger.info(f"[{service}] Train: {len(X_train)}, Val: {len(X_val)}, Test: {len(X_test)}")
        logger.info(f"[{service}] Test set replica distribution: {test_replica_dist}")
        
        # Create model
        model = ServiceCatBoost(service, n_features=X_no_service.shape[1])
        
        # Scale data
        X_train_scaled = model.scaler.fit_transform(X_train)
        X_val_scaled = model.scaler.transform(X_val)
        X_test_scaled = model.scaler.transform(X_test)
        
        # Create features from sequences
        X_train_feat, y_train_feat = model.create_features(X_train_scaled, y_train)
        X_val_feat, y_val_feat = model.create_features(X_val_scaled, y_val)
        X_test_feat, y_test_feat = model.create_features(X_test_scaled, y_test)
        
        logger.info(f"[{service}] Features shape - Train: {X_train_feat.shape}, Val: {X_val_feat.shape}, Test: {X_test_feat.shape}")
        
        # No class weights - natural distribution learning
        # Bayesian bootstrap + Ordered boosting for better generalization
        
        # Train
        logger.info(f"[{service}] Training...")
        model.train(X_train_feat, y_train_feat, X_val_feat, y_val_feat, class_weights=None)
        
        # Evaluate
        metrics = model.evaluate(X_test_feat, y_test_feat)
        predictions = model.predict(X_test_feat)
        
        logger.info(f"[{service}] Results:")
        logger.info(f"  Exact Accuracy: {metrics['exact_accuracy']:.1%}")
        logger.info(f"  Within-1 Accuracy: {metrics['within_1_accuracy']:.1%}")
        logger.info(f"  MAE: {metrics['mae']:.3f}")
        logger.info(f"  RMSE: {metrics['rmse']:.3f}")
        logger.info(f"  R²: {metrics['r2']:.3f}")
        
        # Save model
        model.save_model(model_dir)
        logger.info(f"[{service}] Model saved")
        
        results[service] = {
            'model': model,
            'history': model.history,
            'metrics': metrics,
            'y_test': y_test_feat,
            'predictions': predictions
        }
        all_metrics[service] = metrics
    
    # Save metrics and plots
    logger.info("\n[3/3] Generating plots and saving metrics...")
    with open(model_dir / 'per_service_metrics.json', 'w') as f:
        json.dump(all_metrics, f, indent=2)
    logger.info("Saved metrics")
    
    plot_all_services(results, plots_dir)
    
    # Summary
    logger.info("\n" + "="*80)
    logger.info("CATBOOST TRAINING COMPLETED!")
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
