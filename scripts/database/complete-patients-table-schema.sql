-- Complete patients table schema migration
-- Adds all missing columns to match the master schema

-- Add all missing columns
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS patient_id VARCHAR(20) UNIQUE,
ADD COLUMN IF NOT EXISTS ava_id VARCHAR(20) UNIQUE,
ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS gender VARCHAR(10),
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS insurance_provider VARCHAR(100),
ADD COLUMN IF NOT EXISTS insurance_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS pumpdrive_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS pumpdrive_signup_date TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS pumpdrive_last_assessment TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS assessments_completed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(50) DEFAULT 'free',
ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_patients_email ON patients(email);
CREATE INDEX IF NOT EXISTS idx_patients_ava_id ON patients(ava_id);
CREATE INDEX IF NOT EXISTS idx_patients_auth_user_id ON patients(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_patients_pumpdrive ON patients(pumpdrive_enabled) WHERE pumpdrive_enabled = true;

-- Add comments for documentation
COMMENT ON TABLE patients IS 'Unified patients table - includes EMR patients and PumpDrive users';
COMMENT ON COLUMN patients.patient_id IS 'Internal patient ID (format: pt-xxxxxx)';
COMMENT ON COLUMN patients.ava_id IS 'AVA ID for patient portal login (format: AVA ###-###)';
COMMENT ON COLUMN patients.pumpdrive_enabled IS 'Whether patient has access to PumpDrive assessments';
COMMENT ON COLUMN patients.subscription_tier IS 'Subscription level: free, premium, enterprise';

-- Generate AVA IDs for existing patients without one
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
        -- Generate unique AVA ID
        LOOP
            random_num1 := floor(random() * 900 + 100)::INTEGER;
            random_num2 := floor(random() * 900 + 100)::INTEGER;
            new_ava_id := 'AVA ' || random_num1 || '-' || random_num2;

            EXIT WHEN NOT EXISTS (SELECT 1 FROM patients WHERE ava_id = new_ava_id);
        END LOOP;

        UPDATE patients SET ava_id = new_ava_id WHERE id = patient_record.id;
    END LOOP;
END $$;

-- Verify the schema
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'patients'
ORDER BY ordinal_position;
