-- Migration: Add TSHLA Patient ID Column
-- Date: 2025-01-04
-- Description: Adds tshla_id column to unified_patients table for internal patient identification
-- Format: TSH-YYYY-NNNN (e.g., TSH-2025-0001)

-- Add tshla_id column to unified_patients
ALTER TABLE unified_patients
ADD COLUMN IF NOT EXISTS tshla_id VARCHAR(13) UNIQUE;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_unified_patients_tshla_id
ON unified_patients(tshla_id);

-- Add comment for documentation
COMMENT ON COLUMN unified_patients.tshla_id IS 'TSHLA internal patient ID in format TSH-YYYY-NNNN. Auto-generated, unique identifier separate from legacy EMR MRN.';

-- Create a function to validate TSHLA ID format
CREATE OR REPLACE FUNCTION validate_tshla_id()
RETURNS TRIGGER AS $$
BEGIN
  -- If tshla_id is being set, validate format
  IF NEW.tshla_id IS NOT NULL AND NEW.tshla_id !~ '^TSH-\d{4}-\d{4}$' THEN
    RAISE EXCEPTION 'Invalid TSHLA ID format. Must be TSH-YYYY-NNNN (e.g., TSH-2025-0001)';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate TSHLA ID format on insert/update
DROP TRIGGER IF EXISTS check_tshla_id_format ON unified_patients;
CREATE TRIGGER check_tshla_id_format
  BEFORE INSERT OR UPDATE ON unified_patients
  FOR EACH ROW
  EXECUTE FUNCTION validate_tshla_id();

-- Migration verification query
-- Run this to check migration success:
-- SELECT COUNT(*) as total_patients,
--        COUNT(tshla_id) as patients_with_tshla_id,
--        COUNT(*) - COUNT(tshla_id) as patients_without_tshla_id
-- FROM unified_patients;
