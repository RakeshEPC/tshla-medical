-- ============================================
-- PROPER RLS FIX for dictated_notes
-- Uses auth.uid() to match with medical_staff table
-- ============================================
-- Created: 2026-01-16
-- Purpose: Fix RLS policies to work with Supabase auth instead of session variables
-- Issue: Original policies used current_setting('app.current_provider_id') which frontend doesn't set
-- Solution: Use auth.uid() to lookup provider in medical_staff table
-- ============================================

-- First, remove the temporary policy
DROP POLICY IF EXISTS "Authenticated users can view all dictated notes" ON dictated_notes;

-- Remove old policies that use current_setting
DROP POLICY IF EXISTS "Providers can view their own notes" ON dictated_notes;
DROP POLICY IF EXISTS "Providers can create their own notes" ON dictated_notes;
DROP POLICY IF EXISTS "Providers can update their own notes" ON dictated_notes;

-- ============================================
-- SELECT POLICY - View dictated notes
-- ============================================
-- Providers can see their own notes OR admins can see all
CREATE POLICY "Providers can view dictated notes based on medical_staff"
ON dictated_notes
FOR SELECT
TO authenticated
USING (
  -- Match provider_id with medical_staff.id (cast to text)
  provider_id IN (
    SELECT id::text
    FROM medical_staff
    WHERE auth_user_id = auth.uid()
  )
  OR
  -- Allow admins to see all notes
  EXISTS (
    SELECT 1
    FROM medical_staff
    WHERE auth_user_id = auth.uid()
    AND role = 'admin'
  )
);

-- ============================================
-- INSERT POLICY - Create dictated notes
-- ============================================
-- Providers can only insert notes with their own provider_id
CREATE POLICY "Providers can insert dictated notes"
ON dictated_notes
FOR INSERT
TO authenticated
WITH CHECK (
  -- Can only insert with their own provider_id from medical_staff
  provider_id IN (
    SELECT id::text
    FROM medical_staff
    WHERE auth_user_id = auth.uid()
  )
);

-- ============================================
-- UPDATE POLICY - Modify dictated notes
-- ============================================
-- Providers can update their own notes (unless signed/final)
CREATE POLICY "Providers can update their dictated notes"
ON dictated_notes
FOR UPDATE
TO authenticated
USING (
  -- Can only update their own notes
  provider_id IN (
    SELECT id::text
    FROM medical_staff
    WHERE auth_user_id = auth.uid()
  )
  AND status NOT IN ('signed', 'final')  -- Cannot edit signed/final notes
)
WITH CHECK (
  -- Ensure provider_id doesn't change to someone else's
  provider_id IN (
    SELECT id::text
    FROM medical_staff
    WHERE auth_user_id = auth.uid()
  )
);

-- ============================================
-- VERIFICATION
-- ============================================

-- Check all policies on dictated_notes
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd
-- FROM pg_policies
-- WHERE tablename = 'dictated_notes'
-- ORDER BY policyname;

-- Test query as authenticated user (should work now)
-- SELECT COUNT(*) FROM dictated_notes;

-- ============================================
-- MIGRATION NOTES
-- ============================================
-- This replaces the session-variable-based RLS policies with proper Supabase auth-based policies
-- The new policies:
-- 1. Use auth.uid() to get current user's Supabase auth ID
-- 2. Join with medical_staff to get their provider_id
-- 3. Check if provider_id matches OR user is admin
--
-- Benefits:
-- - Works automatically with Supabase client authentication
-- - No need to set session variables from frontend
-- - Proper HIPAA compliance - providers only see their own notes (except admins)
-- - Secure - uses built-in Supabase auth system
-- ============================================
