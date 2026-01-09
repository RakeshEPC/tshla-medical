-- =====================================================
-- Create Test Admin User
-- =====================================================
-- This script helps create a test admin user for testing
--
-- IMPORTANT: You must create the user in Supabase Dashboard FIRST!
--
-- Steps:
-- 1. Go to Supabase Dashboard → Authentication → Users
-- 2. Click "Add user" → "Create new user"
-- 3. Email: testadmin@tshla.ai
-- 4. Password: TestAdmin123!
-- 5. ✅ CHECK "Auto Confirm User"
-- 6. Click "Create user"
-- 7. Then run this SQL below
-- =====================================================

-- Add the user to medical_staff table as admin
INSERT INTO public.medical_staff (
  auth_user_id,
  email,
  first_name,
  last_name,
  role,
  is_active,
  department,
  license_number
)
SELECT
  id,
  'testadmin@tshla.ai',
  'Test',
  'Admin',
  'admin',
  true,
  'Administration',
  'TEST-001'
FROM auth.users
WHERE email = 'testadmin@tshla.ai'
AND NOT EXISTS (
  SELECT 1 FROM public.medical_staff
  WHERE auth_user_id = (SELECT id FROM auth.users WHERE email = 'testadmin@tshla.ai')
);

-- Verify the user was created
SELECT
  u.email as auth_email,
  u.email_confirmed_at IS NOT NULL as email_confirmed,
  ms.email as staff_email,
  ms.role,
  ms.is_active,
  ms.first_name,
  ms.last_name
FROM auth.users u
LEFT JOIN public.medical_staff ms ON ms.auth_user_id = u.id
WHERE u.email = 'testadmin@tshla.ai';

-- If the verification shows the user, you can login with:
-- Email: testadmin@tshla.ai
-- Password: TestAdmin123!
