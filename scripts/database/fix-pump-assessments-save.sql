-- =====================================================
-- Fix Pump Assessments Table for Saving
-- Run this in Supabase SQL Editor to fix save issues
-- =====================================================
-- Created: 2025-10-10
-- Purpose: Ensure pump_assessments table exists with correct schema and RLS policies
-- =====================================================

-- Step 1: Ensure pump_assessments table exists with correct structure
CREATE TABLE IF NOT EXISTS public.pump_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Patient reference (UUID from patients table)
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  patient_name VARCHAR(255),

  -- Assessment data (JSONB for flexibility)
  slider_values JSONB DEFAULT '{}'::jsonb,
  selected_features JSONB DEFAULT '[]'::jsonb,
  lifestyle_text TEXT,
  challenges_text TEXT,
  priorities_text TEXT,
  clarification_responses JSONB DEFAULT '{}'::jsonb,

  -- AI Recommendation (complete structure from frontend)
  final_recommendation JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Pump choices (extracted for analytics)
  first_choice_pump VARCHAR(255),
  second_choice_pump VARCHAR(255),
  third_choice_pump VARCHAR(255),
  recommendation_date TIMESTAMPTZ DEFAULT NOW(),
  assessment_version INTEGER DEFAULT 1,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Add missing columns if they don't exist
ALTER TABLE public.pump_assessments
  ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS patient_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS slider_values JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS selected_features JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS lifestyle_text TEXT,
  ADD COLUMN IF NOT EXISTS challenges_text TEXT,
  ADD COLUMN IF NOT EXISTS priorities_text TEXT,
  ADD COLUMN IF NOT EXISTS clarification_responses JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS final_recommendation JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS first_choice_pump VARCHAR(255),
  ADD COLUMN IF NOT EXISTS second_choice_pump VARCHAR(255),
  ADD COLUMN IF NOT EXISTS third_choice_pump VARCHAR(255),
  ADD COLUMN IF NOT EXISTS recommendation_date TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS assessment_version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pump_assessments_patient_id
  ON public.pump_assessments(patient_id);

CREATE INDEX IF NOT EXISTS idx_pump_assessments_created_at
  ON public.pump_assessments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pump_assessments_first_choice
  ON public.pump_assessments(first_choice_pump);

-- Step 4: Enable Row Level Security
ALTER TABLE public.pump_assessments ENABLE ROW LEVEL SECURITY;

-- Step 5: Drop existing policies to recreate them (avoid conflicts)
DROP POLICY IF EXISTS "Patients can view own assessments" ON public.pump_assessments;
DROP POLICY IF EXISTS "Patients can create own assessments" ON public.pump_assessments;
DROP POLICY IF EXISTS "Patients can insert own assessments" ON public.pump_assessments;
DROP POLICY IF EXISTS "Staff can view all assessments" ON public.pump_assessments;
DROP POLICY IF EXISTS "Service role has full access" ON public.pump_assessments;

-- Step 6: Create RLS policies that actually work
-- Policy 1: Patients can INSERT their own assessments
CREATE POLICY "Patients can insert own assessments"
  ON public.pump_assessments
  FOR INSERT
  WITH CHECK (
    patient_id IN (
      SELECT id FROM public.patients
      WHERE auth_user_id = auth.uid()
    )
  );

-- Policy 2: Patients can SELECT their own assessments
CREATE POLICY "Patients can view own assessments"
  ON public.pump_assessments
  FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM public.patients
      WHERE auth_user_id = auth.uid()
    )
  );

-- Policy 3: Medical staff can view all assessments
CREATE POLICY "Staff can view all assessments"
  ON public.pump_assessments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.medical_staff
      WHERE auth_user_id = auth.uid() AND is_active = true
    )
  );

-- Policy 4: Service role bypass (for backend operations)
CREATE POLICY "Service role full access"
  ON public.pump_assessments
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Step 7: Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.pump_assessments TO authenticated;
GRANT SELECT ON public.pump_assessments TO anon;

-- Step 8: Add helpful comments
COMMENT ON TABLE public.pump_assessments IS 'Stores pump assessment data and AI recommendations for patients';
COMMENT ON COLUMN public.pump_assessments.patient_id IS 'References patients.id (NOT auth.users.id)';
COMMENT ON COLUMN public.pump_assessments.final_recommendation IS 'Complete AI recommendation object from frontend';
COMMENT ON COLUMN public.pump_assessments.slider_values IS 'User preference sliders from assessment';
COMMENT ON COLUMN public.pump_assessments.selected_features IS 'Features selected during assessment';

-- Step 9: Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_pump_assessments_updated_at ON public.pump_assessments;

CREATE TRIGGER update_pump_assessments_updated_at
  BEFORE UPDATE ON public.pump_assessments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 10: Verify the setup
SELECT
  'SUCCESS! Pump assessments table configured' AS status,
  COUNT(*) AS total_assessments,
  COUNT(DISTINCT patient_id) AS unique_patients
FROM public.pump_assessments;

-- Step 11: Show column structure
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'pump_assessments'
ORDER BY ordinal_position;

-- Step 12: Show RLS policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'pump_assessments';
