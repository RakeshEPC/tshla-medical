-- Migration 025: Add LibreLinkUp Direct Support
-- Adds columns for LibreLinkUp credentials (FreeStyle Libre direct connection)
-- Same pattern as Dexcom Share credentials added in migration 021
-- Created: 2026-02-04

-- Add LibreLinkUp credential columns
ALTER TABLE patient_nightscout_config
  ADD COLUMN IF NOT EXISTS libre_linkup_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS libre_linkup_password_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS libre_linkup_region VARCHAR(10) DEFAULT 'US';
