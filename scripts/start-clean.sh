#!/bin/bash

# Clean Startup Script for Pre-Visit System
# Kills old processes and starts fresh instances

echo "🧹 Cleaning up old processes..."
echo "================================"

# Kill old previsit API server processes
echo "   Stopping old API servers..."
pkill -f "previsit-api-server" 2>/dev/null
sleep 2

# Kill processes on port 3100
echo "   Clearing port 3100..."
lsof -ti:3100 | xargs kill -9 2>/dev/null
sleep 1

# Kill old dev servers if needed (optional - comment out if you want to keep frontend running)
# echo "   Stopping old dev servers..."
# pkill -f "vite" 2>/dev/null

echo "✅ Cleanup complete!"
echo ""

# Start fresh API server
echo "🚀 Starting Pre-Visit API Server..."
echo "===================================="

cd "$(dirname "$0")/.."

# Load environment variables
export $(grep -v '^#' .env | xargs)

# Check required environment variables
echo "📋 Checking configuration..."

if [ -z "$TWILIO_ACCOUNT_SID" ]; then
  echo "❌ TWILIO_ACCOUNT_SID not set in .env"
  exit 1
fi

if [ -z "$VITE_ELEVENLABS_API_KEY" ]; then
  echo "❌ VITE_ELEVENLABS_API_KEY not set in .env"
  exit 1
fi

if [ -z "$VITE_SUPABASE_URL" ]; then
  echo "❌ VITE_SUPABASE_URL not set in .env"
  exit 1
fi

echo "✅ Twilio: ${TWILIO_ACCOUNT_SID:0:10}..."
echo "✅ ElevenLabs: ${VITE_ELEVENLABS_API_KEY:0:10}..."
echo "✅ Supabase: ${VITE_SUPABASE_URL}"

if [ "$ELEVENLABS_AGENT_ID" = "placeholder_create_agent" ]; then
  echo "⚠️  ElevenLabs Agent ID is placeholder - you won't be able to make calls yet"
  echo "   Follow docs/ELEVENLABS_AGENT_SETUP.md to create your agent"
else
  echo "✅ ElevenLabs Agent: ${ELEVENLABS_AGENT_ID}"
fi

echo ""
echo "🚀 Starting API server on port 3100..."
npm run previsit:api:dev &

# Wait for server to start
sleep 5

# Check if server is running
if curl -s http://localhost:3100/health > /dev/null; then
  echo ""
  echo "✅ API Server Started Successfully!"
  echo "===================================="
  echo ""
  echo "🎯 Ready to Test!"
  echo ""
  echo "URLs:"
  echo "   - Health Check: http://localhost:3100/health"
  echo "   - Demo UI: http://localhost:5173/previsit-demo"
  echo "   - Analytics: http://localhost:5173/previsit-analytics"
  echo ""
  echo "Next Steps:"
  echo "   1. Create ElevenLabs Agent (if not done): docs/ELEVENLABS_AGENT_SETUP.md"
  echo "   2. Make test call: npx tsx scripts/test-call.ts --phone=\"+15555555555\""
  echo ""
  echo "Logs:"
  echo "   - View API logs in this terminal"
  echo "   - Or check: pm2 logs previsit-api (if using PM2)"
  echo ""
else
  echo ""
  echo "❌ Failed to start API server"
  echo ""
  echo "Troubleshooting:"
  echo "   1. Check if port 3100 is in use: lsof -i:3100"
  echo "   2. Check .env file has all required variables"
  echo "   3. Check logs above for errors"
  echo "   4. Try manual start: npm run previsit:api:dev"
  exit 1
fi
