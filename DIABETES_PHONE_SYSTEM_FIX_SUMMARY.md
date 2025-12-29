# Diabetes Education Phone System - Fix Summary

## Problem Diagnosed ✅

When calling **832-400-3930**, you hear:
> "Connecting to your diabetes educator... goodbye"

Then the call immediately disconnects.

## Root Cause: Invalid OpenAI API Key 🔑

The OpenAI Realtime API key in your `.env` file is **expired or invalid**, returning **401 Unauthorized**.

**Test Result:**
```bash
$ VITE_OPENAI_API_KEY="sk-proj-vR9..." node server/test-openai-realtime-connection.js
❌ WebSocket Error: Unexpected server response: 401
```

## What Happens During the Call

```
📞 Patient calls 832-400-3930
    ↓
✅ Twilio receives call → Webhook to your server
    ↓
✅ Server looks up patient by phone number in database
    ↓
✅ Server generates TwiML with WebSocket connection
    ↓
🔊 Twilio plays: "Connecting to your diabetes educator. Please wait."
    ↓
🔌 Twilio tries to connect WebSocket to /media-stream
    ↓
❌ Server tries to connect to OpenAI → 401 Unauthorized
    ↓
❌ WebSocket connection fails silently
    ↓
🔊 Twilio falls through to: "Thank you for calling. Goodbye."
    ↓
☎️ Call ends
```

## Fixes Implemented ✅

### 1. **Better Error Messages in TwiML**
   - [diabetes-education-inbound.js:159-172](server/api/twilio/diabetes-education-inbound.js#L159-L172)
   - Now checks if OpenAI API key is configured BEFORE attempting connection
   - Provides helpful error message instead of generic "goodbye"

**Before:**
```xml
<Say>Connecting to your diabetes educator...</Say>
<Connect><Stream url="..."/></Connect>
<Say>Thank you for calling. Goodbye.</Say>  <!-- Generic! -->
```

**After:**
```xml
<!-- If API key missing: -->
<Say>We're sorry, but our diabetes educator AI is not configured at this time.
Please contact your clinic directly for assistance.</Say>

<!-- If WebSocket fails: -->
<Say>We're sorry, but we're experiencing technical difficulties with our AI educator.
Please try calling again in a few minutes, or contact your clinic directly.</Say>
```

### 2. **Enhanced Logging in OpenAI Realtime Relay**
   - [openai-realtime-relay.js:167-168](server/openai-realtime-relay.js#L167-L168)
   - Logs API key configuration status
   - Provides diagnostic messages for common errors (401, 403, 429)

**Example logs:**
```
[Realtime] Connecting to OpenAI Realtime API...
[Realtime] API Key configured: YES (length: 164)
[Realtime] ❌ OpenAI connection error: Unexpected server response: 401
[Realtime] 🔑 API Key is INVALID or EXPIRED!
[Realtime] 💡 Get a new key from https://platform.openai.com/api-keys
```

### 3. **Health Check Endpoint**
   - [unified-api.js:85-148](server/unified-api.js#L85-L148)
   - New endpoint: `GET /api/health/openai-realtime`
   - Tests OpenAI connection and returns status

**Usage:**
```bash
# Local test
curl http://localhost:3000/api/health/openai-realtime

# Production test
curl https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/health/openai-realtime
```

**Response when API key is invalid:**
```json
{
  "status": "error",
  "service": "openai-realtime-api",
  "error": "Unexpected server response: 401",
  "details": "API key is invalid or expired. Get a new key from https://platform.openai.com/api-keys",
  "timestamp": "2025-12-29T..."
}
```

### 4. **Diagnostic Utilities Created**
   - `server/check-patient-registration.js` - Check if phone numbers are registered
   - `server/test-openai-realtime-connection.js` - Test OpenAI API connectivity

## How to Fix (Required Steps)

### Step 1: Get New OpenAI API Key 🔑

1. Go to: https://platform.openai.com/api-keys
2. Sign in to your OpenAI account
3. Click **"Create new secret key"**
4. Name it: `tshla-diabetes-education-realtime`
5. **IMPORTANT:** Ensure the key has access to:
   - ✅ Realtime API
   - ✅ GPT-4 models
6. Copy the key (starts with `sk-proj-...`)

### Step 2: Update Local Environment

Edit `.env` file:
```bash
# Replace the old key with the new one
VITE_OPENAI_API_KEY=sk-proj-YOUR_NEW_KEY_HERE
OPENAI_API_KEY=sk-proj-YOUR_NEW_KEY_HERE  # Add this too for consistency
```

### Step 3: Test Locally

```bash
# Test OpenAI connection
cd server
VITE_OPENAI_API_KEY="sk-proj-YOUR_NEW_KEY" node test-openai-realtime-connection.js
```

**Expected output:**
```
🔑 OPENAI_API_KEY found (length: 164)
🔗 Attempting to connect to OpenAI Realtime API...

✅ Connected to OpenAI Realtime API!
📨 Received: session.created
📨 Received: session.updated
✅ Session configured successfully!
🎉 OpenAI Realtime API is working correctly.
```

### Step 4: Update Production Environment Variables

You have two options:

#### Option A: Azure CLI
```bash
az containerapp update \
  --name tshla-unified-api \
  --resource-group tshla-medical \
  --set-env-vars \
    "VITE_OPENAI_API_KEY=sk-proj-YOUR_NEW_KEY_HERE" \
    "OPENAI_API_KEY=sk-proj-YOUR_NEW_KEY_HERE"
```

#### Option B: GitHub Secrets (if using CI/CD)
1. Go to: https://github.com/YOUR_USERNAME/tshla-medical/settings/secrets/actions
2. Update or create secrets:
   - `VITE_OPENAI_API_KEY` = `sk-proj-YOUR_NEW_KEY_HERE`
   - `OPENAI_API_KEY` = `sk-proj-YOUR_NEW_KEY_HERE`
3. Trigger a new deployment (push to main or manually trigger workflow)

### Step 5: Verify Production

```bash
# Test the health endpoint
curl https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/health/openai-realtime
```

**Expected response:**
```json
{
  "status": "ok",
  "service": "openai-realtime-api",
  "message": "Successfully connected to OpenAI Realtime API",
  "timestamp": "2025-12-29T..."
}
```

### Step 6: Test End-to-End

#### A. Register Your Phone Number (if not already)

**Option 1: Using the admin interface**
1. Go to: https://www.tshla.ai/diabetes-education
2. Log in as medical staff
3. Click "Add New Patient"
4. Fill in:
   - First Name: Your Name
   - Last Name:
   - Phone: +1YOUR_PHONE_NUMBER (E.164 format, e.g., +18324003930)
   - Date of Birth: Your DOB
   - Language: English
5. Click Save

**Option 2: Using the diagnostic script**
```bash
cd server
VITE_SUPABASE_URL="https://minvvjdflezibmgkplqb.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="eyJhbGci..." \
node check-patient-registration.js "+1YOUR_PHONE_NUMBER"
```

#### B. Make a Test Call

1. Call **832-400-3930** from your registered phone number
2. You should hear:
   - ✅ "Connecting to your diabetes educator. Please wait."
   - ✅ AI greeting you (e.g., "Hello! I'm your certified diabetes educator...")
3. Have a brief conversation with the AI
4. Hang up

#### C. Verify Call Was Logged

Check the database for your call record:
```bash
cd server
VITE_SUPABASE_URL="https://minvvjdflezibmgkplqb.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="eyJhbGci..." \
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data } = await supabase
    .from('diabetes_education_calls')
    .select('*')
    .order('call_started_at', { ascending: false })
    .limit(5);
  console.log(JSON.stringify(data, null, 2));
})();
"
```

## Current Database State

**Registered Patients:**
- Simrab Patel - +17138552377
- Raman Patel - +18326073630

**Note:** The phone number **+18324003930** is NOT currently registered. If you want to test with this number, add it to the database first.

## Files Modified

1. ✅ [server/api/twilio/diabetes-education-inbound.js](server/api/twilio/diabetes-education-inbound.js)
   - Added API key validation before attempting connection
   - Improved error messages in TwiML

2. ✅ [server/openai-realtime-relay.js](server/openai-realtime-relay.js)
   - Enhanced error logging with diagnostics
   - Added API key configuration check

3. ✅ [server/unified-api.js](server/unified-api.js)
   - Added `/api/health/openai-realtime` endpoint

4. ✅ [server/check-patient-registration.js](server/check-patient-registration.js) - NEW
   - Utility to check patient registration status

5. ✅ [server/test-openai-realtime-connection.js](server/test-openai-realtime-connection.js) - NEW
   - Utility to test OpenAI Realtime API connectivity

6. ✅ [DIABETES_EDUCATION_PHONE_ISSUE.md](DIABETES_EDUCATION_PHONE_ISSUE.md) - NEW
   - Detailed diagnostic report

7. ✅ [DIABETES_PHONE_SYSTEM_FIX_SUMMARY.md](DIABETES_PHONE_SYSTEM_FIX_SUMMARY.md) - NEW
   - This summary document

## Troubleshooting

### Problem: Still getting "goodbye" message after updating API key

**Solution:**
1. Verify API key is correct:
   ```bash
   echo $VITE_OPENAI_API_KEY
   ```
2. Test connection:
   ```bash
   VITE_OPENAI_API_KEY="sk-proj-..." node server/test-openai-realtime-connection.js
   ```
3. Check server logs for errors
4. Restart the server

### Problem: "Your phone number is not registered"

**Solution:**
```bash
# Check if your number is in the database
VITE_SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." \
node server/check-patient-registration.js "+1YOUR_NUMBER"

# If not found, register via web interface at:
# https://www.tshla.ai/diabetes-education
```

### Problem: WebSocket connection fails in production but works locally

**Solution:**
1. Check Azure Container App environment variables:
   ```bash
   az containerapp show \
     --name tshla-unified-api \
     --resource-group tshla-medical \
     --query properties.configuration.secrets
   ```
2. Verify the API key is set correctly in Azure
3. Check Azure Container App logs for WebSocket errors

### Problem: Call connects but AI doesn't respond

**Solution:**
1. Check if patient has clinical notes or medical data
2. Review server logs for OpenAI session creation errors
3. Verify the voice model is supported (should be `gpt-4o-realtime-preview-2024-12-17`)

## Next Steps After Fix

1. **Monitor Call Quality**
   - Review transcripts in the database
   - Check call durations
   - Verify AI responses are appropriate

2. **Set Up Alerts**
   - Create monitoring for `/api/health/openai-realtime` endpoint
   - Alert if status returns error for more than 5 minutes

3. **Document for Staff**
   - Create guide for registering new patients
   - Provide troubleshooting steps for common issues

4. **Future Enhancements**
   - Add retry logic for transient OpenAI failures
   - Implement fallback to recorded message if AI is unavailable
   - Add real-time status dashboard showing system health

## Support

If you need help:
1. Check server logs: `az containerapp logs show --name tshla-unified-api --resource-group tshla-medical`
2. Test health endpoints: `curl https://tshla-unified-api.../api/health/openai-realtime`
3. Review this document for troubleshooting steps

---

**TL;DR:** The OpenAI API key is expired. Get a new one from https://platform.openai.com/api-keys, update `.env` and Azure environment variables, then test by calling 832-400-3930 from a registered phone number.
