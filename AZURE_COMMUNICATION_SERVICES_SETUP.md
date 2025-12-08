# Azure Communication Services Setup Guide

This guide will help you set up Azure Communication Services (ACS) for HIPAA-compliant patient phone calls with ElevenLabs voices.

## Why Azure Communication Services?

- ✅ **HIPAA Compliant** - Microsoft signs BAA automatically for Azure customers
- ✅ **Azure Integration** - Works seamlessly with your existing Azure infrastructure
- ✅ **No Extra BAA Needed** - Covered under your Azure BAA
- ✅ **Same Cost as Twilio** - ~$0.013/minute
- ✅ **ElevenLabs Integration** - Play custom voices in calls

---

## Step 1: Create Azure Communication Services Resource

### Via Azure Portal:

1. Go to [Azure Portal](https://portal.azure.com)
2. Click **"Create a resource"**
3. Search for **"Communication Services"**
4. Click **Create**
5. Fill in:
   - **Subscription**: Your subscription
   - **Resource Group**: `tshla-backend-rg` (or your existing RG)
   - **Resource Name**: `tshla-communication-services`
   - **Region**: `East US` (same as your other resources)
   - **Data Location**: `United States`
6. Click **Review + Create** → **Create**

### Via Azure CLI:

```bash
# Create Communication Services resource
az communication create \
  --name tshla-communication-services \
  --resource-group tshla-backend-rg \
  --location eastus \
  --data-location UnitedStates
```

---

## Step 2: Get Connection String

### Via Azure Portal:

1. Go to your Communication Services resource
2. Click **"Keys"** in the left menu
3. Copy **"Primary connection string"**

### Via Azure CLI:

```bash
az communication list-key \
  --name tshla-communication-services \
  --resource-group tshla-backend-rg \
  --query primaryConnectionString \
  --output tsv
```

Save this connection string - you'll need it for `.env`

---

## Step 3: Get a Phone Number

### Via Azure Portal:

1. In your Communication Services resource, click **"Phone numbers"**
2. Click **"Get"** → **"Get a phone number"**
3. Select:
   - **Country**: United States
   - **Number type**: Toll-free (recommended) or Geographic
   - **Capabilities**: Check **"Make calls"**
4. Search for available numbers
5. Select a number and click **Purchase**

### Via Azure CLI:

```bash
# Search for available toll-free numbers
az communication phonenumber search \
  --connection-string "YOUR_CONNECTION_STRING" \
  --phone-number-type toll-free \
  --assignment-type application \
  --capabilities calling

# Purchase the number (use the search-id from above)
az communication phonenumber purchase \
  --connection-string "YOUR_CONNECTION_STRING" \
  --search-id "YOUR_SEARCH_ID"
```

**Cost**: ~$2-5/month + $0.013/minute for calls

---

## Step 4: Create Azure Blob Storage (for Audio Files)

### Via Azure Portal:

1. Go to [Azure Portal](https://portal.azure.com)
2. Click **"Create a resource"**
3. Search for **"Storage account"**
4. Click **Create**
5. Fill in:
   - **Storage account name**: `tshlaaudiostorage` (must be globally unique)
   - **Resource Group**: `tshla-backend-rg`
   - **Region**: `East US`
   - **Performance**: Standard
   - **Redundancy**: LRS (Locally-redundant storage)
6. Click **Review + Create** → **Create**

### Via Azure CLI:

```bash
# Create storage account
az storage account create \
  --name tshlaaudiostorage \
  --resource-group tshla-backend-rg \
  --location eastus \
  --sku Standard_LRS

# Get connection string
az storage account show-connection-string \
  --name tshlaaudiostorage \
  --resource-group tshla-backend-rg \
  --output tsv
```

**Cost**: ~$0.02/GB/month (very cheap for audio files)

---

## Step 5: Create Blob Container

### Via Azure Portal:

1. Go to your Storage Account
2. Click **"Containers"** in the left menu
3. Click **"+ Container"**
4. Name: `echo-audio`
5. Public access level: **Blob** (anonymous read access for blobs)
6. Click **Create**

### Via Azure CLI:

```bash
az storage container create \
  --name echo-audio \
  --account-name tshlaaudiostorage \
  --public-access blob
```

---

## Step 6: Update Environment Variables

Add these to your `.env` file:

```bash
# Azure Communication Services (replaces Twilio)
AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING=endpoint=https://tshla-communication-services.communication.azure.com/;accesskey=YOUR_ACCESS_KEY
AZURE_COMMUNICATION_SERVICES_PHONE_NUMBER=+18005551234
AZURE_COMMUNICATION_SERVICES_CALLBACK_URL=https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/echo/acs-callback

# Azure Blob Storage (for hosting audio files)
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=tshlaaudiostorage;AccountKey=YOUR_ACCOUNT_KEY;EndpointSuffix=core.windows.net

# Clinic phone number (for call transfers)
CLINIC_PHONE_NUMBER=+18325938100

# ElevenLabs (already configured)
VITE_ELEVENLABS_API_KEY=your_existing_key
```

---

## Step 7: Update GitHub Secrets

Add these secrets to your GitHub repository for deployments:

```bash
AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING
AZURE_COMMUNICATION_SERVICES_PHONE_NUMBER
AZURE_STORAGE_CONNECTION_STRING
```

**How to add:**
1. Go to your GitHub repo
2. Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add each secret

---

## Step 8: Deploy Updated Code

The new Azure Communication Services code is in:
- `server/routes/echo-audio-summary-azure.js`

This will be automatically deployed when you:
1. Commit the changes
2. Push to GitHub
3. GitHub Actions will deploy to Azure

---

## Testing

### Test the API locally:

```bash
# Start the server
cd server
npm start

# Test preview generation
curl -X POST http://localhost:3000/api/echo/generate-preview \
  -H "Content-Type: application/json" \
  -d '{
    "soapNote": "Patient came in for annual checkup. Blood pressure 120/80. Started lisinopril 10mg daily. Follow up in 3 months."
  }'

# Test phone call (replace with your phone number)
curl -X POST http://localhost:3000/api/echo/send-audio-summary \
  -H "Content-Type: application/json" \
  -d '{
    "soapNote": "Patient came in for annual checkup...",
    "phoneNumber": "+15551234567",
    "patientName": "Test Patient",
    "voiceId": "cgSgspJ2msm6clMCkdW9"
  }'
```

---

## Troubleshooting

### Issue: "Azure Communication Services not configured"

**Solution**: Check that `AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING` is set correctly in `.env`

### Issue: "Azure Blob Storage not configured"

**Solution**: Check that `AZURE_STORAGE_CONNECTION_STRING` is set correctly in `.env`

### Issue: "Failed to upload audio"

**Solution**:
1. Verify storage account exists
2. Verify container `echo-audio` exists
3. Verify container has public blob access
4. Check connection string is correct

### Issue: "Call failed to connect"

**Solution**:
1. Verify phone number is correct format: `+1XXXXXXXXXX`
2. Verify Azure Communication Services phone number is purchased
3. Check callback URL is publicly accessible
4. Verify phone number has "Make calls" capability enabled

### Issue: "Audio not playing in call"

**Solution**:
1. Verify audio uploaded to blob storage successfully
2. Check blob URL is publicly accessible (try opening in browser)
3. Verify audio file is valid MP3 format
4. Check ElevenLabs API key is valid

---

## Cost Estimate

| Service | Cost |
|---------|------|
| Azure Communication Services Phone Number | ~$2-5/month |
| Phone Call (15-30 seconds) | ~$0.006-0.013 per call |
| Azure Blob Storage (1000 audio files) | ~$0.02/month |
| ElevenLabs (per generation) | Varies by plan |
| **Total per 100 calls/month** | **~$3-5/month** |

**Much cheaper than maintaining separate Twilio account!**

---

## HIPAA Compliance

✅ **Azure Communication Services**: HIPAA compliant, covered under Azure BAA
✅ **Azure Blob Storage**: HIPAA compliant, covered under Azure BAA
✅ **Azure OpenAI**: HIPAA compliant (already using)
⚠️ **ElevenLabs**: Need to verify HIPAA compliance or use for preview only

**Recommendation**: Keep ElevenLabs for audio generation, but verify their HIPAA compliance or use alternative voices.

---

## Next Steps

1. ✅ Create Azure Communication Services resource
2. ✅ Get phone number
3. ✅ Create Blob Storage account
4. ✅ Update environment variables
5. ✅ Deploy code
6. ✅ Test phone calls
7. ✅ Verify different voices work correctly

**Ready to deploy!** 🚀
