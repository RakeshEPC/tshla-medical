-- PCM Lab Management & AI Weekly Calls System
-- Migration to add lab ordering and automated patient communication
-- Created: 2025-01-18

-- ====================================
-- PCM LAB MANAGEMENT TABLES
-- ====================================

-- Lab Orders Table
CREATE TABLE IF NOT EXISTS pcm_lab_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  ordered_by UUID NOT NULL REFERENCES doctors(id) ON DELETE SET NULL,
  order_date TIMESTAMPTZ DEFAULT NOW(),
  due_date DATE,
  status VARCHAR(50) DEFAULT 'pending', -- pending, completed, cancelled, overdue
  labs_requested TEXT[] NOT NULL, -- Array of lab test names
  priority VARCHAR(20) DEFAULT 'routine', -- routine, urgent, stat
  panel_type VARCHAR(100), -- diabetes_quarterly, diabetes_annual, cardiac, etc
  external_order_id VARCHAR(100), -- Reference ID from lab system
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lab Results Table
CREATE TABLE IF NOT EXISTS pcm_lab_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  lab_order_id UUID REFERENCES pcm_lab_orders(id) ON DELETE SET NULL,
  test_name VARCHAR(100) NOT NULL,
  result_value VARCHAR(50) NOT NULL,
  result_numeric DECIMAL(10,3), -- Numeric value for trending
  unit VARCHAR(50),
  reference_range VARCHAR(100),
  status VARCHAR(50) DEFAULT 'final', -- preliminary, final, corrected
  abnormal_flag BOOLEAN DEFAULT false,
  critical_flag BOOLEAN DEFAULT false,
  result_date DATE NOT NULL,
  performing_lab VARCHAR(200),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lab Schedules Table (Recurring lab orders)
CREATE TABLE IF NOT EXISTS pcm_lab_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  test_name VARCHAR(100) NOT NULL,
  panel_type VARCHAR(100),
  frequency VARCHAR(50) NOT NULL, -- monthly, quarterly, biannual, annual
  last_completed_date DATE,
  next_due_date DATE NOT NULL,
  auto_order BOOLEAN DEFAULT false, -- Auto-create order when due
  enabled BOOLEAN DEFAULT true,
  created_by UUID REFERENCES doctors(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================
-- PCM AI WEEKLY CALLS SYSTEM
-- ====================================

-- Call Schedules Table
CREATE TABLE IF NOT EXISTS pcm_call_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  patient_phone VARCHAR(20) NOT NULL, -- Phone number for outbound calls
  day_of_week INTEGER NOT NULL, -- 0=Sunday, 1=Monday, etc.
  call_time TIME NOT NULL DEFAULT '10:00:00',
  timezone VARCHAR(50) DEFAULT 'America/Chicago',
  enabled BOOLEAN DEFAULT true,
  last_call_date TIMESTAMPTZ,
  next_call_date TIMESTAMPTZ,
  consecutive_misses INTEGER DEFAULT 0,
  patient_consent_given BOOLEAN DEFAULT false,
  consent_date DATE,
  script_template VARCHAR(50) DEFAULT 'diabetes_weekly',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Call Logs Table
CREATE TABLE IF NOT EXISTS pcm_call_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  patient_phone VARCHAR(20), -- Phone number called
  schedule_id UUID REFERENCES pcm_call_schedules(id) ON DELETE SET NULL,
  call_date TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(50) NOT NULL, -- completed, missed, failed, in_progress, ringing, no_answer
  duration_seconds INTEGER,
  transcript TEXT,
  audio_url TEXT, -- ElevenLabs recording URL
  call_sid VARCHAR(100), -- Twilio call identifier
  call_direction VARCHAR(20) DEFAULT 'outbound', -- outbound (to patient), inbound (from patient)
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  answered BOOLEAN DEFAULT false,
  answered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Call Summaries Table (AI Analysis Results)
CREATE TABLE IF NOT EXISTS pcm_call_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_log_id UUID NOT NULL REFERENCES pcm_call_logs(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  summary_text TEXT NOT NULL,

  -- Extracted Metrics (JSON)
  extracted_metrics JSONB, -- {medication_adherence, blood_sugar_control, symptoms, etc}

  -- Flags and Alerts
  flags TEXT[], -- Array: needs_followup, urgent_callback, emergency, medication_issue
  urgency_level VARCHAR(20) DEFAULT 'routine', -- routine, moderate, urgent, emergency

  -- Review Status
  reviewed BOOLEAN DEFAULT false,
  reviewed_by UUID REFERENCES doctors(id) ON DELETE SET NULL,
  reviewed_date TIMESTAMPTZ,

  -- Provider Response
  provider_response_id UUID, -- Foreign key to pcm_provider_responses

  -- AI Analysis Details
  sentiment VARCHAR(50), -- positive, neutral, concerned, distressed
  confidence_score DECIMAL(3,2), -- AI confidence in analysis (0.00 - 1.00)
  action_items TEXT[],

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Provider Responses Table
CREATE TABLE IF NOT EXISTS pcm_provider_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  summary_id UUID NOT NULL REFERENCES pcm_call_summaries(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  patient_phone VARCHAR(20), -- Phone number for delivery
  provider_id UUID NOT NULL REFERENCES doctors(id) ON DELETE SET NULL,

  response_type VARCHAR(50) NOT NULL, -- encouraging, instructional, urgent_callback, emergency
  response_text TEXT NOT NULL,
  audio_url TEXT, -- ElevenLabs generated response

  -- Delivery
  sent_date TIMESTAMPTZ DEFAULT NOW(),
  delivery_method VARCHAR(50) DEFAULT 'phone_call', -- phone_call, sms, app_notification
  delivery_status VARCHAR(50) DEFAULT 'pending', -- pending, ringing, delivered, failed, no_answer
  call_sid VARCHAR(100), -- Twilio call identifier for phone delivery
  patient_viewed BOOLEAN DEFAULT false,
  patient_viewed_date TIMESTAMPTZ,
  call_answered BOOLEAN DEFAULT false,
  call_answered_at TIMESTAMPTZ,
  call_duration_seconds INTEGER,

  -- Follow-up
  requires_acknowledgment BOOLEAN DEFAULT false,
  patient_acknowledged BOOLEAN DEFAULT false,
  patient_acknowledged_date TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================
-- INDEXES FOR PERFORMANCE
-- ====================================

-- Lab Orders Indexes
CREATE INDEX idx_pcm_lab_orders_patient ON pcm_lab_orders(patient_id);
CREATE INDEX idx_pcm_lab_orders_status ON pcm_lab_orders(status);
CREATE INDEX idx_pcm_lab_orders_due_date ON pcm_lab_orders(due_date);
CREATE INDEX idx_pcm_lab_orders_ordered_by ON pcm_lab_orders(ordered_by);

-- Lab Results Indexes
CREATE INDEX idx_pcm_lab_results_patient ON pcm_lab_results(patient_id);
CREATE INDEX idx_pcm_lab_results_order ON pcm_lab_results(lab_order_id);
CREATE INDEX idx_pcm_lab_results_test_name ON pcm_lab_results(test_name);
CREATE INDEX idx_pcm_lab_results_date ON pcm_lab_results(result_date);
CREATE INDEX idx_pcm_lab_results_abnormal ON pcm_lab_results(abnormal_flag) WHERE abnormal_flag = true;

-- Lab Schedules Indexes
CREATE INDEX idx_pcm_lab_schedules_patient ON pcm_lab_schedules(patient_id);
CREATE INDEX idx_pcm_lab_schedules_next_due ON pcm_lab_schedules(next_due_date) WHERE enabled = true;

-- Call Schedules Indexes
CREATE INDEX idx_pcm_call_schedules_patient ON pcm_call_schedules(patient_id);
CREATE INDEX idx_pcm_call_schedules_next_call ON pcm_call_schedules(next_call_date) WHERE enabled = true;

-- Call Logs Indexes
CREATE INDEX idx_pcm_call_logs_patient ON pcm_call_logs(patient_id);
CREATE INDEX idx_pcm_call_logs_date ON pcm_call_logs(call_date);
CREATE INDEX idx_pcm_call_logs_status ON pcm_call_logs(status);

-- Call Summaries Indexes
CREATE INDEX idx_pcm_call_summaries_patient ON pcm_call_summaries(patient_id);
CREATE INDEX idx_pcm_call_summaries_reviewed ON pcm_call_summaries(reviewed) WHERE reviewed = false;
CREATE INDEX idx_pcm_call_summaries_urgency ON pcm_call_summaries(urgency_level);
CREATE INDEX idx_pcm_call_summaries_date ON pcm_call_summaries(created_at);

-- Provider Responses Indexes
CREATE INDEX idx_pcm_provider_responses_patient ON pcm_provider_responses(patient_id);
CREATE INDEX idx_pcm_provider_responses_provider ON pcm_provider_responses(provider_id);
CREATE INDEX idx_pcm_provider_responses_viewed ON pcm_provider_responses(patient_viewed) WHERE patient_viewed = false;

-- ====================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================

-- Enable RLS on all tables
ALTER TABLE pcm_lab_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE pcm_lab_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE pcm_lab_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE pcm_call_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE pcm_call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pcm_call_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE pcm_provider_responses ENABLE ROW LEVEL SECURITY;

-- Doctors can view/edit all PCM data
CREATE POLICY doctors_all_access ON pcm_lab_orders
  FOR ALL USING (auth.role() = 'doctor');

CREATE POLICY doctors_all_access ON pcm_lab_results
  FOR ALL USING (auth.role() = 'doctor');

CREATE POLICY doctors_all_access ON pcm_lab_schedules
  FOR ALL USING (auth.role() = 'doctor');

CREATE POLICY doctors_all_access ON pcm_call_schedules
  FOR ALL USING (auth.role() = 'doctor');

CREATE POLICY doctors_all_access ON pcm_call_logs
  FOR ALL USING (auth.role() = 'doctor');

CREATE POLICY doctors_all_access ON pcm_call_summaries
  FOR ALL USING (auth.role() = 'doctor');

CREATE POLICY doctors_all_access ON pcm_provider_responses
  FOR ALL USING (auth.role() = 'doctor');

-- Patients can view their own data only
CREATE POLICY patients_view_own_labs ON pcm_lab_results
  FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY patients_view_own_calls ON pcm_call_logs
  FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY patients_view_own_summaries ON pcm_call_summaries
  FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY patients_view_own_responses ON pcm_provider_responses
  FOR SELECT USING (auth.uid() = patient_id);

-- Patients can update viewed status
CREATE POLICY patients_update_viewed ON pcm_provider_responses
  FOR UPDATE USING (auth.uid() = patient_id)
  WITH CHECK (auth.uid() = patient_id);

-- ====================================
-- FUNCTIONS AND TRIGGERS
-- ====================================

-- Function to update next_due_date based on frequency
CREATE OR REPLACE FUNCTION update_lab_schedule_next_due()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.last_completed_date IS NOT NULL THEN
    CASE NEW.frequency
      WHEN 'monthly' THEN
        NEW.next_due_date := NEW.last_completed_date + INTERVAL '1 month';
      WHEN 'quarterly' THEN
        NEW.next_due_date := NEW.last_completed_date + INTERVAL '3 months';
      WHEN 'biannual' THEN
        NEW.next_due_date := NEW.last_completed_date + INTERVAL '6 months';
      WHEN 'annual' THEN
        NEW.next_due_date := NEW.last_completed_date + INTERVAL '1 year';
    END CASE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_lab_schedule_next_due
  BEFORE UPDATE ON pcm_lab_schedules
  FOR EACH ROW
  WHEN (OLD.last_completed_date IS DISTINCT FROM NEW.last_completed_date)
  EXECUTE FUNCTION update_lab_schedule_next_due();

-- Function to calculate next call date
CREATE OR REPLACE FUNCTION calculate_next_call_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.last_call_date IS NOT NULL THEN
    NEW.next_call_date := (NEW.last_call_date + INTERVAL '7 days')::date + NEW.call_time;
  ELSE
    -- First call: find next occurrence of day_of_week
    NEW.next_call_date := (
      CURRENT_DATE +
      ((NEW.day_of_week - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER + 7) % 7)::INTEGER
    )::date + NEW.call_time;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_next_call_date
  BEFORE INSERT OR UPDATE ON pcm_call_schedules
  FOR EACH ROW
  EXECUTE FUNCTION calculate_next_call_date();

-- Function to auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_pcm_lab_orders_updated_at
  BEFORE UPDATE ON pcm_lab_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_pcm_lab_results_updated_at
  BEFORE UPDATE ON pcm_lab_results
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_pcm_lab_schedules_updated_at
  BEFORE UPDATE ON pcm_lab_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_pcm_call_schedules_updated_at
  BEFORE UPDATE ON pcm_call_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_pcm_call_summaries_updated_at
  BEFORE UPDATE ON pcm_call_summaries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ====================================
-- SEED DATA FOR DEMO
-- ====================================

-- Standard lab panels for PCM patients
CREATE TABLE IF NOT EXISTS pcm_lab_panels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  panel_name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(200) NOT NULL,
  tests TEXT[] NOT NULL,
  frequency VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO pcm_lab_panels (panel_name, display_name, tests, frequency, description) VALUES
(
  'diabetes_quarterly',
  'Diabetes PCM - Quarterly Panel',
  ARRAY['Hemoglobin A1C', 'Comprehensive Metabolic Panel', 'Lipid Panel', 'Urine Microalbumin', 'eGFR'],
  'quarterly',
  'Standard diabetes monitoring panel for PCM patients - every 3 months'
),
(
  'diabetes_annual',
  'Diabetes PCM - Annual Panel',
  ARRAY['Hemoglobin A1C', 'Comprehensive Metabolic Panel', 'Lipid Panel', 'Urine Microalbumin', 'eGFR', 'TSH', 'Vitamin B12', 'Liver Function Tests'],
  'annual',
  'Comprehensive annual diabetes panel including thyroid and vitamin screening'
),
(
  'cardiac_panel',
  'Cardiac Risk Assessment',
  ARRAY['Lipid Panel', 'hs-CRP', 'Lipoprotein(a)', 'Homocysteine', 'NT-proBNP'],
  'biannual',
  'Cardiac risk markers for high-risk patients'
),
(
  'kidney_panel',
  'Kidney Function Panel',
  ARRAY['Comprehensive Metabolic Panel', 'eGFR', 'Urine Microalbumin', 'Urine Creatinine'],
  'quarterly',
  'Kidney function monitoring for CKD patients'
)
ON CONFLICT (panel_name) DO NOTHING;

COMMENT ON TABLE pcm_lab_orders IS 'Lab orders for PCM patients with status tracking';
COMMENT ON TABLE pcm_lab_results IS 'Individual lab test results with historical trending';
COMMENT ON TABLE pcm_lab_schedules IS 'Recurring lab order schedules per patient';
COMMENT ON TABLE pcm_call_schedules IS 'Weekly AI call schedules for automated patient check-ins';
COMMENT ON TABLE pcm_call_logs IS 'Call history and transcripts from ElevenLabs';
COMMENT ON TABLE pcm_call_summaries IS 'AI-generated summaries and analysis of patient responses';
COMMENT ON TABLE pcm_provider_responses IS 'Provider voice responses to patient check-ins';
