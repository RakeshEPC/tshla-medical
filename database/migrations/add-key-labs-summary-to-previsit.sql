-- Add key_labs_summary column to previsit_data table
-- This stores a condensed one-line summary of key lab values for quick scanning

ALTER TABLE previsit_data
ADD COLUMN IF NOT EXISTS key_labs_summary TEXT;

COMMENT ON COLUMN previsit_data.key_labs_summary IS 'Condensed one-line summary of key lab values (e.g., "TSH 7.49↑ | A1C 5.5% | BP 140/78")';
