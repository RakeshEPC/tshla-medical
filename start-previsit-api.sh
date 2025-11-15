#!/bin/bash

# Pre-Visit API Server Startup Script
# Loads environment variables and starts the API server

cd "$(dirname "$0")"

# Load environment variables
export $(grep -v '^#' .env | xargs)

# Start the API server
echo "🚀 Starting Pre-Visit API Server..."
echo "   Port: 3100"
echo "   Twilio: ${TWILIO_ACCOUNT_SID:0:10}..."
echo "   ElevenLabs: ${VITE_ELEVENLABS_API_KEY:0:10}..."
echo ""

npm run previsit:api:dev
