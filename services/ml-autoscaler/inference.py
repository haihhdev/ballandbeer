"""
Inference script for K8s auto-scaling prediction

This script loads trained models and makes real-time predictions
on incoming metrics data to determine optimal replica counts.
"""

import pandas as pd
import numpy as np
import joblib
import json
import logging
from pathlib import Path
from typing import Dict, List, Union
import keras

import config

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class K8sAutoScalingPredictor:
    """
    Predictor class for K8s auto-scaling
    
    Supports both Random Forest and LSTM-CNN models
    """
    
    def __init__(self, model_type: str = 'random_forest', model_dir: str = None):
        """
        Initialize predictor
        
        Args:
            model_type: 'random_forest' or 'lstm_cnn'
            model_dir: Directory containing saved models (default: from config)
        """
        self.model_type = model_type
        if model_dir is None:
            self.model_dir = Path(config.MODEL_OUTPUT_DIR)
        else:
            self.model_dir = Path(model_dir)
        self.model = None
        self.scaler = None
        self.feature_names = None
        self.sequence_buffer = {}  # For LSTM-CNN sequences per service
        
        self._load_model()
    
    def _load_model(self):
        """Load the trained model"""
        logger.info(f"Loading {self.model_type} model from {self.model_dir}")
        
        if self.model_type == 'random_forest':
            model_path = self.model_dir / 'random_forest_model.joblib'
            features_path = self.model_dir / 'rf_feature_names.json'
            
            if not model_path.exists():
                raise FileNotFoundError(f"Model not found at {model_path}")
            
            self.model = joblib.load(model_path)
            
            if features_path.exists():
                with open(features_path, 'r') as f:
                    self.feature_names = json.load(f)
            
            logger.info("Random Forest model loaded successfully")
            
        elif self.model_type == 'lstm_cnn':
            model_path = self.model_dir / 'lstm_cnn_model.keras'
            scaler_path = self.model_dir / 'lstm_cnn_scaler.joblib'
            
            if not model_path.exists():
                raise FileNotFoundError(f"Model not found at {model_path}")
            
            self.model = keras.models.load_model(model_path, compile=False)
            
            if scaler_path.exists():
                self.scaler = joblib.load(scaler_path)
            else:
                logger.warning("Scaler not found, predictions may be inaccurate")
            
            logger.info("LSTM-CNN model loaded successfully")
        else:
            raise ValueError(f"Unknown model type: {self.model_type}")
    
    def predict_single(self, features: Dict) -> int:
        """
        Predict optimal replica count for a single service
        
        Args:
            features: Dictionary of feature values
            
        Returns:
            Predicted replica count (1-10)
        """
        if self.model_type == 'random_forest':
            return self._predict_rf_single(features)
        else:
            return self._predict_lstm_single(features)
    
    def _predict_rf_single(self, features: Dict) -> int:
        """Random Forest prediction for single instance"""
        # Create dataframe with features
        if self.feature_names:
            # Ensure all features are present
            feature_dict = {name: features.get(name, 0) for name in self.feature_names}
            X = pd.DataFrame([feature_dict])
        else:
            X = pd.DataFrame([features])
        
        # Predict
        prediction = self.model.predict(X)[0]
        
        # Clip to valid range
        replica_count = int(np.clip(np.round(prediction), 1, 10))
        
        return replica_count
    
    def _predict_lstm_single(self, features: Dict) -> int:
        """LSTM-CNN prediction for single instance (requires sequence)"""
        service_name = features.get('service_name', 'unknown')
        
        # Initialize buffer for this service if needed
        if service_name not in self.sequence_buffer:
            self.sequence_buffer[service_name] = []
        
        # Convert features to array (exclude service_name and timestamp)
        feature_array = np.array([
            v for k, v in features.items() 
            if k not in ['service_name', 'timestamp', 'target_replicas']
        ])
        
        # Add to buffer
        self.sequence_buffer[service_name].append(feature_array)
        
        # Keep only last sequence_length samples
        seq_length = config.LSTM_CNN_PARAMS['sequence_length']
        if len(self.sequence_buffer[service_name]) > seq_length:
            self.sequence_buffer[service_name] = self.sequence_buffer[service_name][-seq_length:]
        
        # Need at least sequence_length samples to predict
        if len(self.sequence_buffer[service_name]) < seq_length:
            logger.warning(f"Not enough samples for {service_name}. "
                          f"Need {seq_length}, have {len(self.sequence_buffer[service_name])}. "
                          f"Using current replica count.")
            return int(features.get('replica_count', 1))
        
        # Create sequence
        sequence = np.array(self.sequence_buffer[service_name][-seq_length:])
        sequence = sequence.reshape(1, seq_length, -1)
        
        # Scale
        if self.scaler:
            sequence_scaled = self.scaler.transform(
                sequence.reshape(-1, sequence.shape[-1])
            ).reshape(sequence.shape)
        else:
            sequence_scaled = sequence
        
        # Predict
        prediction = self.model.predict(sequence_scaled, verbose=0)[0][0]
        
        # Clip to valid range
        replica_count = int(np.clip(np.round(prediction), 1, 10))
        
        return replica_count
    
    def predict_batch(self, features_list: List[Dict]) -> List[int]:
        """
        Predict optimal replica counts for batch of services
        
        Args:
            features_list: List of feature dictionaries
            
        Returns:
            List of predicted replica counts
        """
        predictions = []
        for features in features_list:
            prediction = self.predict_single(features)
            predictions.append(prediction)
        
        return predictions
    
    def get_scaling_decision(self, features: Dict) -> Dict:
        """
        Get detailed scaling decision with reasoning
        
        Args:
            features: Dictionary of feature values
            
        Returns:
            Dictionary with prediction and reasoning
        """
        current_replicas = int(features.get('replica_count', 1))
        predicted_replicas = self.predict_single(features)
        
        # Determine action
        if predicted_replicas > current_replicas:
            action = 'scale_up'
            change = predicted_replicas - current_replicas
        elif predicted_replicas < current_replicas:
            action = 'scale_down'
            change = current_replicas - predicted_replicas
        else:
            action = 'no_change'
            change = 0
        
        # Generate reasoning based on metrics
        reasoning = self._generate_reasoning(features, action)
        
        decision = {
            'service_name': features.get('service_name', 'unknown'),
            'current_replicas': current_replicas,
            'predicted_replicas': predicted_replicas,
            'action': action,
            'change': change,
            'reasoning': reasoning,
            'confidence': self._calculate_confidence(features)
        }
        
        return decision
    
    def _generate_reasoning(self, features: Dict, action: str) -> str:
        """Generate human-readable reasoning for scaling decision"""
        reasons = []
        
        cpu_usage = features.get('cpu_usage_percent', 0)
        ram_usage = features.get('ram_usage_percent', 0)
        response_time = features.get('response_time_ms', 0)
        error_rate = features.get('error_rate', 0)
        request_rate = features.get('request_count_per_second', 0)
        
        if action == 'scale_up':
            if cpu_usage > 70:
                reasons.append(f"High CPU usage ({cpu_usage:.1f}%)")
            if ram_usage > 75:
                reasons.append(f"High RAM usage ({ram_usage:.1f}%)")
            if response_time > 500:
                reasons.append(f"High response time ({response_time:.1f}ms)")
            if error_rate > 0.05:
                reasons.append(f"High error rate ({error_rate:.2%})")
            if not reasons:
                reasons.append("Predicted increase in load")
        
        elif action == 'scale_down':
            if cpu_usage < 30 and ram_usage < 35:
                reasons.append(f"Low resource utilization (CPU: {cpu_usage:.1f}%, RAM: {ram_usage:.1f}%)")
            if request_rate < 1:
                reasons.append(f"Low request rate ({request_rate:.2f} req/s)")
            if not reasons:
                reasons.append("Resources are under-utilized")
        
        else:
            reasons.append("Current capacity is optimal")
        
        return "; ".join(reasons)
    
    def _calculate_confidence(self, features: Dict) -> float:
        """Calculate confidence score for prediction"""
        # Simple confidence based on metric stability
        cpu_slope = abs(features.get('cpu_usage_percent_slope', 0))
        ram_slope = abs(features.get('ram_usage_percent_slope', 0))
        cpu_std = features.get('cpu_rolling_std', 0)
        
        # Lower slopes and std = higher confidence
        confidence = 1.0 - min(cpu_slope / 100, 0.3) - min(cpu_std / 100, 0.3)
        confidence = max(0.4, min(1.0, confidence))
        
        return round(confidence, 2)
    
    def reset_sequence_buffer(self, service_name: str = None):
        """Reset sequence buffer for LSTM-CNN"""
        if service_name:
            if service_name in self.sequence_buffer:
                del self.sequence_buffer[service_name]
                logger.info(f"Reset sequence buffer for {service_name}")
        else:
            self.sequence_buffer = {}
            logger.info("Reset all sequence buffers")


def example_usage():
    """Example usage of the predictor"""
    
    # Initialize predictor (choose model type)
    print("Initializing Random Forest predictor...")
    rf_predictor = K8sAutoScalingPredictor(model_type='random_forest')
    
    # Example metrics data
    example_features = {
        'service_name': 'product',
        'cpu_usage_percent': 75.5,
        'cpu_usage_percent_last_5_min': 72.3,
        'cpu_usage_percent_slope': 0.5,
        'ram_usage_percent': 68.2,
        'ram_usage_percent_last_5_min': 65.1,
        'ram_usage_percent_slope': 0.6,
        'request_count_per_second': 150.5,
        'request_count_per_second_last_5_min': 140.2,
        'response_time_ms': 450.0,
        'replica_count': 2,
        'hour_sin': 0.5,
        'hour_cos': 0.866,
        'cpu_request': 0.5,
        'cpu_limit': 2.0,
        'ram_request': 512.0,
        'ram_limit': 2048.0,
        'queue_length': 15,
        'error_rate': 0.02,
        'pod_restart_count': 0,
        'node_cpu_pressure_flag': 0,
        'node_memory_pressure_flag': 0,
        'is_holiday': 0,
        'is_weekend': 0,
        # Engineered features
        'cpu_utilization_ratio': 0.3775,
        'ram_utilization_ratio': 0.0333,
        'cpu_change_rate': 0.5,
        'ram_change_rate': 0.6,
        'request_change_rate': 2.5,
        'cpu_rolling_std': 5.2,
        'ram_rolling_std': 4.1,
        'request_rolling_max': 160.0,
        'response_time_rolling_p95': 480.0,
        'cpu_per_replica': 37.75,
        'ram_per_replica': 34.1,
        'requests_per_replica': 75.25,
        'system_pressure': 1,
        # Service one-hot encoding (all 0 except product)
        'service_authen': 0,
        'service_booking': 0,
        'service_frontend': 0,
        'service_order': 0,
        'service_product': 1,
        'service_profile': 0,
        'service_recommender': 0,
    }
    
    # Simple prediction
    print("\n1. Simple Prediction:")
    replica_prediction = rf_predictor.predict_single(example_features)
    print(f"   Predicted replicas: {replica_prediction}")
    
    # Detailed decision
    print("\n2. Detailed Scaling Decision:")
    decision = rf_predictor.get_scaling_decision(example_features)
    print(f"   Service: {decision['service_name']}")
    print(f"   Current replicas: {decision['current_replicas']}")
    print(f"   Predicted replicas: {decision['predicted_replicas']}")
    print(f"   Action: {decision['action']}")
    print(f"   Change: {decision['change']}")
    print(f"   Confidence: {decision['confidence']}")
    print(f"   Reasoning: {decision['reasoning']}")
    
    print("\n" + "="*80)
    print("Predictor ready for production use!")
    print("="*80)


if __name__ == '__main__':
    example_usage()

