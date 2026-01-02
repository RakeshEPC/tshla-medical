# Diabetes Education Phone System Fix - ElevenLabs Relay

## Problem
Calling **832-400-3930** for diabetes education resulted in:
> **"An application error has occurred. Goodbye."**

## Root Cause Analysis

### Primary Issue: Missing WebSocket Relay Endpoint
The code expected a WebSocket relay service at `/elevenlabs-relay` but this endpoint **did not exist** in the unified API server.

**Evidence:**
- [diabetes-education-inbound.js:178](server/api/twilio/diabetes-education-inbound.js#L178) uses `ELEVENLABS_RELAY_URL || 'wss://api.tshla.ai/elevenlabs-relay'`
- No WebSocket handler registered at `/elevenlabs-relay` in unified-api.js
- Twilio attempted to connect to non-existent endpoint → Generic error message

### Secondary Issue: Phone Number Not Registered
The number **+18324003930** was not in the `diabetes_education_patients` table.

**Registered numbers:**
- +17138552377 (Simrab Patel)
- +18326073630 (Raman Patel)

## Why a Relay is Needed

**Problem:** Twilio's `<Stream>` tag doesn't support query parameters in WebSocket URLs, but ElevenLabs' signed URLs require authentication query parameters.

**Solution:** A relay proxy that:
1. Accepts Twilio connections (no query params)
2. Receives ElevenLabs signed URL via custom parameters
3. Connects to ElevenLabs with full signed URL
4. Relays audio bidirectionally

## Implementation

### 1. Added ElevenLabs Relay to unified-api.js

**Location:** [server/unified-api.js:1822-1925](server/unified-api.js#L1822-L1925)

```javascript
const elevenLabsRelay = new WebSocket.Server({
  server,
  path: '/elevenlabs-relay'
});

elevenLabsRelay.on('connection', (twilioWs, req) => {
  // Extract ElevenLabs signed URL from Twilio's custom parameters
  // Connect to ElevenLabs and relay audio bidirectionally
});
```

**Key Features:**
- Handles Twilio `start`, `media`, and `stop` events
- Extracts `elevenlabs_url` from custom parameters
- Relays audio in both directions
- Comprehensive error logging

### 2. Enhanced Error Handling

**Location:** [server/api/twilio/diabetes-education-inbound.js:158-170](server/api/twilio/diabetes-education-inbound.js#L158-L170)

Added pre-flight check for ElevenLabs API key:

```javascript
if (!ELEVENLABS_API_KEY) {
  return `<Say>We're sorry, but our diabetes education service is not fully configured...</Say>`;
}
```

**Benefits:**
- Prevents connection attempts with invalid credentials
- Provides clear error message to caller
- Logs configuration issues

### 3. Environment Variables

Added to `.env`:
```bash
ELEVENLABS_RELAY_URL=wss://api.tshla.ai/elevenlabs-relay
```

Added to Azure deployment:
- [.github/workflows/deploy-unified-container-app.yml:172](..github/workflows/deploy-unified-container-app.yml#L172)

### 4. Patient Registration

Created utility script: [server/register-diabetes-patient.js](server/register-diabetes-patient.js)

**Usage:**
```bash
VITE_SUPABASE_URL="..." \
SUPABASE_SERVICE_ROLE_KEY="..." \
node server/register-diabetes-patient.js "+18324003930" "Rakesh" "Patel"
```

**Result:**
- Patient ID: `1ee54d3c-c0fe-4fd4-a467-df2de0a178fe`
- Phone: `+18324003930`
- Name: Rakesh Patel
- Language: English (en)
- Status: Active

## Call Flow (After Fix)

```
1. Patient calls 832-400-3930
   ↓
2. Twilio receives call → POST /api/twilio/diabetes-education-inbound
   ↓
3. Server authenticates caller by phone number
   ✅ Found: +18324003930 (Rakesh Patel)
   ↓
4. Server requests ElevenLabs signed URL for agent
   ✅ Agent: agent_6101kbk0qsmfefftpw6sf9k0wfyb (English)
   ↓
5. Server generates TwiML with relay URL and signed URL:
   <Stream url="wss://api.tshla.ai/elevenlabs-relay">
     <Parameter name="elevenlabs_url" value="wss://api.elevenlabs.io/..."/>
   </Stream>
   ↓
6. Twilio connects to /elevenlabs-relay
   ↓
7. Relay extracts signed URL and connects to ElevenLabs
   ✅ Bidirectional audio relay established
   ↓
8. Patient hears AI greeting
   ↓
9. Conversation happens
   ↓
10. Call ends → Transcript saved to database
```

## Testing Checklist

### Local Testing
- [x] Server starts without errors
- [x] WebSocket endpoint registered: `/elevenlabs-relay`
- [x] Phone number registered in database
- [x] Environment variables configured

### Production Testing (After Deployment)
- [ ] Health check: `https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/health`
- [ ] Call 832-400-3930 from +18324003930
- [ ] Verify call connects to AI
- [ ] Check call logged in `diabetes_education_calls` table
- [ ] Verify transcript saved

## Files Modified

### Server Code
1. **server/unified-api.js**
   - Added ElevenLabs relay WebSocket handler (lines 1822-1925)
   - Updated 404 handler to skip `/elevenlabs-relay` (line 1939)

2. **server/api/twilio/diabetes-education-inbound.js**
   - Added API key validation (lines 158-170)
   - Uses `ELEVENLABS_RELAY_URL` environment variable (line 178)

### Configuration
3. **.env**
   - Added `ELEVENLABS_RELAY_URL=wss://api.tshla.ai/elevenlabs-relay`

4. **.github/workflows/deploy-unified-container-app.yml**
   - Added `ELEVENLABS_RELAY_URL` to environment variables (line 172)

### Utilities
5. **server/register-diabetes-patient.js** (NEW)
   - Script to register phone numbers for diabetes education
   - Checks for existing registration
   - Inserts with default values

## Deployment

### Commits
1. `4e9170e4` - Fix diabetes education phone system - Add ElevenLabs relay
2. `d9c70320` - Add ELEVENLABS_RELAY_URL to Azure deployment

### GitHub Actions
- Workflow: Deploy Unified API to Azure Container App
- Run ID: 20603861151 (in progress)
- Status: Building and deploying to Azure Container Apps

## Next Steps

1. **Wait for deployment to complete**
   - Monitor GitHub Actions workflow
   - Verify container app updated successfully

2. **Test end-to-end**
   ```bash
   # Call 832-400-3930 from +18324003930
   # Expected: AI picks up and greets you
   ```

3. **Verify in database**
   ```sql
   SELECT * FROM diabetes_education_calls
   WHERE patient_id = '1ee54d3c-c0fe-4fd4-a467-df2de0a178fe'
   ORDER BY call_started_at DESC
   LIMIT 1;
   ```

4. **If issues persist**
   - Check Azure Container App logs:
     ```bash
     az containerapp logs show \
       --name tshla-unified-api \
       --resource-group tshla-medical \
       --follow
     ```
   - Look for relay connection logs:
     - `🔄 [ElevenLabs Relay] New Twilio connection`
     - `✅ [Relay] Connected to ElevenLabs`

## Additional Notes

### Other ElevenLabs Agents Configured
- Spanish (ES): `agent_8301kbk0jvacfqbsn5f4qzjn57dd`
- Hindi (HI): `agent_7001kbk0byh7fm6rmnbv1adb6rxn`

Patients can be registered with different `preferred_language` to route to appropriate agent.

### Standalone Relay Service
The relay code was originally in `server/elevenlabs-twilio-relay.js` as a standalone service. It has been integrated directly into `unified-api.js` to avoid running a separate process.

### Monitoring
The relay logs all events with prefixes for easy filtering:
- `[Relay]` - Relay-specific events
- `[DiabetesEdu]` - Diabetes education webhook events

---

**Status:** ✅ Code changes complete, deployment in progress

**Last Updated:** 2025-12-30 13:06 CST
