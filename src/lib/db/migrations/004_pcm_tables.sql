-- =====================================================
-- PCM (Principal Care Management) Database Schema
-- Migration 004: Create all PCM-related tables
-- Created: 2025-01-26
-- Purpose: Move PCM data from localStorage to Supabase
-- =====================================================

-- =====================================================
-- PCM ENROLLMENTS
-- Tracks patient enrollment in PCM program
-- =====================================================
CREATE TABLE IF NOT EXISTS pcm_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  enrolled_by UUID REFERENCES medical_staff(id),
  enrolled_date TIMESTAMPTZ DEFAULT NOW(),

  -- Risk Management
  risk_level VARCHAR(20) DEFAULT 'medium', -- high, medium, low
  risk_score DECIMAL(5,2), -- 0-100 calculated score
  risk_factors JSONB DEFAULT '{}'::jsonb, -- {diabetes_control: 'poor', adherence: 'low'}

  -- Clinical Information
  primary_diagnoses JSONB DEFAULT '[]'::jsonb, -- [{code: 'E11.9', description: 'Type 2 Diabetes'}]
  comorbidities JSONB DEFAULT '[]'::jsonb,

  -- Current Vitals & Targets
  current_a1c DECIMAL(4,2),
  target_a1c DECIMAL(4,2) DEFAULT 7.0,
  current_bp VARCHAR(20),
  target_bp VARCHAR(20) DEFAULT '130/80',
  current_weight DECIMAL(5,2),
  target_weight DECIMAL(5,2),

  -- Medications
  medication_list JSONB DEFAULT '[]'::jsonb,
  medication_adherence_pct INT DEFAULT 0, -- 0-100

  -- PCM Program Requirements
  monthly_time_requirement INT DEFAULT 30, -- minutes per month
  contact_frequency VARCHAR(50) DEFAULT 'monthly',
  next_contact_due DATE,
  last_contact_date TIMESTAMPTZ,

  -- Goals & Care Plan
  patient_goals JSONB DEFAULT '[]'::jsonb,
  care_plan_url TEXT,
  care_plan_version INT DEFAULT 1,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  disenrolled_date TIMESTAMPTZ,
  disenrollment_reason TEXT,

  -- Compliance Tracking
  appointment_adherence_pct INT DEFAULT 0,
  vitals_logging_frequency VARCHAR(50) DEFAULT 'weekly',
  missed_appointments INT DEFAULT 0,

  -- Contact Information
  phone VARCHAR(20),
  email VARCHAR(255),
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(20),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_risk_level CHECK (risk_level IN ('high', 'medium', 'low')),
  CONSTRAINT valid_risk_score CHECK (risk_score >= 0 AND risk_score <= 100),
  CONSTRAINT valid_a1c CHECK (current_a1c IS NULL OR (current_a1c >= 0 AND current_a1c <= 20)),
  CONSTRAINT valid_adherence CHECK (medication_adherence_pct >= 0 AND medication_adherence_pct <= 100)
);

-- =====================================================
-- PCM CONTACTS
-- Logs all staff interactions with PCM patients
-- =====================================================
CREATE TABLE IF NOT EXISTS pcm_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES pcm_enrollments(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES medical_staff(id),
  staff_name VARCHAR(255) NOT NULL,

  -- Contact Details
  contact_date TIMESTAMPTZ DEFAULT NOW(),
  contact_type VARCHAR(50) NOT NULL, -- phone_call, video_call, in_person, secure_message
  duration_minutes INT,

  -- Outcome
  outcome VARCHAR(50) NOT NULL, -- completed, no_answer, voicemail, rescheduled
  notes TEXT NOT NULL,

  -- Clinical Data Collected During Contact
  vitals_recorded JSONB DEFAULT '{}'::jsonb, -- {bp: '120/80', weight: 175, bg: 120}
  symptoms_reported JSONB DEFAULT '[]'::jsonb,
  medication_changes JSONB DEFAULT '[]'::jsonb,
  patient_concerns JSONB DEFAULT '[]'::jsonb,

  -- Follow-up Planning
  follow_up_needed BOOLEAN DEFAULT FALSE,
  follow_up_date DATE,
  follow_up_reason TEXT,

  -- Billing Information
  billable BOOLEAN DEFAULT TRUE,
  billed BOOLEAN DEFAULT FALSE,
  billing_date DATE,
  billing_code VARCHAR(20), -- CPT code: 99490 (first 20 min), 99439 (each additional 20 min), etc
  billing_units INT DEFAULT 1,

  -- Quality Metrics
  patient_satisfaction_score INT, -- 1-5 rating
  call_quality_notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_contact_type CHECK (contact_type IN ('phone_call', 'video_call', 'in_person', 'secure_message', 'other')),
  CONSTRAINT valid_outcome CHECK (outcome IN ('completed', 'no_answer', 'voicemail', 'rescheduled', 'cancelled')),
  CONSTRAINT valid_duration CHECK (duration_minutes IS NULL OR (duration_minutes > 0 AND duration_minutes <= 480))
);

-- =====================================================
-- PCM VITALS TRACKING
-- Patient vital signs and monitoring data
-- =====================================================
CREATE TABLE IF NOT EXISTS pcm_vitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES pcm_enrollments(id) ON DELETE CASCADE,

  -- Reading Details
  reading_date TIMESTAMPTZ DEFAULT NOW(),
  recorded_by VARCHAR(20) NOT NULL, -- patient, staff, device, import
  source_device VARCHAR(100), -- Glucometer model, BP cuff, etc

  -- Vital Signs (all optional, record what's available)
  blood_sugar DECIMAL(5,1), -- mg/dL
  blood_pressure_systolic INT,
  blood_pressure_diastolic INT,
  heart_rate INT, -- bpm
  weight DECIMAL(5,2), -- lbs or kg
  weight_unit VARCHAR(10) DEFAULT 'lbs',
  temperature DECIMAL(4,2), -- Fahrenheit or Celsius
  temperature_unit VARCHAR(10) DEFAULT 'F',
  oxygen_saturation INT, -- %

  -- Diabetes-Specific Metrics
  insulin_dose DECIMAL(5,2),
  insulin_type VARCHAR(100),
  carbs_consumed INT,
  meal_context VARCHAR(50), -- before_meal, after_meal, bedtime, fasting, random

  -- Exercise & Activity
  exercise_minutes INT,
  exercise_type VARCHAR(100),
  steps_count INT,

  -- Flags & Alerts
  is_abnormal BOOLEAN DEFAULT FALSE,
  abnormal_reason TEXT,
  abnormal_fields JSONB DEFAULT '[]'::jsonb, -- ['blood_sugar', 'bp_systolic']
  staff_notified BOOLEAN DEFAULT FALSE,
  staff_notified_at TIMESTAMPTZ,

  -- Patient Context
  patient_notes TEXT,
  symptoms TEXT,
  feeling_score INT, -- 1-10 how patient feels

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_recorded_by CHECK (recorded_by IN ('patient', 'staff', 'device', 'import')),
  CONSTRAINT valid_meal_context CHECK (meal_context IS NULL OR meal_context IN ('before_meal', 'after_meal', 'bedtime', 'fasting', 'random')),
  CONSTRAINT valid_o2_sat CHECK (oxygen_saturation IS NULL OR (oxygen_saturation >= 0 AND oxygen_saturation <= 100))
);

-- =====================================================
-- PCM TASKS / ACTION ITEMS
-- Automated and manual tasks for patient care
-- =====================================================
CREATE TABLE IF NOT EXISTS pcm_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES pcm_enrollments(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES medical_staff(id),
  assigned_by UUID REFERENCES medical_staff(id),

  -- Task Details
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL, -- vitals, medication, exercise, nutrition, screening, appointment, lab, other

  -- Frequency & Recurrence
  frequency VARCHAR(50), -- daily, weekly, monthly, quarterly, one_time
  recurrence_rule TEXT, -- Cron-like expression or RRULE
  starts_on DATE,
  ends_on DATE,

  -- Completion Tracking
  is_completed BOOLEAN DEFAULT FALSE,
  completed_date TIMESTAMPTZ,
  completed_by UUID REFERENCES medical_staff(id),
  completion_notes TEXT,
  completion_evidence JSONB, -- Could store readings, confirmations, etc

  -- Reminders
  reminder_enabled BOOLEAN DEFAULT TRUE,
  reminder_days_before INT DEFAULT 1,
  last_reminder_sent TIMESTAMPTZ,
  reminder_count INT DEFAULT 0,

  -- Due Date & Priority
  due_date DATE,
  is_overdue BOOLEAN DEFAULT FALSE, -- Updated by trigger
  priority VARCHAR(20) DEFAULT 'medium', -- high, medium, low
  urgency_score INT DEFAULT 50, -- 0-100

  -- Patient Compliance
  patient_acknowledged BOOLEAN DEFAULT FALSE,
  patient_acknowledged_at TIMESTAMPTZ,
  skip_reason TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_category CHECK (category IN ('vitals', 'medication', 'exercise', 'nutrition', 'screening', 'appointment', 'lab', 'education', 'other')),
  CONSTRAINT valid_frequency CHECK (frequency IS NULL OR frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'one_time')),
  CONSTRAINT valid_priority CHECK (priority IN ('high', 'medium', 'low')),
  CONSTRAINT valid_urgency_score CHECK (urgency_score >= 0 AND urgency_score <= 100)
);

-- =====================================================
-- PCM TIME ENTRIES
-- Track staff time for billing compliance
-- =====================================================
CREATE TABLE IF NOT EXISTS pcm_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES pcm_enrollments(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES medical_staff(id) NOT NULL,
  staff_name VARCHAR(255) NOT NULL,

  -- Time Details
  activity_type VARCHAR(50) NOT NULL, -- phone_call, care_coordination, med_review, lab_review, documentation, education, other
  activity_description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_minutes INT,

  -- Month for billing aggregation
  billing_month VARCHAR(7) NOT NULL, -- YYYY-MM format

  -- Related Records
  related_contact_id UUID REFERENCES pcm_contacts(id),
  related_task_id UUID REFERENCES pcm_tasks(id),

  -- Billing Status
  billable BOOLEAN DEFAULT TRUE,
  billed BOOLEAN DEFAULT FALSE,
  billing_date DATE,
  billing_code VARCHAR(20),

  -- Quality & Compliance
  notes TEXT,
  documented_in_ehr BOOLEAN DEFAULT FALSE,
  supervised BOOLEAN DEFAULT FALSE,
  supervisor_id UUID REFERENCES medical_staff(id),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_activity_type CHECK (activity_type IN ('phone_call', 'care_coordination', 'med_review', 'lab_review', 'documentation', 'education', 'referral', 'other')),
  CONSTRAINT valid_duration CHECK (duration_minutes IS NULL OR (duration_minutes > 0 AND duration_minutes <= 480)),
  CONSTRAINT end_after_start CHECK (end_time IS NULL OR end_time > start_time)
);

-- =====================================================
-- PCM LAB ORDERS
-- Lab order management integrated with PCM workflow
-- =====================================================
CREATE TABLE IF NOT EXISTS pcm_lab_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES pcm_enrollments(id) ON DELETE CASCADE,
  ordered_by UUID REFERENCES medical_staff(id) NOT NULL,
  ordered_by_name VARCHAR(255) NOT NULL,

  -- Order Details
  order_date TIMESTAMPTZ DEFAULT NOW(),
  due_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, scheduled, in_progress, completed, cancelled

  -- Tests Requested
  tests_requested JSONB NOT NULL, -- ["Hemoglobin A1C", "Lipid Panel", "CMP"]
  panel_type VARCHAR(100), -- diabetes_quarterly, diabetes_annual, cardiac_panel, etc
  panel_description TEXT,

  -- Priority & Urgency
  priority VARCHAR(20) DEFAULT 'routine', -- routine, urgent, stat
  urgency_level INT DEFAULT 50, -- 0-100 calculated score
  urgency_reason TEXT,

  -- Order Source
  order_source VARCHAR(50) DEFAULT 'manual', -- manual, ai_extraction, protocol, scheduled
  order_text TEXT, -- Original dictation text if AI-extracted
  extraction_confidence DECIMAL(3,2), -- 0-1 for AI orders
  requires_verification BOOLEAN DEFAULT FALSE,
  verified BOOLEAN DEFAULT FALSE,
  verified_by UUID REFERENCES medical_staff(id),
  verified_at TIMESTAMPTZ,

  -- Results
  results_received BOOLEAN DEFAULT FALSE,
  results_date DATE,
  results_data JSONB DEFAULT '[]'::jsonb, -- [{test: 'A1C', value: 8.2, unit: '%', range: '<7.0', abnormal: true}]
  abnormal_flags JSONB DEFAULT '[]'::jsonb, -- ['A1C', 'LDL']
  critical_flags JSONB DEFAULT '[]'::jsonb, -- ['eGFR'] if critically abnormal

  -- Provider Review
  reviewed BOOLEAN DEFAULT FALSE,
  reviewed_by UUID REFERENCES medical_staff(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  -- Clinical Actions
  action_required BOOLEAN DEFAULT FALSE,
  action_taken TEXT,
  action_plan JSONB, -- Structured action plan
  follow_up_needed BOOLEAN DEFAULT FALSE,
  follow_up_date DATE,

  -- External Integration
  external_order_id VARCHAR(100),
  lab_vendor VARCHAR(100),
  tracking_number VARCHAR(100),

  -- Patient Instructions
  fasting_required BOOLEAN DEFAULT FALSE,
  special_instructions TEXT,
  patient_notified BOOLEAN DEFAULT FALSE,
  patient_notified_at TIMESTAMPTZ,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('pending', 'scheduled', 'in_progress', 'completed', 'cancelled')),
  CONSTRAINT valid_priority CHECK (priority IN ('routine', 'urgent', 'stat')),
  CONSTRAINT valid_order_source CHECK (order_source IN ('manual', 'ai_extraction', 'protocol', 'scheduled', 'standing_order'))
);

-- =====================================================
-- PCM GOALS & MILESTONES
-- Track patient progress toward health goals
-- =====================================================
CREATE TABLE IF NOT EXISTS pcm_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES pcm_enrollments(id) ON DELETE CASCADE,

  -- Goal Details
  goal_type VARCHAR(50) NOT NULL, -- a1c, weight, bp, medication_adherence, exercise, nutrition
  goal_title VARCHAR(255) NOT NULL,
  goal_description TEXT,

  -- Target Values
  baseline_value DECIMAL(10,2),
  baseline_unit VARCHAR(20),
  target_value DECIMAL(10,2) NOT NULL,
  target_unit VARCHAR(20) NOT NULL,
  current_value DECIMAL(10,2),

  -- Timeline
  start_date DATE DEFAULT CURRENT_DATE,
  target_date DATE NOT NULL,
  achieved_date DATE,

  -- Progress Tracking
  status VARCHAR(20) DEFAULT 'active', -- active, achieved, not_achieved, modified, cancelled
  progress_pct INT DEFAULT 0, -- 0-100

  -- Milestones
  milestones JSONB DEFAULT '[]'::jsonb, -- [{date, value, notes}]

  -- Support & Barriers
  support_strategies JSONB DEFAULT '[]'::jsonb,
  barriers_identified JSONB DEFAULT '[]'::jsonb,

  -- Metadata
  created_by UUID REFERENCES medical_staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_goal_type CHECK (goal_type IN ('a1c', 'weight', 'bp_systolic', 'bp_diastolic', 'medication_adherence', 'exercise', 'nutrition', 'blood_sugar', 'other')),
  CONSTRAINT valid_status CHECK (status IN ('active', 'achieved', 'not_achieved', 'modified', 'cancelled')),
  CONSTRAINT valid_progress CHECK (progress_pct >= 0 AND progress_pct <= 100)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- PCM Enrollments
CREATE INDEX IF NOT EXISTS idx_pcm_enrollments_patient ON pcm_enrollments(patient_id);
CREATE INDEX IF NOT EXISTS idx_pcm_enrollments_active ON pcm_enrollments(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_pcm_enrollments_risk ON pcm_enrollments(risk_level);
CREATE INDEX IF NOT EXISTS idx_pcm_enrollments_next_contact ON pcm_enrollments(next_contact_due) WHERE is_active = TRUE AND next_contact_due IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pcm_enrollments_enrolled_by ON pcm_enrollments(enrolled_by);

-- PCM Contacts
CREATE INDEX IF NOT EXISTS idx_pcm_contacts_patient ON pcm_contacts(patient_id);
CREATE INDEX IF NOT EXISTS idx_pcm_contacts_enrollment ON pcm_contacts(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_pcm_contacts_staff ON pcm_contacts(staff_id);
CREATE INDEX IF NOT EXISTS idx_pcm_contacts_date ON pcm_contacts(contact_date DESC);
CREATE INDEX IF NOT EXISTS idx_pcm_contacts_billable ON pcm_contacts(billable, billed) WHERE billable = TRUE AND billed = FALSE;
CREATE INDEX IF NOT EXISTS idx_pcm_contacts_follow_up ON pcm_contacts(follow_up_needed, follow_up_date) WHERE follow_up_needed = TRUE;

-- PCM Vitals
CREATE INDEX IF NOT EXISTS idx_pcm_vitals_patient ON pcm_vitals(patient_id);
CREATE INDEX IF NOT EXISTS idx_pcm_vitals_enrollment ON pcm_vitals(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_pcm_vitals_date ON pcm_vitals(reading_date DESC);
CREATE INDEX IF NOT EXISTS idx_pcm_vitals_abnormal ON pcm_vitals(is_abnormal) WHERE is_abnormal = TRUE;
CREATE INDEX IF NOT EXISTS idx_pcm_vitals_blood_sugar ON pcm_vitals(patient_id, reading_date DESC) WHERE blood_sugar IS NOT NULL;

-- PCM Tasks
CREATE INDEX IF NOT EXISTS idx_pcm_tasks_patient ON pcm_tasks(patient_id);
CREATE INDEX IF NOT EXISTS idx_pcm_tasks_enrollment ON pcm_tasks(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_pcm_tasks_assigned ON pcm_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_pcm_tasks_due ON pcm_tasks(due_date) WHERE NOT is_completed AND due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pcm_tasks_overdue ON pcm_tasks(is_overdue) WHERE is_overdue = TRUE;
CREATE INDEX IF NOT EXISTS idx_pcm_tasks_category ON pcm_tasks(category);
CREATE INDEX IF NOT EXISTS idx_pcm_tasks_priority ON pcm_tasks(priority, urgency_score DESC);

-- PCM Time Entries
CREATE INDEX IF NOT EXISTS idx_pcm_time_patient ON pcm_time_entries(patient_id);
CREATE INDEX IF NOT EXISTS idx_pcm_time_enrollment ON pcm_time_entries(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_pcm_time_staff ON pcm_time_entries(staff_id);
CREATE INDEX IF NOT EXISTS idx_pcm_time_month ON pcm_time_entries(billing_month);
CREATE INDEX IF NOT EXISTS idx_pcm_time_start ON pcm_time_entries(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_pcm_time_billable ON pcm_time_entries(billable, billed) WHERE billable = TRUE AND billed = FALSE;

-- PCM Lab Orders
CREATE INDEX IF NOT EXISTS idx_pcm_labs_patient ON pcm_lab_orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_pcm_labs_enrollment ON pcm_lab_orders(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_pcm_labs_ordered_by ON pcm_lab_orders(ordered_by);
CREATE INDEX IF NOT EXISTS idx_pcm_labs_status ON pcm_lab_orders(status);
CREATE INDEX IF NOT EXISTS idx_pcm_labs_due ON pcm_lab_orders(due_date) WHERE status IN ('pending', 'scheduled');
CREATE INDEX IF NOT EXISTS idx_pcm_labs_priority ON pcm_lab_orders(priority, urgency_level DESC);
CREATE INDEX IF NOT EXISTS idx_pcm_labs_review ON pcm_lab_orders(reviewed) WHERE NOT reviewed;
CREATE INDEX IF NOT EXISTS idx_pcm_labs_abnormal ON pcm_lab_orders(patient_id) WHERE jsonb_array_length(abnormal_flags) > 0;
CREATE INDEX IF NOT EXISTS idx_pcm_labs_verification ON pcm_lab_orders(requires_verification, verified) WHERE requires_verification = TRUE AND verified = FALSE;

-- PCM Goals
CREATE INDEX IF NOT EXISTS idx_pcm_goals_patient ON pcm_goals(patient_id);
CREATE INDEX IF NOT EXISTS idx_pcm_goals_enrollment ON pcm_goals(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_pcm_goals_status ON pcm_goals(status);
CREATE INDEX IF NOT EXISTS idx_pcm_goals_type ON pcm_goals(goal_type);
CREATE INDEX IF NOT EXISTS idx_pcm_goals_target_date ON pcm_goals(target_date) WHERE status = 'active';

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE pcm_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pcm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pcm_vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE pcm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE pcm_time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE pcm_lab_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE pcm_goals ENABLE ROW LEVEL SECURITY;

-- Staff can access all PCM data
CREATE POLICY "Staff can access all PCM enrollments"
  ON pcm_enrollments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM medical_staff
      WHERE medical_staff.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can access all PCM contacts"
  ON pcm_contacts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM medical_staff
      WHERE medical_staff.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can access all PCM vitals"
  ON pcm_vitals FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM medical_staff
      WHERE medical_staff.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can access all PCM tasks"
  ON pcm_tasks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM medical_staff
      WHERE medical_staff.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can access all PCM time entries"
  ON pcm_time_entries FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM medical_staff
      WHERE medical_staff.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can access all PCM lab orders"
  ON pcm_lab_orders FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM medical_staff
      WHERE medical_staff.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can access all PCM goals"
  ON pcm_goals FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM medical_staff
      WHERE medical_staff.auth_user_id = auth.uid()
    )
  );

-- Patients can view their own PCM data
CREATE POLICY "Patients can view their own enrollment"
  ON pcm_enrollments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM patients
      WHERE patients.id = pcm_enrollments.patient_id
      AND patients.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Patients can view their own vitals"
  ON pcm_vitals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM patients
      WHERE patients.id = pcm_vitals.patient_id
      AND patients.auth_user_id = auth.uid()
    )
  );

-- Patients can insert their own vitals
CREATE POLICY "Patients can insert their own vitals"
  ON pcm_vitals FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM patients
      WHERE patients.id = pcm_vitals.patient_id
      AND patients.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Patients can view their own tasks"
  ON pcm_tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM patients
      WHERE patients.id = pcm_tasks.patient_id
      AND patients.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Patients can view their own goals"
  ON pcm_goals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM patients
      WHERE patients.id = pcm_goals.patient_id
      AND patients.auth_user_id = auth.uid()
    )
  );

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to calculate risk score automatically
CREATE OR REPLACE FUNCTION calculate_pcm_risk_score(enrollment_id UUID)
RETURNS DECIMAL(5,2) AS $$
DECLARE
  score DECIMAL(5,2) := 0;
  enrollment RECORD;
BEGIN
  SELECT * INTO enrollment FROM pcm_enrollments WHERE id = enrollment_id;

  -- A1C control (max 30 points)
  IF enrollment.current_a1c IS NOT NULL AND enrollment.target_a1c IS NOT NULL THEN
    IF enrollment.current_a1c > enrollment.target_a1c + 3 THEN
      score := score + 30;
    ELSIF enrollment.current_a1c > enrollment.target_a1c + 1.5 THEN
      score := score + 20;
    ELSIF enrollment.current_a1c > enrollment.target_a1c THEN
      score := score + 10;
    END IF;
  END IF;

  -- Medication adherence (max 25 points)
  IF enrollment.medication_adherence_pct < 50 THEN
    score := score + 25;
  ELSIF enrollment.medication_adherence_pct < 70 THEN
    score := score + 15;
  ELSIF enrollment.medication_adherence_pct < 85 THEN
    score := score + 5;
  END IF;

  -- Missed appointments (max 20 points)
  IF enrollment.missed_appointments > 3 THEN
    score := score + 20;
  ELSIF enrollment.missed_appointments > 1 THEN
    score := score + 10;
  ELSIF enrollment.missed_appointments > 0 THEN
    score := score + 5;
  END IF;

  -- Overdue contact (max 15 points)
  IF enrollment.next_contact_due IS NOT NULL AND enrollment.next_contact_due < CURRENT_DATE THEN
    score := score + (LEAST(CURRENT_DATE - enrollment.next_contact_due, 30) * 0.5);
  END IF;

  -- Comorbidities (max 10 points)
  score := score + (LEAST(jsonb_array_length(enrollment.comorbidities), 5) * 2);

  RETURN LEAST(score, 100); -- Cap at 100
END;
$$ LANGUAGE plpgsql;

-- Function to update risk level based on score
CREATE OR REPLACE FUNCTION update_pcm_risk_level()
RETURNS TRIGGER AS $$
DECLARE
  new_risk_level VARCHAR(20);
BEGIN
  -- Calculate risk score
  NEW.risk_score := calculate_pcm_risk_score(NEW.id);

  -- Set risk level based on score
  IF NEW.risk_score >= 70 THEN
    new_risk_level := 'high';
  ELSIF NEW.risk_score >= 40 THEN
    new_risk_level := 'medium';
  ELSE
    new_risk_level := 'low';
  END IF;

  -- Only update if changed
  IF NEW.risk_level != new_risk_level THEN
    NEW.risk_level := new_risk_level;
    NEW.updated_at := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update risk level on enrollment changes
CREATE TRIGGER trg_update_risk_level
  BEFORE INSERT OR UPDATE ON pcm_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION update_pcm_risk_level();

-- Function to auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER trg_pcm_enrollments_updated_at
  BEFORE UPDATE ON pcm_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_pcm_contacts_updated_at
  BEFORE UPDATE ON pcm_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_pcm_tasks_updated_at
  BEFORE UPDATE ON pcm_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_pcm_lab_orders_updated_at
  BEFORE UPDATE ON pcm_lab_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_pcm_goals_updated_at
  BEFORE UPDATE ON pcm_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to update is_overdue status
CREATE OR REPLACE FUNCTION update_task_overdue_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Update is_overdue based on current date
  NEW.is_overdue := (
    NOT NEW.is_completed
    AND NEW.due_date IS NOT NULL
    AND NEW.due_date < CURRENT_DATE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update overdue status
CREATE TRIGGER trg_pcm_tasks_overdue
  BEFORE INSERT OR UPDATE ON pcm_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_task_overdue_status();

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Add comment to track migration
COMMENT ON TABLE pcm_enrollments IS 'PCM patient enrollments - migrated from localStorage 2025-01-26';
COMMENT ON TABLE pcm_contacts IS 'PCM staff contact log - migrated from localStorage 2025-01-26';
COMMENT ON TABLE pcm_vitals IS 'PCM patient vital signs tracking - migrated from localStorage 2025-01-26';
COMMENT ON TABLE pcm_tasks IS 'PCM patient tasks and action items - migrated from localStorage 2025-01-26';
COMMENT ON TABLE pcm_time_entries IS 'PCM staff time tracking for billing - migrated from localStorage 2025-01-26';
COMMENT ON TABLE pcm_lab_orders IS 'PCM lab order management - migrated from localStorage 2025-01-26';
COMMENT ON TABLE pcm_goals IS 'PCM patient goals and milestones - new feature 2025-01-26';
