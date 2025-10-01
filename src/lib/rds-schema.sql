-- TSHLA Medical RDS Schema
-- HIPAA-Compliant MySQL Database

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS tshla_medical;
USE tshla_medical;

-- Doctors table
CREATE TABLE IF NOT EXISTS doctors (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  specialty VARCHAR(100),
  verification_code VARCHAR(50) UNIQUE,
  license_number VARCHAR(100),
  npi_number VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_verification_code (verification_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Patients table
CREATE TABLE IF NOT EXISTS patients (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
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
  emergency_contact JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_mrn (mrn),
  INDEX idx_last_name (last_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Visits table
CREATE TABLE IF NOT EXISTS visits (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  patient_id VARCHAR(36),
  doctor_id VARCHAR(36),
  visit_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  chief_complaint TEXT,
  visit_type VARCHAR(50) DEFAULT 'office',
  notes TEXT,
  diagnosis JSON,
  medications JSON,
  vitals JSON,
  lab_results JSON,
  processed_note TEXT,
  template_used VARCHAR(100),
  transcription_method VARCHAR(50),
  icd10_codes JSON,
  cpt_codes JSON,
  follow_up_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL,
  INDEX idx_patient_id (patient_id),
  INDEX idx_doctor_id (doctor_id),
  INDEX idx_visit_date (visit_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Templates table
CREATE TABLE IF NOT EXISTS templates (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  specialty VARCHAR(100),
  template_type VARCHAR(50),
  sections JSON NOT NULL,
  macros JSON,
  quick_phrases JSON,
  is_system_template BOOLEAN DEFAULT false,
  is_shared BOOLEAN DEFAULT false,
  created_by VARCHAR(36),
  usage_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES doctors(id) ON DELETE SET NULL,
  INDEX idx_name (name),
  INDEX idx_specialty (specialty)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dictations table
CREATE TABLE IF NOT EXISTS dictations (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  visit_id VARCHAR(36),
  doctor_id VARCHAR(36),
  patient_id VARCHAR(36),
  transcript TEXT,
  processed_note TEXT,
  audio_url TEXT,
  duration INT,
  transcription_confidence DECIMAL(3,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  INDEX idx_visit_id (visit_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Audit logs table (HIPAA requirement)
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36),
  user_type VARCHAR(20),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(36),
  details JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  phi_accessed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at),
  INDEX idx_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mental health screenings
CREATE TABLE IF NOT EXISTS mental_health_screenings (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  patient_id VARCHAR(36),
  visit_id VARCHAR(36),
  screening_type VARCHAR(20),
  score INT,
  severity VARCHAR(20),
  responses JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE,
  INDEX idx_patient_screening (patient_id, screening_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Prior authorizations
CREATE TABLE IF NOT EXISTS prior_authorizations (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  patient_id VARCHAR(36),
  doctor_id VARCHAR(36),
  medication_name VARCHAR(255),
  diagnosis_codes JSON,
  status VARCHAR(50) DEFAULT 'pending',
  submitted_date DATE,
  approval_date DATE,
  denial_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL,
  INDEX idx_status (status),
  INDEX idx_patient_auth (patient_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert test data
-- Note: Using SHA2 for password hashing in MySQL (in production use bcrypt on application side)

-- Insert doctors with verification codes
INSERT INTO doctors (id, email, password_hash, name, specialty, verification_code, license_number, npi_number) VALUES
  (UUID(), 'musk@tshla.ai', SHA2('password123', 256), 'Dr. Elon Musk', 'Internal Medicine', 'musk', 'CA123456', '1234567890'),
  (UUID(), 'elon@tshla.ai', SHA2('password123', 256), 'Dr. Elon Tesla', 'Cardiology', 'elon', 'CA123457', '1234567891'),
  (UUID(), 'model3@tshla.ai', SHA2('password123', 256), 'Dr. Model Three', 'Endocrinology', 'model3', 'CA123458', '1234567892'),
  (UUID(), 'models@tshla.ai', SHA2('password123', 256), 'Dr. Model S', 'Neurology', 'models', 'CA123459', '1234567893'),
  (UUID(), 'modelx@tshla.ai', SHA2('password123', 256), 'Dr. Model X', 'Psychiatry', 'modelx', 'CA123460', '1234567894'),
  (UUID(), 'modely@tshla.ai', SHA2('password123', 256), 'Dr. Model Y', 'Pediatrics', 'modely', 'CA123461', '1234567895'),
  (UUID(), 'rohan@tshla.ai', SHA2('password123', 256), 'Dr. Rohan Patel', 'Family Medicine', 'rohan', 'CA123462', '1234567896'),
  (UUID(), 'rakesh@tshla.ai', SHA2('password123', 256), 'Dr. Rakesh Patel', 'Cardiology', 'rakesh', 'CA123463', '1234567897'),
  (UUID(), 'epc@tshla.ai', SHA2('password123', 256), 'Dr. EPC', 'Emergency Medicine', 'epc', 'CA123464', '1234567898'),
  (UUID(), 'jyothi@tshla.ai', SHA2('password123', 256), 'Dr. Jyothi Patel', 'Obstetrics', 'jyothi', 'CA123465', '1234567899'),
  (UUID(), 'jarvis@tshla.ai', SHA2('password123', 256), 'Dr. Jarvis AI', 'Neurology', 'jarvis', 'CA123466', '1234567900'),
  (UUID(), 'arya@tshla.ai', SHA2('password123', 256), 'Dr. Arya Stark', 'Surgery', 'arya', 'CA123467', '1234567901')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Insert test patients (111-111 through 999-999)
INSERT INTO patients (id, mrn, first_name, last_name, date_of_birth, gender, email, phone, insurance_provider, insurance_id) VALUES
  (UUID(), 'MRN111111', 'Sarah', 'Johnson', '1990-07-22', 'Female', 'sarah.johnson@email.com', '555-111-1111', 'Blue Cross', 'BC111111'),
  (UUID(), 'MRN222222', 'Michael', 'Chen', '1978-11-30', 'Male', 'michael.chen@email.com', '555-222-2222', 'Aetna', 'AE222222'),
  (UUID(), 'MRN333333', 'Emily', 'Rodriguez', '1985-03-15', 'Female', 'emily.rodriguez@email.com', '555-333-3333', 'Kaiser', 'KP333333'),
  (UUID(), 'MRN444444', 'John', 'Smith', '1985-03-15', 'Male', 'john.smith@email.com', '555-444-4444', 'UnitedHealth', 'UH444444'),
  (UUID(), 'MRN555555', 'Jessica', 'Brown', '1992-05-20', 'Female', 'jessica.brown@email.com', '555-555-5555', 'Cigna', 'CI555555'),
  (UUID(), 'MRN666666', 'Robert', 'Taylor', '1975-09-10', 'Male', 'robert.taylor@email.com', '555-666-6666', 'Anthem', 'AN666666'),
  (UUID(), 'MRN777777', 'Maria', 'Garcia', '1988-12-05', 'Female', 'maria.garcia@email.com', '555-777-7777', 'Humana', 'HU777777'),
  (UUID(), 'MRN888888', 'James', 'Wilson', '1980-04-18', 'Male', 'james.wilson@email.com', '555-888-8888', 'Molina', 'MO888888'),
  (UUID(), 'MRN999999', 'Linda', 'Martinez', '1995-01-25', 'Female', 'linda.martinez@email.com', '555-999-9999', 'Oscar Health', 'OH999999')
ON DUPLICATE KEY UPDATE first_name = VALUES(first_name);

-- Insert system templates
INSERT INTO templates (id, name, specialty, template_type, sections, is_system_template) VALUES
  (UUID(), 'General SOAP Note', 'General', 'soap', 
   '{"subjective": "Patient reports...", "objective": "Vital signs...", "assessment": "Diagnosis...", "plan": "Treatment plan..."}',
   true),
  (UUID(), 'Cardiology Consult', 'Cardiology', 'consultation',
   '{"chief_complaint": "", "hpi": "", "pmh": "", "medications": "", "exam": "", "assessment": "", "plan": ""}',
   true),
  (UUID(), 'Diabetes Follow-up', 'Endocrinology', 'followup',
   '{"glucose_control": "", "medications": "", "complications": "", "plan": ""}',
   true),
  (UUID(), 'Depression Assessment', 'Psychiatry', 'mental_health',
   '{"mood": "", "functional_impact": "", "risk_assessment": "", "medications": "", "therapy": "", "plan": ""}',
   true)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Grant permissions (if needed)
-- GRANT ALL PRIVILEGES ON tshla_medical.* TO 'admin'@'%';
-- FLUSH PRIVILEGES;