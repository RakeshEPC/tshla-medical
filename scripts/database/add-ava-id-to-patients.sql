-- Add ava_id column to patients table
-- Run this in Supabase SQL Editor

-- Add ava_id column if it doesn't exist
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS ava_id VARCHAR(20) UNIQUE;

-- Add comment
COMMENT ON COLUMN patients.ava_id IS 'AVA ID for patient portal login (format: AVA ###-###)';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_patients_ava_id ON patients(ava_id);

-- Update existing patients to have AVA IDs (if they don't have one)
-- This will generate AVA IDs for existing patients
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
        -- Generate random 3-digit numbers
        random_num1 := floor(random() * 900 + 100)::INTEGER;
        random_num2 := floor(random() * 900 + 100)::INTEGER;
        new_ava_id := 'AVA ' || random_num1 || '-' || random_num2;

        -- Update the patient with the new AVA ID
        -- Loop until we find a unique AVA ID
        WHILE EXISTS (SELECT 1 FROM patients WHERE ava_id = new_ava_id) LOOP
            random_num1 := floor(random() * 900 + 100)::INTEGER;
            random_num2 := floor(random() * 900 + 100)::INTEGER;
            new_ava_id := 'AVA ' || random_num1 || '-' || random_num2;
        END LOOP;

        UPDATE patients SET ava_id = new_ava_id WHERE id = patient_record.id;
    END LOOP;
END $$;

-- Verify the changes
SELECT
    COUNT(*) as total_patients,
    COUNT(ava_id) as patients_with_ava_id,
    COUNT(*) - COUNT(ava_id) as patients_without_ava_id
FROM patients;
