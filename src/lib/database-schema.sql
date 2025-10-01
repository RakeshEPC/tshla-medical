-- TSHLA Medical Database Schema
-- HIPAA-Compliant Medical Records System

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Doctors table
CREATE TABLE IF NOT EXISTS doctors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  specialty VARCHAR(100),
  verification_code VARCHAR(50) UNIQUE,
  license_number VARCHAR(100),
  npi_number VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Patients table (PHI - needs encryption)
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mrn VARCHAR(50) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE NOT NULL,
  gender VARCHAR(20),
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  insurance_provider VARCHAR(100),
  insurance_id VARCHAR(100),
  emergency_contact JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Visits table
CREATE TABLE IF NOT EXISTS visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL,
  visit_date TIMESTAMPTZ DEFAULT NOW(),
  chief_complaint TEXT,
  visit_type VARCHAR(50) DEFAULT 'office',
  notes TEXT,
  diagnosis JSONB,
  medications JSONB,
  vitals JSONB,
  lab_results JSONB,
  processed_note TEXT,
  template_used VARCHAR(100),
  transcription_method VARCHAR(50),
  icd10_codes TEXT[],
  cpt_codes TEXT[],
  follow_up_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Templates table
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  specialty VARCHAR(100),
  template_type VARCHAR(50),
  sections JSONB NOT NULL,
  macros JSONB,
  quick_phrases TEXT[],
  is_system_template BOOLEAN DEFAULT false,
  is_shared BOOLEAN DEFAULT false,
  created_by UUID REFERENCES doctors(id) ON DELETE SET NULL,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dictations table
CREATE TABLE IF NOT EXISTS dictations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  visit_id UUID REFERENCES visits(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  transcript TEXT,
  processed_note TEXT,
  audio_url TEXT,
  duration INTEGER,
  transcription_confidence DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs table (HIPAA requirement)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  user_type VARCHAR(20),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  phi_accessed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mental health screenings
CREATE TABLE IF NOT EXISTS mental_health_screenings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES visits(id) ON DELETE CASCADE,
  screening_type VARCHAR(20), -- PHQ-9, GAD-7, etc.
  score INTEGER,
  severity VARCHAR(20),
  responses JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prior authorizations
CREATE TABLE IF NOT EXISTS prior_authorizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL,
  medication_name VARCHAR(255),
  diagnosis_codes TEXT[],
  status VARCHAR(50) DEFAULT 'pending',
  submitted_date DATE,
  approval_date DATE,
  denial_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_patients_mrn ON patients(mrn);
CREATE INDEX IF NOT EXISTS idx_visits_patient_id ON visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_doctor_id ON visits(doctor_id);
CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_dictations_visit_id ON dictations(visit_id);

-- Row Level Security (RLS) Policies
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE dictations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mental_health_screenings ENABLE ROW LEVEL SECURITY;
ALTER TABLE prior_authorizations ENABLE ROW LEVEL SECURITY;

-- Doctors can see all patients
CREATE POLICY "Doctors can view all patients" ON patients
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM doctors)
  );

-- Doctors can view all visits
CREATE POLICY "Doctors can view all visits" ON visits
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM doctors)
  );

-- Doctors can create visits
CREATE POLICY "Doctors can create visits" ON visits
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT id FROM doctors)
  );

-- Doctors can update their own visits
CREATE POLICY "Doctors can update their visits" ON visits
  FOR UPDATE USING (
    doctor_id = auth.uid()
  );

-- Patients can view their own data
CREATE POLICY "Patients can view own data" ON patients
  FOR SELECT USING (
    id = auth.uid()
  );

-- Patients can view their own visits
CREATE POLICY "Patients can view own visits" ON visits
  FOR SELECT USING (
    patient_id = auth.uid()
  );

-- Audit logs are insert-only, no one can update or delete
CREATE POLICY "Audit logs are insert only" ON audit_logs
  FOR INSERT WITH CHECK (true);

-- Create functions for updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_doctors_updated_at BEFORE UPDATE ON doctors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_visits_updated_at BEFORE UPDATE ON visits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prior_authorizations_updated_at BEFORE UPDATE ON prior_authorizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default data
-- Insert verification codes for quick login
INSERT INTO doctors (email, password_hash, name, specialty, verification_code) VALUES
  ('musk@tshla.ai', crypt('password123', gen_salt('bf')), 'Dr. Elon Musk', 'Internal Medicine', 'musk'),
  ('rakesh@tshla.ai', crypt('password123', gen_salt('bf')), 'Dr. Rakesh Patel', 'Cardiology', 'rakesh'),
  ('jarvis@tshla.ai', crypt('password123', gen_salt('bf')), 'Dr. Jarvis', 'Neurology', 'jarvis')
ON CONFLICT (email) DO NOTHING;

-- Insert sample patients
INSERT INTO patients (mrn, first_name, last_name, date_of_birth, gender) VALUES
  ('MRN444444', 'John', 'Smith', '1985-03-15', 'Male'),
  ('MRN111111', 'Sarah', 'Johnson', '1990-07-22', 'Female'),
  ('MRN222222', 'Michael', 'Chen', '1978-11-30', 'Male')
ON CONFLICT (mrn) DO NOTHING;

-- Insert system templates
INSERT INTO templates (name, specialty, template_type, sections, is_system_template) VALUES
  ('General SOAP Note', 'General', 'soap', 
   '{"subjective": "Patient reports...", "objective": "Vital signs...", "assessment": "Diagnosis...", "plan": "Treatment plan..."}'::jsonb,
   true),
  ('Cardiology Consult', 'Cardiology', 'consultation',
   '{"chief_complaint": "", "hpi": "", "pmh": "", "medications": "", "exam": "", "assessment": "", "plan": ""}'::jsonb,
   true),
  ('Diabetes Follow-up', 'Endocrinology', 'followup',
   '{"glucose_control": "", "medications": "", "complications": "", "plan": ""}'::jsonb,
   true)
ON CONFLICT DO NOTHING;