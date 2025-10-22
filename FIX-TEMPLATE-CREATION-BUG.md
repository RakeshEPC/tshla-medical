# Fix Template Creation Bug

## Problem
When creating a new template, you get this error:
```
❌ Failed to save template: Failed to create template: Could not find the 'created_by' column of 'templates' in the schema cache
```

## Root Cause
The `templates` table in Supabase is missing the `created_by` column that the code expects.

## Solution
Run the SQL migration to add the missing column.

## Steps to Fix

### 1. Open Supabase SQL Editor
1. Go to https://supabase.com/dashboard
2. Select your project: **tshla-medical**
3. Click on **SQL Editor** in the left sidebar
4. Click **+ New query**

### 2. Run the Migration
Copy and paste this SQL into the editor:

```sql
-- =====================================================
-- ADD created_by COLUMN TO templates TABLE
-- =====================================================
-- Purpose: Link templates to the medical_staff member who created them
-- =====================================================

BEGIN;

-- Add created_by column if it doesn't exist
ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES medical_staff(id) ON DELETE SET NULL;

-- Add index for faster queries by created_by
CREATE INDEX IF NOT EXISTS idx_templates_created_by ON templates(created_by);

-- Add comment to document the column
COMMENT ON COLUMN templates.created_by IS 'ID of medical_staff member who created this template';

-- Update existing templates to have NULL created_by (they were created before this migration)
-- System templates should remain with created_by = NULL

SELECT 'Migration complete: created_by column added to templates table' as status;

COMMIT;
```

### 3. Execute the Migration
1. Click the **Run** button (or press Ctrl+Enter)
2. You should see: `Migration complete: created_by column added to templates table`

### 4. Verify the Fix
1. Go back to https://www.tshla.ai/templates
2. Try creating a new template
3. The template should save successfully without errors

## What This Does

- ✅ Adds `created_by` column to link templates to their creators
- ✅ Creates an index for faster queries
- ✅ Keeps existing templates with `created_by = NULL` (they're legacy/system templates)
- ✅ New templates will have `created_by` set to the logged-in staff member's ID

## Alternative: Run from File

The migration file is saved at:
```
/Users/rakeshpatel/Desktop/tshla-medical/database/migrations/add-created-by-to-templates.sql
```

You can also copy the contents from there if needed.
