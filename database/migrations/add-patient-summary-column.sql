-- Add patient_summary column for 45-60 second patient-friendly audio summaries
-- This is what will be converted to TTS audio for patient portal

ALTER TABLE dictated_notes
ADD COLUMN IF NOT EXISTS patient_summary TEXT;

COMMENT ON COLUMN dictated_notes.patient_summary IS
'AI-generated patient-friendly summary (45-60 seconds when spoken) for audio playback in patient portal';
