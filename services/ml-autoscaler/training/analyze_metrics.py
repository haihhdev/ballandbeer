"""
Comprehensive metrics analysis tool for ML autoscaler
Combines data quality check, distribution analysis, and statistical analysis

Usage:
    python analyze_metrics.py file1.csv file2.csv file3.csv
    python analyze_metrics.py ../metrics/*.csv
"""

import sys
import pandas as pd
import numpy as np
from pathlib import Path
from collections import Counter

def analyze_single_file(file_path):
    """Comprehensive analysis of a single CSV file"""
    
    print(f"\n{'='*70}")
    print(f"FILE: {Path(file_path).name}")
    print("="*70)
    
    df = pd.read_csv(file_path)
    total_rows = len(df)
    
    # SECTION 1: Basic Information
    print(f"\nBasic Info:")
    print(f"  Total rows: {total_rows:,}")
    print(f"  Columns: {len(df.columns)}")
    print(f"  Services: {df['service_name'].nunique()} ({', '.join(sorted(df['service_name'].unique()))})")
    print(f"  Date range: {df['timestamp'].min()} to {df['timestamp'].max()}")
    
    # Calculate duration
    try:
        ts_start = pd.to_datetime(df['timestamp'].min())
        ts_end = pd.to_datetime(df['timestamp'].max())
        duration_hours = (ts_end - ts_start).total_seconds() / 3600
        print(f"  Duration: {duration_hours:.1f} hours")
    except:
        pass
    
    # SECTION 2: Data Quality Issues
    print(f"\nData Quality:")
    issues = []
    
    # CPU/RAM over 100%
    cpu_over = (df['cpu_usage_percent'] > 100).sum()
    ram_over = (df['ram_usage_percent'] > 100).sum()
    if cpu_over > 0:
        issues.append(f"CPU >100%: {cpu_over} rows (max={df['cpu_usage_percent'].max():.1f}%)")
    if ram_over > 0:
        issues.append(f"RAM >100%: {ram_over} rows (max={df['ram_usage_percent'].max():.1f}%)")
    
    # Invalid replicas (replica=0 with active metrics)
    invalid_rep = (
        (df['replica_count'] == 0) & 
        (
            (df['cpu_usage_percent'] > 0) | 
            (df['ram_usage_percent'] > 0) |
            (df['request_count_per_second'] > 0)
        )
    ).sum()
    if invalid_rep > 0:
        issues.append(f"Invalid replicas=0 with active metrics: {invalid_rep} rows")
    
    # All-zero metrics
    null_metrics = (
        (df['cpu_usage_percent'] == 0) &
        (df['ram_usage_percent'] == 0) &
        (df['request_count_per_second'] == 0) &
        (df['replica_count'] > 0)
    ).sum()
    if null_metrics > 0:
        issues.append(f"All-zero metrics (collector error): {null_metrics} rows")
    
    # Extreme values
    extreme_resp = (df['response_time_ms'] > 10000).sum()
    if extreme_resp > 0:
        issues.append(f"Response time >10s: {extreme_resp} rows")
    
    high_restarts = (df['pod_restart_count'] > 3).sum()
    if high_restarts > 0:
        issues.append(f"High pod restarts >3: {high_restarts} rows")
    
    high_errors = (df['error_rate'] > 30.0).sum()
    if high_errors > 0:
        issues.append(f"High error rate >30%: {high_errors} rows")
    
    # Calculate usable data
    bad_data = invalid_rep + null_metrics
    usable_rows = total_rows - bad_data
    usable_pct = (usable_rows / total_rows) * 100
    
    if issues:
        for issue in issues:
            print(f"  - {issue}")
    else:
        print("  No issues found")
    
    print(f"  Usable rows: {usable_rows:,} ({usable_pct:.1f}%)")
    
    # SECTION 3: Replica Distribution (Critical for ML)
    print(f"\nReplica Distribution:")
    df_clean = df[df['replica_count'] > 0].copy()
    replica_counts = df_clean['replica_count'].value_counts().sort_index()
    
    for replica, count in replica_counts.items():
        pct = (count / len(df_clean)) * 100
        bar = "#" * int(pct / 3)
        print(f"  {replica}: {count:>6,} ({pct:>5.1f}%) {bar}")
    
    # Imbalance metrics
    if len(replica_counts) > 1:
        ir = replica_counts.max() / replica_counts.min()
        
        # Gini coefficient
        sorted_counts = np.sort(replica_counts.values)
        n = len(sorted_counts)
        index = np.arange(1, n + 1)
        gini = (2 * np.sum(index * sorted_counts)) / (n * np.sum(sorted_counts)) - (n + 1) / n
        
        print(f"\n  IR (Imbalance Ratio): {ir:.1f}")
        print(f"  Gini Coefficient: {gini:.3f}")
        print(f"  Smallest class: {replica_counts.min():,} samples")
        print(f"  Largest class: {replica_counts.max():,} samples")
    else:
        ir = 1.0
        gini = 0.0
    
    # SECTION 4: Statistical Summary
    print(f"\nStatistical Summary:")
    print(f"  CPU: min={df['cpu_usage_percent'].min():.1f}% max={df['cpu_usage_percent'].max():.1f}% avg={df['cpu_usage_percent'].mean():.1f}% std={df['cpu_usage_percent'].std():.1f}%")
    print(f"  RAM: min={df['ram_usage_percent'].min():.1f}% max={df['ram_usage_percent'].max():.1f}% avg={df['ram_usage_percent'].mean():.1f}% std={df['ram_usage_percent'].std():.1f}%")
    print(f"  Requests: min={df['request_count_per_second'].min():.1f} max={df['request_count_per_second'].max():.1f} avg={df['request_count_per_second'].mean():.1f} req/s")
    print(f"  Response: min={df['response_time_ms'].min():.1f} max={df['response_time_ms'].max():.1f} avg={df['response_time_ms'].mean():.1f}ms")
    
    # SECTION 5: Resource Configuration
    print(f"\nResource Configuration:")
    ram_req_values = sorted(df['ram_request'].unique())
    ram_lim_values = sorted(df['ram_limit'].unique())
    print(f"  RAM request values: {[f'{int(x/(1024**2))}MB' for x in ram_req_values]}")
    print(f"  RAM limit values: {[f'{int(x/(1024**2))}MB' for x in ram_lim_values]}")
    
    # SECTION 6: Per-Service Analysis
    print(f"\nPer-Service Analysis:")
    print(f"  {'Service':<12} {'Rows':>6} {'Replicas':<12} {'CPU':>6} {'RAM':>6} {'Scaling':>8}")
    print(f"  {'-'*60}")
    
    constant_services = []
    good_variation = []
    
    for service in sorted(df['service_name'].unique()):
        svc_df = df[df['service_name'] == service]
        unique_replicas = sorted(svc_df['replica_count'].unique())
        avg_cpu = svc_df['cpu_usage_percent'].mean()
        avg_ram = svc_df['ram_usage_percent'].mean()
        std_replicas = svc_df['replica_count'].std()
        
        scaling_status = "Good" if std_replicas >= 0.5 else "Constant" if std_replicas == 0 else "Low"
        
        if std_replicas == 0:
            constant_services.append(service)
        elif std_replicas >= 0.5:
            good_variation.append(service)
        
        print(f"  {service:<12} {len(svc_df):>6} {str(unique_replicas):<12} {avg_cpu:>5.1f}% {avg_ram:>5.1f}% {scaling_status:>8}")
    
    # SECTION 7: ML Training Assessment
    print(f"\nML Training Assessment:")
    
    problems = []
    warnings = []
    
    # Check class imbalance
    if ir > 100:
        problems.append(f"Extreme imbalance (IR={ir:.0f})")
    elif ir > 50:
        warnings.append(f"High imbalance (IR={ir:.0f})")
    elif ir > 20:
        warnings.append(f"Moderate imbalance (IR={ir:.0f})")
    
    # Check minority class size
    for replica, count in replica_counts.items():
        if count < 50:
            problems.append(f"Replica={replica} only {count} samples (<50)")
        elif count < 100:
            warnings.append(f"Replica={replica} only {count} samples (<100)")
    
    # Check scaling behavior
    if constant_services:
        warnings.append(f"{len(constant_services)} services never scale")
    
    if problems:
        print(f"  Problems: {len(problems)}")
        for p in problems:
            print(f"    - {p}")
    
    if warnings:
        print(f"  Warnings: {len(warnings)}")
        for w in warnings:
            print(f"    - {w}")
    
    # Verdict
    if problems:
        verdict = "NOT SUITABLE"
        action = "Fix data collection or apply heavy oversampling"
    elif warnings:
        verdict = "USABLE"
        action = "Use class weights and stratified sampling"
    else:
        verdict = "EXCELLENT"
        action = "Ready for training"
    
    print(f"\n  VERDICT: {verdict}")
    print(f"  ACTION: {action}")
    
    return {
        'file': Path(file_path).name,
        'total_rows': total_rows,
        'usable_rows': usable_rows,
        'usable_pct': usable_pct,
        'ir': ir,
        'gini': gini,
        'problems': len(problems),
        'warnings': len(warnings),
        'verdict': verdict,
        'constant_services': len(constant_services),
        'good_variation_services': len(good_variation)
    }


def compare_files(results):
    """Compare multiple files"""
    
    if len(results) <= 1:
        return
    
    print(f"\n\n{'='*70}")
    print("COMPARISON SUMMARY")
    print("="*70)
    
    print(f"\n{'File':<22} {'Rows':>8} {'Usable':>7} {'IR':>6} {'Gini':>6} {'Verdict':<12}")
    print("-" * 70)
    
    for r in results:
        print(f"{r['file']:<22} {r['total_rows']:>8,} {r['usable_pct']:>6.1f}% "
              f"{r['ir']:>6.1f} {r['gini']:>6.3f} {r['verdict']:<12}")
    
    # Combined statistics
    total_rows = sum(r['usable_rows'] for r in results)
    
    print("\n" + "-" * 70)
    print("Combined Dataset:")
    print(f"  Total usable rows: {total_rows:,}")
    print(f"  Files analyzed: {len(results)}")
    
    # Best files
    best_files = sorted(results, key=lambda r: (r['problems'], r['warnings'], r['ir']))
    print(f"\nBest files (ranked by quality):")
    for i, r in enumerate(best_files, 1):
        print(f"  {i}. {r['file']} (IR={r['ir']:.1f}, {r['verdict']})")
    
    # Final recommendation
    total_problems = sum(r['problems'] for r in results)
    total_warnings = sum(r['warnings'] for r in results)
    
    print(f"\nFinal Recommendation:")
    if total_problems > 0:
        print(f"  Status: CRITICAL - {total_problems} serious issues across files")
        print(f"  Action: Apply class weights + SMOTE/ADASYN oversampling")
    elif total_warnings > 3:
        print(f"  Status: MODERATE - {total_warnings} warnings across files")
        print(f"  Action: Use class weights and stratified sampling")
    elif total_warnings > 0:
        print(f"  Status: ACCEPTABLE - minor issues")
        print(f"  Action: Use class weights for better balance")
    else:
        print(f"  Status: EXCELLENT - all files are well-balanced")
        print(f"  Action: Train directly without special handling")
    
    print("="*70)


def main():
    if len(sys.argv) < 2:
        print("Usage: python analyze_metrics.py <csv_file1> [csv_file2] [csv_file3] ...")
        print("\nExample:")
        print("  python analyze_metrics.py ../metrics/metrics_20251116.csv")
        print("  python analyze_metrics.py ../metrics/*.csv")
        sys.exit(1)
    
    files = sys.argv[1:]
    results = []
    
    for file_path in files:
        file_path = Path(file_path)
        if not file_path.exists():
            print(f"Warning: File not found: {file_path}")
            continue
        
        result = analyze_single_file(str(file_path))
        results.append(result)
    
    if len(results) > 1:
        compare_files(results)


if __name__ == '__main__':
    main()

