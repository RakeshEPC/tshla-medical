-- Fix pump_assessments table schema
-- This updates the table to match the master schema

-- Step 1: Check if user_id column exists and rename it to patient_id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'pump_assessments'
        AND column_name = 'user_id'
    ) THEN
        ALTER TABLE pump_assessments RENAME COLUMN user_id TO patient_id;
    END IF;
END $$;

-- Step 2: Ensure patient_id column exists (if table was created without it)
ALTER TABLE pump_assessments
ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES patients(id) ON DELETE CASCADE;

-- Step 3: Ensure other required columns exist
ALTER TABLE pump_assessments
ADD COLUMN IF NOT EXISTS id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS assessment_data JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS scores JSONB,
ADD COLUMN IF NOT EXISTS recommendations JSONB,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Step 4: Create index on patient_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_pump_assessments_patient_id ON pump_assessments(patient_id);

-- Step 5: Add comment
COMMENT ON TABLE pump_assessments IS 'Stores PumpDrive assessment data and recommendations for patients';
COMMENT ON COLUMN pump_assessments.patient_id IS 'References patients table (not user_id)';
COMMENT ON COLUMN pump_assessments.assessment_data IS 'Complete questionnaire responses';
COMMENT ON COLUMN pump_assessments.scores IS 'AI-generated scores for pump matching';
COMMENT ON COLUMN pump_assessments.recommendations IS 'Top pump recommendations based on assessment';

-- Verify the schema
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'pump_assessments'
ORDER BY ordinal_position;
