# ✅ Pre-Visit System - Ready to Deploy

**Date:** November 14, 2025
**Status:** All code committed and ready for production deployment

---

## 🎯 What You Have Now

### Working System (Local)
- ✅ 27 real pre-visit calls captured from ElevenLabs
- ✅ ElevenLabs webhook tools configured and working
- ✅ Real-time data capture (medications, concerns, questions)
- ✅ Patient profile PDF import with AI extraction
- ✅ Phone number auto-linking for calls and profiles
- ✅ RLS policies fixed (data now visible to frontend)
- ✅ Analytics showing real metrics
- ✅ Schedule matching columns ready

### Code Changes (Committed)
- **Commit:** `563a12e9`
- **Message:** "Add pre-visit call system with ElevenLabs integration"
- **Files Changed:** 61 files, 13,073 insertions
- **Build Status:** ✅ Passing (TypeScript check + production build)

---

## 📦 What's Included in This Deployment

### Frontend Features
1. **PreVisitDataCaptureImproved** - View all pre-visit calls with filters, search, export
2. **PreVisitAnalyticsDashboard** - Real-time metrics and trends
3. **PreVisitConversations** - List of all ElevenLabs conversations
4. **PatientDataImport** - Upload patient PDFs, AI extracts data, auto-links
5. **DoctorDashboard** - Quick access buttons to all pre-visit features

### Backend Features
1. **Webhook endpoints** - `/api/previsit/data/{medications,concerns,questions}`
2. **previsitLinking service** - Auto-match calls to appointments by phone
3. **profileLinking service** - Auto-match patient profiles to appointments
4. **PDF parser** - Extract text from patient progress notes
5. **AI extraction** - OpenAI extracts structured data from PDFs
6. **Question generator** - Condition-adaptive pre-visit questions

### Database Changes
1. **RLS policies** - Make previsit_call_data visible to frontend
2. **Schedule matching** - Add previsit_call_id to provider_schedules
3. **Indexes** - Phone number matching performance

---

## ⚠️ CRITICAL: Before Deploying

### 1. Run Database Migration SQL (REQUIRED)

**File:** `scripts/database/PRODUCTION_MIGRATION_previsit_system.sql`

**Where:** Supabase SQL Editor → https://supabase.com/dashboard/project/minvvjdflezibmgkplqb/sql

**Why:** Without this, frontend will show 0 records even though data exists

**What it does:**
- Adds RLS policies to allow frontend to read previsit_call_data
- Adds columns to provider_schedules for schedule matching
- Creates indexes for phone number matching

**How long:** ~30 seconds

**Verification:**
```sql
SELECT COUNT(*) FROM previsit_call_data;
-- Should return: 27 (or more)
```

---

### 2. Verify Environment Variables

**Already set in Azure Container App:**
- ✅ `VITE_SUPABASE_URL`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`
- ✅ `VITE_SUPABASE_ANON_KEY`
- ✅ `VITE_OPENAI_API_KEY`
- ✅ `DEEPGRAM_API_KEY`
- ✅ `ELEVENLABS_API_KEY`
- ✅ `ELEVENLABS_AGENT_ID`
- ✅ All other required vars

**No changes needed** - all environment variables are already configured correctly.

---

## 🚀 Deployment Steps

### Step 1: Run Database Migration (Do This First!)

```bash
# Go to Supabase SQL Editor:
# https://supabase.com/dashboard/project/minvvjdflezibmgkplqb/sql

# Copy and paste entire contents of:
scripts/database/PRODUCTION_MIGRATION_previsit_system.sql

# Click "Run"

# Verify success (should see ~27 records):
SELECT COUNT(*) FROM previsit_call_data;
```

---

### Step 2: Push Code to Production

```bash
# Code is already committed, just push:
git push origin main
```

**This triggers:**
- GitHub Actions workflow builds Docker image
- Pushes to Azure Container Registry
- Deploys new revision to `tshla-unified-api`
- Takes ~3-5 minutes

**Monitor:**
```bash
# Watch GitHub Actions
gh run watch

# Or check Azure
az containerapp revision list \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --output table
```

---

### Step 3: Verify Deployment

**Test backend health:**
```bash
curl https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/health
```

**Test webhook endpoint:**
```bash
curl -X POST "https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/previsit/data/medications" \
  -H "Content-Type: application/json" \
  -d '{"conversation_id": "test_prod", "medications": ["Test Med"]}'
```

**Expected:** `{"success":true,"stored":["Test Med"]}`

---

### Step 4: Test Frontend Pages

1. **Pre-Visit Data:** https://www.tshla.ai/previsit-data
   - Should show 27+ calls
   - Filters should work
   - Export CSV should work

2. **Analytics:** https://www.tshla.ai/previsit-analytics
   - Should show real numbers (not zeros)
   - Total Calls: ~27
   - Charts visible

3. **Dashboard:** https://www.tshla.ai/dashboard
   - 4 quick access buttons visible
   - Clicking each button navigates correctly

---

### Step 5: Test End-to-End

**Make a test ElevenLabs call:**
1. Call your ElevenLabs agent phone number
2. During call mention:
   - "I'm taking Metformin 500mg"
   - "I have high blood sugar"
   - "Should I adjust my dose?"
3. Wait 60 seconds after call ends
4. Check https://www.tshla.ai/previsit-data
5. New call should appear with captured data

---

## 📊 Expected Results After Deployment

### Immediate (within 5 minutes)
- ✅ Backend health check returns healthy
- ✅ Webhook endpoints respond with success
- ✅ Frontend pages load without errors
- ✅ Pre-Visit Data page shows all 27 calls
- ✅ Analytics shows real metrics

### After First Real Call (within 1 hour)
- ✅ New ElevenLabs call appears in database
- ✅ Medications/concerns/questions captured
- ✅ Data visible on Pre-Visit Data page
- ✅ Analytics updates with new call

### After Schedule Import (when you do it)
- ✅ Appointments auto-link to calls by phone number
- ✅ "Pre-Visit Complete" badges appear
- ✅ Clicking appointment shows pre-visit data

---

## 🔧 If Something Goes Wrong

### Frontend still shows 0 calls
**Cause:** Database migration not run
**Fix:** Run `PRODUCTION_MIGRATION_previsit_system.sql` in Supabase
**Verify:** `SELECT COUNT(*) FROM previsit_call_data;` returns >0

### Webhooks not working
**Cause:** ElevenLabs not calling production endpoints
**Fix:** Check Azure logs for webhook calls (look for 💊 ⚠️ ❓ emojis)
**Command:**
```bash
az containerapp logs show \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --tail 100 \
  | grep -E "(💊|⚠️|❓|Storing)"
```

### Analytics shows zeros
**Cause:** RLS policies not applied
**Fix:** Run Part 1 of migration SQL (RLS section only)

### Build fails
**Cause:** Unexpected - build passed locally
**Fix:** Check GitHub Actions logs for specific error
**Rollback:** `git revert 563a12e9 && git push`

---

## 📁 Important Files Reference

### Database
- `scripts/database/PRODUCTION_MIGRATION_previsit_system.sql` - **Run this first!**

### Deployment
- `DEPLOYMENT_CHECKLIST.md` - Full step-by-step deployment guide
- `READY_TO_DEPLOY.md` - This file (quick reference)

### Configuration
- `config/elevenlabs-tools/` - ElevenLabs webhook tool configs
- `.github/workflows/deploy-unified-container-app.yml` - Auto-deployment workflow

### Documentation (Archived)
- `docs/archive/previsit-old-docs/` - Old development docs
- `docs/archive/` - Other archived documentation

---

## ✅ Pre-Flight Checklist

Before you push to production, verify:

- [x] Database migration SQL ready to run
- [x] Code committed (563a12e9)
- [x] TypeScript check passing
- [x] Production build successful
- [x] Environment variables verified in Azure
- [ ] **Database migration run in Supabase** ← DO THIS FIRST!
- [ ] Code pushed to main branch
- [ ] Deployment monitored and successful
- [ ] Frontend pages tested
- [ ] Test ElevenLabs call made

---

## 🎉 Success Criteria

Your deployment is successful when:

1. ✅ Pre-Visit Data page shows all calls (27+)
2. ✅ Analytics dashboard shows real metrics
3. ✅ Test ElevenLabs call captures data in real-time
4. ✅ Patient PDF import works
5. ✅ No errors in Azure logs
6. ✅ All 4 quick access buttons work on dashboard

---

## 💡 Quick Commands

```bash
# 1. Push to production
git push origin main

# 2. Watch deployment
gh run watch

# 3. Check health
curl https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/health

# 4. View logs
az containerapp logs show \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --tail 100

# 5. List revisions
az containerapp revision list \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --output table
```

---

## 📞 Next Steps After Deployment

1. **Test with real patients** - Monitor first few real pre-visit calls
2. **Train staff** - Show them Pre-Visit Data and Analytics pages
3. **Import schedule** - Upload Athena CSV to test auto-linking
4. **Monitor metrics** - Watch capture rates for medications/concerns/questions
5. **Adjust agent prompt** - If capture rates low, refine ElevenLabs agent instructions

---

**You're ready to deploy! 🚀**

**Most important:** Run the database migration SQL BEFORE pushing code!
