-- =====================================================
-- Add Appointment Made Tracking to Patient Summaries
-- =====================================================
-- Created: 2026-01-14
-- Purpose: Track when staff schedules follow-up appointments
--          for patients based on extracted follow-up dates
-- =====================================================

-- Add appointment tracking columns
ALTER TABLE patient_audio_summaries
ADD COLUMN IF NOT EXISTS appointment_made BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS appointment_made_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS appointment_made_by UUID REFERENCES medical_staff(id);

-- Add index for filtering by appointment status
CREATE INDEX IF NOT EXISTS idx_patient_audio_summaries_appointment_made
  ON patient_audio_summaries(appointment_made);

-- Add helpful comments
COMMENT ON COLUMN patient_audio_summaries.appointment_made IS 'Whether follow-up appointment has been scheduled';
COMMENT ON COLUMN patient_audio_summaries.appointment_made_at IS 'When the appointment was marked as made';
COMMENT ON COLUMN patient_audio_summaries.appointment_made_by IS 'Which staff member marked the appointment as made';

-- =====================================================
-- EXAMPLE QUERIES
-- =====================================================

-- Get summaries with follow-up dates but no appointment made yet
-- SELECT * FROM patient_audio_summaries
-- WHERE followup_date IS NOT NULL
--   AND appointment_made = FALSE
--   AND followup_date >= CURRENT_DATE
-- ORDER BY followup_date ASC;

-- Get summaries where appointment was already scheduled
-- SELECT * FROM patient_audio_summaries
-- WHERE appointment_made = TRUE
-- ORDER BY appointment_made_at DESC;
