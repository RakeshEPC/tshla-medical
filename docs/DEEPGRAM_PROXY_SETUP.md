# Deepgram Proxy Setup Guide

## Overview
The Deepgram WebSocket proxy is required for browser-based speech-to-text because browsers cannot send Authorization headers on WebSocket connections.

## Architecture
```
Browser (no auth) → Proxy (adds auth) → Deepgram API
Browser ← Proxy ← Deepgram API
```

## Local Development Setup

### 1. Start the Deepgram Proxy Server

The proxy server must be running before using dictation features.

```bash
# From project root
cd /Users/rakeshpatel/Desktop/tshla-medical

# Start proxy on port 8080
PORT=8080 node server/deepgram-proxy.js &

# Or run in foreground to see logs
PORT=8080 node server/deepgram-proxy.js
```

### 2. Configure Environment Variables

Edit your `.env` file to point to the local proxy:

```bash
# Local Development Configuration
VITE_DEEPGRAM_PROXY_URL=ws://localhost:8080

# API Keys (required in .env)
VITE_DEEPGRAM_API_KEY=your_api_key_here
DEEPGRAM_API_KEY=your_api_key_here
```

### 3. Verify Proxy is Running

Check the health endpoint:

```bash
curl http://localhost:8080/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "deepgram-proxy",
  "timestamp": "2025-12-07T18:07:05.320Z"
}
```

### 4. Restart Dev Server

After changing `.env`, restart your Vite dev server:

```bash
# Stop current server (Ctrl+C)
# Then restart
npm run dev
```

## Production Configuration

For production deployments, use the Azure-hosted proxy:

```bash
# In .env.production
VITE_DEEPGRAM_PROXY_URL=wss://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/ws/deepgram
```

The production proxy is already deployed and doesn't require manual startup.

## Troubleshooting

### Error: "WebSocket onerror fired"

**Symptom:** Console shows WebSocket opens then immediately errors and closes.

**Cause:** Proxy server is not running on the configured port.

**Solution:**
1. Check if proxy is running: `lsof -ti:8080`
2. If not running, start it: `PORT=8080 node server/deepgram-proxy.js &`
3. Verify health: `curl http://localhost:8080/health`
4. Restart Vite dev server

### Error: "No Audio Captured"

**Symptom:** Recording completes but transcript is empty.

**Causes:**
1. Microphone permission denied
2. Wrong sample rate configuration
3. Proxy not forwarding audio data

**Solution:**
1. Check browser console for microphone permissions
2. Grant microphone access when prompted
3. Check proxy logs: `cat /tmp/deepgram-proxy.log`

### Port Already in Use

**Symptom:** `Error: listen EADDRINUSE: address already in use :::8080`

**Solution:**
```bash
# Find process using port 8080
lsof -ti:8080

# Kill the process
kill $(lsof -ti:8080)

# Or use a different port
PORT=8081 node server/deepgram-proxy.js &
# Remember to update .env: VITE_DEEPGRAM_PROXY_URL=ws://localhost:8081
```

## Development Workflow

For a smooth development experience, create a startup script:

```bash
#!/bin/bash
# scripts/start-dev.sh

# Start Deepgram proxy in background
echo "Starting Deepgram proxy on port 8080..."
PORT=8080 node server/deepgram-proxy.js > /tmp/deepgram-proxy.log 2>&1 &
PROXY_PID=$!

# Wait for proxy to be ready
sleep 2

# Start Vite dev server
echo "Starting Vite dev server..."
npm run dev

# Cleanup on exit
trap "kill $PROXY_PID" EXIT
```

Make it executable:
```bash
chmod +x scripts/start-dev.sh
./scripts/start-dev.sh
```

## Files Reference

- **Proxy Server:** `server/deepgram-proxy.js`
- **Frontend Service:** `src/services/deepgramSDK.service.ts`
- **Configuration:** `.env` (local), `.env.production` (deployed)

## Recent Fixes

### 2025-12-07: Fixed WebSocket Connection Error
- **Issue:** WebSocket was trying to connect to `ws://localhost:3001` but no server was running
- **Fix:** Started proxy on port 8080 and updated `.env` to `ws://localhost:8080`
- **Impact:** Dictation feature now works correctly in local development

## Security Notes

1. **Never commit `.env` files** - They contain sensitive API keys
2. **API keys are masked in logs** - Only first 8 and last 4 characters shown
3. **Proxy validates all connections** - Rejects connections without proper configuration
4. **CORS enabled** - Allows browser connections from any origin in development
5. **Production proxy** - Uses HTTPS (wss://) and is deployed to Azure Container Apps

## Support

For issues or questions:
1. Check proxy logs: `cat /tmp/deepgram-proxy.log`
2. Check browser console for WebSocket errors
3. Verify `.env` configuration
4. Ensure Deepgram API key is valid
5. Contact: rakesh@tshla.ai
