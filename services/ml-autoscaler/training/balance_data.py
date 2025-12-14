"""
Balance training data by:
1. Removing services with no scaling data (100% replica=1) from specific files
2. Trimming long periods where replica=1 persists
3. Optionally removing files with high imbalance

Usage:
    python balance_data.py --analyze           # Only analyze, don't modify
    python balance_data.py --trim              # Trim long replica=1 periods
    python balance_data.py --best-only         # Keep only best files
"""

import pandas as pd
import numpy as np
from pathlib import Path
import argparse
import shutil
from datetime import datetime

FILTERED_DIR = Path(__file__).parent.parent / 'metrics' / 'filtered'
BALANCED_DIR = Path(__file__).parent.parent / 'metrics' / 'balanced_v2'
SERVICES = ['authen', 'booking', 'order', 'product', 'frontend', 'recommender']


def analyze_files():
    """Analyze replica distribution in each file"""
    print("="*80)
    print("REPLICA DISTRIBUTION ANALYSIS")
    print("="*80)
    
    files_data = []
    
    for f in sorted(FILTERED_DIR.glob('*.csv')):
        df = pd.read_csv(f)
        total = len(df)
        
        # Overall stats
        dist = df['replica_count'].value_counts().sort_index()
        rep1_count = dist.get(1, 0)
        rep1_pct = rep1_count / total * 100
        
        # Per-service analysis
        svc_stats = {}
        problem_services = []
        
        for svc in SERVICES:
            svc_data = df[df['service_name'] == svc]
            if len(svc_data) > 0:
                svc_rep1 = (svc_data['replica_count'] == 1).sum()
                svc_pct = svc_rep1 / len(svc_data) * 100
                svc_stats[svc] = svc_pct
                if svc_pct >= 95:  # 95% or more replica=1
                    problem_services.append(svc)
        
        quality = "BEST" if rep1_pct < 25 else "GOOD" if rep1_pct < 40 else "MODERATE" if rep1_pct < 55 else "POOR"
        
        files_data.append({
            'file': f.name,
            'path': f,
            'total': total,
            'rep1_pct': rep1_pct,
            'quality': quality,
            'problem_services': problem_services,
            'svc_stats': svc_stats
        })
        
        print(f"\n{f.name}: {total:,} rows, {rep1_pct:.1f}% replica=1 [{quality}]")
        if problem_services:
            print(f"  Problem services (>=95% replica=1): {', '.join(problem_services)}")
    
    return files_data


def trim_long_idle_periods(df, max_consecutive=20):
    """
    Trim periods where ALL services have replica=1 for more than max_consecutive timestamps
    max_consecutive=20 means 10 minutes at 30s interval
    """
    timestamps = sorted(df['timestamp'].unique())
    
    # Find consecutive all-replica-1 periods
    periods_to_trim = []
    current_start = None
    current_count = 0
    
    for ts in timestamps:
        ts_data = df[df['timestamp'] == ts]
        # Check if all services (that exist in this timestamp) have replica=1
        all_rep1 = (ts_data['replica_count'] == 1).all()
        
        if all_rep1:
            if current_start is None:
                current_start = ts
            current_count += 1
        else:
            if current_count > max_consecutive:
                # Keep first 5 and last 5, trim the middle
                periods_to_trim.append((current_start, current_count))
            current_start = None
            current_count = 0
    
    # Handle last period
    if current_count > max_consecutive:
        periods_to_trim.append((current_start, current_count))
    
    if not periods_to_trim:
        return df, 0
    
    # Now trim - for each period, keep 30% of timestamps
    total_removed = 0
    df_result = df.copy()
    
    for start_ts, count in periods_to_trim:
        # Find all timestamps in this period
        start_idx = timestamps.index(start_ts)
        period_timestamps = timestamps[start_idx:start_idx + count]
        
        # Keep 30% evenly distributed
        keep_count = max(5, int(count * 0.3))
        keep_indices = np.linspace(0, len(period_timestamps)-1, keep_count, dtype=int)
        keep_ts = set([period_timestamps[i] for i in keep_indices])
        
        # Remove the rest
        remove_ts = set(period_timestamps) - keep_ts
        before = len(df_result)
        df_result = df_result[~df_result['timestamp'].isin(remove_ts)]
        total_removed += before - len(df_result)
    
    return df_result, total_removed


def remove_constant_service_rows(df):
    """Remove rows for services that have 100% replica=1 in this file"""
    removed = 0
    df_result = df.copy()
    
    for svc in SERVICES:
        svc_data = df_result[df_result['service_name'] == svc]
        if len(svc_data) > 0:
            unique_replicas = svc_data['replica_count'].unique()
            if len(unique_replicas) == 1 and unique_replicas[0] == 1:
                # This service never scales in this file - remove it
                before = len(df_result)
                df_result = df_result[df_result['service_name'] != svc]
                removed += before - len(df_result)
                print(f"    Removed {svc}: 100% replica=1 (no scaling data)")
    
    return df_result, removed


def process_files(trim=True, remove_constant=True, best_only=False):
    """Process all files and save to balanced directory"""
    
    BALANCED_DIR.mkdir(parents=True, exist_ok=True)
    
    files_data = analyze_files()
    
    print("\n" + "="*80)
    print("PROCESSING FILES")
    print("="*80)
    
    total_before = 0
    total_after = 0
    
    for fdata in files_data:
        f = fdata['path']
        
        # Skip poor quality files if best_only
        if best_only and fdata['quality'] == 'POOR':
            print(f"\n{f.name}: SKIPPED (quality={fdata['quality']})")
            continue
        
        print(f"\n{f.name}:")
        df = pd.read_csv(f)
        original_len = len(df)
        total_before += original_len
        
        removed_total = 0
        
        # 1. Remove constant service rows
        if remove_constant:
            df, removed = remove_constant_service_rows(df)
            removed_total += removed
        
        # 2. Trim long idle periods
        if trim:
            df, removed = trim_long_idle_periods(df, max_consecutive=20)
            if removed > 0:
                print(f"    Trimmed idle periods: {removed} rows")
            removed_total += removed
        
        final_len = len(df)
        total_after += final_len
        
        if removed_total > 0:
            pct_kept = final_len / original_len * 100
            print(f"    Result: {original_len:,} -> {final_len:,} ({pct_kept:.1f}% kept)")
        else:
            print(f"    No changes needed")
        
        # Save
        output_path = BALANCED_DIR / f.name
        df.to_csv(output_path, index=False)
    
    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)
    print(f"Original total: {total_before:,}")
    print(f"Balanced total: {total_after:,}")
    print(f"Removed: {total_before - total_after:,} ({(total_before - total_after)/total_before*100:.1f}%)")
    print(f"Output: {BALANCED_DIR}")
    
    # Show new distribution
    print("\n" + "="*80)
    print("NEW REPLICA DISTRIBUTION")
    print("="*80)
    
    all_dfs = []
    for f in BALANCED_DIR.glob('*.csv'):
        all_dfs.append(pd.read_csv(f))
    
    if all_dfs:
        combined = pd.concat(all_dfs, ignore_index=True)
        dist = combined['replica_count'].value_counts().sort_index()
        total = len(combined)
        
        for r in [1, 2, 3, 4, 5]:
            count = dist.get(r, 0)
            pct = count / total * 100
            bar = '#' * int(pct / 2)
            print(f"Replica {r}: {count:>6,} ({pct:>5.1f}%) {bar}")


def main():
    parser = argparse.ArgumentParser(description='Balance training data')
    parser.add_argument('--analyze', action='store_true', help='Only analyze, do not modify')
    parser.add_argument('--trim', action='store_true', help='Trim long replica=1 periods')
    parser.add_argument('--remove-constant', action='store_true', help='Remove services with 100% replica=1')
    parser.add_argument('--best-only', action='store_true', help='Keep only BEST/GOOD quality files')
    parser.add_argument('--all', action='store_true', help='Apply all optimizations')
    
    args = parser.parse_args()
    
    if args.analyze:
        analyze_files()
    elif args.all:
        process_files(trim=True, remove_constant=True, best_only=False)
    else:
        trim = args.trim
        remove_constant = args.remove_constant
        best_only = args.best_only
        
        if not (trim or remove_constant or best_only):
            # Default: apply all
            trim = True
            remove_constant = True
        
        process_files(trim=trim, remove_constant=remove_constant, best_only=best_only)


if __name__ == '__main__':
    main()

