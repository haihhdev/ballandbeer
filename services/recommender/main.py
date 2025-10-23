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
    allow_origins=["*"],
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
    """Download a file from S3 to local path"""
    s3_client = boto3.client('s3')
    s3_client.download_file(bucket_name, s3_key, local_path)

def load_models_and_data():
    global user_model, product_model, product_features, unique_products, unique_categories
    try:
        # Create temporary directory for models
        temp_dir = tempfile.mkdtemp()
        
        # Download models from S3
        bucket_name = os.getenv('S3_BUCKET', 'bnb-rcm-kltn')
        print(f"Loading models from S3 bucket: {bucket_name}")
        
        print("Downloading user_model...")
        download_from_s3(bucket_name, 'models/user_model.keras', os.path.join(temp_dir, 'user_model.keras'))
        
        print("Downloading product_model...")
        download_from_s3(bucket_name, 'models/product_model.keras', os.path.join(temp_dir, 'product_model.keras'))
        
        print("Downloading product_data.json...")
        download_from_s3(bucket_name, 'data/product_data.json', os.path.join(temp_dir, 'product_data.json'))
        
        print("Downloading model_metadata.json...")
        download_from_s3(bucket_name, 'data/model_metadata.json', os.path.join(temp_dir, 'model_metadata.json'))

        # Load models in Keras 3 native format
        user_model = tf.keras.models.load_model(os.path.join(temp_dir, 'user_model.keras'))
        product_model = tf.keras.models.load_model(os.path.join(temp_dir, 'product_model.keras'))

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
            
        # Generate user embedding
        user_embedding = user_model(tf.constant([req.user_id]))
        
        # Generate product embeddings
        product_embeddings = product_model(
            tf.constant(unique_products),
            tf.constant(unique_categories)
        )
        
        # Calculate similarity scores
        scores = tf.matmul(user_embedding, product_embeddings, transpose_b=True)
        
        # Get top k recommendations
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
