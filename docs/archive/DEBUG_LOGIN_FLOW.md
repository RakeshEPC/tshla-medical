# Debug Login Flow - Step by Step

## Issue: Login redirects to create account page

### Possible Scenarios:

#### Scenario 1: You're at `/patient-login` and after entering credentials, it redirects to register
**Check**:
- Open browser console (F12)
- Go to `/patient-login`
- Enter email: `Poolpatel@tshla.ai`
- Enter password
- Click "Login"
- Watch console for these messages:
  ```
  🔐 [SupabaseAuth] Universal login starting
  ✅ [SupabaseAuth] Patient login successful
  ```
- What URL do you end up at?

#### Scenario 2: You click a "Login" link somewhere that goes to wrong place
**Check**:
- Where are you clicking "Login" from?
- What page are you on before clicking?
- Does it take you to `/patient-login` or somewhere else?

#### Scenario 3: Login succeeds but redirect to `/pumpdrive/assessment` fails auth check
**Check**:
- Login at `/patient-login`
- After login, watch for redirect
- Check console for:
  ```
  🔐 PumpDriveAuthGuard: Checking authentication...
  ✅ Auth check PASSED
  ```
  OR
  ```
  ❌ Auth check FAILED
  🔄 Redirecting to patient-login...
  ```

### Debug Steps:

1. **Clear Everything First**:
   ```javascript
   // In browser console
   localStorage.clear();
   sessionStorage.clear();
   location.reload();
   ```

2. **Go to Patient Login**:
   - Navigate to: `http://localhost:5173/patient-login`
   - Or production: `https://your-site.com/patient-login`

3. **Open Console** (F12) and watch for logs

4. **Login**:
   - Email: `Poolpatel@tshla.ai`
   - Password: [your password]
   - Click "Login"

5. **Record What Happens**:
   - What URL are you on after clicking login?
   - What does console show?
   - Any error messages?

### Expected Flow (If Working):

```
START: /patient-login
  ↓
[Enter credentials]
  ↓
[Click Login]
  ↓
Console: "🔐 [SupabaseAuth] Starting patient login..."
  ↓
Console: "✅ [SupabaseAuth] Patient login successful"
  ↓
Console: "Navigating to /pumpdrive/assessment"
  ↓
URL changes to: /pumpdrive/assessment
  ↓
Console: "🔐 PumpDriveAuthGuard: Checking authentication..."
  ↓
Console: "✅ Auth check PASSED - User authenticated"
  ↓
FINAL: You see pump questionnaire
```

### If Something Goes Wrong:

**If stuck at patient-login**:
- Check console for auth errors
- Check if loginPatient() is being called

**If redirected to patient-register**:
- Check console for navigation logs
- Check if there's a redirect in sessionStorage:
  ```javascript
  sessionStorage.getItem('pumpDriveRedirectAfterLogin')
  ```

**If see "Auth check FAILED"**:
- Check Supabase session:
  ```javascript
  // In console
  const { data } = await window.supabase.auth.getSession();
  console.log('Session:', data.session);
  ```

### Test Script (Run in Browser Console):

```javascript
// Test login programmatically
async function testLogin() {
  const email = 'Poolpatel@tshla.ai';
  const password = 'YOUR_PASSWORD_HERE';

  console.log('🧪 Testing login...');

  // Import auth service
  const { supabaseAuthService } = await import('/src/services/supabaseAuth.service.ts');

  // Try login
  const result = await supabaseAuthService.loginPatient(email, password);

  console.log('Result:', result);

  if (result.success) {
    console.log('✅ Login successful!');
    console.log('User:', result.user);
    console.log('Access Type:', result.user.accessType);
  } else {
    console.log('❌ Login failed:', result.error);
  }

  // Check if authenticated
  const isAuth = await supabaseAuthService.isAuthenticated();
  console.log('Is Authenticated:', isAuth);

  // Get current user
  const currentUser = await supabaseAuthService.getCurrentUser();
  console.log('Current User:', currentUser);
}

// Run test
testLogin();
```

### Quick Fixes to Try:

1. **Clear ALL browser data for the site**
2. **Try incognito/private window**
3. **Check if you're already logged in**:
   ```javascript
   // In console
   localStorage.getItem('sb-minvvjdflezibmgkplqb-auth-token')
   // If this exists, you're already logged in
   ```

4. **Force logout then login**:
   ```javascript
   // In console
   const { supabaseAuthService } = await import('/src/services/supabaseAuth.service.ts');
   await supabaseAuthService.logout();
   location.href = '/patient-login';
   ```

---

## Tell Me:

1. **Where do you START?** (what page URL)
2. **What do you CLICK?** (which button/link)
3. **Where do you END UP?** (what page URL)
4. **What does CONSOLE show?** (copy any error messages)

This will help me pinpoint exactly where the redirect is happening!
