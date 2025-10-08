-- =====================================================
-- TSHLA Medical - Pre-Migration Data Check
-- Run this FIRST to see what data you have
-- =====================================================
-- Run in Supabase SQL Editor
-- =====================================================

\echo '========================================';
\echo 'TSHLA MEDICAL - PRE-MIGRATION DATA CHECK';
\echo '========================================';
\echo '';

-- Check all tables and row counts
\echo '1. TABLE ROW COUNTS:';
\echo '--------------------';
SELECT
  schemaname,
  relname as table_name,
  n_live_tup as row_count,
  CASE
    WHEN n_live_tup = 0 THEN '⚠️  EMPTY'
    WHEN n_live_tup < 10 THEN '✓ Few rows'
    ELSE '✓ Has data'
  END as status
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND relname IN ('pump_users', 'patients', 'medical_staff', 'pump_assessments', 'access_logs')
ORDER BY n_live_tup DESC;

\echo '';
\echo '2. PUMP_USERS TABLE (will be merged into patients):';
\echo '----------------------------------------------------';
SELECT
  'pump_users' as table_name,
  COUNT(*) as total_count,
  COUNT(CASE WHEN is_admin = TRUE THEN 1 END) as admin_count,
  COUNT(CASE WHEN auth_user_id IS NOT NULL THEN 1 END) as linked_to_supabase_auth,
  COUNT(CASE WHEN auth_user_id IS NULL THEN 1 END) as legacy_auth_only
FROM pump_users;

\echo '';
\echo '3. PATIENTS TABLE (EMR patients):';
\echo '----------------------------------';
SELECT
  'patients' as table_name,
  COUNT(*) as total_count,
  COUNT(CASE WHEN email IS NOT NULL THEN 1 END) as has_email,
  COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_patients
FROM patients;

\echo '';
\echo '4. MEDICAL_STAFF TABLE:';
\echo '------------------------';
SELECT
  'medical_staff' as table_name,
  COUNT(*) as total_count,
  COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_count,
  COUNT(CASE WHEN role = 'doctor' THEN 1 END) as doctor_count,
  COUNT(CASE WHEN role IN ('nurse', 'staff', 'medical_assistant') THEN 1 END) as support_staff_count,
  COUNT(CASE WHEN auth_user_id IS NOT NULL THEN 1 END) as linked_to_supabase_auth,
  COUNT(CASE WHEN password_hash IS NOT NULL THEN 1 END) as has_legacy_password
FROM medical_staff;

\echo '';
\echo '5. PUMP_ASSESSMENTS TABLE:';
\echo '----------------------------';
SELECT
  'pump_assessments' as table_name,
  COUNT(*) as total_assessments,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(CASE WHEN first_choice_pump IS NOT NULL THEN 1 END) as has_recommendations,
  MIN(created_at) as oldest_assessment,
  MAX(created_at) as newest_assessment
FROM pump_assessments;

\echo '';
\echo '6. CHECK FOR DUPLICATE USERS (same email in pump_users AND patients):';
\echo '----------------------------------------------------------------------';
SELECT
  pu.email,
  pu.id as pump_user_id,
  p.id as patient_id,
  '⚠️  DUPLICATE' as warning
FROM pump_users pu
INNER JOIN patients p ON LOWER(pu.email) = LOWER(p.email)
LIMIT 10;

\echo '';
\echo '7. ORPHANED ASSESSMENTS (assessments without valid user):';
\echo '----------------------------------------------------------';
SELECT
  COUNT(*) as orphaned_count,
  CASE
    WHEN COUNT(*) = 0 THEN '✓ All assessments have valid users'
    ELSE '⚠️  Some assessments have invalid user_id'
  END as status
FROM pump_assessments pa
LEFT JOIN pump_users pu ON pa.user_id = pu.id
WHERE pu.id IS NULL;

\echo '';
\echo '8. AUTHENTICATION CHECK:';
\echo '-------------------------';
SELECT
  'Users with Supabase Auth' as category,
  (SELECT COUNT(*) FROM pump_users WHERE auth_user_id IS NOT NULL) +
  (SELECT COUNT(*) FROM medical_staff WHERE auth_user_id IS NOT NULL) as count
UNION ALL
SELECT
  'Users with Legacy Auth Only' as category,
  (SELECT COUNT(*) FROM pump_users WHERE auth_user_id IS NULL) +
  (SELECT COUNT(*) FROM medical_staff WHERE auth_user_id IS NULL AND password_hash IS NOT NULL) as count;

\echo '';
\echo '========================================';
\echo 'PRE-MIGRATION CHECK COMPLETE';
\echo '';
\echo 'NEXT STEPS:';
\echo '1. Review the counts above';
\echo '2. If pump_users is EMPTY, you can skip migration';
\echo '3. If pump_users has data, run migration script';
\echo '4. Check for duplicates before merging';
\echo '========================================';
