-- =====================================================
-- TSHLA Medical - Unified Master Schema
-- Single source of truth for all database tables
-- =====================================================
-- Created: 2025-10-08
-- Purpose: Consolidate 6+ schema files into one
-- =====================================================

-- =====================================================
-- CORE USER TABLES
-- =====================================================

-- Medical Staff (doctors, nurses, admin)
CREATE TABLE IF NOT EXISTS medical_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role VARCHAR(50) DEFAULT 'doctor', -- doctor, nurse, admin, staff
  specialty VARCHAR(100),
  npi VARCHAR(10),
  license_number VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Patients (unified - includes EMR + PumpDrive users)
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Core patient info
  patient_id VARCHAR(20) UNIQUE, -- pt-xxxxxx format
  ava_id VARCHAR(20) UNIQUE, -- AVA-xxx-xxx format for portal
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  date_of_birth DATE,
  gender VARCHAR(10),
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,

  -- Insurance
  insurance_provider VARCHAR(100),
  insurance_id VARCHAR(100),

  -- PumpDrive fields
  pumpdrive_enabled BOOLEAN DEFAULT TRUE,
  pumpdrive_signup_date TIMESTAMPTZ DEFAULT NOW(),
  pumpdrive_last_assessment TIMESTAMPTZ,
  assessments_completed INTEGER DEFAULT 0,
  subscription_tier VARCHAR(50) DEFAULT 'free',
  trial_end_date TIMESTAMPTZ,

  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- VISIT & DOCUMENTATION TABLES
-- =====================================================

-- Unified visits table (replaces patient_charts, visit_notes, previsit_data)
CREATE TABLE IF NOT EXISTS visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES medical_staff(id),

  -- Visit info
  visit_date DATE NOT NULL,
  visit_type VARCHAR(50), -- follow_up, new_patient, urgent, annual, telehealth
  chief_complaint TEXT,

  -- Pre-visit data (from patient portal)
  previsit_data JSONB, -- symptoms, medication changes, questions
  previsit_questionnaires JSONB, -- PHQ9, GAD7 scores
  previsit_completed BOOLEAN DEFAULT false,

  -- Visit documentation
  raw_dictation TEXT,
  processed_soap JSONB, -- {subjective, objective, assessment, plan}
  final_note TEXT,

  -- Clinical data
  diagnosis JSONB, -- [{code, description}]
  medications JSONB, -- [{name, dosage, frequency}]
  vitals JSONB, -- {bp, hr, temp, weight, bmi}
  lab_results JSONB,

  -- Templates
  template_used UUID,

  -- Status tracking
  status VARCHAR(20) DEFAULT 'draft', -- draft, in_progress, completed, signed
  signed_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(patient_id, visit_date, doctor_id)
);

-- =====================================================
-- PATIENT SERVICE REQUESTS (unified)
-- =====================================================

-- Unified service requests (replaces refill_requests + lab_order_requests)
CREATE TABLE IF NOT EXISTS patient_service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES medical_staff(id),

  -- Request type
  request_type VARCHAR(50) NOT NULL, -- refill, lab_order, imaging, referral

  -- Common fields
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, denied, completed
  urgent BOOLEAN DEFAULT false,
  notes TEXT,

  -- Type-specific data (stored as JSONB for flexibility)
  request_data JSONB NOT NULL,
  -- For refills: {medication, dosage, pharmacy, last_filled_date}
  -- For labs: {tests[], preferred_date, fasting_required}
  -- For imaging: {type, body_part, reason}

  -- Processing
  processed_by UUID REFERENCES medical_staff(id),
  processed_at TIMESTAMPTZ,
  denial_reason TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- APPOINTMENTS & SCHEDULING
-- =====================================================

CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES medical_staff(id),

  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  appointment_type VARCHAR(50), -- in_person, telehealth, follow_up
  status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, confirmed, completed, cancelled, no_show

  notes TEXT,
  reminder_sent BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PUMPDRIVE TABLES
-- =====================================================

-- Pump assessments (updated to use patient_id)
CREATE TABLE IF NOT EXISTS pump_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,

  -- Assessment data
  assessment_data JSONB NOT NULL,
  scores JSONB, -- AI scoring results
  recommendations JSONB, -- Top pump recommendations

  -- Metadata
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pump comparison data
CREATE TABLE IF NOT EXISTS pump_comparison_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pump_name VARCHAR(255) NOT NULL,
  manufacturer VARCHAR(255),

  -- Feature scores
  features JSONB NOT NULL,

  -- Metadata
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,

  UNIQUE(pump_name)
);

-- Pump dimensions (for scoring)
CREATE TABLE IF NOT EXISTS pump_dimensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dimension_key VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  weight DECIMAL(3,2) DEFAULT 1.0,
  is_active BOOLEAN DEFAULT true
);

-- =====================================================
-- TEMPLATES
-- =====================================================

CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID REFERENCES medical_staff(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  specialty VARCHAR(100),
  template_type VARCHAR(50), -- soap, progress, consultation, procedure

  is_shared BOOLEAN DEFAULT false,
  is_system_template BOOLEAN DEFAULT false,

  sections JSONB NOT NULL,
  macros JSONB DEFAULT '{}'::jsonb,
  quick_phrases JSONB DEFAULT '[]'::jsonb,

  usage_count INTEGER DEFAULT 0,
  last_used TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- AUDIT & COMPLIANCE (HIPAA)
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID, -- Can be staff or patient
  user_type VARCHAR(20), -- staff, patient, system

  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,

  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  phi_accessed BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL,
  recipient_type VARCHAR(20), -- staff, patient

  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  data JSONB,

  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Medical Staff
CREATE INDEX IF NOT EXISTS idx_staff_auth_user ON medical_staff(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_staff_email ON medical_staff(email);
CREATE INDEX IF NOT EXISTS idx_staff_active ON medical_staff(is_active) WHERE is_active = true;

-- Patients
CREATE INDEX IF NOT EXISTS idx_patients_auth_user ON patients(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_patients_email ON patients(email);
CREATE INDEX IF NOT EXISTS idx_patients_patient_id ON patients(patient_id);
CREATE INDEX IF NOT EXISTS idx_patients_pumpdrive ON patients(pumpdrive_enabled) WHERE pumpdrive_enabled = true;

-- Visits
CREATE INDEX IF NOT EXISTS idx_visits_patient ON visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_doctor ON visits(doctor_id);
CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_visits_patient_date ON visits(patient_id, visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_visits_status ON visits(status);

-- Service Requests
CREATE INDEX IF NOT EXISTS idx_service_requests_patient ON patient_service_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON patient_service_requests(status);
CREATE INDEX IF NOT EXISTS idx_service_requests_type ON patient_service_requests(request_type);

-- Appointments
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON appointments(start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- Pump Assessments
CREATE INDEX IF NOT EXISTS idx_pump_assessments_patient ON pump_assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_pump_assessments_created ON pump_assessments(created_at DESC);

-- Audit Logs
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, read);

-- =====================================================
-- TRIGGERS FOR AUTO-UPDATE
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_medical_staff_updated_at
  BEFORE UPDATE ON medical_staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_visits_updated_at
  BEFORE UPDATE ON visits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_requests_updated_at
  BEFORE UPDATE ON patient_service_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at
  BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

ALTER TABLE medical_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pump_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Staff can view their own profile
CREATE POLICY "Staff can view own profile" ON medical_staff
  FOR SELECT USING (auth_user_id = auth.uid());

CREATE POLICY "Staff can update own profile" ON medical_staff
  FOR UPDATE USING (auth_user_id = auth.uid());

-- Patients can view own profile
CREATE POLICY "Patients can view own profile" ON patients
  FOR SELECT USING (auth_user_id = auth.uid());

CREATE POLICY "Patients can update own profile" ON patients
  FOR UPDATE USING (auth_user_id = auth.uid());

-- Staff can view all patients
CREATE POLICY "Staff can view all patients" ON patients
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM medical_staff
      WHERE auth_user_id = auth.uid() AND is_active = true
    )
  );

-- Patients can view own visits
CREATE POLICY "Patients can view own visits" ON visits
  FOR SELECT USING (
    patient_id IN (
      SELECT id FROM patients WHERE auth_user_id = auth.uid()
    )
  );

-- Staff can view all visits
CREATE POLICY "Staff can view all visits" ON visits
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM medical_staff
      WHERE auth_user_id = auth.uid() AND is_active = true
    )
  );

-- Patients can view own service requests
CREATE POLICY "Patients can view own service requests" ON patient_service_requests
  FOR SELECT USING (
    patient_id IN (
      SELECT id FROM patients WHERE auth_user_id = auth.uid()
    )
  );

-- Patients can create service requests
CREATE POLICY "Patients can create service requests" ON patient_service_requests
  FOR INSERT WITH CHECK (
    patient_id IN (
      SELECT id FROM patients WHERE auth_user_id = auth.uid()
    )
  );

-- Staff can manage service requests
CREATE POLICY "Staff can manage service requests" ON patient_service_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM medical_staff
      WHERE auth_user_id = auth.uid() AND is_active = true
    )
  );

-- Patients can view own pump assessments
CREATE POLICY "Patients can view own pump assessments" ON pump_assessments
  FOR SELECT USING (
    patient_id IN (
      SELECT id FROM patients WHERE auth_user_id = auth.uid()
    )
  );

-- Patients can create pump assessments
CREATE POLICY "Patients can create pump assessments" ON pump_assessments
  FOR INSERT WITH CHECK (
    patient_id IN (
      SELECT id FROM patients WHERE auth_user_id = auth.uid()
    )
  );

-- Staff can view all assessments
CREATE POLICY "Staff can view all assessments" ON pump_assessments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM medical_staff
      WHERE auth_user_id = auth.uid() AND is_active = true
    )
  );

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE medical_staff IS 'Doctors, nurses, admin staff - all providers';
COMMENT ON TABLE patients IS 'Unified patient table - includes both EMR and PumpDrive users';
COMMENT ON TABLE visits IS 'Unified visit documentation - replaces patient_charts, visit_notes, previsit_data';
COMMENT ON TABLE patient_service_requests IS 'Unified service requests - refills, labs, imaging, referrals';
COMMENT ON TABLE pump_assessments IS 'PumpDrive assessment results and recommendations';

COMMENT ON COLUMN patients.pumpdrive_enabled IS 'Whether patient has access to PumpDrive assessments';
COMMENT ON COLUMN patients.assessments_completed IS 'Total number of pump assessments completed';
COMMENT ON COLUMN visits.previsit_data IS 'Patient-submitted data before visit';
COMMENT ON COLUMN visits.processed_soap IS 'AI-processed SOAP note from dictation';
