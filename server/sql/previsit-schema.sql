-- =====================================================
-- PRE-VISIT READINESS SYSTEM - SUPABASE SCHEMA
-- =====================================================
-- Created: January 2025
-- Purpose: Database schema for automated pre-visit patient calls
--
-- DEPLOYMENT INSTRUCTIONS:
-- 1. Open Supabase SQL Editor
-- 2. Copy/paste this entire file
-- 3. Execute the SQL
-- 4. Verify tables created in Table Editor
-- =====================================================

-- =====================================================
-- PATIENTS TABLE (Core)
-- =====================================================
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  patient_id VARCHAR(50) UNIQUE NOT NULL, -- P-2025-0001 format
  mrn VARCHAR(50) UNIQUE, -- External MRN if available from EHR

  -- Demographics
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  full_name VARCHAR(200) GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
  date_of_birth DATE NOT NULL,
  age INTEGER GENERATED ALWAYS AS (
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth))
  ) STORED,
  gender VARCHAR(50),

  -- Contact
  phone_primary VARCHAR(20) NOT NULL,
  phone_secondary VARCHAR(20),
  email VARCHAR(255),
  preferred_contact_method VARCHAR(20) DEFAULT 'phone', -- phone, email, text

  -- Address
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(50),
  zip_code VARCHAR(10),

  -- Insurance
  insurance_provider VARCHAR(255),
  insurance_member_id VARCHAR(100),
  insurance_group_number VARCHAR(100),

  -- Clinical
  primary_language VARCHAR(50) DEFAULT 'English',
  preferred_pharmacy VARCHAR(255),

  -- Relationships (will link to medical_staff table if it exists)
  provider_id UUID,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_visit_date DATE,
  next_appointment_date DATE,
  total_visits INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  patient_status VARCHAR(50) DEFAULT 'active', -- active, inactive, deceased, transferred

  -- Preferences for automated communications
  opt_out_automated_calls BOOLEAN DEFAULT FALSE,
  opt_out_text_messages BOOLEAN DEFAULT FALSE,
  opt_out_email BOOLEAN DEFAULT FALSE
);

-- =====================================================
-- PREVISIT RESPONSES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS previsit_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id UUID, -- References appointments table (may not exist yet)
  provider_id UUID NOT NULL,

  -- Call Metadata
  call_sid VARCHAR(100), -- Twilio Call SID
  elevenlabs_conversation_id VARCHAR(100), -- 11Labs Conversation ID
  call_initiated_at TIMESTAMPTZ,
  call_answered_at TIMESTAMPTZ,
  call_completed_at TIMESTAMPTZ,
  call_duration_seconds INTEGER,
  call_status VARCHAR(50) NOT NULL, -- completed, no-answer, failed, patient-declined, voicemail
  call_attempt_number INTEGER DEFAULT 1, -- 1st, 2nd, or 3rd attempt

  -- Structured Data (JSON for flexibility)
  current_medications JSONB DEFAULT '[]',
    -- [{name: string, dosage: string, frequency: string, side_effects: string}]

  refills_needed JSONB DEFAULT '[]',
    -- [{medication: string, supply_remaining: string}]

  labs_completed BOOLEAN,
  labs_details TEXT, -- "Quest Diagnostics, January 15, 2025"
  labs_needed BOOLEAN,

  specialist_visits JSONB DEFAULT '[]',
    -- [{specialist: string, reason: string, date: string}]

  chief_concerns JSONB DEFAULT '[]',
    -- [{concern: string, urgency_1_10: integer, details: string}]

  new_symptoms TEXT,

  patient_needs JSONB DEFAULT '{}',
    -- {prescriptions: string[], referrals: string[], forms: string[], advice: boolean}

  patient_questions TEXT[], -- Array of questions

  -- Raw Data
  full_transcript TEXT, -- Full conversation text
  audio_recording_url TEXT, -- S3/Azure Blob URL

  -- AI Analysis
  ai_summary TEXT, -- 2-3 sentence provider-ready summary
  clinical_notes TEXT, -- Formatted clinical notes
  risk_flags TEXT[] DEFAULT '{}', -- ['new-chest-pain', 'medication-confusion', 'urgent-symptoms']
  requires_urgent_callback BOOLEAN DEFAULT FALSE,
  urgency_level VARCHAR(20) DEFAULT 'routine', -- routine, moderate, high, urgent

  -- Patient Confirmation
  appointment_confirmed BOOLEAN,
  patient_will_attend BOOLEAN,

  -- Provider Review
  reviewed_by_provider BOOLEAN DEFAULT FALSE,
  reviewed_at TIMESTAMPTZ,
  provider_notes TEXT, -- Provider can add notes after reviewing

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PREVISIT CALL LOG (Tracking attempts)
-- =====================================================
CREATE TABLE IF NOT EXISTS previsit_call_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id UUID, -- May reference appointments table

  attempt_number INTEGER NOT NULL, -- 1, 2, or 3
  call_time TIMESTAMPTZ DEFAULT NOW(),
  call_status VARCHAR(50) NOT NULL,
    -- answered, no-answer, busy, voicemail-detected, failed, patient-declined

  twilio_call_sid VARCHAR(100),
  call_duration_seconds INTEGER,

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PREVISIT NOTIFICATION LOG (Klara texts)
-- =====================================================
CREATE TABLE IF NOT EXISTS previsit_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id UUID,

  notification_type VARCHAR(50) NOT NULL, -- klara-text, email, push
  notification_status VARCHAR(50) NOT NULL, -- sent, delivered, failed, read

  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,

  message_content TEXT,
  klara_message_id VARCHAR(100),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES for Performance
-- =====================================================

-- Patients
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone_primary);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(full_name);
CREATE INDEX IF NOT EXISTS idx_patients_dob ON patients(date_of_birth);
CREATE INDEX IF NOT EXISTS idx_patients_provider ON patients(provider_id);
CREATE INDEX IF NOT EXISTS idx_patients_next_appt ON patients(next_appointment_date);
CREATE INDEX IF NOT EXISTS idx_patients_patient_id ON patients(patient_id);
CREATE INDEX IF NOT EXISTS idx_patients_mrn ON patients(mrn);

-- Pre-visit Responses
CREATE INDEX IF NOT EXISTS idx_previsit_patient ON previsit_responses(patient_id);
CREATE INDEX IF NOT EXISTS idx_previsit_appointment ON previsit_responses(appointment_id);
CREATE INDEX IF NOT EXISTS idx_previsit_provider ON previsit_responses(provider_id);
CREATE INDEX IF NOT EXISTS idx_previsit_status ON previsit_responses(call_status);
CREATE INDEX IF NOT EXISTS idx_previsit_urgent ON previsit_responses(requires_urgent_callback) WHERE requires_urgent_callback = TRUE;
CREATE INDEX IF NOT EXISTS idx_previsit_created ON previsit_responses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_previsit_urgency ON previsit_responses(urgency_level);

-- Call Log
CREATE INDEX IF NOT EXISTS idx_call_log_patient ON previsit_call_log(patient_id);
CREATE INDEX IF NOT EXISTS idx_call_log_appointment ON previsit_call_log(appointment_id);
CREATE INDEX IF NOT EXISTS idx_call_log_time ON previsit_call_log(call_time DESC);
CREATE INDEX IF NOT EXISTS idx_call_log_status ON previsit_call_log(call_status);

-- Notification Log
CREATE INDEX IF NOT EXISTS idx_notification_patient ON previsit_notification_log(patient_id);
CREATE INDEX IF NOT EXISTS idx_notification_status ON previsit_notification_log(notification_status);
CREATE INDEX IF NOT EXISTS idx_notification_sent ON previsit_notification_log(sent_at DESC);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE previsit_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE previsit_call_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE previsit_notification_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running script)
DROP POLICY IF EXISTS "Providers see their patients" ON patients;
DROP POLICY IF EXISTS "Providers update their patients" ON patients;
DROP POLICY IF EXISTS "Providers insert their patients" ON patients;
DROP POLICY IF EXISTS "Service role full access to patients" ON patients;

DROP POLICY IF EXISTS "Providers see their pre-visit responses" ON previsit_responses;
DROP POLICY IF EXISTS "Providers update their pre-visit responses" ON previsit_responses;
DROP POLICY IF EXISTS "System inserts pre-visit responses" ON previsit_responses;
DROP POLICY IF EXISTS "Service role full access to previsit_responses" ON previsit_responses;

DROP POLICY IF EXISTS "Providers see their call logs" ON previsit_call_log;
DROP POLICY IF EXISTS "Service role full access to call logs" ON previsit_call_log;

DROP POLICY IF EXISTS "Providers see their notifications" ON previsit_notification_log;
DROP POLICY IF EXISTS "Service role full access to notifications" ON previsit_notification_log;

-- PATIENTS POLICIES
-- Providers can only see their own patients (if medical_staff table exists and has auth_user_id)
-- For now, we'll create a simple policy - you may need to adjust based on your auth setup
CREATE POLICY "Providers see their patients"
  ON patients FOR SELECT
  USING (TRUE); -- Adjust to: provider_id = auth.uid() or similar based on your auth

CREATE POLICY "Providers update their patients"
  ON patients FOR UPDATE
  USING (TRUE); -- Adjust based on your auth

CREATE POLICY "Providers insert their patients"
  ON patients FOR INSERT
  WITH CHECK (TRUE); -- Adjust based on your auth

-- Service role (backend) can do anything
CREATE POLICY "Service role full access to patients"
  ON patients FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- PREVISIT RESPONSES POLICIES
CREATE POLICY "Providers see their pre-visit responses"
  ON previsit_responses FOR SELECT
  USING (TRUE); -- Adjust to match provider_id to auth.uid()

CREATE POLICY "Providers update their pre-visit responses"
  ON previsit_responses FOR UPDATE
  USING (TRUE); -- Adjust based on your auth

-- System (service role) can insert pre-visit responses
CREATE POLICY "System inserts pre-visit responses"
  ON previsit_responses FOR INSERT
  WITH CHECK (TRUE); -- Service role will handle this

CREATE POLICY "Service role full access to previsit_responses"
  ON previsit_responses FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- CALL LOG POLICIES
CREATE POLICY "Providers see their call logs"
  ON previsit_call_log FOR SELECT
  USING (TRUE); -- Adjust based on your auth

CREATE POLICY "Service role full access to call logs"
  ON previsit_call_log FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- NOTIFICATION LOG POLICIES
CREATE POLICY "Providers see their notifications"
  ON previsit_notification_log FOR SELECT
  USING (TRUE); -- Adjust based on your auth

CREATE POLICY "Service role full access to notifications"
  ON previsit_notification_log FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update patients.updated_at automatically
CREATE OR REPLACE FUNCTION update_previsit_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS patients_updated_at ON patients;
CREATE TRIGGER patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW
  EXECUTE FUNCTION update_previsit_updated_at();

DROP TRIGGER IF EXISTS previsit_responses_updated_at ON previsit_responses;
CREATE TRIGGER previsit_responses_updated_at
  BEFORE UPDATE ON previsit_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_previsit_updated_at();

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Get today's appointments needing pre-visit calls
CREATE OR REPLACE FUNCTION get_appointments_needing_previsit_calls(
  target_date DATE DEFAULT CURRENT_DATE + INTERVAL '1 day'
)
RETURNS TABLE (
  appointment_id UUID,
  patient_id UUID,
  patient_name TEXT,
  patient_phone TEXT,
  patient_dob DATE,
  appointment_time TIME,
  provider_id UUID,
  already_called BOOLEAN,
  call_attempts INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    NULL::UUID as appointment_id, -- Placeholder until appointments table exists
    p.id as patient_id,
    p.full_name as patient_name,
    p.phone_primary as patient_phone,
    p.date_of_birth as patient_dob,
    '09:00:00'::TIME as appointment_time, -- Placeholder
    p.provider_id,
    EXISTS(
      SELECT 1 FROM previsit_responses pr
      WHERE pr.patient_id = p.id
      AND pr.call_status = 'completed'
      AND pr.created_at::DATE = target_date
    ) as already_called,
    COALESCE((
      SELECT MAX(attempt_number) FROM previsit_call_log pcl
      WHERE pcl.patient_id = p.id
      AND pcl.call_time::DATE >= CURRENT_DATE - INTERVAL '3 days'
    ), 0) as call_attempts
  FROM patients p
  WHERE p.next_appointment_date = target_date
    AND p.opt_out_automated_calls = FALSE
    AND p.phone_primary IS NOT NULL
    AND p.is_active = TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to get next patient ID in sequence
CREATE OR REPLACE FUNCTION get_next_patient_id()
RETURNS VARCHAR(50) AS $$
DECLARE
  current_year INTEGER;
  max_sequence INTEGER;
  next_sequence INTEGER;
  new_patient_id VARCHAR(50);
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);

  -- Get the maximum sequence number for current year
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(patient_id FROM '\d{4}$') AS INTEGER)),
    0
  ) INTO max_sequence
  FROM patients
  WHERE patient_id LIKE 'P-' || current_year || '-%';

  next_sequence := max_sequence + 1;

  -- Format as P-YYYY-####
  new_patient_id := 'P-' || current_year || '-' || LPAD(next_sequence::TEXT, 4, '0');

  RETURN new_patient_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SAMPLE DATA (Optional - for testing)
-- =====================================================

-- Uncomment below to insert test data

-- INSERT INTO patients (patient_id, first_name, last_name, date_of_birth, phone_primary, email, provider_id)
-- VALUES
--   (get_next_patient_id(), 'John', 'Smith', '1985-05-15', '+15555551234', 'john.smith@example.com', NULL),
--   (get_next_patient_id(), 'Jane', 'Doe', '1990-08-22', '+15555555678', 'jane.doe@example.com', NULL),
--   (get_next_patient_id(), 'Robert', 'Johnson', '1978-03-10', '+15555559999', 'robert.j@example.com', NULL);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Run these after deployment to verify setup

-- Check tables exist
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('patients', 'previsit_responses', 'previsit_call_log', 'previsit_notification_log');

-- Check indexes
-- SELECT indexname FROM pg_indexes WHERE tablename IN ('patients', 'previsit_responses', 'previsit_call_log', 'previsit_notification_log');

-- Check RLS enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename IN ('patients', 'previsit_responses', 'previsit_call_log', 'previsit_notification_log');

-- Test patient ID generation
-- SELECT get_next_patient_id();

-- =====================================================
-- DEPLOYMENT COMPLETE
-- =====================================================
--
-- Next Steps:
-- 1. Verify all tables created successfully
-- 2. Test inserting a patient record
-- 3. Test the get_next_patient_id() function
-- 4. Adjust RLS policies based on your authentication setup
-- 5. Proceed to building patient.service.ts
--
-- =====================================================
