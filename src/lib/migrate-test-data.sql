-- TSHLA Medical - Test Data Migration
-- This script migrates all test patients and doctors to Supabase

-- Clear existing test data (optional)
-- DELETE FROM visits WHERE patient_id IN (SELECT id FROM patients WHERE mrn LIKE 'MRN%');
-- DELETE FROM patients WHERE mrn LIKE 'MRN%';
-- DELETE FROM doctors WHERE email LIKE '%@tshla.ai';

-- Insert Doctors (with proper password hashing)
INSERT INTO doctors (email, password_hash, name, specialty, verification_code, license_number, npi_number) VALUES
  ('musk@tshla.ai', crypt('password123', gen_salt('bf')), 'Dr. Elon Musk', 'Internal Medicine', 'musk', 'CA123456', '1234567890'),
  ('elon@tshla.ai', crypt('password123', gen_salt('bf')), 'Dr. Elon Tesla', 'Cardiology', 'elon', 'CA123457', '1234567891'),
  ('model3@tshla.ai', crypt('password123', gen_salt('bf')), 'Dr. Model Three', 'Endocrinology', 'model3', 'CA123458', '1234567892'),
  ('models@tshla.ai', crypt('password123', gen_salt('bf')), 'Dr. Model S', 'Neurology', 'models', 'CA123459', '1234567893'),
  ('modelx@tshla.ai', crypt('password123', gen_salt('bf')), 'Dr. Model X', 'Psychiatry', 'modelx', 'CA123460', '1234567894'),
  ('modely@tshla.ai', crypt('password123', gen_salt('bf')), 'Dr. Model Y', 'Pediatrics', 'modely', 'CA123461', '1234567895'),
  ('rohan@tshla.ai', crypt('password123', gen_salt('bf')), 'Dr. Rohan Patel', 'Family Medicine', 'rohan', 'CA123462', '1234567896'),
  ('rakesh@tshla.ai', crypt('password123', gen_salt('bf')), 'Dr. Rakesh Patel', 'Cardiology', 'rakesh', 'CA123463', '1234567897'),
  ('epc@tshla.ai', crypt('password123', gen_salt('bf')), 'Dr. EPC', 'Emergency Medicine', 'epc', 'CA123464', '1234567898'),
  ('jyothi@tshla.ai', crypt('password123', gen_salt('bf')), 'Dr. Jyothi Patel', 'Obstetrics', 'jyothi', 'CA123465', '1234567899'),
  ('jarvis@tshla.ai', crypt('password123', gen_salt('bf')), 'Dr. Jarvis AI', 'Neurology', 'jarvis', 'CA123466', '1234567900'),
  ('arya@tshla.ai', crypt('password123', gen_salt('bf')), 'Dr. Arya Stark', 'Surgery', 'arya', 'CA123467', '1234567901')
ON CONFLICT (email) DO UPDATE SET 
  name = EXCLUDED.name,
  specialty = EXCLUDED.specialty,
  verification_code = EXCLUDED.verification_code;

-- Insert Test Patients with full medical histories
-- Patient 111-111: Sarah Johnson (Psych patient)
INSERT INTO patients (mrn, first_name, last_name, date_of_birth, gender, email, phone, address, insurance_provider, insurance_id) VALUES
  ('MRN111111', 'Sarah', 'Johnson', '1990-07-22', 'Female', 'sarah.johnson@email.com', '555-111-1111', '111 Main St, San Francisco, CA', 'Blue Cross', 'BC111111')
ON CONFLICT (mrn) DO NOTHING;

-- Patient 222-222: Michael Chen (Endocrine patient)  
INSERT INTO patients (mrn, first_name, last_name, date_of_birth, gender, email, phone, address, insurance_provider, insurance_id) VALUES
  ('MRN222222', 'Michael', 'Chen', '1978-11-30', 'Male', 'michael.chen@email.com', '555-222-2222', '222 Oak Ave, San Francisco, CA', 'Aetna', 'AE222222')
ON CONFLICT (mrn) DO NOTHING;

-- Patient 333-333: Emily Rodriguez (Psych patient)
INSERT INTO patients (mrn, first_name, last_name, date_of_birth, gender, email, phone, address, insurance_provider, insurance_id) VALUES
  ('MRN333333', 'Emily', 'Rodriguez', '1985-03-15', 'Female', 'emily.rodriguez@email.com', '555-333-3333', '333 Pine St, San Francisco, CA', 'Kaiser', 'KP333333')
ON CONFLICT (mrn) DO NOTHING;

-- Patient 444-444: John Smith (Endocrine patient - primary test patient)
INSERT INTO patients (mrn, first_name, last_name, date_of_birth, gender, email, phone, address, insurance_provider, insurance_id) VALUES
  ('MRN444444', 'John', 'Smith', '1985-03-15', 'Male', 'john.smith@email.com', '555-444-4444', '444 Elm St, San Francisco, CA', 'UnitedHealth', 'UH444444')
ON CONFLICT (mrn) DO NOTHING;

-- Patient 555-555: Jessica Brown (Psych patient)
INSERT INTO patients (mrn, first_name, last_name, date_of_birth, gender, email, phone, address, insurance_provider, insurance_id) VALUES
  ('MRN555555', 'Jessica', 'Brown', '1992-05-20', 'Female', 'jessica.brown@email.com', '555-555-5555', '555 Maple Dr, San Francisco, CA', 'Cigna', 'CI555555')
ON CONFLICT (mrn) DO NOTHING;

-- Patient 666-666: Robert Taylor (Endocrine patient)
INSERT INTO patients (mrn, first_name, last_name, date_of_birth, gender, email, phone, address, insurance_provider, insurance_id) VALUES
  ('MRN666666', 'Robert', 'Taylor', '1975-09-10', 'Male', 'robert.taylor@email.com', '555-666-6666', '666 Cedar Ln, San Francisco, CA', 'Anthem', 'AN666666')
ON CONFLICT (mrn) DO NOTHING;

-- Patient 777-777: Maria Garcia (Psych patient)
INSERT INTO patients (mrn, first_name, last_name, date_of_birth, gender, email, phone, address, insurance_provider, insurance_id) VALUES
  ('MRN777777', 'Maria', 'Garcia', '1988-12-05', 'Female', 'maria.garcia@email.com', '555-777-7777', '777 Birch Rd, San Francisco, CA', 'Humana', 'HU777777')
ON CONFLICT (mrn) DO NOTHING;

-- Patient 888-888: James Wilson (Endocrine patient)
INSERT INTO patients (mrn, first_name, last_name, date_of_birth, gender, email, phone, address, insurance_provider, insurance_id) VALUES
  ('MRN888888', 'James', 'Wilson', '1980-04-18', 'Male', 'james.wilson@email.com', '555-888-8888', '888 Spruce Way, San Francisco, CA', 'Molina', 'MO888888')
ON CONFLICT (mrn) DO NOTHING;

-- Patient 999-999: Linda Martinez (Psych patient)
INSERT INTO patients (mrn, first_name, last_name, date_of_birth, gender, email, phone, address, insurance_provider, insurance_id) VALUES
  ('MRN999999', 'Linda', 'Martinez', '1995-01-25', 'Female', 'linda.martinez@email.com', '555-999-9999', '999 Willow Ct, San Francisco, CA', 'Oscar Health', 'OH999999')
ON CONFLICT (mrn) DO NOTHING;

-- Now let's add sample visits with medical histories for key patients
DO $$
DECLARE
  patient_444_id UUID;
  patient_111_id UUID;
  patient_222_id UUID;
  doctor_rakesh_id UUID;
  doctor_jarvis_id UUID;
BEGIN
  -- Get IDs
  SELECT id INTO patient_444_id FROM patients WHERE mrn = 'MRN444444';
  SELECT id INTO patient_111_id FROM patients WHERE mrn = 'MRN111111';
  SELECT id INTO patient_222_id FROM patients WHERE mrn = 'MRN222222';
  SELECT id INTO doctor_rakesh_id FROM doctors WHERE email = 'rakesh@tshla.ai';
  SELECT id INTO doctor_jarvis_id FROM doctors WHERE email = 'jarvis@tshla.ai';

  -- Visit 1 for John Smith (6 months ago)
  INSERT INTO visits (
    patient_id, doctor_id, visit_date, chief_complaint, visit_type, 
    notes, diagnosis, medications, vitals, template_used
  ) VALUES (
    patient_444_id, 
    doctor_rakesh_id,
    NOW() - INTERVAL '6 months',
    'Diabetes follow-up',
    'office',
    'Patient presents for routine diabetes management. Good glucose control on current regimen.',
    '["Type 2 Diabetes Mellitus", "Hypertension"]'::jsonb,
    '[
      {"name": "Metformin", "dosage": "500mg", "frequency": "Twice daily", "indication": "Type 2 Diabetes"},
      {"name": "Lantus", "dosage": "20 units", "frequency": "Once daily at bedtime", "indication": "Diabetes"}
    ]'::jsonb,
    '{"bp": "138/88", "hr": "78", "temp": "98.6°F", "weight": "190 lbs", "bmi": "29.1", "glucose": "145 mg/dL"}'::jsonb,
    'Diabetes Follow-up'
  );

  -- Visit 2 for John Smith (3 months ago)
  INSERT INTO visits (
    patient_id, doctor_id, visit_date, chief_complaint, visit_type,
    notes, diagnosis, medications, vitals, template_used
  ) VALUES (
    patient_444_id,
    doctor_rakesh_id,
    NOW() - INTERVAL '3 months',
    'Medication adjustment',
    'office',
    'Increasing Metformin dose due to elevated A1C. Discontinued Lantus, starting Ozempic.',
    '["Type 2 Diabetes Mellitus", "Hypertension", "Hyperlipidemia"]'::jsonb,
    '[
      {"name": "Metformin", "dosage": "1000mg", "frequency": "Twice daily", "indication": "Type 2 Diabetes"},
      {"name": "Ozempic", "dosage": "0.5mg", "frequency": "Once weekly", "indication": "Diabetes"},
      {"name": "Lisinopril", "dosage": "10mg", "frequency": "Once daily", "indication": "Hypertension"},
      {"name": "Atorvastatin", "dosage": "20mg", "frequency": "Once daily at bedtime", "indication": "Hyperlipidemia"}
    ]'::jsonb,
    '{"bp": "132/84", "hr": "72", "temp": "98.6°F", "weight": "185 lbs", "bmi": "28.2", "glucose": "126 mg/dL"}'::jsonb,
    'SOAP Note'
  );

  -- Mental Health Screening for Sarah Johnson
  INSERT INTO mental_health_screenings (
    patient_id, visit_id, screening_type, score, severity, responses
  ) VALUES (
    patient_111_id,
    NULL, -- Can be linked to a visit later
    'PHQ-9',
    12,
    'Moderate',
    '[
      {"question": "Little interest or pleasure in doing things", "score": 2},
      {"question": "Feeling down, depressed, or hopeless", "score": 2},
      {"question": "Trouble falling asleep or sleeping too much", "score": 1},
      {"question": "Feeling tired or having little energy", "score": 2},
      {"question": "Poor appetite or overeating", "score": 1},
      {"question": "Feeling bad about yourself", "score": 2},
      {"question": "Trouble concentrating", "score": 1},
      {"question": "Moving or speaking slowly", "score": 1},
      {"question": "Thoughts of self-harm", "score": 0}
    ]'::jsonb
  );

  INSERT INTO mental_health_screenings (
    patient_id, visit_id, screening_type, score, severity, responses
  ) VALUES (
    patient_111_id,
    NULL,
    'GAD-7',
    8,
    'Mild',
    '[
      {"question": "Feeling nervous, anxious or on edge", "score": 2},
      {"question": "Not being able to stop worrying", "score": 1},
      {"question": "Worrying too much about different things", "score": 2},
      {"question": "Trouble relaxing", "score": 1},
      {"question": "Being so restless it is hard to sit still", "score": 1},
      {"question": "Becoming easily annoyed or irritable", "score": 1},
      {"question": "Feeling afraid as if something awful might happen", "score": 0}
    ]'::jsonb
  );

  -- Prior Authorization for expensive medication
  INSERT INTO prior_authorizations (
    patient_id, doctor_id, medication_name, diagnosis_codes, status, submitted_date, approval_date, notes
  ) VALUES (
    patient_222_id,
    doctor_rakesh_id,
    'Ozempic 1mg weekly',
    ARRAY['E11.9', 'E78.5'],
    'approved',
    NOW() - INTERVAL '1 month',
    NOW() - INTERVAL '3 weeks',
    'Approved for 12 months. Patient failed metformin monotherapy.'
  );

END $$;

-- Create custom templates
INSERT INTO templates (name, specialty, template_type, sections, is_system_template, is_shared, usage_count) VALUES
  ('Diabetes Management', 'Endocrinology', 'specialty',
   '{
     "glucose_control": "Review glucose logs and A1C trends",
     "medications": "Current diabetes medications and adherence",
     "complications": "Screen for diabetic complications",
     "lifestyle": "Diet, exercise, and weight management",
     "plan": "Medication adjustments and follow-up"
   }'::jsonb,
   false, true, 45),
  
  ('Depression Assessment', 'Psychiatry', 'specialty',
   '{
     "mood": "Current mood symptoms and duration",
     "functional_impact": "Impact on work, relationships, activities",
     "risk_assessment": "Suicidal ideation and safety planning",
     "medications": "Current psychotropic medications",
     "therapy": "Psychotherapy progress and recommendations",
     "plan": "Treatment plan and follow-up"
   }'::jsonb,
   false, true, 32),
   
  ('Cardiology Consultation', 'Cardiology', 'consultation',
   '{
     "reason_for_consult": "Referring physician and indication",
     "cardiac_history": "Previous cardiac events and procedures",
     "risk_factors": "HTN, DM, smoking, family history",
     "current_symptoms": "Chest pain, dyspnea, palpitations",
     "exam": "Cardiac examination findings",
     "tests": "EKG, echo, stress test results",
     "assessment": "Cardiac risk stratification",
     "recommendations": "Treatment recommendations"
   }'::jsonb,
   false, true, 28);

-- Add sample audit logs for HIPAA compliance
INSERT INTO audit_logs (user_id, user_type, action, resource_type, resource_id, phi_accessed, ip_address, user_agent) 
SELECT 
  doctor_rakesh_id,
  'doctor',
  'VIEW_PATIENT',
  'patient',
  patient_444_id,
  true,
  '192.168.1.100'::inet,
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
FROM doctors, patients
WHERE doctors.email = 'rakesh@tshla.ai' AND patients.mrn = 'MRN444444';

-- Summary of what's in the database:
-- 12 Doctors with verification codes
-- 9 Patients (111-111 through 999-999)
-- Medical histories with medications that change over time
-- Mental health screenings (PHQ-9, GAD-7)
-- Prior authorizations
-- Custom templates
-- Audit logs for HIPAA compliance

SELECT 
  (SELECT COUNT(*) FROM doctors) as total_doctors,
  (SELECT COUNT(*) FROM patients) as total_patients,
  (SELECT COUNT(*) FROM visits) as total_visits,
  (SELECT COUNT(*) FROM mental_health_screenings) as mental_health_records,
  (SELECT COUNT(*) FROM prior_authorizations) as prior_auths,
  (SELECT COUNT(*) FROM templates) as total_templates,
  (SELECT COUNT(*) FROM audit_logs) as audit_entries;