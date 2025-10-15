#!/bin/bash

# Start all services (backend + frontend) for local development
# 
# PREREQUISITES:
# - Order service requires Kafka & Vault running (see services/order/NOTES.md)
#   Run: cd services/order && docker compose up -d
# - Recommender service requires S3 models (see services/order/NOTES.md)

# Detect OS
OS_TYPE="$(uname -s)"
case "$OS_TYPE" in
    MINGW*|MSYS*|CYGWIN*)
        IS_WINDOWS=true
        ;;
    *)
        IS_WINDOWS=false
        ;;
esac

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

# Backend service directories to start (Node.js services)
node_services=("authen" "booking" "product" "profile" "order")

# Python services
python_services=("recommender")

# Log directory
mkdir -p "$PROJECT_ROOT/services/logs"

# Store PIDs
declare -a PIDS=()

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down services..."
    
    if [ "$IS_WINDOWS" = true ]; then
        # Windows: Use taskkill
        taskkill //F //IM node.exe //T 2>/dev/null || true
    else
        # Unix/Linux/Mac: Use pkill or kill PIDs
        if command -v pkill &> /dev/null; then
            pkill -f 'node.*src/(app|server).js' 2>/dev/null || true
            pkill -f 'next-server' 2>/dev/null || true
        else
            # Fallback: kill stored PIDs
            for pid in "${PIDS[@]}"; do
                kill "$pid" 2>/dev/null || true
            done
        fi
    fi
    
    echo "Services stopped"
    exit 0
}

# Register cleanup function for CTRL+C
trap cleanup SIGINT SIGTERM

# Function to start a Node.js backend service
start_node_service() {
    local service=$1
    local port=""
    
    # Determine port from service name
    case $service in
        authen) port="4000" ;;
        booking) port="4001" ;;
        order) port="4002" ;;
        product) port="4003" ;;
        profile) port="4004" ;;
    esac
    
    printf "  %-12s → port %s ... " "$service" "$port"
    
    cd "$PROJECT_ROOT/services/$service" || exit 1
    
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        npm install > "../logs/${service}-install.log" 2>&1
    fi
    
    # Start the service with env vars if needed
    if [ "$service" = "order" ]; then
        VAULT_ADDR=http://localhost:8200 VAULT_TOKEN=root npm start > "../logs/${service}.log" 2>&1 &
    else
        npm start > "../logs/${service}.log" 2>&1 &
    fi
    
    local pid=$!
    PIDS+=($pid)
    echo "OK (PID $pid)"
    
    cd "$PROJECT_ROOT"
}

# Function to start a Python service
start_python_service() {
    local service=$1
    local port=""
    
    case $service in
        recommender) port="4005" ;;
    esac
    
    printf "  %-12s → port %s ... " "$service" "$port"
    
    cd "$PROJECT_ROOT/services/$service" || exit 1
    
    # Start the service in background with required environment variables
    if [ "$service" = "recommender" ]; then
        VAULT_TOKEN=root S3_BUCKET=bnb-rcm-kltn uvicorn main:app --host 0.0.0.0 --port 4005 > "../logs/${service}.log" 2>&1 &
    fi
    
    local pid=$!
    PIDS+=($pid)
    echo "OK (PID $pid)"
    
    cd "$PROJECT_ROOT"
}

# Start backend services
echo ""
echo "┌─────────────────────────────────────────────────────┐"
echo "│  Starting Backend Services                         │"
echo "└─────────────────────────────────────────────────────┘"
echo ""
echo "  NOTE: Order service requires Kafka & Vault"
echo "        Run: cd services/order && docker compose up -d"
echo ""

# Start Node.js services
for service in "${node_services[@]}"
do
    start_node_service "$service"
    sleep 1
done

# Start Python services
for service in "${python_services[@]}"
do
    start_python_service "$service"
    sleep 1
done

echo ""
echo "  Logs: services/logs/"

# Wait for backend services to initialize
sleep 8

# Start frontend
echo ""
echo "┌─────────────────────────────────────────────────────┐"
echo "│  Starting Frontend                                  │"
echo "└─────────────────────────────────────────────────────┘"
echo ""

cd "$PROJECT_ROOT/frontend"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "  Installing dependencies..."
    npm install
fi

printf "  %-12s → port %s ... " "next.js" "3000"
npm run dev > "$PROJECT_ROOT/services/logs/frontend.log" 2>&1 &
frontend_pid=$!
PIDS+=($frontend_pid)
echo "OK (PID $frontend_pid)"

cd "$PROJECT_ROOT"

# Wait a bit for frontend to start
sleep 3

echo ""
echo "┌─────────────────────────────────────────────────────┐"
echo "│  Application Running                                │"
echo "└─────────────────────────────────────────────────────┘"
echo ""
echo "  Frontend       →  localhost:3000"
echo "  Auth           →  localhost:4000"
echo "  Booking        →  localhost:4001"
echo "  Order          →  localhost:4002"
echo "  Product        →  localhost:4003"
echo "  Profile        →  localhost:4004"
echo "  Recommender    →  localhost:4005"
echo ""
echo "  Logs: services/logs/"
echo "  Press CTRL+C to stop all services"
echo ""

# Check if services are running
echo "┌─────────────────────────────────────────────────────┐"
echo "│  Health Check                                       │"
echo "└─────────────────────────────────────────────────────┘"
echo ""

running=0
stopped=0
for pid in "${PIDS[@]}"; do
    if ps -p "$pid" > /dev/null 2>&1; then
        ((running++))
    else
        ((stopped++))
        echo "  [!] Process $pid stopped (check logs)"
    fi
done

if [ $stopped -eq 0 ]; then
    echo "  All $running services are running"
else
    echo "  $running running, $stopped stopped"
fi
echo ""

# Wait for all background processes
wait