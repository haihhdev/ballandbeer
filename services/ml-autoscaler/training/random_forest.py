"""
Random Forest Model for K8s Auto-scaling Prediction

This model predicts the optimal number of replicas based on infrastructure 
and application metrics, focusing on real-time performance indicators rather 
than time-based features.
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split, cross_val_score
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


class RandomForestScalingModel:
    def __init__(self):
        self.model = RandomForestRegressor(**config.RANDOM_FOREST_PARAMS)
        self.feature_names = None
        self.feature_importance = None
        self.metrics = {}
        
    def train(self, X_train: pd.DataFrame, y_train: pd.Series) -> None:
        """Train the Random Forest model"""
        logger.info("Training Random Forest model...")
        logger.info(f"Training set size: {len(X_train)} samples")
        
        self.feature_names = list(X_train.columns)
        
        # Train the model
        self.model.fit(X_train, y_train)
        
        # Calculate feature importance
        self.feature_importance = pd.DataFrame({
            'feature': self.feature_names,
            'importance': self.model.feature_importances_
        }).sort_values('importance', ascending=False)
        
        logger.info("Training completed!")
        logger.info(f"Top 10 important features:\n{self.feature_importance.head(10)}")
        
    def evaluate(self, X_test: pd.DataFrame, y_test: pd.Series) -> Dict:
        """Evaluate model performance"""
        logger.info("Evaluating model performance...")
        
        # Predictions
        y_pred = self.model.predict(X_test)
        y_train_pred = self.model.predict(X_test)  # For comparison
        
        # Clip predictions to valid replica range [1, 10]
        y_pred_clipped = np.clip(np.round(y_pred), 1, 10)
        
        # Calculate metrics
        mse = mean_squared_error(y_test, y_pred)
        rmse = np.sqrt(mse)
        mae = mean_absolute_error(y_test, y_pred)
        r2 = r2_score(y_test, y_pred)
        
        # Accuracy for exact replica prediction
        accuracy = np.mean(y_pred_clipped == y_test)
        
        # Within-1 accuracy (prediction within 1 replica)
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
    
    def cross_validate(self, X: pd.DataFrame, y: pd.Series, cv: int = 5) -> Dict:
        """Perform cross-validation"""
        logger.info(f"Performing {cv}-fold cross-validation...")
        
        cv_scores = cross_val_score(
            self.model, X, y, 
            cv=cv, 
            scoring='neg_mean_squared_error',
            n_jobs=-1
        )
        
        cv_rmse = np.sqrt(-cv_scores)
        
        cv_metrics = {
            'cv_rmse_mean': float(cv_rmse.mean()),
            'cv_rmse_std': float(cv_rmse.std())
        }
        
        logger.info(f"Cross-validation RMSE: {cv_rmse.mean():.4f} (+/- {cv_rmse.std():.4f})")
        
        return cv_metrics
    
    def plot_feature_importance(self, output_dir: Path, top_n: int = 20) -> None:
        """Plot feature importance"""
        output_dir.mkdir(parents=True, exist_ok=True)
        
        plt.figure(figsize=(12, 8))
        top_features = self.feature_importance.head(top_n)
        
        sns.barplot(x='importance', y='feature', data=top_features, palette='viridis')
        plt.title('Random Forest: Top Feature Importances', fontsize=16, fontweight='bold')
        plt.xlabel('Importance Score', fontsize=12)
        plt.ylabel('Feature', fontsize=12)
        plt.tight_layout()
        
        output_path = output_dir / 'rf_feature_importance.png'
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        plt.close()
        
        logger.info(f"Feature importance plot saved to {output_path}")
    
    def plot_predictions(self, X_test: pd.DataFrame, y_test: pd.Series, 
                        output_dir: Path) -> None:
        """Plot prediction vs actual"""
        output_dir.mkdir(parents=True, exist_ok=True)
        
        y_pred = np.clip(np.round(self.model.predict(X_test)), 1, 10)
        
        fig, axes = plt.subplots(1, 2, figsize=(15, 6))
        
        # Scatter plot
        axes[0].scatter(y_test, y_pred, alpha=0.5, s=10)
        axes[0].plot([y_test.min(), y_test.max()], 
                     [y_test.min(), y_test.max()], 
                     'r--', lw=2, label='Perfect Prediction')
        axes[0].set_xlabel('Actual Replicas', fontsize=12)
        axes[0].set_ylabel('Predicted Replicas', fontsize=12)
        axes[0].set_title('Random Forest: Predicted vs Actual Replicas', fontsize=14, fontweight='bold')
        axes[0].legend()
        axes[0].grid(True, alpha=0.3)
        
        # Distribution comparison
        bins = np.arange(0.5, 11.5, 1)
        axes[1].hist(y_test, bins=bins, alpha=0.5, label='Actual', color='blue', edgecolor='black')
        axes[1].hist(y_pred, bins=bins, alpha=0.5, label='Predicted', color='orange', edgecolor='black')
        axes[1].set_xlabel('Number of Replicas', fontsize=12)
        axes[1].set_ylabel('Frequency', fontsize=12)
        axes[1].set_title('Distribution of Actual vs Predicted Replicas', fontsize=14, fontweight='bold')
        axes[1].legend()
        axes[1].grid(True, alpha=0.3, axis='y')
        
        plt.tight_layout()
        
        output_path = output_dir / 'rf_predictions.png'
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        plt.close()
        
        logger.info(f"Prediction plot saved to {output_path}")
    
    def save_model(self, output_dir: Path) -> None:
        """Save the trained model"""
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Save model
        model_path = output_dir / 'random_forest_model.joblib'
        joblib.dump(self.model, model_path)
        logger.info(f"Model saved to {model_path}")
        
        # Save feature names
        features_path = output_dir / 'rf_feature_names.json'
        with open(features_path, 'w') as f:
            json.dump(self.feature_names, f, indent=2)
        logger.info(f"Feature names saved to {features_path}")
        
        # Save feature importance
        importance_path = output_dir / 'rf_feature_importance.csv'
        self.feature_importance.to_csv(importance_path, index=False)
        logger.info(f"Feature importance saved to {importance_path}")
        
        # Save metrics
        metrics_path = output_dir / 'rf_metrics.json'
        with open(metrics_path, 'w') as f:
            json.dump(self.metrics, f, indent=2)
        logger.info(f"Metrics saved to {metrics_path}")
    
    def load_model(self, model_path: str) -> None:
        """Load a trained model"""
        self.model = joblib.load(model_path)
        logger.info(f"Model loaded from {model_path}")
    
    def predict(self, X: pd.DataFrame) -> np.ndarray:
        """Make predictions"""
        predictions = self.model.predict(X)
        # Clip and round to valid replica range
        return np.clip(np.round(predictions), 1, 10).astype(int)


def main():
    """Main training pipeline for Random Forest model"""
    logger.info("=" * 80)
    logger.info("RANDOM FOREST MODEL TRAINING FOR K8S AUTO-SCALING")
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
    
    # Split data
    logger.info("\n[Step 2] Splitting data into train and test sets...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, 
        test_size=config.TEST_SIZE, 
        random_state=config.RANDOM_STATE,
        shuffle=True
    )
    
    logger.info(f"Training set: {len(X_train)} samples")
    logger.info(f"Test set: {len(X_test)} samples")
    
    # Initialize and train model
    logger.info("\n[Step 3] Training Random Forest model...")
    rf_model = RandomForestScalingModel()
    rf_model.train(X_train, y_train)
    
    # Cross-validation
    logger.info("\n[Step 4] Performing cross-validation...")
    cv_metrics = rf_model.cross_validate(X_train, y_train, cv=5)
    rf_model.metrics.update(cv_metrics)
    
    # Evaluate on test set
    logger.info("\n[Step 5] Evaluating on test set...")
    test_metrics = rf_model.evaluate(X_test, y_test)
    
    # Generate plots
    logger.info("\n[Step 6] Generating visualizations...")
    rf_model.plot_feature_importance(plots_dir)
    rf_model.plot_predictions(X_test, y_test, plots_dir)
    
    # Save model
    logger.info("\n[Step 7] Saving model...")
    rf_model.save_model(model_dir)
    
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

