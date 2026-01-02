# Diabetes Education Phone System (832-400-3930) - Troubleshooting Guide

**Date:** December 30, 2025
**Issue:** Phone hangs up with error message instead of connecting to AI educator

---

## Current Error Message

When calling 832-400-3930, you hear:
> "We're sorry, but our diabetes educator AI is not available at this time. Please contact your clinic directly for assistance. Thank you for calling."

Then the call hangs up.

---

## Root Cause Analysis

This error comes from [server/api/twilio/diabetes-education-inbound.js:213](server/api/twilio/diabetes-education-inbound.js#L213), triggered when the **ElevenLabs API call fails**.

### Possible Causes (Check in Order):

1. ❌ **Invalid ElevenLabs API Key** - API key is missing, expired, or incorrect
2. ❌ **Invalid Agent IDs** - Agent IDs don't exist or were deleted in ElevenLabs
3. ❌ **ElevenLabs API Error** - API returned an error (rate limit, account issue, etc.)
4. ❌ **Missing Environment Variables** - Production environment doesn't have required config
5. ❌ **Agent Not Configured** - ElevenLabs agent doesn't have proper system prompt

---

## Quick Diagnostic Steps

### Step 1: Check Azure Environment Variables

```bash
az containerapp show \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --query "properties.template.containers[0].env[?starts_with(name, 'ELEVENLABS')].{name:name, secretRef:secretRef}" \
  -o table
```

**Expected output:**
```
Name                          SecretRef
----------------------------  ----------------------------
ELEVENLABS_API_KEY            elevenlabs-api-key
ELEVENLABS_DIABETES_AGENT_EN  elevenlabs-diabetes-agent-en
ELEVENLABS_DIABETES_AGENT_ES  elevenlabs-diabetes-agent-es
ELEVENLABS_DIABETES_AGENT_HI  elevenlabs-diabetes-agent-hi
```

If any are missing, see "Fix Missing Environment Variables" below.

### Step 2: Check Azure Logs for Errors

```bash
az containerapp logs show \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --tail 100 --follow
```

Make a test call and look for:
- `📞 [DiabetesEdu] Incoming call received`
- `✅ [DiabetesEdu] Patient authenticated`
- `❌ Failed to get ElevenLabs signed URL:` ← **ERROR HERE**
- Error details will show the specific problem

### Step 3: Verify ElevenLabs API Key

Go to [ElevenLabs API Keys](https://elevenlabs.io/app/settings/api-keys) and:
1. Check if your API key exists and is active
2. Copy the key value
3. Compare with what's in your local `.env` file
4. If different, update Azure secrets (see below)

### Step 4: Verify Agent IDs

Go to [ElevenLabs Conversational AI](https://elevenlabs.io/app/conversational-ai) and:
1. Find your diabetes education agents
2. Click on each agent and copy the Agent ID from the URL
3. Compare with configured IDs:
   - English: `agent_6101kbk0qsmfefftpw6sf9k0wfyb`
   - Spanish: `agent_8301kbk0jvacfqbsn5f4qzjn57dd`
   - Hindi: `agent_7001kbk0byh7fm6rmnbv1adb6rxn`

If IDs are different, update Azure secrets (see below).

---

## Fix: Update Azure Secrets

### Option A: Using Azure CLI (Recommended)

```bash
# 1. Set the ElevenLabs API Key
az containerapp secret set \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --secrets \
    elevenlabs-api-key="YOUR_ELEVENLABS_API_KEY_HERE"

# 2. Set the Agent IDs (use actual IDs from ElevenLabs dashboard)
az containerapp secret set \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --secrets \
    elevenlabs-diabetes-agent-en="YOUR_ENGLISH_AGENT_ID" \
    elevenlabs-diabetes-agent-es="YOUR_SPANISH_AGENT_ID" \
    elevenlabs-diabetes-agent-hi="YOUR_HINDI_AGENT_ID"

# 3. Restart the container to apply changes
az containerapp revision restart \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg
```

### Option B: Using GitHub Secrets (for CI/CD Deployment)

1. Go to GitHub repository: `https://github.com/YOUR_USERNAME/tshla-medical/settings/secrets/actions`

2. Update or add these secrets:
   - `ELEVENLABS_API_KEY` - Your ElevenLabs API key
   - `ELEVENLABS_DIABETES_AGENT_EN` - English agent ID
   - `ELEVENLABS_DIABETES_AGENT_ES` - Spanish agent ID
   - `ELEVENLABS_DIABETES_AGENT_HI` - Hindi agent ID

3. Trigger a redeploy:
   ```bash
   git commit --allow-empty -m "Trigger redeploy for ElevenLabs config"
   git push
   ```

4. Monitor deployment at: Actions tab in GitHub

---

## Fix: Configure ElevenLabs Agent System Prompt

Each agent MUST have the correct system prompt to receive patient context.

### Step-by-Step:

1. Go to [ElevenLabs Conversational AI](https://elevenlabs.io/app/conversational-ai)

2. Click on your **English Diabetes Educator** agent

3. In the "System Prompt" section, **replace everything** with:

```
You are a diabetes educator AI assistant.

PATIENT INFORMATION:
{{patient_context}}

The patient information above includes their clinical notes, medications, lab results, diagnoses, allergies, and focus areas.

Guidelines:
1. **Be concise and direct - get to the answer quickly**
2. When asked about lab values, state them directly: "Your A1C is 8.7%"
3. When asked about medications, list them briefly
4. Skip unnecessary preambles like "according to your notes" or "let me check" - just answer
5. Keep responses under 3 sentences unless the patient asks for more detail
6. Use the patient's actual data from the PATIENT INFORMATION section above
7. Pay attention to Clinical Notes for special instructions from their care team
8. Focus on their specified Focus Areas during conversation
9. Be warm but brief - conversational without rambling
10. At 8 minutes: "We have 2 minutes left. Anything else?"
11. At 10 minutes: "Time's up. Call back anytime. Take care."
12. For urgent issues: "This sounds urgent. Contact your doctor now or go to the ER."
13. Never diagnose new conditions or prescribe medications
14. If data is missing: "I don't have that in your records. Ask your provider about it."

Be helpful, friendly, and efficient. Answer quickly and only elaborate if asked.
```

4. **CRITICAL:** Notice the `{{patient_context}}` variable with **double braces**

5. Click **Save**

6. Repeat for Spanish and Hindi agents (translate the prompt appropriately)

---

## Fix: Configure ElevenLabs Webhook

To save call transcripts, configure the post-call webhook:

1. Go to [ElevenLabs Settings](https://elevenlabs.io/app/settings)

2. Navigate to **Webhooks** or **Platform Settings**

3. Add webhook URL:
   ```
   https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/elevenlabs/diabetes-education-transcript
   ```

4. Select **POST** method

5. Enable **Transcription webhooks**

6. Save configuration

---

## Testing After Fixes

### Test 1: Health Check

```bash
curl https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/health
```

Expected: `{"status":"healthy",...}`

### Test 2: Check Patient Registration

```bash
# SSH into Azure VM or use local script
VITE_SUPABASE_URL="https://minvvjdflezibmgkplqb.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_KEY" \
node server/check-patient-registration.js "+18326073630"
```

Expected: Patient found with name, language, and medical data

### Test 3: Make Test Call

1. **Call 832-400-3930** from registered phone number (+18326073630)

2. **Listen for:**
   - "Hello, I'm your diabetes educator..."
   - NOT: "We're sorry, but our diabetes educator AI is not available"

3. **Ask:** "What is my A1C?"

4. **Expected Response:** AI should state the actual A1C from clinical notes (e.g., "Your A1C is 8.7%")

### Test 4: Check Call Logs

After the call, check the database:

```sql
SELECT
  call_started_at,
  call_status,
  duration_seconds,
  LENGTH(transcript) as transcript_length,
  summary
FROM diabetes_education_calls
ORDER BY call_started_at DESC
LIMIT 1;
```

Expected: Call record with transcript and AI-generated summary

---

## Common Issues & Solutions

### Issue: "Service is not fully configured"
**Cause:** `ELEVENLABS_API_KEY` is missing or empty
**Fix:** Set the API key secret in Azure (see above)

### Issue: "Diabetes educator AI is not available"
**Cause:** ElevenLabs `registerCall` API failed
**Check Azure logs for specific error:**
- 401 Unauthorized → Invalid API key
- 404 Not Found → Invalid agent ID
- 429 Too Many Requests → Rate limit (wait or upgrade plan)
- 500 Internal Server Error → Contact ElevenLabs support

### Issue: AI says "I don't have access to your records"
**Cause:** Agent system prompt doesn't have `{{patient_context}}` variable
**Fix:** Update agent prompt (see "Configure ElevenLabs Agent System Prompt" above)

### Issue: No transcript saved after call
**Cause:** ElevenLabs webhook not configured
**Fix:** Configure webhook URL (see "Configure ElevenLabs Webhook" above)

### Issue: Call connects but no audio/silence
**Cause:** Twilio webhook might be timing out or WebSocket issue
**Check:**
1. Azure logs for WebSocket errors
2. Twilio debugger: https://console.twilio.com/us1/monitor/debugger
3. ElevenLabs agent voice settings

---

## Environment Variables Reference

### Required in Azure Container App:

| Variable | Example Value | Source |
|----------|---------------|--------|
| `ELEVENLABS_API_KEY` | `sk_c026b4707...` | [ElevenLabs API Keys](https://elevenlabs.io/app/settings/api-keys) |
| `ELEVENLABS_DIABETES_AGENT_EN` | `agent_6101kbk0...` | English agent URL in ElevenLabs dashboard |
| `ELEVENLABS_DIABETES_AGENT_ES` | `agent_8301kbk0...` | Spanish agent URL in ElevenLabs dashboard |
| `ELEVENLABS_DIABETES_AGENT_HI` | `agent_7001kbk0...` | Hindi agent URL in ElevenLabs dashboard |
| `VITE_OPENAI_API_KEY` | `sk-proj-...` | For generating call summaries |
| `VITE_SUPABASE_URL` | `https://...supabase.co` | Patient database |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbG...` | Server-side database access |

---

## Architecture Overview

```
Patient Calls 832-400-3930
    ↓
Twilio receives call
    ↓
Twilio webhook → /api/twilio/diabetes-education-inbound
    ↓
Server authenticates caller by phone number (Supabase lookup)
    ↓
Server builds patient context (clinical notes + medical data)
    ↓
Server calls ElevenLabs API: elevenLabs.conversationalAi.twilio.registerCall()
    ├─ agentId: ELEVENLABS_DIABETES_AGENT_EN (or ES/HI)
    └─ dynamicVariables: { patient_context: "..." }
    ↓
ElevenLabs returns TwiML with WebSocket URL
    ↓
Twilio connects call to ElevenLabs WebSocket
    ↓
AI converses with patient (max 10 minutes)
    ↓
Call ends → Two webhooks fire:
    ├─ Twilio status → Updates call duration
    └─ ElevenLabs transcript → Saves transcript + generates summary
```

---

## Support & Escalation

If issues persist after following this guide:

1. **Collect diagnostic data:**
   - Azure logs during a test call
   - Twilio debugger logs
   - ElevenLabs API response (from Azure logs)

2. **Check service status:**
   - ElevenLabs: https://status.elevenlabs.io/
   - Twilio: https://status.twilio.com/
   - Azure: https://status.azure.com/

3. **Contact support:**
   - ElevenLabs Support: support@elevenlabs.io
   - Twilio Support: https://support.twilio.com/

---

## Files Modified/Referenced

- [server/api/twilio/diabetes-education-inbound.js](server/api/twilio/diabetes-education-inbound.js) - Main webhook handler
- [ELEVENLABS_AGENT_PROMPT_FINAL.md](ELEVENLABS_AGENT_PROMPT_FINAL.md) - Agent system prompt
- [ELEVENLABS_WEBHOOK_SETUP.md](ELEVENLABS_WEBHOOK_SETUP.md) - Webhook configuration guide
- [.env](.env) - Local environment variables (DO NOT commit this file!)

---

**Last Updated:** December 30, 2025
**Version:** 1.0
