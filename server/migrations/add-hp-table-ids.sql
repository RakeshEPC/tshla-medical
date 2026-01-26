-- Add ID column and other identifiers to patient_comprehensive_chart table
-- Created: 2026-01-25
-- Purpose: Normalize H&P table schema to match schedule table structure

-- Step 1: Add new columns
ALTER TABLE patient_comprehensive_chart
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ADD COLUMN IF NOT EXISTS patient_id VARCHAR(20),
  ADD COLUMN IF NOT EXISTS patient_mrn VARCHAR(50),
  ADD COLUMN IF NOT EXISTS unified_patient_id UUID;

-- Step 2: Create index on unified_patient_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_hp_unified_patient_id
  ON patient_comprehensive_chart(unified_patient_id);

-- Step 3: Create index on patient_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_hp_patient_id
  ON patient_comprehensive_chart(patient_id);

-- Step 4: Add foreign key constraint to unified_patients
ALTER TABLE patient_comprehensive_chart
  ADD CONSTRAINT fk_hp_unified_patient
  FOREIGN KEY (unified_patient_id)
  REFERENCES unified_patients(id)
  ON DELETE SET NULL;

-- Step 5: Backfill unified_patient_id from existing phone numbers
UPDATE patient_comprehensive_chart hp
SET unified_patient_id = up.id,
    patient_id = up.patient_id,
    patient_mrn = up.patient_mrn
FROM unified_patients up
WHERE hp.patient_phone = up.phone_primary
  AND hp.unified_patient_id IS NULL;

-- Step 6: Create unique constraint on unified_patient_id (one H&P per patient)
CREATE UNIQUE INDEX IF NOT EXISTS idx_hp_unique_unified_patient
  ON patient_comprehensive_chart(unified_patient_id)
  WHERE unified_patient_id IS NOT NULL AND deleted_at IS NULL;

-- Verification queries:
-- SELECT COUNT(*) AS total_hp_records FROM patient_comprehensive_chart;
-- SELECT COUNT(*) AS hp_with_unified_id FROM patient_comprehensive_chart WHERE unified_patient_id IS NOT NULL;
-- SELECT COUNT(*) AS hp_without_unified_id FROM patient_comprehensive_chart WHERE unified_patient_id IS NULL;
