import pandas as pd
import numpy as np
import tensorflow as tf
import keras
from keras import layers
import json
import os
from pymongo import MongoClient
from dotenv import load_dotenv
import hvac
import kubernetes
from kubernetes import client, config

# Load environment variables
load_dotenv()

# ======================
# STEP 0: GET CONFIG FROM VAULT
# ======================
def get_vault_token():
    if os.path.exists('/var/run/secrets/kubernetes.io/serviceaccount/token'):
        try:
            config.load_incluster_config()
            with open('/var/run/secrets/kubernetes.io/serviceaccount/token', 'r') as f:
                jwt = f.read()
            vault_client = hvac.Client(url=os.getenv('VAULT_URL', 'http://vault:8200'))
            vault_client.auth.kubernetes.login(role=os.getenv('VAULT_ROLE', 'default'), jwt=jwt)
            return vault_client.token
        except Exception as e:
            print(f"Error getting token from Kubernetes: {e}")
            return None
    else:
        return os.getenv('VAULT_TOKEN')

def get_mongodb_config():
    try:
        vault_url = os.getenv('VAULT_URL', 'http://localhost:8200')
        vault_token = get_vault_token()
        
        if vault_token:
            client_vault = hvac.Client(url=vault_url, token=vault_token)
            secret = client_vault.secrets.kv.v2.read_secret_version(path='rcm-service', mount_point='secret')
            return {
                'url': secret['data']['data']['MONGODB_URL'],
                'database': secret['data']['data']['MONGODB_DATABASE']
            }
    except Exception as e:
        print(f"Error getting config from Vault: {e}")
        print("Falling back to environment variables...")
        
    return {
        'url': os.getenv('MONGODB_URL'),
        'database': os.getenv('MONGODB_DATABASE')
    }

mongodb_config = get_mongodb_config()
mongodb_url = mongodb_config['url']
database_name = mongodb_config['database']
print(f"Connecting to database: {database_name}")

# ======================
# STEP 1: CONNECT TO MONGODB
# ======================
client = MongoClient(mongodb_url)
db = client[database_name]

# Fetch orders
orders_raw = list(db.orders.find({}, {"userId": 1, "updatedAt": 1, "products": 1, "status": 1}))
print(f"Found {len(orders_raw)} orders")

if len(orders_raw) == 0:
    print("ERROR: No orders found in database.")
    exit(1)

orders = pd.DataFrame(orders_raw)
if "userId" in orders.columns:
    orders["userId"] = orders["userId"].astype(str)
else:
    print("ERROR: userId field not found")
    exit(1)

# Fetch ALL products from database
all_products = list(db.products.find({}, {"_id": 1, "category": 1, "name": 1}))
print(f"Found {len(all_products)} total products in database")

products_df = pd.DataFrame(all_products)
products_df["_id"] = products_df["_id"].astype(str)
products_df["category"] = products_df["category"].fillna("other").str.lower()
products_df = products_df.rename(columns={"_id": "product_id"})
products_df["product_id"] = products_df["product_id"].str.lower().str.strip()

# ======================
# STEP 2: BUILD TRANSACTIONS
# ======================
records = []
for _, row in orders.iterrows():
    if str(row.get("status")).strip().lower() != "complete":
        continue
    user_id = row["userId"]
    for item in row.get("products", []):
        product_id = item.get("productId")
        if pd.notna(product_id):
            records.append({"user_id": user_id, "product_id": str(product_id).lower().strip()})

transactions_df = pd.DataFrame(records)
print(f"Found {len(transactions_df)} transactions")

# ======================
# STEP 3: PREPARE DATA FOR DEEP LEARNING
# ======================
unique_users = transactions_df["user_id"].unique().tolist()
unique_products = products_df["product_id"].tolist()

print(f"Found {len(unique_users)} unique users")
print(f"Found {len(unique_products)} products total (all from database)")

# Track user purchase history with counts
from collections import defaultdict
user_products = defaultdict(set)
user_product_counts = defaultdict(lambda: defaultdict(int))
product_popularity = defaultdict(int)

for _, row in transactions_df.iterrows():
    user_products[row["user_id"]].add(row["product_id"])
    user_product_counts[row["user_id"]][row["product_id"]] += 1
    product_popularity[row["product_id"]] += 1

# Get popular products (sorted by purchase count)
popular_products = sorted(product_popularity.items(), key=lambda x: x[1], reverse=True)
popular_products = [p[0] for p in popular_products[:50]]  # Top 50

# Create mappings
user_to_idx = {user: idx for idx, user in enumerate(unique_users)}
product_to_idx = {product: idx for idx, product in enumerate(unique_products)}

# Prepare training data
user_indices = transactions_df["user_id"].map(user_to_idx).values
product_indices = transactions_df["product_id"].map(product_to_idx).values

# ======================
# STEP 4: BUILD DEEP LEARNING MODEL
# ======================
embedding_dim = 32

# User tower
user_input = layers.Input(shape=(1,), name='user_input')
user_embedding = layers.Embedding(len(unique_users), embedding_dim, name='user_embedding')(user_input)
user_vec = layers.Flatten()(user_embedding)
user_vec = layers.Dense(32, activation='relu')(user_vec)

# Product tower
product_input = layers.Input(shape=(1,), name='product_input')
product_embedding = layers.Embedding(len(unique_products), embedding_dim, name='product_embedding')(product_input)
product_vec = layers.Flatten()(product_embedding)
product_vec = layers.Dense(32, activation='relu')(product_vec)

# Compute dot product (similarity)
dot_product = layers.Dot(axes=1)([user_vec, product_vec])
output = layers.Dense(1, activation='sigmoid')(dot_product)

# Build model
model = keras.Model(inputs=[user_input, product_input], outputs=output)
model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])

print("\nModel architecture:")
model.summary()

# ======================
# STEP 5: TRAIN MODEL
# ======================
print("\nTraining model...")
# Create positive samples (actual purchases)
labels = np.ones(len(user_indices))

# Train
history = model.fit(
    [user_indices, product_indices],
    labels,
    epochs=10,
    batch_size=32,
    verbose=1
)

print(f"Training completed. Final loss: {history.history['loss'][-1]:.4f}")

# ======================
# STEP 6: SAVE MODEL
# ======================
print("\nSaving model...")
model.save('recommender_model.keras')

# Save metadata
product_features = {}
for _, row in products_df.iterrows():
    pid = row["product_id"]
    product_features[pid] = {
        "category": row["category"],
        "name": row["name"]
    }

metadata = {
    "unique_users": unique_users,
    "unique_products": unique_products,
    "product_features": product_features,
    "user_to_idx": user_to_idx,
    "product_to_idx": product_to_idx,
    "embedding_dim": embedding_dim
}

with open("model_metadata.json", "w") as f:
    json.dump(metadata, f)

# Save user purchase history for filtering in recommendations
recommendation_data = {
    "user_products": {user: list(prods) for user, prods in user_products.items()},
    "user_product_counts": {user: dict(counts) for user, counts in user_product_counts.items()},
    "product_features": product_features,
    "popular_products": popular_products
}

with open("recommendation_data.json", "w") as f:
    json.dump(recommendation_data, f)

print(f"Saved metadata for {len(unique_users)} users and {len(unique_products)} products")
print("\nPipeline completed successfully!")
print("Model files saved locally:")
print("  - recommender_model.keras")
print("  - model_metadata.json")
print("  - recommendation_data.json")
