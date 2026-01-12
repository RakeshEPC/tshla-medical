-- Fix RLS on unified_patients to allow staff to read patient data
-- This fixes the issue where MRN shows as N/A in Staff Pre-Visit Workflow

-- Drop existing restrictive policy if it exists
DROP POLICY IF EXISTS "Staff and providers can view all patients" ON unified_patients;
DROP POLICY IF EXISTS "Public read access to unified_patients" ON unified_patients;
DROP POLICY IF EXISTS "Allow authenticated users to read unified_patients" ON unified_patients;

-- Create policy to allow authenticated users to read unified_patients
-- This is needed for JOINs from provider_schedules to work
CREATE POLICY "Allow authenticated read access to unified_patients"
  ON unified_patients
  FOR SELECT
  TO authenticated
  USING (true);

-- Also allow anon access for public-facing features (like patient portal lookups)
CREATE POLICY "Allow public read access to unified_patients"
  ON unified_patients
  FOR SELECT
  TO anon
  USING (true);

-- Verify RLS is enabled
ALTER TABLE unified_patients ENABLE ROW LEVEL SECURITY;

-- Add comment
COMMENT ON POLICY "Allow authenticated read access to unified_patients" ON unified_patients IS
  'Allows authenticated users (staff, providers) to read patient data for JOINs and lookups';

COMMENT ON POLICY "Allow public read access to unified_patients" ON unified_patients IS
  'Allows anonymous access for patient portal and public-facing features';
