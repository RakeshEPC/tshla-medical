# Pre-Visit System Deployment Checklist

**Date:** November 14, 2025
**Commit:** 563a12e9
**Status:** Ready to Deploy

---

## ✅ Pre-Deployment Checklist

### Code Changes
- [x] Frontend changes committed (PreVisitDataCaptureImproved, Analytics fix, Dashboard updates)
- [x] Backend changes committed (webhook endpoints, linking services, PDF parsing)
- [x] TypeScript check passing
- [x] Production build successful
- [x] Repository cleaned up (docs archived, configs organized)

### Database Preparation
- [ ] **CRITICAL:** Run production migration SQL in Supabase
- [ ] Verify RLS policies are active
- [ ] Verify schedule matching columns added
- [ ] Test query returns all 27 calls

### Environment Variables (Azure Container App)
- [ ] `VITE_SUPABASE_URL` - Supabase project URL
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Service role key for backend
- [ ] `VITE_SUPABASE_ANON_KEY` - Anon key for frontend (not critical if using service role)
- [ ] `DEEPGRAM_API_KEY` - For transcription (if used)
- [ ] `OPENAI_API_KEY` - For PDF extraction
- [ ] All other existing env vars preserved

---

## 📋 Deployment Steps

### Step 1: Run Database Migration (DO THIS FIRST!)

**Location:** `scripts/database/PRODUCTION_MIGRATION_previsit_system.sql`

**How to run:**
1. Go to: https://supabase.com/dashboard/project/minvvjdflezibmgkplqb/sql
2. Click "New Query"
3. Copy entire contents of PRODUCTION_MIGRATION_previsit_system.sql
4. Paste and click "Run"
5. Verify success messages

**Expected Results:**
- 3 RLS policies created
- 2 columns added to provider_schedules
- 3 indexes created
- Verification query shows ~27 calls visible

**⚠️ IMPORTANT:** Do this BEFORE deploying code. Otherwise frontend will still show 0 records.

---

### Step 2: Push Code to GitHub

```bash
# Code is already committed (563a12e9), just push:
git push origin main
```

**What this triggers:**
- GitHub Actions workflow: `.github/workflows/deploy-unified-container-app.yml`
- Builds Docker image for unified-api
- Pushes to Azure Container Registry
- Deploys new revision to Azure Container App

**Monitor deployment:**
```bash
# Watch deployment status
gh run watch

# Or manually check:
az containerapp revision list \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --output table
```

---

### Step 3: Deploy Frontend (if using separate deployment)

**If you have a separate frontend deployment:**
```bash
# This depends on your frontend deployment setup
# Usually triggered automatically on push to main
# Or manually via:
npm run build
# Then deploy dist/ folder to your hosting
```

---

### Step 4: Verify Backend Deployment

**Check unified-api health:**
```bash
curl https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "service": "tshla-unified-api",
  "timestamp": "2025-11-14T...",
  "services": {
    "pump": "ok",
    "auth": "ok",
    "schedule": "ok",
    "admin": "ok",
    "websocket": "ok"
  }
}
```

**Test webhook endpoint:**
```bash
curl -X POST "https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/previsit/data/medications" \
  -H "Content-Type: application/json" \
  -d '{"conversation_id": "test_deploy", "medications": ["Test Med"]}'
```

**Expected:** `{"success":true,"stored":["Test Med"]}`

---

### Step 5: Verify Frontend

**Open these URLs in production:**

1. **Pre-Visit Data Page**
   - URL: `https://www.tshla.ai/previsit-data`
   - Should show: All 27 calls
   - Should display: Medications, concerns, questions
   - Filters should work
   - Export to CSV should work

2. **Pre-Visit Analytics**
   - URL: `https://www.tshla.ai/previsit-analytics`
   - Should show: Real metrics (not zeros)
   - Total Calls: ~27
   - Medications Captured: ~8
   - Concerns Captured: ~6
   - Questions Captured: ~5

3. **Pre-Visit Conversations**
   - URL: `https://www.tshla.ai/previsit-conversations`
   - Should show: All conversations
   - Transcripts: Will show `<REDACTED>` (expected - HIPAA compliance)
   - Structured data visible

4. **Doctor Dashboard**
   - URL: `https://www.tshla.ai/dashboard`
   - Should have: 4 quick access buttons
   - Pre-Visit Calls, Import Profiles, Analytics, Conversations

---

### Step 6: Test Complete Workflow

**Test A: ElevenLabs Webhook (Most Important)**
1. Make a test call to your ElevenLabs agent
2. During call, mention:
   - "I'm taking Metformin 500mg"
   - "I have high blood sugar"
   - "Should I adjust my dose?"
3. After call, check /previsit-data page
4. New call should appear within 60 seconds
5. Medications, concerns, questions should be captured

**Test B: Patient Profile Import**
1. Go to: `/patient-import`
2. Upload a patient progress note PDF
3. Verify AI extraction works
4. Check patient profile is created
5. If phone number matches, should link to appointments

**Test C: Schedule CSV Import**
1. Upload Athena schedule CSV
2. Verify appointments are imported
3. Check that appointments with matching phone numbers show "Pre-Visit Complete" badge
4. Click appointment → should show pre-visit data

---

## 🔍 Verification Queries

**Run these in Supabase SQL Editor to verify data:**

```sql
-- 1. Check total visible calls
SELECT COUNT(*) FROM previsit_call_data;

-- 2. Check RLS is working
-- (Run this while logged out/as anon user - should still return data)
SELECT COUNT(*) FROM previsit_call_data;

-- 3. Check recent captures
SELECT
  conversation_id,
  phone_number,
  array_length(medications, 1) as meds,
  array_length(concerns, 1) as concerns,
  created_at
FROM previsit_call_data
ORDER BY created_at DESC
LIMIT 10;

-- 4. Check schedule matching ready
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'provider_schedules'
  AND column_name IN ('previsit_call_id', 'previsit_data_captured');
```

---

## 🚨 Troubleshooting

### Frontend shows 0 calls
**Cause:** Database migration not run
**Fix:** Run PRODUCTION_MIGRATION_previsit_system.sql in Supabase

### Webhooks not capturing data
**Cause:** ElevenLabs not calling endpoints
**Fix:** Check Azure logs: `az containerapp logs show --name tshla-unified-api --resource-group tshla-backend-rg --tail 100`
**Look for:** 💊, ⚠️, ❓ emoji logs indicating webhook calls

### Analytics shows zeros
**Cause:** RLS policies not applied
**Fix:** Run Part 1 of migration SQL (RLS policies section)

### Schedule import doesn't auto-link
**Cause:** Phone number format mismatch
**Fix:** Check phone numbers are in E.164 format (+1234567890) or implement normalization

### "conversation_id undefined" in logs
**Cause:** ElevenLabs not passing conversation_id
**Fix:** In ElevenLabs tool config, ensure conversation_id is set to dynamic_variable

---

## 📊 Success Metrics

After deployment, you should see:

- **27+ total calls** in previsit_call_data
- **Real-time data capture** from new ElevenLabs calls
- **Analytics dashboard** showing real metrics
- **Auto-linking** working for patients with matching phone numbers
- **PDF import** extracting patient data successfully
- **Zero errors** in Azure Container App logs

---

## 📞 Support

**If issues occur:**

1. **Check Azure Logs:**
   ```bash
   az containerapp logs show \
     --name tshla-unified-api \
     --resource-group tshla-backend-rg \
     --tail 200
   ```

2. **Check Supabase Logs:**
   - Go to: Supabase Dashboard → Logs
   - Look for RLS policy errors or query failures

3. **Test Endpoints Directly:**
   ```bash
   # Test webhook endpoint
   curl -X POST "https://tshla-unified-api.../api/previsit/data/medications" \
     -H "Content-Type: application/json" \
     -d '{"conversation_id": "test", "medications": ["Test"]}'
   ```

4. **Rollback if Needed:**
   - Revert to previous commit
   - Run rollback SQL (bottom of migration file)

---

## ✅ Post-Deployment Sign-Off

- [ ] Database migration completed successfully
- [ ] Backend deployed and health check passing
- [ ] Frontend deployed and showing data
- [ ] Test ElevenLabs call captured successfully
- [ ] Analytics showing real metrics
- [ ] Patient import tested and working
- [ ] Schedule import tested (if applicable)
- [ ] No errors in production logs
- [ ] Documentation updated
- [ ] Team notified of new features

**Deployed by:** _________________
**Date:** _________________
**Sign-off:** _________________

---

**🎉 Congratulations! The pre-visit system is now live in production!**
