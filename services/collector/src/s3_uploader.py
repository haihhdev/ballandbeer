import logging
import boto3
from botocore.exceptions import ClientError
from datetime import datetime
import os
import config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class S3Uploader:
    def __init__(self):
        self.s3_client = boto3.client('s3', region_name=config.S3_REGION)
        self.bucket = config.S3_BUCKET
    
    def upload_file(self, local_file_path: str, s3_key: str) -> bool:
        try:
            logger.info(f"Uploading {local_file_path} to s3://{self.bucket}/{s3_key}")
            
            self.s3_client.upload_file(
                local_file_path,
                self.bucket,
                s3_key,
                ExtraArgs={'ContentType': 'text/csv'}
            )
            
            logger.info(f"Successfully uploaded to S3: {s3_key}")
            return True
            
        except ClientError as e:
            logger.error(f"Failed to upload to S3: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error during S3 upload: {e}")
            return False
    
    def generate_s3_key(self, date: datetime) -> str:
        return f"metrics/{date.strftime('%Y/%m/%d')}/metrics_{date.strftime('%Y%m%d')}.csv"
    
    def check_bucket_exists(self) -> bool:
        try:
            self.s3_client.head_bucket(Bucket=self.bucket)
            logger.info(f"S3 bucket {self.bucket} exists and is accessible")
            return True
        except ClientError as e:
            error_code = e.response['Error']['Code']
            if error_code == '404':
                logger.error(f"S3 bucket {self.bucket} does not exist")
            elif error_code == '403':
                logger.error(f"Access denied to S3 bucket {self.bucket}")
            else:
                logger.error(f"Error checking bucket: {e}")
            return False
