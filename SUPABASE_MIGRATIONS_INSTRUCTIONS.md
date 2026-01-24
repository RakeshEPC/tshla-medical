# Supabase Database Migrations - Patient Portal

## Overview
You need to run 3 SQL migration files in the Supabase SQL Editor to create all required tables for the patient portal.

---

## Step-by-Step Instructions

### 1. Access Supabase SQL Editor

1. Go to: https://supabase.com/dashboard
2. Select your project: **minvvjdflezibmgkplqb**
3. Click on **SQL Editor** in the left sidebar
4. Click **New Query**

---

### 2. Run Migration #1: Comprehensive H&P Tables

**File:** `database/migrations/add-comprehensive-hp.sql`

**What it creates:**
- `patient_comprehensive_chart` - Main patient H&P data
- `patient_chart_history` - Audit trail of all changes
- `visit_dictations_archive` - Archive of dictations

**Instructions:**
1. Open the file: `database/migrations/add-comprehensive-hp.sql`
2. Copy the entire contents
3. Paste into Supabase SQL Editor
4. Click **Run** (or press Cmd+Enter)
5. Wait for "Success. No rows returned" message

---

### 3. Run Migration #2: Portal Analytics Tables

**File:** `database/migrations/add-patient-portal-analytics.sql`

**What it creates:**
- `patient_portal_sessions` - Login/session tracking
- `staff_review_queue` - Patient edits pending staff review
- `portal_usage_analytics` - Daily aggregated stats
- `ai_common_questions` - FAQ generation

**Instructions:**
1. Open the file: `database/migrations/add-patient-portal-analytics.sql`
2. Copy the entire contents
3. Paste into Supabase SQL Editor (new query)
4. Click **Run**
5. Wait for success message

---

### 4. Run Migration #3: AI Chat Tables

**File:** `database/migrations/add-ai-chat-conversations.sql`

**What it creates:**
- `patient_ai_conversations` - AI chat message history
- `patient_ai_analytics` - Daily AI usage stats
- `patient_urgent_alerts` - Urgent symptom detection alerts

**Instructions:**
1. Open the file: `database/migrations/add-ai-chat-conversations.sql`
2. Copy the entire contents
3. Paste into Supabase SQL Editor (new query)
4. Click **Run**
5. Wait for success message

---

## 5. Verify Tables Created

After running all 3 migrations, verify the tables exist:

1. In Supabase Dashboard, go to **Table Editor**
2. You should see these 10 new tables:
   - ✅ `patient_comprehensive_chart`
   - ✅ `patient_chart_history`
   - ✅ `visit_dictations_archive`
   - ✅ `patient_portal_sessions`
   - ✅ `staff_review_queue`
   - ✅ `portal_usage_analytics`
   - ✅ `ai_common_questions`
   - ✅ `patient_ai_conversations`
   - ✅ `patient_ai_analytics`
   - ✅ `patient_urgent_alerts`

---

## Quick Verification Script

Run this in your terminal to check if tables exist:

```bash
VITE_SUPABASE_URL="https://minvvjdflezibmgkplqb.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM" \
node scripts/run-patient-portal-migrations.cjs
```

This will show which tables exist (✅) and which are missing (❌).

---

## Troubleshooting

### Error: "relation already exists"
- **Solution:** Table already created. This is fine, continue to next migration.

### Error: "permission denied"
- **Solution:** You may need to be logged in as the project owner. Check your Supabase account permissions.

### Error: "syntax error"
- **Solution:** Make sure you copied the ENTIRE file contents, including the opening comments.

---

## Next Steps After Migrations

Once all migrations are complete:

1. ✅ Configure Azure environment variables
2. ✅ Create Supabase storage buckets
3. ✅ Seed test data: `node scripts/seed-patient-portal-data.js`
4. ✅ Test the patient portal

---

## Migration Files Location

All migration files are in: `/Users/rakeshpatel/Desktop/tshla-medical/database/migrations/`

1. `add-comprehensive-hp.sql` (305 lines)
2. `add-patient-portal-analytics.sql` (249 lines)
3. `add-ai-chat-conversations.sql` (228 lines)

**Total SQL to execute:** ~782 lines

---

## Need Help?

If you encounter issues:
1. Check Supabase logs in the Dashboard
2. Verify you're using the correct project (minvvjdflezibmgkplqb)
3. Ensure you have admin/owner permissions on the project
