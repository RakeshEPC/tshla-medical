# Deepgram "No Audio Captured" Error - Fix Guide

## Problem Summary
Users were seeing "No Audio Captured" error when trying to use the voice recording features in the TSHLA Medical app.

## Root Causes Identified

### 1. **WebSocket Connection Race Condition** (Primary Issue)
- **Problem**: Audio processing started before the WebSocket connection was fully established
- **Impact**: Audio chunks were being generated but dropped because WebSocket wasn't in OPEN state
- **Fix**: Added explicit wait for WebSocket to be OPEN before starting audio processing

### 2. **Wrong Proxy URL in Development**
- **Problem**: `.env` was pointing to production unified API (`wss://tshla-unified-api...`) which may not be accessible locally
- **Impact**: WebSocket connection attempts would fail or timeout
- **Fix**: Changed `.env` to use local proxy (`ws://localhost:8080`)

### 3. **Insufficient Diagnostic Logging**
- **Problem**: Hard to diagnose where the audio capture pipeline was failing
- **Impact**: Error message was generic and didn't identify the actual failure point
- **Fix**: Added comprehensive diagnostic logging at each stage

## Changes Made

### 1. `src/services/deepgramSDK.service.ts`
**Race Condition Fix (lines 484-505)**:
```typescript
// CRITICAL: Wait for WebSocket to be fully OPEN before processing audio
// This prevents the race condition where audio starts processing before WebSocket is ready
console.log('⏳ Waiting for WebSocket to be fully OPEN before starting audio processing...');

// Poll WebSocket state until it's OPEN (max 5 seconds)
const wsOpenTimeout = 5000;
const wsOpenStart = Date.now();
await new Promise<void>((resolve, reject) => {
  const checkInterval = setInterval(() => {
    const readyState = this.connection.getReadyState();
    console.log(`   WebSocket state: ${readyState} (${['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][readyState]})`);

    if (readyState === 1) { // OPEN
      clearInterval(checkInterval);
      console.log('✅ WebSocket is OPEN! Starting audio processing...');
      resolve();
    } else if (Date.now() - wsOpenStart > wsOpenTimeout) {
      clearInterval(checkInterval);
      reject(new Error(`WebSocket did not open within ${wsOpenTimeout}ms (state: ${readyState})`));
    }
  }, 100); // Check every 100ms
});
```

**Enhanced Diagnostic Logging**:
- Added detailed state logging when WebSocket opens (lines 412-417)
- Added periodic warnings when audio is processing but not ready to send (lines 489-503)
- Added detailed error logging when audio cannot be sent (lines 557-563)

### 2. `.env`
**Proxy URL Update**:
```bash
# OLD (production URL - not accessible locally):
VITE_DEEPGRAM_PROXY_URL=wss://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/ws/deepgram

# NEW (local development):
VITE_DEEPGRAM_PROXY_URL=ws://localhost:8080
```

### 3. `src/pages/QuickNoteModern.tsx`
**Added Test Microphone Feature**:
- New `testMicrophone()` function (lines 170-275)
- Visual audio level meter that shows real-time microphone input
- Clear pass/fail feedback with specific error messages
- Device name display so users know which microphone is being used

**UI Additions**:
- "Test Microphone" button in recording controls
- Real-time audio level meter (visual bar)
- Test results display with success/failure indication

### 4. `start-deepgram-proxy.sh`
**New Startup Script**:
- Simple script to start the local Deepgram WebSocket proxy
- Automatically loads environment variables from `.env`
- Checks for required dependencies
- Clear console output showing proxy status

## How to Use the Fixes

### Step 1: Start the Deepgram Proxy Server
```bash
# From the project root directory:
./start-deepgram-proxy.sh
```

You should see:
```
🚀 Starting Deepgram WebSocket Proxy Server...
✅ Environment variables loaded
🎙️ Starting proxy server on port 8080...
   WebSocket URL: ws://localhost:8080
   Health check: http://localhost:8080/health
```

### Step 2: Start Your Development Server
```bash
# In a separate terminal:
npm run dev
```

### Step 3: Test the Microphone
1. Open the app and navigate to Quick Note
2. Click **"Test Microphone"** button
3. Speak into your microphone for 3 seconds
4. You should see:
   - Real-time audio level meter
   - Success message: "Microphone is working perfectly!"
   - Your microphone device name

### Step 4: Start Recording
1. Select a recording mode (Dictation or Conversation)
2. Click the **Start Recording** button (green play icon)
3. Speak clearly
4. You should see:
   - Live transcript appearing in real-time
   - Word count increasing
   - Recording duration timer

## Debugging Tips

### Check Browser Console Logs
The enhanced diagnostic logging will show:
```
🔍 DEEPGRAM PROXY DEBUG:
  Environment variable VITE_DEEPGRAM_PROXY_URL: ws://localhost:8080
  Resolved proxy URL: ws://localhost:8080
  Using proxy: true

⏳ Waiting for WebSocket to be fully OPEN before starting audio processing...
   WebSocket state: 0 (CONNECTING)
   WebSocket state: 1 (OPEN)
✅ WebSocket is OPEN! Starting audio processing...

🎤 ✅ Sent audio chunk #1 (4096 samples, level=45%, wsState=1)
📝 Transcript: "This is a test" (final: true)
```

### Common Issues and Solutions

#### Issue: "WebSocket not OPEN" errors
**Solution**: Make sure the proxy server is running on `localhost:8080`
```bash
# Check if proxy is running:
curl http://localhost:8080/health

# Should return:
{"status":"healthy","service":"deepgram-proxy","timestamp":"..."}
```

#### Issue: Test Microphone shows "No audio detected"
**Solution**:
1. Check system microphone permissions
2. Ensure microphone is not muted
3. Try a different microphone
4. Check if another app is using the microphone

#### Issue: "Microphone is being used by another application"
**Solution**:
- Close other apps that might be using the mic (Zoom, Teams, etc.)
- Restart your browser
- Check System Preferences → Security & Privacy → Microphone

#### Issue: Connection timeouts
**Solution**:
- Verify `.env` has correct proxy URL: `ws://localhost:8080`
- Restart the proxy server
- Check firewall settings

## Testing Checklist
- [ ] Proxy server starts without errors
- [ ] Proxy health check responds at `http://localhost:8080/health`
- [ ] Test Microphone button works
- [ ] Audio level meter shows movement when speaking
- [ ] Test passes with "Microphone is working perfectly!"
- [ ] Recording starts without errors
- [ ] Live transcript appears in real-time
- [ ] Final transcript is accurate
- [ ] No "No Audio Captured" error appears

## Production Deployment Notes

### For Production Builds:
1. Update `.env.production` to use production proxy:
   ```bash
   VITE_DEEPGRAM_PROXY_URL=wss://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/ws/deepgram
   ```

2. Ensure the unified API container has the Deepgram proxy endpoint running at `/ws/deepgram`

3. Verify SSL certificate is valid for WSS connections

### Environment-Specific Configuration:
- **Local Development**: `ws://localhost:8080` (requires local proxy server)
- **Staging**: `wss://[staging-url]/ws/deepgram`
- **Production**: `wss://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/ws/deepgram`

## Technical Details

### Why a Proxy is Required
Browsers have a security limitation: they cannot send custom HTTP headers (like `Authorization`) on WebSocket connections. Deepgram's API requires an Authorization header with the API key. The proxy server:
1. Accepts WebSocket connections from the browser (no auth required)
2. Creates a new WebSocket connection to Deepgram (with proper Authorization header)
3. Forwards audio data: Browser → Proxy → Deepgram
4. Forwards transcripts: Deepgram → Proxy → Browser

### Audio Pipeline Flow
```
User Microphone
    ↓
navigator.mediaDevices.getUserMedia()
    ↓
AudioContext (captures raw PCM audio)
    ↓
ScriptProcessorNode (converts Float32 to Int16)
    ↓
WebSocket Connection (sends binary audio chunks)
    ↓
Deepgram Proxy Server (adds Authorization header)
    ↓
Deepgram API (transcribes audio)
    ↓
WebSocket Connection (receives JSON transcript)
    ↓
React Component (displays transcript)
```

### WebSocket States
- **0 (CONNECTING)**: Connection is being established
- **1 (OPEN)**: Connection is open and ready - **ONLY send audio in this state**
- **2 (CLOSING)**: Connection is closing
- **3 (CLOSED)**: Connection is closed

## Success Metrics
After implementing these fixes, you should see:
- ✅ 0% "No Audio Captured" errors
- ✅ Real-time audio level feedback
- ✅ Clear error messages when issues occur
- ✅ Faster time-to-first-transcript
- ✅ More reliable WebSocket connections

## Support
If you still encounter issues after following this guide:
1. Check browser console for detailed diagnostic logs
2. Verify proxy server logs for connection issues
3. Test microphone with `testMicrophone()` function first
4. Ensure all environment variables are correctly set
