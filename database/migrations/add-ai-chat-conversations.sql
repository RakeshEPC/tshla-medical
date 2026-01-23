-- =====================================================
-- AI Chat Conversations (Patient Educator)
-- =====================================================
-- Created: 2026-01-23
-- Purpose: Store AI chat conversations for analytics
--          (NOT shown to patients - backend only)
-- =====================================================

-- =====================================================
-- 1. AI CHAT CONVERSATIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS patient_ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_phone VARCHAR(20) NOT NULL,
  tshla_id VARCHAR(11),
  session_id UUID NOT NULL,  -- Group messages by session (2-hour window)

  -- ========================================
  -- MESSAGE
  -- ========================================
  message_role VARCHAR(10) NOT NULL,  -- 'user' or 'assistant'
  message_text TEXT NOT NULL,
  audio_url TEXT,  -- ElevenLabs audio URL (for assistant responses only)

  -- ========================================
  -- ANALYTICS
  -- ========================================
  topic_category VARCHAR(50),  -- Auto-classified by AI
  -- Categories: MEDICATION_EDUCATION, MEDICATION_SIDE_EFFECTS,
  --             LAB_RESULTS, DIAGNOSIS_EDUCATION, DIET_NUTRITION,
  --             EXERCISE, SYMPTOMS, VISIT_FOLLOWUP, URGENT_SYMPTOMS

  tokens_used INTEGER,  -- OpenAI tokens consumed
  audio_characters INTEGER,  -- ElevenLabs characters used
  cost_cents INTEGER,  -- Total cost in cents

  -- ========================================
  -- SATISFACTION
  -- ========================================
  helpful_rating BOOLEAN,  -- Thumbs up/down (for assistant messages only)

  -- ========================================
  -- METADATA
  -- ========================================
  created_at TIMESTAMPTZ DEFAULT NOW(),
  session_ip VARCHAR(45),  -- For security/rate limiting
  user_agent TEXT
);

-- =====================================================
-- 2. DAILY ANALYTICS SUMMARY
-- =====================================================

CREATE TABLE IF NOT EXISTS patient_ai_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_phone VARCHAR(20) NOT NULL,
  date DATE NOT NULL,

  -- ========================================
  -- USAGE
  -- ========================================
  total_questions INTEGER DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  avg_questions_per_session DECIMAL(5,2),
  total_messages INTEGER DEFAULT 0,  -- User + assistant messages

  -- ========================================
  -- TOPICS (JSONB for flexibility)
  -- ========================================
  topics JSONB DEFAULT '{}',
  -- {
  --   "MEDICATION_EDUCATION": 5,
  --   "LAB_RESULTS": 3,
  --   "DIET_NUTRITION": 2,
  --   "URGENT_SYMPTOMS": 1
  -- }

  -- ========================================
  -- SATISFACTION
  -- ========================================
  helpful_count INTEGER DEFAULT 0,
  unhelpful_count INTEGER DEFAULT 0,
  satisfaction_rate DECIMAL(5,2),

  -- ========================================
  -- COSTS (in cents)
  -- ========================================
  total_cost_cents INTEGER DEFAULT 0,
  openai_cost_cents INTEGER DEFAULT 0,
  elevenlabs_cost_cents INTEGER DEFAULT 0,

  -- ========================================
  -- METADATA
  -- ========================================
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(patient_phone, date)
);

-- =====================================================
-- 3. STAFF ALERTS (Urgent Symptoms)
-- =====================================================

CREATE TABLE IF NOT EXISTS patient_urgent_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_phone VARCHAR(20) NOT NULL,
  tshla_id VARCHAR(11),
  patient_name VARCHAR(200),

  -- ========================================
  -- ALERT DETAILS
  -- ========================================
  alert_type VARCHAR(50) DEFAULT 'urgent_symptom',  -- 'urgent_symptom', 'medication_concern', etc.
  conversation_id UUID REFERENCES patient_ai_conversations(id),
  patient_question TEXT,
  ai_response TEXT,
  detected_symptoms TEXT[],  -- e.g., ['chest_pain', 'shortness_of_breath']

  -- ========================================
  -- STATUS
  -- ========================================
  status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'reviewed', 'contacted', 'resolved'
  reviewed_by UUID,  -- medical_staff.id
  reviewed_at TIMESTAMPTZ,
  resolution_notes TEXT,

  -- ========================================
  -- PRIORITY
  -- ========================================
  priority VARCHAR(10) DEFAULT 'high',  -- 'high', 'medium', 'low'

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_ai_conversations_patient
  ON patient_ai_conversations(patient_phone, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_session
  ON patient_ai_conversations(session_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_topic
  ON patient_ai_conversations(topic_category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_analytics_patient_date
  ON patient_ai_analytics(patient_phone, date DESC);

CREATE INDEX IF NOT EXISTS idx_ai_analytics_date
  ON patient_ai_analytics(date DESC);

CREATE INDEX IF NOT EXISTS idx_urgent_alerts_status
  ON patient_urgent_alerts(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_urgent_alerts_patient
  ON patient_urgent_alerts(patient_phone, created_at DESC);

-- =====================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE patient_ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_ai_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_urgent_alerts ENABLE ROW LEVEL SECURITY;

-- Policies: Staff only (patients should not see these tables)

-- =====================================================
-- 6. FUNCTIONS
-- =====================================================

-- Function to update analytics after new message
CREATE OR REPLACE FUNCTION update_ai_analytics()
RETURNS TRIGGER AS $$
DECLARE
  analytics_record RECORD;
BEGIN
  -- Only process user messages (questions)
  IF NEW.message_role = 'user' THEN
    -- Get or create today's analytics record
    SELECT * INTO analytics_record
    FROM patient_ai_analytics
    WHERE patient_phone = NEW.patient_phone
      AND date = CURRENT_DATE;

    IF analytics_record IS NULL THEN
      -- Create new record
      INSERT INTO patient_ai_analytics (patient_phone, date, total_questions, total_sessions)
      VALUES (NEW.patient_phone, CURRENT_DATE, 1, 1);
    ELSE
      -- Update existing record
      UPDATE patient_ai_analytics
      SET
        total_questions = total_questions + 1,
        updated_at = NOW()
      WHERE patient_phone = NEW.patient_phone
        AND date = CURRENT_DATE;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update analytics
DROP TRIGGER IF EXISTS trigger_update_ai_analytics ON patient_ai_conversations;
CREATE TRIGGER trigger_update_ai_analytics
  AFTER INSERT ON patient_ai_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_analytics();

-- =====================================================
-- NOTES
-- =====================================================
-- This schema supports:
-- 1. Complete conversation history (backend only)
-- 2. Daily analytics aggregation
-- 3. Cost tracking per patient
-- 4. Topic classification for insights
-- 5. Satisfaction ratings
-- 6. Urgent symptom detection and alerting
-- 7. Staff review workflow
-- =====================================================
