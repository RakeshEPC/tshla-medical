-- =====================================================
-- Check Patient Data in unified_patients
-- =====================================================

-- 1. Check total patients
SELECT
  COUNT(*) as total_patients,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_patients,
  COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_patients
FROM unified_patients;


-- 2. Search for "rakesh" (what you typed)
SELECT
  id,
  patient_id,
  first_name,
  last_name,
  full_name,
  phone_primary,
  email,
  mrn,
  is_active
FROM unified_patients
WHERE is_active = true
  AND (
    first_name ILIKE '%rakesh%'
    OR last_name ILIKE '%rakesh%'
    OR full_name ILIKE '%rakesh%'
  )
LIMIT 10;


-- 3. List first 20 active patients (to see what's actually there)
SELECT
  id,
  patient_id,
  first_name,
  last_name,
  full_name,
  phone_primary,
  email,
  is_active
FROM unified_patients
WHERE is_active = true
ORDER BY created_at DESC
LIMIT 20;


-- 4. Check if unified_patients table exists and has correct structure
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'unified_patients'
  AND column_name IN ('id', 'first_name', 'last_name', 'full_name', 'phone_primary', 'is_active')
ORDER BY ordinal_position;
