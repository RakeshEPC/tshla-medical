#!/bin/bash

# TSHLA Medical Development Environment Startup Script
# Starts all services with unified environment configuration

set -e  # Exit on error

echo "🚀 Starting TSHLA Medical Development Environment..."
echo ""

# Change to project directory
cd "$(dirname "$0")"

# Load environment variables from .env
if [ -f .env ]; then
    echo "✅ Loading environment variables from .env"
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "⚠️  Warning: .env file not found, using defaults"
fi

# Ensure JWT_SECRET is set
if [ -z "$JWT_SECRET" ]; then
    echo "❌ Error: JWT_SECRET not found in .env file"
    echo "   Please add: JWT_SECRET=tshla-unified-jwt-secret-2025-enhanced-secure-key"
    exit 1
fi

echo "🔐 JWT_SECRET loaded: ${JWT_SECRET:0:20}..."
echo ""

# Function to kill process on port
kill_port() {
    local port=$1
    local pid=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$pid" ]; then
        echo "🔪 Killing process on port $port (PID: $pid)"
        kill -9 $pid 2>/dev/null || true
        sleep 0.5
    fi
}

# Clean up existing processes
echo "🧹 Cleaning up existing processes..."
killall -9 node 2>/dev/null || true
pkill -9 -f vite 2>/dev/null || true
pkill -9 -f "npm run dev" 2>/dev/null || true
sleep 1
kill_port 3000  # unified-api
kill_port 3001  # alternate unified-api
kill_port 3002  # pump-report-api
kill_port 3003  # medical-auth-api
kill_port 5173  # vite dev server
kill_port 5174  # vite dev server (alternate)
kill_port 5175  # vite dev server (alternate)

# Clear Vite cache to ensure fresh environment variables
echo "🗑️  Clearing Vite cache..."
rm -rf node_modules/.vite 2>/dev/null || true

# Display environment variables being used
echo ""
echo "📋 Environment Configuration:"
echo "   VITE_API_URL: ${VITE_API_URL:-http://localhost:3000}"
echo "   VITE_PUMP_API_URL: ${VITE_PUMP_API_URL}"
echo "   VITE_MEDICAL_API_URL: ${VITE_MEDICAL_API_URL}"
echo ""

# Start Unified API Server (port 3000) - Includes all routes
echo "🚀 Starting Unified API Server on port 3000..."
PORT=3000 node server/unified-api.js > logs/unified-api.log 2>&1 &
UNIFIED_API_PID=$!
sleep 3

# Check if unified-api started successfully
if kill -0 $UNIFIED_API_PID 2>/dev/null; then
    echo "✅ Unified API Server started (PID: $UNIFIED_API_PID)"
    echo "   Includes: Pump API, Auth API, Schedule API, Admin API, Echo API, WebSocket Proxy"
else
    echo "❌ Unified API Server failed to start"
    cat logs/unified-api.log
    exit 1
fi

# Start Frontend Dev Server
echo "🎨 Starting Frontend Dev Server..."
npm run dev > logs/vite-dev.log 2>&1 &
VITE_PID=$!
sleep 3

# Check if vite started successfully
if kill -0 $VITE_PID 2>/dev/null; then
    echo "✅ Frontend Dev Server started (PID: $VITE_PID)"
else
    echo "❌ Frontend Dev Server failed to start"
    cat logs/vite-dev.log
    exit 1
fi

# Detect which port Vite is using
VITE_PORT=$(lsof -ti:5173 > /dev/null 2>&1 && echo "5173" || lsof -ti:5174 > /dev/null 2>&1 && echo "5174" || echo "5175")

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 All services started successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Service URLs:"
echo "   🚀 Unified API:         http://localhost:3000"
echo "      ├── Pump API:        http://localhost:3000/api/pump-*"
echo "      ├── Auth API:        http://localhost:3000/api/auth/*"
echo "      ├── Echo API:        http://localhost:3000/api/echo/*"
echo "      └── WebSocket:       ws://localhost:3000/ws/deepgram"
echo "   🎨 Frontend:            http://localhost:$VITE_PORT"
echo ""
echo "📊 Process IDs:"
echo "   Unified API:       $UNIFIED_API_PID"
echo "   Frontend:          $VITE_PID"
echo ""
echo "📝 Logs:"
echo "   tail -f logs/unified-api.log"
echo "   tail -f logs/vite-dev.log"
echo ""
echo "🛑 To stop all services:"
echo "   ./stop-dev.sh"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Save PIDs for later cleanup
mkdir -p .pids
echo "$UNIFIED_API_PID" > .pids/unified-api.pid
echo "$VITE_PID" > .pids/vite-dev.pid

# Keep script running and show logs
echo "📡 Monitoring services... (Ctrl+C to stop)"
echo ""

# Trap Ctrl+C to clean up processes
trap 'echo ""; echo "🛑 Stopping all services..."; kill $UNIFIED_API_PID $VITE_PID 2>/dev/null; echo "✅ All services stopped"; exit 0' INT

# Wait for all background processes
wait
