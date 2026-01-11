-- =====================================================
-- Fix RLS Policies for Patient Registration
-- =====================================================
-- Created: 2026-01-09
-- Purpose: Allow new patients to register without being authenticated first
-- Issue: RLS was blocking account creation during registration
-- Table: patients (not pump_users)

-- =====================================================
-- Fix patients table RLS policies
-- =====================================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.patients;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.patients;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.patients;
DROP POLICY IF EXISTS "Patients can view own data" ON public.patients;
DROP POLICY IF EXISTS "Patients can update own data" ON public.patients;
DROP POLICY IF EXISTS "Allow patient registration" ON public.patients;

-- Allow INSERT for new user registration (during signup, user is not yet authenticated)
CREATE POLICY "Allow patient registration"
  ON public.patients
  FOR INSERT
  WITH CHECK (true);

-- Allow users to view their own profile
CREATE POLICY "Patients can view own data"
  ON public.patients
  FOR SELECT
  USING (auth.uid() = auth_user_id);

-- Allow users to update their own profile
CREATE POLICY "Patients can update own data"
  ON public.patients
  FOR UPDATE
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

-- =====================================================
-- Fix pump_assessments table RLS policies
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own assessments" ON public.pump_assessments;
DROP POLICY IF EXISTS "Users can insert their own assessments" ON public.pump_assessments;
DROP POLICY IF EXISTS "Users can update their own assessments" ON public.pump_assessments;
DROP POLICY IF EXISTS "Patients can view own assessments" ON public.pump_assessments;
DROP POLICY IF EXISTS "Patients can create own assessments" ON public.pump_assessments;
DROP POLICY IF EXISTS "Patients can update own assessments" ON public.pump_assessments;

-- Allow users to view their own assessments
CREATE POLICY "Patients can view own assessments"
  ON public.pump_assessments
  FOR SELECT
  USING (auth.uid() = patient_id);

-- Allow authenticated users to create assessments
CREATE POLICY "Patients can create own assessments"
  ON public.pump_assessments
  FOR INSERT
  WITH CHECK (auth.uid() = patient_id);

-- Allow users to update their own assessments
CREATE POLICY "Patients can update own assessments"
  ON public.pump_assessments
  FOR UPDATE
  USING (auth.uid() = patient_id)
  WITH CHECK (auth.uid() = patient_id);

-- =====================================================
-- Verify RLS is enabled
-- =====================================================
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pump_assessments ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Add comments
-- =====================================================
COMMENT ON POLICY "Allow patient registration" ON public.patients IS
  'Allows new users to create their profile during registration (before authentication)';
COMMENT ON POLICY "Patients can view own data" ON public.patients IS
  'Users can only view their own profile data';
COMMENT ON POLICY "Patients can update own data" ON public.patients IS
  'Users can only update their own profile data';
