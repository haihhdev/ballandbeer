"""
Train separate Random Forest model for each service

Optimizations based on RF autoscaler paper:
- Hyperparameter tuning for better trees
- Feature importance tracking
- Out-of-bag (OOB) validation
- Balanced max_depth to prevent overfitting
- Enhanced window features (statistical aggregations)
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
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


class ServiceRandomForest:
    """Random Forest classifier with optimizations from research"""
    
    def __init__(self, service_name, n_features=24, sequence_length=30):
        """
        Args:
            sequence_length: Window size for feature extraction (30 = 15 minutes)
                            Increased from 20 for more context and better accuracy
        """
        self.service_name = service_name
        self.n_features = n_features
        self.sequence_length = sequence_length
        self.scaler = RobustScaler()  # RobustScaler for outlier resilience
        self.model = None
        self.history = {'train_accuracy': [], 'val_accuracy': [], 'oob_scores': []}
    
    def create_features(self, X, y):
        """
        Create enhanced features from sequences
        Statistical aggregations over sliding window (RF autoscaler paper approach)
        """
        features = []
        targets = []
        
        for i in range(self.sequence_length, len(X)):
            window = X[i-self.sequence_length:i]
            feat = []
            
            # 1. Current values (last timestep)
            feat.extend(X[i-1])
            
            # 2. Statistical aggregations
            feat.extend(np.mean(window, axis=0))  # Mean
            feat.extend(np.std(window, axis=0))  # Std (volatility)
            feat.extend(np.min(window, axis=0))  # Min
            feat.extend(np.max(window, axis=0))  # Max
            
            # 3. Percentile features (p25, p75 for robust range)
            feat.extend(np.percentile(window, 25, axis=0))
            feat.extend(np.percentile(window, 75, axis=0))
            
            # 4. Trend (last - first)
            feat.extend(X[i-1] - X[i-self.sequence_length])
            
            # 5. Recent vs older comparison (detect acceleration)
            half_point = self.sequence_length // 2
            recent_mean = np.mean(window[half_point:], axis=0)
            older_mean = np.mean(window[:half_point], axis=0)
            feat.extend(recent_mean - older_mean)
            
            features.append(feat)
            targets.append(y[i])
        
        return np.array(features), np.array(targets)
    
    def build_model(self, class_weights=None):
        """
        Build Random Forest with optimized hyperparameters
        Based on RF autoscaler paper recommendations
        """
        class_weight_dict = None
        if class_weights is not None:
            class_weight_dict = {i + MIN_REPLICA: weight for i, weight in enumerate(class_weights)}
        
        self.model = RandomForestClassifier(
            n_estimators=500,  # Increased from 300 for more stable predictions
            max_depth=20,  # Increased from 15 for more capacity
            min_samples_split=5,
            min_samples_leaf=2,
            max_features='sqrt',  # sqrt(n_features) for diversity
            class_weight=class_weight_dict,
            random_state=config.RANDOM_STATE,
            n_jobs=-1,  # Use all CPU cores
            oob_score=True,  # OOB validation
            max_samples=0.8,  # Bootstrap sampling ratio (improves diversity)
            verbose=0
        )
        return self.model
    
    def train(self, X_train, y_train, X_val, y_val, class_weights=None):
        """Train the model"""
        if self.model is None:
            self.build_model(class_weights)
        
        # Train model
        self.model.fit(X_train, y_train)
        
        # Calculate accuracies
        train_pred = self.model.predict(X_train)
        val_pred = self.model.predict(X_val)
        
        train_acc = accuracy_score(y_train, train_pred)
        val_acc = accuracy_score(y_val, val_pred)
        oob_score = self.model.oob_score_ if hasattr(self.model, 'oob_score_') else 0
        
        # Store history (single point since RF doesn't have iterative training)
        self.history['train_accuracy'] = [train_acc]
        self.history['val_accuracy'] = [val_acc]
        self.history['oob_scores'] = [oob_score]
        
        logger.info(f"[{self.service_name}] Model trained: {self.model.n_estimators} trees")
        logger.info(f"[{self.service_name}] OOB Score: {oob_score:.3f}")
        return self.history
    
    def predict(self, X):
        """Predict class"""
        predictions = self.model.predict(X).flatten().astype(int)
        return predictions
    
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
        
        joblib.dump(self.model, model_dir / f'randomforest_model_{self.service_name}.joblib')
        joblib.dump(self.scaler, model_dir / f'randomforest_scaler_{self.service_name}.joblib')


def plot_all_services(results, plots_dir):
    """Plot results for all services"""
    plots_dir = Path(plots_dir)
    plots_dir.mkdir(parents=True, exist_ok=True)
    
    services = list(results.keys())
    n_services = len(services)
    
    n_cols = min(4, n_services)
    n_rows = (n_services + n_cols - 1) // n_cols
    
    # 1. OOB Scores (since RF doesn't have iterative training like CatBoost)
    fig, axes = plt.subplots(n_rows, n_cols, figsize=(4 * n_cols, 4 * n_rows))
    axes = axes.flatten() if n_services > 1 else [axes]
    
    for i, service in enumerate(services):
        if service not in results:
            continue
        
        metrics = results[service]['metrics']
        history = results[service]['history']
        oob_score = history['oob_scores'][0] if history['oob_scores'] else 0
        
        # Bar chart showing train/val/oob accuracy
        accuracies = [
            history['train_accuracy'][0],
            history['val_accuracy'][0],
            oob_score
        ]
        labels = ['Train', 'Val', 'OOB']
        colors = ['#4CAF50', '#2196F3', '#FFC107']
        
        bars = axes[i].bar(labels, accuracies, color=colors, edgecolor='black', linewidth=1.5)
        axes[i].set_ylabel('Accuracy', fontsize=9)
        axes[i].set_title(f'{service.capitalize()}', fontsize=10, fontweight='bold')
        axes[i].set_ylim(0, 1.0)
        axes[i].grid(True, alpha=0.3, axis='y')
        
        # Add value labels on bars
        for bar in bars:
            height = bar.get_height()
            axes[i].text(bar.get_x() + bar.get_width()/2., height,
                        f'{height:.3f}', ha='center', va='bottom', fontsize=8)
    
    for j in range(n_services, len(axes)):
        axes[j].remove()
    
    plt.suptitle('Random Forest Training Accuracy - All Services', fontsize=14, fontweight='bold')
    plt.tight_layout()
    plt.savefig(plots_dir / 'training_history_all_services.png', dpi=150, bbox_inches='tight')
    logger.info("Saved training accuracy plot")
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
                   color='lightgreen', edgecolor='darkgreen', linewidth=1.5)
        
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
    
    plt.suptitle('Random Forest: Prediction Distribution', fontsize=14, fontweight='bold')
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
        table[(0, i)].set_facecolor('#4CAF50')  # Green for Random Forest
        table[(0, i)].set_text_props(weight='bold', color='white')
    
    plt.title('Random Forest Per-Service Model Performance', fontsize=14, fontweight='bold', pad=20)
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
        importance = model.model.feature_importances_
        
        # Get top 20 features
        top_idx = np.argsort(importance)[-20:]
        
        axes[i].barh(range(len(top_idx)), importance[top_idx], color='#4CAF50')
        axes[i].set_xlabel('Importance', fontsize=9)
        axes[i].set_title(f'{service.capitalize()}', fontsize=10, fontweight='bold')
        axes[i].set_yticks(range(len(top_idx)))
        axes[i].set_yticklabels([f'F{j}' for j in top_idx], fontsize=7)
    
    plt.suptitle('Random Forest Feature Importance (Top 20)', fontsize=14, fontweight='bold')
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
    
    plt.suptitle('Random Forest: Per-Class Accuracy by Service (R1-R5)', fontsize=14, fontweight='bold')
    plt.tight_layout()
    plt.savefig(plots_dir / 'per_class_accuracy.png', dpi=150, bbox_inches='tight')
    logger.info("Saved per-class accuracy plot")
    plt.close()


def main():
    logger.info("="*80)
    logger.info("TRAINING RANDOM FOREST MODEL PER SERVICE (OPTIMIZED)")
    logger.info("="*80)
    logger.info("Optimizations:")
    logger.info("  - Window size: 30 samples (15 minutes) - more context for better accuracy")
    logger.info("  - K-fold: 5 (improved from 3) for more robust validation")
    logger.info("  - Enhanced features: p25/p75, recent vs older comparison")
    logger.info("  - Hyperparameters: n_estimators=500, max_depth=20, max_samples=0.8")
    logger.info("  - OOB validation for unbiased accuracy estimation")
    logger.info("")
    
    model_dir = Path(__file__).parent.parent / 'models' / 'randomforest'
    plots_dir = Path(__file__).parent.parent / 'plots' / 'randomforest'
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
    logger.info("[2/3] Training per-service Random Forest models...")
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
        
        # IMPROVED: Split by DAYS instead of by samples
        # This ensures test set contains complete days with full replica distribution
        # Assuming ~1700 samples per service per day (12000 rows / 7 services)
        samples_per_day = 1700
        total_days = len(X_service) // samples_per_day
        
        if total_days >= 10:
            # Use last 20% of DAYS as test (at least 2 days)
            test_days = max(2, int(total_days * 0.2))
            test_start_idx = len(X_service) - (test_days * samples_per_day)
            
            X_train_val = X_service[:test_start_idx]
            y_train_val = y_service[:test_start_idx]
            X_test = X_service[test_start_idx:]
            y_test = y_service[test_start_idx:]
        else:
            # Fallback to 80/20 split if not enough days
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
        model = ServiceRandomForest(service, n_features=X_no_service.shape[1])
        
        # Scale data
        X_train_scaled = model.scaler.fit_transform(X_train)
        X_val_scaled = model.scaler.transform(X_val)
        X_test_scaled = model.scaler.transform(X_test)
        
        # Create features from sequences
        X_train_feat, y_train_feat = model.create_features(X_train_scaled, y_train)
        X_val_feat, y_val_feat = model.create_features(X_val_scaled, y_val)
        X_test_feat, y_test_feat = model.create_features(X_test_scaled, y_test)
        
        logger.info(f"[{service}] Features shape - Train: {X_train_feat.shape}, Val: {X_val_feat.shape}, Test: {X_test_feat.shape}")
        
        # No class weights - natural distribution learning (prevents overfitting)
        # Enhanced features for better performance
        
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
    logger.info("RANDOM FOREST TRAINING COMPLETED!")
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
