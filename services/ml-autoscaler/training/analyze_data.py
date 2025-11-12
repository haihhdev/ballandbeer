"""
Analyze data distribution to understand model performance issues
"""
import sys
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from data_preprocessor import DataPreprocessor
import config

def main():
    print('='*80)
    print('DATA DISTRIBUTION ANALYSIS')
    print('='*80)
    
    # 1. Raw data analysis
    print('\n[1] RAW DATA')
    df = pd.read_csv('metrics/metrics_20251106.csv')
    
    print(f'\nTotal rows: {len(df)}')
    print(f'\nTarget distribution (replica_count):')
    target_counts = df['replica_count'].value_counts().sort_index()
    for val, count in target_counts.items():
        pct = count / len(df) * 100
        print(f'  {val}: {count:5d} ({pct:5.1f}%)')
    
    print(f'\nMissing values:')
    missing = df.isnull().sum()
    if missing.sum() > 0:
        print(missing[missing > 0])
    else:
        print('  None')
    
    print(f'\nKey metrics stats:')
    print(df[['cpu_usage_percent', 'ram_usage_percent', 'request_count_per_second']].describe())
    
    # 2. After preprocessing
    print('\n[2] AFTER PREPROCESSING')
    preprocessor = DataPreprocessor()
    X, y = preprocessor.process_full_pipeline(data_source='local', apply_pca=False)
    
    print(f'\nFeature matrix: {X.shape}')
    print(f'Target vector: {y.shape}')
    
    print(f'\nTarget distribution (target_replicas):')
    target_counts = pd.Series(y).value_counts().sort_index()
    for val, count in target_counts.items():
        pct = count / len(y) * 100
        print(f'  {val}: {count:5d} ({pct:5.1f}%)')
    
    print(f'\nFeature statistics:')
    print(f'  NaN values: {X.isnull().sum().sum()}')
    try:
        X_numeric = X.select_dtypes(include=[np.number])
        print(f'  Inf values: {np.isinf(X_numeric.values).sum()}')
        print(f'  Feature range: [{X_numeric.min().min():.2f}, {X_numeric.max().max():.2f}]')
    except:
        print(f'  Inf values: N/A')
        print(f'  Feature range: N/A')
    
    # 3. Check for problematic features
    print('\n[3] FEATURE ANALYSIS')
    
    # Constant features
    constant_features = []
    for col in X.columns:
        if X[col].std() < 0.01:
            constant_features.append(col)
    
    if constant_features:
        print(f'\nConstant/near-constant features ({len(constant_features)}):')
        for feat in constant_features[:10]:
            print(f'  {feat}: std={X[feat].std():.6f}')
    else:
        print('\nNo constant features found')
    
    # Features with high correlation to target
    print(f'\nTop 10 features correlated with target:')
    correlations = []
    for col in X.columns:
        try:
            corr = X[col].corr(pd.Series(y))
            if not np.isnan(corr):
                correlations.append((col, abs(corr)))
        except:
            pass
    
    correlations.sort(key=lambda x: x[1], reverse=True)
    for feat, corr in correlations[:10]:
        print(f'  {feat}: {corr:.4f}')
    
    # 4. Class imbalance analysis
    print('\n[4] CLASS IMBALANCE ANALYSIS')
    
    class_counts = pd.Series(y).value_counts().sort_index()
    max_count = class_counts.max()
    min_count = class_counts.min()
    imbalance_ratio = max_count / min_count
    
    print(f'\nImbalance ratio: {imbalance_ratio:.2f}x')
    print(f'  Most common class: {class_counts.idxmax()} with {max_count} samples')
    print(f'  Least common class: {class_counts.idxmin()} with {min_count} samples')
    
    # Baseline accuracy (always predict most common)
    baseline_acc = max_count / len(y)
    print(f'\nBaseline accuracy (predict most common): {baseline_acc:.2%}')
    
    # 5. Temporal analysis
    print('\n[5] TEMPORAL PATTERNS')
    
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.sort_values('timestamp')
    
    print(f'\nTime range: {df["timestamp"].min()} to {df["timestamp"].max()}')
    print(f'Duration: {df["timestamp"].max() - df["timestamp"].min()}')
    
    # Check if replica counts change over time
    print(f'\nReplica changes per service:')
    for service in df['service_name'].unique():
        service_df = df[df['service_name'] == service]
        changes = (service_df['replica_count'].diff() != 0).sum()
        print(f'  {service}: {changes} changes')
    
    # 6. Create visualization
    print('\n[6] CREATING VISUALIZATIONS')
    
    fig, axes = plt.subplots(2, 3, figsize=(15, 10))
    fig.suptitle('Data Distribution Analysis', fontsize=16)
    
    # Target distribution
    ax = axes[0, 0]
    target_counts.plot(kind='bar', ax=ax, color='steelblue')
    ax.set_title('Target Distribution (After Preprocessing)')
    ax.set_xlabel('Replica Count')
    ax.set_ylabel('Frequency')
    ax.grid(axis='y', alpha=0.3)
    
    # Target over time (sample 1000 points)
    ax = axes[0, 1]
    sample_df = df.sample(min(1000, len(df))).sort_values('timestamp')
    ax.plot(sample_df['timestamp'], sample_df['replica_count'], alpha=0.5)
    ax.set_title('Replica Count Over Time (Sample)')
    ax.set_xlabel('Time')
    ax.set_ylabel('Replica Count')
    ax.grid(alpha=0.3)
    
    # CPU vs Replicas
    ax = axes[0, 2]
    sample_df = df.sample(min(2000, len(df)))
    scatter = ax.scatter(sample_df['cpu_usage_percent'], 
                        sample_df['replica_count'],
                        alpha=0.3, c=sample_df['replica_count'], cmap='viridis')
    ax.set_title('CPU Usage vs Replicas')
    ax.set_xlabel('CPU Usage %')
    ax.set_ylabel('Replica Count')
    plt.colorbar(scatter, ax=ax)
    ax.grid(alpha=0.3)
    
    # RAM vs Replicas
    ax = axes[1, 0]
    scatter = ax.scatter(sample_df['ram_usage_percent'], 
                        sample_df['replica_count'],
                        alpha=0.3, c=sample_df['replica_count'], cmap='viridis')
    ax.set_title('RAM Usage vs Replicas')
    ax.set_xlabel('RAM Usage %')
    ax.set_ylabel('Replica Count')
    plt.colorbar(scatter, ax=ax)
    ax.grid(alpha=0.3)
    
    # Request rate vs Replicas
    ax = axes[1, 1]
    scatter = ax.scatter(sample_df['request_count_per_second'], 
                        sample_df['replica_count'],
                        alpha=0.3, c=sample_df['replica_count'], cmap='viridis')
    ax.set_title('Request Rate vs Replicas')
    ax.set_xlabel('Requests/s')
    ax.set_ylabel('Replica Count')
    plt.colorbar(scatter, ax=ax)
    ax.grid(alpha=0.3)
    
    # Feature correlation heatmap (top features)
    ax = axes[1, 2]
    top_features = [feat for feat, _ in correlations[:8]]
    if top_features:
        corr_matrix = X[top_features].corr()
        sns.heatmap(corr_matrix, annot=False, cmap='coolwarm', center=0, ax=ax, cbar_kws={'shrink': 0.8})
        ax.set_title('Top Features Correlation')
    else:
        ax.text(0.5, 0.5, 'No correlation data', ha='center', va='center')
    
    plt.tight_layout()
    plt.savefig('plots/data_distribution_analysis.png', dpi=150, bbox_inches='tight')
    print('Saved: plots/data_distribution_analysis.png')
    
    print('\n' + '='*80)
    print('ANALYSIS COMPLETE')
    print('='*80)

if __name__ == '__main__':
    main()

