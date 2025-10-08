-- =====================================================
-- TSHLA Medical - Start Fresh (Drop pump_users)
-- =====================================================
-- Since pump_users only has 5 test users, we'll start fresh
-- Users can re-register in the new unified system
-- =====================================================

-- Step 1: Drop pump_assessments data linked to pump_users
SELECT 'Step 1: Clearing old pump assessments...' as status;

DELETE FROM pump_assessments WHERE user_id IS NOT NULL;

SELECT 'Deleted ' || (SELECT COUNT(*) FROM pump_assessments) || ' old assessments' as status;

-- Step 2: Drop the pump_users table
SELECT 'Step 2: Dropping pump_users table...' as status;

DROP TABLE IF EXISTS pump_users CASCADE;

SELECT '✓ pump_users table dropped' as status;

-- Step 3: Update pump_assessments to use patient_id
SELECT 'Step 3: Updating pump_assessments schema...' as status;

-- Remove old user_id column if it exists
ALTER TABLE pump_assessments DROP COLUMN IF EXISTS user_id CASCADE;

-- Add patient_id column if it doesn't exist
ALTER TABLE pump_assessments
  ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES patients(id) ON DELETE CASCADE;

SELECT '✓ pump_assessments now uses patient_id' as status;

-- Step 4: Add PumpDrive fields to patients table
SELECT 'Step 4: Adding PumpDrive fields to patients...' as status;

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS pumpdrive_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS pumpdrive_signup_date TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS pumpdrive_last_assessment TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assessments_completed INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(50) DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMPTZ;

COMMENT ON COLUMN patients.pumpdrive_enabled IS 'Whether patient has access to PumpDrive assessments';
COMMENT ON COLUMN patients.assessments_completed IS 'Total pump assessments completed';

SELECT '✓ PumpDrive fields added to patients' as status;

-- Step 5: Update Row Level Security policies
SELECT 'Step 5: Updating security policies...' as status;

-- Drop old pump_users policies
DROP POLICY IF EXISTS "Pump users can view own profile" ON pump_users;
DROP POLICY IF EXISTS "Users can view own assessments" ON pump_assessments;
DROP POLICY IF EXISTS "Users can create own assessments" ON pump_assessments;

-- Create new patient-based policies
CREATE POLICY IF NOT EXISTS "Patients can view own pump assessments"
  ON pump_assessments FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Patients can create own pump assessments"
  ON pump_assessments FOR INSERT
  WITH CHECK (
    patient_id IN (
      SELECT id FROM patients WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Patients can view own profile"
  ON patients FOR SELECT
  USING (auth_user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Patients can update own profile"
  ON patients FOR UPDATE
  USING (auth_user_id = auth.uid());

-- Staff can see all patients
CREATE POLICY IF NOT EXISTS "Staff can view all patients"
  ON patients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM medical_staff
      WHERE auth_user_id = auth.uid()
      AND is_active = TRUE
    )
  );

SELECT '✓ Security policies updated' as status;

-- Step 6: Add performance indexes
SELECT 'Step 6: Adding indexes...' as status;

CREATE INDEX IF NOT EXISTS idx_patients_auth_user
  ON patients(auth_user_id);

CREATE INDEX IF NOT EXISTS idx_patients_pumpdrive
  ON patients(pumpdrive_enabled) WHERE pumpdrive_enabled = TRUE;

CREATE INDEX IF NOT EXISTS idx_pump_assessments_patient
  ON pump_assessments(patient_id);

SELECT '✓ Indexes created' as status;

-- Final Summary
SELECT '========================================' as summary;
SELECT 'CLEANUP COMPLETE!' as summary;
SELECT '========================================' as summary;

SELECT
  'pump_users table' as item,
  'DROPPED' as status
UNION ALL
SELECT
  'patients table',
  'Ready for new users'
UNION ALL
SELECT
  'pump_assessments',
  'Updated to use patient_id'
UNION ALL
SELECT
  'Security policies',
  'Updated';

SELECT '========================================' as next_steps;
SELECT 'NEXT STEPS:' as next_steps;
SELECT '1. Update backend code (pump-report-api.js)' as step
UNION ALL SELECT '2. Update frontend auth (use patients table)'
UNION ALL SELECT '3. Test new patient registration'
UNION ALL SELECT '4. Test pump assessment flow'
UNION ALL SELECT '5. Have your 5 test users re-register';
SELECT '========================================' as next_steps;
