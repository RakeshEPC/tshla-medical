#!/bin/bash

# TSHLA Medical One-Shot Startup Script
# This script starts all services and exits immediately (doesn't wait)
# Safe to use - won't create zombie processes

echo "🚀 TSHLA Medical - One-Shot Startup"
echo ""

cd "$(dirname "$0")"

# Load environment variables
if [ -f .env ]; then
    echo "✅ Loading .env file..."
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "❌ .env file not found!"
    exit 1
fi

# Nuclear cleanup - kill everything
echo "🧹 Killing ALL existing node/vite/npm processes..."
killall -9 node 2>/dev/null || true
pkill -9 -f vite 2>/dev/null || true
pkill -9 -f "npm run dev" 2>/dev/null || true
pkill -9 -f "start-dev.sh" 2>/dev/null || true
sleep 2

# Verify ports are clear
echo "🔍 Checking ports..."
if lsof -ti:3002,3003,5173,5174,5175 2>/dev/null; then
    echo "⚠️  Some ports still in use, force killing..."
    lsof -ti:3002,3003,5173,5174,5175 | xargs kill -9 2>/dev/null || true
    sleep 1
fi

# Clear Vite cache
echo "🗑️  Clearing Vite cache..."
rm -rf node_modules/.vite 2>/dev/null || true

# Create logs directory
mkdir -p logs

echo ""
echo "📋 Starting services with environment:"
echo "   JWT_SECRET: ${JWT_SECRET:0:20}..."
echo "   VITE_PUMP_API_URL: $VITE_PUMP_API_URL"
echo "   VITE_MEDICAL_API_URL: $VITE_MEDICAL_API_URL"
echo ""

# Start Medical Auth API
echo "🏥 Starting Medical Auth API on port 3003..."
JWT_SECRET="$JWT_SECRET" PORT=3003 node server/medical-auth-api.js > logs/medical-auth.log 2>&1 &
sleep 2

# Start Pump Report API
echo "💊 Starting Pump Report API on port 3002..."
JWT_SECRET="$JWT_SECRET" PORT=3002 DB_HOST="$DB_HOST" DB_USER="$DB_USER" DB_PASSWORD="$DB_PASSWORD" DB_DATABASE="$DB_DATABASE" node server/pump-report-api.js > logs/pump-report.log 2>&1 &
sleep 2

# Start Frontend
echo "🎨 Starting Frontend Dev Server..."
npm run dev > logs/vite.log 2>&1 &
sleep 3

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All services started!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Service URLs:"
echo "   🏥 Medical Auth API:  http://localhost:3003"
echo "   💊 Pump Report API:   http://localhost:3002"
echo "   🎨 Frontend:          http://localhost:5173"
echo ""
echo "📝 View logs:"
echo "   tail -f logs/medical-auth.log"
echo "   tail -f logs/pump-report.log"
echo "   tail -f logs/vite.log"
echo ""
echo "🛑 To stop all services:"
echo "   killall node"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✨ Script complete - services running in background"
echo ""
