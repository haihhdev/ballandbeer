from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import tensorflow as tf
import json
from fastapi.middleware.cors import CORSMiddleware
import os
import boto3
import tempfile
import shutil

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables for models and data
user_model = None
product_model = None
product_features = None
unique_products = None
unique_categories = None

def download_from_s3(bucket_name, s3_key, local_path):
    """Download a file or directory from S3 to local path"""
    s3_client = boto3.client('s3')
    if s3_key.endswith('.json'):  # hoặc kiểm tra là file
        # Tải file đơn lẻ
        s3_client.download_file(bucket_name, s3_key, local_path)
    else:
        # Tải cả thư mục
        paginator = s3_client.get_paginator('list_objects_v2')
        for page in paginator.paginate(Bucket=bucket_name, Prefix=s3_key):
            if 'Contents' not in page:
                continue
            for obj in page['Contents']:
                key = obj['Key']
                if key.endswith('/'):
                    continue  # bỏ qua folder marker
                local_file = os.path.join(local_path, os.path.relpath(key, s3_key))
                os.makedirs(os.path.dirname(local_file), exist_ok=True)
                s3_client.download_file(bucket_name, key, local_file)

def load_models_and_data():
    global user_model, product_model, product_features, unique_products, unique_categories
    try:
        # Create temporary directory for models
        temp_dir = tempfile.mkdtemp()
        
        # Download models from S3
        bucket_name = os.getenv('S3_BUCKET_NAME', 'ballandbeer-rcm')
        download_from_s3(bucket_name, 'models/user_model/', os.path.join(temp_dir, 'user_model'))
        download_from_s3(bucket_name, 'models/product_model/', os.path.join(temp_dir, 'product_model'))
        download_from_s3(bucket_name, 'data/product_data.json', os.path.join(temp_dir, 'product_data.json'))

        # Load models
        user_model = tf.keras.models.load_model(os.path.join(temp_dir, 'user_model'))
        product_model = tf.keras.models.load_model(os.path.join(temp_dir, 'product_model'))

        # Load product features
        with open(os.path.join(temp_dir, 'product_data.json'), "r") as f:
            product_features = json.load(f)

        unique_products = list(product_features.keys())
        unique_categories = [product_features[p]["category"] for p in unique_products]

        # Clean up temporary directory
        shutil.rmtree(temp_dir)
    except Exception as e:
        print(f"Error loading models or data: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to load recommendation models")

# Load models on startup
@app.on_event("startup")
async def startup_event():
    load_models_and_data()

class RecommendRequest(BaseModel):
    user_id: str
    k: int = 5

@app.post("/recommend")
def recommend(req: RecommendRequest):
    try:
        if user_model is None or product_model is None:
            load_models_and_data()
            
        user_embedding = user_model(tf.constant([req.user_id]))
        product_embeddings = product_model(
            tf.constant(unique_products),
            tf.constant(unique_categories)
        )
        scores = tf.matmul(user_embedding, product_embeddings, transpose_b=True)
        top_k = tf.math.top_k(scores, k=req.k)
        recommended = [unique_products[i] for i in top_k.indices[0].numpy()]
        
        return {
            "recommendations": [
                {
                    "product_id": pid,
                    "name": product_features[pid]["name"],
                    "category": product_features[pid]["category"]
                }
                for pid in recommended
            ]
        }
    except Exception as e:
        print(f"Error in recommendation: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate recommendations")

@app.get("/health")
def health_check():
    return {"status": "healthy"}
