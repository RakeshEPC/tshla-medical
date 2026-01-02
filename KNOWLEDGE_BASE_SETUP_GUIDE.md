# ElevenLabs Knowledge Base Setup Guide - Multi-Patient Support

**Date:** 2026-01-01
**Status:** ✅ Code Complete - Ready for Testing
**Purpose:** Enable multiple patients to call the diabetes education line with AI retrieving their individual medical data

---

## What This Implementation Does

### The Problem We're Solving
- **Before:** AI hallucinated A1C values (saying 7.5% instead of actual 9.7%)
- **Root Cause:** ElevenLabs `{{patient_context}}` variables in prompts are NOT dynamically replaced via API
- **Solution:** Upload patient data as Knowledge Base documents that AI can search during calls

### How It Works

```
1. Patient calls +1-832-400-3930
2. System looks up patient by phone number
3. Creates KB document with patient's medical data
4. Links document to appropriate agent (EN/ES/HI)
5. Call connects - AI searches KB for patient info
6. Call ends - document is unlinked and deleted
```

---

## Key Discovery: No "Knowledge Base ID" Needed!

**Important:** ElevenLabs doesn't have a separate "Knowledge Base container". Instead:
- Documents are created directly via API
- Documents are linked to agents via `knowledge_base` array in agent config
- Each call creates a temporary document that's deleted after

**This means:**
- ❌ NO `ELEVENLABS_KB_ID` environment variable needed
- ✅ Documents link directly to agents
- ✅ Implementation is simpler than originally planned

---

## Implementation Complete ✅

### Code Changes Made

1. **KB Service** ([server/services/elevenLabsKnowledgeBase.service.js](server/services/elevenLabsKnowledgeBase.service.js))
   - `uploadPatientToKB()` - Creates document from patient data
   - `linkDocumentToAgent()` - Links document to agent (NEW)
   - `unlinkDocumentFromAgent()` - Unlinks before deletion (NEW)
   - `deletePatientFromKB()` - Removes document

2. **Inbound Handler** ([server/api/twilio/diabetes-education-inbound.js](server/api/twilio/diabetes-education-inbound.js))
   - Uploads patient data to KB before call
   - Links document to agent so it's searchable
   - Stores document ID for cleanup

3. **Cleanup Handler** ([server/api/twilio/diabetes-education-cleanup.js](server/api/twilio/diabetes-education-cleanup.js))
   - Unlinks document from agent first
   - Deletes document from KB
   - Updates call status in database

---

## Deployment Steps

### 1. Update Agent System Prompts (One-Time, 15 min)

For **each** diabetes education agent (English, Spanish, Hindi):

#### Go to ElevenLabs Dashboard
1. Navigate to [Conversational AI → Agents](https://elevenlabs.io/app/conversational-ai)
2. Select your diabetes education agent

#### Update System Prompt
Add this instruction at the top of the system prompt:

```
IMPORTANT: When patients ask about their medical information (A1C, medications, lab results),
search your knowledge base for their specific data. The knowledge base contains their current
medical records and clinical notes. Always use EXACT values from the knowledge base.

Guidelines:
1. Search knowledge base when asked about labs, meds, or recent health changes
2. State exact values: "Your A1C is 9.7%" (not approximations)
3. If data is missing from knowledge base: "I don't have that in your records"
4. Never guess or hallucinate values
```

**Save the agent.**

Repeat for all language variants (EN, ES, HI).

---

### 2. Deploy Code (10 min)

The code is already committed. Just push to trigger deployment:

```bash
cd /Users/rakeshpatel/Desktop/tshla-medical

# Push to GitHub
git push

# Monitor deployment
gh run list --limit 1
gh run watch
```

Wait for:
- ✅ Build completes
- ✅ Docker image pushed
- ✅ Azure Container App updated

---

### 3. Register Test Patients (10 min)

You need at least 2 patients to test multi-patient support.

#### Patient 1: Raman Patel (Existing)

```bash
# Register or verify existing patient
cd /Users/rakeshpatel/Desktop/tshla-medical

VITE_SUPABASE_URL="https://minvvjdflezibmgkplqb.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="your_service_key_here" \
node server/register-diabetes-patient.js "+18326073630" "Raman" "Patel"
```

Then add medical data in Supabase:

```sql
UPDATE diabetes_education_patients
SET
  medical_data = '{
    "medications": [
      {"name": "Metformin", "dose": "1000mg", "frequency": "twice daily"}
    ],
    "labs": {
      "a1c": {"value": 9.7, "date": "2025-12-15", "unit": "%"},
      "glucose_fasting": {"value": 180, "date": "2025-12-20", "unit": "mg/dL"}
    },
    "diagnoses": ["Type 2 Diabetes Mellitus"]
  }'::jsonb,
  clinical_notes = 'Patient had flu recently. Blood sugars went up. Gained 20 pounds.',
  focus_areas = '["weight loss", "sick day management"]'::jsonb
WHERE phone_number = '+18326073630';
```

#### Patient 2: Test User

```bash
# Register second patient (use a different phone number you have access to)
VITE_SUPABASE_URL="https://minvvjdflezibmgkplqb.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="your_service_key_here" \
node server/register-diabetes-patient.js "+1XXXXXXXXXX" "Jane" "Smith"
```

Add different medical data for Patient 2:

```sql
UPDATE diabetes_education_patients
SET
  medical_data = '{
    "medications": [
      {"name": "Insulin glargine", "dose": "15 units", "frequency": "bedtime"}
    ],
    "labs": {
      "a1c": {"value": 6.5, "date": "2025-12-10", "unit": "%"}
    },
    "diagnoses": ["Type 1 Diabetes"]
  }'::jsonb,
  clinical_notes = 'Excellent control. Very compliant with insulin regimen.',
  focus_areas = '["insulin timing", "hypoglycemia awareness"]'::jsonb
WHERE phone_number = '+1XXXXXXXXXX';
```

---

### 4. Testing (20 min)

#### Test 1: Patient 1 Call

1. Call **+1-832-400-3930** from **+1-832-607-3630** (Raman's phone)
2. When AI answers, ask: **"What's my A1C?"**
3. **Expected:** AI says **"Your A1C is 9.7%"**
4. Ask: **"What are my medications?"**
5. **Expected:** AI says **"Metformin 1000mg twice daily"**
6. Ask: **"What should I focus on?"**
7. **Expected:** AI mentions **"weight loss" and "sick day management"**

#### Test 2: Patient 2 Call

1. Call **+1-832-400-3930** from Patient 2's phone
2. Ask: **"What's my A1C?"**
3. **Expected:** AI says **"Your A1C is 6.5%"** (NOT 9.7% from Patient 1!)
4. Ask: **"What are my medications?"**
5. **Expected:** AI says **"Insulin glargine 15 units at bedtime"**

#### Test 3: Verify Cleanup

After ending a call, check Azure Container App logs:

```bash
# View recent logs
az containerapp logs show \
  --name tshla-unified-api \
  --resource-group tshla-medical-rg \
  --follow

# Look for:
# ✅ [KB Service] 🔗 Linking KB document to agent
# ✅ [KB Service] Document linked to agent successfully
# ✅ [DiabetesEdu Cleanup] 🔓 Unlinking document from agent
# ✅ [DiabetesEdu Cleanup] Document unlinked from agent
# ✅ [DiabetesEdu Cleanup] KB document deleted successfully
```

---

## Verification Checklist

After deployment:

- [ ] Deployment succeeded (no errors in GitHub Actions)
- [ ] Agent system prompts updated to reference knowledge base
- [ ] At least 2 test patients registered with different medical data
- [ ] Patient 1 calls and AI states correct A1C (9.7%)
- [ ] Patient 2 calls and AI states correct A1C (6.5%, NOT 9.7%)
- [ ] No cross-patient data leakage
- [ ] KB documents are created (check logs: "Uploading patient data to KB")
- [ ] KB documents are linked to agent (check logs: "Document linked to agent")
- [ ] KB documents are deleted after calls (check logs: "KB document deleted")
- [ ] No orphaned documents accumulating

---

## How to Check Agent's Knowledge Base (For Debugging)

You can inspect an agent's current knowledge base documents:

```bash
# Get agent config
curl -X GET \
  "https://api.elevenlabs.io/v1/convai/agents/YOUR_AGENT_ID" \
  -H "xi-api-key: YOUR_API_KEY"

# Look for "knowledge_base" array in response:
# "knowledge_base": ["doc_abc123"]  <- Should have patient document during call
# "knowledge_base": []              <- Should be empty after call cleanup
```

---

## Troubleshooting

### Issue: AI Still Says Wrong A1C

**Possible causes:**
1. Agent prompt doesn't instruct AI to search knowledge base
2. Document not linked to agent (check logs)
3. Document upload failed (check logs)

**Solutions:**
```bash
# Check logs for KB operations
grep "Uploading patient data to Knowledge Base" logs
grep "Document linked to agent" logs

# Verify agent prompt includes KB search instruction
# → ElevenLabs dashboard → Agent → System Prompt
```

### Issue: Patient 2 Gets Patient 1's Data

**This indicates document cleanup failed!**

**Check:**
```bash
# List all KB documents
curl -X GET \
  "https://api.elevenlabs.io/v1/convai/knowledge-base" \
  -H "xi-api-key: YOUR_API_KEY"

# Should return empty array or very few recent documents
# If many documents exist → cleanup not working
```

**Fix:**
```bash
# Run manual cleanup
cd /Users/rakeshpatel/Desktop/tshla-medical
node server/jobs/cleanup-kb-documents.js

# Check cleanup endpoint is accessible
curl -X POST \
  "https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/twilio/diabetes-education-cleanup" \
  -H "Content-Type: application/json" \
  -d '{"CallSid": "test123"}'
```

### Issue: "KB Service API key not configured"

**Check environment variables:**
```bash
# In Azure Container App
az containerapp show \
  --name tshla-unified-api \
  --resource-group tshla-medical-rg \
  --query "properties.configuration.secrets" \
  -o table

# Should see ELEVENLABS_API_KEY or VITE_ELEVENLABS_API_KEY
```

---

## Maintenance

### Daily Cleanup Job (Optional but Recommended)

Set up a cron job or Azure Function to run daily cleanup for orphaned documents:

```bash
# Add to crontab (if running on VM)
0 2 * * * cd /path/to/tshla-medical && node server/jobs/cleanup-kb-documents.js >> /var/log/kb-cleanup.log 2>&1
```

Or create Azure Function Timer Trigger:
- Schedule: `0 0 2 * * *` (2 AM daily)
- Code: Call `server/jobs/cleanup-kb-documents.js`

---

## Success Metrics

After deployment, you should observe:

✅ **Primary Goal:** Each patient hears their own correct data
✅ **Data Isolation:** No cross-patient information leakage
✅ **Cleanup Working:** Documents deleted after each call
✅ **Scalability:** Works for unlimited number of patients
✅ **No Hallucinations:** AI uses exact values from records

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────┐
│                     Patient Calls                        │
│                  +1-832-400-3930                         │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│         Lookup Patient by Phone Number                  │
│         (diabetes_education_patients table)              │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│   Create KB Document (patient_18326073630_CA123...)     │
│   POST /v1/convai/knowledge-base                        │
│   Body: { name: "Raman Patel", text: "A1C 9.7..." }    │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│        Link Document to Agent                           │
│        PATCH /v1/convai/agents/{agent_id}               │
│        Body: { knowledge_base: [doc_id] }               │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Call Connects to Agent                      │
│   AI can now search knowledge_base for patient data     │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                 Call Ends → Cleanup                      │
│   1. Unlink document from agent                         │
│   2. Delete document from KB                            │
│   3. Update call status in database                     │
└─────────────────────────────────────────────────────────┘
```

---

## Next Steps

1. **Deploy** code (push to GitHub)
2. **Update** agent prompts (add KB search instruction)
3. **Register** 2+ test patients with different medical data
4. **Test** calls from each patient
5. **Verify** each hears their own correct data
6. **Monitor** logs for successful KB operations
7. **Set up** daily cleanup job (optional)

---

**Implementation Status:** ✅ Complete
**Testing Required:** Yes - Multi-patient validation
**Deployment Risk:** Low - Degrades gracefully if KB fails

---

For issues or questions, check logs and refer to troubleshooting section above.
