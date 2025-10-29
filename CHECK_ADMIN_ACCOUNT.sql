-- ========================================
-- CHECK AND FIX ADMIN ACCOUNT
-- Run this in Supabase Dashboard → SQL Editor
-- ========================================

-- STEP 1: Check if admin user exists in auth.users
SELECT
  id as auth_id,
  email,
  email_confirmed_at,
  created_at,
  last_sign_in_at,
  CASE
    WHEN email_confirmed_at IS NULL THEN '⚠️  Email not confirmed'
    ELSE '✅ Email confirmed'
  END as email_status
FROM auth.users
WHERE email = 'admin@tshla.ai';

-- STEP 2: Check if medical_staff record exists
SELECT
  id as staff_id,
  auth_user_id,
  email,
  username,
  first_name,
  last_name,
  role,
  is_active
FROM medical_staff
WHERE email = 'admin@tshla.ai';

-- STEP 3: Check if they're linked properly
SELECT
  u.id as auth_id,
  u.email as auth_email,
  u.email_confirmed_at,
  m.id as staff_id,
  m.email as staff_email,
  m.role,
  m.is_active,
  CASE
    WHEN u.id IS NULL THEN '❌ No auth user'
    WHEN u.email_confirmed_at IS NULL THEN '⚠️  Email not confirmed'
    WHEN m.id IS NULL THEN '❌ No medical_staff record'
    WHEN m.auth_user_id != u.id THEN '❌ Auth IDs don't match'
    WHEN NOT m.is_active THEN '⚠️  Staff record inactive'
    ELSE '✅ Everything linked correctly'
  END as status
FROM auth.users u
FULL OUTER JOIN medical_staff m ON m.auth_user_id = u.id
WHERE u.email = 'admin@tshla.ai' OR m.email = 'admin@tshla.ai';

-- ========================================
-- IF USER EXISTS BUT PASSWORD WRONG:
-- ========================================
-- OPTION A: Reset password to documented password
-- (Uncomment and run this)

-- UPDATE auth.users
-- SET
--   encrypted_password = crypt('TshlaAdmin2025!', gen_salt('bf')),
--   email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
--   updated_at = NOW()
-- WHERE email = 'admin@tshla.ai'
-- RETURNING email, 'Password reset to: TshlaAdmin2025!' as message;

-- ========================================
-- IF USER DOESN'T EXIST:
-- ========================================
-- OPTION B: Create new admin user
-- (Uncomment and run this)

-- -- Step B1: Create auth user
-- DO $$
-- DECLARE
--   v_user_id uuid;
-- BEGIN
--   INSERT INTO auth.users (
--     instance_id,
--     id,
--     aud,
--     role,
--     email,
--     encrypted_password,
--     email_confirmed_at,
--     created_at,
--     updated_at,
--     raw_app_meta_data,
--     raw_user_meta_data,
--     is_super_admin,
--     confirmation_token
--   )
--   VALUES (
--     '00000000-0000-0000-0000-000000000000'::uuid,
--     gen_random_uuid(),
--     'authenticated',
--     'authenticated',
--     'admin@tshla.ai',
--     crypt('TshlaAdmin2025!', gen_salt('bf')),
--     NOW(),
--     NOW(),
--     NOW(),
--     '{"provider":"email","providers":["email"]}'::jsonb,
--     '{"email":"admin@tshla.ai"}'::jsonb,
--     false,
--     ''
--   )
--   RETURNING id INTO v_user_id;

--   -- Step B2: Create medical_staff record
--   INSERT INTO medical_staff (
--     id,
--     auth_user_id,
--     email,
--     username,
--     first_name,
--     last_name,
--     role,
--     specialty,
--     is_active,
--     created_at,
--     updated_at
--   )
--   VALUES (
--     gen_random_uuid(),
--     v_user_id,
--     'admin@tshla.ai',
--     'admin',
--     'Admin',
--     'User',
--     'admin',
--     'Administration',
--     true,
--     NOW(),
--     NOW()
--   );

--   RAISE NOTICE 'Created admin user with password: TshlaAdmin2025!';
-- END $$;

-- ========================================
-- IF EMAIL NOT CONFIRMED:
-- ========================================
-- OPTION C: Confirm email
-- (Uncomment and run this)

-- UPDATE auth.users
-- SET email_confirmed_at = NOW()
-- WHERE email = 'admin@tshla.ai' AND email_confirmed_at IS NULL
-- RETURNING email, 'Email confirmed!' as message;

-- ========================================
-- VERIFICATION: Run this after any changes
-- ========================================
SELECT
  'Final Status Check' as step,
  u.email,
  u.email_confirmed_at IS NOT NULL as email_confirmed,
  m.role,
  m.is_active,
  CASE
    WHEN u.email_confirmed_at IS NOT NULL AND m.is_active AND m.role = 'admin'
    THEN '✅ Ready to login with password: TshlaAdmin2025!'
    ELSE '❌ Still has issues - check above'
  END as status
FROM auth.users u
JOIN medical_staff m ON m.auth_user_id = u.id
WHERE u.email = 'admin@tshla.ai';
