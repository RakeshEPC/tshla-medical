-- =====================================================
-- FIX: Allow Pump User Registration (RLS Policy Fix)
-- =====================================================
-- Issue: RLS policies blocking anonymous pump user registration
-- Tables affected: patients, access_logs
-- Created: 2026-01-08
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: Add missing access_logs table RLS
-- =====================================================

-- Enable RLS if not already enabled
ALTER TABLE IF EXISTS access_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "service_role_all_access_logs" ON access_logs;
DROP POLICY IF EXISTS "allow_insert_access_logs" ON access_logs;

-- Service role can do everything
CREATE POLICY "service_role_all_access_logs"
ON access_logs
FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- Allow INSERT for anonymous users (for registration logging)
CREATE POLICY "allow_insert_access_logs"
ON access_logs
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- =====================================================
-- STEP 2: Fix patients table RLS for registration
-- =====================================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "allow_insert_patients" ON patients;
DROP POLICY IF EXISTS "allow_anon_insert_patients" ON patients;

-- Allow INSERT for anonymous pump user registration
CREATE POLICY "allow_anon_insert_patients"
ON patients
FOR INSERT
TO anon, authenticated
WITH CHECK (
  -- Only allow if pumpdrive_enabled is true (pump tool registration)
  pumpdrive_enabled = true
);

-- Allow users to read their own patient record
CREATE POLICY "users_read_own_patient"
ON patients
FOR SELECT
TO authenticated
USING (
  email = (auth.jwt()->>'email')::text
  OR id::text = (auth.jwt()->>'userId')::text
);

-- =====================================================
-- STEP 3: Verification
-- =====================================================

DO $$
DECLARE
    access_logs_policies INTEGER;
    patients_policies INTEGER;
BEGIN
    -- Count policies
    SELECT COUNT(*) INTO access_logs_policies
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'access_logs';

    SELECT COUNT(*) INTO patients_policies
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'patients';

    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICATION RESULTS';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'access_logs policies: %', access_logs_policies;
    RAISE NOTICE 'patients policies: %', patients_policies;
    RAISE NOTICE '';

    IF access_logs_policies >= 2 AND patients_policies >= 3 THEN
        RAISE NOTICE '✅ RLS policies successfully created';
    ELSE
        RAISE WARNING '⚠️ Expected at least 2 access_logs and 3 patients policies';
    END IF;
END $$;

-- Display current policies
SELECT
    tablename,
    policyname,
    cmd as command,
    roles,
    qual::text as using_clause,
    with_check::text as with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('patients', 'access_logs')
ORDER BY tablename, policyname;

COMMIT;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ PUMP REGISTRATION RLS FIX COMPLETE';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'What was fixed:';
    RAISE NOTICE '1. Added access_logs table RLS policies';
    RAISE NOTICE '2. Allow anonymous INSERT into patients (pump registration only)';
    RAISE NOTICE '3. Allow users to read their own patient record';
    RAISE NOTICE '';
    RAISE NOTICE 'You can now create pump user accounts!';
    RAISE NOTICE '========================================';
END $$;
