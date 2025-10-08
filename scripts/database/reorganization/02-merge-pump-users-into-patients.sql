-- =====================================================
-- TSHLA Medical - Merge pump_users into patients table
-- =====================================================
-- This script consolidates PumpDrive users and EMR patients
-- into a single "patients" table
--
-- ⚠️  IMPORTANT: Run 01-check-current-data.sql FIRST!
-- =====================================================

-- Step 1: Add PumpDrive fields to patients table
SELECT 'Step 1: Adding PumpDrive fields to patients table...' as status;

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS pumpdrive_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pumpdrive_signup_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pumpdrive_last_assessment TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assessments_completed INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(50) DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMPTZ;

-- Add comment documentation
COMMENT ON COLUMN public.patients.pumpdrive_enabled IS 'Whether patient has access to PumpDrive assessments';
COMMENT ON COLUMN public.patients.assessments_completed IS 'Total number of pump assessments completed';

SELECT '✓ PumpDrive fields added to patients table' as status;

-- Step 2: Migrate data from pump_users to patients
SELECT 'Step 2: Migrating pump_users data into patients table...' as status;

-- Insert pump_users as new patients (if they don't already exist by email)
INSERT INTO public.patients (
  auth_user_id,
  first_name,
  last_name,
  email,
  phone,
  pumpdrive_enabled,
  pumpdrive_signup_date,
  pumpdrive_last_assessment,
  assessments_completed,
  subscription_tier,
  trial_end_date,
  is_active,
  created_at,
  created_by
)
SELECT
  pu.auth_user_id,
  pu.first_name,
  pu.last_name,
  pu.email,
  pu.phone_number as phone,
  TRUE as pumpdrive_enabled, -- They signed up for PumpDrive
  pu.created_at as pumpdrive_signup_date,
  pu.last_assessment_date as pumpdrive_last_assessment,
  COALESCE(pu.assessments_completed, 0) as assessments_completed,
  COALESCE(pu.subscription_tier, 'free') as subscription_tier,
  pu.trial_end_date,
  pu.is_active,
  pu.created_at,
  pu.auth_user_id as created_by
FROM pump_users pu
WHERE NOT EXISTS (
  -- Don't insert if email already exists in patients
  SELECT 1 FROM patients p
  WHERE LOWER(p.email) = LOWER(pu.email)
)
AND pu.email IS NOT NULL; -- Only migrate users with email

SELECT '✓ Pump users migrated to patients table' as status;

-- Step 3: For users that exist in BOTH tables, update patients with PumpDrive data
SELECT 'Step 3: Updating existing patients with PumpDrive data...' as status;

UPDATE public.patients p
SET
  pumpdrive_enabled = TRUE,
  pumpdrive_signup_date = COALESCE(p.pumpdrive_signup_date, pu.created_at),
  pumpdrive_last_assessment = GREATEST(p.pumpdrive_last_assessment, pu.last_assessment_date),
  assessments_completed = COALESCE(p.assessments_completed, 0) + COALESCE(pu.assessments_completed, 0),
  subscription_tier = COALESCE(pu.subscription_tier, p.subscription_tier, 'free'),
  trial_end_date = COALESCE(pu.trial_end_date, p.trial_end_date),
  updated_at = NOW()
FROM pump_users pu
WHERE LOWER(p.email) = LOWER(pu.email);

SELECT '✓ Existing patients updated with PumpDrive data' as status;

-- Step 4: Create mapping table (temporary - for pump_assessments migration)
SELECT 'Step 4: Creating temporary user mapping table...' as status;

CREATE TEMP TABLE user_migration_mapping AS
SELECT
  pu.id as old_pump_user_id,
  p.id as new_patient_id,
  pu.email
FROM pump_users pu
INNER JOIN patients p ON LOWER(pu.email) = LOWER(p.email);

SELECT '✓ Created mapping table with ' || COUNT(*) || ' mappings' as status
FROM user_migration_mapping;

-- Step 5: Update pump_assessments to point to patients
SELECT 'Step 5: Updating pump_assessments foreign keys...' as status;

-- First, add new column if it doesn't exist
ALTER TABLE public.pump_assessments
  ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE;

-- Update pump_assessments to use new patient_id
UPDATE public.pump_assessments pa
SET patient_id = m.new_patient_id
FROM user_migration_mapping m
WHERE pa.user_id = m.old_pump_user_id;

SELECT '✓ Updated ' || COUNT(*) || ' pump assessments' as status
FROM pump_assessments WHERE patient_id IS NOT NULL;

-- Step 6: Verify migration
SELECT 'Step 6: Verifying migration...' as status;

-- Check for orphaned assessments
SELECT
  COUNT(*) as orphaned_assessments,
  CASE
    WHEN COUNT(*) = 0 THEN '✓ All assessments linked to patients'
    WHEN COUNT(*) < 5 THEN '⚠️  Few orphaned assessments - acceptable'
    ELSE '❌ Many orphaned assessments - investigate!'
  END as verification
FROM pump_assessments
WHERE patient_id IS NULL AND user_id IS NOT NULL;

-- Summary
SELECT '========================================' as summary;
SELECT 'MIGRATION SUMMARY:' as summary;
SELECT '========================================' as summary;

SELECT
  (SELECT COUNT(*) FROM patients WHERE pumpdrive_enabled = TRUE) as pumpdrive_patients,
  (SELECT COUNT(*) FROM patients WHERE pumpdrive_enabled = FALSE) as emr_only_patients,
  (SELECT COUNT(*) FROM pump_assessments WHERE patient_id IS NOT NULL) as migrated_assessments,
  (SELECT COUNT(*) FROM pump_assessments WHERE patient_id IS NULL) as orphaned_assessments;

-- Step 7: Instructions for next steps
SELECT '========================================' as next_steps;
SELECT 'NEXT STEPS:' as next_steps;
SELECT '1. Review the summary above' as next_steps
UNION ALL SELECT '2. If all looks good, run: 03-finalize-migration.sql'
UNION ALL SELECT '3. That script will drop old pump_users table'
UNION ALL SELECT '4. Do NOT run step 3 until you verify data is correct!';
SELECT '========================================' as next_steps;
