-- Fix dictated_notes RLS to allow all authenticated users to see all dictations
-- Date: 2026-02-02
-- Purpose: Allow dictation history page to show all dictations to all users

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Providers can view their own notes" ON dictated_notes;
DROP POLICY IF EXISTS "Providers can create their own notes" ON dictated_notes;
DROP POLICY IF EXISTS "Providers can update their own notes" ON dictated_notes;

-- Create new permissive policies that allow all authenticated users to see all dictations
CREATE POLICY "Authenticated users can view all dictations" ON dictated_notes
  FOR SELECT USING (
    auth.role() = 'authenticated'
  );

CREATE POLICY "Authenticated users can create dictations" ON dictated_notes
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
  );

CREATE POLICY "Authenticated users can update dictations" ON dictated_notes
  FOR UPDATE USING (
    auth.role() = 'authenticated'
    AND status NOT IN ('signed', 'final')  -- Cannot edit signed notes
  );

CREATE POLICY "Authenticated users can delete dictations" ON dictated_notes
  FOR DELETE USING (
    auth.role() = 'authenticated'
  );

-- Ensure RLS is enabled
ALTER TABLE dictated_notes ENABLE ROW LEVEL SECURITY;
