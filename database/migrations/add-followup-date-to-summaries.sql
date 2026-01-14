-- =====================================================
-- Add Follow-Up Date to Patient Audio Summaries
-- =====================================================
-- Created: 2026-01-14
-- Purpose: Add AI-extracted follow-up date and notes
--          to patient summaries for appointment tracking
-- =====================================================

-- Add follow-up columns to patient_audio_summaries table
ALTER TABLE patient_audio_summaries
ADD COLUMN IF NOT EXISTS followup_date DATE,
ADD COLUMN IF NOT EXISTS followup_notes TEXT;

-- Add index for filtering/sorting by follow-up date
CREATE INDEX IF NOT EXISTS idx_patient_audio_summaries_followup_date
  ON patient_audio_summaries(followup_date);

-- Add comment to explain the columns
COMMENT ON COLUMN patient_audio_summaries.followup_date IS 'AI-extracted date when patient should follow up (e.g., return visit, repeat labs)';
COMMENT ON COLUMN patient_audio_summaries.followup_notes IS 'Context about the follow-up (e.g., "Repeat TSH and Free T4 labs", "Post-op check")';

-- =====================================================
-- EXAMPLE QUERIES
-- =====================================================

-- Get summaries with upcoming follow-ups (next 30 days)
-- SELECT * FROM patient_audio_summaries
-- WHERE followup_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
-- ORDER BY followup_date ASC;

-- Get overdue follow-ups
-- SELECT * FROM patient_audio_summaries
-- WHERE followup_date < CURRENT_DATE
-- ORDER BY followup_date ASC;

-- Get summaries without scheduled follow-up
-- SELECT * FROM patient_audio_summaries
-- WHERE followup_date IS NULL;
