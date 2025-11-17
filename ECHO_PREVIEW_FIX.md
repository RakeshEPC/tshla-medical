# Echo Audio Preview - "Failed to Generate Preview" Fix

**Issue Fixed:** November 17, 2025

## Problem
After completing a dictation, clicking "Generate Preview" to create a patient audio summary failed with the error:
```
❌ Failed to generate preview
```

## Root Cause
The **Unified API Server** (which contains the `/api/echo/generate-preview` endpoint) was not being started by the development startup script. The `start-dev.sh` script was only starting:
- Medical Auth API (port 3003)
- Pump Report API (port 3002)
- Frontend (port 5173)

But NOT the Unified API (port 3000) which contains:
- Echo Audio Summary routes (`/api/echo/*`)
- WebSocket proxy for Deepgram
- Consolidated versions of all APIs

## Solution Applied

### 1. Updated `start-dev.sh`
Changed the startup script to launch the **Unified API Server** instead of individual microservices:

**Before:**
```bash
# Started 2 separate APIs
PORT=3003 node server/medical-auth-api.js
PORT=3002 node server/pump-report-api.js
```

**After:**
```bash
# Now starts unified API with all routes
PORT=3000 node server/unified-api.js
```

### 2. Updated `stop-dev.sh`
Added port 3000 to the cleanup script to ensure the unified API is properly stopped.

### 3. Created Required Directories
```bash
mkdir -p logs .pids
```

## How to Use

### Start Development Environment
```bash
./start-dev.sh
```

This now starts:
- ✅ **Unified API** on port 3000 (includes Echo, Pump, Auth, Schedule, Admin, WebSocket)
- ✅ **Frontend** on port 5173

### Stop Development Environment
```bash
./stop-dev.sh
```

### Check API Health
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "tshla-unified-api",
  "timestamp": "2025-11-17T03:10:34.755Z",
  "services": {
    "pump": "ok",
    "auth": "ok",
    "schedule": "ok",
    "admin": "ok",
    "websocket": "ok"
  }
}
```

## Testing the Echo Preview

### 1. Test via API
```bash
curl -X POST http://localhost:3000/api/echo/generate-preview \
  -H "Content-Type: application/json" \
  -d '{
    "soapNote": "Patient came in for diabetes follow-up. A1C improved from 8.5 to 7.2. Continue metformin 1000mg twice daily."
  }'
```

Expected response:
```json
{
  "success": true,
  "script": "This is a beta project from your doctor's office...",
  "wordCount": 125,
  "estimatedSeconds": 50
}
```

### 2. Test via UI
1. Start the dev environment: `./start-dev.sh`
2. Login at http://localhost:5173
3. Go to Dictation page
4. Complete a dictation
5. Click "Send Patient Summary"
6. Click "Generate Preview"
7. ✅ Should now work without errors!

## Available Echo Endpoints

All endpoints on the Unified API (port 3000):

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/echo/generate-preview` | POST | Generate AI script preview (no call) |
| `/api/echo/send-audio-summary` | POST | Generate + call patient with audio |
| `/api/echo/send-sms-summary` | POST | Generate + send SMS to patient |
| `/api/echo/call-status/:callSid` | GET | Check Twilio call status |
| `/api/echo/handle-call-input` | POST | Handle DTMF input (replay/transfer) |

## Environment Variables Required

Make sure these are in your `.env` file:

```bash
# API URL (must point to port 3000 now)
VITE_API_URL=http://localhost:3000

# OpenAI (for AI summary generation)
VITE_OPENAI_API_KEY=sk-proj-...
VITE_OPENAI_MODEL_STAGE4=gpt-4o-mini

# ElevenLabs (for text-to-speech)
VITE_ELEVENLABS_API_KEY=sk_...
VITE_ELEVENLABS_DEFAULT_VOICE_ID=cgSgspJ2msm6clMCkdW9

# Twilio (for phone calls)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
```

## Troubleshooting

### "Failed to generate preview" still appears

1. **Check API is running:**
   ```bash
   lsof -i :3000
   ```
   Should show node process

2. **Check API health:**
   ```bash
   curl http://localhost:3000/health
   ```

3. **Check logs:**
   ```bash
   tail -f logs/unified-api.log
   ```

4. **Verify VITE_API_URL:**
   In browser console:
   ```javascript
   console.log(import.meta.env.VITE_API_URL)
   ```
   Should be: `http://localhost:3000`

### OpenAI API errors

- Verify `VITE_OPENAI_API_KEY` is set and valid
- Check OpenAI API quota/billing

### Twilio errors

- Verify `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- Check Twilio account is active

## What Changed

### Files Modified
1. ✅ `start-dev.sh` - Now starts unified API
2. ✅ `stop-dev.sh` - Stops port 3000
3. ✅ Created `logs/` directory
4. ✅ Created `.pids/` directory

### Files NOT Changed
- `server/unified-api.js` - Already had echo routes
- `server/routes/echo-audio-summary.js` - Already working
- `src/components/echo/AudioSummaryModal.tsx` - Already working
- `.env` - No changes needed (just ensure VITE_API_URL=http://localhost:3000)

## Summary

✅ **FIXED**: Echo audio preview now works
✅ **Root Cause**: Unified API server wasn't running
✅ **Solution**: Updated startup scripts to use unified API
✅ **Tested**: API health check and preview generation both working

You can now:
- Generate AI patient summaries from dictation
- Preview the script before sending
- Send audio calls via Twilio
- Send SMS summaries

Just run `./start-dev.sh` and the Echo feature will work! 🎉
