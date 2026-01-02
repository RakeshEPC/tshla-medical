# Quick Start: Fix Diabetes Phone Line (832-400-3930)

**Problem:** Phone hangs up with error message instead of connecting to AI educator

**Date:** December 30, 2025

---

## 🚀 Quick Fix (5 Minutes)

If you just want to get the system working ASAP, follow these steps:

### 1. Get Your ElevenLabs Agent IDs

1. Go to: https://elevenlabs.io/app/conversational-ai
2. Click on each agent and copy the ID from the URL
3. Save the IDs:
   - English: `agent_________________`
   - Spanish: `agent_________________`
   - Hindi: `agent_________________`

### 2. Update `.env` File

Edit `/Users/rakeshpatel/Desktop/tshla-medical/.env`:

```bash
ELEVENLABS_DIABETES_AGENT_EN=agent_YOUR_ENGLISH_ID
ELEVENLABS_DIABETES_AGENT_ES=agent_YOUR_SPANISH_ID
ELEVENLABS_DIABETES_AGENT_HI=agent_YOUR_HINDI_ID
```

### 3. Update Azure Secrets

Run this one command (requires Azure CLI):

```bash
cd /Users/rakeshpatel/Desktop/tshla-medical
./update-azure-elevenlabs-config.sh
```

Or manually:

```bash
az containerapp secret set \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --secrets \
    elevenlabs-diabetes-agent-en="agent_YOUR_ENGLISH_ID" \
    elevenlabs-diabetes-agent-es="agent_YOUR_SPANISH_ID" \
    elevenlabs-diabetes-agent-hi="agent_YOUR_HINDI_ID"
```

### 4. Wait & Test

- Wait 2-3 minutes for Azure to redeploy
- Call **832-400-3930** from **+18326073630**
- Should connect to AI educator

---

## ⚠️ Still Not Working?

### Check #1: ElevenLabs Agent Configuration

Each agent MUST have this in the system prompt:

```
{{patient_context}}
```

**Fix it:**
1. Go to: https://elevenlabs.io/app/conversational-ai
2. Click on English agent
3. Edit "System Prompt"
4. Make sure `{{patient_context}}` appears somewhere (use double braces!)
5. See [ELEVENLABS_AGENT_SETUP_INSTRUCTIONS.md](ELEVENLABS_AGENT_SETUP_INSTRUCTIONS.md) for full prompt

### Check #2: Verify Azure Secrets

```bash
az containerapp show \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --query "properties.template.containers[0].env[?starts_with(name, 'ELEVENLABS')]" \
  -o table
```

Should show:
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_DIABETES_AGENT_EN`
- `ELEVENLABS_DIABETES_AGENT_ES`
- `ELEVENLABS_DIABETES_AGENT_HI`

### Check #3: Check Azure Logs

```bash
az containerapp logs show \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --tail 50 --follow
```

Make a test call and look for error messages.

---

## 📚 Full Documentation

For detailed troubleshooting and configuration:

### **Start Here:**
1. [DIABETES_PHONE_TROUBLESHOOTING_GUIDE.md](DIABETES_PHONE_TROUBLESHOOTING_GUIDE.md) - Complete diagnostic guide

### **Configuration:**
2. [ELEVENLABS_AGENT_SETUP_INSTRUCTIONS.md](ELEVENLABS_AGENT_SETUP_INSTRUCTIONS.md) - Step-by-step agent setup
3. [ELEVENLABS_WEBHOOK_SETUP.md](ELEVENLABS_WEBHOOK_SETUP.md) - Configure transcripts

### **Testing:**
4. [test-diabetes-phone-system.sh](test-diabetes-phone-system.sh) - Automated tests
5. [update-azure-elevenlabs-config.sh](update-azure-elevenlabs-config.sh) - Update Azure

---

## 🎯 What Gets Fixed

### Before:
```
Patient calls 832-400-3930
    ↓
"We're sorry, but our diabetes educator AI is not available..."
    ↓
Call hangs up
```

### After:
```
Patient calls 832-400-3930
    ↓
"Hello! I'm your diabetes educator. What questions can I help you with?"
    ↓
AI converses using patient's actual medical data
    ↓
Transcript saved to database with AI summary
```

---

## 🔧 System Architecture

```
Twilio (832-400-3930)
    ↓
Azure Container App (tshla-unified-api)
    ├─ Authenticate caller (Supabase)
    ├─ Build patient context (medical data + clinical notes)
    └─ Connect to ElevenLabs agent with context
         ↓
ElevenLabs Conversational AI
    ├─ Receives {{patient_context}} variable
    ├─ Conducts conversation (max 10 min)
    └─ Sends transcript via webhook
         ↓
Azure saves transcript + generates AI summary
```

---

## 📞 Test Numbers

- **Diabetes Education Line:** 832-400-3930
- **Registered Test Patient:** +18326073630 (Raman Patel)

---

## ✅ Success Criteria

You'll know it's working when:

1. ✅ Call to 832-400-3930 connects to AI
2. ✅ AI greets you properly
3. ✅ AI knows your actual A1C when asked
4. ✅ AI knows your medications
5. ✅ Call transcript appears in database after call
6. ✅ AI-generated summary is created

---

## 🆘 Need Help?

1. **Check logs:** Azure logs show exactly what's failing
2. **Run tests:** `./test-diabetes-phone-system.sh`
3. **Review docs:** Start with [DIABETES_PHONE_TROUBLESHOOTING_GUIDE.md](DIABETES_PHONE_TROUBLESHOOTING_GUIDE.md)

---

## 🎬 Next Steps After Fix

Once the phone system is working:

1. **Configure webhook** for transcripts (see [ELEVENLABS_WEBHOOK_SETUP.md](ELEVENLABS_WEBHOOK_SETUP.md))
2. **Add more patients** via https://www.tshla.ai/diabetes-education
3. **Monitor calls** via database query or dashboard
4. **Update clinical notes** as needed for each patient

---

**Files Created:**
- ✅ [DIABETES_PHONE_TROUBLESHOOTING_GUIDE.md](DIABETES_PHONE_TROUBLESHOOTING_GUIDE.md) - Comprehensive troubleshooting (500+ lines)
- ✅ [ELEVENLABS_AGENT_SETUP_INSTRUCTIONS.md](ELEVENLABS_AGENT_SETUP_INSTRUCTIONS.md) - Complete agent setup (400+ lines)
- ✅ [test-diabetes-phone-system.sh](test-diabetes-phone-system.sh) - Automated diagnostic tests
- ✅ [update-azure-elevenlabs-config.sh](update-azure-elevenlabs-config.sh) - Azure configuration automation
- ✅ [QUICK_START_FIX_832_400_3930.md](QUICK_START_FIX_832_400_3930.md) - This file

**Total:** 5 new files, ~1200 lines of documentation and automation

---

**Last Updated:** December 30, 2025
