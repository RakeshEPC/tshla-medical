-- ============================================
-- Add Soft Delete Support to Dictations
-- ============================================
-- Created: 2026-01-15
-- Purpose: Enable soft deletion of dictations created in wrong patient charts
--          Provides audit trail and complete isolation from queries
-- ============================================

-- Add soft delete columns
ALTER TABLE dictations
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_provider_id UUID,
  ADD COLUMN IF NOT EXISTS deletion_reason VARCHAR(100);

-- Index for filtering out deleted records (CRITICAL for performance)
-- This index makes "WHERE deleted_at IS NULL" queries very fast
CREATE INDEX IF NOT EXISTS idx_dictations_not_deleted
  ON dictations(id) WHERE deleted_at IS NULL;

-- Index for admin view of deleted records
CREATE INDEX IF NOT EXISTS idx_dictations_deleted_at
  ON dictations(deleted_at DESC) WHERE deleted_at IS NOT NULL;

-- Index for audit queries (who deleted what)
CREATE INDEX IF NOT EXISTS idx_dictations_deleted_by
  ON dictations(deleted_by_provider_id) WHERE deleted_at IS NOT NULL;

-- Comments for documentation
COMMENT ON COLUMN dictations.deleted_at IS 'Timestamp when dictation was soft-deleted. NULL = active, NOT NULL = deleted';
COMMENT ON COLUMN dictations.deleted_by_provider_id IS 'Provider UUID who deleted this dictation';
COMMENT ON COLUMN dictations.deletion_reason IS 'Reason for deletion: wrong_chart, duplicate, test, other';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check columns were added
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'dictations'
-- AND column_name IN ('deleted_at', 'deleted_by_provider_id', 'deletion_reason');

-- Check indexes were created
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'dictations'
-- AND indexname LIKE '%deleted%';

-- Count active vs deleted dictations
-- SELECT
--   COUNT(*) FILTER (WHERE deleted_at IS NULL) as active_count,
--   COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) as deleted_count,
--   COUNT(*) as total_count
-- FROM dictations;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Next steps:
-- 1. Run this SQL in Supabase SQL Editor
-- 2. Update application queries to filter deleted_at IS NULL
-- 3. Implement delete UI with confirmation
-- ============================================
