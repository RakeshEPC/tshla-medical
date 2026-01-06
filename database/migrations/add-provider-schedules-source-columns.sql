-- Add Missing Source Tracking Columns to provider_schedules
-- Date: 2026-01-05
-- Purpose: Enable appointment import tracking from Athena CSV

-- Add created_from column to track import source
ALTER TABLE provider_schedules
  ADD COLUMN IF NOT EXISTS created_from VARCHAR(100);

-- Add imported_from as an alias (for compatibility)
ALTER TABLE provider_schedules
  ADD COLUMN IF NOT EXISTS imported_from VARCHAR(100);

-- Add index for filtering by source
CREATE INDEX IF NOT EXISTS idx_provider_schedules_created_from
  ON provider_schedules(created_from);

CREATE INDEX IF NOT EXISTS idx_provider_schedules_imported_from
  ON provider_schedules(imported_from);

-- Add comments
COMMENT ON COLUMN provider_schedules.created_from IS 'Source of appointment creation (e.g., athena-import, manual-entry, api)';
COMMENT ON COLUMN provider_schedules.imported_from IS 'Import source format (e.g., athena-csv, manual)';

-- Migration complete!
