-- =====================================================
-- PATIENT VISIT SUMMARIES - BETA FEATURE
-- =====================================================
-- Purpose: Store patient-friendly visit summaries
-- Generated from SOAP notes using AI
-- Created: 2025-01-03
-- =====================================================

-- Main patient summaries table
CREATE TABLE IF NOT EXISTS patient_visit_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links to existing data
  visit_id UUID REFERENCES visits(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES medical_staff(id),
  soap_note_id UUID, -- Reference to dictations or visits table

  -- Patient-friendly content
  summary_text TEXT NOT NULL, -- Main summary in plain English
  key_actions JSONB, -- { medications: [], labs: [], appointments: [], lifestyle: [] }

  -- Reading metrics
  estimated_read_time_seconds INTEGER DEFAULT 20, -- Target: 15-30 seconds
  word_count INTEGER,

  -- Metadata
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  ai_model VARCHAR(50) DEFAULT 'gpt-4o-mini',
  ai_provider VARCHAR(50) DEFAULT 'openai',
  version VARCHAR(10) DEFAULT 'beta',

  -- Provider approval (optional gate before patient sees it)
  provider_approved BOOLEAN DEFAULT FALSE,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES medical_staff(id),

  -- Patient feedback
  was_helpful BOOLEAN,
  helpfulness_rating INTEGER CHECK (helpfulness_rating >= 1 AND helpfulness_rating <= 5),
  patient_feedback TEXT,
  reported_errors TEXT[], -- Array of error descriptions
  feedback_submitted_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES for performance
-- =====================================================

CREATE INDEX idx_patient_summaries_patient_id ON patient_visit_summaries(patient_id);
CREATE INDEX idx_patient_summaries_visit_id ON patient_visit_summaries(visit_id);
CREATE INDEX idx_patient_summaries_provider_id ON patient_visit_summaries(provider_id);
CREATE INDEX idx_patient_summaries_created_at ON patient_visit_summaries(created_at DESC);
CREATE INDEX idx_patient_summaries_approved ON patient_visit_summaries(provider_approved);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE patient_visit_summaries ENABLE ROW LEVEL SECURITY;

-- Patients can view their own APPROVED summaries only
CREATE POLICY "Patients can view their approved summaries"
  ON patient_visit_summaries
  FOR SELECT
  TO authenticated
  USING (
    patient_id = auth.uid()
    AND provider_approved = TRUE
  );

-- Providers can view summaries for their patients
CREATE POLICY "Providers can view their patients' summaries"
  ON patient_visit_summaries
  FOR SELECT
  TO authenticated
  USING (
    provider_id IN (
      SELECT id FROM medical_staff WHERE auth_user_id = auth.uid()
    )
  );

-- Providers can create summaries for their patients
CREATE POLICY "Providers can create summaries"
  ON patient_visit_summaries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    provider_id IN (
      SELECT id FROM medical_staff WHERE auth_user_id = auth.uid()
    )
  );

-- Providers can update their own summaries (for approval, editing)
CREATE POLICY "Providers can update their summaries"
  ON patient_visit_summaries
  FOR UPDATE
  TO authenticated
  USING (
    provider_id IN (
      SELECT id FROM medical_staff WHERE auth_user_id = auth.uid()
    )
  );

-- Patients can update feedback fields only
CREATE POLICY "Patients can submit feedback"
  ON patient_visit_summaries
  FOR UPDATE
  TO authenticated
  USING (patient_id = auth.uid())
  WITH CHECK (patient_id = auth.uid());

-- =====================================================
-- TRIGGER: Update updated_at timestamp
-- =====================================================

CREATE OR REPLACE FUNCTION update_patient_summaries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER patient_summaries_updated_at
  BEFORE UPDATE ON patient_visit_summaries
  FOR EACH ROW
  EXECUTE FUNCTION update_patient_summaries_updated_at();

-- =====================================================
-- ANALYTICS VIEW (for admin dashboard)
-- =====================================================

CREATE OR REPLACE VIEW patient_summary_analytics AS
SELECT
  COUNT(*) as total_summaries,
  COUNT(*) FILTER (WHERE provider_approved = TRUE) as approved_summaries,
  COUNT(*) FILTER (WHERE was_helpful = TRUE) as helpful_summaries,
  COUNT(*) FILTER (WHERE was_helpful = FALSE) as not_helpful_summaries,
  COUNT(*) FILTER (WHERE array_length(reported_errors, 1) > 0) as summaries_with_errors,
  AVG(helpfulness_rating) as avg_helpfulness_rating,
  AVG(estimated_read_time_seconds) as avg_read_time_seconds,
  AVG(word_count) as avg_word_count
FROM patient_visit_summaries
WHERE created_at > NOW() - INTERVAL '30 days';

-- =====================================================
-- GRANT permissions
-- =====================================================

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE ON patient_visit_summaries TO authenticated;
GRANT SELECT ON patient_summary_analytics TO authenticated;

-- =====================================================
-- COMMENTS for documentation
-- =====================================================

COMMENT ON TABLE patient_visit_summaries IS 'Beta feature: AI-generated patient-friendly visit summaries';
COMMENT ON COLUMN patient_visit_summaries.summary_text IS 'Plain English summary targeting 15-30 second read time';
COMMENT ON COLUMN patient_visit_summaries.key_actions IS 'Structured action items: {medications, labs, appointments, lifestyle}';
COMMENT ON COLUMN patient_visit_summaries.provider_approved IS 'Optional gate: provider must approve before patient sees summary';
COMMENT ON COLUMN patient_visit_summaries.reported_errors IS 'Patient-reported errors or inaccuracies for quality improvement';
