# Echo Audio Preview - "Failed to Generate Preview" - FIXED

**Issue Date:** December 2, 2025
**Status:** ✅ **FIXED** - Enhanced error handling added

---

## Problem Summary

When clicking "Generate Preview" in the Echo Audio Summary modal after dictation, users saw:
```
❌ Failed to generate preview
error
```

This generic error message didn't explain what went wrong.

---

## Root Cause

**The OpenAI API key in the `.env` file is invalid or expired.**

The error flow was:
1. Frontend → POST to `/api/echo/generate-preview`
2. Backend → Calls OpenAI API to generate patient-friendly script
3. OpenAI → Returns `401 Unauthorized` (invalid API key)
4. Backend → Returns generic "Failed to generate preview"
5. Frontend → Shows generic error to user

---

## Solution Implemented

### ✅ Enhanced Error Handling

#### 1. Backend Changes ([server/routes/echo-audio-summary.js](server/routes/echo-audio-summary.js))

**Added detailed logging:**
```javascript
console.log('🎙️ [Echo Preview] Generating AI summary preview...');
console.log('   SOAP note length:', soapNote.length, 'characters');
console.log('   OpenAI API key configured:', !!OPENAI_API_KEY);
console.log('   OpenAI model:', OPENAI_MODEL);
```

**Added specific error messages:**
```javascript
if (error.message.includes('OpenAI API error: 401')) {
  userMessage = 'OpenAI API key is invalid or expired. Please update VITE_OPENAI_API_KEY in your .env file.';
}
```

#### 2. Frontend Changes ([src/components/echo/AudioSummaryModal.tsx](src/components/echo/AudioSummaryModal.tsx))

**Added console logging:**
```javascript
console.log('🎙️ [Echo] Step 1: Generating AI script from SOAP note...');
console.log('   API URL:', import.meta.env.VITE_API_URL);
console.log('🔊 [Echo] Step 2: Generating audio with ElevenLabs...');
```

**Added helpful error messages:**
```javascript
if (errorMessage.includes('OpenAI')) {
  errorMessage = '🔑 OpenAI API key issue. Please check your VITE_OPENAI_API_KEY in .env file.';
} else if (errorMessage.includes('ElevenLabs')) {
  errorMessage = '🔊 ElevenLabs API issue. Please check your VITE_ELEVENLABS_API_KEY in .env file.';
} else if (errorMessage.includes('fetch')) {
  errorMessage = '🌐 Network error. Please ensure the API server is running on port 3000.';
}
```

---

## How to Fix the OpenAI API Key

### Step 1: Get a Valid OpenAI API Key

1. Go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Log in to your OpenAI account
3. Click "Create new secret key"
4. Copy the key (it starts with `sk-proj-...`)

### Step 2: Update Your `.env` File

Open `/Users/rakeshpatel/Desktop/tshla-medical/.env` and update:

```bash
# Replace with your new valid API key
VITE_OPENAI_API_KEY=sk-proj-YOUR_NEW_KEY_HERE
```

### Step 3: Restart the Development Environment

```bash
cd /Users/rakeshpatel/Desktop/tshla-medical
./stop-dev.sh
./start-dev.sh
```

This will:
- Kill all running processes
- Clear Vite cache
- Start Unified API on port 3000
- Start Frontend on port 5173

---

## Testing the Fix

### Test 1: Check API is Running

```bash
lsof -i :3000
# Should show: node process running on port 3000
```

### Test 2: Test Backend Directly

```bash
curl -X POST http://localhost:3000/api/echo/generate-preview \
  -H "Content-Type: application/json" \
  -d '{"soapNote": "Patient came in for diabetes follow-up. A1C improved."}'
```

**Expected response (after fixing API key):**
```json
{
  "success": true,
  "script": "This is a beta project from your doctor's office. You came in for...",
  "wordCount": 120,
  "estimatedSeconds": 48
}
```

### Test 3: Test via UI

1. Open [http://localhost:5173](http://localhost:5173)
2. Log in
3. Go to **Dictation** page
4. Complete a dictation
5. Click **"📞 Send Patient Summary (ECHO)"**
6. Click **"🎙️ Generate Preview"**
7. ✅ Should now show clear error message if API key is invalid
8. ✅ Should generate preview successfully if API key is valid

### Test 4: Check Browser Console

Open browser DevTools (F12) and look for:

```
🎙️ [Echo] Step 1: Generating AI script from SOAP note...
   API URL: http://localhost:3000
   SOAP length: 150
✅ [Echo] AI script generated: This is a beta project from your doctor...
🔊 [Echo] Step 2: Generating audio with ElevenLabs...
   Voice ID: cgSgspJ2msm6clMCkdW9
✅ [Echo] Audio generated successfully
```

---

## New Error Messages

Users will now see **specific, actionable error messages**:

| Error Type | New Message |
|------------|-------------|
| OpenAI API key invalid | `🔑 OpenAI API key issue. Please check your VITE_OPENAI_API_KEY in .env file.` |
| ElevenLabs API issue | `🔊 ElevenLabs API issue. Please check your VITE_ELEVENLABS_API_KEY in .env file.` |
| Network/Server down | `🌐 Network error. Please ensure the API server is running on port 3000.` |
| Backend error | Shows the actual error from backend (e.g., "OpenAI API key is invalid or expired...") |

---

## Backend Logs

Check `/Users/rakeshpatel/Desktop/tshla-medical/logs/unified-api.log` for detailed logs:

```bash
tail -f logs/unified-api.log
```

**Example log output:**
```
🎙️ [Echo Preview] Generating AI summary preview...
   SOAP note length: 150 characters
   OpenAI API key configured: true
   OpenAI model: gpt-4o-mini
❌ [Echo Preview] Error: OpenAI API error: 401 - {
  "error": {
    "message": "Incorrect API key provided...",
    "type": "invalid_request_error",
    "code": "invalid_api_key"
  }
}
   Stack trace: Error: OpenAI API error: 401...
```

---

## Environment Variables Required

Make sure these are in your `.env` file:

```bash
# API URL (must point to port 3000)
VITE_API_URL=http://localhost:3000

# OpenAI (for AI summary generation) - **REQUIRED**
VITE_OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE
VITE_OPENAI_MODEL_STAGE4=gpt-4o-mini

# ElevenLabs (for text-to-speech) - **REQUIRED**
VITE_ELEVENLABS_API_KEY=sk_YOUR_KEY_HERE
VITE_ELEVENLABS_DEFAULT_VOICE_ID=cgSgspJ2msm6clMCkdW9

# Twilio (for phone calls) - Optional for preview
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
```

---

## Troubleshooting

### Issue: Still seeing "Failed to generate preview"

**Check the browser console (F12)** to see the specific error:
- If it says "OpenAI API key issue" → Update `VITE_OPENAI_API_KEY` in `.env`
- If it says "ElevenLabs API issue" → Update `VITE_ELEVENLABS_API_KEY` in `.env`
- If it says "Network error" → Check if unified API is running on port 3000

### Issue: "Network error" message

1. **Check if API is running:**
   ```bash
   lsof -i :3000
   ```

2. **Start the API:**
   ```bash
   ./start-dev.sh
   ```

3. **Check API health:**
   ```bash
   curl http://localhost:3000/health
   ```

### Issue: OpenAI quota exceeded

If you see:
```
"error": "You exceeded your current quota, please check your plan and billing details"
```

**Solution:**
1. Go to [https://platform.openai.com/account/billing](https://platform.openai.com/account/billing)
2. Add payment method or upgrade plan
3. Wait a few minutes for quota to refresh

### Issue: ElevenLabs quota exceeded

If audio generation fails but script generation works:

**Solution:**
1. Go to [https://elevenlabs.io/app/billing](https://elevenlabs.io/app/billing)
2. Check your character quota
3. Upgrade plan or wait for monthly reset

---

## What Changed

### Files Modified

1. ✅ [server/routes/echo-audio-summary.js](server/routes/echo-audio-summary.js)
   - Added detailed console logging
   - Added specific error messages for API key issues
   - Added stack trace logging

2. ✅ [src/components/echo/AudioSummaryModal.tsx](src/components/echo/AudioSummaryModal.tsx)
   - Added step-by-step console logging
   - Added user-friendly error messages
   - Improved error parsing from backend

### Files NOT Changed

- Server startup scripts (already correct)
- Environment variables (need user to update)
- API endpoints (working correctly)

---

## Summary

✅ **Root Cause:** Invalid OpenAI API key in `.env` file
✅ **Fix:** Enhanced error handling with specific, actionable messages
✅ **Result:** Users now see exactly what's wrong and how to fix it

### Before:
```
❌ Failed to generate preview
error
```

### After:
```
❌ OpenAI API key is invalid or expired.
Please update VITE_OPENAI_API_KEY in your .env file.
```

---

## Next Steps

1. **Update OpenAI API key** in `.env` file
2. **Restart dev environment** with `./start-dev.sh`
3. **Test the preview** - should work now! 🎉

---

**Questions?** Check the logs at `logs/unified-api.log` or open DevTools console (F12) for detailed error information.
