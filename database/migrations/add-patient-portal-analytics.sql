-- =====================================================
-- Patient Portal Analytics
-- =====================================================
-- Created: 2026-01-23
-- Purpose: Track patient portal usage, engagement,
--          and staff review activities
-- =====================================================

-- =====================================================
-- 1. PORTAL SESSIONS (Login tracking)
-- =====================================================

CREATE TABLE IF NOT EXISTS patient_portal_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_phone VARCHAR(20) NOT NULL,
  tshla_id VARCHAR(11) NOT NULL,

  -- ========================================
  -- SESSION INFO
  -- ========================================
  session_start TIMESTAMPTZ DEFAULT NOW(),
  session_end TIMESTAMPTZ,
  session_duration_seconds INTEGER,  -- Calculated on logout/timeout

  -- ========================================
  -- ACTIVITY TRACKING
  -- ========================================
  sections_viewed TEXT[],  -- ['payment', 'audio', 'ai_chat', 'hp_view']
  actions_performed JSONB DEFAULT '{}',
  -- {
  --   "payment_clicked": true,
  --   "audio_played": 2,  -- Number of times
  --   "ai_questions_asked": 5,
  --   "hp_section_viewed": ["labs", "medications", "goals"],
  --   "document_uploaded": false
  -- }

  -- ========================================
  -- DEVICE INFO
  -- ========================================
  ip_address VARCHAR(45),
  user_agent TEXT,
  device_type VARCHAR(20),  -- 'mobile', 'tablet', 'desktop'
  browser VARCHAR(50),

  -- ========================================
  -- METADATA
  -- ========================================
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. STAFF REVIEW QUEUE (Patient edits pending review)
-- =====================================================

CREATE TABLE IF NOT EXISTS staff_review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_phone VARCHAR(20) NOT NULL,
  tshla_id VARCHAR(11),
  patient_name VARCHAR(200),

  -- ========================================
  -- EDIT DETAILS
  -- ========================================
  edit_type VARCHAR(50) NOT NULL,  -- 'allergy_added', 'goal_added', 'document_uploaded', 'family_history_updated'
  section_name VARCHAR(50),  -- 'allergies', 'family_history', 'social_history', 'current_goals'
  edit_data JSONB,  -- The actual data patient added/edited
  chart_history_id UUID REFERENCES patient_chart_history(id),

  -- ========================================
  -- REVIEW STATUS
  -- ========================================
  status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'approved', 'rejected', 'edited'
  reviewed_by UUID,  -- medical_staff.id
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  -- ========================================
  -- PRIORITY
  -- ========================================
  priority VARCHAR(10) DEFAULT 'normal',  -- 'high', 'normal', 'low'

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. PORTAL USAGE ANALYTICS (Aggregated daily stats)
-- =====================================================

CREATE TABLE IF NOT EXISTS portal_usage_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,

  -- ========================================
  -- OVERALL STATS
  -- ========================================
  total_logins INTEGER DEFAULT 0,
  unique_patients INTEGER DEFAULT 0,
  avg_session_duration_seconds INTEGER,

  -- ========================================
  -- SECTION ENGAGEMENT
  -- ========================================
  payment_views INTEGER DEFAULT 0,
  payment_conversions INTEGER DEFAULT 0,  -- Payments completed
  audio_views INTEGER DEFAULT 0,
  audio_playbacks INTEGER DEFAULT 0,
  ai_chat_sessions INTEGER DEFAULT 0,
  hp_views INTEGER DEFAULT 0,

  -- ========================================
  -- DEVICE BREAKDOWN
  -- ========================================
  mobile_sessions INTEGER DEFAULT 0,
  tablet_sessions INTEGER DEFAULT 0,
  desktop_sessions INTEGER DEFAULT 0,

  -- ========================================
  -- PATIENT ACTIVITY
  -- ========================================
  documents_uploaded INTEGER DEFAULT 0,
  goals_added INTEGER DEFAULT 0,
  allergies_added INTEGER DEFAULT 0,

  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. MOST ASKED QUESTIONS (FAQ generation)
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_common_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text TEXT NOT NULL,
  normalized_question TEXT,  -- Cleaned/standardized version
  topic_category VARCHAR(50),

  -- ========================================
  -- STATS
  -- ========================================
  times_asked INTEGER DEFAULT 1,
  last_asked TIMESTAMPTZ DEFAULT NOW(),

  -- ========================================
  -- BEST ANSWER (Staff-approved)
  -- ========================================
  approved_answer TEXT,  -- Staff can curate a standard answer
  approved_by UUID,  -- medical_staff.id
  approved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 5. INDEXES
-- =====================================================

-- Portal Sessions
CREATE INDEX IF NOT EXISTS idx_portal_sessions_patient
  ON patient_portal_sessions(patient_phone, session_start DESC);

CREATE INDEX IF NOT EXISTS idx_portal_sessions_date
  ON patient_portal_sessions(DATE(session_start));

-- Staff Review Queue
CREATE INDEX IF NOT EXISTS idx_review_queue_status
  ON staff_review_queue(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_review_queue_patient
  ON staff_review_queue(patient_phone, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_review_queue_priority
  ON staff_review_queue(priority, status, created_at DESC);

-- Usage Analytics
CREATE INDEX IF NOT EXISTS idx_usage_analytics_date
  ON portal_usage_analytics(date DESC);

-- Common Questions
CREATE INDEX IF NOT EXISTS idx_common_questions_times_asked
  ON ai_common_questions(times_asked DESC);

CREATE INDEX IF NOT EXISTS idx_common_questions_category
  ON ai_common_questions(topic_category, times_asked DESC);

-- =====================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE patient_portal_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_review_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_usage_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_common_questions ENABLE ROW LEVEL SECURITY;

-- Policies: Staff only for analytics/review queues

-- =====================================================
-- 7. FUNCTIONS
-- =====================================================

-- Function to aggregate daily usage stats
CREATE OR REPLACE FUNCTION aggregate_daily_portal_stats(target_date DATE)
RETURNS VOID AS $$
BEGIN
  INSERT INTO portal_usage_analytics (
    date,
    total_logins,
    unique_patients,
    avg_session_duration_seconds,
    payment_views,
    audio_views,
    ai_chat_sessions,
    mobile_sessions,
    desktop_sessions
  )
  SELECT
    target_date,
    COUNT(*),
    COUNT(DISTINCT patient_phone),
    AVG(session_duration_seconds)::INTEGER,
    COUNT(*) FILTER (WHERE 'payment' = ANY(sections_viewed)),
    COUNT(*) FILTER (WHERE 'audio' = ANY(sections_viewed)),
    COUNT(*) FILTER (WHERE 'ai_chat' = ANY(sections_viewed)),
    COUNT(*) FILTER (WHERE device_type = 'mobile'),
    COUNT(*) FILTER (WHERE device_type = 'desktop')
  FROM patient_portal_sessions
  WHERE DATE(session_start) = target_date
  ON CONFLICT (date)
  DO UPDATE SET
    total_logins = EXCLUDED.total_logins,
    unique_patients = EXCLUDED.unique_patients,
    avg_session_duration_seconds = EXCLUDED.avg_session_duration_seconds,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- NOTES
-- =====================================================
-- This schema supports:
-- 1. Session tracking (login, duration, activity)
-- 2. Staff review queue for patient edits
-- 3. Daily aggregated usage statistics
-- 4. FAQ generation from common questions
-- 5. Device/browser analytics
-- 6. Engagement metrics (payment conversion, audio playback)
-- =====================================================
