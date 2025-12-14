#!/bin/bash

set -e

DOCKER_USERNAME="hao1706"

echo "========================================="
echo "Building and Pushing Docker Images"
echo "========================================="
echo ""

# Function to build and push image
build_and_push() {
    local SERVICE_NAME=$1
    local DOCKERFILE_PATH=$2
    local IMAGE_NAME=$3
    
    echo "-----------------------------------------"
    echo "Building $SERVICE_NAME..."
    echo "-----------------------------------------"
    
    cd "$DOCKERFILE_PATH"
    docker build -t "${DOCKER_USERNAME}/${IMAGE_NAME}:latest" .
    
    echo ""
    echo "Pushing $SERVICE_NAME to Docker Hub..."
    docker push "${DOCKER_USERNAME}/${IMAGE_NAME}:latest"
    
    echo ""
    echo "Cleaning cache after $SERVICE_NAME..."
    docker image prune -f
    docker builder prune -f
    
    echo ""
    echo "$SERVICE_NAME completed successfully!"
    echo ""
}

# Build and push all services
build_and_push "Authen Service" "/workspaces/ballandbeer/services/authen" "authen"
build_and_push "Booking Service" "/workspaces/ballandbeer/services/booking" "booking"
build_and_push "Order Service" "/workspaces/ballandbeer/services/order" "order"
build_and_push "Product Service" "/workspaces/ballandbeer/services/product" "product"
build_and_push "Profile Service" "/workspaces/ballandbeer/services/profile" "profile"
build_and_push "Recommender Service" "/workspaces/ballandbeer/services/recommender" "recommender"
build_and_push "Collector Service" "/workspaces/ballandbeer/services/collector" "collector"
build_and_push "Frontend" "/workspaces/ballandbeer/frontend" "frontend"

echo "========================================="
echo "All images built, pushed, and cache cleaned!"
echo "========================================="
echo ""
echo "Images pushed:"
echo "  - ${DOCKER_USERNAME}/authen:latest"
echo "  - ${DOCKER_USERNAME}/booking:latest"
echo "  - ${DOCKER_USERNAME}/order:latest"
echo "  - ${DOCKER_USERNAME}/product:latest"
echo "  - ${DOCKER_USERNAME}/profile:latest"
echo "  - ${DOCKER_USERNAME}/recommender:latest"
echo "  - ${DOCKER_USERNAME}/collector:latest"
echo "  - ${DOCKER_USERNAME}/frontend:latest"
echo ""
