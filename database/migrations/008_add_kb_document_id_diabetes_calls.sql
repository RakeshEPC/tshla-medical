-- =====================================================
-- Migration 008: Add Knowledge Base Document ID
-- =====================================================
-- Adds kb_document_id column to diabetes_education_calls table
-- for tracking ElevenLabs Knowledge Base documents
-- Created: 2026-01-01

-- Add column for Knowledge Base document ID
ALTER TABLE diabetes_education_calls
ADD COLUMN IF NOT EXISTS kb_document_id VARCHAR(255);

-- Add comment
COMMENT ON COLUMN diabetes_education_calls.kb_document_id IS 'ElevenLabs Knowledge Base document ID for patient data (used for cleanup)';

-- Create index for faster lookups during cleanup
CREATE INDEX IF NOT EXISTS idx_diabetes_education_calls_kb_doc
  ON diabetes_education_calls(kb_document_id)
  WHERE kb_document_id IS NOT NULL;

DO $$
BEGIN
  RAISE NOTICE 'Migration 008 completed successfully: Added kb_document_id to diabetes_education_calls';
END $$;
