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
    if s3_key.endswith('.json'):
        s3_client.download_file(bucket_name, s3_key, local_path)
    else:
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
        bucket_name = os.getenv('S3_BUCKET', 'bnb-rcm-kltn')
        print(f"Loading models from S3 bucket: {bucket_name}")
        
        print("Downloading user_model...")
        download_from_s3(bucket_name, 'models/user_model/', os.path.join(temp_dir, 'user_model'))
        
        print("Downloading product_model...")
        download_from_s3(bucket_name, 'models/product_model/', os.path.join(temp_dir, 'product_model'))
        
        print("Downloading product_data.json...")
        download_from_s3(bucket_name, 'data/product_data.json', os.path.join(temp_dir, 'product_data.json'))
        
        print("Downloading model_metadata.json...")
        download_from_s3(bucket_name, 'data/model_metadata.json', os.path.join(temp_dir, 'model_metadata.json'))

        # Load models
        user_model = tf.keras.models.load_model(os.path.join(temp_dir, 'user_model'))
        product_model = tf.keras.models.load_model(os.path.join(temp_dir, 'product_model'))

        # Load product features
        with open(os.path.join(temp_dir, 'product_data.json'), "r") as f:
            product_features = json.load(f)
            
        # Load model metadata to get exact vocabulary used during training
        with open(os.path.join(temp_dir, 'model_metadata.json'), "r") as f:
            metadata = json.load(f)
            
        # Use the exact product order from training
        unique_products = metadata["unique_products"]
        unique_categories = [product_features[p]["category"] for p in unique_products]
        
        print(f"Models loaded successfully! Found {len(unique_products)} products")

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
        print(f"Received recommendation request for user_id: {req.user_id}, k: {req.k}")
        
        if user_model is None or product_model is None:
            print("Models not loaded, loading now...")
            load_models_and_data()
            
        user_embedding = user_model(tf.constant([req.user_id]))
        product_embeddings = product_model(
            tf.constant(unique_products),
            tf.constant(unique_categories)
        )
        scores = tf.matmul(user_embedding, product_embeddings, transpose_b=True)
        top_k = tf.math.top_k(scores, k=req.k)
        recommended = [unique_products[i] for i in top_k.indices[0].numpy()]
        
        print(f"Recommended products: {recommended}")
        
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
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to generate recommendations: {str(e)}")

@app.get("/health")
def health_check():
    return {"status": "healthy"}
