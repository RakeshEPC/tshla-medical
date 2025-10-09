-- Fix ALL patients table constraints and missing columns
-- This is a comprehensive fix to match the actual Supabase schema

-- First, let's see what constraints exist
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'patients'
ORDER BY ordinal_position;

-- Drop NOT NULL constraints that are causing issues
-- We'll make these columns optional since the admin account creator doesn't provide them
ALTER TABLE patients
ALTER COLUMN mrn DROP NOT NULL;

-- Add missing columns with proper defaults
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS patient_id VARCHAR(20) UNIQUE,
ADD COLUMN IF NOT EXISTS ava_id VARCHAR(20) UNIQUE,
ADD COLUMN IF NOT EXISTS mrn VARCHAR(50),  -- Made optional
ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS gender VARCHAR(10),
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city VARCHAR(100),
ADD COLUMN IF NOT EXISTS state VARCHAR(2),
ADD COLUMN IF NOT EXISTS zip_code VARCHAR(10),
ADD COLUMN IF NOT EXISTS insurance_provider VARCHAR(100),
ADD COLUMN IF NOT EXISTS insurance_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(200),
ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS primary_doctor_id UUID REFERENCES medical_staff(id),
ADD COLUMN IF NOT EXISTS assigned_doctor_id UUID REFERENCES medical_staff(id),
ADD COLUMN IF NOT EXISTS medical_history TEXT,
ADD COLUMN IF NOT EXISTS current_medications TEXT,
ADD COLUMN IF NOT EXISTS allergies TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS pumpdrive_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS pumpdrive_signup_date TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS pumpdrive_last_assessment TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS assessments_completed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(50) DEFAULT 'free',
ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS last_visit_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS next_appointment_date TIMESTAMPTZ;

-- Create all necessary indexes
CREATE INDEX IF NOT EXISTS idx_patients_email ON patients(email);
CREATE INDEX IF NOT EXISTS idx_patients_ava_id ON patients(ava_id);
CREATE INDEX IF NOT EXISTS idx_patients_mrn ON patients(mrn);
CREATE INDEX IF NOT EXISTS idx_patients_auth_user_id ON patients(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_patients_pumpdrive ON patients(pumpdrive_enabled) WHERE pumpdrive_enabled = true;
CREATE INDEX IF NOT EXISTS idx_patients_primary_doctor ON patients(primary_doctor_id);
CREATE INDEX IF NOT EXISTS idx_patients_assigned_doctor ON patients(assigned_doctor_id);

-- Generate unique MRN for existing patients without one
DO $$
DECLARE
    patient_record RECORD;
    new_mrn VARCHAR(50);
BEGIN
    FOR patient_record IN
        SELECT id FROM patients WHERE mrn IS NULL
    LOOP
        -- Generate MRN format: MRN-YYYYMMDD-XXXX
        new_mrn := 'MRN-' || to_char(NOW(), 'YYYYMMDD') || '-' || lpad(floor(random() * 10000)::text, 4, '0');

        -- Make sure it's unique
        WHILE EXISTS (SELECT 1 FROM patients WHERE mrn = new_mrn) LOOP
            new_mrn := 'MRN-' || to_char(NOW(), 'YYYYMMDD') || '-' || lpad(floor(random() * 10000)::text, 4, '0');
        END LOOP;

        UPDATE patients SET mrn = new_mrn WHERE id = patient_record.id;
    END LOOP;
END $$;

-- Generate AVA IDs for patients without one
DO $$
DECLARE
    patient_record RECORD;
    random_num1 INTEGER;
    random_num2 INTEGER;
    new_ava_id VARCHAR(20);
BEGIN
    FOR patient_record IN
        SELECT id FROM patients WHERE ava_id IS NULL
    LOOP
        LOOP
            random_num1 := floor(random() * 900 + 100)::INTEGER;
            random_num2 := floor(random() * 900 + 100)::INTEGER;
            new_ava_id := 'AVA ' || random_num1 || '-' || random_num2;
            EXIT WHEN NOT EXISTS (SELECT 1 FROM patients WHERE ava_id = new_ava_id);
        END LOOP;
        UPDATE patients SET ava_id = new_ava_id WHERE id = patient_record.id;
    END LOOP;
END $$;

-- Add helpful comments
COMMENT ON TABLE patients IS 'Unified patients table - includes EMR patients and PumpDrive users';
COMMENT ON COLUMN patients.mrn IS 'Medical Record Number (auto-generated if not provided)';
COMMENT ON COLUMN patients.patient_id IS 'Internal patient ID (optional)';
COMMENT ON COLUMN patients.ava_id IS 'AVA ID for patient portal login (format: AVA ###-###)';
COMMENT ON COLUMN patients.pumpdrive_enabled IS 'Whether patient has access to PumpDrive assessments';
COMMENT ON COLUMN patients.subscription_tier IS 'Subscription level: free, premium, enterprise';

-- Show final schema
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default,
    CASE WHEN is_nullable = 'NO' THEN '⚠️ REQUIRED' ELSE '✅ Optional' END as status
FROM information_schema.columns
WHERE table_name = 'patients'
ORDER BY ordinal_position;
