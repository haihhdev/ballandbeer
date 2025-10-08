#!/bin/bash

# Start all services (backend + frontend) for local development
# Note: order service requires Kafka/Vault (commented out)
# Note: recommender service not needed for local (commented out)

# Check working directory
if [ -d "authen" ]; then
    # Running from services directory
    PROJECT_ROOT=".."
elif [ -d "services/authen" ]; then
    # Running from project root
    PROJECT_ROOT="."
else
    echo "Error: Must run from project root or services directory"
    exit 1
fi

# Backend service directories to start
services=("authen" "booking" "product" "profile")
# Disabled services:
# services+=("order")      # Requires Kafka and Vault
# services+=("recommender") # Not needed for local development

# Log directory
mkdir -p "$PROJECT_ROOT/services/logs"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down services..."
    pkill -f 'node.*src/(app|server).js'
    pkill -f 'next-server'
    exit 0
}

# Register cleanup function for CTRL+C
trap cleanup SIGINT SIGTERM

# Function to start a backend service
start_service() {
    local service=$1
    local port=""
    
    # Determine port from service name
    case $service in
        authen) port="4000" ;;
        booking) port="4001" ;;
        product) port="4003" ;;
        profile) port="4004" ;;
        # order) port="4002" ;;      # Commented out
        # recommender) port="5000" ;; # Commented out
    esac
    
    echo "Starting ${service} on port ${port}..."
    
    cd "$PROJECT_ROOT/services/$service" || exit 1
    
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        npm install > "../logs/${service}-install.log" 2>&1
    fi
    
    # Start the service in background and redirect logs
    npm start > "../logs/${service}.log" 2>&1 &
    
    cd "$PROJECT_ROOT"
}

# Start backend services
echo "Starting backend services..."
for service in "${services[@]}"
do
    start_service "$service"
    sleep 2
done

echo ""
echo "Backend services started on ports: 4000, 4001, 4003, 4004"
echo "Logs: services/logs/"

# Wait for backend services to initialize
sleep 8

# Start frontend
echo ""
echo "Starting frontend..."
cd "$PROJECT_ROOT/frontend"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

npm run dev &
cd "$PROJECT_ROOT"

# Wait a bit for frontend to start
sleep 5

echo ""
echo "Application started"
echo "Frontend: http://localhost:3000"
echo "Backend: 4000 (auth), 4001 (booking), 4003 (product), 4004 (profile)"
echo "Press CTRL+C to stop all services"
echo ""

# Wait for all background processes
wait