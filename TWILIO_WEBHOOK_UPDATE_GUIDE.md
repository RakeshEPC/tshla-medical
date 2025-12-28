# Twilio Webhook Update Guide
**Migration**: ElevenLabs Direct → TSHLA Medical System
**Date**: December 13, 2025
**Status**: Ready to Execute

---

## 🎯 What We're Changing

### Current Setup (Before)
```
Incoming Call → Twilio (+18324027671) → ElevenLabs API directly
                                         https://api.us.elevenlabs.io/twilio/inbound_call
```

### New Setup (After)
```
Incoming Call → Twilio (+18324027671) → TSHLA Medical API → ElevenLabs AI
                                         ↓
                                    Voicemail Detection
                                    Patient Context
                                    Database Logging
```

---

## ✅ Prerequisites Completed

All backend preparation is done:

- ✅ **GitHub Secret Added**: `ELEVENLABS_AGENT_ID`
- ✅ **Workflow Updated**: `.github/workflows/deploy-unified-container-app.yml`
- ✅ **Deployment Triggered**: Azure Container App is updating
- ✅ **Endpoint Verified**: `https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/twilio/previsit-twiml`

**Deployment Status**: Check at https://github.com/RakeshEPC/tshla-medical/actions

---

## 📋 Step-by-Step Instructions

### Step 1: Wait for Deployment to Complete (5-10 minutes)

**Check deployment status:**
```bash
gh run watch
```

OR visit: https://github.com/RakeshEPC/tshla-medical/actions

**Look for**: ✅ "Deploy Unified API to Azure Container App" - Status: Success

---

### Step 2: Verify the Endpoint is Ready

**Test the endpoint:**
```bash
curl -X POST \
  "https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/twilio/previsit-twiml"
```

**Expected response** (should include `<Stream>` tag):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://api.elevenlabs.io/v1/convai/conversation?agent_id=agent_9301k9t886rcewfr8q2qt6e5vcxn" />
  </Connect>
</Response>
```

If you see this ✅ **proceed to Step 3**

---

### Step 3: Update Twilio Webhook (2 minutes)

**Open Twilio Console:**
1. Go to: **https://console.twilio.com/us1/develop/phone-numbers/manage/incoming**
2. Log in if prompted

**Find your phone number:**
3. Click on: **+1 (832) 402-7671**

**Update Voice Configuration:**
4. Scroll down to **"Voice Configuration"** section
5. Under **"A call comes in"**:

   **Current URL (should show):**
   ```
   https://api.us.elevenlabs.io/twilio/inbound_call
   ```

   **Change to:**
   ```
   https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/twilio/previsit-twiml
   ```

   **HTTP Method:** Keep as `HTTP POST`

6. Scroll to the bottom and click **"Save configuration"**

**✅ You should see**: "Configuration updated successfully"

---

### Step 4: Test the New Configuration (5 minutes)

#### Test 1: Make a Test Call

**From your phone:**
- Call: **+1 (832) 402-7671**

**What you should experience:**
1. Phone rings and connects
2. You hear the ElevenLabs AI agent greeting you
3. Conversation proceeds normally
4. Same experience as before!

**If successful**: ✅ Proceed to Test 2

**If it doesn't work**: See Troubleshooting section below

---

#### Test 2: Verify in Twilio Console

**Check call logs:**
1. Go to: **https://console.twilio.com/us1/monitor/logs/calls**
2. You should see your recent test call
3. Click on the call SID to view details

**What to verify:**
- Status: `completed` ✅
- Duration: Shows call length
- Webhook URL: Should show your TSHLA API endpoint

---

#### Test 3: Check Azure Logs

**View Container App logs:**
```bash
az containerapp logs show \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --follow
```

**Look for:**
```
📞 TwiML Webhook Called
   Query params: ...
   Body: ...
✅ Human answered - connecting to 11Labs AI
```

---

## 🎉 Success Criteria

You've successfully migrated when:

- ✅ Test call connects to ElevenLabs AI
- ✅ Conversation works normally
- ✅ Call appears in Twilio logs
- ✅ Webhook shows TSHLA API URL
- ✅ Azure logs show webhook being called

---

## 🔄 Rollback Instructions (If Needed)

If something goes wrong, you can immediately revert:

### Quick Rollback (30 seconds)

1. Go to: **https://console.twilio.com/us1/develop/phone-numbers/manage/incoming**
2. Click on: **+1 (832) 402-7671**
3. Under **"Voice Configuration"** → **"A call comes in"**:
   - Change URL back to:
     ```
     https://api.us.elevenlabs.io/twilio/inbound_call
     ```
4. Click **"Save configuration"**

**Done!** Calls will go directly to ElevenLabs again.

---

## 🐛 Troubleshooting

### Issue: Call connects but no response

**Possible causes:**
1. Azure Container App is still deploying
2. ELEVENLABS_AGENT_ID not set correctly

**Solution:**
```bash
# Check deployment status
gh run list --workflow=deploy-unified-container-app.yml --limit 1

# Verify environment variable
az containerapp show \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --query "properties.template.containers[0].env" -o table
```

Look for: `ELEVENLABS_AGENT_ID` = `agent_9301k9t886rcewfr8q2qt6e5vcxn`

---

### Issue: Call fails immediately

**Possible causes:**
1. Wrong webhook URL
2. Network/firewall issue

**Solution:**
- Verify webhook URL is exactly:
  ```
  https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/twilio/previsit-twiml
  ```
- No trailing slash
- Uses `https://` not `http://`

---

### Issue: Voicemail message plays instead of AI

**This is actually correct!** If you called and it went to voicemail, the system detected it and left a message. This is the new voicemail detection feature working!

**To test with human:**
- Answer the call promptly when it rings
- Don't let it go to voicemail

---

## 📊 What You Gained

### New Features Now Active:

1. **Voicemail Detection** ✅
   - First attempt: Hangs up on voicemail (saves money)
   - Second/third attempt: Leaves message
   - Configured in [server/api/twilio/previsit-twiml.ts](server/api/twilio/previsit-twiml.ts#L54-79)

2. **Patient Context** ✅
   - Pass patient name to AI
   - Pass appointment date/time
   - Pass provider name
   - Makes conversations more personalized

3. **Database Logging** (Coming soon)
   - Log all calls to Supabase
   - Track attempt numbers
   - Monitor call status
   - Analytics and reporting

4. **Custom Business Logic** ✅
   - Can add hours checking
   - Can add urgency detection
   - Can add callback scheduling
   - Full control over call flow

---

## 📈 Monitoring & Analytics

### Check Call Activity

**Twilio Console:**
- Calls: https://console.twilio.com/us1/monitor/logs/calls
- Shows all incoming calls
- Click for detailed logs

**Azure Container App:**
```bash
# View real-time logs
az containerapp logs show \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --follow

# View recent logs
az containerapp logs show \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --tail 100
```

---

## 🔐 Security Notes

### Environment Variables Set

The following are now configured in Azure Container App:

- `ELEVENLABS_AGENT_ID` - Your ElevenLabs AI agent
- `ELEVENLABS_API_KEY` - Your ElevenLabs API key
- `TWILIO_ACCOUNT_SID` - Your Twilio account
- `TWILIO_AUTH_TOKEN` - Your Twilio auth
- `TWILIO_PHONE_NUMBER` - Your phone number

All stored as **secrets** in Azure (not visible in logs).

---

## 📞 Support

### If You Need Help

**Check deployment:**
```bash
gh run watch
```

**Test endpoint:**
```bash
curl -X POST https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/twilio/previsit-twiml
```

**View logs:**
```bash
az containerapp logs show --name tshla-unified-api --resource-group tshla-backend-rg --tail 50
```

**Rollback if needed:** See "Rollback Instructions" above

---

## ✅ Final Checklist

Before you're done, verify:

- [ ] Deployment completed successfully in GitHub Actions
- [ ] Endpoint returns valid TwiML (tested with curl)
- [ ] Updated webhook URL in Twilio Console
- [ ] Made test call - AI answered successfully
- [ ] Checked Twilio logs - call appears
- [ ] Checked Azure logs - webhook received

---

**Migration Date**: December 13, 2025
**Migration By**: Rakesh Patel
**Assisted By**: Claude Code

**Status**: ✅ Ready to execute once deployment completes
