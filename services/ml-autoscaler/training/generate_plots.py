"""
Generate plots from trained model
"""

import pandas as pd
import numpy as np
import keras
import joblib
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
import sys
import json
import logging

sys.path.insert(0, str(Path(__file__).parent.parent))

import config
from data_preprocessor import DataPreprocessor

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def load_model_and_data():
    """Load trained model and test data"""
    logger.info("Loading model and data...")
    
    # Load model
    model = keras.models.load_model('../models/transformer_model.keras')
    scaler = joblib.load('../models/transformer_scaler.joblib')
    
    # Load data
    preprocessor = DataPreprocessor()
    balanced_path = '../metrics/balanced' if Path('../metrics/balanced').exists() else None
    
    if balanced_path:
        X, y = preprocessor.process_full_pipeline(balanced_path)
        data = preprocessor.load_local_folder(balanced_path)
    else:
        X, y = preprocessor.process_full_pipeline('local')
        data = preprocessor.load_local_folder('../metrics')
    
    data_clean = preprocessor.clean_data(data)
    service_names = data_clean['service_name'].values
    
    return model, scaler, X.values, y.values, service_names


def create_sequences(X, y, service_names, sequence_length=12):
    """Create sequences"""
    sequences = []
    targets = []
    services = []
    
    for i in range(len(X) - sequence_length):
        sequences.append(X[i:i+sequence_length])
        targets.append(y[i+sequence_length])
        services.append(service_names[i+sequence_length])
    
    return np.array(sequences), np.array(targets), services


def main():
    logger.info("Generating plots from trained model...")
    
    # Load
    model, scaler, X, y, service_names = load_model_and_data()
    
    # Split (same as training)
    split_idx = int(len(X) * 0.8)
    X_test = X[split_idx:]
    y_test = y[split_idx:]
    service_test = service_names[split_idx:]
    
    # Scale and sequence
    X_test_scaled = scaler.transform(X_test)
    X_test_seq, y_test_seq, service_test_seq = create_sequences(X_test_scaled, y_test, service_test)
    
    logger.info(f"Test sequences: {X_test_seq.shape}")
    
    # Predict
    predictions_raw = model.predict(X_test_seq, verbose=0).flatten()
    predictions = np.clip(np.round(predictions_raw), 1, 10).astype(int)
    
    logger.info("Generating plots...")
    
    # Load training history
    try:
        with open('../models/transformer_history.json', 'r') as f:
            history_dict = json.load(f)
    except:
        logger.warning("Could not load training history, skipping history plot")
        history_dict = None
    
    plots_dir = Path('../plots')
    plots_dir.mkdir(exist_ok=True)
    
    # 1. Training History
    if history_dict:
        fig, axes = plt.subplots(1, 2, figsize=(12, 4))
        
        epochs = range(1, len(history_dict['loss']) + 1)
        
        axes[0].plot(epochs, history_dict['loss'], 'b-', label='Train Loss', linewidth=2)
        axes[0].plot(epochs, history_dict['val_loss'], 'r-', label='Val Loss', linewidth=2)
        axes[0].set_xlabel('Epoch', fontsize=12)
        axes[0].set_ylabel('Loss (MSE)', fontsize=12)
        axes[0].set_title('Training History - Loss', fontsize=14, fontweight='bold')
        axes[0].legend(fontsize=10)
        axes[0].grid(True, alpha=0.3)
        
        axes[1].plot(epochs, history_dict['mae'], 'b-', label='Train MAE', linewidth=2)
        axes[1].plot(epochs, history_dict['val_mae'], 'r-', label='Val MAE', linewidth=2)
        axes[1].set_xlabel('Epoch', fontsize=12)
        axes[1].set_ylabel('MAE', fontsize=12)
        axes[1].set_title('Training History - MAE', fontsize=14, fontweight='bold')
        axes[1].legend(fontsize=10)
        axes[1].grid(True, alpha=0.3)
        
        plt.tight_layout()
        plt.savefig(plots_dir / 'transformer_training_history.png', dpi=150, bbox_inches='tight')
        logger.info("✓ Saved training history plot")
        plt.close()
    
    # 2a. Predictions vs Actual - Scatter Plot (per service)
    fig, axes = plt.subplots(2, 4, figsize=(16, 8))
    axes = axes.flatten()
    
    for i, service in enumerate(config.SERVICES):
        mask = np.array([s == service for s in service_test_seq])
        if mask.sum() == 0:
            axes[i].text(0.5, 0.5, 'No data', ha='center', va='center', fontsize=14)
            axes[i].set_title(f'{service.capitalize()}', fontsize=12, fontweight='bold')
            continue
        
        y_svc = y_test_seq[mask]
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
    plt.savefig(plots_dir / 'transformer_predictions_scatter.png', dpi=150, bbox_inches='tight')
    logger.info("✓ Saved predictions scatter plot")
    plt.close()
    
    # 2b. Predictions vs Actual - Bar Chart (per service)
    fig, axes = plt.subplots(2, 4, figsize=(16, 8))
    axes = axes.flatten()
    
    for i, service in enumerate(config.SERVICES):
        mask = np.array([s == service for s in service_test_seq])
        if mask.sum() == 0:
            axes[i].text(0.5, 0.5, 'No data', ha='center', va='center', fontsize=14)
            axes[i].set_title(f'{service.capitalize()}', fontsize=12, fontweight='bold')
            continue
        
        y_svc = y_test_seq[mask]
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
    plt.savefig(plots_dir / 'transformer_predictions.png', dpi=150, bbox_inches='tight')
    logger.info("✓ Saved predictions bar chart")
    plt.close()
    
    # 3. Error distribution per service
    fig, axes = plt.subplots(2, 4, figsize=(16, 8))
    axes = axes.flatten()
    
    for i, service in enumerate(config.SERVICES):
        mask = np.array([s == service for s in service_test_seq])
        if mask.sum() == 0:
            continue
        
        y_svc = y_test_seq[mask]
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
    plt.savefig(plots_dir / 'transformer_errors.png', dpi=150, bbox_inches='tight')
    logger.info("✓ Saved error distribution plot")
    plt.close()
    
    logger.info(f"\n{'='*70}")
    logger.info("All plots generated successfully!")
    logger.info(f"Location: {plots_dir.absolute()}")
    logger.info(f"{'='*70}")


if __name__ == '__main__':
    main()

