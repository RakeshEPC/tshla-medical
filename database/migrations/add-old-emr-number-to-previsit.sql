-- Add old EMR number to previsit_data for easy patient lookup
-- This helps staff quickly search for patients by their old EMR system ID

ALTER TABLE previsit_data
  ADD COLUMN IF NOT EXISTS old_emr_number VARCHAR(50);

-- Create index for fast lookup
CREATE INDEX IF NOT EXISTS idx_previsit_old_emr ON previsit_data(old_emr_number);

-- Add comment
COMMENT ON COLUMN previsit_data.old_emr_number IS 'Patient ID from old EMR system (Athena/previous system) for easy lookup';
