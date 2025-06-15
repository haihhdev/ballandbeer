# main.py

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import tensorflow as tf
import json
from fastapi.middleware.cors import CORSMiddleware
import os

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

def load_models_and_data():
    global user_model, product_model, product_features, unique_products, unique_categories
    try:
        # Load models
        user_model = tf.keras.models.load_model("user_model")
        product_model = tf.keras.models.load_model("product_model")

        # Load product features
        with open("product_data.json", "r") as f:
            product_features = json.load(f)

        unique_products = list(product_features.keys())
        unique_categories = [product_features[p]["category"] for p in unique_products]
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
