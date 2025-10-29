-- Fix RLS Policies for Schedule Import
-- Run this in Supabase Dashboard → SQL Editor

-- ========================================
-- 1. Fix schedule_imports table RLS
-- ========================================

-- Drop existing restrictive policies if any
DROP POLICY IF EXISTS "schedule_imports_admin_insert" ON schedule_imports;
DROP POLICY IF EXISTS "schedule_imports_admin_select" ON schedule_imports;
DROP POLICY IF EXISTS "schedule_imports_admin_update" ON schedule_imports;

-- Create policies allowing authenticated users (admins) to manage imports
CREATE POLICY "schedule_imports_authenticated_all"
ON schedule_imports
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ========================================
-- 2. Fix provider_schedules table RLS
-- ========================================

-- Drop existing restrictive policies if any
DROP POLICY IF EXISTS "provider_schedules_admin_insert" ON provider_schedules;
DROP POLICY IF EXISTS "provider_schedules_admin_select" ON provider_schedules;
DROP POLICY IF EXISTS "provider_schedules_admin_update" ON provider_schedules;
DROP POLICY IF EXISTS "provider_schedules_provider_select" ON provider_schedules;

-- Create policies allowing authenticated users to manage schedules
CREATE POLICY "provider_schedules_authenticated_all"
ON provider_schedules
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ========================================
-- 3. Fix schedule_note_links table RLS
-- ========================================

-- Drop existing restrictive policies if any
DROP POLICY IF EXISTS "schedule_note_links_admin_all" ON schedule_note_links;

-- Create policies allowing authenticated users to link notes
CREATE POLICY "schedule_note_links_authenticated_all"
ON schedule_note_links
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ========================================
-- 4. Verify RLS is enabled but policies allow access
-- ========================================

-- Check current RLS status
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('schedule_imports', 'provider_schedules', 'schedule_note_links')
  AND schemaname = 'public';

-- Check current policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('schedule_imports', 'provider_schedules', 'schedule_note_links')
ORDER BY tablename, policyname;

-- ========================================
-- Expected Output:
-- ========================================
-- All three tables should show:
-- - rls_enabled: true
-- - One policy per table: "tablename_authenticated_all"
-- - roles: {authenticated}
-- - cmd: ALL

-- ========================================
-- If you prefer more restrictive (admin-only) policies:
-- ========================================
-- Uncomment this section if you want only admins to manage schedules

-- DROP POLICY IF EXISTS "provider_schedules_authenticated_all" ON provider_schedules;
-- DROP POLICY IF EXISTS "schedule_imports_authenticated_all" ON schedule_imports;
-- DROP POLICY IF EXISTS "schedule_note_links_authenticated_all" ON schedule_note_links;

-- CREATE POLICY "provider_schedules_admin_all"
-- ON provider_schedules
-- FOR ALL
-- TO authenticated
-- USING (
--   EXISTS (
--     SELECT 1 FROM medical_staff
--     WHERE medical_staff.auth_user_id = auth.uid()
--     AND medical_staff.role IN ('admin', 'super_admin')
--   )
-- )
-- WITH CHECK (
--   EXISTS (
--     SELECT 1 FROM medical_staff
--     WHERE medical_staff.auth_user_id = auth.uid()
--     AND medical_staff.role IN ('admin', 'super_admin')
--   )
-- );

-- CREATE POLICY "schedule_imports_admin_all"
-- ON schedule_imports
-- FOR ALL
-- TO authenticated
-- USING (
--   EXISTS (
--     SELECT 1 FROM medical_staff
--     WHERE medical_staff.auth_user_id = auth.uid()
--     AND medical_staff.role IN ('admin', 'super_admin')
--   )
-- )
-- WITH CHECK (
--   EXISTS (
--     SELECT 1 FROM medical_staff
--     WHERE medical_staff.auth_user_id = auth.uid()
--     AND medical_staff.role IN ('admin', 'super_admin')
--   )
-- );

-- ========================================
-- Done!
-- ========================================
-- After running this, try uploading your schedule again.
-- The 403 and 406 errors should be gone.
