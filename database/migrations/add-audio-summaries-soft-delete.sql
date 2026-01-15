-- ============================================
-- Add Soft Delete Support to Patient Audio Summaries
-- ============================================
-- Created: 2026-01-15
-- Purpose: Enable soft deletion of audio summaries created in wrong patient charts
--          Provides audit trail and complete isolation from queries
-- ============================================

-- Add soft delete columns to patient_audio_summaries
ALTER TABLE patient_audio_summaries
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_provider_id UUID,
  ADD COLUMN IF NOT EXISTS deletion_reason VARCHAR(100);

-- Index for filtering out deleted records (CRITICAL for performance)
-- This index makes "WHERE deleted_at IS NULL" queries very fast
CREATE INDEX IF NOT EXISTS idx_audio_summaries_not_deleted
  ON patient_audio_summaries(id) WHERE deleted_at IS NULL;

-- Index for admin view of deleted records
CREATE INDEX IF NOT EXISTS idx_audio_summaries_deleted_at
  ON patient_audio_summaries(deleted_at DESC) WHERE deleted_at IS NOT NULL;

-- Index for audit queries (who deleted what)
CREATE INDEX IF NOT EXISTS idx_audio_summaries_deleted_by
  ON patient_audio_summaries(deleted_by_provider_id) WHERE deleted_at IS NOT NULL;

-- Comments for documentation
COMMENT ON COLUMN patient_audio_summaries.deleted_at IS 'Timestamp when audio summary was soft-deleted. NULL = active, NOT NULL = deleted';
COMMENT ON COLUMN patient_audio_summaries.deleted_by_provider_id IS 'Provider UUID who deleted this audio summary';
COMMENT ON COLUMN patient_audio_summaries.deletion_reason IS 'Reason for deletion: wrong_chart, duplicate, test, other';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check columns were added
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'patient_audio_summaries'
-- AND column_name IN ('deleted_at', 'deleted_by_provider_id', 'deletion_reason');

-- Check indexes were created
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'patient_audio_summaries'
-- AND indexname LIKE '%deleted%';

-- Count active vs deleted summaries
-- SELECT
--   COUNT(*) FILTER (WHERE deleted_at IS NULL) as active_count,
--   COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) as deleted_count,
--   COUNT(*) as total_count
-- FROM patient_audio_summaries;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
