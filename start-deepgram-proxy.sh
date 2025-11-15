#!/bin/bash

# ============================================
# Start Deepgram WebSocket Proxy Server
# ============================================
# This proxy server is required for browser-based Deepgram audio capture
# Browsers cannot send Authorization headers on WebSocket connections
# so we use this proxy to add the required Deepgram API key
# ============================================

echo "🚀 Starting Deepgram WebSocket Proxy Server..."
echo ""

# Check if server directory exists
if [ ! -d "server" ]; then
  echo "❌ Error: server directory not found"
  echo "   Make sure you run this script from the project root"
  exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
  echo "❌ Error: .env file not found"
  echo "   Make sure you have a .env file with DEEPGRAM_API_KEY or VITE_DEEPGRAM_API_KEY"
  exit 1
fi

# Load environment variables from .env
export $(cat .env | grep -E "^(DEEPGRAM_API_KEY|VITE_DEEPGRAM_API_KEY)" | xargs)

# Verify API key is set
if [ -z "$DEEPGRAM_API_KEY" ] && [ -z "$VITE_DEEPGRAM_API_KEY" ]; then
  echo "❌ Error: Deepgram API key not found in .env file"
  echo "   Add DEEPGRAM_API_KEY or VITE_DEEPGRAM_API_KEY to your .env file"
  exit 1
fi

echo "✅ Environment variables loaded"
echo ""

# Check if dependencies are installed
if [ ! -d "server/node_modules" ]; then
  echo "📦 Installing server dependencies..."
  cd server
  npm install
  cd ..
  echo ""
fi

# Start the proxy server
echo "🎙️ Starting proxy server on port 8080..."
echo "   WebSocket URL: ws://localhost:8080"
echo "   Health check: http://localhost:8080/health"
echo ""
echo "📝 Press Ctrl+C to stop the server"
echo ""

cd server
node deepgram-proxy.js
