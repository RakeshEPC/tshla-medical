# Diabetes Education Phone System Issue - DIAGNOSED

## Problem Report
**Date:** December 29, 2025
**Phone Number:** 832-400-3930
**Reported Issue:** Caller hears "Connecting to your diabetes educator... goodbye" and call ends

## Root Cause Analysis

### ❌ PRIMARY ISSUE: Invalid OpenAI API Key
The OpenAI Realtime API key is **expired or invalid**, returning **401 Unauthorized**.

**Evidence:**
```bash
$ node test-openai-realtime-connection.js
❌ WebSocket Error: Unexpected server response: 401
```

**Current Key (in .env):**
```
VITE_OPENAI_API_KEY=sk-proj-...[REDACTED]...
```

### Call Flow Analysis

```
1. Patient calls 832-400-3930
   ↓
2. Twilio webhook: POST /api/twilio/diabetes-education-inbound
   ↓
3. Server authenticates caller by phone number
   ✅ Phone found in database
   ↓
4. Server generates TwiML:
   <Say>Connecting to your diabetes educator. Please wait.</Say>
   <Connect>
     <Stream url="wss://.../media-stream"/>
   </Connect>
   <Say>Thank you for calling. Goodbye.</Say>
   ↓
5. Twilio tries to connect WebSocket to /media-stream
   ↓
6. Server tries to connect to OpenAI Realtime API
   ❌ 401 Unauthorized - Invalid API Key
   ↓
7. WebSocket connection fails
   ↓
8. Twilio falls through to final <Say>
   🔊 "Thank you for calling. Goodbye"
   ↓
9. Call ends
```

## Secondary Findings

### ✅ Database is configured correctly
- Supabase connection: Working
- Table exists: `diabetes_education_patients`
- Active patients: 2 registered
  - Simrab Patel - +17138552377
  - Raman Patel - +18326073630

### ✅ WebSocket relay is configured
- Endpoint: `/media-stream`
- Handler: `server/openai-realtime-relay.js`
- Registered in: `server/unified-api.js` line 1383

### ✅ Twilio integration is set up
- Webhook: `/api/twilio/diabetes-education-inbound`
- Status webhook: `/api/twilio/diabetes-education-status`
- Transcript webhook: `/api/elevenlabs/diabetes-education-transcript`

### ❌ Error handling needs improvement
- When OpenAI connection fails, caller hears generic "goodbye"
- Should say: "We're experiencing technical difficulties. Please try again later."

## Solutions Required

### 1. **CRITICAL: Get New OpenAI API Key**

**Steps:**
1. Go to https://platform.openai.com/api-keys
2. Create a new API key with Realtime API access
3. Update local `.env`:
   ```bash
   VITE_OPENAI_API_KEY=sk-proj-...NEW_KEY...
   ```

### 2. **Update Production Environment Variables**

**Azure Container App:**
```bash
az containerapp update \
  --name tshla-unified-api \
  --resource-group tshla-medical \
  --set-env-vars \
    VITE_OPENAI_API_KEY="sk-proj-...NEW_KEY..." \
    OPENAI_API_KEY="sk-proj-...NEW_KEY..."
```

**GitHub Secrets (if using CI/CD):**
- Add `VITE_OPENAI_API_KEY` to repository secrets
- Redeploy via GitHub Actions

### 3. **Improve Error Handling**

Update `server/api/twilio/diabetes-education-inbound.js`:

```javascript
async function generateStreamTwiML(agentId, patientData) {
  // Build patient context
  const patientContext = buildPatientContext(patientData);

  // Test OpenAI connection BEFORE generating TwiML
  try {
    const testWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17', {
      headers: {
        'Authorization': `Bearer ${process.env.VITE_OPENAI_API_KEY}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    });

    await new Promise((resolve, reject) => {
      testWs.on('open', () => {
        testWs.close();
        resolve();
      });
      testWs.on('error', reject);
      setTimeout(() => reject(new Error('Timeout')), 5000);
    });

  } catch (error) {
    console.error('[DiabetesEdu] OpenAI connection test failed:', error);

    // Return error TwiML instead of attempting connection
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-US">
    We're sorry, but our AI educator is currently unavailable.
    This may be due to temporary technical difficulties.
    Please try calling again in a few minutes, or contact your clinic directly.
    Thank you for your patience.
  </Say>
  <Hangup/>
</Response>`;
  }

  // Continue with normal flow...
}
```

### 4. **Add Monitoring**

Create health check endpoint:

```javascript
// server/unified-api.js
app.get('/api/health/openai-realtime', async (req, res) => {
  try {
    const ws = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17', {
      headers: {
        'Authorization': `Bearer ${process.env.VITE_OPENAI_API_KEY}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    });

    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        ws.close();
        resolve();
      });
      ws.on('error', reject);
      setTimeout(() => reject(new Error('Timeout')), 5000);
    });

    res.json({ status: 'ok', service: 'openai-realtime-api' });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      service: 'openai-realtime-api',
      error: error.message
    });
  }
});
```

## Testing After Fixes

### 1. Test OpenAI Connection
```bash
cd server
VITE_OPENAI_API_KEY="sk-proj-...NEW_KEY..." node test-openai-realtime-connection.js
```

Expected output:
```
✅ Connected to OpenAI Realtime API!
📨 Received: session.created
📨 Received: session.updated
✅ Session configured successfully!
```

### 2. Test Local Relay
```bash
# Start unified API server
npm run dev
```

Then call the health check:
```bash
curl http://localhost:3000/api/health/openai-realtime
```

### 3. Test Production
```bash
curl https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/health/openai-realtime
```

### 4. Test End-to-End
1. Ensure your phone number is registered in database
2. Call 832-400-3930
3. Should hear: "Connecting to your diabetes educator..."
4. Then: AI voice greeting you
5. Have a conversation
6. Hang up
7. Check database for transcript

## Additional Recommendations

### Phone Number Registration
To register a new phone number (like +18324003930):

1. Go to https://www.tshla.ai/diabetes-education
2. Log in as medical staff
3. Click "Add New Patient"
4. Fill in:
   - First Name: Test
   - Last Name: User
   - Phone: +18324003930
   - Date of Birth: (any date)
   - Language: English
5. Save

### Monitor Call Logs
```sql
-- Check recent calls
SELECT
  c.id,
  c.call_started_at,
  c.call_status,
  c.duration_seconds,
  p.first_name,
  p.last_name,
  p.phone_number
FROM diabetes_education_calls c
JOIN diabetes_education_patients p ON c.patient_id = p.id
ORDER BY c.call_started_at DESC
LIMIT 10;
```

### Enable Debug Logging
Add to Azure environment variables:
```
NODE_ENV=development
DEBUG=*
```

This will enable verbose logging in `server/openai-realtime-relay.js`.

## Files Modified/Created

### Created:
- `server/check-patient-registration.js` - Database query utility
- `server/test-openai-realtime-connection.js` - OpenAI connection test
- `DIABETES_EDUCATION_PHONE_ISSUE.md` - This diagnostic report

### Need to Modify:
- `server/api/twilio/diabetes-education-inbound.js` - Add error handling
- `server/unified-api.js` - Add health check endpoint
- `.env` - Update VITE_OPENAI_API_KEY
- Azure Container App - Update environment variables

## Summary

**The phone system hangs up immediately because the OpenAI API key is invalid.**

**Quick Fix:**
1. Get new OpenAI API key
2. Update `.env` and Azure environment variables
3. Restart server
4. Test call

**Proper Fix:**
1. Do quick fix above
2. Add error handling for failed OpenAI connections
3. Add monitoring endpoint
4. Implement graceful degradation (fallback message)
5. Set up alerts for OpenAI connection failures

---

**Next Steps:**
Please obtain a new OpenAI API key with Realtime API access and update the environment variables, then the system should work correctly.
