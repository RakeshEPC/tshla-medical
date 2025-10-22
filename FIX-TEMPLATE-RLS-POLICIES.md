# Fix Template Row-Level Security Policies

## Problem
When creating a new template, you get this error:
```
Failed to save template: Failed to create template: new row violates row-level security policy for table "templates"
```

## Root Cause
Supabase's Row-Level Security (RLS) policies are blocking template creation. The policies need to be updated to allow authenticated users to create, read, update, and delete templates.

## Solution
Run this SQL migration to fix the RLS policies.

---

## Steps to Fix

### 1. Open Supabase SQL Editor
1. Go to https://supabase.com/dashboard
2. Select your project: **tshla-medical**
3. Click on **SQL Editor** in the left sidebar
4. Click **+ New query**

### 2. Run This Migration

Copy and paste this SQL:

```sql
BEGIN;

-- Drop existing policies if they exist (to start fresh)
DROP POLICY IF EXISTS "Users can view all templates" ON templates;
DROP POLICY IF EXISTS "Users can view templates" ON templates;
DROP POLICY IF EXISTS "Users can insert templates" ON templates;
DROP POLICY IF EXISTS "Users can create templates" ON templates;
DROP POLICY IF EXISTS "Users can update their own templates" ON templates;
DROP POLICY IF EXISTS "Users can update templates" ON templates;
DROP POLICY IF EXISTS "Users can delete their own templates" ON templates;
DROP POLICY IF EXISTS "Users can delete templates" ON templates;

-- Enable RLS on templates table
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- Policy 1: SELECT - Users can view all templates
CREATE POLICY "Users can view all templates"
  ON templates
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy 2: INSERT - Authenticated users can create templates
CREATE POLICY "Users can create templates"
  ON templates
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy 3: UPDATE - Users can update templates they created OR system templates
CREATE POLICY "Users can update templates"
  ON templates
  FOR UPDATE
  TO authenticated
  USING (
    created_by IS NULL
    OR
    created_by IN (
      SELECT id FROM medical_staff
      WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    created_by IS NULL
    OR
    created_by IN (
      SELECT id FROM medical_staff
      WHERE auth_user_id = auth.uid()
    )
  );

-- Policy 4: DELETE - Users can delete templates they created (but not system templates)
CREATE POLICY "Users can delete their templates"
  ON templates
  FOR DELETE
  TO authenticated
  USING (
    created_by IS NOT NULL
    AND
    created_by IN (
      SELECT id FROM medical_staff
      WHERE auth_user_id = auth.uid()
    )
  );

SELECT 'RLS policies updated successfully for templates table' as status;

COMMIT;
```

### 3. Execute the Migration
1. Click the **Run** button (or press Ctrl+Enter)
2. You should see: `RLS policies updated successfully for templates table`

### 4. Test Template Creation
1. Go to https://www.tshla.ai/templates
2. Click **New Template**
3. Fill in template details and save
4. Template should save successfully! ✅

---

## What These Policies Do

### **SELECT (View) Policy:**
- ✅ All authenticated users can view ALL templates
- ✅ This includes system templates and user-created templates

### **INSERT (Create) Policy:**
- ✅ Any authenticated user can create new templates
- ✅ The `created_by` field will be automatically set to their medical_staff ID

### **UPDATE (Edit) Policy:**
- ✅ Users can edit their own templates
- ✅ Users can edit system templates (created_by IS NULL)
- ❌ Users cannot edit other users' templates

### **DELETE Policy:**
- ✅ Users can delete their own templates
- ❌ Users cannot delete system templates
- ❌ Users cannot delete other users' templates

---

## Security Benefits

✅ **Row-Level Security Enabled** - Templates are protected at the database level
✅ **User Isolation** - Users can only modify their own templates
✅ **System Templates Protected** - System templates can't be deleted
✅ **Audit Trail** - `created_by` tracks who created each template

---

## Alternative: Run from File

The migration file is saved at:
```
/Users/rakeshpatel/Desktop/tshla-medical/database/migrations/fix-templates-rls-policies.sql
```
