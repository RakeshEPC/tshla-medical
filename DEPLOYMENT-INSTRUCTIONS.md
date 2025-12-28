# 🚀 RLS Security Fix - Deployment Instructions

**Date:** December 16, 2025
**Priority:** 🔴 **CRITICAL - DEPLOY IMMEDIATELY**
**Estimated Time:** 30 minutes total

---

## 📋 Pre-Deployment Checklist

Before running any scripts, verify:

- [ ] You have admin access to Supabase Dashboard
- [ ] You have reviewed all SQL scripts
- [ ] You have a backup plan (Supabase has automatic backups)
- [ ] You have 30 minutes of uninterrupted time
- [ ] Application traffic is monitored (or low traffic period selected)

---

## 🎯 What This Fixes

### Problems Solved

1. ✅ **Pump assessment data not saving** (RLS was blocking inserts)
2. ✅ **HIPAA compliance violation** (27 tables exposed without RLS)
3. ✅ **Security vulnerability** (anyone with API key could access all patient data)
4. ✅ **Schema confusion** (patient_id vs user_id mismatch)

### Files Created

1. **`database/migrations/FIX-pump-assessments-schema.sql`**
   - Fixes pump_assessments table schema
   - Standardizes on patient_id
   - Adds missing columns

2. **`database/migrations/URGENT-enable-rls-all-tables.sql`**
   - Enables RLS on 27 tables
   - Creates 60+ security policies
   - Implements HIPAA-compliant access controls

3. **`database/migrations/RLS-TESTING-GUIDE.md`**
   - Step-by-step testing procedures
   - Expected results for each test

4. **`RLS-SECURITY-AUDIT-REPORT.md`**
   - Complete security audit findings
   - Compliance documentation

---

## 🚀 Deployment Steps

### Step 1: Access Supabase SQL Editor

1. Go to https://supabase.com
2. Select your project: **RakeshEPC's Project**
3. Navigate to: **SQL Editor** (left sidebar)
4. Create a **New Query**

---

### Step 2: Run Schema Fix (pump_assessments)

**File:** `database/migrations/FIX-pump-assessments-schema.sql`

1. Copy the entire contents of the file
2. Paste into Supabase SQL Editor
3. Click **RUN** button
4. Wait for completion (~30 seconds)

**Expected Output:**
```
========================================
FIXING PUMP_ASSESSMENTS SCHEMA
========================================
✓ Table already has patient_id column
✓ Foreign key updated: patient_id → patients(id)
✓ All required columns ensured
✓ Indexes created
✓ Trigger created
✓ Schema verification PASSED
✅ PUMP_ASSESSMENTS SCHEMA FIX COMPLETED
```

**If Errors Occur:**
- Read the error message carefully
- Check if table exists: `SELECT * FROM pump_assessments LIMIT 1;`
- If "table does not exist", create it first using schema from `scripts/database/create-pump-assessments-table.sql`

---

### Step 3: Run RLS Enablement (ALL TABLES)

**File:** `database/migrations/URGENT-enable-rls-all-tables.sql`

⚠️ **IMPORTANT:** This will enable RLS on all tables. Users must be properly authenticated after this.

1. Copy the entire contents of the file
2. Paste into a **NEW** query in Supabase SQL Editor
3. Review the script one more time
4. Click **RUN** button
5. Wait for completion (~2-3 minutes)

**Expected Output:**
```
========================================
STEP 1: Enabling RLS on all tables...
========================================
✓ RLS enabled on all tables

========================================
STEP 2: Dropping existing policies...
========================================
✓ Existing policies dropped

========================================
STEP 3: Creating RLS policies...
========================================
✓ RLS policies created successfully

========================================
STEP 4: Creating performance indexes...
========================================
✓ Performance indexes created

========================================
STEP 5: Verifying RLS configuration...
========================================
Tables with RLS enabled: 27
Total policies created: 65
✓ RLS verification PASSED

========================================
✅ RLS ENABLEMENT COMPLETED SUCCESSFULLY
========================================
```

**If Errors Occur:**
- Look for specific table/policy name in error
- Check if table exists
- May need to comment out specific policies and run again

---

### Step 4: Verify Deployment

Run this verification query:

```sql
-- Check RLS status
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  (SELECT count(*) FROM pg_policies WHERE pg_policies.tablename = pg_tables.tablename) as policy_count
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'dictated_notes', 'appointments', 'patients',
    'pump_assessments', 'pcm_vitals', 'pcm_enrollments'
  )
ORDER BY tablename;
```

**Expected Results:**
All tables should show:
- `rls_enabled = true`
- `policy_count >= 3`

---

## ✅ Post-Deployment Testing

### Test 1: Quick Sanity Check

Run in SQL Editor:

```sql
-- Should return 0 rows (RLS is blocking anonymous access)
SELECT count(*) FROM patients;
SELECT count(*) FROM pump_assessments;
SELECT count(*) FROM dictated_notes;
```

**Expected:** Returns 0 rows OR "permission denied" (both are correct - RLS is working!)

---

### Test 2: Test User Signup

1. Open your app in browser
2. Navigate to patient signup page
3. Create a new test account:
   - Email: `test-patient-rls@example.com`
   - Password: `TestPass123!`
   - Name: Test RLS Patient
4. Complete signup
5. Log in

**Expected:** Signup works, user can log in

---

### Test 3: Test Pump Assessment

1. As the test patient, navigate to PumpDrive
2. Complete DTSQs questionnaire
3. Complete pump assessment:
   - Fill sliders
   - Select features
   - Add personal story
4. Submit assessment
5. View results

**Expected:**
- Assessment saves successfully
- No console errors
- Can view own assessment results

**Verify in Database:**
```sql
SELECT
  patient_name,
  first_choice_pump,
  second_choice_pump,
  created_at
FROM pump_assessments
ORDER BY created_at DESC
LIMIT 1;
```

Should show your test assessment!

---

### Test 4: Verify RLS is Actually Working

Create a SECOND test patient account, then run:

```sql
-- Get first patient's data
SELECT id, email FROM patients LIMIT 1;
-- Note down the patient_id

-- Try to query as if you're another patient
-- This SHOULD return 0 rows (RLS blocking cross-access)
SELECT * FROM pump_assessments WHERE patient_id = '<first-patient-id>';
```

**Expected:** 0 rows (RLS is protecting data!)

---

## 🔍 Monitoring

### What to Watch For (First 24 Hours)

#### ✅ Good Signs
- Users can sign up
- Users can log in
- Assessments save successfully
- No "permission denied" errors in logs (for legitimate operations)
- Each user only sees their own data

#### ⚠️ Warning Signs
- Users cannot sign up (check patient table insert policy)
- "Row level security policy" errors in console
- Users see other users' data (RLS not working)
- Cannot save assessments (check patient_id exists)

### Supabase Dashboard Monitoring

1. Go to **Logs** → **Postgres Logs**
2. Filter for: `error` or `policy`
3. Look for RLS-related errors
4. Check patterns (same user? same table?)

---

## 🆘 Rollback Plan (IF NEEDED)

**If critical issues occur:**

### Option A: Temporary Disable RLS (EMERGENCY ONLY)

⚠️ **WARNING:** This re-exposes data! Only use for debugging!

```sql
-- Disable RLS on specific table
ALTER TABLE pump_assessments DISABLE ROW LEVEL SECURITY;

-- OR disable on all tables (EXTREME EMERGENCY)
DO $$
DECLARE
    tbl RECORD;
BEGIN
    FOR tbl IN
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE 'ALTER TABLE ' || tbl.tablename || ' DISABLE ROW LEVEL SECURITY';
    END LOOP;
END $$;
```

**Then:**
1. Fix the underlying issue
2. RE-ENABLE RLS immediately
3. Document what happened

### Option B: Fix Specific Policy

If one policy is causing issues:

```sql
-- Drop problematic policy
DROP POLICY "policy_name" ON table_name;

-- Create corrected policy
CREATE POLICY "policy_name_fixed"
  ON table_name FOR SELECT
  TO authenticated
  USING (patient_id IN (
    SELECT id FROM patients WHERE auth_user_id = auth.uid()
  ));
```

---

## 📊 Success Criteria

Mark complete when ALL are true:

- [ ] Both SQL scripts ran without errors
- [ ] Verification query shows RLS enabled
- [ ] Test patient can sign up
- [ ] Test patient can complete assessment
- [ ] Assessment data appears in database
- [ ] Browser console has no RLS errors
- [ ] Cross-patient data access is blocked
- [ ] No production user complaints

---

## 📞 Support

**If You Encounter Issues:**

1. **Check Logs First:**
   - Supabase Dashboard → Logs → Postgres Logs
   - Browser Console (F12)

2. **Common Issues:**
   - "Column does not exist" → Run schema fix again
   - "Policy violation" → Check user is authenticated
   - "Permission denied" → Policy may need adjustment

3. **Get Help:**
   - Review `RLS-TESTING-GUIDE.md`
   - Check `RLS-SECURITY-AUDIT-REPORT.md`
   - Review Supabase RLS docs: https://supabase.com/docs/guides/auth/row-level-security

---

## 🎉 Post-Deployment

Once deployed successfully:

1. **Update Documentation:**
   - Mark audit report as "REMEDIATED"
   - Document deployment date/time
   - Note any issues encountered

2. **Team Communication:**
   - Notify team of security improvements
   - Share testing procedures
   - Update runbooks

3. **Ongoing Maintenance:**
   - Review RLS policies monthly
   - Add RLS checks to CI/CD
   - Audit new tables for RLS requirements

---

## 📝 Deployment Log

**Deployment Date:** _______________
**Deployed By:** _______________
**Start Time:** _______________
**End Time:** _______________

**Scripts Executed:**
- [ ] FIX-pump-assessments-schema.sql
- [ ] URGENT-enable-rls-all-tables.sql

**Tests Completed:**
- [ ] Verification query
- [ ] User signup test
- [ ] Pump assessment test
- [ ] Cross-access test

**Issues Encountered:**
_______________________________________________________________
_______________________________________________________________

**Resolution:**
_______________________________________________________________
_______________________________________________________________

**Final Status:** ⬜ SUCCESS / ⬜ PARTIAL / ⬜ FAILED

---

**READY TO DEPLOY?** Review checklist, then proceed with Step 1!

**Questions?** Review the testing guide and audit report first.

**Last Updated:** December 16, 2025
