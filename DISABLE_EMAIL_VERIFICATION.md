# How to Disable Email Verification in Supabase

For internal clinic use, you want users to log in immediately after account creation without needing to verify their email.

## Quick Steps (30 seconds)

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Log in with your Supabase account

2. **Select Your Project**
   - Click on your project: `minvvjdflezibmgkplqb`

3. **Navigate to Authentication Settings**
   - In the left sidebar, click **Authentication**
   - Click **Settings** (or **Configuration**)
   - Look for **Email Auth** section

4. **Disable Email Confirmations**
   - Find the toggle for **"Enable email confirmations"**
   - Turn it **OFF** (switch should be grey/disabled)
   - Click **Save** at the bottom

## What This Does

- **Before:** Users must click email link before they can log in
- **After:** Users can log in immediately after account creation

## Verification

After disabling, test by creating a new account:
1. Go to `/admin/create-accounts`
2. Create a test patient or staff account
3. Try logging in immediately
4. Should work without email confirmation!

## Important Notes

- This setting applies to **all new accounts** going forward
- Existing accounts that haven't verified email will still need to verify (or you can manually verify them in Supabase dashboard)
- This is perfect for internal clinic use where you control all account creation
- For public-facing apps, you'd want email verification enabled for security

## Manual Verification (if needed)

If you have existing accounts stuck in "needs verification" state:

1. Go to Supabase Dashboard
2. Authentication → Users
3. Find the user
4. Click the three dots → Confirm Email
5. User can now log in

## Alternative: SQL Method

If you prefer SQL, run this in Supabase SQL Editor:

```sql
-- Disable email confirmation requirement
UPDATE auth.config
SET enable_confirm_email = false;
```

---

**Status:** Once this is disabled, your admin account creation page will work perfectly for clinic staff and patients!
