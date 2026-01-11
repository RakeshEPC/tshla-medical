-- ============================================================================
-- RLS POLICIES FOR TEMPLATES TABLE
-- ============================================================================
-- This is the SOURCE OF TRUTH for all RLS policies on the templates table.
--
-- CRITICAL: If you ever run this file and templates stop loading, it means
-- RLS policies were deleted (likely by an auth system change).
--
-- To restore policies: node scripts/restore-rls-policies.cjs
-- To validate policies: node scripts/validate-rls-policies.cjs
-- To backup current: node scripts/backup-rls-policies.cjs
--
-- Version: 1.0
-- Last Updated: 2026-01-11
-- Author: Rakesh Patel
-- ============================================================================

-- ============================================================================
-- POLICY 1: Allow authenticated users to read system templates
-- ============================================================================
-- Purpose: All logged-in staff can see system templates (is_system_template = true)
-- Applies to: 13 system templates (as of Jan 2026)
-- Example: "Comprehensive SOAP Note", "Diabetes Follow-up", etc.
-- ============================================================================

DROP POLICY IF EXISTS "Allow authenticated users to read system templates" ON public.templates;

CREATE POLICY "Allow authenticated users to read system templates"
ON public.templates
FOR SELECT
TO authenticated
USING (is_system_template = true);

-- ============================================================================
-- POLICY 2: Allow staff to read their own templates
-- ============================================================================
-- Purpose: Staff can see templates they created themselves
-- Logic: created_by must match their medical_staff.id
-- Requires: medical_staff.auth_user_id = auth.uid() (Supabase user ID)
-- ============================================================================

DROP POLICY IF EXISTS "Allow staff to read own templates" ON public.templates;

CREATE POLICY "Allow staff to read own templates"
ON public.templates
FOR SELECT
TO authenticated
USING (
  created_by IN (
    SELECT id FROM public.medical_staff
    WHERE auth_user_id = auth.uid()
  )
);

-- ============================================================================
-- POLICY 3: Allow authenticated users to read legacy templates
-- ============================================================================
-- Purpose: Legacy templates created before medical_staff migration (created_by IS NULL)
-- Applies to: 3 legacy templates (as of Jan 2026)
-- These have created_by = NULL because they existed before staff tracking
-- ============================================================================

DROP POLICY IF EXISTS "Allow authenticated users to read legacy templates" ON public.templates;

CREATE POLICY "Allow authenticated users to read legacy templates"
ON public.templates
FOR SELECT
TO authenticated
USING (created_by IS NULL);

-- ============================================================================
-- POLICY 4: Allow staff to insert (create) their own templates
-- ============================================================================
-- Purpose: Staff can create new templates
-- Logic: created_by must be their medical_staff.id on INSERT
-- ============================================================================

DROP POLICY IF EXISTS "Allow staff to insert own templates" ON public.templates;

CREATE POLICY "Allow staff to insert own templates"
ON public.templates
FOR INSERT
TO authenticated
WITH CHECK (
  created_by IN (
    SELECT id FROM public.medical_staff
    WHERE auth_user_id = auth.uid()
  )
);

-- ============================================================================
-- POLICY 5: Allow staff to update their own templates (not system templates)
-- ============================================================================
-- Purpose: Staff can edit templates they created
-- Logic: Must own the template AND it can't be a system template
-- ============================================================================

DROP POLICY IF EXISTS "Allow staff to update own templates" ON public.templates;

CREATE POLICY "Allow staff to update own templates"
ON public.templates
FOR UPDATE
TO authenticated
USING (
  created_by IN (
    SELECT id FROM public.medical_staff
    WHERE auth_user_id = auth.uid()
  )
  AND is_system_template = false
)
WITH CHECK (
  created_by IN (
    SELECT id FROM public.medical_staff
    WHERE auth_user_id = auth.uid()
  )
  AND is_system_template = false
);

-- ============================================================================
-- POLICY 6: Allow staff to delete their own templates (not system templates)
-- ============================================================================
-- Purpose: Staff can delete templates they created
-- Logic: Must own the template AND it can't be a system template
-- ============================================================================

DROP POLICY IF EXISTS "Allow staff to delete own templates" ON public.templates;

CREATE POLICY "Allow staff to delete own templates"
ON public.templates
FOR DELETE
TO authenticated
USING (
  created_by IN (
    SELECT id FROM public.medical_staff
    WHERE auth_user_id = auth.uid()
  )
  AND is_system_template = false
);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify policies were created successfully
-- ============================================================================

-- Check that RLS is enabled (should return true)
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'templates';

-- List all policies (should show 6 policies)
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'templates'
ORDER BY policyname;

-- Count policies (should return 6)
SELECT COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'templates';

-- ============================================================================
-- TEST QUERIES (Run as authenticated user to verify access)
-- ============================================================================

-- Test 1: Should return 13 system templates
SELECT COUNT(*) as system_template_count
FROM public.templates
WHERE is_system_template = true;

-- Test 2: Should return 3 legacy templates
SELECT COUNT(*) as legacy_template_count
FROM public.templates
WHERE created_by IS NULL;

-- Test 3: Total accessible templates (should be at least 16)
SELECT COUNT(*) as total_accessible
FROM public.templates;

-- ============================================================================
-- TROUBLESHOOTING
-- ============================================================================
-- If templates still don't load after running this file:
--
-- 1. Verify RLS is enabled:
--    SELECT tablename, rowsecurity FROM pg_tables
--    WHERE tablename = 'templates' AND schemaname = 'public';
--    Expected: rowsecurity = true
--
-- 2. Check policies exist:
--    SELECT COUNT(*) FROM pg_policies
--    WHERE tablename = 'templates' AND schemaname = 'public';
--    Expected: 6
--
-- 3. Verify auth.uid() is set (user is logged in):
--    SELECT auth.uid();
--    Expected: UUID (not null)
--
-- 4. Check medical_staff linkage:
--    SELECT id, email, auth_user_id FROM medical_staff
--    WHERE auth_user_id = auth.uid();
--    Expected: 1 row with matching auth_user_id
--
-- 5. Run diagnostic script:
--    node scripts/check-rls-policies.cjs
--
-- ============================================================================
-- MAINTENANCE NOTES
-- ============================================================================
--
-- WHEN TO UPDATE THIS FILE:
-- - Adding new template-related features
-- - Changing permission model
-- - Adding role-based access control
--
-- AFTER UPDATING:
-- 1. Run: node scripts/restore-rls-policies.cjs
-- 2. Test: Login and verify templates load
-- 3. Commit: git add supabase/policies/templates.sql && git commit
--
-- CRITICAL TIMES TO CHECK:
-- - After any Supabase auth changes (MFA, password policies, session changes)
-- - After Supabase dashboard upgrades
-- - If users report "no templates showing"
--
-- EMERGENCY RESTORE:
-- If policies deleted: node scripts/restore-rls-policies.cjs
--
-- ============================================================================
