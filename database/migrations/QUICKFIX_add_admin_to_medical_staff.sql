-- =====================================================
-- QUICK FIX: Add Current User to medical_staff Table
-- Created: 2025-12-29
-- Purpose: Fix clinical notes save issue by ensuring user is in medical_staff table
-- =====================================================

-- This allows the RLS policy to pass when updating diabetes_education_patients
-- The policy requires: medical_staff.auth_user_id = auth.uid()

-- Check if your user already exists in medical_staff
DO $$
DECLARE
  current_user_id UUID;
  staff_exists BOOLEAN;
BEGIN
  -- Get current authenticated user ID
  current_user_id := auth.uid();

  -- Check if user exists in medical_staff
  SELECT EXISTS (
    SELECT 1 FROM medical_staff WHERE auth_user_id = current_user_id
  ) INTO staff_exists;

  IF staff_exists THEN
    RAISE NOTICE 'User already exists in medical_staff table';
  ELSE
    -- Insert current user into medical_staff
    INSERT INTO medical_staff (auth_user_id, email, first_name, last_name, role)
    VALUES (
      current_user_id,
      (SELECT email FROM auth.users WHERE id = current_user_id),
      'Admin',  -- Change this to your actual first name
      'User',   -- Change this to your actual last name
      'admin'
    );

    RAISE NOTICE 'User added to medical_staff table successfully';
  END IF;
END $$;

-- Verify the insert
SELECT
  id,
  auth_user_id,
  email,
  first_name,
  last_name,
  role,
  created_at
FROM medical_staff
WHERE auth_user_id = auth.uid();
