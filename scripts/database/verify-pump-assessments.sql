-- =====================================================
-- Verification Script for Pump Assessments
-- Run this to check if everything is set up correctly
-- =====================================================

-- 1. Check if table exists and has correct structure
SELECT
  'Table Structure Check' AS test_name,
  COUNT(*) AS column_count,
  CASE
    WHEN COUNT(*) >= 15 THEN '✅ PASS'
    ELSE '❌ FAIL - Missing columns'
  END AS status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'pump_assessments';

-- 2. List all columns
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'pump_assessments'
ORDER BY ordinal_position;

-- 3. Check RLS is enabled
SELECT
  'RLS Check' AS test_name,
  tablename,
  CASE
    WHEN rowsecurity THEN '✅ RLS ENABLED'
    ELSE '❌ RLS NOT ENABLED'
  END AS status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'pump_assessments';

-- 4. Check RLS policies exist
SELECT
  'RLS Policies Check' AS test_name,
  COUNT(*) AS policy_count,
  CASE
    WHEN COUNT(*) >= 3 THEN '✅ PASS'
    ELSE '❌ FAIL - Missing policies'
  END AS status
FROM pg_policies
WHERE tablename = 'pump_assessments';

-- 5. List all RLS policies
SELECT
  policyname,
  cmd AS operation,
  roles,
  CASE
    WHEN qual IS NOT NULL THEN 'Has USING clause'
    ELSE 'No USING clause'
  END AS using_check,
  CASE
    WHEN with_check IS NOT NULL THEN 'Has WITH CHECK clause'
    ELSE 'No WITH CHECK clause'
  END AS with_check_status
FROM pg_policies
WHERE tablename = 'pump_assessments'
ORDER BY policyname;

-- 6. Check indexes
SELECT
  'Indexes Check' AS test_name,
  COUNT(*) AS index_count,
  CASE
    WHEN COUNT(*) >= 2 THEN '✅ PASS'
    ELSE '⚠️ WARNING - Consider adding indexes'
  END AS status
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'pump_assessments';

-- 7. List all indexes
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'pump_assessments'
ORDER BY indexname;

-- 8. Check current user authentication
SELECT
  'Current User Check' AS test_name,
  auth.uid() AS current_auth_user_id,
  CASE
    WHEN auth.uid() IS NOT NULL THEN '✅ USER AUTHENTICATED'
    ELSE '❌ NOT AUTHENTICATED'
  END AS status;

-- 9. Check if current user has patient record
SELECT
  'Patient Record Check' AS test_name,
  p.id AS patient_id,
  p.email,
  p.first_name,
  p.last_name,
  p.pumpdrive_enabled,
  CASE
    WHEN p.id IS NOT NULL THEN '✅ PATIENT RECORD EXISTS'
    ELSE '❌ NO PATIENT RECORD'
  END AS status
FROM patients p
WHERE p.auth_user_id = auth.uid();

-- 10. Count existing assessments
SELECT
  'Existing Assessments Count' AS test_name,
  COUNT(*) AS total_assessments,
  COUNT(DISTINCT patient_id) AS unique_patients,
  CASE
    WHEN COUNT(*) > 0 THEN '✅ DATA EXISTS'
    ELSE 'ℹ️ NO DATA YET'
  END AS status
FROM pump_assessments;

-- 11. View recent assessments (if any)
SELECT
  id,
  patient_name,
  first_choice_pump,
  second_choice_pump,
  third_choice_pump,
  created_at
FROM pump_assessments
ORDER BY created_at DESC
LIMIT 5;

-- 12. Test INSERT permission (will fail if RLS blocks it)
-- Uncomment to test (WARNING: This will attempt to insert test data)
/*
DO $$
DECLARE
  test_patient_id UUID;
BEGIN
  -- Get current user's patient ID
  SELECT id INTO test_patient_id
  FROM patients
  WHERE auth_user_id = auth.uid();

  IF test_patient_id IS NOT NULL THEN
    -- Try to insert test data
    INSERT INTO pump_assessments (
      patient_id,
      patient_name,
      final_recommendation,
      first_choice_pump
    ) VALUES (
      test_patient_id,
      'TEST - Delete Me',
      '{"topChoice": {"name": "Test Pump", "score": 100, "reasons": []}}'::jsonb,
      'Test Pump'
    );

    RAISE NOTICE '✅ INSERT TEST PASSED - RLS allows inserts';

    -- Clean up test data
    DELETE FROM pump_assessments
    WHERE patient_name = 'TEST - Delete Me';

    RAISE NOTICE '✅ Cleanup complete';
  ELSE
    RAISE NOTICE '❌ Cannot test - No patient record for current user';
  END IF;
END $$;
*/

-- 13. Summary report
SELECT
  '=== SUMMARY ===' AS section,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'pump_assessments') AS total_columns,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'pump_assessments') AS total_policies,
  (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'pump_assessments') AS total_indexes,
  (SELECT COUNT(*) FROM pump_assessments) AS total_assessments,
  (SELECT rowsecurity FROM pg_tables WHERE tablename = 'pump_assessments') AS rls_enabled;
