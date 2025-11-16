-- =====================================================
-- PCM (Principal Care Management) Consent Fields
-- =====================================================
-- Created: 2025-01-16
-- Purpose: Add fields to track PCM enrollment and consent
--          for diabetes patients
-- =====================================================

-- Add PCM consent and enrollment fields to unified_patients table
ALTER TABLE unified_patients
ADD COLUMN IF NOT EXISTS pcm_enrolled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS pcm_consent_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pcm_consent_signature TEXT,
ADD COLUMN IF NOT EXISTS pcm_consent_version VARCHAR(10) DEFAULT '1.0',
ADD COLUMN IF NOT EXISTS pcm_start_date DATE,
ADD COLUMN IF NOT EXISTS pcm_end_date DATE,
ADD COLUMN IF NOT EXISTS pcm_status VARCHAR(20) DEFAULT 'inactive', -- inactive, active, paused, revoked
ADD COLUMN IF NOT EXISTS pcm_revoked_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pcm_revocation_reason TEXT;

-- Add diabetes-specific goal tracking fields
ALTER TABLE unified_patients
ADD COLUMN IF NOT EXISTS pcm_initial_a1c DECIMAL(4,2),
ADD COLUMN IF NOT EXISTS pcm_target_a1c DECIMAL(4,2) DEFAULT 7.0,
ADD COLUMN IF NOT EXISTS pcm_current_a1c DECIMAL(4,2),
ADD COLUMN IF NOT EXISTS pcm_last_a1c_date DATE,

ADD COLUMN IF NOT EXISTS pcm_initial_bp VARCHAR(20),
ADD COLUMN IF NOT EXISTS pcm_target_bp VARCHAR(20) DEFAULT '130/80',
ADD COLUMN IF NOT EXISTS pcm_current_bp VARCHAR(20),
ADD COLUMN IF NOT EXISTS pcm_last_bp_date DATE,

ADD COLUMN IF NOT EXISTS pcm_initial_weight DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS pcm_target_weight DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS pcm_current_weight DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS pcm_last_weight_date DATE;

-- Add billing tracking fields
ALTER TABLE unified_patients
ADD COLUMN IF NOT EXISTS pcm_last_billed_date DATE,
ADD COLUMN IF NOT EXISTS pcm_billing_notes TEXT;

-- Create index for PCM status queries
CREATE INDEX IF NOT EXISTS idx_unified_patients_pcm_status
ON unified_patients(pcm_status)
WHERE pcm_status = 'active';

-- Create index for PCM enrolled patients
CREATE INDEX IF NOT EXISTS idx_unified_patients_pcm_enrolled
ON unified_patients(pcm_enrolled)
WHERE pcm_enrolled = true;

-- Add comments for documentation
COMMENT ON COLUMN unified_patients.pcm_enrolled IS 'Whether patient is enrolled in Principal Care Management program';
COMMENT ON COLUMN unified_patients.pcm_consent_date IS 'Date/time when patient signed PCM consent';
COMMENT ON COLUMN unified_patients.pcm_consent_signature IS 'Electronic signature (patient full name)';
COMMENT ON COLUMN unified_patients.pcm_status IS 'Current PCM enrollment status: inactive, active, paused, revoked';
COMMENT ON COLUMN unified_patients.pcm_initial_a1c IS 'A1C value at PCM enrollment';
COMMENT ON COLUMN unified_patients.pcm_target_a1c IS 'Target A1C goal (default 7.0%)';
COMMENT ON COLUMN unified_patients.pcm_target_bp IS 'Target blood pressure (default 130/80)';
