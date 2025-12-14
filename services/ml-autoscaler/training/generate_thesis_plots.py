"""
Generate comprehensive plots for graduation thesis / scientific research

Plots generated:
1. Data Distribution - Replica class distribution per service
2. Feature Correlation Heatmap - Show feature relationships
3. Training History - Loss curves for all services
4. Predictions Distribution - Actual vs Predicted bar chart
5. Confusion Matrix - Per service classification accuracy
6. Scatter Plot - Actual vs Predicted with regression line
7. Error Distribution - Histogram of prediction errors
8. Model Architecture - Transformer architecture diagram
9. Metrics Comparison - Bar chart comparing services
10. System Architecture - Overall system flow diagram

Usage:
    python generate_thesis_plots.py
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
import json
from sklearn.metrics import confusion_matrix
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))
import config

# Set style for thesis
plt.style.use('seaborn-v0_8-whitegrid')
plt.rcParams['font.family'] = 'serif'
plt.rcParams['font.size'] = 11
plt.rcParams['axes.labelsize'] = 12
plt.rcParams['axes.titlesize'] = 13
plt.rcParams['figure.titlesize'] = 14

PLOTS_DIR = Path(__file__).parent.parent / 'plots'
# Prioritize balanced_v2, fallback to filtered
if (Path(__file__).parent.parent / 'metrics' / 'balanced_v2').exists():
    METRICS_DIR = Path(__file__).parent.parent / 'metrics' / 'balanced_v2'
else:
    METRICS_DIR = Path(__file__).parent.parent / 'metrics' / 'filtered'
MODELS_DIR = Path(__file__).parent.parent / 'models'

# Services to include (exclude profile - rarely scales)
SERVICES = [s for s in config.SERVICES if s != 'profile']


def load_all_data():
    """Load all filtered CSV files"""
    dfs = []
    for csv_file in METRICS_DIR.glob('*.csv'):
        df = pd.read_csv(csv_file)
        dfs.append(df)
    return pd.concat(dfs, ignore_index=True)


def plot_data_distribution(data):
    """Plot 1: Replica class distribution per service"""
    fig, axes = plt.subplots(2, 3, figsize=(14, 9))
    axes = axes.flatten()
    
    colors = plt.cm.Set2(np.linspace(0, 1, 5))
    
    for i, service in enumerate(SERVICES):
        svc_data = data[data['service_name'] == service]
        replica_counts = svc_data['replica_count'].value_counts().sort_index()
        
        bars = axes[i].bar(replica_counts.index, replica_counts.values, 
                          color=colors, edgecolor='black', linewidth=1.2)
        
        # Add value labels on bars
        for bar, val in zip(bars, replica_counts.values):
            axes[i].text(bar.get_x() + bar.get_width()/2, bar.get_height() + 50,
                        f'{val}', ha='center', va='bottom', fontsize=9, fontweight='bold')
        
        total = len(svc_data)
        axes[i].set_title(f'{service.capitalize()}\n(n={total:,})', fontweight='bold')
        axes[i].set_xlabel('Replica Count')
        axes[i].set_ylabel('Frequency')
        axes[i].set_xticks([1, 2, 3, 4, 5])
    
    plt.suptitle('Data Distribution: Replica Count per Service', fontsize=16, fontweight='bold', y=1.02)
    plt.tight_layout()
    plt.savefig(PLOTS_DIR / '01_data_distribution.png', dpi=200, bbox_inches='tight', 
                facecolor='white', edgecolor='none')
    print("Saved: 01_data_distribution.png")
    plt.close()


def plot_feature_correlation(data):
    """Plot 2: Feature correlation heatmap"""
    feature_cols = [
        'cpu_usage_percent', 'ram_usage_percent', 
        'request_count_per_second', 'response_time_ms',
        'cpu_usage_percent_slope', 'ram_usage_percent_slope',
        'replica_count'
    ]
    
    # Filter existing columns
    existing_cols = [c for c in feature_cols if c in data.columns]
    corr_matrix = data[existing_cols].corr()
    
    fig, ax = plt.subplots(figsize=(10, 8))
    
    mask = np.triu(np.ones_like(corr_matrix, dtype=bool), k=1)
    
    sns.heatmap(corr_matrix, mask=mask, annot=True, fmt='.2f', 
                cmap='RdBu_r', center=0, vmin=-1, vmax=1,
                square=True, linewidths=0.5,
                cbar_kws={'label': 'Correlation Coefficient'},
                ax=ax)
    
    ax.set_title('Feature Correlation Matrix', fontsize=14, fontweight='bold', pad=20)
    
    # Improve label readability
    labels = [c.replace('_', '\n') for c in existing_cols]
    ax.set_xticklabels(labels, rotation=45, ha='right')
    ax.set_yticklabels(labels, rotation=0)
    
    plt.tight_layout()
    plt.savefig(PLOTS_DIR / '02_feature_correlation.png', dpi=200, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    print("Saved: 02_feature_correlation.png")
    plt.close()


def plot_class_imbalance(data):
    """Plot 3: Class imbalance analysis"""
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    
    # Overall distribution
    replica_counts = data['replica_count'].value_counts().sort_index()
    colors = plt.cm.Blues(np.linspace(0.4, 0.9, len(replica_counts)))
    
    bars = axes[0].bar(replica_counts.index, replica_counts.values, color=colors, 
                       edgecolor='navy', linewidth=1.5)
    
    for bar, val in zip(bars, replica_counts.values):
        pct = val / len(data) * 100
        axes[0].text(bar.get_x() + bar.get_width()/2, bar.get_height() + 200,
                    f'{pct:.1f}%', ha='center', va='bottom', fontsize=10, fontweight='bold')
    
    axes[0].set_xlabel('Replica Count', fontsize=12)
    axes[0].set_ylabel('Frequency', fontsize=12)
    axes[0].set_title('Overall Replica Distribution', fontsize=13, fontweight='bold')
    axes[0].set_xticks([1, 2, 3, 4, 5])
    
    # Imbalance ratio per service
    ir_values = []
    
    for service in SERVICES:
        svc_data = data[data['service_name'] == service]
        counts = svc_data['replica_count'].value_counts()
        ir = counts.max() / counts.min() if counts.min() > 0 else float('inf')
        ir_values.append(min(ir, 100))  # Cap at 100 for visualization
    
    colors = ['green' if ir < 10 else 'orange' if ir < 30 else 'red' for ir in ir_values]
    bars = axes[1].bar(SERVICES, ir_values, color=colors, edgecolor='black', linewidth=1.2)
    
    axes[1].axhline(y=10, color='green', linestyle='--', linewidth=1.5, label='Good (IR<10)')
    axes[1].axhline(y=30, color='orange', linestyle='--', linewidth=1.5, label='Moderate (IR<30)')
    
    axes[1].set_xlabel('Service', fontsize=12)
    axes[1].set_ylabel('Imbalance Ratio', fontsize=12)
    axes[1].set_title('Class Imbalance Ratio per Service', fontsize=13, fontweight='bold')
    axes[1].legend(loc='upper right')
    axes[1].set_xticklabels([s.capitalize() for s in SERVICES], rotation=45, ha='right')
    
    plt.suptitle('Class Imbalance Analysis', fontsize=16, fontweight='bold', y=1.02)
    plt.tight_layout()
    plt.savefig(PLOTS_DIR / '03_class_imbalance.png', dpi=200, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    print("Saved: 03_class_imbalance.png")
    plt.close()


def plot_metrics_comparison():
    """Plot 4: Model performance metrics comparison"""
    metrics_file = MODELS_DIR / 'per_service_metrics.json'
    
    if not metrics_file.exists():
        print("Warning: per_service_metrics.json not found, skipping metrics comparison")
        return
    
    with open(metrics_file) as f:
        metrics = json.load(f)
    
    # Filter out profile service if present
    services = [s for s in metrics.keys() if s != 'profile' and s in SERVICES]
    exact_acc = [metrics[s]['exact_accuracy'] * 100 for s in services]
    within_1 = [metrics[s]['within_1_accuracy'] * 100 for s in services]
    mae = [metrics[s]['mae'] for s in services]
    r2 = [metrics[s]['r2'] for s in services]
    
    fig, axes = plt.subplots(2, 2, figsize=(14, 10))
    
    x = np.arange(len(services))
    width = 0.35
    
    # Exact Accuracy
    colors = ['#2ecc71' if a >= 90 else '#f39c12' if a >= 80 else '#e74c3c' for a in exact_acc]
    bars = axes[0, 0].bar(x, exact_acc, color=colors, edgecolor='black', linewidth=1.2)
    axes[0, 0].axhline(y=90, color='green', linestyle='--', alpha=0.7, label='Target: 90%')
    axes[0, 0].set_ylabel('Accuracy (%)')
    axes[0, 0].set_title('Exact Accuracy', fontweight='bold')
    axes[0, 0].set_xticks(x)
    axes[0, 0].set_xticklabels([s.capitalize() for s in services], rotation=45, ha='right')
    axes[0, 0].set_ylim(0, 100)
    axes[0, 0].legend()
    for bar, val in zip(bars, exact_acc):
        axes[0, 0].text(bar.get_x() + bar.get_width()/2, bar.get_height() + 1,
                       f'{val:.1f}%', ha='center', va='bottom', fontsize=9, fontweight='bold')
    
    # Within-1 Accuracy
    colors_w1 = ['#2ecc71' if a >= 95 else '#3498db' if a >= 80 else '#e74c3c' for a in within_1]
    bars = axes[0, 1].bar(x, within_1, color=colors_w1, edgecolor='black', linewidth=1.2)
    axes[0, 1].axhline(y=95, color='green', linestyle='--', alpha=0.7, label='Target: 95%')
    axes[0, 1].set_ylabel('Accuracy (%)')
    axes[0, 1].set_title('Within-1 Accuracy', fontweight='bold')
    axes[0, 1].set_xticks(x)
    axes[0, 1].set_xticklabels([s.capitalize() for s in services], rotation=45, ha='right')
    axes[0, 1].set_ylim(0, 100)  # Show full range to accommodate all values
    axes[0, 1].legend()
    for bar, val in zip(bars, within_1):
        axes[0, 1].text(bar.get_x() + bar.get_width()/2, bar.get_height() + 1,
                       f'{val:.1f}%', ha='center', va='bottom', fontsize=9, fontweight='bold')
    
    # MAE
    colors = ['#2ecc71' if m <= 0.1 else '#f39c12' if m <= 0.2 else '#e74c3c' for m in mae]
    bars = axes[1, 0].bar(x, mae, color=colors, edgecolor='black', linewidth=1.2)
    axes[1, 0].axhline(y=0.1, color='green', linestyle='--', alpha=0.7, label='Target: 0.1')
    axes[1, 0].set_ylabel('MAE')
    axes[1, 0].set_title('Mean Absolute Error', fontweight='bold')
    axes[1, 0].set_xticks(x)
    axes[1, 0].set_xticklabels([s.capitalize() for s in services], rotation=45, ha='right')
    axes[1, 0].legend()
    for bar, val in zip(bars, mae):
        axes[1, 0].text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.005,
                       f'{val:.3f}', ha='center', va='bottom', fontsize=9, fontweight='bold')
    
    # R² Score
    colors = ['#2ecc71' if r >= 0.5 else '#f39c12' if r >= 0 else '#e74c3c' for r in r2]
    bars = axes[1, 1].bar(x, r2, color=colors, edgecolor='black', linewidth=1.2)
    axes[1, 1].axhline(y=0.5, color='green', linestyle='--', alpha=0.7, label='Target: 0.5')
    axes[1, 1].axhline(y=0, color='gray', linestyle='-', alpha=0.5)
    axes[1, 1].set_ylabel('R² Score')
    axes[1, 1].set_title('Coefficient of Determination (R²)', fontweight='bold')
    axes[1, 1].set_xticks(x)
    axes[1, 1].set_xticklabels([s.capitalize() for s in services], rotation=45, ha='right')
    axes[1, 1].legend()
    for bar, val in zip(bars, r2):
        y_pos = bar.get_height() + 0.02 if val >= 0 else bar.get_height() - 0.05
        axes[1, 1].text(bar.get_x() + bar.get_width()/2, y_pos,
                       f'{val:.3f}', ha='center', va='bottom', fontsize=9, fontweight='bold')
    
    plt.suptitle('Model Performance Metrics Comparison', fontsize=16, fontweight='bold', y=1.02)
    plt.tight_layout()
    plt.savefig(PLOTS_DIR / '04_metrics_comparison.png', dpi=200, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    print("Saved: 04_metrics_comparison.png")
    plt.close()


def plot_transformer_architecture():
    """Plot 5: Transformer model architecture diagram"""
    fig, ax = plt.subplots(figsize=(12, 14))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 16)
    ax.axis('off')
    
    # Colors
    input_color = '#3498db'
    transformer_color = '#9b59b6'
    output_color = '#2ecc71'
    arrow_color = '#34495e'
    
    def draw_box(x, y, w, h, text, color, fontsize=10):
        rect = plt.Rectangle((x, y), w, h, facecolor=color, edgecolor='black', linewidth=2)
        ax.add_patch(rect)
        ax.text(x + w/2, y + h/2, text, ha='center', va='center', fontsize=fontsize, 
                fontweight='bold', color='white' if color != '#ecf0f1' else 'black')
    
    def draw_arrow(x1, y1, x2, y2):
        ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                   arrowprops=dict(arrowstyle='->', color=arrow_color, lw=2))
    
    # Title
    ax.text(5, 15.5, 'Transformer Decoder-Only Architecture', ha='center', va='center',
            fontsize=16, fontweight='bold')
    ax.text(5, 15, 'for Time Series Replica Prediction', ha='center', va='center',
            fontsize=12, style='italic')
    
    # Input
    draw_box(2.5, 13.5, 5, 0.8, 'Input: (batch, 40, 24)', input_color, 11)
    ax.text(8, 13.9, 'Sequence length=40 (20 min)\nFeatures=24', fontsize=9, va='center')
    
    # Linear Projection
    draw_arrow(5, 13.5, 5, 12.8)
    draw_box(2.5, 12, 5, 0.8, 'Linear Projection (d_model=128)', '#ecf0f1', 10)
    
    # Positional Encoding
    draw_arrow(5, 12, 5, 11.3)
    draw_box(2.5, 10.5, 5, 0.8, '+ Sinusoidal Positional Encoding', '#f39c12', 10)
    
    # Transformer Block 1
    draw_arrow(5, 10.5, 5, 9.8)
    draw_box(1.5, 7, 7, 2.8, '', transformer_color)
    ax.text(5, 9.5, 'Transformer Block x2', ha='center', va='center', fontsize=11, 
            fontweight='bold', color='white')
    
    # Inside transformer block
    draw_box(2, 8.5, 6, 0.6, 'Multi-Head Attention (4 heads) + Causal Mask', '#8e44ad', 9)
    draw_box(2, 7.8, 6, 0.5, 'Residual + LayerNorm', '#7f8c8d', 9)
    draw_box(2, 7.2, 6, 0.5, 'FFN (256 units, GELU) + Residual + LayerNorm', '#8e44ad', 9)
    
    # Take last timestep
    draw_arrow(5, 7, 5, 6.3)
    draw_box(2.5, 5.5, 5, 0.8, 'Take Last Timestep [:, -1, :]', '#ecf0f1', 10)
    
    # Prediction Head
    draw_arrow(5, 5.5, 5, 4.8)
    draw_box(1.5, 3, 7, 1.8, '', output_color)
    ax.text(5, 4.5, 'Prediction Head', ha='center', va='center', fontsize=11, 
            fontweight='bold', color='white')
    draw_box(2, 3.8, 6, 0.5, 'Dense(64, GELU) + Dropout(0.2)', '#27ae60', 9)
    draw_box(2, 3.2, 6, 0.5, 'Dense(32, GELU) + Dropout(0.2)', '#27ae60', 9)
    
    # Output
    draw_arrow(5, 3, 5, 2.3)
    draw_box(2.5, 1.5, 5, 0.8, 'Output: Predicted Replica (1-5)', output_color, 11)
    
    # Parameters
    ax.text(5, 0.5, 'Total Parameters: 278,529 per model', ha='center', va='center',
            fontsize=11, style='italic')
    
    plt.tight_layout()
    plt.savefig(PLOTS_DIR / '05_model_architecture.png', dpi=200, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    print("Saved: 05_model_architecture.png")
    plt.close()


def plot_system_architecture():
    """Plot 6: Overall system architecture diagram"""
    fig, ax = plt.subplots(figsize=(16, 10))
    ax.set_xlim(0, 16)
    ax.set_ylim(0, 10)
    ax.axis('off')
    
    def draw_box(x, y, w, h, text, color, fontsize=10):
        rect = plt.Rectangle((x, y), w, h, facecolor=color, edgecolor='black', 
                             linewidth=2, alpha=0.9)
        ax.add_patch(rect)
        lines = text.split('\n')
        for i, line in enumerate(lines):
            ax.text(x + w/2, y + h/2 + (len(lines)/2 - i - 0.5) * 0.3, line, 
                   ha='center', va='center', fontsize=fontsize, fontweight='bold')
    
    def draw_arrow(x1, y1, x2, y2, label=''):
        ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                   arrowprops=dict(arrowstyle='->', color='#34495e', lw=2))
        if label:
            ax.text((x1+x2)/2, (y1+y2)/2 + 0.2, label, ha='center', fontsize=8, style='italic')
    
    # Title
    ax.text(8, 9.5, 'ML-Based Proactive Autoscaling System Architecture', 
            ha='center', fontsize=16, fontweight='bold')
    
    # Kubernetes Cluster
    rect = plt.Rectangle((0.5, 0.5), 5, 7), 
    ax.add_patch(plt.Rectangle((0.5, 0.5), 5, 7, facecolor='#ecf0f1', edgecolor='#2c3e50', 
                               linewidth=3, linestyle='--'))
    ax.text(3, 7.2, 'Kubernetes Cluster', ha='center', fontsize=12, fontweight='bold')
    
    # Services
    draw_box(1, 5, 2, 1.2, 'Microservices\n(6 services)', '#3498db', 9)
    draw_box(1, 3.2, 2, 1.2, 'HPA\n(Horizontal Pod\nAutoscaler)', '#e74c3c', 8)
    draw_box(3.2, 4, 2, 1.5, 'KEDA\n(Event-driven\nAutoscaling)', '#9b59b6', 9)
    
    # Prometheus
    draw_box(6.5, 4, 2.5, 1.5, 'Prometheus\n(Metrics)', '#f39c12', 10)
    
    # ML Autoscaler
    draw_box(10, 3.5, 3, 2.5, 'ML Autoscaler\n\nTransformer\nModels (x6)', '#2ecc71', 10)
    
    # Collector
    draw_box(10, 7, 3, 1.2, 'Metrics Collector\n(Training Data)', '#1abc9c', 9)
    
    # Training Pipeline
    draw_box(14, 6, 1.5, 3, 'Training\nPipeline\n\nOffline', '#95a5a6', 9)
    
    # Arrows
    draw_arrow(3, 5, 3, 4.3)  # Services -> HPA
    draw_arrow(4.2, 4.8, 6.5, 4.8, 'scrape')  # Services -> Prometheus
    draw_arrow(9, 4.8, 10, 4.8, 'query')  # Prometheus -> ML
    draw_arrow(10, 4.5, 5.2, 4.5, 'predictions')  # ML -> KEDA
    draw_arrow(4.2, 4, 3, 3.8)  # KEDA -> HPA
    draw_arrow(9, 4.2, 10, 7.5, '')  # Prometheus -> Collector (vertical)
    draw_arrow(8.5, 5, 10, 7)  
    draw_arrow(13, 7.5, 14, 7.5, 'train')  # Collector -> Training
    draw_arrow(14, 6, 13, 5)  # Training -> ML
    
    # Legend
    ax.text(1, 1, 'Data Flow:', fontsize=10, fontweight='bold')
    ax.text(1, 0.6, '1. Prometheus collects metrics from services', fontsize=9)
    ax.text(1, 0.3, '2. ML Autoscaler queries Prometheus, predicts replicas 5min ahead', fontsize=9)
    ax.text(8, 0.6, '3. KEDA reads predictions, triggers HPA scaling', fontsize=9)
    ax.text(8, 0.3, '4. Collector saves data for offline model retraining', fontsize=9)
    
    plt.tight_layout()
    plt.savefig(PLOTS_DIR / '06_system_architecture.png', dpi=200, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    print("Saved: 06_system_architecture.png")
    plt.close()


def plot_time_series_sample(data):
    """
    Plot 7: Sample time series showing metrics and scaling events
    
    Purpose: Demonstrates the relationship between:
    - Resource metrics (CPU, RAM) and request load
    - How these metrics trigger scaling decisions (replica changes)
    - The temporal patterns that the ML model learns to predict
    
    This is useful for showing:
    - The input features that drive autoscaling
    - The correlation between metrics and scaling events
    - Why proactive prediction (5min ahead) is valuable
    """
    # Get one service data (use first available from SERVICES)
    service = SERVICES[0] if SERVICES else 'authen'
    for svc in ['booking', 'product', 'authen']:  # Prefer services with more scaling
        if svc in SERVICES:
            svc_test = data[data['service_name'] == svc]
            if len(svc_test['replica_count'].unique()) > 2:  # Has scaling variety
                service = svc
                break
    
    svc_data = data[data['service_name'] == service].copy()
    svc_data = svc_data.sort_values('timestamp').head(500)  # First 500 samples (~4 hours)
    
    if len(svc_data) < 100:
        print("Warning: Not enough data for time series plot")
        return
    
    fig, axes = plt.subplots(4, 1, figsize=(14, 12), sharex=True)
    
    x = range(len(svc_data))
    
    # CPU Usage
    axes[0].plot(x, svc_data['cpu_usage_percent'], color='#e74c3c', linewidth=1.5, label='CPU %')
    axes[0].axhline(y=60, color='orange', linestyle='--', alpha=0.7, label='Scale-up threshold (60%)')
    axes[0].fill_between(x, svc_data['cpu_usage_percent'], alpha=0.3, color='#e74c3c')
    axes[0].set_ylabel('CPU (%)')
    axes[0].legend(loc='upper right')
    axes[0].set_title(f'{service.capitalize()} Service - Resource Metrics Over Time', fontweight='bold')
    
    # RAM Usage
    axes[1].plot(x, svc_data['ram_usage_percent'], color='#3498db', linewidth=1.5, label='RAM %')
    axes[1].axhline(y=65, color='orange', linestyle='--', alpha=0.7, label='Scale-up threshold')
    axes[1].fill_between(x, svc_data['ram_usage_percent'], alpha=0.3, color='#3498db')
    axes[1].set_ylabel('RAM (%)')
    axes[1].legend(loc='upper right')
    
    # Request Rate
    axes[2].plot(x, svc_data['request_count_per_second'], color='#2ecc71', linewidth=1.5, label='Requests/s')
    axes[2].fill_between(x, svc_data['request_count_per_second'], alpha=0.3, color='#2ecc71')
    axes[2].set_ylabel('Requests/s')
    axes[2].legend(loc='upper right')
    
    # Replica Count
    axes[3].step(x, svc_data['replica_count'], color='#9b59b6', linewidth=2, label='Replicas (Actual)', where='post')
    axes[3].fill_between(x, svc_data['replica_count'], alpha=0.3, color='#9b59b6', step='post')
    axes[3].set_ylabel('Replicas')
    axes[3].set_xlabel('Time Step (30s intervals, ~4 hours total)')
    axes[3].set_yticks([1, 2, 3, 4, 5])
    axes[3].legend(loc='upper right')
    
    # Add overall title explaining the plot
    plt.suptitle('Metrics-to-Scaling Relationship: Input Features for ML Model', 
                fontsize=14, fontweight='bold', y=1.02)
    plt.tight_layout()
    plt.savefig(PLOTS_DIR / '07_time_series_sample.png', dpi=200, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    print("Saved: 07_time_series_sample.png")
    plt.close()


def main():
    print("="*60)
    print("Generating Thesis Plots")
    print("="*60)
    
    PLOTS_DIR.mkdir(parents=True, exist_ok=True)
    
    # Load data
    print("\nLoading data...")
    data = load_all_data()
    print(f"Loaded {len(data):,} rows from {len(list(METRICS_DIR.glob('*.csv')))} files")
    
    # Generate plots
    print("\nGenerating plots...")
    
    plot_data_distribution(data)
    plot_feature_correlation(data)
    plot_class_imbalance(data)
    plot_metrics_comparison()
    plot_transformer_architecture()
    plot_system_architecture()
    plot_time_series_sample(data)
    
    print("\n" + "="*60)
    print("All thesis plots generated!")
    print(f"Output directory: {PLOTS_DIR}")
    print("="*60)
    
    # List all plots
    print("\nGenerated plots:")
    for i, f in enumerate(sorted(PLOTS_DIR.glob('*.png')), 1):
        print(f"  {i}. {f.name}")


if __name__ == '__main__':
    main()

