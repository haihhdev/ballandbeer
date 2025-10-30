# Multi-stage build to reduce final image size
FROM python:3.11-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Final stage - use minimal base image
FROM python:3.11-slim

WORKDIR /app

# Run as non-root user for security - create user first
RUN useradd -m -u 1000 appuser

# Copy only necessary Python packages from builder to appuser home
COPY --from=builder --chown=appuser:appuser /root/.local /home/appuser/.local

# Copy application code
COPY --chown=appuser:appuser pipeline.py main.py ./

# Update PATH to include user-installed packages
ENV PATH=/home/appuser/.local/bin:$PATH

# Set environment variables
ENV PORT=4005 \
    HOST=0.0.0.0 \
    AWS_DEFAULT_REGION=ap-southeast-1 \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Expose port
EXPOSE 4005

# Switch to non-root user
USER appuser

# Command to run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "4005"] 