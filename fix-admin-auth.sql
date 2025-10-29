-- =====================================================
-- FIX ADMIN AUTHENTICATION
-- Run this in Supabase Dashboard > SQL Editor
-- =====================================================

-- STEP 1: Check if admin user exists
SELECT
  id,
  email,
  email_confirmed_at,
  created_at,
  last_sign_in_at
FROM auth.users
WHERE email = 'admin@tshla.ai';

-- STEP 2: Check if there are any medical_staff records
SELECT
  id,
  email,
  username,
  first_name,
  last_name,
  role,
  auth_user_id,
  is_active
FROM medical_staff
WHERE email = 'admin@tshla.ai' OR role = 'admin';

-- =====================================================
-- OPTION A: If user exists but password forgotten
-- =====================================================
-- Run this to generate a password reset link
-- (Then use the link from the output to reset password)

-- SELECT
--   auth.generate_recovery_link(email, '{"type": "recovery"}')
-- FROM auth.users
-- WHERE email = 'admin@tshla.ai';

-- =====================================================
-- OPTION B: If user doesn't exist, create new admin
-- =====================================================
-- IMPORTANT: Replace 'YourSecurePassword123!' with your actual desired password

-- Step B1: Create auth user (if doesn't exist)
-- INSERT INTO auth.users (
--   instance_id,
--   id,
--   aud,
--   role,
--   email,
--   encrypted_password,
--   email_confirmed_at,
--   created_at,
--   updated_at,
--   raw_app_meta_data,
--   raw_user_meta_data,
--   is_super_admin,
--   confirmation_token
-- )
-- SELECT
--   '00000000-0000-0000-0000-000000000000'::uuid,
--   gen_random_uuid(),
--   'authenticated',
--   'authenticated',
--   'admin@tshla.ai',
--   crypt('YourSecurePassword123!', gen_salt('bf')), -- CHANGE THIS PASSWORD
--   NOW(),
--   NOW(),
--   NOW(),
--   '{"provider":"email","providers":["email"]}'::jsonb,
--   '{}'::jsonb,
--   false,
--   ''
-- WHERE NOT EXISTS (
--   SELECT 1 FROM auth.users WHERE email = 'admin@tshla.ai'
-- )
-- RETURNING id, email;

-- Step B2: Create medical_staff record linked to auth user
-- (Run this AFTER Step B1 completes, using the ID from the output)
-- INSERT INTO medical_staff (
--   id,
--   auth_user_id,
--   email,
--   username,
--   first_name,
--   last_name,
--   role,
--   specialty,
--   is_active,
--   created_at,
--   updated_at
-- )
-- SELECT
--   gen_random_uuid(),
--   u.id, -- Links to auth.users
--   'admin@tshla.ai',
--   'admin',
--   'Admin',
--   'User',
--   'admin',
--   'Administration',
--   true,
--   NOW(),
--   NOW()
-- FROM auth.users u
-- WHERE u.email = 'admin@tshla.ai'
-- ON CONFLICT (email) DO NOTHING
-- RETURNING id, email, role;

-- =====================================================
-- OPTION C: Reset password for existing user
-- =====================================================
-- Direct password update (use if you have access to pgcrypto)

-- UPDATE auth.users
-- SET
--   encrypted_password = crypt('YourNewPassword123!', gen_salt('bf')), -- CHANGE THIS PASSWORD
--   updated_at = NOW()
-- WHERE email = 'admin@tshla.ai'
-- RETURNING email, 'Password updated!' as status;

-- =====================================================
-- VERIFICATION: After creating/updating, verify user
-- =====================================================
-- Run this to check everything is set up correctly

-- SELECT
--   u.email as auth_email,
--   u.email_confirmed_at as confirmed,
--   m.id as staff_id,
--   m.email as staff_email,
--   m.role,
--   m.is_active,
--   CASE
--     WHEN u.id IS NULL THEN '❌ No auth user'
--     WHEN m.id IS NULL THEN '❌ No staff record'
--     WHEN m.auth_user_id != u.id THEN '❌ Mismatched IDs'
--     WHEN NOT m.is_active THEN '⚠️  Inactive'
--     ELSE '✅ Ready'
--   END as status
-- FROM auth.users u
-- FULL OUTER JOIN medical_staff m ON m.auth_user_id = u.id
-- WHERE u.email = 'admin@tshla.ai' OR m.email = 'admin@tshla.ai';
