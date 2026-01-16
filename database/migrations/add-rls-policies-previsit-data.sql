-- Add RLS policies for previsit_data table
-- This table was missing from the comprehensive RLS migration
-- Created: 2026-01-15

-- First ensure RLS is enabled
ALTER TABLE previsit_data ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies (clean slate)
DROP POLICY IF EXISTS "staff_manage_previsit_data" ON previsit_data;
DROP POLICY IF EXISTS "service_role_previsit_data" ON previsit_data;

-- Create policies for medical staff access
CREATE POLICY "staff_manage_previsit_data"
  ON previsit_data FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM medical_staff
      WHERE auth_user_id = auth.uid()
    )
  );

-- Create policy for service role (backend API)
CREATE POLICY "service_role_previsit_data"
  ON previsit_data FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Verify policies were created
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'previsit_data';

  IF policy_count >= 2 THEN
    RAISE NOTICE '✅ previsit_data has % RLS policies', policy_count;
  ELSE
    RAISE EXCEPTION '❌ previsit_data only has % policies (expected at least 2)', policy_count;
  END IF;
END $$;
