-- =====================================================
-- DTSQs (Diabetes Treatment Satisfaction Questionnaire) Integration
-- Migration 005: Add DTSQs baseline assessment fields
-- Created: 2025-12-03
-- Purpose: Capture baseline treatment satisfaction before pump recommendation
-- =====================================================

-- =====================================================
-- ADD DTSQS FIELDS TO PATIENTS TABLE
-- =====================================================

-- DTSQs completion status
ALTER TABLE patients ADD COLUMN IF NOT EXISTS dtsqs_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS dtsqs_completed_at TIMESTAMPTZ;

-- DTSQs responses (all 8 questions + calculated scores)
ALTER TABLE patients ADD COLUMN IF NOT EXISTS dtsqs_responses JSONB;

-- JSONB Structure:
-- {
--   "q1_treatment_satisfaction": 0-6,
--   "q2_high_blood_sugars": 0-6 (inverted),
--   "q3_low_blood_sugars": 0-6 (inverted),
--   "q4_convenience": 0-6,
--   "q5_flexibility": 0-6,
--   "q6_understanding": 0-6,
--   "q7_recommend": 0-6,
--   "q8_continue": 0-6,
--   "total_score": 0-48,
--   "dissatisfaction_score": 0-48,
--   "completed_at": "ISO8601 timestamp"
-- }

COMMENT ON COLUMN patients.dtsqs_responses IS 'DTSQs baseline assessment responses - validated questionnaire licensed to Dr Rakesh Patel MD (ref CB1744)';

-- =====================================================
-- ADD DTSQS TO PUMP_ASSESSMENTS TABLE (FOR HISTORICAL TRACKING)
-- =====================================================

-- Store DTSQs baseline with each assessment for research/analytics
ALTER TABLE pump_assessments ADD COLUMN IF NOT EXISTS dtsqs_baseline JSONB;

COMMENT ON COLUMN pump_assessments.dtsqs_baseline IS 'DTSQs responses at time of pump assessment - links treatment dissatisfaction to pump recommendation';

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Index for quick completion lookups
CREATE INDEX IF NOT EXISTS idx_patients_dtsqs_completed
  ON patients(dtsqs_completed)
  WHERE dtsqs_completed = TRUE;

-- Index for DTSQs analytics (find patients by completion date)
CREATE INDEX IF NOT EXISTS idx_patients_dtsqs_completed_at
  ON patients(dtsqs_completed_at DESC)
  WHERE dtsqs_completed_at IS NOT NULL;

-- Index for pump assessment DTSQs data
CREATE INDEX IF NOT EXISTS idx_pump_assessments_dtsqs
  ON pump_assessments(completed_at)
  WHERE dtsqs_baseline IS NOT NULL;

-- =====================================================
-- VALIDATION CONSTRAINTS
-- =====================================================

-- Ensure dtsqs_responses contains valid score ranges (0-6)
CREATE OR REPLACE FUNCTION validate_dtsqs_responses()
RETURNS TRIGGER AS $$
BEGIN
  -- If dtsqs_responses is being set, validate it
  IF NEW.dtsqs_responses IS NOT NULL THEN
    -- Check that all required fields exist
    IF NOT (
      NEW.dtsqs_responses ? 'q1_treatment_satisfaction' AND
      NEW.dtsqs_responses ? 'q2_high_blood_sugars' AND
      NEW.dtsqs_responses ? 'q3_low_blood_sugars' AND
      NEW.dtsqs_responses ? 'q4_convenience' AND
      NEW.dtsqs_responses ? 'q5_flexibility' AND
      NEW.dtsqs_responses ? 'q6_understanding' AND
      NEW.dtsqs_responses ? 'q7_recommend' AND
      NEW.dtsqs_responses ? 'q8_continue' AND
      NEW.dtsqs_responses ? 'completed_at'
    ) THEN
      RAISE EXCEPTION 'DTSQs responses missing required fields';
    END IF;

    -- Validate each score is between 0-6
    IF NOT (
      (NEW.dtsqs_responses->>'q1_treatment_satisfaction')::int BETWEEN 0 AND 6 AND
      (NEW.dtsqs_responses->>'q2_high_blood_sugars')::int BETWEEN 0 AND 6 AND
      (NEW.dtsqs_responses->>'q3_low_blood_sugars')::int BETWEEN 0 AND 6 AND
      (NEW.dtsqs_responses->>'q4_convenience')::int BETWEEN 0 AND 6 AND
      (NEW.dtsqs_responses->>'q5_flexibility')::int BETWEEN 0 AND 6 AND
      (NEW.dtsqs_responses->>'q6_understanding')::int BETWEEN 0 AND 6 AND
      (NEW.dtsqs_responses->>'q7_recommend')::int BETWEEN 0 AND 6 AND
      (NEW.dtsqs_responses->>'q8_continue')::int BETWEEN 0 AND 6
    ) THEN
      RAISE EXCEPTION 'DTSQs scores must be between 0-6';
    END IF;

    -- Auto-set dtsqs_completed to TRUE when responses are saved
    NEW.dtsqs_completed := TRUE;

    -- Auto-set completion timestamp if not already set
    IF NEW.dtsqs_completed_at IS NULL THEN
      NEW.dtsqs_completed_at := NOW();
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate DTSQs responses on insert/update
DROP TRIGGER IF EXISTS trg_validate_dtsqs_patients ON patients;
CREATE TRIGGER trg_validate_dtsqs_patients
  BEFORE INSERT OR UPDATE OF dtsqs_responses ON patients
  FOR EACH ROW
  EXECUTE FUNCTION validate_dtsqs_responses();

-- =====================================================
-- HELPER FUNCTIONS FOR ANALYTICS
-- =====================================================

-- Function to calculate average DTSQs scores across all patients
CREATE OR REPLACE FUNCTION get_average_dtsqs_scores()
RETURNS TABLE (
  avg_q1 DECIMAL(3,2),
  avg_q2 DECIMAL(3,2),
  avg_q3 DECIMAL(3,2),
  avg_q4 DECIMAL(3,2),
  avg_q5 DECIMAL(3,2),
  avg_q6 DECIMAL(3,2),
  avg_q7 DECIMAL(3,2),
  avg_q8 DECIMAL(3,2),
  avg_total_score DECIMAL(4,2),
  total_responses BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    AVG((dtsqs_responses->>'q1_treatment_satisfaction')::int)::DECIMAL(3,2),
    AVG((dtsqs_responses->>'q2_high_blood_sugars')::int)::DECIMAL(3,2),
    AVG((dtsqs_responses->>'q3_low_blood_sugars')::int)::DECIMAL(3,2),
    AVG((dtsqs_responses->>'q4_convenience')::int)::DECIMAL(3,2),
    AVG((dtsqs_responses->>'q5_flexibility')::int)::DECIMAL(3,2),
    AVG((dtsqs_responses->>'q6_understanding')::int)::DECIMAL(3,2),
    AVG((dtsqs_responses->>'q7_recommend')::int)::DECIMAL(3,2),
    AVG((dtsqs_responses->>'q8_continue')::int)::DECIMAL(3,2),
    AVG((dtsqs_responses->>'total_score')::int)::DECIMAL(4,2),
    COUNT(*)
  FROM patients
  WHERE dtsqs_completed = TRUE
    AND dtsqs_responses IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_average_dtsqs_scores() IS 'Calculate average DTSQs scores across all patients for research and quality metrics';

-- Function to get patients with low treatment satisfaction (need urgent intervention)
CREATE OR REPLACE FUNCTION get_low_satisfaction_patients()
RETURNS TABLE (
  patient_id UUID,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  email VARCHAR(255),
  total_score INT,
  q8_continue INT,
  completed_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.first_name,
    p.last_name,
    p.email,
    (p.dtsqs_responses->>'total_score')::int,
    (p.dtsqs_responses->>'q8_continue')::int,
    p.dtsqs_completed_at
  FROM patients p
  WHERE p.dtsqs_completed = TRUE
    AND p.dtsqs_responses IS NOT NULL
    AND (
      (p.dtsqs_responses->>'total_score')::int < 24 OR  -- Low satisfaction threshold
      (p.dtsqs_responses->>'q8_continue')::int <= 2      -- Urgent need for change
    )
  ORDER BY (p.dtsqs_responses->>'total_score')::int ASC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_low_satisfaction_patients() IS 'Identify patients with low treatment satisfaction who need priority pump assessment';

-- =====================================================
-- RLS (ROW LEVEL SECURITY) POLICIES
-- =====================================================

-- Patients can view and update their own DTSQs data
CREATE POLICY "Patients can view own DTSQs data"
  ON patients FOR SELECT
  USING (
    auth.uid() = auth_user_id
  );

CREATE POLICY "Patients can update own DTSQs data"
  ON patients FOR UPDATE
  USING (
    auth.uid() = auth_user_id
  )
  WITH CHECK (
    auth.uid() = auth_user_id
  );

-- Medical staff can view all DTSQs data
CREATE POLICY "Medical staff can view all DTSQs data"
  ON patients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM medical_staff
      WHERE medical_staff.auth_user_id = auth.uid()
    )
  );

-- =====================================================
-- DATA MIGRATION (IF NEEDED)
-- =====================================================

-- If there are existing pump_assessments without DTSQs data,
-- we can't backfill it (data doesn't exist yet)
-- This is OK - DTSQs will be captured going forward

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

COMMENT ON TABLE patients IS 'Core patients table - now includes DTSQs baseline assessment data (added 2025-12-03)';

-- Migration success log
DO $$
BEGIN
  RAISE NOTICE 'Migration 005 completed successfully: DTSQs questionnaire fields added to patients and pump_assessments tables';
  RAISE NOTICE 'Validation triggers and helper functions created';
  RAISE NOTICE 'RLS policies updated for patient DTSQs access';
END $$;
