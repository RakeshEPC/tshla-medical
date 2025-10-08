-- Additional schema for patient services (refills and lab orders)
-- To be added to the main database

-- Medication refill requests table
CREATE TABLE IF NOT EXISTS refill_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_email VARCHAR(255) NOT NULL,
    patient_name VARCHAR(255) NOT NULL,
    patient_dob DATE,
    doctor_id UUID REFERENCES doctors(id),
    medication_name VARCHAR(255) NOT NULL,
    dosage VARCHAR(100),
    frequency VARCHAR(100), -- e.g., "twice daily", "as needed"
    quantity_requested INTEGER,
    pharmacy_name VARCHAR(255),
    pharmacy_phone VARCHAR(20),
    pharmacy_address TEXT,
    last_filled_date DATE,
    refills_remaining INTEGER,
    urgent BOOLEAN DEFAULT false,
    reason_if_early TEXT,
    allergies TEXT,
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, denied, sent_to_pharmacy, completed
    doctor_notes TEXT,
    denial_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    processed_by UUID REFERENCES doctors(id)
);

-- Lab order requests table
CREATE TABLE IF NOT EXISTS lab_order_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_email VARCHAR(255) NOT NULL,
    patient_name VARCHAR(255) NOT NULL,
    patient_dob DATE,
    patient_phone VARCHAR(20),
    doctor_id UUID REFERENCES doctors(id),
    lab_type VARCHAR(100), -- routine, fasting, urgent, follow-up
    tests_requested TEXT[], -- array of test names
    test_category VARCHAR(100), -- blood_work, imaging, cardiology, etc.
    preferred_lab_location VARCHAR(255),
    preferred_date DATE,
    preferred_time_range VARCHAR(50), -- morning, afternoon, evening
    fasting_required BOOLEAN DEFAULT false,
    special_instructions TEXT,
    symptoms_reason TEXT,
    diagnosis_codes TEXT[], -- ICD-10 codes if applicable
    insurance_provider VARCHAR(100),
    insurance_member_id VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, denied, scheduled, completed, results_available
    order_number VARCHAR(100),
    lab_requisition_url TEXT, -- URL to generated lab order PDF
    results_available_date DATE,
    doctor_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    scheduled_at TIMESTAMP,
    completed_at TIMESTAMP,
    processed_by UUID REFERENCES doctors(id)
);

-- Common medications table for quick selection
CREATE TABLE IF NOT EXISTS common_medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medication_name VARCHAR(255) NOT NULL UNIQUE,
    generic_name VARCHAR(255),
    category VARCHAR(100), -- diabetes, hypertension, cholesterol, etc.
    common_dosages TEXT[], -- array of common dosage options
    requires_prior_auth BOOLEAN DEFAULT false,
    controlled_substance BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Common lab tests table for quick selection
CREATE TABLE IF NOT EXISTS common_lab_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_name VARCHAR(255) NOT NULL,
    test_code VARCHAR(50),
    category VARCHAR(100), -- routine, diabetes, cardiac, liver, kidney, etc.
    requires_fasting BOOLEAN DEFAULT false,
    special_prep TEXT,
    typical_turnaround_days INTEGER DEFAULT 2,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_refill_requests_patient_email ON refill_requests(patient_email);
CREATE INDEX idx_refill_requests_status ON refill_requests(status);
CREATE INDEX idx_refill_requests_created_at ON refill_requests(created_at DESC);

CREATE INDEX idx_lab_order_requests_patient_email ON lab_order_requests(patient_email);
CREATE INDEX idx_lab_order_requests_status ON lab_order_requests(status);
CREATE INDEX idx_lab_order_requests_created_at ON lab_order_requests(created_at DESC);

-- Sample common medications (to be expanded)
INSERT INTO common_medications (medication_name, generic_name, category, common_dosages, requires_prior_auth) VALUES
('Metformin', 'Metformin HCl', 'diabetes', ARRAY['500mg', '850mg', '1000mg'], false),
('Lisinopril', 'Lisinopril', 'hypertension', ARRAY['5mg', '10mg', '20mg', '40mg'], false),
('Atorvastatin', 'Atorvastatin', 'cholesterol', ARRAY['10mg', '20mg', '40mg', '80mg'], false),
('Levothyroxine', 'Levothyroxine', 'thyroid', ARRAY['25mcg', '50mcg', '75mcg', '100mcg', '125mcg'], false),
('Ozempic', 'Semaglutide', 'diabetes', ARRAY['0.25mg', '0.5mg', '1mg', '2mg'], true),
('Jardiance', 'Empagliflozin', 'diabetes', ARRAY['10mg', '25mg'], true)
ON CONFLICT (medication_name) DO NOTHING;

-- Sample common lab tests
INSERT INTO common_lab_tests (test_name, category, requires_fasting) VALUES
('Complete Blood Count (CBC)', 'routine', false),
('Comprehensive Metabolic Panel (CMP)', 'routine', true),
('Lipid Panel', 'cardiac', true),
('Hemoglobin A1C', 'diabetes', false),
('Thyroid Stimulating Hormone (TSH)', 'thyroid', false),
('Vitamin D', 'routine', false),
('Urinalysis', 'routine', false),
('Liver Function Tests', 'liver', false)
ON CONFLICT DO NOTHING;