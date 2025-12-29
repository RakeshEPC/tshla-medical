# Diabetes Education Phone System - Quick Fix Guide

## The Problem
Calling **832-400-3930** → "Connecting to your diabetes educator... goodbye" → Call ends

## The Cause
**OpenAI API Key is expired/invalid** (401 Unauthorized)

## The Solution (5 Steps)

### 1. Get New API Key (2 minutes)
```
🔗 https://platform.openai.com/api-keys
   → Create new secret key
   → Name: "tshla-diabetes-education-realtime"
   → Copy the key (sk-proj-...)
```

### 2. Update Local .env (30 seconds)
```bash
# Edit .env file
VITE_OPENAI_API_KEY=sk-proj-YOUR_NEW_KEY_HERE
OPENAI_API_KEY=sk-proj-YOUR_NEW_KEY_HERE
```

### 3. Test Locally (30 seconds)
```bash
cd server
VITE_OPENAI_API_KEY="sk-proj-YOUR_NEW_KEY" node test-openai-realtime-connection.js
```

Expected:
```
✅ Connected to OpenAI Realtime API!
✅ Session configured successfully!
🎉 OpenAI Realtime API is working correctly.
```

### 4. Update Azure (1 minute)
```bash
az containerapp update \
  --name tshla-unified-api \
  --resource-group tshla-medical \
  --set-env-vars \
    "VITE_OPENAI_API_KEY=sk-proj-YOUR_NEW_KEY_HERE" \
    "OPENAI_API_KEY=sk-proj-YOUR_NEW_KEY_HERE"
```

### 5. Test Production (30 seconds)
```bash
# Test health endpoint
curl https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/health/openai-realtime

# Then call 832-400-3930 from a registered number
```

## Verify It's Fixed

Call **832-400-3930** and you should hear:
1. ✅ "Connecting to your diabetes educator..."
2. ✅ AI greeting you
3. ✅ Can have a conversation
4. ✅ Call is logged in database

---

## Phone Number Registration

Your phone must be registered in the database. Currently registered:
- +17138552377 (Simrab Patel)
- +18326073630 (Raman Patel)

To register **+18324003930**:
1. Go to https://www.tshla.ai/diabetes-education
2. Log in as staff
3. Add new patient with your number

---

## Quick Diagnostics

**Check patient registration:**
```bash
cd server
VITE_SUPABASE_URL="https://minvvjdflezibmgkplqb.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM" \
node check-patient-registration.js "+1YOUR_PHONE"
```

**Check OpenAI connection:**
```bash
VITE_OPENAI_API_KEY="sk-proj-..." node server/test-openai-realtime-connection.js
```

**Check production health:**
```bash
curl https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/health/openai-realtime
```

---

**Total Time to Fix:** ~5 minutes
**Root Cause:** Expired OpenAI API key
**Files Changed:** 3 (improved error handling + diagnostics)
**New Files Created:** 4 (test utilities + documentation)
