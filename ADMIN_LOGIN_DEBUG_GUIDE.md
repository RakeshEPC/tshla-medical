# Admin Login Troubleshooting Guide

## Quick Diagnosis Steps

### 1. Check Browser Console
Open browser DevTools (F12) and look at the Console tab when you try to login.

**Look for this pattern:**
```
🔐 [SupabaseAuth] Universal login starting
🚀 [SupabaseAuth] Starting medical staff login...
⏳ [SupabaseAuth] Calling Supabase signInWithPassword...
✅ [SupabaseAuth] Supabase auth call completed
❌ [SupabaseAuth] Supabase auth error: {...}
```

### 2. Common Error Messages & Solutions

#### Error: "Invalid email or password"
**Meaning**: Supabase authentication failed - wrong credentials

**Solutions**:
1. **Try documented password**: `TshlaAdmin2025!`
2. **Reset password in Supabase Dashboard**:
   - Go to: https://supabase.com/dashboard
   - Select project: `minvvjdflezibmgkplqb`
   - Authentication → Users
   - Find `admin@tshla.ai`
   - Click "..." → "Reset Password"
   - Use the reset link to set new password

#### Error: "Please verify your email address"
**Meaning**: Email not confirmed in Supabase

**Solution**:
1. Go to Supabase Dashboard → Authentication → Users
2. Find your user
3. Click "..." → "Verify Email"

#### Error: "No account found with this email address"
**Meaning**: The email doesn't exist in Supabase Auth

**Solution**:
1. Check Supabase Dashboard → Authentication → Users
2. If user missing, create via Dashboard:
   - Click "Invite User" or "Add User"
   - Email: `admin@tshla.ai`
   - Password: (choose secure password)
   - **Check "Auto Confirm User"**
   - Create user
3. Link to medical_staff table (see below)

#### Error: "medical_staff record not found"
**Meaning**: Auth user exists but no medical_staff database record

**Solution** - Run this SQL in Supabase SQL Editor:
```sql
-- Step 1: Get auth user ID
SELECT id, email FROM auth.users WHERE email = 'admin@tshla.ai';

-- Step 2: Create medical_staff record (replace USER_ID with actual ID)
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
  'USER_ID_HERE'::uuid,  -- Replace this!
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

---

## New Feature: Clear Session Button

If you see login errors, there's now a **"Clear session data and try again"** button below the error message.

**What it does:**
- Clears all localStorage
- Clears all sessionStorage
- Reloads the page for fresh start
- Logs session state to console

**When to use it:**
- After updating Supabase credentials
- If you see "session expired" errors
- After password changes
- When switching between accounts

---

## Enhanced Error Logging

The login system now provides detailed error information:

### In Browser Console:
```javascript
❌ [SupabaseAuth] Supabase auth error: {
  message: "Invalid login credentials",
  status: 400,
  name: "AuthApiError",
  code: "invalid_credentials",
  details: {...}
}
```

### What Each Field Means:
- `message`: Human-readable error
- `status`: HTTP status code (400 = bad request, 401 = unauthorized)
- `code`: Supabase error code
- `details`: Additional debugging info

---

## Smart Login Flow

The system now uses intelligent retry logic:

### Before (Old Behavior):
```
Try medical staff login → Fail (400 error)
Try patient login → Fail (400 error)
Return "Invalid email or password"
```
**Result**: TWO 400 errors in console

### After (New Behavior):
```
Try medical staff login → Fail with "Invalid password"
Check error type → It's auth error, not missing record
Skip patient login → Return specific error immediately
```
**Result**: ONE 400 error, faster response, better error message

### When Patient Login IS Tried:
```
Try medical staff login → Fail with "medical_staff record not found"
Check error type → User authenticated but no staff record
Try patient login → Check pump_users table
```

---

## Documented Admin Credentials

From: `docs/archive/SUPABASE_AUTH_MIGRATION_COMPLETE.md` (October 6, 2025)

```
Email: admin@tshla.ai
Password: TshlaAdmin2025!
```

**Note**: If this doesn't work, the password was changed after documentation.

---

## Verify Everything Is Set Up Correctly

Run this SQL in Supabase SQL Editor to check your account:

```sql
SELECT
  u.id as auth_id,
  u.email as auth_email,
  u.email_confirmed_at,
  u.created_at as auth_created,
  u.last_sign_in_at,
  m.id as staff_id,
  m.email as staff_email,
  m.username,
  m.role,
  m.is_active,
  CASE
    WHEN u.id IS NULL THEN '❌ No auth user'
    WHEN u.email_confirmed_at IS NULL THEN '⚠️  Email not confirmed'
    WHEN m.id IS NULL THEN '❌ No staff record'
    WHEN m.auth_user_id != u.id THEN '❌ Mismatched IDs'
    WHEN NOT m.is_active THEN '⚠️  Inactive staff'
    ELSE '✅ Ready to login'
  END as status
FROM auth.users u
LEFT JOIN medical_staff m ON m.auth_user_id = u.id
WHERE u.email = 'admin@tshla.ai';
```

**Expected Result:**
```
auth_email: admin@tshla.ai
email_confirmed_at: (timestamp)
staff_email: admin@tshla.ai
role: admin
is_active: true
status: ✅ Ready to login
```

---

## Test Login Without UI

Use this curl command to test authentication directly:

```bash
curl -X POST "https://minvvjdflezibmgkplqb.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@tshla.ai","password":"YOUR_PASSWORD"}'
```

**Success Response** (status 200):
```json
{
  "access_token": "eyJhb...",
  "user": {
    "id": "uuid-here",
    "email": "admin@tshla.ai",
    ...
  }
}
```

**Failure Response** (status 400):
```json
{
  "error": "Invalid login credentials",
  "error_description": "Email or password is incorrect"
}
```

---

## Common Supabase Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| `invalid_credentials` | Wrong email or password | Reset password |
| `email_not_confirmed` | Email not verified | Verify email in dashboard |
| `user_not_found` | Email doesn't exist | Create user in dashboard |
| `over_request_rate_limit` | Too many login attempts | Wait 1 hour |
| `session_not_found` | Session expired | Clear storage and re-login |

---

## Still Having Issues?

### Check GitHub Secrets (Deployment)
If login works locally but not on production:

```bash
gh secret list | grep SUPABASE
```

Should show:
```
VITE_SUPABASE_URL          Updated: 2025-10-07
VITE_SUPABASE_ANON_KEY     Updated: 2025-10-14
```

**If dates are very old**: Keys may have been rotated. Get new keys from Supabase Dashboard → Project Settings → API

### Check Supabase Project Status
1. Go to Supabase Dashboard
2. Check if project is paused (free tier auto-pauses after inactivity)
3. Click "Resume" if paused

### Check Row Level Security (RLS)
RLS policies might be blocking access:

```sql
-- Check RLS policies on medical_staff table
SELECT * FROM pg_policies WHERE tablename = 'medical_staff';

-- Temporarily disable RLS for testing (NOT for production!)
-- ALTER TABLE medical_staff DISABLE ROW LEVEL SECURITY;
```

---

## Contact & Support

If none of the above works:
1. Check browser console for full error stack
2. Check Supabase logs: Dashboard → Logs → Auth Logs
3. Look for your email in recent failed attempts
4. Note the exact error message and timestamp

**File Issues**: See code comments for debugging context in:
- `src/services/supabaseAuth.service.ts` (login logic)
- `src/contexts/AuthContext.tsx` (auth state management)
- `src/pages/Login.tsx` (UI and form handling)
