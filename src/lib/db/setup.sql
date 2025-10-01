-- HIPAA-Compliant Database Setup for PostgreSQL
-- Run this script to set up your secure database

-- Create database
CREATE DATABASE tshla_medical;

-- Connect to the database
\c tshla_medical;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create audit log table (immutable)
CREATE TABLE audit_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    actor_id VARCHAR(255) NOT NULL,
    patient_id VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    ip INET,
    success BOOLEAN DEFAULT true,
    metadata JSONB,
    previous_hash VARCHAR(64),
    hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Make audit logs immutable (no updates or deletes)
CREATE RULE audit_logs_no_update AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
CREATE RULE audit_logs_no_delete AS ON DELETE TO audit_logs DO INSTEAD NOTHING;

-- Create sessions table
CREATE TABLE sessions (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    absolute_expiry TIMESTAMPTZ NOT NULL,
    idle_expiry TIMESTAMPTZ NOT NULL,
    ip INET,
    user_agent TEXT,
    active BOOLEAN DEFAULT true
);

-- Create index for session cleanup
CREATE INDEX idx_sessions_expiry ON sessions(absolute_expiry, idle_expiry) WHERE active = true;

-- Create patients table (all PHI encrypted at application level)
CREATE TABLE patients (
    id VARCHAR(50) PRIMARY KEY,
    ava_id VARCHAR(50) UNIQUE,
    encrypted_data JSONB NOT NULL, -- All PHI encrypted before storage
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(255),
    updated_by VARCHAR(255)
);

-- Create visits table
CREATE TABLE visits (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    patient_id VARCHAR(50) REFERENCES patients(id),
    visit_date DATE NOT NULL,
    encrypted_dictation TEXT, -- Encrypted
    encrypted_soap_note JSONB, -- Encrypted
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(255)
);

-- Create mental health scores table
CREATE TABLE mental_health_scores (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    patient_id VARCHAR(50) REFERENCES patients(id),
    assessment_type VARCHAR(20) NOT NULL, -- PHQ9, GAD7
    encrypted_score JSONB NOT NULL, -- Encrypted scores and responses
    assessment_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(255)
);

-- Create encryption keys table (for key rotation)
CREATE TABLE encryption_keys (
    id SERIAL PRIMARY KEY,
    key_id VARCHAR(50) UNIQUE NOT NULL,
    encrypted_key TEXT NOT NULL, -- Master key encrypted with KMS
    algorithm VARCHAR(20) DEFAULT 'AES-256-GCM',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    rotated_at TIMESTAMPTZ,
    active BOOLEAN DEFAULT true
);

-- Create indexes for performance
CREATE INDEX idx_patients_ava ON patients(ava_id);
CREATE INDEX idx_visits_patient ON visits(patient_id);
CREATE INDEX idx_visits_date ON visits(visit_date);
CREATE INDEX idx_mental_health_patient ON mental_health_scores(patient_id);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_patient ON audit_logs(patient_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);

-- Create audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    -- Log data access (without PHI)
    INSERT INTO audit_logs (
        actor_id,
        patient_id,
        action,
        metadata
    ) VALUES (
        current_user,
        CASE 
            WHEN TG_TABLE_NAME = 'patients' THEN NEW.id
            WHEN TG_TABLE_NAME = 'visits' THEN NEW.patient_id
            ELSE 'unknown'
        END,
        TG_OP || '_' || TG_TABLE_NAME,
        jsonb_build_object(
            'table', TG_TABLE_NAME,
            'operation', TG_OP,
            'timestamp', NOW()
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add audit triggers to tables
CREATE TRIGGER audit_patients
    AFTER INSERT OR UPDATE OR DELETE ON patients
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_visits
    AFTER INSERT OR UPDATE OR DELETE ON visits
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_mental_health
    AFTER INSERT OR UPDATE OR DELETE ON mental_health_scores
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Create read-only user for reporting
CREATE USER tshla_reporter WITH PASSWORD 'CHANGE_THIS_PASSWORD';
GRANT CONNECT ON DATABASE tshla_medical TO tshla_reporter;
GRANT USAGE ON SCHEMA public TO tshla_reporter;
GRANT SELECT ON audit_logs TO tshla_reporter;

-- Create application user
CREATE USER tshla_app WITH PASSWORD 'CHANGE_THIS_PASSWORD';
GRANT CONNECT ON DATABASE tshla_medical TO tshla_app;
GRANT USAGE ON SCHEMA public TO tshla_app;
GRANT SELECT, INSERT, UPDATE ON patients, visits, mental_health_scores, sessions TO tshla_app;
GRANT SELECT, INSERT ON audit_logs TO tshla_app; -- No UPDATE/DELETE on audit logs
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO tshla_app;

-- Row Level Security (RLS) for additional protection
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE mental_health_scores ENABLE ROW LEVEL SECURITY;

-- Create policies (customize based on your needs)
CREATE POLICY patients_policy ON patients
    FOR ALL
    TO tshla_app
    USING (true); -- Customize based on your access rules

-- Backup configuration notes
COMMENT ON DATABASE tshla_medical IS 'HIPAA-compliant medical records database. Requires daily encrypted backups with 7-year retention.';

-- Performance and security settings
ALTER DATABASE tshla_medical SET log_statement = 'all';
ALTER DATABASE tshla_medical SET log_connections = on;
ALTER DATABASE tshla_medical SET log_disconnections = on;
ALTER DATABASE tshla_medical SET ssl = on;

-- IMPORTANT: After running this script:
-- 1. Change all default passwords
-- 2. Enable SSL/TLS connections only
-- 3. Set up automated encrypted backups
-- 4. Configure point-in-time recovery
-- 5. Set up monitoring and alerting
-- 6. Implement connection pooling
-- 7. Regular security audits