# Fix Admin Login Issue (HTTP 400 Error)

## Problem
You're getting HTTP 400 errors when trying to login, which means:
- The email/password combination is incorrect, OR
- The admin user doesn't exist in Supabase

## Solution: Use Supabase Dashboard

### Method 1: Reset Password (If user exists)

1. **Go to Supabase Dashboard**:
   - Visit: https://supabase.com/dashboard
   - Select your project: `minvvjdflezibmgkplqb`

2. **Navigate to Authentication**:
   - Click "Authentication" in left sidebar
   - Click "Users" tab

3. **Find Your User**:
   - Search for `admin@tshla.ai` or your email
   - If you see the user:
     - Click the "..." menu on the right
     - Select "Reset Password"
     - Copy the password reset link
     - Open it in a new browser tab
     - Set your new password

4. **Verify Email is Confirmed**:
   - Make sure the "Confirmed" column shows a checkmark ✓
   - If not, click the user → "Verify Email"

### Method 2: Create New Admin User (If user doesn't exist)

1. **Go to Supabase Dashboard → Authentication → Users**

2. **Click "Invite User" or "Add User"**:
   - Email: `admin@tshla.ai` (or your preferred admin email)
   - Password: Choose a secure password (remember it!)
   - Auto Confirm User: **YES** (check this box)
   - Click "Create User"

3. **Link User to Medical Staff Table**:
   - Go to "SQL Editor" in left sidebar
   - Click "New Query"
   - Paste this SQL (replace with YOUR auth user ID):

```sql
-- Step 1: Get the auth user ID
SELECT id, email FROM auth.users WHERE email = 'admin@tshla.ai';

-- Step 2: Create medical_staff record (replace 'USER_ID_HERE' with ID from step 1)
INSERT INTO medical_staff (
  id,
  auth_user_id,
  email,
  username,
  first_name,
  last_name,
  role,
  specialty,
  is_active,
  created_at,
  updated_at
)
VALUES (
  gen_random_uuid(),
  'USER_ID_HERE'::uuid,  -- Replace this with actual user ID!
  'admin@tshla.ai',
  'admin',
  'Admin',
  'User',
  'admin',
  'Administration',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  role = 'admin',
  is_active = true
RETURNING id, email, role;
```

### Method 3: Quick Password Update (Advanced)

1. **Go to SQL Editor in Supabase Dashboard**

2. **Run this to check if user exists**:
```sql
SELECT id, email, email_confirmed_at
FROM auth.users
WHERE email = 'admin@tshla.ai';
```

3. **If user exists, update password directly**:
```sql
UPDATE auth.users
SET
  encrypted_password = crypt('NewSecurePassword123!', gen_salt('bf')),
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  updated_at = NOW()
WHERE email = 'admin@tshla.ai'
RETURNING email, 'Password updated!' as status;
```

**IMPORTANT**: Replace `NewSecurePassword123!` with your actual desired password!

## Verification Steps

After creating/resetting user, verify everything works:

### 1. Check User Status in Supabase

```sql
SELECT
  u.email as auth_email,
  u.email_confirmed_at as confirmed,
  m.email as staff_email,
  m.role,
  m.is_active,
  m.auth_user_id,
  u.id as auth_id
FROM auth.users u
LEFT JOIN medical_staff m ON m.auth_user_id = u.id
WHERE u.email = 'admin@tshla.ai';
```

**Expected Result:**
- `auth_email`: admin@tshla.ai
- `confirmed`: (timestamp, not NULL)
- `staff_email`: admin@tshla.ai
- `role`: admin
- `is_active`: true
- `auth_user_id` should match `auth_id`

### 2. Test Login

1. Go to: https://www.tshla.ai/admin/create-accounts
2. Enter your admin email and password
3. Should login successfully and see admin dashboard

## Common Issues

### Issue: "Email not confirmed"
**Fix**: In Supabase Dashboard → Authentication → Users → Click user → "Verify Email"

### Issue: "No medical_staff record found"
**Fix**: Run the SQL from Method 2 Step 3 to create the link

### Issue: "User is inactive"
**Fix**:
```sql
UPDATE medical_staff
SET is_active = true
WHERE email = 'admin@tshla.ai';
```

### Issue: Still getting 400 error
**Possible causes:**
1. Typo in email/password
2. Browser cached old credentials - try incognito mode
3. RLS policies blocking - check Supabase logs

## Test the Schedule Upload Feature

After successful login:

1. Navigate to: https://www.tshla.ai/admin/create-accounts
2. Click "📅 Upload Schedule" tab
3. Drag and drop your Athena CSV file
4. Click "Parse Schedule File"
5. Review appointments
6. Click "Import to Database"
7. Should see: "Successfully imported X appointments!"

---

## Need More Help?

Check the detailed SQL script: [fix-admin-auth.sql](fix-admin-auth.sql)

Or check Supabase logs:
- Dashboard → Logs → Auth Logs
- Look for failed login attempts with your email
