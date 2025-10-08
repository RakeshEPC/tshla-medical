-- =====================================================
-- TSHLA MEDICAL - DATABASE MIGRATION SCRIPT
-- =====================================================
-- Run this in Supabase SQL Editor Dashboard
-- Purpose: Consolidate tables and optimize database
-- Safe to run: Uses IF EXISTS checks
-- =====================================================
-- BACKUP YOUR DATA FIRST! (Supabase Dashboard → Database → Backups)
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: Drop duplicate/legacy tables
-- =====================================================

SELECT 'Step 1: Dropping duplicate tables...' as status;

-- Drop old pump_users table (merge into patients)
DROP TABLE IF EXISTS pump_users CASCADE;

-- Drop old doctors table (using medical_staff instead)
DROP TABLE IF EXISTS doctors CASCADE;

-- Drop duplicate visit tables (consolidating into visits)
DROP TABLE IF EXISTS patient_charts CASCADE;
DROP TABLE IF EXISTS visit_notes CASCADE;
DROP TABLE IF EXISTS previsit_data CASCADE;
DROP TABLE IF EXISTS previsit_questionnaires CASCADE;

-- Drop duplicate service tables (consolidating into patient_service_requests)
DROP TABLE IF EXISTS refill_requests CASCADE;
DROP TABLE IF EXISTS lab_order_requests CASCADE;

-- Drop duplicate misc tables
DROP TABLE IF EXISTS sessions CASCADE; -- Using Supabase auth sessions
DROP TABLE IF EXISTS doctor_access CASCADE; -- Not needed yet
DROP TABLE IF EXISTS prior_authorizations CASCADE; -- Can add back if needed

-- Drop old unused tables
DROP TABLE IF EXISTS patient_conditions CASCADE;
DROP TABLE IF EXISTS patient_medications CASCADE;
DROP TABLE IF EXISTS patient_labs CASCADE;
DROP TABLE IF EXISTS patient_visits CASCADE;
DROP TABLE IF EXISTS schedule_slots CASCADE;
DROP TABLE IF EXISTS disease_progression CASCADE;
DROP TABLE IF EXISTS emr_imports CASCADE;
DROP TABLE IF EXISTS dictations CASCADE;
DROP TABLE IF EXISTS charts CASCADE;
DROP TABLE IF EXISTS notes CASCADE;
DROP TABLE IF EXISTS action_items CASCADE;
DROP TABLE IF EXISTS common_medications CASCADE;
DROP TABLE IF EXISTS common_lab_tests CASCADE;
DROP TABLE IF EXISTS mental_health_scores CASCADE;
DROP TABLE IF EXISTS encryption_keys CASCADE;

SELECT '✓ Duplicate tables dropped' as status;

-- =====================================================
-- STEP 2: Update pump_assessments to use patient_id
-- =====================================================

SELECT 'Step 2: Updating pump_assessments...' as status;

-- Remove old user_id column if it exists
ALTER TABLE pump_assessments DROP COLUMN IF EXISTS user_id CASCADE;

-- Add patient_id if not exists
ALTER TABLE pump_assessments
  ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES patients(id) ON DELETE CASCADE;

SELECT '✓ pump_assessments updated to use patient_id' as status;

-- =====================================================
-- STEP 3: Add PumpDrive fields to patients table
-- =====================================================

SELECT 'Step 3: Adding PumpDrive fields to patients...' as status;

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS pumpdrive_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS pumpdrive_signup_date TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS pumpdrive_last_assessment TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assessments_completed INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(50) DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMPTZ;

-- Add insurance fields if missing
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS insurance_provider VARCHAR(100),
  ADD COLUMN IF NOT EXISTS insurance_id VARCHAR(100);

-- Add address if missing
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS address TEXT;

COMMENT ON COLUMN patients.pumpdrive_enabled IS 'Whether patient has access to PumpDrive assessments';
COMMENT ON COLUMN patients.assessments_completed IS 'Total pump assessments completed';

SELECT '✓ PumpDrive fields added to patients' as status;

-- =====================================================
-- STEP 4: Create/update visits table (unified)
-- =====================================================

SELECT 'Step 4: Creating unified visits table...' as status;

CREATE TABLE IF NOT EXISTS visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES medical_staff(id),

  -- Visit info
  visit_date DATE NOT NULL,
  visit_type VARCHAR(50),
  chief_complaint TEXT,

  -- Pre-visit data (from patient portal)
  previsit_data JSONB,
  previsit_questionnaires JSONB,
  previsit_completed BOOLEAN DEFAULT false,

  -- Visit documentation
  raw_dictation TEXT,
  processed_soap JSONB,
  final_note TEXT,

  -- Clinical data
  diagnosis JSONB,
  medications JSONB,
  vitals JSONB,
  lab_results JSONB,

  -- Templates
  template_used UUID,

  -- Status tracking
  status VARCHAR(20) DEFAULT 'draft',
  signed_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(patient_id, visit_date, doctor_id)
);

SELECT '✓ Visits table created' as status;

-- =====================================================
-- STEP 5: Create patient_service_requests table
-- =====================================================

SELECT 'Step 5: Creating unified service requests table...' as status;

CREATE TABLE IF NOT EXISTS patient_service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES medical_staff(id),

  request_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  urgent BOOLEAN DEFAULT false,
  notes TEXT,

  request_data JSONB NOT NULL,

  processed_by UUID REFERENCES medical_staff(id),
  processed_at TIMESTAMPTZ,
  denial_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

SELECT '✓ Service requests table created' as status;

-- =====================================================
-- STEP 6: Create appointments table if not exists
-- =====================================================

SELECT 'Step 6: Creating appointments table...' as status;

CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES medical_staff(id),

  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  appointment_type VARCHAR(50),
  status VARCHAR(50) DEFAULT 'scheduled',

  notes TEXT,
  reminder_sent BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

SELECT '✓ Appointments table created' as status;

-- =====================================================
-- STEP 7: Update/create indexes
-- =====================================================

SELECT 'Step 7: Creating performance indexes...' as status;

-- Patients indexes
CREATE INDEX IF NOT EXISTS idx_patients_auth_user ON patients(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_patients_email ON patients(email);
CREATE INDEX IF NOT EXISTS idx_patients_pumpdrive ON patients(pumpdrive_enabled) WHERE pumpdrive_enabled = TRUE;

-- Visits indexes
CREATE INDEX IF NOT EXISTS idx_visits_patient ON visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_doctor ON visits(doctor_id);
CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_visits_patient_date ON visits(patient_id, visit_date DESC);

-- Pump assessments indexes
CREATE INDEX IF NOT EXISTS idx_pump_assessments_patient ON pump_assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_pump_assessments_created ON pump_assessments(created_at DESC);

-- Service requests indexes
CREATE INDEX IF NOT EXISTS idx_service_requests_patient ON patient_service_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON patient_service_requests(status);

-- Appointments indexes
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_start ON appointments(start_time);

SELECT '✓ Indexes created' as status;

-- =====================================================
-- STEP 8: Drop old RLS policies
-- =====================================================

SELECT 'Step 8: Updating RLS policies...' as status;

-- Drop old pump_users policies
DROP POLICY IF EXISTS "Pump users can view own profile" ON pump_users;
DROP POLICY IF EXISTS "Users can view own assessments" ON pump_assessments;
DROP POLICY IF EXISTS "Users can create own assessments" ON pump_assessments;

-- Drop old doctors policies
DROP POLICY IF EXISTS "Providers can view all patient data" ON patients;
DROP POLICY IF EXISTS "Providers can manage visit notes" ON visit_notes;

SELECT '✓ Old policies dropped' as status;

-- =====================================================
-- STEP 9: Create new RLS policies
-- =====================================================

SELECT 'Step 9: Creating new RLS policies...' as status;

-- Enable RLS
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE pump_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Patients policies
DROP POLICY IF EXISTS "Patients can view own profile" ON patients;
CREATE POLICY "Patients can view own profile"
  ON patients FOR SELECT
  USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Patients can update own profile" ON patients;
CREATE POLICY "Patients can update own profile"
  ON patients FOR UPDATE
  USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Staff can view all patients" ON patients;
CREATE POLICY "Staff can view all patients"
  ON patients FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM medical_staff
      WHERE auth_user_id = auth.uid() AND is_active = TRUE
    )
  );

-- Pump assessments policies
DROP POLICY IF EXISTS "Patients can view own pump assessments" ON pump_assessments;
CREATE POLICY "Patients can view own pump assessments"
  ON pump_assessments FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Patients can create own pump assessments" ON pump_assessments;
CREATE POLICY "Patients can create own pump assessments"
  ON pump_assessments FOR INSERT
  WITH CHECK (
    patient_id IN (
      SELECT id FROM patients WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Staff can view all assessments" ON pump_assessments;
CREATE POLICY "Staff can view all assessments"
  ON pump_assessments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM medical_staff
      WHERE auth_user_id = auth.uid() AND is_active = TRUE
    )
  );

-- Visits policies
DROP POLICY IF EXISTS "Patients can view own visits" ON visits;
CREATE POLICY "Patients can view own visits"
  ON visits FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Staff can manage all visits" ON visits;
CREATE POLICY "Staff can manage all visits"
  ON visits FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM medical_staff
      WHERE auth_user_id = auth.uid() AND is_active = TRUE
    )
  );

-- Service requests policies
DROP POLICY IF EXISTS "Patients can view own service requests" ON patient_service_requests;
CREATE POLICY "Patients can view own service requests"
  ON patient_service_requests FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Patients can create service requests" ON patient_service_requests;
CREATE POLICY "Patients can create service requests"
  ON patient_service_requests FOR INSERT
  WITH CHECK (
    patient_id IN (
      SELECT id FROM patients WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Staff can manage service requests" ON patient_service_requests;
CREATE POLICY "Staff can manage service requests"
  ON patient_service_requests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM medical_staff
      WHERE auth_user_id = auth.uid() AND is_active = TRUE
    )
  );

SELECT '✓ New RLS policies created' as status;

-- =====================================================
-- STEP 10: Create updated_at triggers
-- =====================================================

SELECT 'Step 10: Creating triggers...' as status;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_patients_updated_at ON patients;
CREATE TRIGGER update_patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_visits_updated_at ON visits;
CREATE TRIGGER update_visits_updated_at
  BEFORE UPDATE ON visits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_service_requests_updated_at ON patient_service_requests;
CREATE TRIGGER update_service_requests_updated_at
  BEFORE UPDATE ON patient_service_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_appointments_updated_at ON appointments;
CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

SELECT '✓ Triggers created' as status;

-- =====================================================
-- VERIFICATION
-- =====================================================

SELECT '========================================' as summary;
SELECT 'MIGRATION COMPLETE!' as summary;
SELECT '========================================' as summary;

SELECT
  'Remaining tables:' as info,
  COUNT(*) as count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

COMMIT;

-- =====================================================
-- INSTRUCTIONS
-- =====================================================
-- After running this script:
-- 1. Verify tables exist: SELECT * FROM patients LIMIT 1;
-- 2. Check pump_assessments: SELECT COUNT(*) FROM pump_assessments;
-- 3. Test patient login (they'll need to re-register)
-- 4. Test staff login
-- =====================================================
