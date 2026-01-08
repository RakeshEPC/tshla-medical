# Fix Pump Registration RLS Error - Step by Step

**Error:** "Permission denied: Row Level Security policy is blocking account creation"

**Root Cause:** RLS policies are enabled on `patients` and `access_logs` tables, but anonymous users can't insert new records during registration.

**Time to Fix:** 5 minutes

---

## Quick Fix Steps

### Step 1: Open Supabase SQL Editor (1 min)
1. Go to: https://supabase.com/dashboard
2. Select your project: `minvvjdflezibmgkplqb`
3. Click: **SQL Editor** (left sidebar)
4. Click: **New Query**

### Step 2: Run the Fix Script (2 min)
1. Open file: `database/migrations/fix-pump-registration-rls.sql`
2. Copy ALL contents (Cmd+A, Cmd+C)
3. Paste into SQL Editor
4. Click: **Run** button
5. Wait for: "✅ PUMP REGISTRATION RLS FIX COMPLETE"

### Step 3: Verify the Fix (2 min)
Run this query to check the policies:
```sql
SELECT
    tablename,
    policyname,
    cmd as command,
    roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('patients', 'access_logs')
ORDER BY tablename, policyname;
```

You should see:
- **access_logs**: 2 policies
  - `service_role_all_access_logs` (ALL)
  - `allow_insert_access_logs` (INSERT)

- **patients**: At least 3 policies
  - `service_role_all_patients` (ALL)
  - `allow_anon_insert_patients` (INSERT)
  - `users_read_own_patient` (SELECT)

### Step 4: Test Registration
1. Go to your pump selection tool
2. Try creating a new account
3. It should work now! ✅

---

## What This Fix Does

### Before Fix:
- ❌ RLS enabled on `patients` table
- ❌ No policy allowing anonymous INSERT
- ❌ Registration fails with "Permission denied"

### After Fix:
- ✅ RLS remains enabled (HIPAA compliant)
- ✅ Anonymous users can INSERT into `patients` (only for pump registration)
- ✅ Anonymous users can INSERT into `access_logs` (for logging)
- ✅ Users can read their own patient record
- ✅ Service role has full access (API continues working)

---

## Security Notes

**Is this safe?**
Yes! The policy only allows:
1. INSERT into `patients` when `pumpdrive_enabled = true`
2. INSERT into `access_logs` (logging only, no PHI exposure)
3. Users can only read their OWN patient record

**Does this violate HIPAA?**
No! This maintains HIPAA compliance:
- Users can only see their own data
- Anonymous users cannot read PHI
- All inserts are logged in `access_logs`
- Service role (API) has full access for legitimate operations

---

## Troubleshooting

### If registration still fails:

1. **Check Supabase client configuration**
   In your code, verify you're using the anon key:
   ```javascript
   const supabase = createClient(
     process.env.VITE_SUPABASE_URL,
     process.env.VITE_SUPABASE_ANON_KEY  // ← Should be anon key, not service role
   );
   ```

2. **Check the error message**
   Look for which table is blocking:
   - If it says `patients` → Re-run the fix script
   - If it says `access_logs` → Re-run the fix script
   - If it says another table → Check which table your API is trying to write to

3. **Verify RLS is enabled**
   ```sql
   SELECT tablename, rowsecurity
   FROM pg_tables
   WHERE schemaname = 'public'
     AND tablename IN ('patients', 'access_logs');
   ```
   Both should show `rowsecurity = true`

4. **Check existing policies**
   ```sql
   SELECT * FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('patients', 'access_logs');
   ```

---

## Alternative: Use Service Role in Backend

If you prefer, you can use the service role key in your backend API:

```javascript
// In server/pump-report-api.js
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // ← Service role bypasses RLS
);
```

**Pros:**
- Simpler - service role bypasses all RLS
- No need to create specific policies

**Cons:**
- Less secure if service key leaks
- No row-level protection in backend

**Recommendation:** Use the RLS fix (preferred for HIPAA compliance)

---

## Related Files

- **SQL Fix Script:** `database/migrations/fix-pump-registration-rls.sql`
- **Registration API:** `server/pump-report-api.js` (line 375-524)
- **General RLS Fix:** `RLS-FIX-SCHEMA-ADAPTIVE.sql`
- **RLS Guide:** `RLS-REMEDIATION-GUIDE.md`

---

**Created:** January 8, 2026
**Status:** Ready to Apply
**Priority:** HIGH
