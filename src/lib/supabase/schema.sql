-- HIPAA Compliant Database Schema for Pre-Visit Data
-- Enable Row Level Security on all tables

-- Patients table (core patient data)
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id VARCHAR(20) UNIQUE NOT NULL, -- pt-xxxxxx format
  ava_id VARCHAR(20) UNIQUE NOT NULL, -- AVA-xxx-xxx format
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  date_of_birth DATE,
  gender VARCHAR(10),
  email VARCHAR(255),
  phone VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  encrypted_data JSONB -- For sensitive data that needs extra encryption
);

-- Pre-visit questionnaires table
CREATE TABLE IF NOT EXISTS previsit_questionnaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id VARCHAR(20) REFERENCES patients(patient_id) ON DELETE CASCADE,
  visit_date DATE NOT NULL,
  questionnaire_type VARCHAR(50) NOT NULL, -- PHQ9, GAD7, etc.
  responses JSONB NOT NULL, -- Store all answers
  score INTEGER,
  severity VARCHAR(50),
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Composite key to prevent duplicate submissions
  UNIQUE(patient_id, visit_date, questionnaire_type)
);

-- Pre-visit data collection table
CREATE TABLE IF NOT EXISTS previsit_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id VARCHAR(20) REFERENCES patients(patient_id) ON DELETE CASCADE,
  visit_date DATE NOT NULL,
  provider_id VARCHAR(50),
  
  -- Chief complaints and symptoms
  chief_complaints TEXT[],
  symptom_duration VARCHAR(100),
  symptom_severity INTEGER CHECK (symptom_severity BETWEEN 1 AND 10),
  
  -- Medication updates (simplified for now)
  medication_changes JSONB,
  allergies_updated JSONB,
  
  -- Lab requests
  lab_requests TEXT[],
  
  -- Vitals if self-reported
  self_reported_vitals JSONB,
  
  -- Documents and uploads
  uploaded_documents JSONB,
  
  -- Meta information
  completion_status VARCHAR(20) DEFAULT 'in_progress', -- in_progress, completed, partial
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  
  -- Real-time sync flag
  sync_status VARCHAR(20) DEFAULT 'pending', -- pending, synced, error
  synced_to_ehr BOOLEAN DEFAULT false,
  
  UNIQUE(patient_id, visit_date)
);

-- Visit notes table (integrated with pre-visit data)
CREATE TABLE IF NOT EXISTS visit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id VARCHAR(20) REFERENCES patients(patient_id) ON DELETE CASCADE,
  visit_date DATE NOT NULL,
  provider_id VARCHAR(50) NOT NULL,
  
  -- Pre-populated from history
  historical_context TEXT,
  
  -- Pre-visit data integration
  previsit_data_id UUID REFERENCES previsit_data(id),
  previsit_integrated BOOLEAN DEFAULT false,
  
  -- Dictation and notes
  raw_dictation TEXT,
  processed_soap JSONB,
  final_note TEXT,
  
  -- Status tracking
  status VARCHAR(20) DEFAULT 'draft', -- draft, in_progress, completed, signed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  signed_at TIMESTAMPTZ,
  
  UNIQUE(patient_id, visit_date, provider_id)
);

-- Real-time notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id VARCHAR(50) NOT NULL,
  sender_id VARCHAR(50),
  type VARCHAR(50) NOT NULL, -- previsit_completed, questionnaire_submitted, etc.
  title VARCHAR(255) NOT NULL,
  message TEXT,
  data JSONB,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- HIPAA Audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(50) NOT NULL,
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_previsit_patient_date ON previsit_data(patient_id, visit_date);
CREATE INDEX idx_questionnaires_patient_date ON previsit_questionnaires(patient_id, visit_date);
CREATE INDEX idx_visit_notes_patient_date ON visit_notes(patient_id, visit_date);
CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, read);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE previsit_questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE previsit_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies (adjust based on your auth system)
-- Example: Patients can only see their own data
CREATE POLICY "Patients can view own data" ON patients
  FOR SELECT USING (patient_id = current_setting('app.current_patient_id')::VARCHAR);

CREATE POLICY "Patients can view own previsit data" ON previsit_data
  FOR ALL USING (patient_id = current_setting('app.current_patient_id')::VARCHAR);

-- Providers can see all patient data (adjust as needed)
CREATE POLICY "Providers can view all patient data" ON patients
  FOR ALL USING (current_setting('app.current_role')::VARCHAR = 'provider');

CREATE POLICY "Providers can manage visit notes" ON visit_notes
  FOR ALL USING (current_setting('app.current_role')::VARCHAR = 'provider');

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_previsit_data_updated_at BEFORE UPDATE ON previsit_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_visit_notes_updated_at BEFORE UPDATE ON visit_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();