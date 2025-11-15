FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (only needed for building, then cleanup)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copy requirements
COPY requirements.txt .

# Install Python dependencies and cleanup
RUN pip install --no-cache-dir -r requirements.txt \
    && find /usr/local/lib/python3.11 -type d -name '__pycache__' -exec rm -rf {} + 2>/dev/null || true \
    && find /usr/local/lib/python3.11 -type d -name 'tests' -exec rm -rf {} + 2>/dev/null || true \
    && find /usr/local/lib/python3.11 -type d -name '*.dist-info' -exec rm -rf {}/RECORD {} + 2>/dev/null || true

# Copy application code
COPY app.py inference.py config.py data_preprocessor.py ./

# Copy trained models
COPY models/ ./models/

# Run application
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]
