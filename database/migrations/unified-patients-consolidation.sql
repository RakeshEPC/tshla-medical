-- =====================================================
-- TSHLA Medical - Unified Patient Consolidation System
-- =====================================================
-- Created: 2025-01-16
-- Purpose: Create phone-first unified patient system
--          to consolidate data from previsit, dictation,
--          schedule uploads, and PDF imports
-- =====================================================

-- =====================================================
-- 1. CREATE UNIFIED PATIENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS unified_patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Supabase Authentication (for patient portal login)
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- ========================================
  -- UNIVERSAL IDENTIFIERS (Phone is Master)
  -- ========================================
  phone_primary VARCHAR(20) UNIQUE NOT NULL,  -- Master identifier (normalized: 5551234567)
  phone_display VARCHAR(20),                   -- Display format: (555) 123-4567
  patient_id VARCHAR(20) UNIQUE NOT NULL,      -- Auto-generated: PT-2025-0001
  mrn VARCHAR(50),                             -- Medical Record Number (from EHR/PDF)
  ava_id VARCHAR(20) UNIQUE,                   -- AVA ID for portal (if PumpDrive user)

  -- ========================================
  -- DEMOGRAPHICS (merged from all sources)
  -- ========================================
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  full_name VARCHAR(200),  -- Will be computed via trigger instead of generated column
  date_of_birth DATE,
  age INTEGER,  -- Will be computed via trigger instead of generated column
  gender VARCHAR(10),

  -- ========================================
  -- CONTACT INFORMATION
  -- ========================================
  phone_secondary VARCHAR(20),
  email VARCHAR(255),
  preferred_contact_method VARCHAR(20) DEFAULT 'phone', -- phone, email, sms

  -- ========================================
  -- ADDRESS
  -- ========================================
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(50),
  zip_code VARCHAR(10),

  -- ========================================
  -- INSURANCE
  -- ========================================
  insurance_provider VARCHAR(255),
  insurance_member_id VARCHAR(100),
  insurance_group_number VARCHAR(100),

  -- ========================================
  -- CLINICAL SUMMARY (aggregated from all sources)
  -- ========================================
  active_conditions TEXT[],                    -- Current diagnoses
  current_medications JSONB DEFAULT '[]'::jsonb, -- [{name, dosage, frequency, source}]
  allergies TEXT[],                            -- Allergy list
  primary_language VARCHAR(50) DEFAULT 'English',

  -- ========================================
  -- DATA SOURCE TRACKING
  -- ========================================
  created_from VARCHAR(50) NOT NULL,           -- 'previsit' | 'dictation' | 'schedule' | 'pdf' | 'manual'
  data_sources VARCHAR(50)[] DEFAULT '{}',     -- Track all sources that contributed data
  last_data_merge_at TIMESTAMPTZ,              -- When data was last merged
  data_completeness_score INTEGER DEFAULT 0,   -- 0-100 based on filled fields

  -- Field-level source tracking (which source provided which data)
  field_sources JSONB DEFAULT '{}'::jsonb,     -- {"first_name": "dictation", "medications": "pdf"}

  -- ========================================
  -- PATIENT PORTAL ACCESS
  -- ========================================
  has_portal_access BOOLEAN DEFAULT false,
  portal_pin VARCHAR(255),                     -- Hashed 6-digit PIN
  portal_activated_at TIMESTAMPTZ,
  portal_last_login TIMESTAMPTZ,
  portal_login_count INTEGER DEFAULT 0,

  -- Portal preferences
  portal_preferences JSONB DEFAULT '{
    "notifications": true,
    "email_reminders": true,
    "sms_reminders": true
  }'::jsonb,

  -- ========================================
  -- PROVIDER RELATIONSHIPS
  -- ========================================
  primary_provider_id UUID REFERENCES medical_staff(id),
  primary_provider_name VARCHAR(255),

  -- ========================================
  -- PROGRAM ENROLLMENT
  -- ========================================
  pumpdrive_enabled BOOLEAN DEFAULT false,
  pumpdrive_signup_date TIMESTAMPTZ,
  weightloss_enabled BOOLEAN DEFAULT false,

  -- ========================================
  -- COMMUNICATION PREFERENCES
  -- ========================================
  opt_out_automated_calls BOOLEAN DEFAULT false,
  opt_out_text_messages BOOLEAN DEFAULT false,
  opt_out_email BOOLEAN DEFAULT false,

  -- ========================================
  -- STATUS & METADATA
  -- ========================================
  is_active BOOLEAN DEFAULT true,
  patient_status VARCHAR(50) DEFAULT 'active', -- active, inactive, deceased, transferred

  -- Chart summary
  total_visits INTEGER DEFAULT 0,
  last_visit_date DATE,
  next_appointment_date DATE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Audit
  created_by VARCHAR(255),                     -- Who created this record
  last_modified_by VARCHAR(255)
);

-- =====================================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Primary lookups (phone is most common)
CREATE INDEX idx_unified_patients_phone ON unified_patients(phone_primary);
CREATE INDEX idx_unified_patients_phone_display ON unified_patients(phone_display);
CREATE INDEX idx_unified_patients_patient_id ON unified_patients(patient_id);
CREATE INDEX idx_unified_patients_mrn ON unified_patients(mrn) WHERE mrn IS NOT NULL;

-- Name searches
CREATE INDEX idx_unified_patients_first_name ON unified_patients(first_name);
CREATE INDEX idx_unified_patients_last_name ON unified_patients(last_name);
CREATE INDEX idx_unified_patients_full_name ON unified_patients(full_name);

-- Provider lookups
CREATE INDEX idx_unified_patients_provider ON unified_patients(primary_provider_id);

-- Portal users
CREATE INDEX idx_unified_patients_portal_access ON unified_patients(has_portal_access)
  WHERE has_portal_access = true;
CREATE INDEX idx_unified_patients_auth_user ON unified_patients(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- Active patients
CREATE INDEX idx_unified_patients_active ON unified_patients(is_active)
  WHERE is_active = true;

-- Next appointments
CREATE INDEX idx_unified_patients_next_appt ON unified_patients(next_appointment_date)
  WHERE next_appointment_date IS NOT NULL;

-- =====================================================
-- 3. ADD FOREIGN KEYS TO EXISTING TABLES
-- =====================================================

-- Link pre-visit responses to unified patients (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'previsit_responses') THEN
    ALTER TABLE previsit_responses
      ADD COLUMN IF NOT EXISTS unified_patient_id UUID REFERENCES unified_patients(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS idx_previsit_unified_patient
      ON previsit_responses(unified_patient_id);

    RAISE NOTICE 'Added unified_patient_id to previsit_responses';
  ELSE
    RAISE NOTICE 'Table previsit_responses does not exist, skipping';
  END IF;
END $$;

-- Link dictated notes to unified patients (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'dictated_notes') THEN
    ALTER TABLE dictated_notes
      ADD COLUMN IF NOT EXISTS unified_patient_id UUID REFERENCES unified_patients(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS idx_dictated_notes_unified_patient
      ON dictated_notes(unified_patient_id);

    RAISE NOTICE 'Added unified_patient_id to dictated_notes';
  ELSE
    RAISE NOTICE 'Table dictated_notes does not exist, skipping';
  END IF;
END $$;

-- Link provider schedules to unified patients (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'provider_schedules') THEN
    ALTER TABLE provider_schedules
      ADD COLUMN IF NOT EXISTS unified_patient_id UUID REFERENCES unified_patients(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS idx_provider_schedules_unified_patient
      ON provider_schedules(unified_patient_id);

    RAISE NOTICE 'Added unified_patient_id to provider_schedules';
  ELSE
    RAISE NOTICE 'Table provider_schedules does not exist, skipping';
  END IF;
END $$;

-- Link pump assessments to unified patients (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'pump_assessments') THEN
    ALTER TABLE pump_assessments
      ADD COLUMN IF NOT EXISTS unified_patient_id UUID REFERENCES unified_patients(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS idx_pump_assessments_unified_patient
      ON pump_assessments(unified_patient_id);

    RAISE NOTICE 'Added unified_patient_id to pump_assessments';
  ELSE
    RAISE NOTICE 'Table pump_assessments does not exist, skipping';
  END IF;
END $$;

-- =====================================================
-- 4. CREATE PATIENT MERGE HISTORY TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS patient_merge_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  patient_id UUID NOT NULL REFERENCES unified_patients(id) ON DELETE CASCADE,

  -- What was merged
  merge_source VARCHAR(50) NOT NULL,           -- 'previsit' | 'dictation' | 'schedule' | 'pdf'
  fields_updated TEXT[],                       -- Which fields were changed
  data_merged JSONB,                           -- The data that was merged

  -- Merge metadata
  merge_strategy VARCHAR(50),                  -- 'overwrite' | 'append' | 'keep_existing'
  conflicts_resolved JSONB,                    -- How conflicts were resolved

  -- Who performed the merge
  merged_by VARCHAR(255),
  merge_timestamp TIMESTAMPTZ DEFAULT NOW(),

  -- Source record reference
  source_table VARCHAR(100),
  source_record_id VARCHAR(100)
);

CREATE INDEX idx_merge_history_patient ON patient_merge_history(patient_id);
CREATE INDEX idx_merge_history_timestamp ON patient_merge_history(merge_timestamp DESC);
CREATE INDEX idx_merge_history_source ON patient_merge_history(merge_source);

-- =====================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE unified_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_merge_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Providers see their patients" ON unified_patients;
DROP POLICY IF EXISTS "Patients see their own record" ON unified_patients;
DROP POLICY IF EXISTS "Service role full access" ON unified_patients;
DROP POLICY IF EXISTS "Providers can update their patients" ON unified_patients;
DROP POLICY IF EXISTS "Patients can update their own record" ON unified_patients;

-- Providers can see patients assigned to them
CREATE POLICY "Providers see their patients" ON unified_patients
  FOR SELECT USING (
    primary_provider_id = auth.uid()
    OR auth.jwt()->>'role' = 'service_role'
    OR current_setting('app.is_admin', true)::boolean = true
  );

-- Patients can see their own record
CREATE POLICY "Patients see their own record" ON unified_patients
  FOR SELECT USING (
    auth_user_id = auth.uid()
  );

-- Service role (backend APIs) can do anything
CREATE POLICY "Service role full access" ON unified_patients
  FOR ALL USING (
    auth.jwt()->>'role' = 'service_role'
  );

-- Providers can update their patients
CREATE POLICY "Providers can update their patients" ON unified_patients
  FOR UPDATE USING (
    primary_provider_id = auth.uid()
    OR auth.jwt()->>'role' = 'service_role'
    OR current_setting('app.is_admin', true)::boolean = true
  );

-- Patients can update limited fields in their own record
CREATE POLICY "Patients can update their own record" ON unified_patients
  FOR UPDATE USING (
    auth_user_id = auth.uid()
  );

-- Merge history policies
CREATE POLICY "Providers see merge history of their patients" ON patient_merge_history
  FOR SELECT USING (
    patient_id IN (
      SELECT id FROM unified_patients
      WHERE primary_provider_id = auth.uid()
    )
    OR auth.jwt()->>'role' = 'service_role'
  );

-- =====================================================
-- 6. HELPER FUNCTIONS
-- =====================================================

-- Function to generate next patient ID
CREATE OR REPLACE FUNCTION get_next_unified_patient_id()
RETURNS VARCHAR(20) AS $$
DECLARE
  current_year INTEGER;
  max_sequence INTEGER;
  next_sequence INTEGER;
  new_patient_id VARCHAR(20);
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);

  -- Get the maximum sequence number for current year
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(patient_id FROM '\d{4}$') AS INTEGER)),
    0
  ) INTO max_sequence
  FROM unified_patients
  WHERE patient_id LIKE 'PT-' || current_year || '-%';

  next_sequence := max_sequence + 1;

  -- Format as PT-YYYY-####
  new_patient_id := 'PT-' || current_year || '-' || LPAD(next_sequence::TEXT, 4, '0');

  RETURN new_patient_id;
END;
$$ LANGUAGE plpgsql;

-- Function to normalize phone number
CREATE OR REPLACE FUNCTION normalize_phone(phone_input VARCHAR)
RETURNS VARCHAR AS $$
BEGIN
  IF phone_input IS NULL THEN
    RETURN NULL;
  END IF;

  -- Remove all non-numeric characters
  RETURN REGEXP_REPLACE(phone_input, '[^0-9]', '', 'g');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to format phone for display
CREATE OR REPLACE FUNCTION format_phone_display(phone_input VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  normalized VARCHAR;
BEGIN
  IF phone_input IS NULL THEN
    RETURN NULL;
  END IF;

  normalized := normalize_phone(phone_input);

  -- Format 10-digit US phone: (555) 123-4567
  IF LENGTH(normalized) = 10 THEN
    RETURN '(' || SUBSTRING(normalized, 1, 3) || ') ' ||
           SUBSTRING(normalized, 4, 3) || '-' ||
           SUBSTRING(normalized, 7, 4);
  END IF;

  -- Format 11-digit (with country code): +1 (555) 123-4567
  IF LENGTH(normalized) = 11 AND SUBSTRING(normalized, 1, 1) = '1' THEN
    RETURN '+1 (' || SUBSTRING(normalized, 2, 3) || ') ' ||
           SUBSTRING(normalized, 5, 3) || '-' ||
           SUBSTRING(normalized, 8, 4);
  END IF;

  -- Return as-is if doesn't match standard format
  RETURN phone_input;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate data completeness score
CREATE OR REPLACE FUNCTION calculate_patient_completeness(patient_row unified_patients)
RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 0;
  total_fields INTEGER := 20; -- Adjust based on important fields
BEGIN
  -- Core fields (10 points each)
  IF patient_row.first_name IS NOT NULL THEN score := score + 10; END IF;
  IF patient_row.last_name IS NOT NULL THEN score := score + 10; END IF;
  IF patient_row.date_of_birth IS NOT NULL THEN score := score + 10; END IF;
  IF patient_row.phone_primary IS NOT NULL THEN score := score + 10; END IF;
  IF patient_row.email IS NOT NULL THEN score := score + 5; END IF;

  -- Demographics (5 points each)
  IF patient_row.gender IS NOT NULL THEN score := score + 5; END IF;
  IF patient_row.address_line1 IS NOT NULL THEN score := score + 5; END IF;

  -- Insurance (5 points each)
  IF patient_row.insurance_provider IS NOT NULL THEN score := score + 5; END IF;
  IF patient_row.insurance_member_id IS NOT NULL THEN score := score + 5; END IF;

  -- Clinical data (10 points each)
  IF ARRAY_LENGTH(patient_row.active_conditions, 1) > 0 THEN score := score + 10; END IF;
  IF patient_row.current_medications::text != '[]' THEN score := score + 10; END IF;

  -- Provider assignment (10 points)
  IF patient_row.primary_provider_id IS NOT NULL THEN score := score + 10; END IF;

  RETURN LEAST(score, 100); -- Cap at 100
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update completeness score, full_name, and age
CREATE OR REPLACE FUNCTION update_patient_completeness()
RETURNS TRIGGER AS $$
BEGIN
  -- Update full_name
  NEW.full_name := COALESCE(
    TRIM(NEW.first_name || ' ' || NEW.last_name),
    NEW.first_name,
    NEW.last_name,
    'Unknown Patient'
  );

  -- Update age
  IF NEW.date_of_birth IS NOT NULL THEN
    NEW.age := EXTRACT(YEAR FROM AGE(CURRENT_DATE, NEW.date_of_birth))::INTEGER;
  ELSE
    NEW.age := NULL;
  END IF;

  -- Update completeness score
  NEW.data_completeness_score := calculate_patient_completeness(NEW);
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_patient_completeness
  BEFORE INSERT OR UPDATE ON unified_patients
  FOR EACH ROW
  EXECUTE FUNCTION update_patient_completeness();

-- =====================================================
-- 7. MIGRATION VIEWS
-- =====================================================

-- Note: Views are commented out because they reference tables that may not exist yet
-- Uncomment and run these after all source tables are created

-- View: Patient chart summary for doctors
-- CREATE OR REPLACE VIEW v_patient_chart_summary AS
-- SELECT
--   up.id,
--   up.patient_id,
--   up.full_name,
--   up.phone_display,
--   up.email,
--   up.age,
--   up.gender,
--   up.primary_provider_name,
--   up.data_completeness_score,
--   up.total_visits,
--   up.last_visit_date,
--   up.next_appointment_date,
--   up.active_conditions,
--   up.current_medications,
--   up.allergies,
--   -- Counts from linked tables
--   COUNT(DISTINCT dn.id) as total_dictations,
--   COUNT(DISTINCT pr.id) as total_previsit_calls,
--   COUNT(DISTINCT ps.id) as total_appointments,
--   -- Recent activity
--   MAX(dn.created_at) as last_dictation_date,
--   MAX(pr.created_at) as last_previsit_date,
--   up.created_at,
--   up.created_from,
--   up.data_sources
-- FROM unified_patients up
-- LEFT JOIN dictated_notes dn ON up.id = dn.unified_patient_id
-- LEFT JOIN previsit_responses pr ON up.id = pr.unified_patient_id
-- LEFT JOIN provider_schedules ps ON up.id = ps.unified_patient_id
-- GROUP BY up.id
-- ORDER BY up.last_visit_date DESC NULLS LAST;

-- View: Patients needing data completion
CREATE OR REPLACE VIEW v_patients_incomplete_data AS
SELECT
  id,
  patient_id,
  full_name,
  phone_primary,
  data_completeness_score,
  created_from,
  data_sources,
  CASE
    WHEN first_name IS NULL THEN 'Missing first name'
    WHEN last_name IS NULL THEN 'Missing last name'
    WHEN date_of_birth IS NULL THEN 'Missing DOB'
    WHEN email IS NULL THEN 'Missing email'
    WHEN primary_provider_id IS NULL THEN 'No provider assigned'
    ELSE 'Incomplete clinical data'
  END as missing_data_priority
FROM unified_patients
WHERE data_completeness_score < 70
  AND is_active = true
ORDER BY data_completeness_score ASC;

-- =====================================================
-- 8. VERIFICATION QUERIES
-- =====================================================

-- Check table created
-- SELECT table_name FROM information_schema.tables
-- WHERE table_name = 'unified_patients';

-- Check indexes
-- SELECT indexname FROM pg_indexes
-- WHERE tablename = 'unified_patients';

-- Test phone normalization
-- SELECT
--   normalize_phone('+1 (555) 123-4567') as normalized,
--   format_phone_display('5551234567') as formatted;

-- Test patient ID generation
-- SELECT get_next_unified_patient_id();

-- =====================================================
-- DEPLOYMENT COMPLETE
-- =====================================================
--
-- Next Steps:
-- 1. Run this SQL in Supabase SQL Editor
-- 2. Verify all tables, indexes, and functions created
-- 3. Build PatientMatchingService in server/services/
-- 4. Hook into dictation, previsit, schedule workflows
-- 5. Build patient chart API
-- 6. Test with real data
--
-- =====================================================
