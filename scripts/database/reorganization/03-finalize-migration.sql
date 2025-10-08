-- =====================================================
-- TSHLA Medical - Finalize Migration & Cleanup
-- =====================================================
-- ⚠️  WARNING: This script DROPS the pump_users table!
-- Only run this AFTER verifying migration was successful
-- =====================================================

-- Final verification before deletion
SELECT '========================================' as verification;
SELECT 'FINAL VERIFICATION BEFORE DELETION' as verification;
SELECT '========================================' as verification;

-- 1. Check all assessments are linked
SELECT
  'pump_assessments' as table_name,
  COUNT(*) as total_assessments,
  COUNT(CASE WHEN patient_id IS NOT NULL THEN 1 END) as linked_to_patients,
  COUNT(CASE WHEN patient_id IS NULL AND user_id IS NOT NULL THEN 1 END) as orphaned_assessments,
  CASE
    WHEN COUNT(CASE WHEN patient_id IS NULL AND user_id IS NOT NULL THEN 1 END) = 0
    THEN '✓ Safe to proceed'
    ELSE '⚠️  WARNING: Some assessments not migrated'
  END as safety_check
FROM pump_assessments;

-- 2. Check all pump users migrated
SELECT
  'pump_users migration' as check_name,
  (SELECT COUNT(*) FROM pump_users) as pump_users_count,
  (SELECT COUNT(*) FROM patients WHERE pumpdrive_enabled = TRUE) as migrated_to_patients,
  CASE
    WHEN (SELECT COUNT(*) FROM pump_users) <= (SELECT COUNT(*) FROM patients WHERE pumpdrive_enabled = TRUE)
    THEN '✓ All users accounted for'
    ELSE '⚠️  Some users may not have migrated'
  END as safety_check;

-- Ask for confirmation
SELECT '========================================' as confirmation;
SELECT '⚠️  POINT OF NO RETURN' as confirmation;
SELECT '========================================' as confirmation;
SELECT 'If checks above are OK, uncomment the DROP TABLE command below' as confirmation;
SELECT 'This will permanently delete the pump_users table' as confirmation;
SELECT '========================================' as confirmation;

-- =====================================================
-- STEP 1: Drop old user_id column from pump_assessments
-- =====================================================
SELECT 'Step 1: Removing old user_id column from pump_assessments...' as status;

-- Drop the old foreign key constraint
ALTER TABLE public.pump_assessments
  DROP COLUMN IF EXISTS user_id CASCADE;

SELECT '✓ Removed old user_id column' as status;

-- =====================================================
-- STEP 2: Drop pump_users table
-- =====================================================
SELECT 'Step 2: Dropping pump_users table...' as status;

-- ⚠️  UNCOMMENT THE LINE BELOW TO ACTUALLY DROP THE TABLE
-- DROP TABLE IF EXISTS public.pump_users CASCADE;

SELECT '⚠️  pump_users table NOT dropped (line is commented)' as status;
SELECT 'To actually drop the table, edit this script and uncomment the DROP TABLE line' as status;

-- =====================================================
-- STEP 3: Update Row Level Security Policies
-- =====================================================
SELECT 'Step 3: Updating RLS policies for patients table...' as status;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Users can view own assessments" ON pump_assessments;
DROP POLICY IF EXISTS "Users can create own assessments" ON pump_assessments;
DROP POLICY IF EXISTS "Pump users can view own profile" ON pump_users;

-- Create new policies for patients accessing pump_assessments
CREATE POLICY IF NOT EXISTS "Patients can view own pump assessments"
  ON pump_assessments FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM patients
      WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Patients can create own pump assessments"
  ON pump_assessments FOR INSERT
  WITH CHECK (
    patient_id IN (
      SELECT id FROM patients
      WHERE auth_user_id = auth.uid()
    )
  );

-- Update patients table policies
CREATE POLICY IF NOT EXISTS "Patients can view own profile"
  ON patients FOR SELECT
  USING (auth_user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Patients can update own profile"
  ON patients FOR UPDATE
  USING (auth_user_id = auth.uid());

SELECT '✓ RLS policies updated' as status;

-- =====================================================
-- STEP 4: Add indexes for performance
-- =====================================================
SELECT 'Step 4: Adding performance indexes...' as status;

CREATE INDEX IF NOT EXISTS idx_patients_pumpdrive_enabled
  ON patients(pumpdrive_enabled) WHERE pumpdrive_enabled = TRUE;

CREATE INDEX IF NOT EXISTS idx_patients_auth_user
  ON patients(auth_user_id) WHERE auth_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pump_assessments_patient
  ON pump_assessments(patient_id);

SELECT '✓ Indexes created' as status;

-- =====================================================
-- FINAL SUMMARY
-- =====================================================
SELECT '========================================' as summary;
SELECT 'MIGRATION COMPLETE!' as summary;
SELECT '========================================' as summary;

SELECT
  'Total patients' as metric,
  COUNT(*) as value
FROM patients
UNION ALL
SELECT
  'PumpDrive enabled patients',
  COUNT(*)
FROM patients WHERE pumpdrive_enabled = TRUE
UNION ALL
SELECT
  'EMR-only patients',
  COUNT(*)
FROM patients WHERE pumpdrive_enabled = FALSE OR pumpdrive_enabled IS NULL
UNION ALL
SELECT
  'Total pump assessments',
  COUNT(*)
FROM pump_assessments
UNION ALL
SELECT
  'Assessments linked to patients',
  COUNT(*)
FROM pump_assessments WHERE patient_id IS NOT NULL;

SELECT '========================================' as next_steps;
SELECT 'NEXT STEPS:' as next_steps;
SELECT '1. Update frontend code to use "patients" table' as instruction
UNION ALL SELECT '2. Update auth services to query "patients" not "pump_users"'
UNION ALL SELECT '3. Test patient login flow'
UNION ALL SELECT '4. Delete old pumpAuth.service.ts file';
