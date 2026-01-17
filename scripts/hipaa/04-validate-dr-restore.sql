-- TSHLA Medical - Disaster Recovery Validation Script
-- HIPAA Compliance Task #2: Backup Restoration Test
-- Created: January 17, 2026
--
-- This script validates a restored database backup
-- HIPAA Requirement: §164.308(a)(7)(ii)(B) - Tested Contingency Plan

-- Run this script against the RESTORED test database, NOT production!

\echo '=========================================='
\echo 'TSHLA Medical - DR Validation'
\echo '=========================================='
\echo ''

-- Test 1: Table Count Verification
\echo '=== Test 1: Table Count ==='
\echo 'Checking number of tables in public schema...'
SELECT
  schemaname,
  COUNT(*) as table_count
FROM pg_tables
WHERE schemaname = 'public'
GROUP BY schemaname;

\echo 'Expected: ~40+ tables'
\echo ''

-- Test 2: Critical Tables - Record Counts
\echo '=== Test 2: Critical Tables - Record Counts ==='
\echo 'Verifying data presence in critical tables...'

SELECT
  'patients' as table_name,
  COUNT(*) as record_count,
  CASE WHEN COUNT(*) > 0 THEN '✓' ELSE '✗' END as status
FROM patients
UNION ALL
SELECT 'medical_staff', COUNT(*), CASE WHEN COUNT(*) > 0 THEN '✓' ELSE '✗' END FROM medical_staff
UNION ALL
SELECT 'appointments', COUNT(*), CASE WHEN COUNT(*) > 0 THEN '✓' ELSE '✗' END FROM appointments
UNION ALL
SELECT 'audit_logs', COUNT(*), CASE WHEN COUNT(*) > 0 THEN '✓' ELSE '✗' END FROM audit_logs
UNION ALL
SELECT 'pump_reports', COUNT(*), CASE WHEN COUNT(*) > 0 THEN '✓' ELSE '✗' END FROM pump_reports
UNION ALL
SELECT 'pump_assessments', COUNT(*), CASE WHEN COUNT(*) > 0 THEN '✓' ELSE '✗' END FROM pump_assessments
UNION ALL
SELECT 'dictated_notes', COUNT(*), CASE WHEN COUNT(*) > 0 THEN '✓' ELSE '✗' END FROM dictated_notes
UNION ALL
SELECT 'diabetes_education_patients', COUNT(*), CASE WHEN COUNT(*) > 0 THEN '✓' ELSE '✗' END FROM diabetes_education_patients
UNION ALL
SELECT 'previsit_data', COUNT(*), CASE WHEN COUNT(*) > 0 THEN '✓' ELSE '✗' END FROM previsit_data
UNION ALL
SELECT 'patient_payment_requests', COUNT(*), CASE WHEN COUNT(*) > 0 THEN '✓' ELSE '✗' END FROM patient_payment_requests;

\echo ''

-- Test 3: RLS Policy Verification
\echo '=== Test 3: RLS Policies ==='
\echo 'Verifying Row Level Security policies are intact...'

SELECT
  tablename,
  COUNT(*) as policy_count,
  CASE WHEN COUNT(*) > 0 THEN '✓ Protected' ELSE '✗ NO RLS' END as status
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
HAVING COUNT(*) > 0
ORDER BY policy_count DESC
LIMIT 20;

\echo ''
\echo 'Tables WITHOUT RLS (SECURITY RISK if they contain PHI):'
SELECT
  t.tablename,
  '✗ MISSING RLS' as status
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public'
  AND p.tablename IS NULL
  AND t.tablename NOT LIKE 'pg_%'
  AND t.tablename NOT IN ('schema_migrations', 'pump_comparisons', 'pump_dimensions')
ORDER BY t.tablename;

\echo ''

-- Test 4: Data Freshness Check (RPO Validation)
\echo '=== Test 4: Data Freshness (RPO Check) ==='
\echo 'Verifying backup is recent (< 24 hours old)...'

SELECT
  'appointments' as table_name,
  MAX(created_at) as latest_record,
  NOW() - MAX(created_at) as age,
  CASE
    WHEN NOW() - MAX(created_at) < INTERVAL '24 hours' THEN '✓ Fresh'
    WHEN NOW() - MAX(created_at) < INTERVAL '7 days' THEN '⚠ Stale'
    ELSE '✗ Very Old'
  END as status
FROM appointments
WHERE created_at IS NOT NULL

UNION ALL

SELECT
  'audit_logs',
  MAX(timestamp),
  NOW() - MAX(timestamp),
  CASE
    WHEN NOW() - MAX(timestamp) < INTERVAL '24 hours' THEN '✓ Fresh'
    WHEN NOW() - MAX(timestamp) < INTERVAL '7 days' THEN '⚠ Stale'
    ELSE '✗ Very Old'
  END
FROM audit_logs
WHERE timestamp IS NOT NULL

UNION ALL

SELECT
  'dictated_notes',
  MAX(created_at),
  NOW() - MAX(created_at),
  CASE
    WHEN NOW() - MAX(created_at) < INTERVAL '24 hours' THEN '✓ Fresh'
    WHEN NOW() - MAX(created_at) < INTERVAL '7 days' THEN '⚠ Stale'
    ELSE '✗ Very Old'
  END
FROM dictated_notes
WHERE created_at IS NOT NULL;

\echo 'Expected: Age < 24 hours for active production data'
\echo ''

-- Test 5: Audit Log Integrity
\echo '=== Test 5: Audit Log Integrity ==='
\echo 'Checking recent audit log activity...'

SELECT
  DATE(timestamp) as log_date,
  COUNT(*) as events,
  COUNT(DISTINCT user_id) as unique_users,
  CASE WHEN COUNT(*) > 0 THEN '✓' ELSE '✗' END as status
FROM audit_logs
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY DATE(timestamp)
ORDER BY log_date DESC
LIMIT 7;

\echo ''

-- Test 6: User Accounts and Authentication
\echo '=== Test 6: User Accounts ==='
\echo 'Verifying user accounts restored...'

SELECT
  'medical_staff' as table_name,
  COUNT(*) as total_users,
  COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins,
  COUNT(CASE WHEN role = 'doctor' THEN 1 END) as doctors,
  COUNT(CASE WHEN role = 'nurse' THEN 1 END) as nurses
FROM medical_staff
WHERE soft_deleted_at IS NULL;

\echo ''

-- Test 7: Database Size and Statistics
\echo '=== Test 7: Database Statistics ==='
\echo 'Overall database health...'

SELECT
  pg_size_pretty(pg_database_size(current_database())) as database_size,
  (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public') as total_tables,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') as total_policies,
  (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public') as total_indexes;

\echo ''

-- Test 8: Sample Data Integrity
\echo '=== Test 8: Sample Data Integrity ==='
\echo 'Spot-checking sample records for corruption...'

-- Check patients table
SELECT
  'patients' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN id IS NULL THEN 1 END) as null_ids,
  COUNT(CASE WHEN created_at IS NULL THEN 1 END) as null_created,
  CASE
    WHEN COUNT(CASE WHEN id IS NULL THEN 1 END) = 0 THEN '✓ No corruption'
    ELSE '✗ DATA CORRUPTION DETECTED'
  END as status
FROM patients;

\echo ''
\echo '=========================================='
\echo 'Validation Complete'
\echo '=========================================='
\echo ''
\echo 'Review the results above and document:'
\echo '  1. All tables restored: YES/NO'
\echo '  2. RLS policies intact: YES/NO'
\echo '  3. Data freshness: < 24 hours'
\echo '  4. Audit logs present: YES/NO'
\echo '  5. No data corruption: YES/NO'
\echo ''
\echo 'If all checks pass, the backup restoration is SUCCESSFUL.'
\echo 'Document results in: tests/DR_TEST_REPORT_YYYY_MM_DD.md'
\echo ''
