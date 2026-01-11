# QUICK FIX: Add RLS Policies to Load Templates

## Current Status ✅ Code Fixed, ⚠️ Database Policies Missing

**Code fixes deployed** (Jan 11, 2026 at 4:55 PM):
- ✅ Legacy template query bug fixed
- ✅ Debug endpoint enhanced with RLS detection
- ✅ Deepgram CSP violation fixed

**Still required** → **YOU MUST DO THIS NOW**:
- ⚠️ RLS policies missing in Supabase
- ⚠️ Templates won't load until you add policies below

---

## Step-by-Step: Add RLS Policy in Supabase Dashboard

### Step 1: Open Supabase Dashboard
1. Go to: https://supabase.com/dashboard
2. Select project: **tshla-medical** (or your project name)
3. Click **Database** in left sidebar
4. Click **Policies** tab

### Step 2: Navigate to Templates Table
1. In the search box, type: `templates`
2. Click on **templates** table
3. You should see "RLS enabled" badge at top
4. Click **"New Policy"** button

### Step 3: Create Policy for System Templates
1. Click **"Create a policy from scratch"**
2. Fill in the form:
   - **Policy name**: `Allow authenticated users to read system templates`
   - **Allowed operation**: Select **SELECT** only
   - **Target roles**: Select **authenticated**
   - **USING expression**:
     ```sql
     is_system_template = true
     ```
3. Click **"Review"**
4. Click **"Save policy"**

### Step 4: Verify Policy Created
1. You should now see 1 policy listed:
   - ✅ "Allow authenticated users to read system templates" (SELECT, authenticated)
2. If you see it → **SUCCESS!** Templates should now load

---

## Test Templates Loading

### Method 1: Debug Endpoint
Open this URL in your browser (replace with your auth user ID):

```
https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/debug/templates/444130c5-1fd7-4b73-9611-50c94a57da79
```

**Expected response** (after adding RLS policy):
```json
{
  "templates": {
    "system": [
      {"id": "...", "name": "Comprehensive SOAP Note", ...},
      {"id": "...", "name": "Brief Visit Note", ...}
    ],
    "total": 16
  },
  "diagnosis": [
    {"level": "success", "message": "Found 16 system templates"},
    {"level": "success", "message": "Total 16 templates available"}
  ]
}
```

**If still showing RLS errors**:
```json
{
  "diagnosis": [
    {
      "level": "error",
      "message": "Error loading system templates",
      "hint": "RLS policy may be blocking query - check Supabase Dashboard"
    }
  ]
}
```
→ Go back to Step 3 and verify policy was created correctly

### Method 2: Templates Page
1. Login at: https://www.tshla.ai/login
   - Email: `admin@tshla.ai`
   - Password: `TshlaAdmin2025!`
2. Navigate to: https://www.tshla.ai/templates
3. You should see 16 templates listed
4. If still empty → Check browser console for errors

### Method 3: Browser Console Test
1. Login at https://www.tshla.ai
2. Open browser console (F12)
3. Paste this code:
```javascript
const { data, error } = await supabase
  .from('templates')
  .select('id, name, template_type')
  .eq('is_system_template', true);

console.log('Templates:', data?.length || 0);
console.log('Error:', error);
```

**Expected**: `Templates: 16`
**If error**: Check error message - likely says "RLS policy" or "permission denied"

---

## Optional: Add More Policies (For Full Functionality)

After the basic policy works, add these for complete CRUD:

### Policy 2: Read Your Own Templates
```sql
-- In Supabase Dashboard → New Policy:
Policy name: Allow staff to read own templates
Allowed operation: SELECT
Target roles: authenticated
USING expression:
created_by IN (
  SELECT id FROM medical_staff
  WHERE auth_user_id = auth.uid()
)
```

### Policy 3: Create Templates
```sql
-- In Supabase Dashboard → New Policy:
Policy name: Allow staff to create templates
Allowed operation: INSERT
Target roles: authenticated
WITH CHECK expression:
created_by IN (
  SELECT id FROM medical_staff
  WHERE auth_user_id = auth.uid()
)
```

### Policy 4: Update Own Templates
```sql
-- In Supabase Dashboard → New Policy:
Policy name: Allow staff to update own templates
Allowed operation: UPDATE
Target roles: authenticated
USING expression:
created_by IN (
  SELECT id FROM medical_staff
  WHERE auth_user_id = auth.uid()
)
WITH CHECK expression:
created_by IN (
  SELECT id FROM medical_staff
  WHERE auth_user_id = auth.uid()
)
```

### Policy 5: Delete Own Templates (Not System Templates)
```sql
-- In Supabase Dashboard → New Policy:
Policy name: Allow staff to delete own templates
Allowed operation: DELETE
Target roles: authenticated
USING expression:
created_by IN (
  SELECT id FROM medical_staff
  WHERE auth_user_id = auth.uid()
)
AND is_system_template = false
```

---

## Summary

**Minimum to get templates working**: Policy 1 only (system templates)

**Full functionality**: All 5 policies

**Time required**: 5-10 minutes

**If still broken after adding policies**:
1. Clear browser cache: `localStorage.clear(); location.reload();`
2. Check debug endpoint for detailed diagnostics
3. Verify policy SQL exactly matches above (no typos)
4. Check Supabase Dashboard → Authentication → Policies to confirm policies are enabled

---

## Why This Happened

**Jan 8, 2026**: MFA implementation changed auth system
**Result**: Supabase auto-enabled RLS for security
**Impact**: RLS policies were missing/reset → queries blocked

**Root cause**: Authentication changes require RLS policy updates

**Prevention**: See `docs/MFA_IMPLEMENTATION_IMPACT.md` and `docs/INFRASTRUCTURE_CHANGE_CHECKLIST.md`

---

## Questions?

Contact: rakesh@tshla.ai

**Next**: After templates work, see full RLS guide at `docs/SUPABASE_RLS_POLICIES.md`
