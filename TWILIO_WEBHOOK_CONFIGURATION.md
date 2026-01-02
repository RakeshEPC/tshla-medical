# Twilio Webhook Configuration for Diabetes Education (832-400-3930)

## Problem
Calling **832-400-3930** results in "An application error has occurred. Goodbye."

## Root Cause
The phone number **+18324003930** is not configured in Twilio to call your webhook, OR the webhook URL is incorrect/missing.

## Solution: Configure Twilio Webhooks

### Step 1: Verify Phone Number Ownership

1. Go to [Twilio Console - Phone Numbers](https://console.twilio.com/us1/develop/phone-numbers/manage/incoming)
2. Search for **832-400-3930** or **+18324003930**
3. **If you DON'T see this number:**
   - This number may not be in your Twilio account
   - You may need to purchase it or port it to Twilio
   - Check if you meant a different number

### Step 2: Configure Incoming Call Webhook

If the number exists in your account:

1. Click on the phone number **+18324003930**
2. Scroll to **Voice & Fax** section
3. Under **"A CALL COMES IN"**, set:
   - **Webhook**: `https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/twilio/diabetes-education-inbound`
   - **HTTP Method**: `POST`
   - **Primary Handler Fails**: (leave as default or set fallback)

4. Under **"CALL STATUS CHANGES"**, set:
   - **Webhook**: `https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/twilio/diabetes-education-status`
   - **HTTP Method**: `POST`

5. Click **Save** at the bottom of the page

### Step 3: Test the Configuration

After saving, call **832-400-3930** from **+18324003930** (the registered patient number).

**Expected flow:**
```
1. Call connects
2. "Connecting you to your diabetes educator. Please wait."
3. AI picks up and greets you
4. You can have a conversation about diabetes
```

## Alternative: Use the Existing Configured Number

If you don't own +18324003930 in Twilio, you can use the number that IS configured:

**Current Twilio Number:** `+18324027671`

To use this number for diabetes education:

1. Go to [Twilio Console](https://console.twilio.com/us1/develop/phone-numbers/manage/incoming)
2. Click on **+18324027671**
3. Configure the same webhooks as above
4. Register this number in the database:
   ```bash
   VITE_SUPABASE_URL="https://minvvjdflezibmgkplqb.supabase.co" \
   SUPABASE_SERVICE_ROLE_KEY="..." \
   node server/register-diabetes-patient.js "+18324027671" "Test" "User"
   ```
5. Call **832-402-7671** instead

## Debugging

### Check Twilio Logs

1. Go to [Twilio Monitor](https://console.twilio.com/us1/monitor/logs/calls)
2. Look for recent calls to +18324003930
3. Click on a call to see:
   - What webhook was called (if any)
   - What response was received
   - Any errors

### Common Issues

#### Issue 1: "Application Error Has Occurred"
**Cause:** Webhook not configured or returning invalid TwiML
**Fix:** Configure webhook as described above

#### Issue 2: "Phone number not registered"
**Cause:** Caller's number not in `diabetes_education_patients` table
**Fix:** Register the caller's number:
```bash
node server/register-diabetes-patient.js "+1CALLER_NUMBER" "First" "Last"
```

#### Issue 3: Call connects but immediate hangup
**Cause:** ElevenLabs relay failing to connect
**Fix:** Check Azure logs:
```bash
az containerapp logs show \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --tail 100
```

Look for:
- `[Relay] New Twilio connection` - Relay receiving connection
- `[Relay] Connected to ElevenLabs` - Successful connection
- `[Relay] Error` - Connection problems

## Verification Checklist

- [ ] Phone number +18324003930 exists in Twilio account
- [ ] Webhook configured: `/api/twilio/diabetes-education-inbound`
- [ ] Status webhook configured: `/api/twilio/diabetes-education-status`
- [ ] Patient phone number registered in database
- [ ] ElevenLabs agents configured (EN, ES, HI)
- [ ] ELEVENLABS_RELAY_URL set in Azure: `wss://api.tshla.ai/elevenlabs-relay`
- [ ] Azure Container App deployed with latest code

## Quick Test

Test webhook directly (simulates Twilio call):
```bash
curl -X POST "https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/twilio/diabetes-education-inbound" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "CallSid=TEST_123" \
  --data-urlencode "From=+18324003930" \
  --data-urlencode "To=+18324003930" \
  --data-urlencode "CallStatus=ringing"
```

**Expected:** Should return TwiML with `<Stream url="wss://api.tshla.ai/elevenlabs-relay">`

## Next Steps

1. **Check Twilio Account:**
   - Verify you own +18324003930
   - OR use +18324027671 which you already own

2. **Configure Webhooks:**
   - Follow Step 2 above to set webhook URLs

3. **Test:**
   - Call the number from a registered phone
   - Check Twilio logs for any errors
   - Monitor Azure logs for relay connection

---

**Need Help?**

If you continue to have issues:
1. Share screenshot of Twilio phone number configuration
2. Share recent call logs from Twilio Monitor
3. Share Azure container logs around the time of the call
