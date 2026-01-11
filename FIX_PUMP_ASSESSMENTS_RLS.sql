-- Fix RLS policies on pump_assessments table
-- Allow patients to view and update their own assessments

-- Drop existing policies if any
DROP POLICY IF EXISTS "Patients can view own assessments" ON public.pump_assessments;
DROP POLICY IF EXISTS "Patients can insert own assessments" ON public.pump_assessments;
DROP POLICY IF EXISTS "Patients can update own assessments" ON public.pump_assessments;
DROP POLICY IF EXISTS "Allow assessment access for authenticated users" ON public.pump_assessments;

-- Enable RLS if not already enabled
ALTER TABLE public.pump_assessments ENABLE ROW LEVEL SECURITY;

-- Allow patients to view their own assessments
-- Match on patient_id (which is patients.id)
CREATE POLICY "Patients can view own assessments"
  ON public.pump_assessments
  FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM public.patients WHERE auth_user_id = auth.uid()
    )
  );

-- Allow patients to insert their own assessments
CREATE POLICY "Patients can insert own assessments"
  ON public.pump_assessments
  FOR INSERT
  WITH CHECK (
    patient_id IN (
      SELECT id FROM public.patients WHERE auth_user_id = auth.uid()
    )
  );

-- Allow patients to update their own assessments
CREATE POLICY "Patients can update own assessments"
  ON public.pump_assessments
  FOR UPDATE
  USING (
    patient_id IN (
      SELECT id FROM public.patients WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    patient_id IN (
      SELECT id FROM public.patients WHERE auth_user_id = auth.uid()
    )
  );

-- Verify the policies were created
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'pump_assessments'
ORDER BY policyname;
