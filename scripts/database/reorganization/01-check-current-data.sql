-- =====================================================
-- TSHLA Medical - Check Current Data Before Migration
-- Run this in Supabase SQL Editor to see what you have
-- =====================================================

-- 1. TABLE ROW COUNTS
SELECT '=== TABLE ROW COUNTS ===' as section;

SELECT
  relname as table_name,
  n_live_tup as row_count,
  CASE
    WHEN n_live_tup = 0 THEN 'EMPTY - can skip'
    WHEN n_live_tup < 10 THEN 'Has few rows'
    ELSE 'Has data'
  END as status
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND relname IN ('pump_users', 'patients', 'medical_staff', 'pump_assessments', 'access_logs')
ORDER BY n_live_tup DESC;

-- 2. PUMP_USERS DETAILS (will be merged into patients)
SELECT '' as spacer, '=== PUMP_USERS TABLE ===' as section;

SELECT
  COUNT(*) as total_pump_users,
  COUNT(CASE WHEN is_admin = TRUE THEN 1 END) as admin_users,
  COUNT(CASE WHEN auth_user_id IS NOT NULL THEN 1 END) as using_supabase_auth,
  COUNT(CASE WHEN auth_user_id IS NULL THEN 1 END) as legacy_auth_only
FROM pump_users;

-- 3. PATIENTS TABLE (EMR patients)
SELECT '' as spacer, '=== PATIENTS TABLE ===' as section;

SELECT
  COUNT(*) as total_patients,
  COUNT(CASE WHEN email IS NOT NULL THEN 1 END) as has_email,
  COUNT(CASE WHEN auth_user_id IS NOT NULL THEN 1 END) as can_login,
  COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_patients
FROM patients;

-- 4. MEDICAL_STAFF TABLE
SELECT '' as spacer, '=== MEDICAL_STAFF TABLE ===' as section;

SELECT
  COUNT(*) as total_staff,
  COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins,
  COUNT(CASE WHEN role = 'doctor' THEN 1 END) as doctors,
  COUNT(CASE WHEN auth_user_id IS NOT NULL THEN 1 END) as using_supabase_auth,
  COUNT(CASE WHEN password_hash IS NOT NULL THEN 1 END) as has_legacy_password
FROM medical_staff;

-- 5. PUMP_ASSESSMENTS TABLE
SELECT '' as spacer, '=== PUMP_ASSESSMENTS TABLE ===' as section;

SELECT
  COUNT(*) as total_assessments,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(CASE WHEN first_choice_pump IS NOT NULL THEN 1 END) as has_recommendations,
  MIN(created_at)::date as oldest_date,
  MAX(created_at)::date as newest_date
FROM pump_assessments;

-- 6. CHECK FOR DUPLICATES (same email in both tables)
SELECT '' as spacer, '=== DUPLICATE EMAILS (pump_users AND patients) ===' as section;

SELECT
  pu.email,
  pu.id as pump_user_id,
  p.id as patient_id,
  'DUPLICATE FOUND' as warning
FROM pump_users pu
INNER JOIN patients p ON LOWER(pu.email) = LOWER(p.email)
LIMIT 10;

-- 7. ORPHANED ASSESSMENTS (no valid user)
SELECT '' as spacer, '=== ORPHANED ASSESSMENTS CHECK ===' as section;

SELECT
  COUNT(*) as orphaned_assessments,
  CASE
    WHEN COUNT(*) = 0 THEN 'OK - All assessments have valid users'
    ELSE 'WARNING - Some assessments have invalid user_id'
  END as status
FROM pump_assessments pa
LEFT JOIN pump_users pu ON pa.user_id = pu.id
WHERE pu.id IS NULL;

-- 8. SUMMARY
SELECT '' as spacer, '=== MIGRATION DECISION ===' as section;

SELECT
  CASE
    WHEN (SELECT COUNT(*) FROM pump_users) = 0 THEN 'pump_users is EMPTY - Safe to delete table'
    WHEN (SELECT COUNT(*) FROM pump_users) < 5 THEN 'pump_users has few rows - Easy migration'
    ELSE 'pump_users has data - Need full migration'
  END as recommendation;
