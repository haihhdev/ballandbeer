#!/bin/bash

# Script to download metrics data from S3 bucket
# S3 Structure: s3://ballandbeer-metrics/metrics/YYYY/MM/metrics_YYYYMMDD.csv
# 
# Usage: 
#   ./download_data.sh              # Download all available data (interactive)
#   ./download_data.sh 2024-10      # Download October 2024 only
#   ./download_data.sh 2024-10-15   # Download specific date only
#   ./download_data.sh -y           # Download all (skip confirmation)
#   ./download_data.sh 2024-10 -y   # Download with skip confirmation

set -e

S3_BUCKET="ballandbeer-metrics"
S3_BASE_PREFIX="metrics"
AWS_REGION="ap-southeast-1"
LOCAL_DIR="../metrics"
SKIP_CONFIRM=false

# Parse arguments
DATE_FILTER=""
for arg in "$@"; do
    if [ "$arg" == "-y" ] || [ "$arg" == "--yes" ]; then
        SKIP_CONFIRM=true
    else
        DATE_FILTER="$arg"
    fi
done

if [ -z "$DATE_FILTER" ]; then
    # No date argument: download all
    S3_PREFIX="${S3_BASE_PREFIX}/"
    DOWNLOAD_TYPE="all"
else
    if [[ $DATE_FILTER =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
        # Format: YYYY-MM-DD (specific date)
        YEAR="${DATE_FILTER:0:4}"
        MONTH="${DATE_FILTER:5:2}"
        DAY="${DATE_FILTER:8:2}"
        S3_PREFIX="${S3_BASE_PREFIX}/${YEAR}/${MONTH}/"
        DOWNLOAD_TYPE="date"
        FILTER_FILE="metrics_${YEAR}${MONTH}${DAY}.csv"
    elif [[ $DATE_FILTER =~ ^[0-9]{4}-[0-9]{2}$ ]]; then
        # Format: YYYY-MM (month)
        YEAR="${DATE_FILTER:0:4}"
        MONTH="${DATE_FILTER:5:2}"
        S3_PREFIX="${S3_BASE_PREFIX}/${YEAR}/${MONTH}/"
        DOWNLOAD_TYPE="month"
    else
        echo "Error: Invalid date format. Use YYYY-MM or YYYY-MM-DD"
        echo "Usage: $0 [YYYY-MM | YYYY-MM-DD] [-y]"
        exit 1
    fi
fi

echo "=========================================="
echo "DOWNLOADING METRICS FROM S3"
echo "=========================================="
echo "Bucket: s3://${S3_BUCKET}/${S3_PREFIX}"
echo "Region: ${AWS_REGION}"
echo "Download type: ${DOWNLOAD_TYPE}"
[ ! -z "$FILTER_FILE" ] && echo "Filter: ${FILTER_FILE}"
echo ""

# Create metrics directory
mkdir -p "$LOCAL_DIR"

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo "Error: AWS CLI is not installed!"
    echo "Install: https://aws.amazon.com/cli/"
    exit 1
fi

# List available files
echo "Available files in S3:"
aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}" --region "$AWS_REGION" --recursive | grep "\.csv$" || {
    echo "No CSV files found in s3://${S3_BUCKET}/${S3_PREFIX}"
    exit 0
}

echo ""

# Confirmation prompt (unless -y flag is set)
if [ "$SKIP_CONFIRM" == false ]; then
    read -p "Download these files? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Download cancelled."
        exit 0
    fi
else
    echo "Auto-confirming download (--yes flag)..."
fi

echo ""
echo "Downloading CSV files..."

# Download files
if [ "$DOWNLOAD_TYPE" == "date" ] && [ ! -z "$FILTER_FILE" ]; then
    # Download specific file
    S3_KEY="${S3_PREFIX}${FILTER_FILE}"
    LOCAL_FILE="${LOCAL_DIR}/${FILTER_FILE}"
    
    aws s3 cp "s3://${S3_BUCKET}/${S3_KEY}" "$LOCAL_FILE" --region "$AWS_REGION" || {
        echo "File not found: ${S3_KEY}"
        exit 1
    }
else
    # Download all files in prefix (maintains directory structure)
    aws s3 sync "s3://${S3_BUCKET}/${S3_PREFIX}" "$LOCAL_DIR" \
        --region "$AWS_REGION" \
        --exclude "*" \
        --include "*.csv"
    
    # Flatten directory structure (move all CSV to metrics root)
    echo ""
    echo "Flattening directory structure..."
    find "$LOCAL_DIR" -name "*.csv" -type f | while read file; do
        filename=$(basename "$file")
        if [ "$file" != "${LOCAL_DIR}/${filename}" ]; then
            mv "$file" "${LOCAL_DIR}/${filename}"
            echo "  Moved: ${filename}"
        fi
    done
    
    # Clean up empty directories
    find "$LOCAL_DIR" -type d -empty -delete 2>/dev/null || true
fi

echo ""
echo "=========================================="
echo "DOWNLOAD COMPLETED!"
echo "=========================================="

# Show summary
if [ -d "$LOCAL_DIR" ]; then
    CSV_FILES=("$LOCAL_DIR"/*.csv)
    
    if [ -f "${CSV_FILES[0]}" ]; then
        echo "Downloaded files:"
        ls -lh "$LOCAL_DIR"/*.csv
        
        echo ""
        echo "Data summary:"
        total_rows=0
        total_size=0
        file_count=0
        
        for file in "$LOCAL_DIR"/*.csv; do
            if [ -f "$file" ]; then
                rows=$(wc -l < "$file" 2>/dev/null || echo 0)
                rows=$((rows - 1))  # Subtract header
                size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo 0)
                
                total_rows=$((total_rows + rows))
                total_size=$((total_size + size))
                file_count=$((file_count + 1))
                
                echo "  $(basename $file): $rows rows"
            fi
        done
        
        echo ""
        echo "Total: $file_count files, $total_rows rows"
        echo "Total size: $(numfmt --to=iec-i --suffix=B $total_size 2>/dev/null || echo "${total_size} bytes")"
        echo ""
        echo "Data saved to: $(cd "$LOCAL_DIR" && pwd)"
    else
        echo "No CSV files found after download"
    fi
fi

echo ""

