-- =====================================================
-- PRE-VISIT READINESS SYSTEM - ADD-ON SCHEMA
-- =====================================================
-- Created: January 2025
-- Purpose: Pre-visit tables that work with EXISTING patients table
--
-- IMPORTANT: This schema does NOT modify your existing patients table
-- It only adds the pre-visit specific tables
-- =====================================================

-- =====================================================
-- PREVISIT RESPONSES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS previsit_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links to existing tables
  patient_id UUID NOT NULL, -- References your existing patients(id)
  appointment_id UUID, -- References appointments table if it exists
  provider_id UUID,

  -- Call Metadata
  call_sid VARCHAR(100), -- Twilio Call SID
  elevenlabs_conversation_id VARCHAR(100), -- 11Labs Conversation ID
  call_initiated_at TIMESTAMPTZ,
  call_answered_at TIMESTAMPTZ,
  call_completed_at TIMESTAMPTZ,
  call_duration_seconds INTEGER,
  call_status VARCHAR(50) NOT NULL DEFAULT 'pending', -- completed, no-answer, failed, patient-declined, voicemail, pending
  call_attempt_number INTEGER DEFAULT 1, -- 1st, 2nd, or 3rd attempt
  call_completed BOOLEAN DEFAULT FALSE,

  -- Structured Data (JSON for flexibility)
  current_medications TEXT[], -- Array of medication strings
  refills_needed TEXT[],

  labs_completed BOOLEAN,
  labs_details TEXT, -- "Quest Diagnostics, January 15, 2025"
  labs_needed BOOLEAN,
  lab_status TEXT,

  specialist_visits TEXT[],
  chief_concerns TEXT[], -- Array of concerns
  new_symptoms TEXT,
  recent_changes TEXT,

  patient_needs TEXT,
  patient_questions TEXT[], -- Array of questions
  questions_for_provider TEXT[],

  -- Raw Data
  full_transcript TEXT, -- Full conversation text
  audio_recording_url TEXT, -- S3/Azure Blob URL

  -- AI Analysis
  ai_summary TEXT, -- 2-3 sentence provider-ready summary
  clinical_notes TEXT, -- Formatted clinical notes
  risk_flags TEXT[] DEFAULT '{}', -- ['new-chest-pain', 'medication-confusion', 'urgent-symptoms']
  requires_urgent_callback BOOLEAN DEFAULT FALSE,
  urgency_level VARCHAR(20) DEFAULT 'low', -- low, medium, high, critical

  -- Patient Confirmation
  appointment_confirmed BOOLEAN,
  patient_will_attend BOOLEAN,
  call_date TIMESTAMPTZ,

  -- Provider Review
  reviewed_by_provider BOOLEAN DEFAULT FALSE,
  provider_reviewed BOOLEAN DEFAULT FALSE,
  reviewed_at TIMESTAMPTZ,
  provider_reviewed_at TIMESTAMPTZ,
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

  patient_id UUID NOT NULL, -- References your existing patients(id)
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

  patient_id UUID NOT NULL, -- References your existing patients(id)
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

ALTER TABLE previsit_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE previsit_call_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE previsit_notification_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running script)
DROP POLICY IF EXISTS "Providers see their pre-visit responses" ON previsit_responses;
DROP POLICY IF EXISTS "Providers update their pre-visit responses" ON previsit_responses;
DROP POLICY IF EXISTS "System inserts pre-visit responses" ON previsit_responses;
DROP POLICY IF EXISTS "Service role full access to previsit_responses" ON previsit_responses;

DROP POLICY IF EXISTS "Providers see their call logs" ON previsit_call_log;
DROP POLICY IF EXISTS "System inserts call logs" ON previsit_call_log;
DROP POLICY IF EXISTS "Service role full access to call logs" ON previsit_call_log;

DROP POLICY IF EXISTS "Providers see their notifications" ON previsit_notification_log;
DROP POLICY IF EXISTS "System inserts notifications" ON previsit_notification_log;
DROP POLICY IF EXISTS "Service role full access to notifications" ON previsit_notification_log;

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

CREATE POLICY "System inserts call logs"
  ON previsit_call_log FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "Service role full access to call logs"
  ON previsit_call_log FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- NOTIFICATION LOG POLICIES
CREATE POLICY "Providers see their notifications"
  ON previsit_notification_log FOR SELECT
  USING (TRUE); -- Adjust based on your auth

CREATE POLICY "System inserts notifications"
  ON previsit_notification_log FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "Service role full access to notifications"
  ON previsit_notification_log FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update previsit_responses.updated_at automatically
CREATE OR REPLACE FUNCTION update_previsit_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS previsit_responses_updated_at ON previsit_responses;
CREATE TRIGGER previsit_responses_updated_at
  BEFORE UPDATE ON previsit_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_previsit_updated_at();

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Run these after deployment to verify setup

-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('previsit_responses', 'previsit_call_log', 'previsit_notification_log');

-- Check indexes
SELECT indexname FROM pg_indexes
WHERE tablename IN ('previsit_responses', 'previsit_call_log', 'previsit_notification_log');

-- Check RLS enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE tablename IN ('previsit_responses', 'previsit_call_log', 'previsit_notification_log');

-- =====================================================
-- DEPLOYMENT COMPLETE
-- =====================================================
--
-- This schema works with your existing patients table.
-- It only adds the pre-visit specific tables.
--
-- Next Steps:
-- 1. Verify all tables created successfully
-- 2. Test the patient service
-- 3. Start building the pre-visit system
--
-- =====================================================
