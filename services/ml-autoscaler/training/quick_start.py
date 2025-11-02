"""
Quick Start Script for K8s Auto-Scaling ML Training

This script provides an easy way to:
1. Download data from pod
2. Train both models
3. Compare results
4. Test inference

Usage:
    python quick_start.py --mode [download|train|compare|test]
"""

import argparse
import subprocess
import sys
import logging
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import config

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def download_data_from_s3():
    """Download metrics data from S3 bucket"""
    logger.info("="*80)
    logger.info("DOWNLOADING DATA FROM S3 BUCKET")
    logger.info("="*80)
    
    # Ensure we're running from training directory
    training_dir = Path(__file__).parent
    
    try:
        # Run download script with -y flag to skip confirmation
        result = subprocess.run(
            ['bash', 'download_data.sh', '-y'],
            cwd=training_dir,
            capture_output=True,
            text=True,
            check=True
        )
        
        logger.info(result.stdout)
        
        logger.info("\n" + "="*80)
        logger.info("DATA DOWNLOAD COMPLETED!")
        logger.info("="*80)
        
        return True
        
    except subprocess.CalledProcessError as e:
        logger.error(f"Error downloading data: {e}")
        logger.error(f"Output: {e.stdout}")
        logger.error(f"Error: {e.stderr}")
        logger.info("\nMake sure:")
        logger.info("1. AWS CLI is installed and configured")
        logger.info("2. You have access to s3://ballandbeer-metrics")
        logger.info("3. AWS credentials are set up correctly")
        return False
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return False


def train_models():
    """Train both Random Forest and LSTM-CNN models"""
    logger.info("="*80)
    logger.info("TRAINING BOTH MODELS")
    logger.info("="*80)
    
    # Ensure we're running from training directory
    training_dir = Path(__file__).parent
    metrics_dir = training_dir.parent / 'metrics'
    
    # Check if metrics exist
    if not metrics_dir.exists() or not list(metrics_dir.glob('*.csv')):
        logger.error("No metrics found! Please run with --mode download first")
        logger.error("Or manually place CSV files in metrics/ folder")
        logger.error(f"Expected location: {metrics_dir}")
        return False
    
    try:
        # Train Random Forest
        logger.info("\n" + "="*80)
        logger.info("Training Random Forest...")
        logger.info("="*80)
        result = subprocess.run(
            [sys.executable, 'random_forest.py'],
            cwd=training_dir,
            check=True
        )
        
        # Train LSTM-CNN
        logger.info("\n" + "="*80)
        logger.info("Training LSTM-CNN...")
        logger.info("="*80)
        result = subprocess.run(
            [sys.executable, 'lstm_cnn.py'],
            cwd=training_dir,
            check=True
        )
        
        logger.info("\n" + "="*80)
        logger.info("TRAINING COMPLETED!")
        logger.info("="*80)
        
        return True
        
    except subprocess.CalledProcessError as e:
        logger.error(f"Error during training: {e}")
        return False


def compare_models():
    """Compare both models"""
    logger.info("="*80)
    logger.info("COMPARING MODELS")
    logger.info("="*80)
    
    # Ensure we're running from training directory
    training_dir = Path(__file__).parent
    
    try:
        result = subprocess.run(
            [sys.executable, 'compare_models.py'],
            cwd=training_dir,
            check=True
        )
        
        logger.info("\n" + "="*80)
        logger.info("COMPARISON COMPLETED!")
        logger.info("="*80)
        
        # Display comparison report (from config)
        report_path = Path(config.COMPARISON_OUTPUT_DIR) / 'comparison_report.txt'
        if report_path.exists():
            logger.info("\n" + "="*80)
            logger.info("COMPARISON REPORT:")
            logger.info("="*80 + "\n")
            with open(report_path, 'r') as f:
                print(f.read())
        else:
            logger.warning(f"Report not found at: {report_path}")
        
        return True
        
    except subprocess.CalledProcessError as e:
        logger.error(f"Error during comparison: {e}")
        return False


def test_inference():
    """Test inference with example data"""
    logger.info("="*80)
    logger.info("TESTING INFERENCE")
    logger.info("="*80)
    
    try:
        # inference.py is in parent directory
        inference_path = Path(__file__).parent.parent / 'inference.py'
        result = subprocess.run(
            [sys.executable, str(inference_path)],
            check=True
        )
        
        logger.info("\n" + "="*80)
        logger.info("INFERENCE TEST COMPLETED!")
        logger.info("="*80)
        
        return True
        
    except subprocess.CalledProcessError as e:
        logger.error(f"Error during inference test: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description='Quick start script for K8s Auto-Scaling ML training'
    )
    parser.add_argument(
        '--mode',
        choices=['download', 'train', 'compare', 'test', 'all'],
        default='all',
        help='Mode to run (default: all)'
    )
    
    args = parser.parse_args()
    
    logger.info("\n" + "="*80)
    logger.info("K8S AUTO-SCALING ML - QUICK START")
    logger.info("="*80 + "\n")
    
    success = True
    
    if args.mode in ['download', 'all']:
        success = download_data_from_s3()
        if not success:
            logger.error("Data download failed. Stopping.")
            return 1
    
    if args.mode in ['train', 'all']:
        success = train_models()
        if not success:
            logger.error("Training failed. Stopping.")
            return 1
    
    if args.mode in ['compare', 'all']:
        success = compare_models()
        if not success:
            logger.error("Comparison failed. Stopping.")
            return 1
    
    if args.mode in ['test', 'all']:
        success = test_inference()
        if not success:
            logger.error("Inference test failed. Stopping.")
            return 1
    
    logger.info("\n" + "="*80)
    logger.info("🎉 ALL TASKS COMPLETED SUCCESSFULLY! 🎉")
    logger.info("="*80)
    logger.info("\nNext steps:")
    logger.info("1. Check results in: training/comparison_results/")
    logger.info("2. View plots in: plots/")
    logger.info("3. Load models from: models/")
    logger.info("4. Deploy using: inference.py")
    logger.info("="*80 + "\n")
    
    return 0


if __name__ == '__main__':
    sys.exit(main())

