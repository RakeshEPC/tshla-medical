# TSHLA Medical - Login Troubleshooting Guide

**Date**: November 11, 2025
**Issue**: Unable to login with created user account

---

## Common Login Failure Reasons

Based on the code analysis, here are the most likely reasons why login might fail:

### 1. ✉️ Email Confirmation Required (Most Likely)

**Symptom**: Account created successfully but can't login

**Cause**: Supabase requires email confirmation before login

**How to Check**:
1. Open [Supabase Dashboard](https://app.supabase.com)
2. Go to **Authentication** → **Users**
3. Find your user by email
4. Check if "Email Confirmed" column shows a checkmark ✅ or pending

**Solutions**:

**Option A: Confirm Email (Recommended)**
- Check the email inbox for confirmation email from Supabase
- Click the confirmation link
- Try logging in again

**Option B: Manual Confirmation (Admin)**
1. Go to Supabase Dashboard → Authentication → Users
2. Click on the user
3. Scroll down to "Email Confirmed At"
4. Click "Confirm Email" button
5. Try logging in again

**Option C: Disable Email Confirmation (Development Only)**
1. Go to Supabase Dashboard → Authentication → Settings
2. Scroll to "Email Auth"
3. Toggle OFF "Enable email confirmations"
4. Existing users will still need manual confirmation (use Option B)
5. New signups won't require email confirmation

---

### 2. 🔒 Row Level Security (RLS) Blocking Patient Record Creation

**Symptom**: Account creation fails with error about RLS policy

**Error Message**: `"Permission denied: Row Level Security policy is blocking account creation"`

**Cause**: The `patients` table RLS policies don't allow INSERT for new users

**How to Check**:
```sql
-- Run in Supabase SQL Editor
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'patients' AND cmd = 'INSERT';
```

**Solution**: Update RLS policy to allow new user registration

```sql
-- Run in Supabase SQL Editor

-- Drop old policy if exists
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.patients;
DROP POLICY IF EXISTS "Patients can be created" ON public.patients;

-- Create new policy allowing signup
CREATE POLICY "Allow patient registration"
  ON public.patients
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Verify
SELECT policyname FROM pg_policies WHERE tablename = 'patients' AND cmd = 'INSERT';
```

---

### 3. ❌ Account is Inactive

**Symptom**: Login fails with "Your account is inactive" message

**Cause**: The `is_active` field is set to `false` in the patients table

**How to Check**:
```sql
-- Run in Supabase SQL Editor
SELECT
  id,
  email,
  first_name,
  last_name,
  is_active,
  created_at
FROM public.patients
WHERE email = 'YOUR_EMAIL@example.com';
```

**Solution**: Activate the account

```sql
-- Run in Supabase SQL Editor
UPDATE public.patients
SET is_active = true
WHERE email = 'YOUR_EMAIL@example.com';

-- Verify
SELECT email, is_active FROM public.patients WHERE email = 'YOUR_EMAIL@example.com';
```

---

### 4. 🔗 Missing Patient Record in Database

**Symptom**: Login fails with "Patient profile not found"

**Cause**: Supabase auth user exists but no corresponding `patients` table record

**How to Check**:
```sql
-- Check auth users (requires service_role key in Supabase SQL Editor)
-- Go to Supabase Dashboard → Authentication → Users to see if user exists

-- Check patients table
SELECT email FROM public.patients WHERE email = 'YOUR_EMAIL@example.com';
-- If empty, patient record is missing
```

**Solution**: Create missing patient record manually

```sql
-- Find the auth user ID from Supabase Dashboard → Authentication → Users
-- Then create patient record:

INSERT INTO public.patients (
  email,
  first_name,
  last_name,
  auth_user_id,
  mrn,
  ava_id,
  is_active,
  pumpdrive_enabled,
  subscription_tier,
  created_at,
  updated_at
) VALUES (
  'YOUR_EMAIL@example.com',
  'First',
  'Last',
  'AUTH_USER_ID_FROM_SUPABASE', -- Get this from Authentication → Users
  'MRN-' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0'),
  'AVA ' || (FLOOR(RANDOM() * 900 + 100)::integer) || '-' || (FLOOR(RANDOM() * 900 + 100)::integer),
  true,
  true,
  'free',
  NOW(),
  NOW()
);

-- Verify
SELECT email, first_name, ava_id, is_active FROM public.patients
WHERE email = 'YOUR_EMAIL@example.com';
```

---

### 5. 🔐 Wrong Password

**Symptom**: Login fails with "Invalid email or password" or "Invalid login credentials"

**Cause**: Password is incorrect

**Solution**:

**Option A: Request Password Reset**
1. On login page, click "Forgot Password?"
2. Enter email address
3. Check email for reset link
4. Set new password
5. Try logging in

**Option B: Reset Password in Supabase (Admin)**
1. Go to Supabase Dashboard → Authentication → Users
2. Click on the user
3. Click "Send Password Reset Email"
4. User will receive email with reset link

---

## Step-by-Step Troubleshooting Process

### Step 1: Verify Account Exists

1. Open [Supabase Dashboard](https://app.supabase.com)
2. Navigate to your project: `https://minvvjdflezibmgkplqb.supabase.co`
3. Go to **Authentication** → **Users**
4. Search for your email address

**If user NOT found**: Account was never created
- Try registering again
- Check for RLS policy issues (see #2 above)

**If user FOUND**: Continue to Step 2

### Step 2: Check Email Confirmation Status

In the Users list, check the "Email Confirmed At" column:

**If EMPTY (null)**: Email not confirmed
- Check email inbox for confirmation link
- OR manually confirm in dashboard (click user → Confirm Email)

**If CONFIRMED (has date)**: Continue to Step 3

### Step 3: Check Patient Record

Run this in **SQL Editor**:

```sql
-- Get auth_user_id from Authentication → Users page in dashboard
SELECT * FROM public.patients
WHERE auth_user_id = 'PASTE_AUTH_USER_ID_HERE';
```

**If NO ROWS returned**: Patient record missing
- Use the INSERT statement from #4 above to create it

**If ROWS returned**: Continue to Step 4

### Step 4: Check Account Active Status

From the query in Step 3, check the `is_active` column:

**If `false`**: Account is deactivated
- Run UPDATE statement from #3 above to activate it

**If `true`**: Continue to Step 5

### Step 5: Try Login with Correct Credentials

Now that the account is:
- ✅ Created in Supabase Auth
- ✅ Email confirmed
- ✅ Patient record exists
- ✅ Account is active

Try logging in with the EXACT credentials used during registration.

**If still fails**: Check browser console for detailed error messages
- Open Developer Tools (F12)
- Go to Console tab
- Try logging in
- Look for error messages starting with `❌ [SupabaseAuth]`
- Share error message for further diagnosis

---

## Quick Test Account Creation & Login

Want to test if login is working? Create a test account:

### 1. Create Test Account via SQL (Bypasses RLS)

```sql
-- This requires service_role access, so run in Supabase SQL Editor

-- First, go to Authentication → Users → Add User
-- Email: test@tshla.ai
-- Password: Test1234!
-- Get the auth_user_id from the created user

-- Then create patient record:
INSERT INTO public.patients (
  email,
  first_name,
  last_name,
  auth_user_id,
  mrn,
  ava_id,
  is_active,
  pumpdrive_enabled,
  subscription_tier
) VALUES (
  'test@tshla.ai',
  'Test',
  'User',
  'AUTH_USER_ID_HERE', -- From the step above
  'MRN-TEST-001',
  'AVA 123-456',
  true,
  true,
  'free'
);

-- Manually confirm email
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'test@tshla.ai';
```

### 2. Test Login

Go to your app and try logging in with:
- **Email**: test@tshla.ai
- **Password**: Test1234!

---

## Common Error Messages Decoded

| Error Message | Likely Cause | Solution |
|---------------|--------------|----------|
| "Invalid email or password" | Wrong credentials OR email not confirmed | Check password, confirm email |
| "Patient profile not found" | No patient record in database | Create patient record (see #4) |
| "Your account is inactive" | `is_active` = false | Activate account (see #3) |
| "Please verify your email" | Email not confirmed | Confirm email (see #1) |
| "Permission denied: Row Level Security..." | RLS blocking INSERT | Fix RLS policies (see #2) |
| "No account found with this email" | User doesn't exist in Supabase Auth | Register new account |
| "Network error" | Can't reach Supabase | Check internet connection |

---

## Login Flow Diagram

```
User Enters Email & Password
         ↓
[Supabase Auth Check]
         ├─ Email not confirmed? → ❌ Error: "Please verify email"
         ├─ Wrong password? → ❌ Error: "Invalid credentials"
         ├─ User not found? → ❌ Error: "No account found"
         ↓
[Query patients table]
         ├─ No record? → ❌ Error: "Patient profile not found"
         ├─ is_active = false? → ❌ Error: "Account is inactive"
         ↓
[Create session]
         ↓
[Redirect based on accessType]
         ├─ accessType = 'pumpdrive' → /pumpdrive/assessment
         ├─ accessType = 'patient' → /patient/dashboard
         └─ role = 'admin' → /admin/account-manager
```

---

## Still Having Issues?

If you've gone through all the steps above and still can't login:

1. **Check Browser Console Logs**:
   - Open Developer Tools (F12)
   - Go to Console tab
   - Try logging in
   - Copy all error messages

2. **Check Supabase Logs**:
   - Go to Supabase Dashboard → Logs
   - Filter by "Authentication"
   - Look for failed login attempts

3. **Verify Database Schema**:
   ```sql
   -- Check if patients table exists and has correct columns
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_name = 'patients'
   ORDER BY ordinal_position;
   ```

4. **Test with Supabase Auth Directly**:
   ```javascript
   // In browser console on your app
   const { data, error } = await window.supabase.auth.signInWithPassword({
     email: 'your-email@example.com',
     password: 'your-password'
   });
   console.log('Auth result:', { data, error });
   ```

---

## Quick Fix Commands (Copy-Paste Ready)

### Confirm All Pending Emails
```sql
-- Run in Supabase SQL Editor (use with caution!)
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;
```

### Activate All Inactive Accounts
```sql
-- Run in Supabase SQL Editor
UPDATE public.patients
SET is_active = true
WHERE is_active = false;
```

### Fix RLS for Patient Registration
```sql
-- Run in Supabase SQL Editor
DROP POLICY IF EXISTS "Allow patient registration" ON public.patients;
CREATE POLICY "Allow patient registration"
  ON public.patients FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
```

---

**Last Updated**: November 11, 2025
**Status**: Ready to troubleshoot
**Priority**: HIGH - User cannot access system
