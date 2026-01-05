-- Migration: Update Patient ID System to Random IDs
-- Date: 2026-01-05
-- Description: Changes patient ID formats from sequential year-based to random
--   - TSH ID: TSH-YYYY-NNNN -> TSH XXX-XXX (6-digit random)
--   - Patient ID: PT-YYYY-NNNN -> NNNNNNNN (8-digit random)

-- Step 1: Modify tshla_id column to support new format
ALTER TABLE unified_patients
ALTER COLUMN tshla_id TYPE VARCHAR(11); -- 'TSH XXX-XXX' = 11 characters

-- Step 2: Modify patient_id column to support new format
ALTER TABLE unified_patients
ALTER COLUMN patient_id TYPE VARCHAR(8); -- '12345678' = 8 characters

-- Step 3: Drop old validation trigger for tshla_id
DROP TRIGGER IF EXISTS validate_tshla_id_trigger ON unified_patients;
DROP FUNCTION IF EXISTS validate_tshla_id();

-- Step 4: Create new validation function for TSH ID format
CREATE OR REPLACE FUNCTION validate_tsh_id()
RETURNS TRIGGER AS $$
BEGIN
  -- TSH ID must be in format 'TSH XXX-XXX' where X is a digit
  IF NEW.tshla_id IS NOT NULL AND NEW.tshla_id !~ '^TSH [0-9]{3}-[0-9]{3}$' THEN
    RAISE EXCEPTION 'Invalid TSH ID format. Must be TSH XXX-XXX (e.g., TSH 123-456)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create trigger for TSH ID validation
CREATE TRIGGER validate_tsh_id_trigger
BEFORE INSERT OR UPDATE ON unified_patients
FOR EACH ROW
EXECUTE FUNCTION validate_tsh_id();

-- Step 6: Create new validation function for Patient ID format
CREATE OR REPLACE FUNCTION validate_patient_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Patient ID must be exactly 8 digits
  IF NEW.patient_id IS NOT NULL AND NEW.patient_id !~ '^[0-9]{8}$' THEN
    RAISE EXCEPTION 'Invalid Patient ID format. Must be 8 digits (e.g., 12345678)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create trigger for Patient ID validation
CREATE TRIGGER validate_patient_id_trigger
BEFORE INSERT OR UPDATE ON unified_patients
FOR EACH ROW
EXECUTE FUNCTION validate_patient_id();

-- Step 8: Add indexes for improved search performance
CREATE INDEX IF NOT EXISTS idx_unified_patients_tshla_id ON unified_patients(tshla_id);
CREATE INDEX IF NOT EXISTS idx_unified_patients_patient_id ON unified_patients(patient_id);
CREATE INDEX IF NOT EXISTS idx_unified_patients_mrn ON unified_patients(mrn);
CREATE INDEX IF NOT EXISTS idx_unified_patients_email ON unified_patients(email);
CREATE INDEX IF NOT EXISTS idx_unified_patients_dob ON unified_patients(date_of_birth);
CREATE INDEX IF NOT EXISTS idx_unified_patients_first_name ON unified_patients(first_name);
CREATE INDEX IF NOT EXISTS idx_unified_patients_last_name ON unified_patients(last_name);
CREATE INDEX IF NOT EXISTS idx_unified_patients_phone ON unified_patients(phone_primary);

-- Step 9: Add comments for documentation
COMMENT ON COLUMN unified_patients.tshla_id IS 'TSH ID format: TSH XXX-XXX (6-digit random). Can be reset by staff. Used for patient portal access.';
COMMENT ON COLUMN unified_patients.patient_id IS 'Patient ID format: NNNNNNNN (8-digit random). PERMANENT - never changes. Primary internal identifier.';
COMMENT ON COLUMN unified_patients.mrn IS 'Medical Record Number from external EMR systems (e.g., Athena). Can be changed by staff.';

-- Migration Notes:
-- 1. Existing patients will need to be migrated using a separate script
-- 2. The migration script will generate random IDs for all existing patients
-- 3. Old ID formats will be preserved in audit logs for reference
-- 4. This migration does NOT modify existing data - only schema
