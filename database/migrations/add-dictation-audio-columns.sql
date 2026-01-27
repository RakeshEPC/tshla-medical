/**
 * Add Audio Storage Columns to dictated_notes
 * Supports TTS audio generation and patient deletion tracking
 * Created: 2026-01-26
 */

-- Add audio_url column for storing generated TTS audio file URLs
ALTER TABLE dictated_notes
ADD COLUMN IF NOT EXISTS audio_url TEXT;

-- Add audio_deleted flag for tracking patient-initiated deletions
ALTER TABLE dictated_notes
ADD COLUMN IF NOT EXISTS audio_deleted BOOLEAN DEFAULT FALSE;

-- Add audio_deleted_at timestamp
ALTER TABLE dictated_notes
ADD COLUMN IF NOT EXISTS audio_deleted_at TIMESTAMP WITH TIME ZONE;

-- Add audio_generated_at timestamp to track when TTS was created
ALTER TABLE dictated_notes
ADD COLUMN IF NOT EXISTS audio_generated_at TIMESTAMP WITH TIME ZONE;

-- Add index for efficient queries by patient phone
CREATE INDEX IF NOT EXISTS idx_dictated_notes_patient_phone
ON dictated_notes(patient_phone);

-- Add index for efficient queries by unified_patient_id
CREATE INDEX IF NOT EXISTS idx_dictated_notes_unified_patient_id
ON dictated_notes(unified_patient_id);

-- Add comment for documentation
COMMENT ON COLUMN dictated_notes.audio_url IS 'URL to generated TTS audio file in Supabase Storage (patient-audio bucket)';
COMMENT ON COLUMN dictated_notes.audio_deleted IS 'Flag indicating patient has deleted the audio file (text remains visible)';
COMMENT ON COLUMN dictated_notes.audio_deleted_at IS 'Timestamp when patient deleted the audio file';
COMMENT ON COLUMN dictated_notes.audio_generated_at IS 'Timestamp when TTS audio was generated from processed_note text';
