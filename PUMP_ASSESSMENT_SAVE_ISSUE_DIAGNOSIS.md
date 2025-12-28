# 🔴 Pump Assessment Data Not Saving - Root Cause Analysis

**Date:** 2025-12-16
**Status:** CRITICAL - No patient assessments being saved to database

---

## 📊 **Current Situation**

✅ Database tables exist and are properly configured
✅ Frontend code IS calling `saveAssessment()` function
✅ Users can complete the assessment flow
❌ **ZERO assessments saved to database (0 rows in `pump_assessments` table)**

---

## 🔍 **Root Causes Identified**

### **Issue #1: Row Level Security (RLS) Policy Blocking Inserts**

**Error Code:** `42501` - "new row violates row-level security policy"

**The Problem:**
- RLS policies are ENABLED on `pump_assessments` table
- Insert policy requires the user to exist in `pump_users` table
- Currently: **0 users in `pump_users` table** (all tables empty)

**RLS Policy from Schema:**
```sql
CREATE POLICY "Users can create own assessments"
  ON public.pump_assessments FOR INSERT
  WITH CHECK (
    auth.uid() = (
      SELECT auth_user_id FROM public.pump_users
      WHERE id = pump_assessments.user_id
    )
  );
```

**Why it fails:**
1. User completes assessment
2. Frontend tries to INSERT with `patient_id`
3. RLS policy checks if user exists in `pump_users` table
4. No users exist in `pump_users` → RLS blocks INSERT
5. Error: 42501 (security policy violation)

---

### **Issue #2: Schema Confusion (patients vs pump_users)**

**Multiple Conflicting Schemas Found:**

**Schema A** ([create-pump-assessments-table.sql](scripts/database/create-pump-assessments-table.sql)):
```sql
CREATE TABLE pump_assessments (
  user_id UUID REFERENCES public.pump_users(id) ON DELETE CASCADE,
  ...
)
```

**Schema B** ([master-schema.sql](src/lib/db/master-schema.sql)):
```sql
CREATE TABLE pump_assessments (
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  ...
)
```

**Frontend Code** ([pumpAssessment.service.ts:177](src/services/pumpAssessment.service.ts#L177)):
```typescript
const insertData = {
  patient_id: currentUser.id, // Links to patients table
  ...
}
```

**The Conflict:**
- Frontend expects: `patient_id` → `patients` table
- Some SQL scripts expect: `user_id` → `pump_users` table
- Actual Supabase table: **UNKNOWN** (diagnostic couldn't determine due to RLS blocking)

---

### **Issue #3: No Users in Any Table**

**Table Row Counts:**
- `patients`: 0 rows ❌
- `pump_users`: 0 rows ❌
- `medical_staff`: 0 rows ❌
- `unified_patients`: 0 rows ❌

**Impact:**
- Even if schema mismatch is fixed, assessments can't be linked to non-existent users
- User signup/authentication flow is not creating user records in database

---

## 💡 **Solutions**

### **Option A: Use `patients` Table (RECOMMENDED)**

**Why:** Frontend already uses this approach, and `patients` table exists

**Steps:**
1. ✅ Verify `pump_assessments` table has `patient_id` column (not `user_id`)
2. Update RLS policies to reference `patients` table instead of `pump_users`
3. Ensure user signup creates record in `patients` table
4. Update foreign key constraint to reference `patients(id)`

**SQL Fix:**
```sql
-- Drop existing policies
DROP POLICY IF EXISTS "Users can create own assessments" ON pump_assessments;
DROP POLICY IF EXISTS "Users can view own assessments" ON pump_assessments;

-- Create new policies for patients table
CREATE POLICY "Patients can create own assessments"
  ON pump_assessments FOR INSERT
  WITH CHECK (
    auth.uid() = (
      SELECT auth_user_id FROM patients
      WHERE id = pump_assessments.patient_id
    )
  );

CREATE POLICY "Patients can view own assessments"
  ON pump_assessments FOR SELECT
  USING (
    auth.uid() = (
      SELECT auth_user_id FROM patients
      WHERE id = pump_assessments.patient_id
    )
  );

-- Service role bypass
CREATE POLICY "Service role full access to pump_assessments"
  ON pump_assessments FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');
```

---

### **Option B: Use `pump_users` Table**

**Steps:**
1. Update frontend to use `user_id` instead of `patient_id`
2. Update user signup to create records in `pump_users` table
3. Keep existing RLS policies

**Frontend Fix:**
```typescript
// In pumpAssessment.service.ts line 177
const insertData = {
  user_id: currentUser.id,  // Changed from patient_id
  ...
}
```

---

### **Option C: Temporary RLS Bypass for Testing**

**⚠️ NOT for production - Testing only**

```sql
-- Temporarily disable RLS to test if data saves
ALTER TABLE pump_assessments DISABLE ROW LEVEL SECURITY;
```

This will confirm if RLS is the blocker. **Must re-enable before production!**

---

## 🎯 **Immediate Action Items**

### **Step 1: Determine Actual Table Schema**
Run this to find out which column exists:
```bash
npx tsx scripts/diagnose-pump-save-issue.ts
```

### **Step 2: Create Test User**
Manually create a test user in the correct table to verify the flow:

```sql
-- If using patients table:
INSERT INTO patients (id, auth_user_id, first_name, last_name, email)
VALUES (
  gen_random_uuid(),
  'YOUR_AUTH_USER_ID_HERE',  -- From Supabase Auth
  'Test',
  'Patient',
  'test@example.com'
);
```

### **Step 3: Test Assessment Save**
- Log in as test user
- Complete pump assessment
- Check if data saves to `pump_assessments` table

### **Step 4: Fix RLS Policies**
Based on which table is being used, update RLS policies accordingly (see Option A or B above)

---

## 📝 **Evidence Trails**

### **Frontend Code Evidence:**
- **File:** [src/services/pumpAssessment.service.ts](src/services/pumpAssessment.service.ts)
- **Line 177:** Uses `patient_id`
- **Line 205:** Inserts into `pump_assessments` table
- **Line 387 in PumpDriveResults.tsx:** Calls `saveAssessmentToDatabase()`

### **Error Evidence:**
- **Error Code:** 42501
- **Error Message:** "new row violates row-level security policy for table 'pump_assessments'"
- **Diagnostic Output:** See [scripts/diagnose-pump-save-issue.ts](scripts/diagnose-pump-save-issue.ts) results above

### **Database Evidence:**
- All user tables have 0 rows
- `pump_comparison_data` has 23 rows (pump data loaded ✅)
- `pump_assessments` has 0 rows (no assessments saved ❌)

---

## ✅ **Recommended Fix (Final)**

**Use patients table + Update RLS policies**

1. Keep frontend as-is (`patient_id`)
2. Ensure `pump_assessments` table has `patient_id` column
3. Update RLS policies to use `patients` table
4. Fix user signup to create `patients` records
5. Test with real user signup flow

**Expected Result:**
- User signs up → Record created in `patients` table
- User completes assessment → Data saves to `pump_assessments` table
- RLS allows insert because user exists in `patients` table

---

## 🔗 **Related Files**

- [src/services/pumpAssessment.service.ts](src/services/pumpAssessment.service.ts) - Save logic
- [src/pages/PumpDriveResults.tsx](src/pages/PumpDriveResults.tsx) - Calls save function
- [scripts/database/create-pump-assessments-table.sql](scripts/database/create-pump-assessments-table.sql) - Schema A
- [src/lib/db/master-schema.sql](src/lib/db/master-schema.sql) - Schema B
- [scripts/diagnose-pump-save-issue.ts](scripts/diagnose-pump-save-issue.ts) - Diagnostic script

---

**Next Steps:** Choose Option A or B and implement the fix.
