from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import json
from fastapi.middleware.cors import CORSMiddleware
import os
import boto3
import tempfile
import shutil
import numpy as np
import keras
from collections import defaultdict

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables
model = None
metadata = None
product_features = None
unique_users = None
unique_products = None
user_to_idx = None
product_to_idx = None
user_purchased_products = None
user_product_counts = None
popular_products = None

def download_from_s3(bucket_name, s3_key, local_path):
    """Download a file from S3 to local path"""
    s3_client = boto3.client('s3')
    s3_client.download_file(bucket_name, s3_key, local_path)

def load_model_and_data():
    global model, metadata, product_features, unique_users, unique_products, user_to_idx, product_to_idx, user_purchased_products, user_product_counts, popular_products
    try:
        # Create temporary directory
        temp_dir = tempfile.mkdtemp()
        
        # Download data from S3
        bucket_name = os.getenv('S3_BUCKET', 'bnb-rcm-kltn')
        print(f"Loading model and data from S3 bucket: {bucket_name}")
        
        print("Downloading recommender_model.keras...")
        download_from_s3(bucket_name, 'models/recommender_model.keras', os.path.join(temp_dir, 'recommender_model.keras'))
        
        print("Downloading model_metadata.json...")
        download_from_s3(bucket_name, 'models/model_metadata.json', os.path.join(temp_dir, 'model_metadata.json'))

        # Load model
        print("Loading Keras model...")
        model = keras.models.load_model(os.path.join(temp_dir, 'recommender_model.keras'))
        
        # Load metadata
        with open(os.path.join(temp_dir, 'model_metadata.json'), "r") as f:
            metadata = json.load(f)
            
        unique_users = metadata["unique_users"]
        unique_products = metadata["unique_products"]
        product_features = metadata["product_features"]
        user_to_idx = metadata["user_to_idx"]
        product_to_idx = metadata["product_to_idx"]
        
        # Load user purchase history if available
        try:
            print("Downloading user purchase history...")
            download_from_s3(bucket_name, 'data/recommendation_data.json', os.path.join(temp_dir, 'recommendation_data.json'))
            with open(os.path.join(temp_dir, 'recommendation_data.json'), "r") as f:
                rec_data = json.load(f)
                user_purchased_products = rec_data.get("user_products", {})
                user_product_counts = rec_data.get("user_product_counts", {})
                popular_products = rec_data.get("popular_products", [])
        except Exception as e:
            print(f"Could not load purchase history: {e}")
            user_purchased_products = {}
            user_product_counts = {}
            popular_products = []
        
        print(f"Model and data loaded successfully! Found {len(unique_users)} users and {len(unique_products)} products")

        # Clean up temporary directory
        shutil.rmtree(temp_dir)
    except Exception as e:
        print(f"Error loading model and data: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to load recommendation model")

# Load data on startup
@app.on_event("startup")
async def startup_event():
    load_model_and_data()

class RecommendRequest(BaseModel):
    user_id: str
    k: int = 10

@app.post("/recommend")
def recommend(req: RecommendRequest):
    try:
        print(f"Received recommendation request for user_id: {req.user_id}, k: {req.k}")
        
        if model is None:
            print("Model not loaded, loading now...")
            load_model_and_data()
        
        # Get user's purchased products and counts
        purchased_products = set(user_purchased_products.get(req.user_id, []))
        purchase_counts = user_product_counts.get(req.user_id, {})
        
        print(f"User {req.user_id} has purchased {len(purchased_products)} unique products")
        
        # Check if user exists in training data
        if req.user_id not in user_to_idx:
            print(f"New user {req.user_id}, recommending popular products")
            recommended_products = popular_products[:req.k]
        else:
            # Get user index and predict scores for ALL products
            user_idx = user_to_idx[req.user_id]
            user_indices = np.array([user_idx] * len(unique_products))
            product_indices = np.array(list(range(len(unique_products))))
            
            predictions = model.predict([user_indices, product_indices], verbose=0)
            scores = predictions.flatten()
            
            # Create product_id to score mapping
            product_scores = {unique_products[idx]: scores[idx] for idx in range(len(unique_products))}
            
            # Get purchased categories
            purchased_categories = set()
            for product in purchased_products:
                if product in product_features:
                    purchased_categories.add(product_features[product]["category"])
            
            recommended_products = []
            
            # STEP 1: Add 2 repurchase products (bought >= 2 times)
            repurchase_candidates = []
            for product, count in purchase_counts.items():
                if count >= 2 and product in product_scores:
                    repurchase_candidates.append((product, product_scores[product]))
            
            repurchase_candidates.sort(key=lambda x: x[1], reverse=True)
            for product, score in repurchase_candidates[:2]:
                recommended_products.append(product)
                print(f"Repurchase: {product} (bought {purchase_counts[product]} times, score: {score:.3f})")
            
            # STEP 2: Add 6 same-category products (NOT purchased yet)
            same_category_candidates = []
            for product in unique_products:
                if product in purchased_products or product in recommended_products:
                    continue
                if product in product_features:
                    category = product_features[product]["category"]
                    if category in purchased_categories:
                        same_category_candidates.append((product, product_scores[product], category))
            
            same_category_candidates.sort(key=lambda x: x[1], reverse=True)
            added = 0
            for product, score, category in same_category_candidates:
                if added >= 6:
                    break
                recommended_products.append(product)
                print(f"Same category: {product} from {category} (score: {score:.3f})")
                added += 1
            
            # STEP 3: Add 2 popular products (from all users)
            popular_added = 0
            for product in popular_products:
                if product not in recommended_products:
                    recommended_products.append(product)
                    popular_added += 1
                    print(f"Popular: {product}")
                    if popular_added >= 2:
                        break
            
            # Fill remaining slots if needed
            if len(recommended_products) < req.k:
                sorted_indices = np.argsort(scores)[::-1]
                for idx in sorted_indices:
                    product_id = unique_products[idx]
                    if product_id not in recommended_products:
                        recommended_products.append(product_id)
                        if len(recommended_products) >= req.k:
                            break
            
            print(f"Final: {len(recommended_products)} products (2 repurchase + 6 same-category + 2 popular)")
        
        # Return recommendations with details
        return {
            "recommendations": [
                {
                    "product_id": pid,
                    "name": product_features.get(pid, {}).get("name", "Unknown"),
                    "category": product_features.get(pid, {}).get("category", "other")
                }
                for pid in recommended_products if pid in product_features
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

@app.get("/")
def root():
    return {
        "service": "Ball and Beer Recommender",
        "version": "3.0 - Deep Learning with TensorFlow/Keras",
        "status": "running",
        "model_info": {
            "users": len(unique_users) if unique_users else 0,
            "products": len(unique_products) if unique_products else 0
        },
        "endpoints": {
            "health": "/health",
            "recommend": "/recommend (POST)"
        }
    }
