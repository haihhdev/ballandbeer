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

# Copy only necessary Python packages from builder
COPY --from=builder /root/.local /root/.local

# Copy application code and model files
COPY pipeline.py main.py ./
COPY recommender_model.keras model_metadata.json recommendation_data.json ./

# Update PATH to include user-installed packages
ENV PATH=/root/.local/bin:$PATH

# Set environment variables
ENV PORT=4005 \
    HOST=0.0.0.0 \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    MODEL_PATH=recommender_model.keras \
    METADATA_PATH=model_metadata.json \
    REC_DATA_PATH=recommendation_data.json

# Expose port
EXPOSE 4005

# Run as non-root user for security
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app
USER appuser

# Command to run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "4005"]