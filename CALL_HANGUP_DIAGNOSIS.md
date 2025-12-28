# Call Hangup Diagnosis - Immediate Action Required

**Issue**: When calling +1 (832) 402-7671, the call doesn't ring at all
**Status**: 🔴 CRITICAL - Need to check Twilio Console

---

## 🔍 What We Know

### ✅ Endpoint is Working
The TSHLA API endpoint is responding correctly:
```bash
curl -X POST https://tshla-unified-api.../api/twilio/previsit-twiml
```

**Returns valid TwiML:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://api.elevenlabs.io/v1/convai/conversation?agent_id=agent_9301k9t886rcewfr8q2qt6e5vcxn..." />
  </Connect>
</Response>
```
✅ This is correct TwiML format!

### 🔴 Problem: Call Doesn't Ring

When you call, it doesn't ring at all - this means Twilio is rejecting the call **before** it reaches your phone.

---

## 🎯 Immediate Diagnostic Steps

### Step 1: Check Twilio Error Logs (DO THIS NOW)

1. Go to: **https://console.twilio.com/us1/monitor/logs/errors**
2. Look for recent errors (last 5 minutes)
3. Check what error code is showing

**Common Error Codes:**
- **11200**: HTTP retrieval failure (can't reach webhook)
- **11205**: HTTP connection failure
- **12100**: Document parse failure (invalid TwiML)
- **13227**: Stream connection failed

### Step 2: Check Recent Call Logs

1. Go to: **https://console.twilio.com/us1/monitor/logs/calls**
2. Find your recent call attempt
3. Click on the Call SID
4. Look for:
   - Call status
   - Error messages
   - Webhook requests/responses

---

## 🔧 Possible Causes & Solutions

### Cause 1: Webhook URL Typo

**Check**: Did you copy the URL exactly?

**Correct URL:**
```
https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/twilio/previsit-twiml
```

**Common mistakes:**
- ❌ Extra space at end
- ❌ Missing `/api/twilio/previsit-twiml`
- ❌ Using `http://` instead of `https://`
- ❌ Trailing slash: `.../previsit-twiml/`

**Solution**: Go to Twilio Console and verify the exact URL

---

### Cause 2: Twilio Can't Reach Endpoint

**Check**: Is Azure Container App accessible?

**Test:**
```bash
curl -I https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/health
```

Expected: `HTTP/2 200`

If this fails, Azure Container App might be down.

---

### Cause 3: Phone Number Configuration Issue

**Check**: Voice configuration settings

Go to Twilio Console → Phone Numbers → +18324027671

**Verify:**
- [ ] "A call comes in" is set to "Webhook"
- [ ] HTTP Method is "POST" (not GET)
- [ ] URL is exactly correct
- [ ] "Primary handler fails" is configured (optional)

---

### Cause 4: Account/Billing Issue

**Check**: Twilio account status

Go to: https://console.twilio.com/us1/billing/manage-billing/billing-overview

**Look for:**
- Suspended account
- Payment failed
- Service restriction

---

## 🚨 Quick Fix: Revert to Working Configuration

If you need calls working immediately:

### Temporary Rollback (30 seconds)

1. Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
2. Click: +1 (832) 402-7671
3. Under "A call comes in", change back to:
   ```
   https://api.us.elevenlabs.io/twilio/inbound_call
   ```
4. Save

This will restore the old working configuration while we debug.

---

## 📋 Information I Need From You

Please check Twilio Console and tell me:

### From Error Logs:
- **Error Code**: (e.g., 11200, 12100, etc.)
- **Error Message**: What does it say?
- **Timestamp**: When did it occur?

### From Call Logs:
- **Call SID**: The unique identifier
- **Call Status**: (e.g., failed, busy, no-answer)
- **Error Code**: Any error associated with the call

### From Phone Number Config:
- **Current Webhook URL**: Exactly what's shown
- **HTTP Method**: POST or GET?
- **Any warnings/errors**: Red text or warnings?

---

## 🔍 What to Look For in Twilio Console

### Error Log Examples:

**If you see Error 11200:**
```
HTTP retrieval failure
Unable to fetch: https://tshla-unified-api...
```
→ Twilio can't reach the endpoint

**If you see Error 12100:**
```
Document parse failure
Invalid XML
```
→ TwiML response is malformed

**If you see Error 13227:**
```
WebSocket connection failed
Stream URL unreachable
```
→ ElevenLabs WebSocket URL issue

---

## ⚡ Quick Test Commands

### Test 1: Can Twilio reach our endpoint?
```bash
curl -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "CallSid=TEST" \
  "https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/twilio/previsit-twiml"
```
Should return XML starting with `<?xml version...`

### Test 2: Is the endpoint publicly accessible?
```bash
curl -I https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/health
```
Should return `HTTP/2 200`

### Test 3: Check Azure Container App status
```bash
az containerapp show \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --query "properties.runningStatus" -o tsv
```
Should return `Running`

---

## 🎯 Most Likely Causes (In Order)

1. **Webhook URL has a typo** (90% chance)
   - Extra space, wrong path, http vs https

2. **HTTP Method set to GET instead of POST** (5% chance)
   - Twilio sending GET, endpoint expects POST

3. **Azure firewall/security issue** (3% chance)
   - Twilio IP blocked from accessing endpoint

4. **Twilio account issue** (2% chance)
   - Billing, suspension, etc.

---

## 📞 Next Steps

1. **Check Twilio Error Logs** → Get error code
2. **Check Twilio Call Logs** → Get call details
3. **Verify webhook URL** → Character by character
4. **Report back** → Tell me what you find

**OR**

**Rollback temporarily** → Use old ElevenLabs URL while we debug

---

**Report Created**: 2025-12-13 09:20 CST
**Priority**: 🔴 CRITICAL
**Action Required**: Check Twilio Console immediately
