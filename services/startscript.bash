#!/bin/bash

# Array of service directories
services=("order" "authen" "profile" "product" "booking")

# Function to start a service
start_service() {
    local service=$1
    echo "Starting $service service..."
    cd "$service" && npm install && npm start &
}

# Start all services
for service in "${services[@]}"
do
    start_service "$service"
done

# Wait for all background processes
wait

echo "All services have been started!"