"""
Reduce quiet periods in metrics data to balance replica distribution

Strategy: Remove 50% of long periods where ALL services have replica=1
This reduces the overwhelming bias toward replica=1 while keeping scaling events
"""

import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime, timedelta
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)


def find_quiet_periods(df, min_duration_minutes=5):
    """
    Find periods where ALL services have replica=1 for at least min_duration_minutes
    
    Returns list of (start_idx, end_idx) tuples for quiet periods
    """
    # Convert timestamp to datetime
    df['timestamp_dt'] = pd.to_datetime(df['timestamp'])
    
    # Get unique timestamps
    unique_times = sorted(df['timestamp_dt'].unique())
    
    quiet_periods = []
    current_quiet_start = None
    
    for i, ts in enumerate(unique_times):
        # Get all rows at this timestamp
        rows_at_time = df[df['timestamp_dt'] == ts]
        
        # Check if ALL services at this time have replica=1
        all_replica_1 = (rows_at_time['replica_count'] == 1).all()
        
        if all_replica_1:
            if current_quiet_start is None:
                current_quiet_start = i
        else:
            # End of quiet period
            if current_quiet_start is not None:
                quiet_end = i - 1
                
                # Check duration
                start_time = unique_times[current_quiet_start]
                end_time = unique_times[quiet_end]
                duration = (end_time - start_time).total_seconds() / 60
                
                if duration >= min_duration_minutes:
                    quiet_periods.append((current_quiet_start, quiet_end, duration))
                
                current_quiet_start = None
    
    # Handle case where file ends with quiet period
    if current_quiet_start is not None:
        quiet_end = len(unique_times) - 1
        start_time = unique_times[current_quiet_start]
        end_time = unique_times[quiet_end]
        duration = (end_time - start_time).total_seconds() / 60
        
        if duration >= min_duration_minutes:
            quiet_periods.append((current_quiet_start, quiet_end, duration))
    
    return quiet_periods, unique_times


def reduce_quiet_periods(df, quiet_periods, unique_times, reduction_rate=0.5):
    """
    Remove reduction_rate (e.g., 50%) of timestamps from quiet periods
    
    Strategy: Remove every other timestamp in quiet periods to maintain temporal continuity
    """
    timestamps_to_remove = set()
    
    for start_idx, end_idx, duration in quiet_periods:
        period_length = end_idx - start_idx + 1
        
        # Calculate how many to remove (50%)
        n_to_remove = int(period_length * reduction_rate)
        
        # Remove every other timestamp (keeps temporal pattern)
        for i in range(n_to_remove):
            # Alternate: remove even indices
            remove_idx = start_idx + (i * 2)
            if remove_idx <= end_idx:
                timestamps_to_remove.add(unique_times[remove_idx])
    
    # Filter dataframe
    df_reduced = df[~df['timestamp_dt'].isin(timestamps_to_remove)].copy()
    df_reduced = df_reduced.drop(columns=['timestamp_dt'])
    
    return df_reduced, len(timestamps_to_remove)


def process_file(input_path, output_path, min_duration_minutes=5, reduction_rate=0.5):
    """Process a single CSV file"""
    
    logger.info(f"\nProcessing: {Path(input_path).name}")
    logger.info("="*70)
    
    # Load data
    df = pd.read_csv(input_path)
    original_rows = len(df)
    
    logger.info(f"Original rows: {original_rows:,}")
    
    # Count original replica distribution
    original_dist = df['replica_count'].value_counts().sort_index()
    logger.info(f"Original distribution:")
    for replica, count in original_dist.items():
        logger.info(f"  Replica {replica}: {count:>6,} ({count/original_rows*100:>5.1f}%)")
    
    # Find quiet periods
    quiet_periods, unique_times = find_quiet_periods(df, min_duration_minutes)
    
    logger.info(f"\nFound {len(quiet_periods)} quiet periods (all services replica=1 for >{min_duration_minutes}min):")
    total_quiet_duration = sum(duration for _, _, duration in quiet_periods)
    logger.info(f"Total quiet time: {total_quiet_duration:.1f} minutes")
    
    if len(quiet_periods) > 0:
        for i, (start, end, duration) in enumerate(quiet_periods[:5], 1):  # Show first 5
            logger.info(f"  Period {i}: {duration:.1f} minutes ({end-start+1} timestamps)")
        if len(quiet_periods) > 5:
            logger.info(f"  ... and {len(quiet_periods)-5} more")
    
    # Reduce quiet periods
    if len(quiet_periods) > 0:
        df_reduced, n_timestamps_removed = reduce_quiet_periods(
            df, quiet_periods, unique_times, reduction_rate
        )
        
        reduced_rows = len(df_reduced)
        rows_removed = original_rows - reduced_rows
        
        logger.info(f"\nReduced rows: {reduced_rows:,} (removed {rows_removed:,} rows, {rows_removed/original_rows*100:.1f}%)")
        
        # Count new replica distribution
        new_dist = df_reduced['replica_count'].value_counts().sort_index()
        logger.info(f"New distribution:")
        for replica, count in new_dist.items():
            old_count = original_dist.get(replica, 0)
            change = count - old_count
            logger.info(f"  Replica {replica}: {count:>6,} ({count/reduced_rows*100:>5.1f}%) [change: {change:+,}]")
        
        # Calculate new imbalance ratio
        if len(new_dist) > 1:
            ir_old = original_dist.max() / original_dist.min()
            ir_new = new_dist.max() / new_dist.min()
            logger.info(f"\nImbalance Ratio: {ir_old:.1f} -> {ir_new:.1f} (improvement: {ir_old-ir_new:.1f})")
        
        # Save
        df_reduced.to_csv(output_path, index=False)
        logger.info(f"Saved to: {output_path}")
        
        return {
            'file': Path(input_path).name,
            'original_rows': original_rows,
            'reduced_rows': reduced_rows,
            'removed_rows': rows_removed,
            'quiet_periods': len(quiet_periods),
            'ir_old': ir_old if len(new_dist) > 1 else None,
            'ir_new': ir_new if len(new_dist) > 1 else None
        }
    else:
        logger.info("\nNo quiet periods found, keeping original file")
        df.to_csv(output_path, index=False)
        return {
            'file': Path(input_path).name,
            'original_rows': original_rows,
            'reduced_rows': original_rows,
            'removed_rows': 0,
            'quiet_periods': 0
        }


def main():
    logger.info("="*70)
    logger.info("REDUCING QUIET PERIODS IN METRICS DATA")
    logger.info("="*70)
    logger.info("Strategy: Remove 50% of periods where all services have replica=1 >5min")
    logger.info("="*70)
    
    # File paths
    input_dir = Path('../metrics' if Path('../metrics').exists() else 'metrics')
    output_dir = input_dir / 'balanced'
    output_dir.mkdir(exist_ok=True)
    
    files = [
        'metrics_20251106.csv',
        'metrics_20251114.csv',
        'metrics_20251116.csv',
        'metrics_20251117.csv',
        'metrics_20251118.csv'
    ]
    
    results = []
    
    for filename in files:
        input_path = input_dir / filename
        output_path = output_dir / filename
        
        if not input_path.exists():
            logger.warning(f"File not found: {input_path}")
            continue
        
        result = process_file(input_path, output_path, min_duration_minutes=5, reduction_rate=0.5)
        results.append(result)
    
    # Summary
    logger.info("\n\n" + "="*70)
    logger.info("SUMMARY")
    logger.info("="*70)
    
    total_original = sum(r['original_rows'] for r in results)
    total_reduced = sum(r['reduced_rows'] for r in results)
    total_removed = sum(r['removed_rows'] for r in results)
    
    logger.info(f"\n{'File':<25} {'Original':>10} {'Reduced':>10} {'Removed':>10} {'IR Old':>8} {'IR New':>8}")
    logger.info("-"*70)
    
    for r in results:
        ir_old = f"{r['ir_old']:.1f}" if r.get('ir_old') else "N/A"
        ir_new = f"{r['ir_new']:.1f}" if r.get('ir_new') else "N/A"
        logger.info(f"{r['file']:<25} {r['original_rows']:>10,} {r['reduced_rows']:>10,} "
                   f"{r['removed_rows']:>10,} {ir_old:>8} {ir_new:>8}")
    
    logger.info("-"*70)
    logger.info(f"{'TOTAL':<25} {total_original:>10,} {total_reduced:>10,} {total_removed:>10,}")
    logger.info(f"Reduction: {total_removed/total_original*100:.1f}%")
    
    logger.info(f"\n✓ Processed files saved to: {output_dir}")
    logger.info("="*70)


if __name__ == '__main__':
    main()

