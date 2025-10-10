# Pump Assessments Save Fix Guide

## Problem
Users can create accounts, but pump assessments are not being saved to Supabase database.

## Solution Steps

### Step 1: Run the Database Fix Script

1. Open your Supabase Dashboard: https://supabase.com/dashboard
2. Navigate to your project: `tshla-medical`
3. Go to **SQL Editor**
4. Open the file: `scripts/database/fix-pump-assessments-save.sql`
5. Copy and paste the entire SQL script into the Supabase SQL Editor
6. Click **Run** to execute the script

**What this does:**
- Creates/updates the `pump_assessments` table with correct structure
- Sets up proper Row Level Security (RLS) policies
- Grants necessary permissions to authenticated users
- Creates indexes for performance

### Step 2: Verify the Database Setup

After running the script, verify the setup in Supabase SQL Editor:

```sql
-- Check if table exists with correct columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'pump_assessments'
ORDER BY ordinal_position;

-- Check RLS policies
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'pump_assessments';

-- Test if current user can insert (must be logged in as patient)
-- This should return your patient record
SELECT id, email, first_name, last_name, pumpdrive_enabled
FROM patients
WHERE auth_user_id = auth.uid();
```

### Step 3: Test the Save Flow

1. **Clear browser cache and local storage:**
   - Open Developer Console (F12)
   - Go to Application tab
   - Clear Storage → Clear site data

2. **Create a new account:**
   - Navigate to the pump assessment registration page
   - Create a new patient account
   - Verify email confirmation (if required)

3. **Complete a pump assessment:**
   - Fill out the assessment questionnaire
   - Submit the assessment
   - Watch the browser console for detailed logging

4. **Check console output:**
   Look for these log messages in the browser console:
   ```
   🔍 [PumpAssessment] Starting save process...
   🔍 [PumpAssessment] Fetching current authenticated user...
   🔍 [PumpAssessment] Auth result: { success: true, hasUser: true, ... }
   ✅ [PumpAssessment] User authenticated: { id: '...', email: '...', role: 'patient' }
   🔍 [PumpAssessment] Pump choices extracted: { first: 'Omnipod 5', second: '...', third: '...' }
   🔍 [PumpAssessment] Attempting database insert...
   ✅ [PumpAssessment] Assessment saved successfully! { assessmentId: '...' }
   ```

### Step 4: Verify Data Was Saved

In Supabase SQL Editor, check if the assessment was saved:

```sql
-- View all saved assessments
SELECT
  id,
  patient_id,
  patient_name,
  first_choice_pump,
  second_choice_pump,
  third_choice_pump,
  created_at
FROM pump_assessments
ORDER BY created_at DESC
LIMIT 10;

-- View full assessment with patient info
SELECT
  pa.id AS assessment_id,
  p.email AS patient_email,
  p.first_name,
  p.last_name,
  pa.first_choice_pump,
  pa.recommendation_date,
  pa.created_at
FROM pump_assessments pa
JOIN patients p ON pa.patient_id = p.id
ORDER BY pa.created_at DESC
LIMIT 10;
```

## Common Issues & Fixes

### Issue 1: "Permission denied" or RLS Error (Code: 42501)

**Cause:** Row Level Security policies are blocking the insert.

**Fix:**
1. Verify the user is properly authenticated in the `patients` table:
   ```sql
   SELECT id, email, auth_user_id
   FROM patients
   WHERE email = 'user@example.com';
   ```

2. Re-run the RLS policy section from the fix script:
   ```sql
   -- Drop and recreate policies
   DROP POLICY IF EXISTS "Patients can insert own assessments" ON public.pump_assessments;

   CREATE POLICY "Patients can insert own assessments"
     ON public.pump_assessments
     FOR INSERT
     WITH CHECK (
       patient_id IN (
         SELECT id FROM public.patients
         WHERE auth_user_id = auth.uid()
       )
     );
   ```

### Issue 2: "Patient record not found" (Code: 23503)

**Cause:** The `patient_id` doesn't match any record in the `patients` table.

**Fix:**
1. Check if patient record exists:
   ```sql
   SELECT * FROM patients WHERE email = 'user@example.com';
   ```

2. If missing, the registration didn't complete properly. User should try:
   - Logging out completely
   - Clearing browser cache
   - Registering again

### Issue 3: No error, but data not saving

**Cause:** Silent failure due to RLS or missing authentication.

**Fix:**
1. Check browser console for auth errors
2. Verify user session exists:
   ```javascript
   // In browser console
   const { data: { session } } = await supabase.auth.getSession();
   console.log('Session:', session);
   ```

3. Try logging out and back in to refresh session

### Issue 4: "No data returned from database insert"

**Cause:** Insert succeeded but `.select()` failed to return data.

**Fix:**
1. Check if data actually exists:
   ```sql
   SELECT COUNT(*) FROM pump_assessments;
   ```

2. If count is increasing, data IS being saved, but the return value is blocked by RLS
3. Update the SELECT policy to allow users to read their own assessments

## Testing Checklist

- [ ] SQL script runs without errors
- [ ] Table has all required columns
- [ ] RLS policies are created
- [ ] New user can register
- [ ] User can complete assessment
- [ ] Console shows "Assessment saved successfully"
- [ ] Data appears in Supabase database
- [ ] User can view their saved assessments

## Debug Mode

For additional debugging, enable verbose logging:

1. Open browser console
2. Run: `localStorage.setItem('debug', 'pump:*')`
3. Reload page and try assessment again
4. Check console for detailed logs

## Support

If issues persist after following this guide:

1. Export console logs (Right-click → Save as...)
2. Take screenshot of Supabase RLS policies
3. Run this diagnostic query:
   ```sql
   SELECT
     (SELECT COUNT(*) FROM patients) AS total_patients,
     (SELECT COUNT(*) FROM pump_assessments) AS total_assessments,
     (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'pump_assessments') AS total_policies;
   ```
4. Share results with development team

## Additional Notes

- **Supabase URL:** Check `.env` file for `VITE_SUPABASE_URL`
- **Anon Key:** Check `.env` file for `VITE_SUPABASE_ANON_KEY`
- **RLS enabled:** Table has Row Level Security enabled for HIPAA compliance
- **Patient ID format:** UUID (e.g., `a1b2c3d4-e5f6-7890-1234-567890abcdef`)

## Success Indicators

You'll know it's working when:
1. ✅ Console shows: `Assessment saved successfully! { assessmentId: '...' }`
2. ✅ Database query returns the new assessment record
3. ✅ Assessment history page shows the saved assessment
4. ✅ No error messages in browser console
5. ✅ User can view/email their assessment results
