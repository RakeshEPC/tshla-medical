#!/bin/bash
# TSHLA Medical - Development Server with Deepgram Proxy
# Starts both the Deepgram WebSocket proxy and Vite dev server

set -e

echo "🚀 Starting TSHLA Medical Development Environment"
echo ""

# Change to project root
cd "$(dirname "$0")/.."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if proxy is already running
if lsof -ti:8080 > /dev/null 2>&1; then
  echo -e "${RED}⚠️  Port 8080 is already in use${NC}"
  echo "   Killing existing process..."
  kill $(lsof -ti:8080) 2>/dev/null || true
  sleep 1
fi

# Start Deepgram proxy in background
echo -e "${BLUE}🔌 Starting Deepgram WebSocket proxy on port 8080...${NC}"
PORT=8080 node server/deepgram-proxy.js > /tmp/deepgram-proxy.log 2>&1 &
PROXY_PID=$!

# Wait for proxy to be ready
sleep 2

# Check if proxy started successfully
if ! lsof -ti:8080 > /dev/null 2>&1; then
  echo -e "${RED}❌ Failed to start Deepgram proxy${NC}"
  echo "   Check logs: cat /tmp/deepgram-proxy.log"
  exit 1
fi

echo -e "${GREEN}✅ Deepgram proxy running (PID: $PROXY_PID)${NC}"
echo "   Health check: http://localhost:8080/health"
echo "   WebSocket: ws://localhost:8080"
echo "   Logs: tail -f /tmp/deepgram-proxy.log"
echo ""

# Verify proxy health
if curl -sf http://localhost:8080/health > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Proxy health check passed${NC}"
else
  echo -e "${RED}⚠️  Proxy health check failed (but will try to continue)${NC}"
fi

echo ""
echo -e "${BLUE}🎨 Starting Vite dev server...${NC}"
echo ""

# Cleanup function
cleanup() {
  echo ""
  echo -e "${BLUE}🛑 Shutting down...${NC}"
  if [ ! -z "$PROXY_PID" ]; then
    echo "   Stopping Deepgram proxy (PID: $PROXY_PID)"
    kill $PROXY_PID 2>/dev/null || true
  fi
  echo -e "${GREEN}✅ Cleanup complete${NC}"
  exit 0
}

# Set up cleanup trap
trap cleanup EXIT INT TERM

# Start Vite dev server (this will block)
npm run dev

# Note: cleanup() will be called automatically when this script exits
