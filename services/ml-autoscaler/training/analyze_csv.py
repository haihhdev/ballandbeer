"""
Analyze CSV metrics file to check data quality

Usage:
    python analyze_csv.py ../metrics/metrics_20251105.csv
"""

import pandas as pd
import sys
from pathlib import Path

def analyze_csv(file_path):
    """Analyze single CSV file and report quality"""
    
    print(f"\nAnalyzing: {file_path}")
    print("=" * 60)
    
    # Load data
    df = pd.read_csv(file_path)
    total_rows = len(df)
    
    print(f"\nTotal rows: {total_rows}")
    print(f"Columns: {len(df.columns)}")
    print(f"Services: {df['service_name'].nunique()}")
    
    # Count issues
    issues = {}
    
    # Issue 0: CPU/RAM > 100%
    cpu_over_100 = (df['cpu_usage_percent'] > 100).sum()
    ram_over_100 = (df['ram_usage_percent'] > 100).sum()
    if cpu_over_100 > 0:
        issues['CPU >100% (CAPPED)'] = cpu_over_100
    if ram_over_100 > 0:
        issues[f'RAM >100% (CAPPED, max={df["ram_usage_percent"].max():.1f}%)'] = ram_over_100
    
    # Issue 1: replica_count=0 with active metrics
    invalid_replicas = (
        (df['replica_count'] == 0) & 
        (
            (df['cpu_usage_percent'] > 0) | 
            (df['ram_usage_percent'] > 0) |
            (df['request_count_per_second'] > 0) |
            (df['response_time_ms'] > 0)
        )
    ).sum()
    issues['Invalid replicas (REMOVED)'] = invalid_replicas
    
    # Issue 2: Zero resource limits
    zero_resources = (
        (df['cpu_request'] == 0) & 
        (df['cpu_limit'] == 0) & 
        (df['ram_request'] == 0) & 
        (df['ram_limit'] == 0)
    ).sum()
    issues['Zero resources (FILLED)'] = zero_resources
    
    # Issue 3: All-zero metrics (collector error)
    null_metrics = (
        (df['cpu_usage_percent'] == 0) &
        (df['ram_usage_percent'] == 0) &
        (df['request_count_per_second'] == 0) &
        (df['response_time_ms'] == 0) &
        (df['replica_count'] > 0)
    ).sum()
    issues['Null metrics (REMOVED)'] = null_metrics
    
    # Issue 4: Response time outliers
    resp_outliers = (df['response_time_ms'] > 10000).sum()
    if resp_outliers > 0:
        issues['Response >10s (CAPPED)'] = resp_outliers
    
    # Issue 5: Queue length high (kept as valid)
    queue_high = (df['queue_length'] > 100).sum()
    if queue_high > 0:
        issues['Queue >100 (KEPT)'] = queue_high
    
    # Issue 6: High restart count (flagged)
    high_restarts = (df['pod_restart_count'] > 3).sum()
    issues['High restarts (FLAGGED)'] = high_restarts
    
    # Issue 7: High error rate (flagged)
    high_errors = (df['error_rate'] > 30.0).sum()
    issues['High errors (FLAGGED)'] = high_errors
    
    # Calculate bad data (will be removed in cleaning)
    bad_data = invalid_replicas + null_metrics
    usable_rows = total_rows - bad_data
    usable_pct = (usable_rows / total_rows) * 100
    
    # Print issues
    print("\nData Issues:")
    print("-" * 60)
    for issue_name, count in issues.items():
        pct = (count / total_rows) * 100
        print(f"  {issue_name:20s}: {count:6d} ({pct:5.2f}%)")
    
    # Check replica count distribution (CRITICAL for scaling)
    unique_replicas = sorted(df['replica_count'].unique())
    max_replicas = df['replica_count'].max()
    
    # Print summary
    print("\n" + "=" * 60)
    print("SUMMARY:")
    print("-" * 60)
    print(f"  Total rows:        {total_rows:6d}")
    print(f"  Bad data (removed):{bad_data:6d} ({(bad_data/total_rows)*100:5.2f}%)")
    print(f"  Usable rows:       {usable_rows:6d} ({usable_pct:5.2f}%)")
    
    # Replica count check
    print(f"\n  Replica counts:    {unique_replicas}")
    print(f"  Max replicas:      {max_replicas}")
    
    if max_replicas <= 1:
        print("\n  " + "!" * 56)
        print("  WARNING: NO SCALING DATA!")
        print("  Dataset only has replica_count of 0 or 1")
        print("  Model will NOT learn proper scaling decisions")
        print("  Collect data during high-load with 2+ replicas!")
        print("  " + "!" * 56)
    
    # Quality grade
    print("\n  Quality Grade:", end=" ")
    if usable_pct >= 90:
        print("EXCELLENT")
    elif usable_pct >= 80:
        print("GOOD")
    elif usable_pct >= 70:
        print("ACCEPTABLE")
    else:
        print("POOR - Consider fixing data collection")
    
    # Service breakdown
    print("\nPer Service:")
    print("-" * 60)
    for service in sorted(df['service_name'].unique()):
        service_data = df[df['service_name'] == service]
        count = len(service_data)
        avg_cpu = service_data['cpu_usage_percent'].mean()
        avg_replicas = service_data['replica_count'].mean()
        max_restarts = service_data['pod_restart_count'].max()
        
        print(f"  {service:12s}: {count:5d} rows, "
              f"CPU={avg_cpu:5.1f}%, "
              f"Replicas={avg_replicas:.1f}, "
              f"Restarts={max_restarts}")
    
    print("\n" + "=" * 60)
    
    return {
        'total_rows': total_rows,
        'usable_rows': usable_rows,
        'usable_pct': usable_pct,
        'issues': issues
    }


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python analyze_csv.py <csv_file>")
        print("\nExample:")
        print("  python analyze_csv.py ../metrics/metrics_20251105.csv")
        sys.exit(1)
    
    file_path = sys.argv[1]
    
    if not Path(file_path).exists():
        print(f"Error: File not found: {file_path}")
        sys.exit(1)
    
    analyze_csv(file_path)

