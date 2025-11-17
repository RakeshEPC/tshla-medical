#!/bin/bash

# Stop all development services

echo "🛑 Stopping all development services..."

# Function to kill process on port
kill_port() {
    local port=$1
    local pid=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$pid" ]; then
        echo "  🔪 Stopping service on port $port"
        kill -9 $pid 2>/dev/null || true
    fi
}

kill_port 3000
kill_port 3001
kill_port 3002
kill_port 3003
kill_port 5173
kill_port 5174
kill_port 5175

# Clean up PID files
rm -f .pids/*.pid 2>/dev/null

echo "✅ All services stopped"
