-- Migration 022: Add unified_patient_id to CGM tables
-- Run this in the Supabase SQL Editor
-- This links CGM readings and config to the unified_patients table

-- Add unified_patient_id column to cgm_readings
ALTER TABLE cgm_readings ADD COLUMN IF NOT EXISTS unified_patient_id UUID;

-- Add unified_patient_id column to patient_nightscout_config
ALTER TABLE patient_nightscout_config ADD COLUMN IF NOT EXISTS unified_patient_id UUID;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_cgm_readings_unified_patient_id ON cgm_readings(unified_patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_nightscout_config_unified_patient_id ON patient_nightscout_config(unified_patient_id);

-- Backfill existing cgm_readings records
UPDATE cgm_readings cr
SET unified_patient_id = up.id
FROM unified_patients up
WHERE cr.patient_phone = '+1' || up.phone_primary
  AND cr.unified_patient_id IS NULL;

-- Backfill existing patient_nightscout_config records
UPDATE patient_nightscout_config pnc
SET unified_patient_id = up.id
FROM unified_patients up
WHERE pnc.patient_phone = '+1' || up.phone_primary
  AND pnc.unified_patient_id IS NULL;
