-- Safe Migration: Patient ID Redesign + Athena Fields
-- Handles existing views and dependencies
-- Date: 2026-01-05

-- Step 1: Drop dependent views temporarily
DROP VIEW IF EXISTS v_patients_incomplete_data CASCADE;

-- Step 2: Create or modify tshla_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'unified_patients' AND column_name = 'tshla_id'
  ) THEN
    ALTER TABLE unified_patients ADD COLUMN tshla_id VARCHAR(11);
  ELSE
    ALTER TABLE unified_patients ALTER COLUMN tshla_id TYPE VARCHAR(11);
  END IF;
END $$;

-- Step 3: Modify patient_id column to support 8-digit format
ALTER TABLE unified_patients
ALTER COLUMN patient_id TYPE VARCHAR(8);

-- Step 4: Drop old validation triggers if they exist
DROP TRIGGER IF EXISTS validate_tshla_id_trigger ON unified_patients;
DROP FUNCTION IF EXISTS validate_tshla_id();
DROP TRIGGER IF EXISTS validate_tsh_id_trigger ON unified_patients;
DROP FUNCTION IF EXISTS validate_tsh_id();
DROP TRIGGER IF EXISTS validate_patient_id_trigger ON unified_patients;
DROP FUNCTION IF EXISTS validate_patient_id();

-- Step 5: Create new validation function for TSH ID format
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

-- Step 6: Create trigger for TSH ID validation
CREATE TRIGGER validate_tsh_id_trigger
BEFORE INSERT OR UPDATE ON unified_patients
FOR EACH ROW
EXECUTE FUNCTION validate_tsh_id();

-- Step 7: Create new validation function for Patient ID format
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

-- Step 8: Create trigger for Patient ID validation
CREATE TRIGGER validate_patient_id_trigger
BEFORE INSERT OR UPDATE ON unified_patients
FOR EACH ROW
EXECUTE FUNCTION validate_patient_id();

-- Step 9: Add indexes for improved search performance
CREATE INDEX IF NOT EXISTS idx_unified_patients_tshla_id ON unified_patients(tshla_id);
CREATE INDEX IF NOT EXISTS idx_unified_patients_patient_id ON unified_patients(patient_id);
CREATE INDEX IF NOT EXISTS idx_unified_patients_mrn ON unified_patients(mrn);
CREATE INDEX IF NOT EXISTS idx_unified_patients_email ON unified_patients(email);
CREATE INDEX IF NOT EXISTS idx_unified_patients_dob ON unified_patients(date_of_birth);
CREATE INDEX IF NOT EXISTS idx_unified_patients_first_name ON unified_patients(first_name);
CREATE INDEX IF NOT EXISTS idx_unified_patients_last_name ON unified_patients(last_name);
CREATE INDEX IF NOT EXISTS idx_unified_patients_phone ON unified_patients(phone_primary);

-- Step 10: Recreate the v_patients_incomplete_data view with new schema
CREATE OR REPLACE VIEW v_patients_incomplete_data AS
SELECT
  id,
  patient_id,
  tshla_id,
  first_name,
  last_name,
  phone_primary,
  email,
  date_of_birth,
  CASE
    WHEN first_name IS NULL OR first_name = '' THEN 'Missing first name'
    WHEN last_name IS NULL OR last_name = '' THEN 'Missing last name'
    WHEN phone_primary IS NULL OR phone_primary = '' THEN 'Missing phone'
    WHEN email IS NULL OR email = '' THEN 'Missing email'
    WHEN date_of_birth IS NULL THEN 'Missing date of birth'
    ELSE 'Complete'
  END as data_status
FROM unified_patients
WHERE is_active = true
  AND (
    first_name IS NULL OR first_name = '' OR
    last_name IS NULL OR last_name = '' OR
    phone_primary IS NULL OR phone_primary = '' OR
    email IS NULL OR email = '' OR
    date_of_birth IS NULL
  );

-- Step 11: Add comments for documentation
COMMENT ON COLUMN unified_patients.tshla_id IS 'TSH ID format: TSH XXX-XXX (6-digit random). Can be reset by staff. Used for patient portal access.';
COMMENT ON COLUMN unified_patients.patient_id IS 'Patient ID format: NNNNNNNN (8-digit random). PERMANENT - never changes. Primary internal identifier.';
COMMENT ON COLUMN unified_patients.mrn IS 'Medical Record Number from external EMR systems (e.g., Athena). Can be changed by staff.';

-- Migration complete!
-- Next step: Run Athena patient import script
