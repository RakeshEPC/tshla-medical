-- Migration 024: Add CGM device brand tracking
-- Run this in the Supabase SQL Editor

ALTER TABLE patient_nightscout_config
  ADD COLUMN IF NOT EXISTS cgm_device_brand TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS configured_by TEXT DEFAULT 'provider';

COMMENT ON COLUMN patient_nightscout_config.cgm_device_brand IS
  'CGM device brand: dexcom_g6, dexcom_g7, dexcom_stelo, libre_2, libre_3, eversense_e3, medtronic_guardian, other_nightscout';

COMMENT ON COLUMN patient_nightscout_config.configured_by IS
  'Who configured this connection: provider or patient (self-service)';
