# Password Reset Protocol

## Purpose
This document defines procedures for password resets, especially after authentication system changes that may invalidate existing passwords.

---

## When Passwords May Break

### Authentication System Changes
Any of these changes can invalidate existing passwords or sessions:

- ✅ **MFA Implementation** (Phase 4 - Jan 8, 2026)
  - Supabase native MFA forced session refresh
  - All staff passwords needed reset
  - Impact: All medical staff locked out

- ✅ **Session Management Hardening** (Phase 6 - Jan 6-8, 2026)
  - Shortened session timeouts
  - Enhanced security headers
  - Impact: Frequent re-logins required

- ✅ **Client-Side Encryption** (Phase 5)
  - LocalStorage encryption changes
  - Impact: Cached credentials invalidated

- ⚠️ **Future Risk**: Any Supabase auth policy changes

---

## Pre-Deployment Checklist

### Before Deploying Auth Changes

1. **Identify Impact**
   - [ ] Will this force password resets?
   - [ ] Will this invalidate existing sessions?
   - [ ] Will this change the login flow?

2. **Communicate to Users** (24-48 hours in advance)
   ```
   Subject: [ACTION REQUIRED] Password Reset on [Date]

   Team,

   We're deploying [MFA/security updates/etc] on [date].

   IMPACT:
   - You will need to reset your password
   - Your current session will be logged out
   - Please save any open work before [time]

   NEW PASSWORD REQUIREMENTS:
   - Minimum [X] characters
   - Must include [requirements]

   RESET PROCEDURE:
   1. Go to https://www.tshla.ai/login
   2. Click "Forgot Password"
   3. Check your email
   4. Create new password

   TROUBLESHOOTING:
   - If you don't receive reset email, contact rakesh@tshla.ai
   - If login fails after reset, try clearing browser cache

   Questions? Reply to this email.

   Thank you,
   Rakesh
   ```

3. **Prepare Support**
   - [ ] Test password reset flow in staging
   - [ ] Have reset scripts ready (see below)
   - [ ] Monitor Slack/email for issues
   - [ ] Schedule deployment during low-usage time

---

## Password Reset Procedures

### Method 1: Self-Service (Preferred)

**User Instructions:**

1. Go to https://www.tshla.ai/login
2. Click **"Forgot Password"** link
3. Enter your email address
4. Check email for reset link (check spam folder)
5. Create new password (requirements: 12+ chars, mixed case, numbers, symbols)
6. Login with new password

**If email doesn't arrive:**
- Check spam/junk folder
- Verify email address is correct
- Wait 5 minutes (email can be delayed)
- Contact admin for manual reset

---

### Method 2: Admin Manual Reset

**When to use:**
- User not receiving reset emails
- Account locked/suspended
- Emergency access needed
- User forgot their email address

**Script:** `scripts/reset-admin-password.ts`

```bash
# Interactive mode - prompts for email/password
npx tsx scripts/reset-admin-password.ts
```

**Example:**
```
$ npx tsx scripts/reset-admin-password.ts

🔐 TSHLA Medical - Reset Admin Password

Enter admin email: radha@tshla.ai
Enter new password: RadhaSecure2025!

🔄 Resetting password...

✅ Password reset successfully!

📋 Login Credentials:
   Email: radha@tshla.ai
   Password: RadhaSecure2025!
   URL: https://www.tshla.ai/login
```

---

### Method 3: Bulk Admin Reset

**When to use:**
- Post-MFA deployment (all staff need reset)
- Security breach response
- Mass account migration

**Script:** `scripts/find-and-fix-admin.cjs`

This script:
1. Lists all auth users
2. Finds medical staff accounts
3. Resets passwords to default: `TshlaAdmin2025!`
4. Fixes auth_user_id mismatches

```bash
node scripts/find-and-fix-admin.cjs
```

**Output:**
```
🔧 Finding and fixing staff accounts...

1️⃣  Fetching all auth users...
   ✅ Found 67 total auth users

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 Processing: admin@tshla.ai
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Found auth user:
   ID: 444130c5-1fd7-4b73-9611-50c94a57da79
   Email: admin@tshla.ai
   Confirmed: Yes

🔑 Resetting password...
   ✅ Password reset successful

📋 Checking medical_staff record...
   ✅ Found medical_staff record
   ✅ Auth User ID matches

🧪 Testing login...
   ✅ Login successful!
```

**Important:** After bulk reset, send password change email to ALL staff.

---

## Troubleshooting

### Issue: "Invalid login credentials" after reset

**Causes:**
1. Password not actually reset (check Supabase dashboard)
2. Auth user ID mismatch between auth.users and medical_staff
3. Browser cache holding old password
4. Account disabled/banned

**Diagnosis Script:**
```bash
npx tsx scripts/diagnose-login.ts
```

**Expected Output:**
```
🔍 TSHLA Medical Login Diagnostic Tool

1️⃣  CHECKING AUTH USERS IN SUPABASE
✅ Found 67 users in auth.users table

2️⃣  CHECKING MEDICAL_STAFF TABLE
✅ Found 19 records in medical_staff table

   1. admin@tshla.ai
      - ID: d24f32c8-3af2-49a2-88bd-34d56d4cf131
      - Auth User ID: 444130c5-1fd7-4b73-9611-50c94a57da79 ✅
      - Active: ✅
      - Verified: ✅

4️⃣  TESTING LOGIN ATTEMPTS

🔐 Testing: admin@tshla.ai
   Password: TshlaAdmin2025!
   ✅ SUCCESS
```

**Fix:**
If Auth User ID shows ❌ MISSING:
```bash
node scripts/find-and-fix-admin.cjs
```

---

### Issue: User not in medical_staff table

**Symptom:** Auth user exists but no medical_staff record

**Diagnosis:**
```bash
npx tsx scripts/diagnose-login.ts
# Look for: "ORPHANED AUTH USERS (no medical_staff record)"
```

**Fix:**
Manually create medical_staff record in Supabase:

```sql
INSERT INTO medical_staff (
  email,
  username,
  first_name,
  last_name,
  role,
  specialty,
  practice,
  auth_user_id,
  is_active,
  is_verified
) VALUES (
  'newdoctor@tshla.ai',
  'newdoctor',
  'New',
  'Doctor',
  'doctor',
  'Internal Medicine',
  'TSHLA Medical',
  '< AUTH_USER_ID from auth.users >',
  true,
  true
);
```

---

### Issue: Auth user doesn't exist at all

**Symptom:** Email not found in auth.users table

**Fix:** Create new auth user + medical_staff:
```bash
npx tsx scripts/setup-admin-accounts.ts
# Choose option 2: Create custom admin account
```

---

## Password Requirements

### Current Requirements (as of Jan 2026)
- Minimum 12 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character (!@#$%^&*)

### Recommended Password Format
```
[Name][System][Year]!

Examples:
- RakeshAdmin2026!
- RadhaSecure2026!
- TessDoctor2026!
```

**Why this format:**
- Easy to remember
- Meets all requirements
- Can be updated annually by changing year

---

## Historical Password Incidents

### Jan 8, 2026: MFA Implementation Password Reset
**Trigger:** Supabase native MFA rollout (Phase 4)

**Impact:**
- All medical staff passwords invalidated
- No advance warning to users
- Mass lockout on Monday morning

**Response:**
- Ran `find-and-fix-admin.cjs` to reset all passwords
- Sent emergency email with new default password
- Requested all staff change passwords immediately

**Lesson Learned:**
- Always communicate auth changes 24-48 hours in advance
- Deploy auth changes on Friday afternoon, not Sunday night
- Have bulk reset script ready BEFORE deployment

**Prevention:**
- Created this protocol document
- Added auth change checklist to `INFRASTRUCTURE_CHANGE_CHECKLIST.md`
- Scheduled quarterly password rotation reminders

---

### Dec 2025: Supabase Project Reset
**Trigger:** Accidentally clicked "Reset project" in Supabase dashboard

**Impact:**
- All auth.users deleted
- medical_staff table intact but orphaned
- Total system outage

**Response:**
- Restored from database backup
- Re-created auth users from medical_staff table
- Re-linked auth_user_id fields

**Lesson Learned:**
- Enable Supabase project deletion protection
- Daily database backups to separate storage
- Document database restore procedure

**Prevention:**
- Added backup/restore scripts to `scripts/` directory
- Enabled Supabase Point-in-Time Recovery (PITR)
- Created `docs/DATABASE_BACKUP_RESTORE.md` (TODO)

---

## Related Documentation

- **Infrastructure Changes**: `docs/INFRASTRUCTURE_CHANGE_CHECKLIST.md`
- **Authentication Flow**: `docs/AUTHENTICATION.md` (TODO)
- **Database Backups**: `docs/DATABASE_BACKUP_RESTORE.md` (TODO)
- **Supabase Setup**: `docs/SUPABASE_SETUP.md` (TODO)

---

## Scripts Reference

| Script | Purpose | Usage |
|--------|---------|-------|
| `reset-admin-password.ts` | Reset single user password | Interactive prompt |
| `find-and-fix-admin.cjs` | Bulk reset + fix auth linkage | No arguments |
| `diagnose-login.ts` | Troubleshoot login issues | No arguments |
| `setup-admin-accounts.ts` | Create new admin accounts | Interactive menu |

---

## Questions?

Contact: rakesh@tshla.ai

**Remember**: Communicate early, communicate often. Users hate surprises more than scheduled maintenance.
