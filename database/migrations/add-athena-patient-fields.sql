-- =====================================================
-- Add Missing Patient Fields for Athena Import
-- =====================================================
-- Created: 2026-01-05
-- Purpose: Add fields needed for Athena Health patient data import
--
-- New Fields:
-- - middle_initial (Patient Middle Initial)
-- - drivers_license (Patient Driver License Number)
-- - employer (Patient Employer)
-- - ethnicity (Patient Ethnicity)
-- - race (Patient Race)
--
-- Note: phone_secondary already exists and will be used for work phone
-- =====================================================

-- Add missing demographic fields
ALTER TABLE unified_patients
ADD COLUMN IF NOT EXISTS middle_initial VARCHAR(5),
ADD COLUMN IF NOT EXISTS drivers_license VARCHAR(50),
ADD COLUMN IF NOT EXISTS employer VARCHAR(255),
ADD COLUMN IF NOT EXISTS ethnicity VARCHAR(50),
ADD COLUMN IF NOT EXISTS race VARCHAR(50);

-- Add indexes for searchable fields
CREATE INDEX IF NOT EXISTS idx_unified_patients_mrn_athena
  ON unified_patients(mrn)
  WHERE mrn IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_unified_patients_employer
  ON unified_patients(employer)
  WHERE employer IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN unified_patients.middle_initial IS 'Patient middle initial from Athena import';
COMMENT ON COLUMN unified_patients.drivers_license IS 'Patient driver license number from Athena import';
COMMENT ON COLUMN unified_patients.employer IS 'Patient employer from Athena import';
COMMENT ON COLUMN unified_patients.ethnicity IS 'Patient ethnicity (e.g., Hispanic/Latino, Not Hispanic/Latino)';
COMMENT ON COLUMN unified_patients.race IS 'Patient race (e.g., White, Black/African American, Asian, etc.)';
COMMENT ON COLUMN unified_patients.phone_secondary IS 'Secondary phone number (can be used for work phone)';
COMMENT ON COLUMN unified_patients.mrn IS 'Medical Record Number from external EMR (Athena Patient ID)';

-- Update the data completeness calculation to include new fields
CREATE OR REPLACE FUNCTION calculate_patient_completeness(patient_row unified_patients)
RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 0;
  total_fields INTEGER := 25; -- Increased from 20 to account for new fields
BEGIN
  -- Core fields (10 points each) - 40 points total
  IF patient_row.first_name IS NOT NULL THEN score := score + 10; END IF;
  IF patient_row.last_name IS NOT NULL THEN score := score + 10; END IF;
  IF patient_row.date_of_birth IS NOT NULL THEN score := score + 10; END IF;
  IF patient_row.phone_primary IS NOT NULL THEN score := score + 10; END IF;

  -- Important demographics (5 points each) - 30 points total
  IF patient_row.email IS NOT NULL THEN score := score + 5; END IF;
  IF patient_row.gender IS NOT NULL THEN score := score + 5; END IF;
  IF patient_row.address_line1 IS NOT NULL THEN score := score + 5; END IF;
  IF patient_row.city IS NOT NULL THEN score := score + 5; END IF;
  IF patient_row.state IS NOT NULL THEN score := score + 5; END IF;
  IF patient_row.zip_code IS NOT NULL THEN score := score + 5; END IF;

  -- Insurance (5 points each) - 10 points total
  IF patient_row.insurance_provider IS NOT NULL THEN score := score + 5; END IF;
  IF patient_row.insurance_member_id IS NOT NULL THEN score := score + 5; END IF;

  -- Clinical data (10 points each) - 20 points total
  IF ARRAY_LENGTH(patient_row.active_conditions, 1) > 0 THEN score := score + 10; END IF;
  IF patient_row.current_medications::text != '[]' THEN score := score + 10; END IF;

  -- Provider assignment (10 points)
  IF patient_row.primary_provider_id IS NOT NULL THEN score := score + 10; END IF;

  -- New Athena fields (2 points each) - Optional fields
  IF patient_row.middle_initial IS NOT NULL THEN score := score + 2; END IF;
  IF patient_row.drivers_license IS NOT NULL THEN score := score + 2; END IF;
  IF patient_row.employer IS NOT NULL THEN score := score + 2; END IF;
  IF patient_row.ethnicity IS NOT NULL THEN score := score + 2; END IF;
  IF patient_row.race IS NOT NULL THEN score := score + 2; END IF;
  IF patient_row.mrn IS NOT NULL THEN score := score + 2; END IF;

  RETURN LEAST(score, 100); -- Cap at 100
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Verification Queries
-- =====================================================

-- Check new columns exist
-- SELECT column_name, data_type, character_maximum_length
-- FROM information_schema.columns
-- WHERE table_name = 'unified_patients'
-- AND column_name IN ('middle_initial', 'drivers_license', 'employer', 'ethnicity', 'race')
-- ORDER BY column_name;

-- Check indexes
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'unified_patients'
-- AND indexname LIKE '%athena%' OR indexname LIKE '%employer%';

-- =====================================================
-- Migration Complete
-- =====================================================
-- Next steps:
-- 1. Run this migration in Supabase SQL Editor
-- 2. Create Athena patient import script
-- 3. Test with sample Athena data
-- =====================================================
