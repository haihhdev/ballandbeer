# Use Python 3.9 as base image
FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY pipeline.py .
COPY main.py .

# Set environment variables
ENV PORT=4005
ENV HOST=0.0.0.0
ENV AWS_DEFAULT_REGION=ap-southeast-1

# Expose the port
EXPOSE 4005

# Command to run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "4005"] 