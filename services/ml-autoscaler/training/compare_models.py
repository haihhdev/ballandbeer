"""
Compare Random Forest and LSTM-CNN models for K8s auto-scaling prediction

This script:
1. Trains both models on the same dataset
2. Evaluates and compares their performance
3. Generates comprehensive comparison visualizations
4. Provides recommendations
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
import json
import logging
from typing import Dict, Tuple
import time

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import config
from data_preprocessor import DataPreprocessor
from training.random_forest import RandomForestScalingModel
from training.lstm_cnn import LSTMCNNScalingModel
from sklearn.model_selection import train_test_split

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ModelComparison:
    def __init__(self):
        self.rf_model = RandomForestScalingModel()
        self.lstm_cnn_model = LSTMCNNScalingModel()
        self.comparison_results = {}
        
    def train_and_evaluate_rf(self, X_train: pd.DataFrame, y_train: pd.Series,
                               X_test: pd.DataFrame, y_test: pd.Series) -> Dict:
        """Train and evaluate Random Forest model"""
        logger.info("\n" + "="*80)
        logger.info("TRAINING RANDOM FOREST MODEL")
        logger.info("="*80)
        
        start_time = time.time()
        
        # Train
        self.rf_model.train(X_train, y_train)
        
        # Evaluate
        rf_metrics = self.rf_model.evaluate(X_test, y_test)
        
        # Add training time
        rf_metrics['training_time'] = time.time() - start_time
        
        # Inference time (average over 1000 predictions)
        start_time = time.time()
        for _ in range(1000):
            _ = self.rf_model.predict(X_test.iloc[:1])
        rf_metrics['avg_inference_time_ms'] = (time.time() - start_time) / 1000 * 1000
        
        return rf_metrics
    
    def train_and_evaluate_lstm_cnn(self, X_train: np.ndarray, y_train: np.ndarray,
                                     X_val: np.ndarray, y_val: np.ndarray,
                                     X_test: np.ndarray, y_test: np.ndarray) -> Dict:
        """Train and evaluate LSTM-CNN model"""
        logger.info("\n" + "="*80)
        logger.info("TRAINING LSTM-CNN MODEL")
        logger.info("="*80)
        
        start_time = time.time()
        
        # Train
        self.lstm_cnn_model.train(X_train, y_train, X_val, y_val)
        
        # Evaluate
        lstm_metrics = self.lstm_cnn_model.evaluate(X_test, y_test)
        
        # Add training time
        lstm_metrics['training_time'] = time.time() - start_time
        
        # Inference time (average over 1000 predictions)
        start_time = time.time()
        for _ in range(1000):
            _ = self.lstm_cnn_model.predict(X_test[:1])
        lstm_metrics['avg_inference_time_ms'] = (time.time() - start_time) / 1000 * 1000
        
        return lstm_metrics
    
    def plot_metrics_comparison(self, rf_metrics: Dict, lstm_metrics: Dict,
                                 output_dir: Path) -> None:
        """Plot side-by-side comparison of metrics"""
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Metrics to compare
        metrics_to_plot = [
            ('rmse', 'RMSE (lower is better)'),
            ('mae', 'MAE (lower is better)'),
            ('r2_score', 'R² Score (higher is better)'),
            ('exact_accuracy', 'Exact Accuracy (higher is better)'),
            ('within_1_accuracy', 'Within-1 Accuracy (higher is better)')
        ]
        
        fig, axes = plt.subplots(2, 3, figsize=(18, 10))
        axes = axes.flatten()
        
        for idx, (metric_key, metric_label) in enumerate(metrics_to_plot):
            rf_value = rf_metrics[metric_key]
            lstm_value = lstm_metrics[metric_key]
            
            # Bar plot
            bars = axes[idx].bar(
                ['Random Forest', 'LSTM-CNN'],
                [rf_value, lstm_value],
                color=['#2ecc71', '#3498db'],
                alpha=0.8,
                edgecolor='black',
                linewidth=1.5
            )
            
            axes[idx].set_ylabel(metric_label, fontsize=11, fontweight='bold')
            axes[idx].set_title(f'{metric_label}', fontsize=12, fontweight='bold')
            axes[idx].grid(True, alpha=0.3, axis='y')
            
            # Add value labels on bars
            for bar in bars:
                height = bar.get_height()
                axes[idx].text(
                    bar.get_x() + bar.get_width()/2., height,
                    f'{height:.4f}',
                    ha='center', va='bottom',
                    fontweight='bold'
                )
            
            # Highlight better model
            if metric_key in ['rmse', 'mae']:  # Lower is better
                better_idx = 0 if rf_value < lstm_value else 1
            else:  # Higher is better
                better_idx = 0 if rf_value > lstm_value else 1
            bars[better_idx].set_linewidth(3)
            bars[better_idx].set_edgecolor('gold')
        
        # Training time comparison
        axes[5].bar(
            ['Random Forest', 'LSTM-CNN'],
            [rf_metrics['training_time'], lstm_metrics['training_time']],
            color=['#2ecc71', '#3498db'],
            alpha=0.8,
            edgecolor='black',
            linewidth=1.5
        )
        axes[5].set_ylabel('Time (seconds)', fontsize=11, fontweight='bold')
        axes[5].set_title('Training Time (lower is better)', fontsize=12, fontweight='bold')
        axes[5].grid(True, alpha=0.3, axis='y')
        
        plt.suptitle(
            'Model Comparison: Random Forest vs LSTM-CNN',
            fontsize=16,
            fontweight='bold',
            y=1.00
        )
        plt.tight_layout()
        
        output_path = output_dir / 'model_comparison.png'
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        plt.close()
        
        logger.info(f"Comparison plot saved to {output_path}")
    
    def plot_prediction_comparison(self, X_test_rf: pd.DataFrame, 
                                    X_test_lstm: np.ndarray,
                                    y_test_rf: pd.Series,
                                    y_test_lstm: np.ndarray,
                                    output_dir: Path) -> None:
        """Plot predictions from both models"""
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Get predictions
        rf_pred = self.rf_model.predict(X_test_rf)
        lstm_pred = self.lstm_cnn_model.predict(X_test_lstm)
        
        # Align lengths (LSTM has shorter predictions due to sequences)
        min_len = min(len(y_test_rf), len(y_test_lstm))
        y_test_rf = y_test_rf.values[-min_len:]
        y_test_lstm = y_test_lstm[-min_len:]
        rf_pred = rf_pred[-min_len:]
        lstm_pred = lstm_pred[-min_len:]
        
        fig, axes = plt.subplots(2, 2, figsize=(16, 12))
        
        # Random Forest scatter
        axes[0, 0].scatter(y_test_rf, rf_pred, alpha=0.4, s=10, c='#2ecc71')
        axes[0, 0].plot([1, 10], [1, 10], 'r--', lw=2, label='Perfect Prediction')
        axes[0, 0].set_xlabel('Actual Replicas', fontsize=11)
        axes[0, 0].set_ylabel('Predicted Replicas', fontsize=11)
        axes[0, 0].set_title('Random Forest: Predicted vs Actual', fontsize=13, fontweight='bold')
        axes[0, 0].legend()
        axes[0, 0].grid(True, alpha=0.3)
        
        # LSTM-CNN scatter
        axes[0, 1].scatter(y_test_lstm, lstm_pred, alpha=0.4, s=10, c='#3498db')
        axes[0, 1].plot([1, 10], [1, 10], 'r--', lw=2, label='Perfect Prediction')
        axes[0, 1].set_xlabel('Actual Replicas', fontsize=11)
        axes[0, 1].set_ylabel('Predicted Replicas', fontsize=11)
        axes[0, 1].set_title('LSTM-CNN: Predicted vs Actual', fontsize=13, fontweight='bold')
        axes[0, 1].legend()
        axes[0, 1].grid(True, alpha=0.3)
        
        # Error distribution
        rf_errors = rf_pred - y_test_rf
        lstm_errors = lstm_pred - y_test_lstm
        
        axes[1, 0].hist(rf_errors, bins=30, alpha=0.7, color='#2ecc71', 
                        edgecolor='black', label='Random Forest')
        axes[1, 0].hist(lstm_errors, bins=30, alpha=0.7, color='#3498db',
                        edgecolor='black', label='LSTM-CNN')
        axes[1, 0].axvline(0, color='red', linestyle='--', linewidth=2, label='Perfect Prediction')
        axes[1, 0].set_xlabel('Prediction Error (Predicted - Actual)', fontsize=11)
        axes[1, 0].set_ylabel('Frequency', fontsize=11)
        axes[1, 0].set_title('Error Distribution Comparison', fontsize=13, fontweight='bold')
        axes[1, 0].legend()
        axes[1, 0].grid(True, alpha=0.3, axis='y')
        
        # Time series comparison (last 200 samples)
        sample_size = min(200, len(y_test_rf))
        x_range = range(sample_size)
        
        axes[1, 1].plot(x_range, y_test_rf[-sample_size:], 'k-', 
                        linewidth=2, label='Actual', alpha=0.7)
        axes[1, 1].plot(x_range, rf_pred[-sample_size:], 
                        color='#2ecc71', linewidth=1.5, label='RF Prediction', alpha=0.8)
        axes[1, 1].plot(x_range, lstm_pred[-sample_size:],
                        color='#3498db', linewidth=1.5, label='LSTM-CNN Prediction', alpha=0.8)
        axes[1, 1].set_xlabel('Time Step', fontsize=11)
        axes[1, 1].set_ylabel('Number of Replicas', fontsize=11)
        axes[1, 1].set_title('Prediction Tracking Over Time', fontsize=13, fontweight='bold')
        axes[1, 1].legend()
        axes[1, 1].grid(True, alpha=0.3)
        
        plt.suptitle(
            'Detailed Prediction Comparison',
            fontsize=16,
            fontweight='bold',
            y=0.995
        )
        plt.tight_layout()
        
        output_path = output_dir / 'prediction_comparison.png'
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        plt.close()
        
        logger.info(f"Prediction comparison plot saved to {output_path}")
    
    def generate_summary_report(self, rf_metrics: Dict, lstm_metrics: Dict,
                                 output_dir: Path) -> None:
        """Generate summary report"""
        output_dir.mkdir(parents=True, exist_ok=True)
        
        report = {
            'random_forest': rf_metrics,
            'lstm_cnn': lstm_metrics,
            'comparison': {
                'better_rmse': 'Random Forest' if rf_metrics['rmse'] < lstm_metrics['rmse'] else 'LSTM-CNN',
                'better_accuracy': 'Random Forest' if rf_metrics['exact_accuracy'] > lstm_metrics['exact_accuracy'] else 'LSTM-CNN',
                'faster_training': 'Random Forest' if rf_metrics['training_time'] < lstm_metrics['training_time'] else 'LSTM-CNN',
                'faster_inference': 'Random Forest' if rf_metrics['avg_inference_time_ms'] < lstm_metrics['avg_inference_time_ms'] else 'LSTM-CNN'
            },
            'recommendation': self._generate_recommendation(rf_metrics, lstm_metrics)
        }
        
        # Save JSON
        report_path = output_dir / 'comparison_report.json'
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)
        
        # Save text report
        text_report_path = output_dir / 'comparison_report.txt'
        with open(text_report_path, 'w') as f:
            f.write("="*80 + "\n")
            f.write("MODEL COMPARISON REPORT: Random Forest vs LSTM-CNN\n")
            f.write("="*80 + "\n\n")
            
            f.write("RANDOM FOREST METRICS:\n")
            f.write("-" * 40 + "\n")
            for key, value in rf_metrics.items():
                f.write(f"  {key:25s}: {value:.6f}\n")
            
            f.write("\n\nLSTM-CNN METRICS:\n")
            f.write("-" * 40 + "\n")
            for key, value in lstm_metrics.items():
                f.write(f"  {key:25s}: {value:.6f}\n")
            
            f.write("\n\nCOMPARISON SUMMARY:\n")
            f.write("-" * 40 + "\n")
            for key, value in report['comparison'].items():
                f.write(f"  {key:25s}: {value}\n")
            
            f.write("\n\nRECOMMENDATION:\n")
            f.write("-" * 40 + "\n")
            f.write(report['recommendation'])
        
        logger.info(f"Comparison report saved to {report_path}")
        logger.info(f"Text report saved to {text_report_path}")
    
    def _generate_recommendation(self, rf_metrics: Dict, lstm_metrics: Dict) -> str:
        """Generate recommendation based on metrics"""
        recommendation = ""
        
        # Count wins
        rf_wins = 0
        lstm_wins = 0
        
        # Performance metrics (lower is better)
        if rf_metrics['rmse'] < lstm_metrics['rmse']:
            rf_wins += 2
        else:
            lstm_wins += 2
            
        # Accuracy metrics (higher is better)
        if rf_metrics['exact_accuracy'] > lstm_metrics['exact_accuracy']:
            rf_wins += 2
        else:
            lstm_wins += 2
        
        if rf_metrics['within_1_accuracy'] > lstm_metrics['within_1_accuracy']:
            rf_wins += 1
        else:
            lstm_wins += 1
        
        # Speed metrics
        if rf_metrics['training_time'] < lstm_metrics['training_time']:
            rf_wins += 1
        else:
            lstm_wins += 1
        
        if rf_metrics['avg_inference_time_ms'] < lstm_metrics['avg_inference_time_ms']:
            rf_wins += 2  # Inference speed is important for real-time
        else:
            lstm_wins += 2
        
        recommendation += f"Score: Random Forest = {rf_wins}, LSTM-CNN = {lstm_wins}\n\n"
        
        if rf_wins > lstm_wins:
            recommendation += "RECOMMENDATION: Random Forest\n\n"
            recommendation += "Random Forest is recommended for this use case because:\n"
            recommendation += "• Better overall performance metrics\n"
            recommendation += "• Faster training and inference times\n"
            recommendation += "• Simpler to deploy and maintain\n"
            recommendation += "• More interpretable (feature importance)\n"
            recommendation += "• Less resource intensive\n"
            recommendation += "\nRandom Forest is ideal for production deployment where:\n"
            recommendation += "- Fast inference is critical\n"
            recommendation += "- Model interpretability is important\n"
            recommendation += "- Resource constraints exist\n"
        else:
            recommendation += "RECOMMENDATION: LSTM-CNN\n\n"
            recommendation += "LSTM-CNN is recommended for this use case because:\n"
            recommendation += "• Better prediction accuracy\n"
            recommendation += "• Captures temporal patterns more effectively\n"
            recommendation += "• Better at detecting complex patterns in metrics\n"
            recommendation += "• More suitable for time-series data\n"
            recommendation += "\nLSTM-CNN is ideal when:\n"
            recommendation += "- Accuracy is the top priority\n"
            recommendation += "- You have sufficient computational resources\n"
            recommendation += "- Temporal dependencies are important\n"
        
        return recommendation


def main():
    """Main comparison pipeline"""
    logger.info("="*80)
    logger.info("MODEL COMPARISON: Random Forest vs LSTM-CNN")
    logger.info("="*80)
    
    # Create output directories
    output_dir = Path(config.COMPARISON_OUTPUT_DIR)
    model_dir = Path(config.MODEL_OUTPUT_DIR)
    plots_dir = Path(config.PLOTS_OUTPUT_DIR)
    
    for directory in [output_dir, model_dir, plots_dir]:
        directory.mkdir(parents=True, exist_ok=True)
    
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
    
    # Prepare data for both models
    X_array = X.values
    y_array = y.values
    
    # Split data
    logger.info("\n[Step 2] Splitting data...")
    
    # For Random Forest (standard split with shuffle)
    X_train_rf, X_test_rf, y_train_rf, y_test_rf = train_test_split(
        X, y,
        test_size=config.TEST_SIZE,
        random_state=config.RANDOM_STATE,
        shuffle=True
    )
    
    # For LSTM-CNN (temporal split)
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
    
    # Initialize comparison
    comparison = ModelComparison()
    
    # Create sequences for LSTM-CNN
    logger.info("\n[Step 3] Creating sequences for LSTM-CNN...")
    X_train_lstm, y_train_lstm = comparison.lstm_cnn_model.create_sequences(X_train_temp, y_train_temp)
    X_val_lstm, y_val_lstm = comparison.lstm_cnn_model.create_sequences(X_val_temp, y_val_temp)
    X_test_lstm, y_test_lstm = comparison.lstm_cnn_model.create_sequences(X_test_temp, y_test_temp)
    
    # Train and evaluate Random Forest
    logger.info("\n[Step 4] Training Random Forest...")
    rf_metrics = comparison.train_and_evaluate_rf(X_train_rf, y_train_rf, X_test_rf, y_test_rf)
    
    # Train and evaluate LSTM-CNN
    logger.info("\n[Step 5] Training LSTM-CNN...")
    lstm_metrics = comparison.train_and_evaluate_lstm_cnn(
        X_train_lstm, y_train_lstm,
        X_val_lstm, y_val_lstm,
        X_test_lstm, y_test_lstm
    )
    
    # Generate visualizations
    logger.info("\n[Step 6] Generating comparison visualizations...")
    comparison.plot_metrics_comparison(rf_metrics, lstm_metrics, output_dir)
    comparison.plot_prediction_comparison(X_test_rf, X_test_lstm, y_test_rf, y_test_lstm, output_dir)
    
    # Generate summary report
    logger.info("\n[Step 7] Generating summary report...")
    comparison.generate_summary_report(rf_metrics, lstm_metrics, output_dir)
    
    # Save individual models
    logger.info("\n[Step 8] Saving models...")
    comparison.rf_model.save_model(model_dir)
    comparison.rf_model.plot_feature_importance(plots_dir)
    comparison.rf_model.plot_predictions(X_test_rf, y_test_rf, plots_dir)
    
    comparison.lstm_cnn_model.save_model(model_dir)
    comparison.lstm_cnn_model.plot_training_history(plots_dir)
    comparison.lstm_cnn_model.plot_predictions(X_test_lstm, y_test_lstm, plots_dir)
    
    logger.info("\n" + "="*80)
    logger.info("COMPARISON COMPLETED SUCCESSFULLY!")
    logger.info("="*80)
    logger.info(f"\nResults saved to: {output_dir}")
    logger.info(f"Models saved to: {model_dir}")
    logger.info(f"Plots saved to: {plots_dir}")
    
    logger.info("\n" + "="*80)
    logger.info("FINAL COMPARISON SUMMARY")
    logger.info("="*80)
    logger.info("\nRandom Forest:")
    for key, value in rf_metrics.items():
        logger.info(f"  {key:25s}: {value:.6f}")
    
    logger.info("\nLSTM-CNN:")
    for key, value in lstm_metrics.items():
        logger.info(f"  {key:25s}: {value:.6f}")


if __name__ == '__main__':
    main()

