-- Add RLS policy to allow authenticated users to read system templates
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/minvvjdflezibmgkplqb/sql/new

-- First, verify RLS is enabled (should show true)
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'templates' AND schemaname = 'public';

-- Check existing policies (should show none or incomplete policies)
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'templates' AND schemaname = 'public';

-- Policy 1: Allow authenticated users to read system templates
CREATE POLICY IF NOT EXISTS "Allow authenticated users to read system templates"
ON public.templates
FOR SELECT
TO authenticated
USING (is_system_template = true);

-- Policy 2: Allow staff to read their own templates
CREATE POLICY IF NOT EXISTS "Allow staff to read own templates"
ON public.templates
FOR SELECT
TO authenticated
USING (
  created_by IN (
    SELECT id FROM public.medical_staff
    WHERE auth_user_id = auth.uid()
  )
);

-- Policy 3: Allow staff to read legacy templates (created_by IS NULL)
CREATE POLICY IF NOT EXISTS "Allow authenticated users to read legacy templates"
ON public.templates
FOR SELECT
TO authenticated
USING (created_by IS NULL);

-- Verify policies were created
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'templates' AND schemaname = 'public'
ORDER BY policyname;

-- Test query (run as authenticated user to verify)
-- This should return system templates
SELECT COUNT(*) as system_template_count
FROM public.templates
WHERE is_system_template = true;

-- This should return legacy templates
SELECT COUNT(*) as legacy_template_count
FROM public.templates
WHERE created_by IS NULL;
