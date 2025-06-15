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

# Copy application code and model files
COPY main.py .
COPY product_data.json .
COPY user_model/ user_model/
COPY product_model/ product_model/
COPY pipeline.py .

# Create startup script
RUN echo '#!/bin/bash\npython pipeline.py\nuvicorn main:app --host 0.0.0.0 --port 4005' > /app/start.sh
RUN chmod +x /app/start.sh

# Set environment variables
ENV PORT=4005
ENV HOST=0.0.0.0

# Expose the port
EXPOSE 4005

# Command to run the application
CMD ["/app/start.sh"] 