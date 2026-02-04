-- ============================================
-- Add Dexcom Share Direct Support
-- Adds columns for Dexcom Share credentials as alternative to Nightscout
-- ============================================
-- Created: 2026-02-03
-- ============================================

-- Add data_source column to track where data comes from
ALTER TABLE patient_nightscout_config
  ADD COLUMN IF NOT EXISTS data_source VARCHAR(50) DEFAULT 'nightscout'
  CHECK (data_source IN ('nightscout', 'dexcom_share'));

-- Add Dexcom Share credentials
ALTER TABLE patient_nightscout_config
  ADD COLUMN IF NOT EXISTS dexcom_username VARCHAR(255);

ALTER TABLE patient_nightscout_config
  ADD COLUMN IF NOT EXISTS dexcom_password_encrypted TEXT;

-- Make nightscout_url nullable (not needed for dexcom_share data source)
ALTER TABLE patient_nightscout_config
  ALTER COLUMN nightscout_url DROP NOT NULL;

-- Make api_secret_encrypted nullable (not needed for dexcom_share data source)
ALTER TABLE patient_nightscout_config
  ALTER COLUMN api_secret_encrypted DROP NOT NULL;
