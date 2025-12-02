# How to Fix the OpenAI API Key Error

## ✅ Good News
The enhanced error handling is working perfectly! You now see a clear error message:
```
🔑 OpenAI API key issue. Please check your VITE_OPENAI_API_KEY in .env file.
```

## ❌ The Problem
Your OpenAI API key (both local and in Azure) is **invalid or expired**:
```
sk-proj-NV9cxmpOqJRO8f...W-50A
```

This key is being rejected by OpenAI with a 401 Unauthorized error.

## 🔧 Solution: Update the OpenAI API Key

### Step 1: Get a New Valid OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Log in to your OpenAI account
3. Click **"Create new secret key"**
4. Give it a name like "TSHLA Medical Production"
5. Copy the key (starts with `sk-proj-...`)
   - ⚠️ **Important:** This is the ONLY time you'll see the full key!

### Step 2: Update GitHub Secret (for Azure deployments)

Run this command with your new key:

```bash
cd /Users/rakeshpatel/Desktop/tshla-medical
gh secret set VITE_OPENAI_API_KEY -b "sk-proj-YOUR_NEW_KEY_HERE"
```

Example:
```bash
gh secret set VITE_OPENAI_API_KEY -b "sk-proj-abc123xyz..."
```

### Step 3: Redeploy the Unified API

Trigger a new deployment to pick up the updated secret:

```bash
gh workflow run "Deploy Unified API to Azure Container App"
```

Wait for deployment (about 3 minutes):
```bash
gh run watch --exit-status
```

### Step 4: Update Local .env File (optional, for local testing)

If you want to test locally:

1. Open `.env` file
2. Update line 23:
   ```bash
   VITE_OPENAI_API_KEY=sk-proj-YOUR_NEW_KEY_HERE
   ```
3. Restart local dev server:
   ```bash
   ./stop-dev.sh
   ./start-dev.sh
   ```

### Step 5: Test on Production

1. Go to https://www.tshla.ai
2. Log in
3. Go to Dictation page
4. Complete a dictation
5. Click **"📞 Send Patient Summary (ECHO)"**
6. Click **"🎙️ Generate Preview"**
7. ✅ Should now work!

## 🔍 Verify the Fix

### Test the Backend API Directly

```bash
curl -X POST https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/echo/generate-preview \
  -H "Content-Type: application/json" \
  -d '{"soapNote": "Patient came in for diabetes follow-up. A1C improved from 8.5 to 7.2. Continue metformin."}'
```

**Expected Response (after fix):**
```json
{
  "success": true,
  "script": "This is a beta project from your doctor's office. You came in for...",
  "wordCount": 120,
  "estimatedSeconds": 48
}
```

**Current Response (before fix):**
```json
{
  "success": false,
  "error": "OpenAI API key is invalid or expired. Please update VITE_OPENAI_API_KEY in your .env file."
}
```

## 📊 Current Status

### GitHub Secrets (as of 2025-12-02)

| Secret | Last Updated | Status |
|--------|--------------|--------|
| `VITE_OPENAI_API_KEY` | 2025-11-17 | ❌ Invalid/Expired |
| `VITE_AZURE_OPENAI_KEY` | 2025-10-15 | ⚠️ Alternative (if available) |
| `VITE_ELEVENLABS_API_KEY` | 2025-11-17 | ✅ Working |

### Azure Container App Environment Variables

The Unified API container app has:
- ✅ `VITE_OPENAI_API_KEY` - Set but invalid
- ✅ `VITE_OPENAI_MODEL_STAGE4` - `gpt-4o-mini`
- ✅ `VITE_OPENAI_MODEL_STAGE5` - `gpt-4o`
- ✅ `VITE_OPENAI_MODEL_STAGE6` - `gpt-4o`

## 🌐 Alternative: Use Azure OpenAI (HIPAA Compliant)

If you have Azure OpenAI set up, you can switch to it instead:

### Check if Azure OpenAI is configured:

```bash
grep "VITE_AZURE_OPENAI" .env
```

You should see:
```
VITE_AZURE_OPENAI_ENDPOINT=https://tshla-openai-prod.openai.azure.com
VITE_AZURE_OPENAI_KEY=3e2582ec717e49648239c435e98397a6
VITE_AZURE_OPENAI_DEPLOYMENT=gpt-4
```

### Update Backend to Use Azure OpenAI

Edit `server/routes/echo-audio-summary.js` to use Azure OpenAI instead of OpenAI:

Change line 24:
```javascript
// FROM:
const OPENAI_API_KEY = process.env.VITE_OPENAI_API_KEY;

// TO:
const AZURE_OPENAI_KEY = process.env.VITE_AZURE_OPENAI_KEY;
const AZURE_OPENAI_ENDPOINT = process.env.VITE_AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_DEPLOYMENT = process.env.VITE_AZURE_OPENAI_DEPLOYMENT;
```

Then update the fetch call (line 61):
```javascript
// FROM:
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${OPENAI_API_KEY}`
  },

// TO:
const response = await fetch(
  `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=2024-02-01`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': AZURE_OPENAI_KEY
    },
```

**Benefits of Azure OpenAI:**
- ✅ HIPAA compliant
- ✅ Better for production medical apps
- ✅ Dedicated resources
- ✅ No rate limits (if configured)

## 💰 OpenAI Billing Check

If you keep getting 401 errors even with a new key, check:

1. **OpenAI Billing:** https://platform.openai.com/account/billing
   - Add payment method
   - Check usage limits

2. **Quota Issues:**
   - Free tier: Limited requests
   - Paid tier: Check spending limits

## 📝 Quick Commands Summary

```bash
# 1. Update GitHub secret
gh secret set VITE_OPENAI_API_KEY -b "sk-proj-YOUR_NEW_KEY"

# 2. Redeploy API
gh workflow run "Deploy Unified API to Azure Container App"

# 3. Watch deployment
gh run watch

# 4. Test API
curl -X POST https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/echo/generate-preview \
  -H "Content-Type: application/json" \
  -d '{"soapNote": "Test patient note"}'
```

## 🆘 Still Not Working?

### Check Browser Console (F12)

Look for:
```
🎙️ [Echo] Step 1: Generating AI script from SOAP note...
   API URL: https://tshla-unified-api...
   SOAP length: 150
❌ [Echo] Backend error: ...
```

### Check Azure Container App Logs

```bash
az containerapp logs show \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --follow
```

Look for:
```
❌ [Echo Preview] Error: OpenAI API error: 401...
```

### Try Azure OpenAI Instead

See the "Alternative: Use Azure OpenAI" section above.

## ✅ Success Indicators

You'll know it's fixed when:

1. ✅ No error message in the modal
2. ✅ Preview script appears in the UI
3. ✅ Audio player appears below the script
4. ✅ Browser console shows: `✅ [Echo] AI script generated`
5. ✅ Browser console shows: `✅ [Echo] Audio generated successfully`

---

**Created:** December 2, 2025
**Status:** Waiting for valid OpenAI API key
**Next Step:** Run `gh secret set VITE_OPENAI_API_KEY -b "YOUR_NEW_KEY"`
