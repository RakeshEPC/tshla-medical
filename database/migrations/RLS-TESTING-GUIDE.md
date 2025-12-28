# RLS Testing Guide - TSHLA Medical

**Created:** 2025-12-16
**Purpose:** Verify Row Level Security policies are working correctly after migration

---

## Pre-Test Setup

### 1. Verify RLS is Enabled

Run in Supabase SQL Editor:

```sql
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  (SELECT count(*) FROM pg_policies WHERE pg_policies.tablename = pg_tables.tablename) as policy_count
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = true
ORDER BY tablename;
```

**Expected:** All critical tables show `rls_enabled = true` and `policy_count >= 3`

---

## Test Suite

### **TEST 1: Patient Can View Own Data ✅**

**Goal:** Confirm patients can ONLY see their own records

**Setup:**
1. Create test patient account via signup
2. Log in as that patient
3. Note the patient's `id` and `auth_user_id`

**SQL Test (as authenticated patient):**
```sql
-- Set session to simulate patient login
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "<patient-auth-user-id>"}';

-- Should return ONLY that patient's data
SELECT * FROM pump_assessments;
SELECT * FROM pcm_vitals;
SELECT * FROM appointments;
SELECT * FROM pcm_goals;
SELECT * FROM pcm_tasks;
```

**Expected Results:**
- ✅ Returns records where `patient_id` matches the authenticated user
- ✅ No errors
- ✅ If no data exists yet, returns 0 rows (not an error)

**FAIL Criteria:**
- ❌ Returns other patients' data
- ❌ Error: "permission denied" or "policy violation"

---

### **TEST 2: Patient CANNOT View Other Patients ❌**

**Goal:** Confirm cross-patient data access is blocked

**Setup:**
1. Create two test patients (Patient A and Patient B)
2. Create assessment data for Patient B
3. Log in as Patient A

**SQL Test:**
```sql
-- As Patient A, try to access Patient B's data
SET LOCAL request.jwt.claims TO '{"sub": "<patient-a-auth-user-id>"}';

SELECT * FROM pump_assessments WHERE patient_id = '<patient-b-uuid>';
SELECT * FROM pcm_vitals WHERE patient_id = '<patient-b-uuid>';
```

**Expected Results:**
- ✅ Returns 0 rows (data is hidden by RLS)
- ✅ No errors (just empty result set)

**FAIL Criteria:**
- ❌ Returns Patient B's data
- ❌ System error or crash

---

### **TEST 3: Medical Staff Can View Assigned Patients ✅**

**Goal:** Staff can see their assigned patients' data

**Setup:**
1. Create test medical staff account
2. Create test patient
3. Create appointment linking staff ↔ patient
4. Log in as staff member

**SQL Test:**
```sql
SET LOCAL request.jwt.claims TO '{"sub": "<staff-auth-user-id>"}';

-- Staff should see all patients (depending on policy)
SELECT * FROM patients;
SELECT * FROM pump_assessments;
SELECT * FROM pcm_vitals;
SELECT * FROM appointments WHERE doctor_id = '<staff-uuid>';
```

**Expected Results:**
- ✅ Can view patients table
- ✅ Can view assigned appointments
- ✅ Can view pump assessments (if policy allows all staff)

**FAIL Criteria:**
- ❌ Cannot see ANY patient data
- ❌ Permission denied errors

---

### **TEST 4: Admin Can View ALL Data ✅**

**Goal:** Admin users have unrestricted access

**Setup:**
1. Create admin user (set `is_admin = true` in `medical_staff`)
2. Log in as admin

**SQL Test:**
```sql
SET LOCAL request.jwt.claims TO '{"sub": "<admin-auth-user-id>"}';

SELECT count(*) FROM patients;
SELECT count(*) FROM dictated_notes;
SELECT count(*) FROM pump_assessments;
SELECT count(*) FROM pcm_vitals;
SELECT count(*) FROM appointments;
```

**Expected Results:**
- ✅ Returns counts for ALL records (not filtered by patient/staff)
- ✅ No permission errors

**FAIL Criteria:**
- ❌ Only sees subset of data
- ❌ Permission denied

---

### **TEST 5: Anonymous Users BLOCKED from Sensitive Data ❌**

**Goal:** Unauthenticated users cannot access PHI

**Setup:**
1. Use Supabase anon key (not authenticated token)

**SQL Test:**
```sql
-- Run without authentication
SELECT * FROM patients;
SELECT * FROM dictated_notes;
SELECT * FROM pump_assessments;
SELECT * FROM pcm_vitals;
```

**Expected Results:**
- ✅ Returns 0 rows OR permission denied error
- ✅ Does NOT return any patient data

**Exception:** `pump_comparison_data` and `pump_dimensions` MAY be readable (reference data)

**FAIL Criteria:**
- ❌ Returns patient data
- ❌ Returns clinical notes

---

### **TEST 6: Service Role Has Full Access ✅**

**Goal:** Backend APIs using service role key can bypass RLS

**Setup:**
1. Use Supabase service role key (not anon key)

**SQL Test:**
```sql
-- Using service role credentials
SELECT count(*) FROM patients;
SELECT count(*) FROM dictated_notes;
SELECT count(*) FROM pump_assessments;
```

**Expected Results:**
- ✅ Returns full counts
- ✅ No restrictions

**FAIL Criteria:**
- ❌ RLS blocks service role
- ❌ Permission errors

---

### **TEST 7: Pump Assessment Save Works ✅**

**Goal:** Verify the original issue is fixed - assessments can be saved

**Setup:**
1. Create test patient account via frontend
2. Complete pump assessment flow
3. Submit assessment

**Frontend Test:**
1. Sign up as new patient
2. Complete DTSQs questionnaire
3. Complete pump assessment (sliders, features, story)
4. Submit and view results

**Verify:**
- Open browser console (F12)
- Look for: `✅ [PumpAssessment] Assessment saved successfully`
- Should NOT see: `❌ [PumpAssessment] Database insert failed`

**SQL Verification:**
```sql
SELECT
  id,
  patient_id,
  patient_name,
  first_choice_pump,
  second_choice_pump,
  slider_values,
  created_at
FROM pump_assessments
ORDER BY created_at DESC
LIMIT 5;
```

**Expected Results:**
- ✅ New row appears in `pump_assessments` table
- ✅ All slider values saved
- ✅ Pump recommendations captured
- ✅ No console errors

**FAIL Criteria:**
- ❌ No row created
- ❌ Console shows RLS error (code 42501)
- ❌ Data is null/missing

---

### **TEST 8: Staff Can Create/Update Notes ✅**

**Goal:** Medical staff can document patient visits

**Setup:**
1. Log in as medical staff
2. Navigate to dictation page
3. Create new note

**Frontend Test:**
1. Log in as doctor
2. Dictate a clinical note
3. Save note

**SQL Verification:**
```sql
SELECT
  id,
  provider_id,
  provider_name,
  patient_name,
  raw_transcript,
  status,
  created_at
FROM dictated_notes
WHERE provider_id = '<staff-id>'
ORDER BY created_at DESC
LIMIT 5;
```

**Expected Results:**
- ✅ Note is saved
- ✅ Provider can view their own notes
- ✅ Can update note status (draft → reviewed → signed)

**FAIL Criteria:**
- ❌ RLS blocks INSERT
- ❌ Cannot update own notes

---

## Automated Test Script

For quick verification, run this comprehensive test:

```sql
-- =====================================================
-- AUTOMATED RLS VERIFICATION SCRIPT
-- =====================================================

DO $$
DECLARE
    test_patient_id UUID;
    test_staff_id UUID;
    test_patient_auth UUID := gen_random_uuid(); -- Simulated auth ID
    test_staff_auth UUID := gen_random_uuid();
    test_count INTEGER;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RLS AUTOMATED TEST SUITE';
    RAISE NOTICE '========================================';

    -- Setup: Create test patient
    INSERT INTO patients (id, auth_user_id, first_name, last_name, email)
    VALUES (gen_random_uuid(), test_patient_auth, 'Test', 'Patient', 'test-patient@example.com')
    RETURNING id INTO test_patient_id;

    -- Setup: Create test staff
    INSERT INTO medical_staff (id, auth_user_id, email, first_name, last_name, role)
    VALUES (gen_random_uuid(), test_staff_auth, 'test-staff@example.com', 'Test', 'Doctor', 'doctor')
    RETURNING id INTO test_staff_id;

    -- TEST 1: Verify RLS is enabled
    SELECT count(*) INTO test_count
    FROM pg_tables
    WHERE schemaname = 'public' AND rowsecurity = true;

    IF test_count >= 20 THEN
        RAISE NOTICE '✓ TEST 1 PASSED: % tables have RLS enabled', test_count;
    ELSE
        RAISE WARNING '✗ TEST 1 FAILED: Only % tables have RLS (expected >= 20)', test_count;
    END IF;

    -- TEST 2: Verify policies exist
    SELECT count(*) INTO test_count
    FROM pg_policies
    WHERE schemaname = 'public';

    IF test_count >= 60 THEN
        RAISE NOTICE '✓ TEST 2 PASSED: % policies created', test_count;
    ELSE
        RAISE WARNING '✗ TEST 2 FAILED: Only % policies (expected >= 60)', test_count;
    END IF;

    -- Cleanup
    DELETE FROM medical_staff WHERE id = test_staff_id;
    DELETE FROM patients WHERE id = test_patient_id;

    RAISE NOTICE '========================================';
    RAISE NOTICE 'AUTOMATED TESTS COMPLETED';
    RAISE NOTICE '========================================';
END $$;
```

---

## Troubleshooting

### Issue: "permission denied for table"

**Cause:** RLS policy is blocking access

**Fix:**
1. Check if user is authenticated
2. Verify policy logic in `pg_policies`
3. Check if `auth.uid()` matches expected user

### Issue: "column does not exist"

**Cause:** Policy references wrong column name

**Fix:**
1. Check table schema: `\d tablename` in psql
2. Update policy to use correct column
3. Common mismatch: `patient_id` vs `user_id`

### Issue: "function auth.uid() does not exist"

**Cause:** Not running in authenticated context

**Fix:**
1. Ensure using proper Supabase client
2. Check authentication token is valid
3. Use service role key for backend operations

### Issue: Service role still blocked

**Cause:** Missing service role policy

**Fix:**
```sql
CREATE POLICY "service_role_bypass"
  ON tablename FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');
```

---

## Success Criteria Checklist

- [ ] All 27+ tables have RLS enabled
- [ ] Minimum 3 policies per table
- [ ] Test patient can view own data
- [ ] Test patient CANNOT view other patients
- [ ] Medical staff can view assigned patients
- [ ] Admin can view all data
- [ ] Anonymous users blocked from PHI
- [ ] Service role has full access
- [ ] Pump assessments save successfully
- [ ] No application errors after RLS enablement
- [ ] All critical workflows still function

---

## Next Steps After Testing

1. ✅ Document test results
2. ✅ Fix any failing tests
3. ✅ Update security audit report
4. ✅ Monitor production logs for RLS errors
5. ✅ Train staff on data access changes

---

**For Questions:** Contact DevOps or review Supabase RLS documentation

**Last Updated:** 2025-12-16
