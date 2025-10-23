import logging
import sys
from pathlib import Path
from datetime import datetime
import pytz

sys.path.insert(0, str(Path(__file__).parent))

from s3_uploader import S3Uploader
import config

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def manual_upload():
    uploader = S3Uploader()
    timezone = pytz.timezone('Asia/Ho_Chi_Minh')
    data_dir = Path('/data')
    
    today = datetime.now(timezone).date()
    csv_path = data_dir / f"metrics_{today.strftime('%Y%m%d')}.csv"
    
    if not csv_path.exists():
        logger.error(f"File not found: {csv_path}")
        return False
    
    if csv_path.stat().st_size == 0:
        logger.warning(f"File is empty: {csv_path}")
        return False
    
    s3_key = uploader.generate_s3_key(datetime.combine(today, datetime.min.time()))
    
    logger.info(f"Manually uploading {csv_path} to S3...")
    success = uploader.upload_file(str(csv_path), s3_key)
    
    if success:
        logger.info("Manual upload completed successfully")
        return True
    else:
        logger.error("Manual upload failed")
        return False


if __name__ == '__main__':
    success = manual_upload()
    sys.exit(0 if success else 1)
