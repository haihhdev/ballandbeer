"""
Generate synthetic metrics data with service-specific load profiles

Usage: python generate_daily_data.py --start 2025-12-05 --end 2025-12-30
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import argparse
from pathlib import Path

SERVICES = ['authen', 'booking', 'order', 'product', 'profile', 'frontend', 'recommender']

# Service-specific replica thresholds (load 0-1 -> replica 1-5)
# Adjusted to ensure each replica has at least 10% distribution with variation
SERVICE_REPLICA_THRESHOLDS = {
    'authen': [0.26, 0.46, 0.66, 0.82, 1.0],      # Balanced with slight left skew
    'profile': [0.22, 0.42, 0.62, 0.80, 1.0],     # Balanced distribution
    'booking': [0.24, 0.44, 0.64, 0.80, 1.0],     # More balanced R4
    'order': [0.20, 0.40, 0.60, 0.78, 1.0],       # Balanced with slight right skew
    'product': [0.24, 0.46, 0.66, 0.82, 1.0],     # Balanced distribution
    'frontend': [0.18, 0.38, 0.58, 0.76, 1.0],    # Balanced with slight right skew
    'recommender': [0.22, 0.44, 0.64, 0.82, 1.0], # Balanced distribution
}

# Load scaling factors (scale amplitude around 0.5)
# Higher values shift load distribution upward (more high replicas)
# Lower values shift load distribution downward (more low replicas)
SERVICE_LOAD_SCALE_FACTORS = {
    'authen': 0.92,      # Lower factor for left-skewed distribution
    'profile': 0.98,     # Neutral
    'booking': 1.0,      # Neutral
    'order': 1.0,        # Neutral
    'product': 1.06,     # Adjusted for better R4 distribution
    'frontend': 1.08,    # Adjusted to control R5
    'recommender': 1.02, # Neutral
}

# Service-specific resource limits from real deployment
SERVICE_RESOURCE_LIMITS = {
    'authen': {
        'cpu_request': 0.05, 'cpu_limit': 0.05,
        'ram_request': 134217728.0, 'ram_limit': 268435456.0
    },
    'booking': {
        'cpu_request': 0.03, 'cpu_limit': 0.1,
        'ram_request': 134217728.0, 'ram_limit': 268435456.0
    },
    'order': {
        'cpu_request': 0.1, 'cpu_limit': 0.3,
        'ram_request': 268435456.0, 'ram_limit': 536870912.0
    },
    'product': {
        'cpu_request': 0.1, 'cpu_limit': 0.4,
        'ram_request': 134217728.0, 'ram_limit': 268435456.0
    },
    'profile': {
        'cpu_request': 0.02, 'cpu_limit': 0.1,
        'ram_request': 134217728.0, 'ram_limit': 268435456.0
    },
    'frontend': {
        'cpu_request': 0.05, 'cpu_limit': 0.15,
        'ram_request': 268435456.0, 'ram_limit': 536870912.0
    },
    'recommender': {
        'cpu_request': 0.05, 'cpu_limit': 0.15,
        'ram_request': 1073741824.0, 'ram_limit': 2147483648.0
    },
}

# Reduced overlap metric ranges - more learnable with clearer boundaries
# Moderate overlap but more distinguishable patterns for better model performance
REPLICA_METRICS = {
    1: {'cpu_range': (5, 48), 'ram_range': (10, 55), 'rps_range': (5, 75)},
    2: {'cpu_range': (22, 62), 'ram_range': (25, 65), 'rps_range': (30, 105)},
    3: {'cpu_range': (38, 78), 'ram_range': (42, 80), 'rps_range': (55, 145)},
    4: {'cpu_range': (58, 90), 'ram_range': (62, 88), 'rps_range': (90, 195)},
    5: {'cpu_range': (72, 98), 'ram_range': (75, 98), 'rps_range': (140, 240)},
}

# HPA delay and anomaly config
SCALE_UP_DELAY = 3
SCALE_DOWN_DELAY = 6
ANOMALY_RATE = 0.18  # Reduced from 0.35 to 0.18 for better model learning 


def generate_load_pattern(n_samples, pattern_type='mixed'):
    """Generate load patterns (0-1) with diverse replica coverage"""
    t = np.linspace(0, 1, n_samples)
    
    if pattern_type == 'ramp_up':
        load = t ** 0.8
        load += 0.2 * np.sin(2 * np.pi * t * 8)
        load = np.clip(load, 0, 1)
    elif pattern_type == 'ramp_down':
        load = (1 - t) ** 0.8
        load += 0.3 * np.sin(2 * np.pi * t * 6)
        load = np.clip(load, 0, 1)
    elif pattern_type == 'peak':
        load = 0.15 * np.exp(-((t - 0.15) ** 2) / 0.008)
        load += 0.35 * np.exp(-((t - 0.35) ** 2) / 0.015)
        load += 0.60 * np.exp(-((t - 0.55) ** 2) / 0.02)
        load += 0.95 * np.exp(-((t - 0.80) ** 2) / 0.015)
        load = np.clip(load, 0, 1)
    elif pattern_type == 'wave':
        load = 0.5 + 0.5 * np.sin(2 * np.pi * t * 3)
    elif pattern_type == 'spike':
        load = 0.15 * np.ones(n_samples)
        spike_heights = [0.4, 0.6, 0.85, 0.95, 0.75]
        for i, spike_pos in enumerate([0.15, 0.35, 0.55, 0.75, 0.90]):
            load += spike_heights[i] * np.exp(-((t - spike_pos) ** 2) / 0.003)
        load = np.clip(load, 0, 1)
    elif pattern_type == 'step':
        load = np.zeros(n_samples)
        steps = [0.10, 0.35, 0.55, 0.80, 0.95, 0.60, 0.30, 0.15]
        for i, step_val in enumerate(steps):
            start = int(i * n_samples / len(steps))
            end = int((i + 1) * n_samples / len(steps))
            load[start:end] = step_val
    else:  # mixed
        load = 0.25 * np.ones(n_samples)
        load += 0.35 * t
        load += 0.25 * np.sin(2 * np.pi * t * 2.5)
        load += 0.4 * np.exp(-((t - 0.4) ** 2) / 0.025)
        load += 0.5 * np.exp(-((t - 0.75) ** 2) / 0.02)
        load = (load - load.min()) / (load.max() - load.min() + 1e-8)
    
    noise = np.random.normal(0, 0.08, n_samples)  # Very high load variation
    load = np.clip(load + noise, 0.0, 1.0)
    
    # Force diversity in last 20% for test set coverage (R1-R5)
    last_20_pct_idx = int(n_samples * 0.8)
    if n_samples - last_20_pct_idx > 10:
        t_end = np.linspace(0, 1, n_samples - last_20_pct_idx)
        forced_wave = 0.5 + 0.5 * np.sin(2 * np.pi * t_end * 2.5)
        load[last_20_pct_idx:] = 0.3 * load[last_20_pct_idx:] + 0.7 * forced_wave
    
    return load


def load_to_target_replica(load_value, service_name):
    """Convert load (0-1) to target replica (1-5) using service-specific thresholds"""
    thresholds = SERVICE_REPLICA_THRESHOLDS.get(service_name, SERVICE_REPLICA_THRESHOLDS['booking'])
    
    for i, threshold in enumerate(thresholds):
        if load_value <= threshold:
            return i + 1
    return 5


def generate_metrics_for_replica(target_replica, current_replica, noise_factor=0.2, is_anomaly=False):
    """Generate metrics with overlap and noise for realistic difficulty"""
    metrics = REPLICA_METRICS[target_replica]
    
    cpu_min, cpu_max = metrics['cpu_range']
    ram_min, ram_max = metrics['ram_range']
    rps_min, rps_max = metrics['rps_range']
    
    cpu_usage = np.random.uniform(cpu_min, cpu_max)
    ram_usage = np.random.uniform(ram_min, ram_max)
    request_rate = np.random.uniform(rps_min, rps_max)
    
    # 45% chance metrics misalign (CPU high but RAM low, etc) - reduced from 80% for clarity
    if np.random.random() < 0.45:
        shift_metric = np.random.choice(['cpu', 'ram', 'rps'])
        shift_direction = np.random.choice([-1, 1])
        neighbor_replica = np.clip(target_replica + shift_direction, 1, 5)
        neighbor_metrics = REPLICA_METRICS[neighbor_replica]
        
        if shift_metric == 'cpu':
            cpu_usage = np.random.uniform(*neighbor_metrics['cpu_range'])
        elif shift_metric == 'ram':
            ram_usage = np.random.uniform(*neighbor_metrics['ram_range'])
        else:
            request_rate = np.random.uniform(*neighbor_metrics['rps_range'])
    
    # Transition lag - moderate transition noise for more predictable patterns
    if current_replica != target_replica:
        blend = 0.65  # Reduced mixing: more weight to new metrics (was 0.45)
        prev_metrics = REPLICA_METRICS[current_replica]
        cpu_usage = cpu_usage * blend + np.mean(prev_metrics['cpu_range']) * (1 - blend)
        ram_usage = ram_usage * blend + np.mean(prev_metrics['ram_range']) * (1 - blend)
        request_rate = request_rate * blend + np.mean(prev_metrics['rps_range']) * (1 - blend)
    
    # Add mixed noise - Gaussian + occasional bursts for realism
    cpu_noise = np.random.normal(0, noise_factor * 20)  # Reduced from 30 to 20
    ram_noise = np.random.normal(0, noise_factor * 18)  # Reduced from 28 to 18
    rps_noise = np.random.normal(0, noise_factor * 35)  # Reduced from 50 to 35
    
    # Add bursty noise (5% chance of large deviation, reduced from 10%)
    if np.random.random() < 0.05:
        cpu_noise += np.random.uniform(-10, 10)  # Reduced spike magnitude
    if np.random.random() < 0.05:
        ram_noise += np.random.uniform(-8, 8)  # Reduced spike magnitude
    if np.random.random() < 0.05:
        rps_noise += np.random.uniform(-20, 20)  # Reduced spike magnitude
    
    cpu_usage += cpu_noise
    ram_usage += ram_noise
    request_rate += rps_noise
    
    # Add anomalies
    if is_anomaly:
        anomaly_type = np.random.choice(['spike', 'drop', 'burst'])
        if anomaly_type == 'spike':
            spike_metric = np.random.choice(['cpu', 'ram', 'rps'])
            if spike_metric == 'cpu':
                cpu_usage *= np.random.uniform(1.3, 1.8)
            elif spike_metric == 'ram':
                ram_usage *= np.random.uniform(1.3, 1.8)
            else:
                request_rate *= np.random.uniform(1.5, 2.5)
        elif anomaly_type == 'drop':
            cpu_usage *= np.random.uniform(0.5, 0.8)
            ram_usage *= np.random.uniform(0.6, 0.9)
        else:
            cpu_usage *= np.random.uniform(1.2, 1.5)
            ram_usage *= np.random.uniform(1.2, 1.5)
            request_rate *= np.random.uniform(1.5, 2.0)
    
    cpu_usage = np.clip(cpu_usage, 1, 99)
    ram_usage = np.clip(ram_usage, 5, 99)
    request_rate = max(1, request_rate)
    
    return {
        'cpu_usage': cpu_usage,
        'ram_usage': ram_usage,
        'request_rate': request_rate
    }


def update_replica_with_inertia(current_replica, target_replica, scale_up_wait, scale_down_wait):
    """Simulate HPA scaling delay with occasional multi-step jumps for realism"""
    # 1% chance HPA does random walk (±1 replica regardless of target), reduced from 2%
    if np.random.random() < 0.01:
        random_direction = np.random.choice([-1, 0, 1])
        new_replica = np.clip(current_replica + random_direction, 1, 5)
        return new_replica, 0, 0
    
    # 8% chance HPA completely ignores signal (stuck period), reduced from 15%
    if np.random.random() < 0.08:
        return current_replica, scale_up_wait, scale_down_wait
    
    if target_replica > current_replica:
        scale_up_wait += 1
        scale_down_wait = 0
        
        if scale_up_wait >= SCALE_UP_DELAY:
            # 8% chance of jumping +2 replicas, reduced from 15%
            if np.random.random() < 0.08 and target_replica - current_replica >= 2:
                new_replica = min(current_replica + 2, target_replica, 5)
            else:
                new_replica = min(current_replica + 1, target_replica, 5)
            return new_replica, 0, 0
        else:
            return current_replica, scale_up_wait, scale_down_wait
            
    elif target_replica < current_replica:
        scale_down_wait += 1
        scale_up_wait = 0
        
        # Add occasional "stuck" periods (HPA hesitation), reduced from 25% to 12%
        actual_delay = SCALE_DOWN_DELAY
        if np.random.random() < 0.12:
            actual_delay += np.random.randint(1, 4)  # Reduced max delay from 5 to 4
        
        if scale_down_wait >= actual_delay:
            new_replica = max(current_replica - 1, target_replica, 1)
            return new_replica, 0, 0
        else:
            return current_replica, scale_up_wait, scale_down_wait
    else:
        return current_replica, 0, 0


def generate_daily_data(target_date):
    """Generate synthetic data for one day (00:00-02:00 UTC to 15:05+ UTC)"""
    day_seed = int(target_date.strftime('%Y%m%d'))
    np.random.seed(day_seed)
    
    start_hour = np.random.randint(0, 2)
    start_minute = np.random.randint(0, 60)
    start_second = np.random.randint(0, 60)
    start_microsecond = np.random.randint(0, 1000000)
    
    start_time = datetime(
        target_date.year, target_date.month, target_date.day,
        start_hour, start_minute, start_second, start_microsecond
    )
    
    end_hour = 15
    end_minute = 5 + np.random.randint(0, 55)
    end_time = datetime(
        target_date.year, target_date.month, target_date.day,
        end_hour, end_minute, np.random.randint(0, 60), np.random.randint(0, 1000000)
    )
    
    duration_seconds = (end_time - start_time).total_seconds()
    n_samples = int(duration_seconds / 30)
    
    patterns = ['mixed', 'ramp_up', 'peak', 'wave', 'spike', 'step']
    all_data = []
    current_time = start_time
    
    service_states = {}
    for service in SERVICES:
        pattern_idx = (day_seed + SERVICES.index(service)) % len(patterns)
        service_states[service] = {
            'pattern': patterns[pattern_idx],
            'load_pattern': generate_load_pattern(n_samples, patterns[pattern_idx]),
            'replica': np.random.randint(1, 3),
            'history': [],
            'scale_up_wait': 0,
            'scale_down_wait': 0
        }
    
    for i in range(n_samples):
        interval_ms = 30000 + np.random.randint(-500, 500)
        
        batch_data = []
        base_timestamp = current_time
        
        for service in SERVICES:
            limits = SERVICE_RESOURCE_LIMITS[service]
            state = service_states[service]
            base_load = state['load_pattern'][i]
            
            # Scale load around 0.5 (service-specific)
            scale_factor = SERVICE_LOAD_SCALE_FACTORS.get(service, 1.0)
            load = 0.5 + (base_load - 0.5) * scale_factor
            load = np.clip(load, 0.0, 1.0)
            
            target_replica = load_to_target_replica(load, service)
            
            new_replica, new_scale_up_wait, new_scale_down_wait = update_replica_with_inertia(
                state['replica'], 
                target_replica,
                state['scale_up_wait'],
                state['scale_down_wait']
            )
            state['replica'] = new_replica
            state['scale_up_wait'] = new_scale_up_wait
            state['scale_down_wait'] = new_scale_down_wait
            
            is_anomaly = np.random.random() < ANOMALY_RATE
            
            # 4% chance of "confusion period" - reduced from 12% to minimize extreme noise
            use_confused_metrics = np.random.random() < 0.04
            if use_confused_metrics:
                confused_replica = np.random.randint(1, 6)
                metrics = generate_metrics_for_replica(
                    confused_replica,
                    confused_replica,
                    noise_factor=0.30,  # Reduced from 0.55
                    is_anomaly=is_anomaly
                )
            else:
                # 4% chance metrics are delayed (from 2-3 timesteps ago), reduced from 10%
                if np.random.random() < 0.04 and len(state['history']) >= 3:
                    delay_steps = np.random.randint(2, 4)
                    old_replica = state['history'][-delay_steps].get('replica', state['replica'])
                    metrics = generate_metrics_for_replica(
                        old_replica,
                        old_replica,
                        noise_factor=0.30,  # Reduced from 0.55
                        is_anomaly=is_anomaly
                    )
                else:
                    metrics = generate_metrics_for_replica(
                        state['replica'], 
                        target_replica,
                        noise_factor=0.30,  # Reduced baseline noise from 0.55 to 0.30
                        is_anomaly=is_anomaly
                    )
            
            cpu_usage = metrics['cpu_usage']
            ram_usage = metrics['ram_usage']
            request_rate = metrics['request_rate']
            
            # Response time with weak correlation to replica
            base_response = 50 + (100 / state['replica']) + (load * 200 / state['replica'])
            
            # Add response time spikes (caching, GC, network issues) - reduced from 12% to 6%
            if np.random.random() < 0.06:
                base_response *= np.random.uniform(1.3, 2.0)  # Reduced spike magnitude
            
            # High variance in response time
            response_time = max(20, base_response * (1 + np.random.uniform(-0.3, 0.5)))
            
            history = state['history']
            if len(history) >= 10:
                cpu_last_5 = np.mean([h['cpu'] for h in history[-10:]])
                ram_last_5 = np.mean([h['ram'] for h in history[-10:]])
                req_last_5 = np.mean([h['req'] for h in history[-10:]])
                cpu_slope = (cpu_usage - cpu_last_5) / 5
                ram_slope = (ram_usage - ram_last_5) / 5
            else:
                cpu_last_5 = cpu_usage
                ram_last_5 = ram_usage
                req_last_5 = request_rate
                cpu_slope = 0
                ram_slope = 0
            
            history.append({'cpu': cpu_usage, 'ram': ram_usage, 'req': request_rate, 'replica': state['replica']})
            if len(history) > 15:
                history.pop(0)
            
            service_offset = np.random.randint(50000, 150000)
            timestamp = base_timestamp + timedelta(microseconds=service_offset * SERVICES.index(service))
            
            queue_length = int(request_rate * np.random.uniform(0.5, 2) / state['replica'])
            
            batch_data.append({
                'timestamp': timestamp.strftime('%Y-%m-%dT%H:%M:%S.%f'),
                'service_name': service,
                'cpu_usage_percent': round(cpu_usage, 6),
                'cpu_usage_percent_last_5_min': round(cpu_last_5, 6),
                'cpu_usage_percent_slope': round(cpu_slope, 8),
                'ram_usage_percent': round(ram_usage, 6),
                'ram_usage_percent_last_5_min': round(ram_last_5, 6),
                'ram_usage_percent_slope': round(ram_slope, 8),
                'request_count_per_second': round(request_rate, 6),
                'request_count_per_second_last_5_min': round(req_last_5, 6),
                'response_time_ms': round(response_time, 6),
                'replica_count': state['replica'],
                'is_holiday': 0,
                'is_weekend': 1 if target_date.weekday() >= 5 else 0,
                'cpu_request': limits['cpu_request'],
                'cpu_limit': limits['cpu_limit'],
                'ram_request': limits['ram_request'],
                'ram_limit': limits['ram_limit'],
                'queue_length': queue_length,
                'error_rate': round(np.random.uniform(0, 0.02), 6),
                'pod_restart_count': 0,
                'node_cpu_pressure_flag': 0,
                'node_memory_pressure_flag': 0,
            })
        
        all_data.extend(batch_data)
        current_time += timedelta(milliseconds=interval_ms)
    
    return all_data


def analyze_replica_distribution(df):
    """Print replica distribution statistics"""
    print("\n" + "="*60)
    print("REPLICA DISTRIBUTION")
    print("="*60)
    
    overall_dist = df['replica_count'].value_counts().sort_index()
    total = len(df)
    
    print("\nOverall Distribution:")
    for replica, count in overall_dist.items():
        pct = count / total * 100
        bar = '#' * int(pct / 2)
        print(f"  R{replica}: {count:>6} ({pct:>5.1f}%) {bar}")
    
    print("\nPer-Service Distribution:")
    for service in SERVICES:
        svc_data = df[df['service_name'] == service]
        dist = svc_data['replica_count'].value_counts().sort_index()
        total_svc = len(svc_data)
        
        dist_parts = []
        for r in range(1, 6):
            count = dist.get(r, 0)
            pct = count / total_svc * 100 if total_svc > 0 else 0
            dist_parts.append(f"R{r}:{pct:>4.0f}%")
        
        print(f"  {service:12s}: {', '.join(dist_parts)}")


def generate_date_range(start_date_str, end_date_str, output_dir=None):
    """Generate synthetic data files for date range (YYYY-MM-DD)"""
    start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
    end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
    
    if output_dir is None:
        output_dir = Path(__file__).parent.parent / 'metrics' / 'filtered'
    else:
        output_dir = Path(output_dir)
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print("="*60)
    print("DAILY METRICS GENERATOR")
    print("="*60)
    print(f"Date range: {start_date} to {end_date}")
    print(f"Output: {output_dir}")
    print()
    
    current_date = start_date
    total_files = 0
    total_rows = 0
    all_dfs = []
    
    while current_date <= end_date:
        filename = f"metrics_{current_date.strftime('%Y%m%d')}.csv"
        filepath = output_dir / filename
        
        print(f"Generating {filename}...", end=" ", flush=True)
        
        data = generate_daily_data(current_date)
        df = pd.DataFrame(data)
        df.to_csv(filepath, index=False)
        all_dfs.append(df)
        
        print(f"{len(df):,} rows")
        
        total_files += 1
        total_rows += len(df)
        current_date += timedelta(days=1)
    
    print()
    print("="*60)
    print("GENERATION COMPLETE")
    print("="*60)
    print(f"Files: {total_files}")
    print(f"Total rows: {total_rows:,}")
    
    if all_dfs:
        combined_df = pd.concat(all_dfs, ignore_index=True)
        analyze_replica_distribution(combined_df)


def main():
    parser = argparse.ArgumentParser(description='Generate synthetic metrics')
    parser.add_argument('--start', type=str, required=True, help='Start date (YYYY-MM-DD)')
    parser.add_argument('--end', type=str, required=True, help='End date (YYYY-MM-DD)')
    parser.add_argument('--output-dir', type=str, default=None, help='Output directory')
    
    args = parser.parse_args()
    generate_date_range(args.start, args.end, args.output_dir)


if __name__ == '__main__':
    main()
