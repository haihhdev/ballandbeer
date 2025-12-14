"""
Generate synthetic metrics data for ML training
Simulates realistic autoscaling patterns without needing k6/real traffic

Usage:
    python generate_synthetic_data.py --samples 5000 --output synthetic_metrics.csv
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import argparse
from pathlib import Path

SERVICES = ['authen', 'booking', 'order', 'product', 'frontend', 'recommender']

# Service-specific characteristics (higher base to reduce replica=1)
SERVICE_PROFILES = {
    'authen': {'base_cpu': 28, 'base_ram': 35, 'cpu_var': 52, 'ram_var': 42},
    'booking': {'base_cpu': 32, 'base_ram': 40, 'cpu_var': 58, 'ram_var': 48},
    'order': {'base_cpu': 30, 'base_ram': 38, 'cpu_var': 55, 'ram_var': 45},
    'product': {'base_cpu': 35, 'base_ram': 45, 'cpu_var': 52, 'ram_var': 42},
    'frontend': {'base_cpu': 26, 'base_ram': 33, 'cpu_var': 58, 'ram_var': 48},
    'recommender': {'base_cpu': 33, 'base_ram': 42, 'cpu_var': 50, 'ram_var': 40},
}


def generate_load_pattern(n_samples, pattern_type='mixed'):
    """Generate realistic load patterns with full range (0 to 1)"""
    t = np.linspace(0, 1, n_samples)
    
    if pattern_type == 'ramp_up':
        # Gradual increase to high load
        load = t ** 1.2
    elif pattern_type == 'ramp_down':
        # Start high, decrease
        load = (1 - t) ** 1.2
    elif pattern_type == 'peak':
        # Multiple peaks at different heights
        load = 0.3 * np.exp(-((t - 0.25) ** 2) / 0.01)
        load += 0.6 * np.exp(-((t - 0.5) ** 2) / 0.02)
        load += 0.9 * np.exp(-((t - 0.75) ** 2) / 0.015)
    elif pattern_type == 'wave':
        # Full amplitude waves
        load = 0.5 + 0.5 * np.sin(2 * np.pi * t * 4)
    elif pattern_type == 'spike':
        # Sharp spikes to maximum
        load = 0.2 * np.ones(n_samples)
        for spike_pos in [0.15, 0.35, 0.55, 0.75, 0.9]:
            height = np.random.uniform(0.7, 1.0)
            load += height * np.exp(-((t - spike_pos) ** 2) / 0.002)
        load = np.clip(load, 0, 1)
    elif pattern_type == 'step':
        # Clear step changes covering full range
        load = np.zeros(n_samples)
        steps = [0.1, 0.4, 0.7, 0.9, 0.5, 0.2]  # Diverse steps
        for i, step_val in enumerate(steps):
            start = int(i * n_samples / len(steps))
            end = int((i + 1) * n_samples / len(steps))
            load[start:end] = step_val
    else:  # mixed - covers all load levels with more high load
        # Base medium load instead of low
        load = 0.30 * np.ones(n_samples)
        # Add gradual ramp with higher amplitude
        load += 0.4 * t
        # Add waves with higher amplitude
        load += 0.35 * np.sin(2 * np.pi * t * 3)
        # Add peaks with higher intensity
        load += 0.5 * np.exp(-((t - 0.4) ** 2) / 0.02)
        load += 0.6 * np.exp(-((t - 0.8) ** 2) / 0.015)
        # Normalize to 0-1
        load = (load - load.min()) / (load.max() - load.min())
    
    # Add small noise
    noise = np.random.normal(0, 0.03, n_samples)
    load = np.clip(load + noise, 0.0, 1.0)
    
    return load


def calculate_optimal_replica(cpu_usage, ram_usage, request_rate, current_replica):
    """Calculate optimal replica based on resource usage and request rate"""
    # Combined score for scaling decision (weighted)
    load_score = (cpu_usage / 100 * 0.4 + ram_usage / 100 * 0.4 + min(request_rate / 150, 1) * 0.2)
    
    # Lower thresholds to reduce replica=1 and increase higher replicas
    if load_score > 0.62:
        target = 5
    elif load_score > 0.45:
        target = 4
    elif load_score > 0.30:
        target = 3
    elif load_score > 0.18:
        target = 2
    else:
        target = 1
    
    # Allow faster scaling up (jump by 2 sometimes)
    if target > current_replica + 1 and np.random.random() > 0.5:
        return min(current_replica + 2, target)
    elif target > current_replica:
        return current_replica + 1
    elif target < current_replica:
        return current_replica - 1
    return current_replica


def generate_service_data(service_name, n_samples, load_pattern, start_time):
    """Generate data for a single service"""
    profile = SERVICE_PROFILES[service_name]
    
    data = []
    current_replica = 1
    
    for i in range(n_samples):
        load = load_pattern[i]
        
        # Calculate metrics based on load and replica
        # Higher load = higher CPU/RAM usage per replica
        # Amplify load for higher replica targets
        amplified_load = load ** 0.7  # Less aggressive dampening
        
        cpu_per_replica = profile['base_cpu'] + amplified_load * profile['cpu_var'] * (1 + np.random.uniform(-0.1, 0.1))
        ram_per_replica = profile['base_ram'] + amplified_load * profile['ram_var'] * (1 + np.random.uniform(-0.1, 0.1))
        
        # Total usage: higher load means MUCH higher usage
        # Scaling effect is less pronounced to allow high values
        replica_factor = 1.0 / (0.5 + 0.5 * current_replica)
        cpu_usage = cpu_per_replica * replica_factor * (1 + amplified_load * 0.8)
        ram_usage = ram_per_replica * replica_factor * (1 + amplified_load * 0.6)
        
        # Add some noise and clamp (allow up to 95%)
        cpu_usage = np.clip(cpu_usage + np.random.normal(0, 5), 5, 95)
        ram_usage = np.clip(ram_usage + np.random.normal(0, 4), 10, 95)
        
        # Request rate correlates with load
        base_rps = 10 + amplified_load * 250 * (1 + np.random.uniform(-0.2, 0.2))
        request_rate = max(0.1, base_rps)
        
        # Response time increases with load and decreases with replicas
        base_response = 50 + load * 200 / max(1, current_replica)
        response_time = max(10, base_response * (1 + np.random.uniform(-0.1, 0.3)))
        
        # Determine optimal replica
        optimal_replica = calculate_optimal_replica(cpu_usage, ram_usage, request_rate, current_replica)
        
        # Replica changes gradually (simulate HPA behavior)
        if optimal_replica > current_replica:
            current_replica = min(current_replica + 1, optimal_replica)
        elif optimal_replica < current_replica:
            # Scale down is slower
            if np.random.random() > 0.7:  # 30% chance to scale down
                current_replica = max(current_replica - 1, optimal_replica)
        
        timestamp = start_time + timedelta(seconds=i * 30)
        
        # Calculate rolling/slope values (simulate real collector)
        if i >= 10:
            cpu_last_5_min = np.mean([data[j]['cpu_usage_percent'] for j in range(max(0,len(data)-10), len(data))]) if data else cpu_usage
            ram_last_5_min = np.mean([data[j]['ram_usage_percent'] for j in range(max(0,len(data)-10), len(data))]) if data else ram_usage
            req_last_5_min = np.mean([data[j]['request_count_per_second'] for j in range(max(0,len(data)-10), len(data))]) if data else request_rate
            cpu_slope = (cpu_usage - cpu_last_5_min) / 5 if data else 0
            ram_slope = (ram_usage - ram_last_5_min) / 5 if data else 0
        else:
            cpu_last_5_min = cpu_usage
            ram_last_5_min = ram_usage
            req_last_5_min = request_rate
            cpu_slope = 0
            ram_slope = 0
        
        data.append({
            'timestamp': timestamp.isoformat(),
            'service_name': service_name,
            'cpu_usage_percent': round(cpu_usage, 2),
            'cpu_usage_percent_last_5_min': round(cpu_last_5_min, 2),
            'cpu_usage_percent_slope': round(cpu_slope, 4),
            'ram_usage_percent': round(ram_usage, 2),
            'ram_usage_percent_last_5_min': round(ram_last_5_min, 2),
            'ram_usage_percent_slope': round(ram_slope, 4),
            'request_count_per_second': round(request_rate, 2),
            'request_count_per_second_last_5_min': round(req_last_5_min, 2),
            'response_time_ms': round(response_time, 2),
            'replica_count': current_replica,
            'is_holiday': 0,
            'is_weekend': 1 if timestamp.weekday() >= 5 else 0,
            'cpu_request': 100,
            'cpu_limit': 500,
            'ram_request': 128,
            'ram_limit': 512,
            'queue_length': round(request_rate * np.random.uniform(0.01, 0.05), 2),
            'error_rate': round(np.random.uniform(0, 0.02), 4),
            'pod_restart_count': 0,
            'node_cpu_pressure_flag': 0,
            'node_memory_pressure_flag': 0,
        })
    
    return data


def generate_synthetic_dataset(n_samples_per_service=1000, pattern='mixed'):
    """Generate complete synthetic dataset"""
    all_data = []
    start_time = datetime.now() - timedelta(hours=n_samples_per_service * 30 / 3600)
    
    # Generate different load patterns for variety
    patterns = ['mixed', 'ramp_up', 'peak', 'wave', 'spike', 'step']
    
    for service in SERVICES:
        # Use different pattern for each service to create variety
        pattern_type = np.random.choice(patterns)
        load_pattern = generate_load_pattern(n_samples_per_service, pattern_type)
        
        service_data = generate_service_data(
            service, n_samples_per_service, load_pattern, start_time
        )
        all_data.extend(service_data)
        print(f"Generated {len(service_data)} samples for {service} (pattern: {pattern_type})")
    
    df = pd.DataFrame(all_data)
    return df


def analyze_distribution(df):
    """Analyze and print distribution statistics"""
    print("\n" + "="*60)
    print("GENERATED DATA DISTRIBUTION")
    print("="*60)
    
    for service in SERVICES:
        svc_data = df[df['service_name'] == service]
        dist = svc_data['replica_count'].value_counts().sort_index()
        
        print(f"\n{service.upper()}:")
        for r, c in dist.items():
            pct = c / len(svc_data) * 100
            bar = '#' * int(pct / 2)
            print(f"  Replica {r}: {c:>4} ({pct:>5.1f}%) {bar}")


def main():
    parser = argparse.ArgumentParser(description='Generate synthetic metrics data')
    parser.add_argument('--samples', type=int, default=1000, 
                        help='Samples per service (default: 1000)')
    parser.add_argument('--output', type=str, default='synthetic_metrics.csv',
                        help='Output filename (default: synthetic_metrics.csv)')
    parser.add_argument('--analyze', action='store_true',
                        help='Only analyze, do not save')
    
    args = parser.parse_args()
    
    print("="*60)
    print("SYNTHETIC METRICS GENERATOR")
    print("="*60)
    print(f"Samples per service: {args.samples}")
    print(f"Total samples: {args.samples * len(SERVICES)}")
    
    df = generate_synthetic_dataset(args.samples)
    
    analyze_distribution(df)
    
    if not args.analyze:
        output_path = Path(__file__).parent.parent / 'metrics' / 'filtered' / args.output
        df.to_csv(output_path, index=False)
        print(f"\nSaved to: {output_path}")
        print(f"Total rows: {len(df)}")


if __name__ == '__main__':
    main()

