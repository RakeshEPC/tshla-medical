# Password Reset Setup Guide

**Date:** 2025-11-18
**Issue Fixed:** Supabase password reset links not working
**Status:** ✅ IMPLEMENTED

## Problem Summary

Users receiving password reset emails from Supabase, but the links were not working because:
1. No password reset page existed in the application
2. No routes configured for `/reset-password` or `/auth/confirm`
3. No redirect URL configured in Supabase
4. No "Forgot Password" UI for users to request reset

## Solution Implemented

### 1. Created Password Reset Page
**File:** `src/pages/ResetPassword.tsx`

Features:
- Validates password reset token from Supabase URL
- Shows loading state while validating token
- Password reset form with validation:
  - Minimum 8 characters
  - Uppercase and lowercase letters
  - Numbers and special characters
  - Password confirmation match
- Success state with auto-redirect to login
- Error handling for invalid/expired links
- Show/hide password toggle

### 2. Added Routes
**File:** `src/App.tsx`

Added two routes:
```tsx
<Route path="/reset-password" element={<ResetPassword />} />
<Route path="/auth/confirm" element={<ResetPassword />} />
```

Both routes point to the same component for maximum compatibility.

### 3. Added "Forgot Password" UI
**File:** `src/pages/Login.tsx`

Features:
- "Forgot your password?" link below Sign In button (email login only)
- Modal dialog for entering email
- Calls `supabase.auth.resetPasswordForEmail()` with proper redirect URL
- Success message after email sent
- Auto-closes modal after 5 seconds
- Error handling for failed requests

### 4. Configured Environment Variables
**File:** `.env.production`

Added:
```
VITE_SUPABASE_REDIRECT_URL=https://www.tshla.ai/reset-password
```

This URL is used when requesting password reset emails.

## How Password Reset Works (User Flow)

### Step 1: User Requests Password Reset
1. User goes to `/login`
2. Clicks "Forgot your password?" link
3. Enters email address in modal
4. Clicks "Send Reset Link"

### Step 2: Backend Processes Request
1. `supabase.auth.resetPasswordForEmail(email, { redirectTo: 'https://www.tshla.ai/reset-password' })`
2. Supabase sends email with magic link
3. Link format: `https://minvvjdflezibmgkplqb.supabase.co/auth/v1/verify?token=...&type=recovery&redirect_to=https://www.tshla.ai/reset-password`

### Step 3: User Clicks Email Link
1. Supabase validates token
2. Sets temporary session with `access_token` in URL hash
3. Redirects to: `https://www.tshla.ai/reset-password#access_token=...`

### Step 4: Password Reset Page
1. `ResetPassword` component loads
2. Calls `supabase.auth.getSession()` to validate token
3. If valid: Shows password reset form
4. If invalid: Shows error with link to request new reset

### Step 5: User Resets Password
1. User enters new password (twice for confirmation)
2. Validates password strength
3. Calls `supabase.auth.updateUser({ password: newPassword })`
4. Shows success message
5. Auto-redirects to login page after 3 seconds

### Step 6: User Logs In
1. Redirected to `/login` with success message
2. User logs in with new password
3. Success!

## Required Supabase Dashboard Configuration

**IMPORTANT:** You MUST configure the redirect URL in Supabase dashboard:

1. Go to Supabase dashboard: https://supabase.com/dashboard
2. Select project: `minvvjdflezibmgkplqb`
3. Go to: **Authentication** → **URL Configuration**
4. Under **Redirect URLs**, add:
   - `https://www.tshla.ai/reset-password`
   - `https://www.tshla.ai/auth/confirm` (fallback)
   - `http://localhost:5173/reset-password` (for development)
5. Click **Save**

### Email Templates (Optional Enhancement)

You can customize the password reset email template:

1. Go to: **Authentication** → **Email Templates**
2. Select: **Reset Password**
3. Customize the email content
4. Use variable: `{{ .ConfirmationURL }}` for the reset link

## Testing Checklist

### Local Development
- [ ] Start dev server: `npm run dev`
- [ ] Go to login page
- [ ] Click "Forgot your password?"
- [ ] Enter email address
- [ ] Check email for reset link
- [ ] Click link → Should go to `localhost:5173/reset-password`
- [ ] Enter new password
- [ ] Confirm password matches
- [ ] Submit form
- [ ] Should redirect to login
- [ ] Log in with new password

### Production
- [ ] Deploy to production
- [ ] Go to https://www.tshla.ai/login
- [ ] Click "Forgot your password?"
- [ ] Enter email
- [ ] Check email
- [ ] Click link → Should go to https://www.tshla.ai/reset-password
- [ ] Reset password
- [ ] Log in successfully

## Security Considerations

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### Token Security
- Reset tokens expire after 1 hour (Supabase default)
- Tokens are single-use (invalidated after password change)
- PKCE flow used for enhanced security (`flowType: 'pkce'` in supabase client)
- Session auto-detected from URL hash

### Rate Limiting
- Supabase has built-in rate limiting for password reset requests
- Prevents email flooding/spam

## Troubleshooting

### "Invalid or expired password reset link"
**Cause:** Token expired (>1 hour old) or already used
**Solution:** Request a new password reset email

### "No redirect URL configured"
**Cause:** Supabase dashboard not configured with allowed redirect URLs
**Solution:** Follow "Required Supabase Dashboard Configuration" section above

### Email not received
**Possible causes:**
1. Email in spam folder
2. Email address not registered
3. Email service provider blocking
4. Supabase email quota exceeded

**Solutions:**
1. Check spam/junk folder
2. Verify email is registered in system
3. Check Supabase logs for email delivery status
4. Contact Supabase support if quota issues

### Link redirects to wrong URL
**Cause:** `VITE_SUPABASE_REDIRECT_URL` not set or incorrect
**Solution:** Verify `.env.production` has correct URL and rebuild

## Files Modified

1. **`src/pages/ResetPassword.tsx`** - New password reset page (385 lines)
2. **`src/App.tsx`** - Added two routes for password reset
3. **`src/pages/Login.tsx`** - Added forgot password modal and success message handling
4. **`.env.production`** - Added `VITE_SUPABASE_REDIRECT_URL`

## Environment Variables

### Production (`.env.production`)
```bash
VITE_SUPABASE_URL=https://minvvjdflezibmgkplqb.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
VITE_SUPABASE_REDIRECT_URL=https://www.tshla.ai/reset-password
```

### Development (`.env`)
Add for local testing:
```bash
VITE_SUPABASE_REDIRECT_URL=http://localhost:5173/reset-password
```

## Next Steps After Deployment

1. **Configure Supabase Dashboard** (CRITICAL - won't work without this)
2. **Test password reset flow** end-to-end
3. **Monitor Supabase logs** for any email delivery issues
4. **Update user documentation** with password reset instructions
5. **Consider customizing email template** for better branding

## Support

If users report issues with password reset:
1. Check Supabase dashboard → Authentication → Logs
2. Verify email was sent successfully
3. Check redirect URLs are configured correctly
4. Verify user's email is correct in database
5. Check browser console for JavaScript errors

---

**Deployment Date:** TBD
**Tested By:** TBD
**Production URL:** https://www.tshla.ai/reset-password
