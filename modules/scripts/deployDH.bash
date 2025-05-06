#!/bin/bash

# Docker Hub username và repo
USERNAME="hao1706"
REPO="ballandbeer"

# Danh sách service và đường dẫn (từ ./modules/scripts)
declare -A SERVICES=(
  [frontend]="../../frontend"
  [authen]="../../services/authen"
  [booking]="../../services/booking"
  [order]="../../services/order"
  [product]="../../services/product"
  [profile]="../../services/profile"
)

# Login Docker Hub nếu chưa login
echo "🔐 Đăng nhập Docker Hub nếu cần..."
docker login || { echo "❌ Login thất bại"; exit 1; }

# Build & Push từng service
for SERVICE in "${!SERVICES[@]}"; do
  DIR=${SERVICES[$SERVICE]}
  IMAGE="$USERNAME/$REPO:$SERVICE"

  echo "🔨 Đang build image cho $SERVICE từ $DIR..."
  docker build --no-cache -t $IMAGE "$DIR" || { echo "❌ Build thất bại: $SERVICE"; exit 1; }

  echo "📤 Đang push $IMAGE lên Docker Hub..."
  docker push $IMAGE || { echo "❌ Push thất bại: $SERVICE"; exit 1; }

  echo "✅ $SERVICE đã được push thành công!"
  echo "-----------------------------------"
done

echo "🎉 Tất cả services đã được build & push hoàn tất!"
