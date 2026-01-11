# Supabase RLS Policies - Templates Table

## Problem Statement

After the MFA implementation (Jan 8, 2026), templates stopped loading for authenticated users. Investigation revealed that Row Level Security (RLS) policies on the `templates` table are blocking queries from the frontend, even though 16 templates exist in the database.

---

## How to Check RLS Status

### In Supabase Dashboard:
1. Go to: **Database** → **Tables** → `templates`
2. Look for "RLS enabled" badge at the top
3. Click **Policies** tab
4. Check what policies exist (or if none exist)

### Expected State:
- **RLS**: Enabled (for security)
- **Policies**: Should allow authenticated users to SELECT system templates

---

## Required RLS Policies

### Policy 1: Allow Authenticated Users to Read System Templates

**Purpose**: Let any logged-in user see system-wide templates (is_system_template = true)

**SQL**:
```sql
CREATE POLICY "Allow authenticated users to read system templates"
ON templates FOR SELECT
TO authenticated
USING (is_system_template = true);
```

**Explanation**:
- `ON templates FOR SELECT` → Applies to SELECT queries only
- `TO authenticated` → Only for logged-in users (not anonymous)
- `USING (is_system_template = true)` → Only rows where is_system_template is true

---

### Policy 2: Allow Medical Staff to Read Their Own Templates

**Purpose**: Let medical staff see templates they created

**SQL**:
```sql
CREATE POLICY "Allow staff to read own templates"
ON templates FOR SELECT
TO authenticated
USING (
  created_by IN (
    SELECT id FROM medical_staff
    WHERE auth_user_id = auth.uid()
  )
);
```

**Explanation**:
- `auth.uid()` → Supabase function that returns current user's auth ID
- Joins to `medical_staff` to get staff_id
- Only returns templates where `created_by` matches the user's staff_id

---

### Policy 3: Allow Staff to Create Templates

**Purpose**: Let medical staff create new templates

**SQL**:
```sql
CREATE POLICY "Allow staff to create templates"
ON templates FOR INSERT
TO authenticated
WITH CHECK (
  created_by IN (
    SELECT id FROM medical_staff
    WHERE auth_user_id = auth.uid()
  )
);
```

---

### Policy 4: Allow Staff to Update Their Own Templates

**Purpose**: Let medical staff edit their templates

**SQL**:
```sql
CREATE POLICY "Allow staff to update own templates"
ON templates FOR UPDATE
TO authenticated
USING (
  created_by IN (
    SELECT id FROM medical_staff
    WHERE auth_user_id = auth.uid()
  )
)
WITH CHECK (
  created_by IN (
    SELECT id FROM medical_staff
    WHERE auth_user_id = auth.uid()
  )
);
```

---

### Policy 5: Allow Staff to Delete Their Own Templates

**Purpose**: Let medical staff delete their templates (but NOT system templates)

**SQL**:
```sql
CREATE POLICY "Allow staff to delete own templates"
ON templates FOR DELETE
TO authenticated
USING (
  created_by IN (
    SELECT id FROM medical_staff
    WHERE auth_user_id = auth.uid()
  )
  AND is_system_template = false
);
```

**Note**: `AND is_system_template = false` prevents deleting system templates

---

## How to Add Policies

### Method 1: Supabase Dashboard (Easiest)

1. Go to: **Database** → **Tables** → `templates` → **Policies**
2. Click **"New Policy"**
3. Choose **"Create a policy from scratch"**
4. Fill in:
   - **Policy name**: `Allow authenticated users to read system templates`
   - **Policy command**: `SELECT`
   - **Target roles**: `authenticated`
   - **USING expression**: `is_system_template = true`
5. Click **"Review"** → **"Save policy"**
6. Repeat for each policy above

---

### Method 2: SQL Editor (Faster)

1. Go to: **SQL Editor** in Supabase Dashboard
2. Paste all 5 policies (see above)
3. Click **"Run"**
4. Verify: Go to **Templates** table → **Policies** tab → Should see 5 policies

---

## Testing After Adding Policies

### Step 1: Test in Browser Console

```javascript
// In browser console at https://www.tshla.ai
const { data, error } = await supabase
  .from('templates')
  .select('id, name, template_type')
  .eq('is_system_template', true);

console.log('Templates:', data?.length || 0);
console.log('Error:', error);
```

**Expected**: `Templates: 16` (or however many system templates exist)

---

### Step 2: Test Templates Page

1. Navigate to `/templates`
2. Templates should now appear
3. Check browser console - should NOT see RLS errors

---

### Step 3: Use Debug Endpoint

```bash
# Replace with your auth user ID
curl https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/debug/templates/444130c5-1fd7-4b73-9611-50c94a57da79
```

**Expected Response**:
```json
{
  "timestamp": "...",
  "medicalStaff": {...},
  "templates": {
    "user": [],
    "system": [{"id": "...", "name": "Comprehensive SOAP Note", ...}],
    "legacy": [],
    "total": 16
  },
  "diagnosis": [
    {"level": "success", "message": "Medical staff record found"},
    {"level": "info", "message": "Found 0 user templates"},
    {"level": "info", "message": "Found 16 system templates"},
    {"level": "success", "message": "Total 16 templates available"}
  ]
}
```

---

## Troubleshooting

### Issue: Still seeing "No templates" after adding policies

**Check 1**: Are policies actually created?
- Supabase Dashboard → Templates → Policies tab
- Should see all 5 policies listed

**Check 2**: Is RLS enabled?
- Templates table should show "RLS enabled" badge
- If disabled, enable it and add policies

**Check 3**: Check debug endpoint for errors
- Should NOT see errors like "RLS policy blocking query"
- Should see `"total": 16` or more

**Check 4**: Clear localStorage cache
```javascript
// In browser console
localStorage.clear();
location.reload();
```

---

### Issue: Can see system templates but not my own

**Cause**: Policy 2 might be wrong or missing

**Check**: Medical staff record exists and has correct auth_user_id
```bash
npx tsx scripts/diagnose-login.ts
```

**Fix**: Update Policy 2 to match your schema

---

### Issue: Can't create new templates

**Cause**: Policy 3 (INSERT) might be missing

**Check**: Try creating a template in UI - check browser console for errors

**Fix**: Add Policy 3 from above

---

## Why RLS Broke After MFA

**Timeline**:
1. **Before MFA**: RLS may have been disabled or had permissive policies
2. **Jan 8**: MFA implementation changed auth flow
3. **Result**: Supabase may have:
   - Auto-enabled RLS for security
   - Reset policies to defaults (none)
   - Changed how `auth.uid()` works with MFA

**Root Cause**: Authentication system changes often require RLS policy updates

---

## Prevention

### Before Changing Auth System:
1. **Document current RLS policies** (export SQL)
2. **Test in staging** with RLS enabled
3. **Verify policies** still work with new auth flow
4. **Update policies** if `auth.uid()` or user tables change

### After Deploying Auth Changes:
1. **Immediately test** template loading
2. **Check debug endpoint** for RLS errors
3. **Re-apply policies** if needed
4. **Document** any policy changes made

---

## Related Documentation

- [MFA Implementation Impact](./MFA_IMPLEMENTATION_IMPACT.md) - Why this happened
- [Password Reset Protocol](./PASSWORD_RESET_PROTOCOL.md) - Auth change procedures
- [Infrastructure Checklist](./INFRASTRUCTURE_CHANGE_CHECKLIST.md) - Deployment guidelines

---

## Supabase RLS Documentation

Official docs: https://supabase.com/docs/guides/auth/row-level-security

**Key Concepts**:
- **`auth.uid()`** - Returns current user's auth ID
- **`TO authenticated`** - Only logged-in users
- **`USING`** - Read permission check
- **`WITH CHECK`** - Write permission check

---

## Quick Reference

### Check if RLS is blocking:
```bash
# Look for error in response
curl https://tshla-unified-api.../api/debug/templates/YOUR_AUTH_ID | grep -i "rls"
```

### Disable RLS temporarily (testing only):
```sql
ALTER TABLE templates DISABLE ROW LEVEL SECURITY;
-- Test if templates load
-- If yes, RLS was the problem
-- Re-enable and add policies:
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
```

### Re-create all policies at once:
```sql
-- Drop existing policies (if any)
DROP POLICY IF EXISTS "Allow authenticated users to read system templates" ON templates;
DROP POLICY IF EXISTS "Allow staff to read own templates" ON templates;
DROP POLICY IF EXISTS "Allow staff to create templates" ON templates;
DROP POLICY IF EXISTS "Allow staff to update own templates" ON templates;
DROP POLICY IF EXISTS "Allow staff to delete own templates" ON templates;

-- Re-create (paste all 5 CREATE POLICY statements from above)
```

---

## Questions?

Contact: rakesh@tshla.ai

**Remember**: RLS is essential for security. Don't disable it in production - fix the policies instead!
