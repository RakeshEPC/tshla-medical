-- =====================================================
-- Debug Provider Loading Issue
-- =====================================================

-- 1. Check how many providers have athena_provider_id
SELECT
  COUNT(*) as total_active_providers,
  COUNT(athena_provider_id) as with_athena_mapping
FROM medical_staff
WHERE is_active = true;

-- Expected: total_active_providers ~18, with_athena_mapping ~17


-- 2. Check what roles exist and their counts
SELECT
  role,
  COUNT(*) as count,
  COUNT(athena_provider_id) as with_mapping
FROM medical_staff
WHERE is_active = true
GROUP BY role
ORDER BY count DESC;

-- Should show: doctor, nurse_practitioner, therapist, psychologist, dietitian, admin


-- 3. List ALL providers that SHOULD show in dropdown
-- This is the EXACT query the app runs:
SELECT
  id,
  email,
  first_name,
  last_name,
  role,
  specialty,
  athena_provider_id,
  first_name || ' ' || last_name as full_name
FROM medical_staff
WHERE role IN (
  'doctor',
  'nurse_practitioner',
  'physician_assistant',
  'dietitian',
  'nutritionist',
  'therapist',
  'psychologist',
  'psychiatrist',
  'social_worker',
  'counselor',
  'pharmacist',
  'care_coordinator'
)
  AND is_active = true
  AND athena_provider_id IS NOT NULL
ORDER BY last_name;

-- This should return ~17 rows
-- If it returns only 2, that's the problem


-- 4. Check if there are providers WITHOUT athena_provider_id
SELECT
  first_name,
  last_name,
  role,
  email,
  athena_provider_id,
  '❌ MISSING ATHENA ID' as issue
FROM medical_staff
WHERE is_active = true
  AND role IN ('doctor', 'nurse_practitioner', 'physician_assistant', 'dietitian', 'therapist', 'psychologist')
  AND athena_provider_id IS NULL
ORDER BY last_name;

-- If this returns rows, those providers won't show in dropdown


-- 5. Check for duplicates with/without mapping
SELECT
  last_name,
  first_name,
  COUNT(*) as duplicate_count,
  COUNT(athena_provider_id) as mapped_count,
  STRING_AGG(athena_provider_id::text, ', ') as athena_ids
FROM medical_staff
WHERE is_active = true
GROUP BY last_name, first_name
HAVING COUNT(*) > 1
ORDER BY last_name;

-- Shows if same person exists multiple times
