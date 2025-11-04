import logging
from datetime import datetime, timedelta
from typing import Dict, List
import numpy as np
import pytz

logger = logging.getLogger(__name__)


class FeatureEngineer:
    def __init__(self):
        self.history_buffer = {}
        self.max_buffer_size = 10
        # Vietnam holidays (major ones) - can be extended
        self.vietnam_holidays = [
            (1, 1),   # New Year
            (4, 30),  # Reunification Day
            (5, 1),   # Labor Day
            (9, 2),   # National Day
        ]
        self.timezone = pytz.timezone('Asia/Ho_Chi_Minh')
    
    def add_to_history(self, service: str, metrics: Dict):
        if service not in self.history_buffer:
            self.history_buffer[service] = []
        
        self.history_buffer[service].append(metrics)
        
        if len(self.history_buffer[service]) > self.max_buffer_size:
            self.history_buffer[service].pop(0)
    
    def calculate_moving_average(self, service: str, metric_name: str) -> float:
        if service not in self.history_buffer or len(self.history_buffer[service]) == 0:
            return 0.0
        
        values = [m.get(metric_name, 0.0) for m in self.history_buffer[service]]
        return float(np.mean(values))
    
    def calculate_slope(self, service: str, metric_name: str) -> float:
        if service not in self.history_buffer or len(self.history_buffer[service]) < 2:
            return 0.0
        
        values = [m.get(metric_name, 0.0) for m in self.history_buffer[service]]
        
        if len(values) < 2:
            return 0.0
        
        x = np.arange(len(values))
        y = np.array(values, dtype=float)
        
        if np.all(y == y[0]):
            return 0.0
        
        coefficients = np.polyfit(x, y, 1)
        return float(coefficients[0])
    
    def extract_time_features(self, timestamp: datetime) -> Dict:
        local_time = timestamp.astimezone(self.timezone)
        
        # Check if date is a major holiday
        is_holiday = (local_time.month, local_time.day) in self.vietnam_holidays
        
        day_of_week = local_time.weekday()
        is_weekend = day_of_week >= 5
        
        return {
            'is_holiday': 1 if is_holiday else 0,
            'is_weekend': 1 if is_weekend else 0,
        }
    
    def enrich_metrics(self, service: str, metrics: Dict) -> Dict:
        self.add_to_history(service, metrics)
        
        timestamp = datetime.fromisoformat(metrics['timestamp'])
        time_features = self.extract_time_features(timestamp)
        metrics.update(time_features)
        
        metrics['cpu_usage_percent_last_5_min'] = self.calculate_moving_average(
            service, 'cpu_usage_percent'
        )
        metrics['cpu_usage_percent_slope'] = self.calculate_slope(
            service, 'cpu_usage_percent'
        )
        
        metrics['ram_usage_percent_last_5_min'] = self.calculate_moving_average(
            service, 'ram_usage_percent'
        )
        metrics['ram_usage_percent_slope'] = self.calculate_slope(
            service, 'ram_usage_percent'
        )
        
        metrics['request_count_per_second_last_5_min'] = self.calculate_moving_average(
            service, 'request_count_per_second'
        )
        
        return metrics
