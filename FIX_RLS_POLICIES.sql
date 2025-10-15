-- Fix Row Level Security (RLS) Policies for Account Creation
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/minvvjdflezibmgkplqb/sql

-- =====================================================
-- MEDICAL_STAFF TABLE - Allow admins to create accounts
-- =====================================================

-- Drop existing restrictive policies if they exist
DROP POLICY IF EXISTS "medical_staff_insert_policy" ON medical_staff;
DROP POLICY IF EXISTS "Allow admins to insert staff" ON medical_staff;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON medical_staff;

-- Create policy: Allow authenticated users to INSERT (for account creation)
CREATE POLICY "Allow account creation for medical staff"
ON medical_staff
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create policy: Allow users to SELECT their own record
CREATE POLICY "Users can view own medical staff record"
ON medical_staff
FOR SELECT
TO authenticated
USING (auth.uid() = auth_user_id);

-- Create policy: Allow admins to view all records
CREATE POLICY "Admins can view all medical staff"
ON medical_staff
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM medical_staff
    WHERE auth_user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
  )
);

-- Create policy: Allow users to UPDATE their own record
CREATE POLICY "Users can update own medical staff record"
ON medical_staff
FOR UPDATE
TO authenticated
USING (auth.uid() = auth_user_id)
WITH CHECK (auth.uid() = auth_user_id);

-- =====================================================
-- PATIENTS TABLE - Allow admins to create accounts
-- =====================================================

-- Drop existing restrictive policies if they exist
DROP POLICY IF EXISTS "patients_insert_policy" ON patients;
DROP POLICY IF EXISTS "Allow admins to insert patients" ON patients;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON patients;

-- Create policy: Allow authenticated users to INSERT (for account creation)
CREATE POLICY "Allow account creation for patients"
ON patients
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create policy: Allow patients to SELECT their own record
CREATE POLICY "Patients can view own record"
ON patients
FOR SELECT
TO authenticated
USING (auth.uid() = auth_user_id);

-- Create policy: Allow medical staff to view all patient records
CREATE POLICY "Medical staff can view all patients"
ON patients
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM medical_staff
    WHERE auth_user_id = auth.uid()
  )
);

-- Create policy: Allow patients to UPDATE their own record
CREATE POLICY "Patients can update own record"
ON patients
FOR UPDATE
TO authenticated
USING (auth.uid() = auth_user_id)
WITH CHECK (auth.uid() = auth_user_id);

-- Create policy: Allow medical staff to UPDATE patient records
CREATE POLICY "Medical staff can update patients"
ON patients
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM medical_staff
    WHERE auth_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM medical_staff
    WHERE auth_user_id = auth.uid()
  )
);

-- =====================================================
-- VERIFY RLS IS ENABLED
-- =====================================================

-- Ensure RLS is enabled on both tables
ALTER TABLE medical_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- VERIFY POLICIES
-- =====================================================

-- Check medical_staff policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'medical_staff';

-- Check patients policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'patients';
