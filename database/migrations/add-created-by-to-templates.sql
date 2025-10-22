-- =====================================================
-- ADD created_by COLUMN TO templates TABLE
-- =====================================================
-- Purpose: Link templates to the medical_staff member who created them
-- Run this in Supabase SQL Editor
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
