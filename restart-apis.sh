#!/bin/bash

# Quick API restart script for development
# Restarts medical-auth-api and pump-report-api without touching frontend

set -e

echo "🔄 Restarting APIs..."
echo ""

cd "$(dirname "$0")"

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Function to kill process on port
kill_port() {
    local port=$1
    local pid=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$pid" ]; then
        echo "🔪 Killing process on port $port"
        kill -9 $pid 2>/dev/null || true
        sleep 0.5
    fi
}

# Stop APIs
kill_port 3002
kill_port 3003

# Start Medical Auth API
echo "🏥 Starting Medical Auth API..."
PORT=3003 node server/medical-auth-api.js > logs/medical-auth-api.log 2>&1 &
sleep 2

# Start Pump Report API
echo "💊 Starting Pump Report API..."
PORT=3002 node server/pump-report-api.js > logs/pump-report-api.log 2>&1 &
sleep 2

echo ""
echo "✅ APIs restarted successfully!"
echo "   Medical Auth API: http://localhost:3003"
echo "   Pump Report API:  http://localhost:3002"
echo ""
