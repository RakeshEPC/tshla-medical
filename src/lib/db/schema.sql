-- Database schema for multi-doctor medical dictation system
-- Supports PostgreSQL (recommended for production)

-- Doctors/Users table
CREATE TABLE IF NOT EXISTS doctors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    npi VARCHAR(10) UNIQUE,
    dea VARCHAR(9),
    license_number VARCHAR(50),
    license_state VARCHAR(2),
    specialty VARCHAR(100),
    practice_name VARCHAR(255),
    practice_address TEXT,
    phone VARCHAR(20),
    role VARCHAR(50) DEFAULT 'doctor', -- doctor, admin, staff
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    settings JSONB DEFAULT '{}'::jsonb
);

-- Patient charts with auto-deletion after 14 days
CREATE TABLE IF NOT EXISTS patient_charts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    patient_id VARCHAR(100) NOT NULL,
    patient_name VARCHAR(255),
    patient_dob DATE,
    encounter_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    chief_complaint TEXT,
    transcript TEXT,
    soap_note JSONB,
    diagnoses JSONB DEFAULT '[]'::jsonb,
    medications JSONB DEFAULT '[]'::jsonb,
    prior_auth_required BOOLEAN DEFAULT false,
    prior_auth_data JSONB,
    template_used UUID,
    is_finalized BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '14 days'),
    deleted_at TIMESTAMP,
    UNIQUE(doctor_id, patient_id, encounter_date)
);

-- Templates system
CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    specialty VARCHAR(100),
    template_type VARCHAR(50), -- soap, progress, consultation, procedure
    is_shared BOOLEAN DEFAULT false,
    is_system_template BOOLEAN DEFAULT false,
    sections JSONB NOT NULL,
    macros JSONB DEFAULT '{}'::jsonb,
    quick_phrases JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usage_count INTEGER DEFAULT 0,
    last_used TIMESTAMP
);

-- Prior Authorization submissions
CREATE TABLE IF NOT EXISTS prior_authorizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chart_id UUID REFERENCES patient_charts(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES doctors(id),
    patient_id VARCHAR(100) NOT NULL,
    medication VARCHAR(255) NOT NULL,
    diagnosis_codes JSONB DEFAULT '[]'::jsonb,
    insurance_info JSONB,
    clinical_data JSONB NOT NULL,
    questions_answered JSONB,
    covermymeds_id VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending', -- pending, submitted, approved, denied, cancelled
    submitted_at TIMESTAMP,
    response_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days')
);

-- Audit log for HIPAA compliance
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID REFERENCES doctors(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    patient_id VARCHAR(100),
    ip_address INET,
    user_agent TEXT,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table for authentication
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Shared access for cross-coverage
CREATE TABLE IF NOT EXISTS doctor_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    shared_with_doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    access_level VARCHAR(50) DEFAULT 'read', -- read, write, full
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(doctor_id, shared_with_doctor_id)
);

-- Create indexes for performance
CREATE INDEX idx_patient_charts_doctor_id ON patient_charts(doctor_id);
CREATE INDEX idx_patient_charts_patient_id ON patient_charts(patient_id);
CREATE INDEX idx_patient_charts_expires_at ON patient_charts(expires_at);
CREATE INDEX idx_patient_charts_created_at ON patient_charts(created_at);
CREATE INDEX idx_templates_doctor_id ON templates(doctor_id);
CREATE INDEX idx_templates_shared ON templates(is_shared);
CREATE INDEX idx_prior_auth_doctor_id ON prior_authorizations(doctor_id);
CREATE INDEX idx_prior_auth_status ON prior_authorizations(status);
CREATE INDEX idx_audit_logs_doctor_id ON audit_logs(doctor_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- Function to auto-delete expired charts
CREATE OR REPLACE FUNCTION delete_expired_charts()
RETURNS void AS $$
BEGIN
    UPDATE patient_charts 
    SET deleted_at = CURRENT_TIMESTAMP 
    WHERE expires_at < CURRENT_TIMESTAMP 
    AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old audit logs (keep 90 days)
CREATE OR REPLACE FUNCTION cleanup_audit_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM audit_logs 
    WHERE created_at < (CURRENT_TIMESTAMP - INTERVAL '90 days');
END;
$$ LANGUAGE plpgsql;

-- Create scheduled jobs (requires pg_cron extension)
-- Run these if pg_cron is available:
-- SELECT cron.schedule('delete-expired-charts', '0 2 * * *', 'SELECT delete_expired_charts();');
-- SELECT cron.schedule('cleanup-audit-logs', '0 3 * * 0', 'SELECT cleanup_audit_logs();');