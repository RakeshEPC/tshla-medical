-- =====================================================
-- Diabetes Education AI Phone System
-- Migration 006: Add diabetes education patient accounts and call logging
-- Created: 2025-12-03
-- Purpose: Enable phone-based AI diabetes education consultations
-- =====================================================

-- =====================================================
-- DIABETES EDUCATION PATIENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS diabetes_education_patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Patient identification
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE NOT NULL,

  -- Language preference for AI agent
  preferred_language VARCHAR(10) DEFAULT 'en' NOT NULL,
  -- Supported: 'en' (English), 'es' (Spanish), 'fr' (French), etc.

  -- Medical information
  medical_document_url TEXT, -- S3/Azure Blob URL of uploaded document
  medical_data JSONB, -- Extracted structured data
  -- JSONB Structure:
  -- {
  --   "medications": [
  --     {"name": "Metformin", "dose": "500mg", "frequency": "twice daily"},
  --     {"name": "Insulin glargine", "dose": "20 units", "frequency": "bedtime"}
  --   ],
  --   "labs": {
  --     "a1c": {"value": 7.2, "date": "2025-11-15", "unit": "%"},
  --     "glucose_fasting": {"value": 135, "date": "2025-11-20", "unit": "mg/dL"},
  --     "creatinine": {"value": 1.1, "date": "2025-10-10", "unit": "mg/dL"}
  --   },
  --   "diagnoses": [
  --     "Type 2 Diabetes Mellitus",
  --     "Diabetic Neuropathy"
  --   ],
  --   "allergies": ["Penicillin"],
  --   "notes": "Patient prefers evening insulin injection"
  -- }

  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by_staff_id UUID REFERENCES medical_staff(id),

  -- Status
  is_active BOOLEAN DEFAULT TRUE NOT NULL
);

COMMENT ON TABLE diabetes_education_patients IS 'Patients enrolled in phone-based AI diabetes education - authenticated by phone number only';
COMMENT ON COLUMN diabetes_education_patients.phone_number IS 'E.164 format phone number - primary authentication method';
COMMENT ON COLUMN diabetes_education_patients.preferred_language IS 'ISO 639-1 language code for selecting appropriate ElevenLabs agent';
COMMENT ON COLUMN diabetes_education_patients.medical_data IS 'Structured medical information extracted from uploaded documents - passed to AI as context';

-- =====================================================
-- DIABETES EDUCATION CALLS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS diabetes_education_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Call identification
  patient_id UUID NOT NULL REFERENCES diabetes_education_patients(id) ON DELETE CASCADE,
  twilio_call_sid VARCHAR(255) UNIQUE NOT NULL,
  elevenlabs_conversation_id VARCHAR(255),

  -- Call details
  language VARCHAR(10) NOT NULL, -- Language used for this call
  call_started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  call_ended_at TIMESTAMPTZ,
  duration_seconds INT,

  -- Call content
  transcript TEXT, -- Full conversation transcript
  summary TEXT, -- AI-generated summary of call
  topics_discussed JSONB, -- Structured topics: ["medication questions", "diet", "lab results"]

  -- Call metadata
  caller_phone_number VARCHAR(20), -- In case patient calls from different number
  call_status VARCHAR(50), -- 'completed', 'no-answer', 'failed', 'busy'
  disconnect_reason VARCHAR(100) -- 'timeout-10min', 'caller-hangup', 'system-error'
);

COMMENT ON TABLE diabetes_education_calls IS 'Log of all diabetes education phone consultations - for audit and quality improvement';
COMMENT ON COLUMN diabetes_education_calls.twilio_call_sid IS 'Twilio unique call identifier for tracking and debugging';
COMMENT ON COLUMN diabetes_education_calls.duration_seconds IS 'Call duration - max 600 seconds (10 minutes)';
COMMENT ON COLUMN diabetes_education_calls.transcript IS 'Full conversation transcript from ElevenLabs/Deepgram';
COMMENT ON COLUMN diabetes_education_calls.summary IS 'AI-generated summary of topics discussed and patient concerns';

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Index for phone number lookup (primary authentication method)
CREATE INDEX IF NOT EXISTS idx_diabetes_education_patients_phone
  ON diabetes_education_patients(phone_number)
  WHERE is_active = TRUE;

-- Index for active patients lookup
CREATE INDEX IF NOT EXISTS idx_diabetes_education_patients_active
  ON diabetes_education_patients(is_active, created_at DESC);

-- Index for language filtering
CREATE INDEX IF NOT EXISTS idx_diabetes_education_patients_language
  ON diabetes_education_patients(preferred_language)
  WHERE is_active = TRUE;

-- Index for call history lookup by patient
CREATE INDEX IF NOT EXISTS idx_diabetes_education_calls_patient
  ON diabetes_education_calls(patient_id, call_started_at DESC);

-- Index for Twilio call SID lookup
CREATE INDEX IF NOT EXISTS idx_diabetes_education_calls_twilio_sid
  ON diabetes_education_calls(twilio_call_sid);

-- Index for date-based call analytics
CREATE INDEX IF NOT EXISTS idx_diabetes_education_calls_date
  ON diabetes_education_calls(call_started_at DESC);

-- =====================================================
-- TRIGGERS FOR AUTO-UPDATE
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_diabetes_education_patients_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_diabetes_education_patients_updated_at
  BEFORE UPDATE ON diabetes_education_patients
  FOR EACH ROW
  EXECUTE FUNCTION update_diabetes_education_patients_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE diabetes_education_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE diabetes_education_calls ENABLE ROW LEVEL SECURITY;

-- Medical staff can view all diabetes education patients
CREATE POLICY "Medical staff can view all diabetes education patients"
  ON diabetes_education_patients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM medical_staff
      WHERE medical_staff.auth_user_id = auth.uid()
    )
  );

-- Medical staff can create diabetes education patients
CREATE POLICY "Medical staff can create diabetes education patients"
  ON diabetes_education_patients FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM medical_staff
      WHERE medical_staff.auth_user_id = auth.uid()
    )
  );

-- Medical staff can update diabetes education patients
CREATE POLICY "Medical staff can update diabetes education patients"
  ON diabetes_education_patients FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM medical_staff
      WHERE medical_staff.auth_user_id = auth.uid()
    )
  );

-- Medical staff can view all diabetes education calls
CREATE POLICY "Medical staff can view all diabetes education calls"
  ON diabetes_education_calls FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM medical_staff
      WHERE medical_staff.auth_user_id = auth.uid()
    )
  );

-- System can insert calls (during phone consultation)
CREATE POLICY "System can insert diabetes education calls"
  ON diabetes_education_calls FOR INSERT
  WITH CHECK (true); -- API will validate

-- System can update calls (when call ends)
CREATE POLICY "System can update diabetes education calls"
  ON diabetes_education_calls FOR UPDATE
  USING (true); -- API will validate

-- =====================================================
-- HELPER FUNCTIONS FOR ANALYTICS
-- =====================================================

-- Get call statistics for a patient
CREATE OR REPLACE FUNCTION get_patient_call_stats(patient_uuid UUID)
RETURNS TABLE (
  total_calls BIGINT,
  total_duration_minutes INT,
  avg_duration_minutes DECIMAL(5,2),
  most_recent_call TIMESTAMPTZ,
  topics_array JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT,
    (SUM(duration_seconds) / 60)::INT,
    (AVG(duration_seconds) / 60)::DECIMAL(5,2),
    MAX(call_started_at),
    jsonb_agg(DISTINCT topics_discussed) FILTER (WHERE topics_discussed IS NOT NULL)
  FROM diabetes_education_calls
  WHERE patient_id = patient_uuid;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_patient_call_stats(UUID) IS 'Get call statistics for a specific diabetes education patient';

-- Get daily call volume
CREATE OR REPLACE FUNCTION get_daily_call_volume(start_date DATE, end_date DATE)
RETURNS TABLE (
  call_date DATE,
  total_calls BIGINT,
  avg_duration_minutes DECIMAL(5,2),
  unique_patients BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(call_started_at) AS call_date,
    COUNT(*)::BIGINT AS total_calls,
    (AVG(duration_seconds) / 60)::DECIMAL(5,2) AS avg_duration_minutes,
    COUNT(DISTINCT patient_id)::BIGINT AS unique_patients
  FROM diabetes_education_calls
  WHERE DATE(call_started_at) BETWEEN start_date AND end_date
  GROUP BY DATE(call_started_at)
  ORDER BY call_date DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_daily_call_volume(DATE, DATE) IS 'Get daily call volume statistics for diabetes education calls';

-- =====================================================
-- SAMPLE DATA (OPTIONAL - FOR TESTING ONLY)
-- =====================================================

-- Uncomment below to insert test data
-- INSERT INTO diabetes_education_patients (
--   phone_number, first_name, last_name, date_of_birth, preferred_language,
--   medical_data, created_by_staff_id
-- ) VALUES (
--   '+15555551234', 'John', 'Doe', '1975-05-15', 'en',
--   '{"medications": [{"name": "Metformin", "dose": "500mg", "frequency": "twice daily"}], "labs": {"a1c": {"value": 7.5, "date": "2025-11-01", "unit": "%"}}, "diagnoses": ["Type 2 Diabetes Mellitus"]}'::jsonb,
--   (SELECT id FROM medical_staff LIMIT 1)
-- );

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 006 completed successfully: Diabetes Education system tables created';
  RAISE NOTICE '- diabetes_education_patients: Patient accounts with phone number authentication';
  RAISE NOTICE '- diabetes_education_calls: Call logging and transcripts';
  RAISE NOTICE '- RLS policies configured for medical staff access';
  RAISE NOTICE '- Helper functions created for analytics';
END $$;
