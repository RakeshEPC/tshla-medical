-- ============================================
-- TSHLA Medical - Migration Script
-- Allow Unidentified Patient Dictations
-- ============================================
-- Date: 2025-10-17
-- Purpose: Modify existing dictated_notes table to allow NULL patient names
-- This enables saving dictations before patient is identified
-- ============================================

-- Step 1: Add new column for tracking unidentified notes
ALTER TABLE dictated_notes
ADD COLUMN IF NOT EXISTS requires_patient_identification BOOLEAN DEFAULT false;

-- Step 2: Make patient_name nullable (remove NOT NULL constraint)
ALTER TABLE dictated_notes
ALTER COLUMN patient_name DROP NOT NULL;

-- Step 3: Update existing records to set requires_patient_identification flag
-- (Only if patient_name is NULL or looks like a placeholder)
UPDATE dictated_notes
SET requires_patient_identification = true
WHERE patient_name IS NULL
   OR patient_name LIKE '[Unidentified Patient%'
   OR patient_name = 'Unknown Patient'
   OR patient_name = '';

-- Step 4: Add index for querying unidentified notes
CREATE INDEX IF NOT EXISTS idx_dictated_notes_unidentified
ON dictated_notes(requires_patient_identification)
WHERE requires_patient_identification = true;

-- Step 5: Add comment to document the change
COMMENT ON COLUMN dictated_notes.patient_name IS
'Patient name - nullable to allow saving dictations before patient identification. Use requires_patient_identification flag to track unidentified notes.';

COMMENT ON COLUMN dictated_notes.requires_patient_identification IS
'Indicates this note needs patient identification before finalizing. Set to true when patient_name is NULL or placeholder.';

-- ============================================
-- VERIFICATION QUERY
-- ============================================
-- Run this to verify the migration:
-- SELECT column_name, is_nullable, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'dictated_notes'
-- AND column_name IN ('patient_name', 'requires_patient_identification');

-- ============================================
-- ROLLBACK (if needed)
-- ============================================
-- To rollback this migration:
-- ALTER TABLE dictated_notes ALTER COLUMN patient_name SET NOT NULL;
-- ALTER TABLE dictated_notes DROP COLUMN IF EXISTS requires_patient_identification;
-- DROP INDEX IF EXISTS idx_dictated_notes_unidentified;
-- ============================================
