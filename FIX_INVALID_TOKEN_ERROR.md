# Fix: Invalid Token Error on Account Creation

## Problem
Getting "invalid token" error when trying to create accounts via `/admin/create-accounts`

## Root Cause
The Supabase anon key might be:
1. Mismatched between GitHub secrets (production) and Supabase dashboard
2. Expired or regenerated in Supabase
3. Missing proper permissions

---

## Solution: Update Supabase API Keys

### Step 1: Get Current API Keys from Supabase

1. Go to https://supabase.com/dashboard
2. Select your project: `minvvjdflezibmgkplqb`
3. Click **Settings** (gear icon in sidebar)
4. Click **API** in the settings menu
5. You'll see:
   - **Project URL**: `https://minvvjdflezibmgkplqb.supabase.co`
   - **anon public** key (starts with `eyJhbG...`)
   - **service_role** key (starts with `eyJhbG...`) - DO NOT use in frontend

### Step 2: Update GitHub Secrets

1. Go to your GitHub repo: https://github.com/RakeshEPC/tshla-medical
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Update these secrets:

**VITE_SUPABASE_URL**
```
https://minvvjdflezibmgkplqb.supabase.co
```

**VITE_SUPABASE_ANON_KEY**
```
[Paste the anon public key from Supabase Dashboard → Settings → API]
```

### Step 3: Update Local .env File

Open `/Users/rakeshpatel/Desktop/tshla-medical/.env` and update:

```bash
VITE_SUPABASE_URL=https://minvvjdflezibmgkplqb.supabase.co
VITE_SUPABASE_ANON_KEY=[Paste the anon public key here]
```

### Step 4: Re-deploy

```bash
# Commit changes to .env if needed
git add .env
git commit -m "Update Supabase API keys"
git push origin main

# Or trigger manual deployment
gh workflow run deploy-frontend.yml
```

---

## Alternative Quick Fix: Test Locally First

Before updating production, test locally:

```bash
# 1. Update .env with correct keys from Supabase dashboard
# 2. Restart dev server
npm run dev

# 3. Navigate to http://localhost:5173/admin/create-accounts
# 4. Try creating a test account
# 5. If it works locally, push to production
```

---

## Other Possible Causes

### Issue 1: Email Verification Still Enabled

**Check:**
1. Go to Supabase Dashboard
2. Authentication → Settings
3. Verify "Enable email confirmations" is **OFF**

### Issue 2: Row Level Security (RLS) Blocking Request

**Check RLS Policies:**
1. Go to Supabase Dashboard
2. Table Editor → `medical_staff` table
3. Click "..." → View policies
4. Look for INSERT policies

**Temporary Fix (for testing):**
Run this in Supabase SQL Editor:

```sql
-- Check current policies
SELECT * FROM pg_policies WHERE tablename IN ('medical_staff', 'patients');

-- Temporarily disable RLS for testing (ONLY for development!)
ALTER TABLE medical_staff DISABLE ROW LEVEL SECURITY;
ALTER TABLE patients DISABLE ROW LEVEL SECURITY;

-- Try creating account

-- Re-enable RLS after testing
ALTER TABLE medical_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
```

### Issue 3: Supabase Project JWT Secret Changed

If JWT secret was regenerated in Supabase:
1. All existing tokens are invalidated
2. You need to get new anon key from Settings → API
3. Update GitHub secrets and .env
4. Re-deploy

---

## How to Verify the Fix

### Test 1: Check Supabase Connection
```bash
# Run this in browser console on /admin/create-accounts page
const { createClient } = supabaseJs;
const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'YOUR_ANON_KEY_HERE'
);

// Test connection
const { data, error } = await supabase.auth.getSession();
console.log('Session check:', { data, error });

// Test signup
const { data: authData, error: authError } = await supabase.auth.signUp({
  email: 'test@test.com',
  password: 'test123456'
});
console.log('Signup test:', { authData, authError });
```

### Test 2: Check Browser Console
1. Open DevTools (F12)
2. Go to `/admin/create-accounts`
3. Try creating an account
4. Look for errors in Console tab
5. Look for failed requests in Network tab

Common errors:
- `Invalid API key` - Wrong anon key
- `JWT expired` - Key is old
- `Auth session missing` - Session not persisting
- `RLS policy violation` - Row Level Security blocking

---

## Quick Diagnostic Commands

```bash
# Check current GitHub secrets
gh secret list

# Check .env file
grep VITE_SUPABASE .env

# Test Supabase connection (requires jq)
curl -s https://minvvjdflezibmgkplqb.supabase.co/rest/v1/ \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY" | jq
```

---

## Summary

**Most Likely Fix:**
1. Get fresh anon key from Supabase Dashboard → Settings → API
2. Update GitHub secret `VITE_SUPABASE_ANON_KEY`
3. Update local `.env` file
4. Re-deploy or trigger workflow manually

**After fixing, test:**
1. Go to production: https://mango-sky-0ba265c0f.1.azurestaticapps.net/admin/create-accounts
2. Create a test staff account
3. Should work without "invalid token" error!

---

## Need More Help?

If still getting errors, check:
1. Browser console for exact error message
2. Network tab for failed API requests
3. Supabase Dashboard → Logs for auth errors
4. Make sure you copied the **anon public** key, not service_role key
