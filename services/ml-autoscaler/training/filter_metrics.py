"""
Filter and preprocess metrics CSV files for ML training

Operations:
1. Remove invalid rows (replica=0 with active metrics, all-zero metrics)
2. Remove high error rate rows (error_rate > 30%)
3. Trim cold-start periods (initial replica=1 periods > 5 minutes)
4. Reduce long idle periods (all services at replica=1 for > 5 minutes)
5. Save cleaned files to metrics/filtered/

Usage:
    python filter_metrics.py
    python filter_metrics.py --input ../metrics --output ../metrics/filtered
"""

import pandas as pd
import numpy as np
from pathlib import Path
import argparse
import logging

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

# Services
SERVICES = ['authen', 'booking', 'frontend', 'order', 'product', 'profile', 'recommender']


def detect_cold_start_end(df):
    """
    Detect where cold-start period ends.
    Cold-start = continuous period at start where ALL services have replica=1
    """
    timestamps = df['timestamp'].unique()
    timestamps = sorted(timestamps)
    
    cold_start_end_idx = 0
    consecutive_all_one = 0
    
    for i, ts in enumerate(timestamps):
        ts_data = df[df['timestamp'] == ts]
        all_replica_one = (ts_data['replica_count'] == 1).all()
        
        if all_replica_one:
            consecutive_all_one += 1
        else:
            # Found first non-all-one timestamp
            # If we had a long cold-start (> 10 timestamps = 5 minutes at 30s interval)
            if consecutive_all_one >= 10:
                cold_start_end_idx = i
            break
    
    return timestamps[cold_start_end_idx] if cold_start_end_idx > 0 else None


def detect_idle_periods(df, min_duration=10):
    """
    Detect periods where ALL services have replica=1 for >= min_duration timestamps
    Returns list of (start_ts, end_ts) tuples
    """
    timestamps = sorted(df['timestamp'].unique())
    idle_periods = []
    
    current_start = None
    current_count = 0
    
    for ts in timestamps:
        ts_data = df[df['timestamp'] == ts]
        all_replica_one = (ts_data['replica_count'] == 1).all()
        
        if all_replica_one:
            if current_start is None:
                current_start = ts
            current_count += 1
        else:
            if current_count >= min_duration:
                idle_periods.append((current_start, ts))
            current_start = None
            current_count = 0
    
    return idle_periods


def filter_single_file(input_path, output_path, trim_cold_start=True, reduce_idle=True):
    """Filter a single CSV file"""
    
    df = pd.read_csv(input_path)
    original_rows = len(df)
    
    logger.info(f"\n{'='*60}")
    logger.info(f"Processing: {Path(input_path).name}")
    logger.info(f"  Original rows: {original_rows:,}")
    
    removed_reasons = []
    
    # 1. Remove ALL replica=0 rows (invalid training target)
    replica_zero = df['replica_count'] == 0
    replica_zero_count = replica_zero.sum()
    if replica_zero_count > 0:
        df = df[~replica_zero]
        removed_reasons.append(f"Replica=0 (invalid): {replica_zero_count}")
    
    # 2. Remove all-zero metrics (collector error)
    null_metrics = (
        (df['cpu_usage_percent'] == 0) &
        (df['ram_usage_percent'] == 0) &
        (df['request_count_per_second'] == 0) &
        (df['replica_count'] > 0)
    )
    null_count = null_metrics.sum()
    if null_count > 0:
        df = df[~null_metrics]
        removed_reasons.append(f"All-zero metrics: {null_count}")
    
    # 3. Remove high error rate rows
    high_error = df['error_rate'] > 30.0
    error_count = high_error.sum()
    if error_count > 0:
        df = df[~high_error]
        removed_reasons.append(f"High error rate (>30%): {error_count}")
    
    # 4. Trim cold-start period
    if trim_cold_start:
        cold_start_end = detect_cold_start_end(df)
        if cold_start_end:
            before_trim = len(df)
            df = df[df['timestamp'] >= cold_start_end]
            trimmed = before_trim - len(df)
            if trimmed > 0:
                removed_reasons.append(f"Cold-start trimmed: {trimmed}")
    
    # 5. Reduce idle periods (keep only 50% of timestamps in long idle periods)
    if reduce_idle:
        idle_periods = detect_idle_periods(df, min_duration=10)
        
        if idle_periods:
            total_idle_removed = 0
            for start_ts, end_ts in idle_periods:
                # Get timestamps in this idle period
                idle_mask = (df['timestamp'] >= start_ts) & (df['timestamp'] < end_ts)
                idle_timestamps = df.loc[idle_mask, 'timestamp'].unique()
                
                # Keep only 50% of timestamps (evenly spaced)
                keep_count = max(1, len(idle_timestamps) // 2)
                keep_indices = np.linspace(0, len(idle_timestamps)-1, keep_count, dtype=int)
                keep_timestamps = set(idle_timestamps[keep_indices])
                
                # Remove the rest
                remove_mask = idle_mask & ~df['timestamp'].isin(keep_timestamps)
                before_remove = len(df)
                df = df[~remove_mask]
                total_idle_removed += before_remove - len(df)
            
            if total_idle_removed > 0:
                removed_reasons.append(f"Idle periods reduced: {total_idle_removed}")
    
    # Summary
    final_rows = len(df)
    removed_total = original_rows - final_rows
    
    if removed_reasons:
        for reason in removed_reasons:
            logger.info(f"    - {reason}")
    else:
        logger.info(f"    No rows removed")
    
    logger.info(f"  Final rows: {final_rows:,} ({final_rows/original_rows*100:.1f}% retained)")
    
    # Check replica distribution
    replica_dist = df['replica_count'].value_counts().sort_index()
    logger.info(f"  Replica distribution:")
    for replica, count in replica_dist.items():
        pct = count / len(df) * 100
        logger.info(f"    {replica}: {count:>5} ({pct:>5.1f}%)")
    
    # Calculate Imbalance Ratio
    if len(replica_dist) > 1:
        ir = replica_dist.max() / replica_dist.min()
        logger.info(f"  IR (Imbalance Ratio): {ir:.1f}")
    
    # Save
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False)
    logger.info(f"  Saved: {output_path}")
    
    return {
        'file': Path(input_path).name,
        'original': original_rows,
        'final': final_rows,
        'removed': removed_total
    }


def main():
    parser = argparse.ArgumentParser(description='Filter metrics CSV files')
    parser.add_argument('--input', default='../metrics', help='Input directory')
    parser.add_argument('--output', default='../metrics/filtered', help='Output directory')
    parser.add_argument('--no-trim-cold-start', action='store_true', help='Skip cold-start trimming')
    parser.add_argument('--no-reduce-idle', action='store_true', help='Skip idle period reduction')
    args = parser.parse_args()
    
    # Resolve paths
    script_dir = Path(__file__).parent
    input_dir = Path(args.input)
    if not input_dir.is_absolute():
        input_dir = script_dir / input_dir
    
    output_dir = Path(args.output)
    if not output_dir.is_absolute():
        output_dir = script_dir / output_dir
    
    logger.info("="*60)
    logger.info("METRICS FILTERING PIPELINE")
    logger.info("="*60)
    logger.info(f"Input: {input_dir}")
    logger.info(f"Output: {output_dir}")
    
    # Find CSV files (only top-level, not in subdirectories)
    csv_files = list(input_dir.glob('metrics_*.csv'))
    
    if not csv_files:
        logger.error(f"No metrics_*.csv files found in {input_dir}")
        return
    
    logger.info(f"Found {len(csv_files)} files to process")
    
    results = []
    for csv_path in sorted(csv_files):
        output_path = output_dir / csv_path.name
        result = filter_single_file(
            csv_path, 
            output_path,
            trim_cold_start=not args.no_trim_cold_start,
            reduce_idle=not args.no_reduce_idle
        )
        results.append(result)
    
    # Final summary
    logger.info("\n" + "="*60)
    logger.info("SUMMARY")
    logger.info("="*60)
    
    total_original = sum(r['original'] for r in results)
    total_final = sum(r['final'] for r in results)
    
    logger.info(f"{'File':<25} {'Original':>10} {'Final':>10} {'Retained':>10}")
    logger.info("-"*60)
    for r in results:
        retained_pct = r['final'] / r['original'] * 100
        logger.info(f"{r['file']:<25} {r['original']:>10,} {r['final']:>10,} {retained_pct:>9.1f}%")
    
    logger.info("-"*60)
    logger.info(f"{'TOTAL':<25} {total_original:>10,} {total_final:>10,} {total_final/total_original*100:>9.1f}%")
    
    logger.info(f"\nFiltered files saved to: {output_dir}")
    logger.info("="*60)


if __name__ == '__main__':
    main()

