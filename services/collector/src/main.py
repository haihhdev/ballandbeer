import logging
import time
import csv
import os
import signal
import sys
from datetime import datetime, time as dt_time
from pathlib import Path
import pandas as pd
import schedule
import pytz

import config
from metrics_collector import MetricsCollector
from feature_engineer import FeatureEngineer
from s3_uploader import S3Uploader

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class CollectorService:
    def __init__(self):
        self.collector = MetricsCollector()
        self.engineer = FeatureEngineer()
        self.uploader = S3Uploader()
        self.timezone = pytz.timezone('Asia/Ho_Chi_Minh')
        self.data_dir = Path('/data')
        self.data_dir.mkdir(exist_ok=True)
        self.current_csv_path = None
        self.running = True
        
        signal.signal(signal.SIGTERM, self.handle_shutdown)
        signal.signal(signal.SIGINT, self.handle_shutdown)
    
    def handle_shutdown(self, signum, frame):
        logger.info("Received shutdown signal, gracefully stopping...")
        self.running = False
        self.upload_today_data()
        sys.exit(0)
    
    def is_collection_time(self) -> bool:
        now = datetime.now(self.timezone)
        current_hour = now.hour
        return config.COLLECTION_START_HOUR <= current_hour < config.COLLECTION_END_HOUR
    
    def get_csv_path(self) -> Path:
        today = datetime.now(self.timezone).date()
        filename = f"metrics_{today.strftime('%Y%m%d')}.csv"
        return self.data_dir / filename
    
    def initialize_csv(self, csv_path: Path):
        if not csv_path.exists():
            logger.info(f"Creating new CSV file: {csv_path}")
            with open(csv_path, 'w', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=config.CSV_COLUMNS)
                writer.writeheader()
    
    def append_metrics(self, metrics: dict, csv_path: Path):
        with open(csv_path, 'a', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=config.CSV_COLUMNS)
            writer.writerow(metrics)
    
    def collect_metrics(self):
        if not self.is_collection_time():
            logger.info("Outside collection time window, skipping...")
            return
        
        logger.info("Starting metrics collection cycle")
        csv_path = self.get_csv_path()
        self.initialize_csv(csv_path)
        
        for service in config.SERVICES:
            try:
                raw_metrics = self.collector.collect_all_metrics(service)
                enriched_metrics = self.engineer.enrich_metrics(service, raw_metrics)
                
                ordered_metrics = {col: enriched_metrics.get(col, 0) for col in config.CSV_COLUMNS}
                
                self.append_metrics(ordered_metrics, csv_path)
                logger.info(f"Collected and saved metrics for {service}")
                
            except Exception as e:
                logger.error(f"Error collecting metrics for {service}: {e}", exc_info=True)
        
        logger.info(f"Metrics collection cycle completed. Data saved to {csv_path}")
    
    def upload_today_data(self):
        csv_path = self.get_csv_path()
        
        if not csv_path.exists():
            logger.warning(f"No data file found at {csv_path}")
            return
        
        if csv_path.stat().st_size == 0:
            logger.warning(f"Data file {csv_path} is empty")
            return
        
        today = datetime.now(self.timezone).date()
        s3_key = self.uploader.generate_s3_key(datetime.combine(today, dt_time.min))
        
        logger.info(f"Uploading today's data to S3...")
        success = self.uploader.upload_file(str(csv_path), s3_key)
        
        if success:
            logger.info(f"Successfully uploaded {csv_path} to S3")
        else:
            logger.error(f"Failed to upload {csv_path} to S3")
    
    def schedule_daily_upload(self):
        schedule.every().day.at("22:05").do(self.upload_today_data)
        logger.info("Scheduled daily upload at 22:05")
    
    def run(self):
        logger.info("Collector service starting...")
        logger.info(f"Prometheus URL: {config.PROMETHEUS_URL}")
        logger.info(f"S3 Bucket: {config.S3_BUCKET}")
        logger.info(f"Collection interval: {config.COLLECTION_INTERVAL} seconds")
        logger.info(f"Collection window: {config.COLLECTION_START_HOUR}:00 - {config.COLLECTION_END_HOUR}:00")
        logger.info(f"Services to monitor: {', '.join(config.SERVICES)}")
        
        if not self.uploader.check_bucket_exists():
            logger.error("S3 bucket check failed. Service will continue but uploads may fail.")
        
        self.schedule_daily_upload()
        
        while self.running:
            try:
                self.collect_metrics()
                schedule.run_pending()
                time.sleep(config.COLLECTION_INTERVAL)
                
            except KeyboardInterrupt:
                logger.info("Received interrupt signal")
                break
            except Exception as e:
                logger.error(f"Error in main loop: {e}", exc_info=True)
                time.sleep(config.COLLECTION_INTERVAL)
        
        logger.info("Collector service stopped")


def main():
    service = CollectorService()
    service.run()


if __name__ == '__main__':
    main()
