# Quick Fix: Registration Redirect Loop

## Problem
User creates account → Redirected back to registration page

## 2-Minute Fix

### Step 1: Check Console (30 seconds)
1. Open browser (Chrome/Firefox)
2. Press **F12** to open Developer Tools
3. Go to **Console** tab
4. Create new test account
5. Look for one of these messages:

**If you see:**
```
📧 Email confirmation required
```
→ Go to **Fix A** below

**If you see:**
```
✅ Token received, session should be active
🚀 Redirecting to: /pumpdrive/assessment
```
→ Go to **Fix B** below

**If you see:**
```
❌ Registration failed
```
→ Go to **Fix C** below

---

### Fix A: Disable Email Confirmation (1 minute)

**For Development/Testing:**

1. Open Supabase Dashboard
2. Go to **Authentication** → **Settings**
3. Find "Enable email confirmations"
4. **Uncheck** this option
5. Save changes
6. Try creating account again

✅ This allows instant login without email confirmation

---

### Fix B: Check Routes (30 seconds)

The redirect is happening but failing. Check:

**In browser console, run:**
```javascript
console.log(window.location.pathname);
```

**If it shows `/pumpdrive/assessment`:** Your route is correct
**If it shows `/patient-register`:** React Router isn't working

**Quick Fix:**
1. Hard refresh page (Ctrl+Shift+R or Cmd+Shift+R)
2. Clear browser cache
3. Try again in incognito/private window

---

### Fix C: Database Issue (2 minutes)

Run this SQL in Supabase SQL Editor:

```sql
-- Allow users to create patient records
CREATE POLICY IF NOT EXISTS "Users can create own patient profile"
  ON public.patients
  FOR INSERT
  WITH CHECK (auth_user_id = auth.uid());

-- Grant permissions
GRANT INSERT ON public.patients TO authenticated;
GRANT ALL ON public.patients TO authenticated;
```

Then try creating account again.

---

## Still Not Working?

### Debug Mode

1. Open browser console (F12)
2. Create new account
3. **Copy all console output**
4. Look for these specific messages:
   - `[SupabaseAuth] Patient registered successfully`
   - `[PatientRegister] Redirecting to:`
   - Any errors in red

### Check These:

**1. Is account actually created?**
```sql
-- Run in Supabase SQL Editor
SELECT email, created_at, pumpdrive_enabled
FROM patients
ORDER BY created_at DESC
LIMIT 5;
```

**2. Is session active?**
In browser console:
```javascript
const { data } = await supabase.auth.getSession();
console.log('Session:', data.session);
```

**3. Check Supabase email settings:**
- Go to Supabase → Authentication → Settings
- Check "Enable email confirmations" status
- Check "Site URL" is set correctly

---

## Expected Console Output

**When Working Correctly:**
```
🔍 [PatientRegister] Starting registration process...
✅ [SupabaseAuth] Patient registered successfully
✅ [SupabaseAuth] Registration complete with active session
🔍 [PatientRegister] Registration result: { success: true, hasUser: true, hasToken: true }
✅ [PatientRegister] Token received, session should be active
🚀 [PatientRegister] Redirecting to: /pumpdrive/assessment
```

---

## Common Causes

1. **Email confirmation enabled** (most common)
   - Fix: Disable in Supabase settings

2. **RLS policy blocking insert**
   - Fix: Run SQL above to grant permissions

3. **React Router not configured**
   - Fix: Check App.tsx has route for `/pumpdrive/assessment`

4. **Session not persisting**
   - Fix: Clear cache, try incognito mode

---

## Test Your Fix

- [ ] Open browser in incognito mode
- [ ] Press F12 to open console
- [ ] Navigate to registration page
- [ ] Fill out form with test email
- [ ] Watch console for success messages
- [ ] Verify redirect to assessment page

---

## Files With Debug Logging

- `src/pages/PatientRegister.tsx` - Registration flow
- `src/services/supabaseAuth.service.ts` - Auth logic

Both files now have detailed console logging with emoji indicators:
- 🔍 = Debug/info
- ✅ = Success
- ❌ = Error
- 📧 = Email related
- 🚀 = Redirect/navigation

---

## Need More Help?

See detailed guide: `REGISTRATION-REDIRECT-FIX-GUIDE.md`
