# ElevenLabs Knowledge Base Implementation Guide
## Diabetes Education Dynamic Patient Data

**Date:** 2026-01-01
**Status:** ✅ Code Complete - Ready for Deployment
**Issue Fixed:** AI hallucinating A1C values (saying 7.5% or 8.7% instead of actual 9.7%)

---

## What Was Implemented

### Problem
- AI was saying incorrect A1C values during calls
- Variables like `{{patient_context}}` in ElevenLabs agent prompts are **not dynamically replaced** via API
- The `conversation_initiation_client_data` parameter we were sending was being ignored

### Solution
- Implemented ElevenLabs **Knowledge Base** integration
- Patient medical data is uploaded to KB **before each call**
- AI searches KB during conversation to get accurate data
- Data is **deleted from KB after call** ends (cleanup)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Patient calls +1-832-400-3930                            │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Twilio webhook → diabetes-education-inbound.js          │
│    - Lookup patient in database                            │
│    - Build patient context (A1c, meds, notes)              │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Upload to ElevenLabs Knowledge Base                      │
│    POST /v1/knowledge-bases/{kb_id}/documents              │
│    {                                                         │
│      "document_id": "patient_18326073630_CA123...",         │
│      "content": "A1c is 9.7. gained 20 pounds..."          │
│    }                                                         │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Connect call to ElevenLabs Agent                         │
│    Agent has access to Knowledge Base                       │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. AI Conversation                                           │
│    Patient: "What's my A1C?"                                │
│    AI: *searches Knowledge Base*                            │
│    AI: "Your A1C is 9.7%"  ← CORRECT VALUE!                │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. Call Ends → Cleanup Webhook                              │
│    POST /api/twilio/diabetes-education-cleanup             │
│    - Delete document from Knowledge Base                    │
│    - Update call status to 'completed'                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Files Created

### New Files (5)

1. **`server/services/elevenLabsKnowledgeBase.service.js`**
   - Core Knowledge Base operations
   - Functions: `uploadPatientToKB()`, `deletePatientFromKB()`, `cleanupOldDocuments()`

2. **`server/api/twilio/diabetes-education-cleanup.js`**
   - Webhook handler for call cleanup
   - Removes patient data from KB after call ends

3. **`server/jobs/cleanup-kb-documents.js`**
   - Daily cleanup job for orphaned documents
   - Safety mechanism for failed cleanups

4. **`database/migrations/008_add_kb_document_id_diabetes_calls.sql`**
   - Adds `kb_document_id` column to `diabetes_education_calls` table
   - Stores document ID for cleanup

5. **`KNOWLEDGE_BASE_IMPLEMENTATION_GUIDE.md`** (this file)
   - Complete documentation and deployment guide

### Modified Files (3)

1. **`server/api/twilio/diabetes-education-inbound.js`**
   - Added KB upload before connecting call
   - Stores `kb_document_id` in database

2. **`server/unified-api.js`**
   - Registered cleanup endpoint: `/api/twilio/diabetes-education-cleanup`

3. **`.env.example`**
   - Documented `ELEVENLABS_KB_ID` variable

---

## Deployment Steps

### Phase 1: One-Time Manual Setup (30 minutes)

#### Step 1.1: Create Knowledge Base in ElevenLabs

1. Go to https://elevenlabs.io/
2. Log in to your account
3. Navigate to **Knowledge Bases** → **Create New**
4. Settings:
   - **Name:** `Diabetes Patient Data`
   - **Description:** `Current patient medical information for diabetes education calls`
5. Click **Create**
6. **Copy the Knowledge Base ID** (looks like `kb_abc123xyz`)

#### Step 1.2: Link Knowledge Base to Agents

For each language agent (English, Spanish, Hindi if applicable):

1. Go to **Conversational AI** → **Agents**
2. Select the diabetes education agent
3. Go to **Settings** → **Knowledge Base**
4. Link to "Diabetes Patient Data" knowledge base
5. Enable "**Search knowledge base for answers**"
6. Click **Save**

#### Step 1.3: Update Agent Prompts

Update the system prompt for each agent:

**Find this line:**
```
2. When asked about lab values, state them directly using the EXACT values from PATIENT INFORMATION above
```

**Change to:**
```
2. When asked about lab values, search the knowledge base and state them directly using the EXACT values found
```

**Optional: Add at the top of prompt:**
```
IMPORTANT: You have access to a knowledge base containing this patient's current medical information. Always search the knowledge base when answering questions about their:
- Lab values (A1C, glucose, etc.)
- Medications
- Recent health changes
- Clinical notes
```

#### Step 1.4: Add GitHub Secret

1. Go to your GitHub repository
2. Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `ELEVENLABS_KB_ID`
5. Value: (paste the KB ID from Step 1.1)
6. Click "Add secret"

---

### Phase 2: Run Database Migration (5 minutes)

Connect to your Supabase database and run:

```sql
-- Run migration 008
\i database/migrations/008_add_kb_document_id_diabetes_calls.sql
```

Or via Supabase dashboard:
1. Go to https://supabase.com/dashboard
2. Select your project
3. SQL Editor → New Query
4. Paste contents of `008_add_kb_document_id_diabetes_calls.sql`
5. Run

Verify:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'diabetes_education_calls'
  AND column_name = 'kb_document_id';
```

Should return:
```
 column_name   | data_type
---------------+-----------
 kb_document_id | character varying
```

---

### Phase 3: Deploy Code (10 minutes)

#### Step 3.1: Commit Changes

```bash
git add server/services/elevenLabsKnowledgeBase.service.js
git add server/api/twilio/diabetes-education-cleanup.js
git add server/api/twilio/diabetes-education-inbound.js
git add server/unified-api.js
git add server/jobs/cleanup-kb-documents.js
git add database/migrations/008_add_kb_document_id_diabetes_calls.sql
git add .env.example
git add KNOWLEDGE_BASE_IMPLEMENTATION_GUIDE.md

git commit -m "Implement ElevenLabs Knowledge Base for dynamic patient data

Fixes issue where AI hallucinated A1C values instead of using actual patient data.

Changes:
- Created KB service for upload/delete operations
- Added KB upload before each call
- Created cleanup webhook handler
- Added daily cleanup job for orphaned documents
- Added kb_document_id column to diabetes_education_calls table

How it works:
1. Patient calls → system uploads data to KB
2. AI searches KB during conversation
3. Call ends → system deletes data from KB

New environment variable required:
- ELEVENLABS_KB_ID (already added to GitHub Secrets)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

#### Step 3.2: Push to GitHub

```bash
git push
```

This will trigger GitHub Actions deployment.

#### Step 3.3: Monitor Deployment

```bash
gh run list --limit 1
gh run watch <run_id>
```

Wait for:
- ✅ Build completes
- ✅ Docker image pushed
- ✅ Azure Container App updated

---

### Phase 4: Configure ElevenLabs Webhook (5 minutes)

#### Step 4.1: Get Webhook URL

Your cleanup webhook URL:
```
https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/twilio/diabetes-education-cleanup
```

#### Step 4.2: Add to ElevenLabs Dashboard

1. Go to https://elevenlabs.io/
2. Navigate to **Conversational AI** → **Agents**
3. Select your diabetes education agent
4. Go to **Webhooks** or **Settings**
5. Add webhook:
   - **URL:** (paste from above)
   - **Events:** `conversation.completed` or `call.ended`
   - **Method:** POST
6. Click **Save**

**Note:** If ElevenLabs doesn't have webhook configuration in agent settings, the cleanup will run via Twilio status callbacks (already configured).

---

### Phase 5: Testing (15 minutes)

#### Test 1: Verify KB Upload

```bash
# SSH into Azure Container App or check logs
gh run list --limit 1
gh run view <run_id> --log

# Look for these log messages:
# ✅ [DiabetesEdu] 📤 Uploading patient data to Knowledge Base...
# ✅ [DiabetesEdu] Patient data uploaded to KB: patient_18326073630_CA123...
```

#### Test 2: Make Test Call

1. Call +1-832-400-3930 from +1-832-607-3630 (Raman Patel's number)
2. When AI answers, ask: **"What's my A1C?"**
3. **Expected:** AI should say **"Your A1C is 9.7%"** (not 7.5% or 8.7%)
4. Verify AI also mentions:
   - Weight gain (20 pounds)
   - Recent flu
   - Focus areas (weight loss, sick day management)

#### Test 3: Verify KB Cleanup

After ending the call, check logs:

```bash
# Look for:
# ✅ [DiabetesEdu Cleanup] KB document deleted successfully
# ✅ [DiabetesEdu Cleanup] Call status updated to completed
```

#### Test 4: Query KB Directly (Optional)

```bash
curl -X GET \
  "https://api.elevenlabs.io/v1/knowledge-bases/{YOUR_KB_ID}/documents" \
  -H "xi-api-key: YOUR_API_KEY"
```

Should return empty list (all documents cleaned up).

---

## Verification Checklist

After deployment, verify:

- [ ] Knowledge Base created in ElevenLabs
- [ ] Agents linked to Knowledge Base
- [ ] Agent prompts updated to reference KB
- [ ] GitHub Secret `ELEVENLABS_KB_ID` added
- [ ] Database migration 008 ran successfully
- [ ] Code deployed to Azure
- [ ] Webhook configured in ElevenLabs (if applicable)
- [ ] Test call succeeds
- [ ] AI says correct A1C value (9.7%)
- [ ] KB upload logged in server logs
- [ ] KB cleanup logged after call ends
- [ ] No orphaned documents in KB

---

## Troubleshooting

### Issue: AI still says wrong A1C

**Possible causes:**
1. Knowledge Base not linked to agent
2. Agent prompt not updated to search KB
3. KB upload failed (check logs)

**Solutions:**
```bash
# Check logs for KB upload
grep "Uploading patient data to Knowledge Base" /path/to/logs

# Verify KB ID is set
echo $ELEVENLABS_KB_ID

# Test KB service directly
node -e "
const kb = require('./server/services/elevenLabsKnowledgeBase.service');
kb.listKBDocuments().then(docs => console.log(docs));
"
```

### Issue: KB documents not deleted

**Check:**
1. Webhook URL configured correctly in ElevenLabs
2. Cleanup endpoint is accessible
3. Server logs for cleanup errors

**Manual cleanup:**
```bash
node server/jobs/cleanup-kb-documents.js
```

### Issue: Environment variable not set

**Azure Container App:**
```bash
az containerapp show \
  --name tshla-unified-api \
  --resource-group tshla-medical-rg \
  --query "properties.configuration.secrets" \
  -o table

# If missing, add:
az containerapp update \
  --name tshla-unified-api \
  --resource-group tshla-medical-rg \
  --set-env-vars ELEVENLABS_KB_ID=kb_your_id_here
```

---

## Maintenance

### Daily Cleanup Job

Set up a daily cron job to remove orphaned documents:

```bash
# Add to crontab
0 2 * * * cd /path/to/tshla-medical && node server/jobs/cleanup-kb-documents.js >> /var/log/kb-cleanup.log 2>&1
```

Or run manually as needed:
```bash
node server/jobs/cleanup-kb-documents.js
```

### Monitoring

Check logs regularly for:
- KB upload failures
- Cleanup failures
- Orphaned document count

```bash
# Check for errors
grep "KB upload failed" /path/to/logs

# Check orphaned documents
grep "Found .* documents in KB" /path/to/logs
```

---

## Rollback Plan

If implementation fails:

### Option 1: Disable KB (Quick)

Remove environment variable:
```bash
unset ELEVENLABS_KB_ID
```

Code will skip KB operations gracefully.

### Option 2: Revert Code

```bash
git revert HEAD
git push
```

### Option 3: Hardcode Data (Temporary)

Update ElevenLabs agent prompt to include Raman's data:
```
PATIENT: Raman Patel
A1C: 9.7%
Weight: Gained 20 pounds
Recent: Had flu, sugars went up
Focus: Weight loss, sick day management
```

---

## Success Metrics

After deployment, you should see:

✅ **Primary Goal:** AI says "Your A1C is 9.7%" (correct value)
✅ **Scalability:** Works for all patients without manual config
✅ **Cleanup:** No orphaned documents in KB
✅ **Reliability:** KB upload failures don't block calls
✅ **Privacy:** Patient data deleted from KB after calls

---

## Next Steps

1. **Monitor first week:** Check logs daily for issues
2. **Update other patients:** Add more patients to test scalability
3. **Consider automation:** Set up daily cleanup cron job
4. **Document learnings:** Note any edge cases encountered
5. **Alternative approach:** If KB proves unreliable, consider switching to Custom Tools (Option 3)

---

## Support

If issues persist:
- Check ElevenLabs documentation: https://elevenlabs.io/docs
- Review server logs for detailed error messages
- Contact ElevenLabs support for webhook/KB issues
- File issue in GitHub repo

---

**Implementation Complete!** 🎉
**Next Action:** Follow Phase 1 (Manual Setup) to create Knowledge Base in ElevenLabs dashboard.
