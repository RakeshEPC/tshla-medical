# Registration Redirect Loop - Troubleshooting Guide

## Problem
Users create an account but are redirected back to the registration page instead of proceeding to the assessment.

## Diagnostic Steps

### Step 1: Check Browser Console

Open browser Developer Tools (F12) and watch the Console tab during registration. You should see:

**Successful Registration Flow:**
```
🔍 [PatientRegister] Starting registration process...
✅ [SupabaseAuth] Patient registered successfully { userId, mrn, hasSession: true, hasToken: true }
✅ [SupabaseAuth] Registration complete with active session { hasToken: true }
🔍 [PatientRegister] Registration result: { success: true, hasUser: true, hasToken: true }
✅ [PatientRegister] Token received, session should be active
🚀 [PatientRegister] Redirecting to: /pumpdrive/assessment
```

**Email Confirmation Required Flow:**
```
🔍 [PatientRegister] Starting registration process...
✅ [SupabaseAuth] Patient registered successfully { needsEmailConfirmation: true }
📧 [SupabaseAuth] Email confirmation required - no session created yet
🔍 [PatientRegister] Registration result: { success: true, error: 'CONFIRMATION_REQUIRED' }
📧 [PatientRegister] Email confirmation required - redirecting to login
```

### Step 2: Identify the Issue

Based on console logs, determine which scenario you're in:

#### Scenario A: Email Confirmation Required
**Symptoms:**
- Console shows: `CONFIRMATION_REQUIRED`
- User receives confirmation email
- Redirect to login page

**Solution:**
1. Check your email for confirmation link
2. Click the confirmation link
3. Return to site and log in
4. OR disable email confirmation in Supabase (see below)

#### Scenario B: No Session Created (hasSession: false, hasToken: false)
**Symptoms:**
- Console shows: `hasSession: false, hasToken: false`
- Registration "succeeds" but no redirect
- Or redirects back to registration

**Solution:**
This means Supabase created the auth user but didn't create a session. Check:

1. **Supabase Auth Settings:**
   - Go to Supabase Dashboard → Authentication → Settings
   - Check "Enable email confirmations" setting
   - If enabled, users must confirm email before they can log in

2. **Email Provider Configuration:**
   - Ensure email provider is properly configured in Supabase
   - Check SMTP settings or use Supabase default email

#### Scenario C: Patient Record Not Created
**Symptoms:**
- Console shows: `Failed to create patient profile`
- Error message appears on screen

**Solution:**
1. Check Supabase RLS policies for `patients` table
2. Ensure authenticated users can INSERT into `patients` table
3. Run this SQL in Supabase SQL Editor:

```sql
-- Check if RLS is blocking patient creation
CREATE POLICY "Users can create own patient profile"
  ON public.patients
  FOR INSERT
  WITH CHECK (auth_user_id = auth.uid());

-- Grant necessary permissions
GRANT INSERT ON public.patients TO authenticated;
```

#### Scenario D: Session Exists But Redirect Fails
**Symptoms:**
- Console shows: `hasToken: true`
- Console shows: `Redirecting to: /pumpdrive/assessment`
- But page doesn't change or redirects back

**Solution:**
This is a React Router issue. Check:

1. **Route Configuration** - Ensure route exists in `App.tsx`:
   ```typescript
   <Route path="/pumpdrive/assessment" element={<PumpDriveAssessment />} />
   ```

2. **Protected Route** - Check if assessment page requires authentication:
   ```typescript
   // In the assessment page component
   useEffect(() => {
     const checkAuth = async () => {
       const result = await supabaseAuthService.getCurrentUser();
       if (!result.success) {
         navigate('/patient-login'); // ← This might be causing the redirect loop!
       }
     };
     checkAuth();
   }, []);
   ```

## Solutions

### Solution 1: Disable Email Confirmation (Development Only)

1. Go to Supabase Dashboard → Authentication → Settings
2. Find "Enable email confirmations"
3. **Uncheck** this option
4. Save changes
5. Try creating a new account

**Note:** This is recommended for development/testing only. For production, you should keep email confirmation enabled for security.

### Solution 2: Fix Email Confirmation Flow

If you want to keep email confirmation enabled:

1. Ensure your email provider is properly configured in Supabase
2. Update the confirmation email template to redirect to your app
3. Create a dedicated email confirmation handler page

**Add to `App.tsx`:**
```typescript
<Route path="/auth-redirect" element={<EmailConfirmation />} />
```

**Create `EmailConfirmation.tsx`:**
```typescript
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function EmailConfirmation() {
  const navigate = useNavigate();

  useEffect(() => {
    // Handle the email confirmation callback
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        navigate('/pumpdrive/assessment');
      }
    });
  }, []);

  return (
    <div>
      <h1>Confirming your email...</h1>
      <p>Please wait while we verify your account.</p>
    </div>
  );
}
```

### Solution 3: Fix Protected Route Auth Check

If the assessment page is redirecting authenticated users back to login, update the auth check:

```typescript
// BEFORE (causes redirect loop)
useEffect(() => {
  const checkAuth = async () => {
    const result = await supabaseAuthService.getCurrentUser();
    if (!result.success) {
      navigate('/patient-login'); // Problem!
    }
  };
  checkAuth();
}, []);

// AFTER (better)
useEffect(() => {
  const checkAuth = async () => {
    const result = await supabaseAuthService.getCurrentUser();
    console.log('🔍 [Assessment] Auth check:', result);

    if (!result.success) {
      console.warn('⚠️ [Assessment] Not authenticated, redirecting to login');
      // Add a small delay to ensure session is checked
      setTimeout(() => navigate('/patient-login'), 1000);
    } else {
      console.log('✅ [Assessment] User authenticated:', result.user);
    }
  };
  checkAuth();
}, []);
```

### Solution 4: Check Supabase Session Persistence

Ensure Supabase is configured to persist sessions:

```typescript
// In src/lib/supabase.ts
export const supabase = createClient(env.supabase.url, env.supabase.anonKey, {
  auth: {
    persistSession: true, // ← Ensure this is true
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});
```

## Testing Checklist

After applying fixes, test with these steps:

- [ ] Clear browser cache and cookies
- [ ] Open browser in incognito/private mode
- [ ] Open Developer Console (F12)
- [ ] Navigate to registration page
- [ ] Fill out form and submit
- [ ] Watch console for log messages
- [ ] Verify successful registration logs
- [ ] Confirm redirect to assessment page
- [ ] Verify user can complete assessment
- [ ] Check Supabase database for patient record

## Quick Test

Run this in browser console after "successful" registration:

```javascript
// Check if user is authenticated
const { data: { session } } = await supabase.auth.getSession();
console.log('Session:', session);

// Check if patient record exists
const { data: { user } } = await supabase.auth.getUser();
if (user) {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('auth_user_id', user.id)
    .single();
  console.log('Patient record:', data, error);
}
```

**Expected Output:**
```javascript
Session: { access_token: '...', user: { ... }, expires_at: 123456789 }
Patient record: { id: '...', email: '...', pumpdrive_enabled: true } null
```

## Common Issues

### Issue: "User not authenticated" error immediately after registration

**Cause:** Session wasn't created or wasn't persisted

**Fix:**
1. Check Supabase auth settings
2. Verify `persistSession: true` in supabase client config
3. Disable email confirmation for testing

### Issue: Patient record exists but still redirects to login

**Cause:** Assessment page auth check is too strict

**Fix:**
Update assessment page to check for session instead of making API call

### Issue: Email confirmation link doesn't work

**Cause:** Email redirect URL not configured

**Fix:**
1. Go to Supabase → Authentication → URL Configuration
2. Set "Site URL" to your app's URL (e.g., `http://localhost:5173`)
3. Add redirect URL to allowed list

## Files Modified

- `src/pages/PatientRegister.tsx` - Added detailed console logging
- `src/services/supabaseAuth.service.ts` - Added session/token logging

## Next Steps

1. Try creating a new account with console open
2. Review console logs to identify exact issue
3. Apply appropriate solution from above
4. Test again with new account
5. If still failing, check Supabase Dashboard → Authentication → Users to see if account was created
