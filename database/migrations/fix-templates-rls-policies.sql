-- =====================================================
-- FIX ROW-LEVEL SECURITY POLICIES FOR templates TABLE
-- =====================================================
-- Purpose: Allow authenticated users to create, read, update, delete templates
-- Run this in Supabase SQL Editor
-- =====================================================

BEGIN;

-- First, check if RLS is enabled (it should be for security)
-- We'll keep it enabled but add proper policies

-- Drop existing policies if they exist (to start fresh)
DROP POLICY IF EXISTS "Users can view all templates" ON templates;
DROP POLICY IF EXISTS "Users can view templates" ON templates;
DROP POLICY IF EXISTS "Users can insert templates" ON templates;
DROP POLICY IF EXISTS "Users can create templates" ON templates;
DROP POLICY IF EXISTS "Users can update their own templates" ON templates;
DROP POLICY IF EXISTS "Users can update templates" ON templates;
DROP POLICY IF EXISTS "Users can delete their own templates" ON templates;
DROP POLICY IF EXISTS "Users can delete templates" ON templates;

-- Enable RLS on templates table (if not already enabled)
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- Policy 1: SELECT - Users can view all templates (system templates + their own + shared)
CREATE POLICY "Users can view all templates"
  ON templates
  FOR SELECT
  TO authenticated
  USING (true);  -- All authenticated users can read all templates

-- Policy 2: INSERT - Authenticated users can create templates
CREATE POLICY "Users can create templates"
  ON templates
  FOR INSERT
  TO authenticated
  WITH CHECK (true);  -- Any authenticated user can create a template

-- Policy 3: UPDATE - Users can update templates they created OR system templates
CREATE POLICY "Users can update templates"
  ON templates
  FOR UPDATE
  TO authenticated
  USING (
    created_by IS NULL  -- System templates (no owner)
    OR
    created_by IN (
      SELECT id FROM medical_staff
      WHERE auth_user_id = auth.uid()
    )  -- Templates created by current user's medical_staff record
  )
  WITH CHECK (
    created_by IS NULL
    OR
    created_by IN (
      SELECT id FROM medical_staff
      WHERE auth_user_id = auth.uid()
    )
  );

-- Policy 4: DELETE - Users can delete templates they created (but not system templates)
CREATE POLICY "Users can delete their templates"
  ON templates
  FOR DELETE
  TO authenticated
  USING (
    created_by IS NOT NULL  -- Can't delete system templates (created_by IS NULL)
    AND
    created_by IN (
      SELECT id FROM medical_staff
      WHERE auth_user_id = auth.uid()
    )  -- Can only delete templates created by current user
  );

-- Add helpful comments
COMMENT ON POLICY "Users can view all templates" ON templates IS
  'All authenticated users can view all templates (system and user-created)';

COMMENT ON POLICY "Users can create templates" ON templates IS
  'Authenticated users can create new templates';

COMMENT ON POLICY "Users can update templates" ON templates IS
  'Users can update their own templates or system templates';

COMMENT ON POLICY "Users can delete their templates" ON templates IS
  'Users can delete only their own templates, not system templates';

SELECT 'RLS policies updated successfully for templates table' as status;

COMMIT;
