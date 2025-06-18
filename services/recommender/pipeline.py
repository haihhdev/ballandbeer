# pipeline.py

import pandas as pd
import tensorflow as tf
import tensorflow_recommenders as tfrs
from pymongo import MongoClient
import numpy as np
import json
import os
import hvac
import kubernetes
from kubernetes import client, config
import base64
from dotenv import load_dotenv
import boto3

# Load environment variables from .env file
load_dotenv()

# ======================
# STEP 0: LẤY THÔNG TIN TỪ VAULT
# ======================
def get_vault_token():
    # Kiểm tra xem có đang chạy trong Kubernetes không
    if os.path.exists('/var/run/secrets/kubernetes.io/serviceaccount/token'):
        try:
            # Load kube config từ service account
            config.load_incluster_config()
            k8s_client = client.CoreV1Api()
            
            # Lấy service account token
            with open('/var/run/secrets/kubernetes.io/serviceaccount/token', 'r') as f:
                jwt = f.read()
            
            # Kết nối với Vault và login bằng Kubernetes auth
            vault_client = hvac.Client(url=os.getenv('VAULT_URL', 'http://vault:8200'))
            vault_client.auth.kubernetes.login(
                role=os.getenv('VAULT_ROLE', 'default'),
                jwt=jwt
            )
            return vault_client.token
        except Exception as e:
            print(f"Error getting token from Kubernetes: {e}")
            return None
    else:
        # Local development - sử dụng token từ env
        return os.getenv('VAULT_TOKEN')

def get_mongodb_config():
    try:
        vault_url = os.getenv('VAULT_URL', 'http://localhost:8200')
        vault_token = get_vault_token()
        
        if vault_token:
            client = hvac.Client(
                url=vault_url,
                token=vault_token
            )
            
            # Đọc secret từ Vault
            secret = client.secrets.kv.v2.read_secret_version(
                path='rcm-service',
                mount_point='secret'
            )
            
            return {
                'url': secret['data']['data']['MONGODB_URL'],
                'database': secret['data']['data']['MONGODB_DATABASE']
            }
    except Exception as e:
        print(f"Error getting config from Vault: {e}")
        print("Falling back to environment variables...")
        
    # Fallback to environment variables
    return {
        'url': os.getenv('MONGODB_URL'),
        'database': os.getenv('MONGODB_DATABASE')
    }

# Lấy thông tin kết nối từ Vault hoặc env
mongodb_config = get_mongodb_config()
mongodb_url = mongodb_config['url']
database_name = mongodb_config['database']

# ======================
# STEP 1: KẾT NỐI MONGODB
# ======================
client = MongoClient(mongodb_url)
db = client[database_name]

# Lấy orders (transaction)
orders = pd.DataFrame(list(db.orders.find({}, {
    "userId": 1,
    "updatedAt": 1,
    "products": 1,
    "status": 1
})))
orders["userId"] = orders["userId"].astype(str)  # Convert ObjectId to string

# Lấy products
products_df = pd.DataFrame(list(db.products.find({}, {
    "_id": 1,
    "category": 1,
    "name": 1
})))
products_df["_id"] = products_df["_id"].astype(str)
products_df["category"] = products_df["category"].fillna("unknown").str.lower()
products_df = products_df.rename(columns={"_id": "product_id"})

# ===============================
# STEP 2: FORMAT LẠI TRANSACTIONS
# ===============================
records = []
for _, row in orders.iterrows():
    if str(row.get("status")).strip().lower() != "complete":
        continue
    user_id = row["userId"]
    created_at = row["updatedAt"]
    for item in row.get("products", []):
        product_id = item.get("productId")
        if pd.notna(product_id):
            records.append({
                "user_id": user_id,
                "product_id": str(product_id),
                "timestamp": created_at
            })

transactions_df = pd.DataFrame(records)

# ===============================
# STEP 3: TIỀN XỬ LÝ DỮ LIỆU TRAIN
# ===============================
products_df["product_id"] = products_df["product_id"].str.lower().str.strip()
transactions_df["product_id"] = transactions_df["product_id"].str.lower().str.strip()
df_merged = transactions_df.merge(products_df, how="left", on="product_id")
df_merged["category"] = df_merged["category"].fillna("unknown")

df_final = df_merged[["user_id", "product_id", "category"]].dropna()

# ===============================
# STEP 4: CHUẨN BỊ TF.DATASET
# ===============================
unique_users = df_final["user_id"].unique()
unique_products = df_final["product_id"].unique()
unique_categories = df_final["category"].unique()

user_lookup = tf.keras.layers.StringLookup(vocabulary=unique_users)
product_lookup = tf.keras.layers.StringLookup(vocabulary=unique_products)
category_lookup = tf.keras.layers.StringLookup(vocabulary=unique_categories)

product_features = {}
for _, row in products_df.iterrows():
    product_features[row["product_id"]] = {
        "category": row["category"],
        "name": row["name"]
    }

with open("product_data.json", "w") as f:
    json.dump(product_features, f)

train_data = {
    "user_id": df_final["user_id"].values,
    "product_id": df_final["product_id"].values,
    "category": df_final["category"].values
}

train_dataset = tf.data.Dataset.from_tensor_slices(train_data)
train_dataset = train_dataset.shuffle(100_000).batch(128)

# ===============================
# STEP 5: MÔ HÌNH GỢI Ý
# ===============================
class ProductModel(tf.keras.Model):
    def __init__(self):
        super().__init__()
        self.product_embedding = tf.keras.Sequential([
            product_lookup,
            tf.keras.layers.Embedding(len(unique_products)+1, 32)
        ])
        self.category_embedding = tf.keras.Sequential([
            category_lookup,
            tf.keras.layers.Embedding(len(unique_categories)+1, 16)
        ])
        self.dense = tf.keras.layers.Dense(32)

    def call(self, product_id, category):
        return self.dense(
            tf.concat([
                self.product_embedding(product_id),
                self.category_embedding(category)
            ], axis=1)
        )

class UserModel(tf.keras.Model):
    def __init__(self):
        super().__init__()
        self.user_embedding = tf.keras.Sequential([
            user_lookup,
            tf.keras.layers.Embedding(len(unique_users)+1, 32)
        ])
        self.dense = tf.keras.layers.Dense(32)

    def call(self, user_id):
        return self.dense(self.user_embedding(user_id))

class RecommenderModel(tfrs.Model):
    def __init__(self):
        super().__init__()
        self.user_model = UserModel()
        self.product_model = ProductModel()
        candidate_dataset = tf.data.Dataset.from_tensor_slices({
            "product_id": unique_products,
            "category": [product_features[pid]["category"] for pid in unique_products]
        }).batch(128)
        self.task = tfrs.tasks.Retrieval(
            metrics=tfrs.metrics.FactorizedTopK(
                candidates=candidate_dataset.map(
                    lambda x: self.product_model(x["product_id"], x["category"])
                )
            )
        )

    def compute_loss(self, features, training=False):
        user_embeddings = self.user_model(features["user_id"])
        product_embeddings = self.product_model(
            features["product_id"],
            features["category"]
        )
        return self.task(user_embeddings, product_embeddings)

# ===============================
# STEP 6: HUẤN LUYỆN VÀ LƯU MODEL
# ===============================
model = RecommenderModel()
model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=0.001))
model.fit(train_dataset, epochs=10)

# Lưu user & product model
model.user_model.save("user_model")
model.product_model.save("product_model")

def upload_folder_to_s3(local_folder, bucket, s3_folder):
    s3 = boto3.client('s3')
    for root, dirs, files in os.walk(local_folder):
        for file in files:
            local_path = os.path.join(root, file)
            relative_path = os.path.relpath(local_path, local_folder)
            s3_path = os.path.join(s3_folder, relative_path).replace("\\", "/")
            s3.upload_file(local_path, bucket, s3_path)

def upload_file_to_s3(local_file, bucket, s3_key):
    s3 = boto3.client('s3')
    s3.upload_file(local_file, bucket, s3_key)

bucket_name = os.getenv('S3_BUCKET', 'ballandbeer-rcm')
upload_folder_to_s3('user_model', bucket_name, 'models/user_model')
upload_folder_to_s3('product_model', bucket_name, 'models/product_model')
upload_file_to_s3('product_data.json', bucket_name, 'data/product_data.json')
print("Uploaded to S3")
