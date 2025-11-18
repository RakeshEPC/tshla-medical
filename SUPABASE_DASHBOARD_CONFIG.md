# ⚠️ CRITICAL: Supabase Dashboard Configuration Required

## Action Required

You MUST configure the allowed redirect URLs in Supabase dashboard for password reset to work.

## Step-by-Step Instructions

### 1. Access Supabase Dashboard
1. Go to: https://supabase.com/dashboard
2. Log in with your Supabase account
3. Select project: **minvvjdflezibmgkplqb** (TSHLA Medical)

### 2. Navigate to URL Configuration
1. Click on **Authentication** in the left sidebar
2. Click on **URL Configuration**
3. Scroll to **Redirect URLs** section

### 3. Add Production URLs
Add the following URLs to the **Redirect URLs** list:

```
https://www.tshla.ai/reset-password
https://www.tshla.ai/auth/confirm
```

### 4. Add Development URLs (Optional)
For local testing, also add:

```
http://localhost:5173/reset-password
http://localhost:5173/auth/confirm
```

### 5. Save Configuration
Click **Save** button at the bottom of the page.

## Verification

After saving, test the password reset flow:

1. Go to https://www.tshla.ai/login
2. Click "Forgot your password?"
3. Enter an email address
4. Check email for reset link
5. Click link → Should redirect to https://www.tshla.ai/reset-password
6. Reset password successfully

## What Happens If You Don't Configure This

If redirect URLs are not configured:
- Password reset emails will still be sent
- But clicking the link will show Supabase error page
- Users won't be able to complete password reset
- Error message: "Redirect URL not allowed"

## Current Configuration Status

- ✅ Code deployed with `/reset-password` route
- ✅ Environment variable `VITE_SUPABASE_REDIRECT_URL` configured
- ✅ Login page has "Forgot Password" link
- ⚠️ **Supabase dashboard redirect URLs NOT YET CONFIGURED**

## After Configuration

Once you've configured the redirect URLs in Supabase dashboard:
1. Update this file to mark as ✅ Complete
2. Test the full password reset flow
3. Notify users that password reset is available

---

**Configuration URL:** https://supabase.com/dashboard/project/minvvjdflezibmgkplqb/auth/url-configuration

**Project ID:** minvvjdflezibmgkplqb

**Date:** 2025-11-18
