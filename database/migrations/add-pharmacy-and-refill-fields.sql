-- Add pharmacy information and refill duration fields to patient_medications
-- This enables staff to track refill requests, durations, and pharmacy details
-- Created: 2026-01-26

-- Add pharmacy information fields to unified_patients table (patient's preferred pharmacy)
ALTER TABLE unified_patients
ADD COLUMN IF NOT EXISTS preferred_pharmacy_name TEXT,
ADD COLUMN IF NOT EXISTS preferred_pharmacy_phone TEXT,
ADD COLUMN IF NOT EXISTS preferred_pharmacy_address TEXT,
ADD COLUMN IF NOT EXISTS preferred_pharmacy_fax TEXT;

-- Add refill duration and tracking fields to patient_medications table
ALTER TABLE patient_medications
ADD COLUMN IF NOT EXISTS refill_duration_days INTEGER, -- 30, 60, or 90 days
ADD COLUMN IF NOT EXISTS refill_quantity TEXT, -- e.g., "30 tablets", "90 day supply"
ADD COLUMN IF NOT EXISTS last_refill_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS next_refill_due_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS refill_count INTEGER DEFAULT 0, -- Track number of refills processed
ADD COLUMN IF NOT EXISTS refill_notes TEXT, -- Staff notes about refill processing
ADD COLUMN IF NOT EXISTS sent_to_pharmacy_confirmation TEXT; -- Confirmation number/reference

-- Create index for refill due date queries
CREATE INDEX IF NOT EXISTS idx_patient_medications_refill_due
  ON patient_medications(next_refill_due_date)
  WHERE send_to_pharmacy = TRUE;

-- Create index for pending pharmacy requests
CREATE INDEX IF NOT EXISTS idx_patient_medications_pharmacy_pending
  ON patient_medications(send_to_pharmacy, sent_to_pharmacy_at)
  WHERE send_to_pharmacy = TRUE;

-- Comment on new columns
COMMENT ON COLUMN patient_medications.refill_duration_days IS 'Duration of refill in days: 30, 60, or 90';
COMMENT ON COLUMN patient_medications.refill_quantity IS 'Quantity description like "30 tablets" or "90 day supply"';
COMMENT ON COLUMN patient_medications.last_refill_date IS 'Date when medication was last refilled';
COMMENT ON COLUMN patient_medications.next_refill_due_date IS 'Calculated date when next refill is due';
COMMENT ON COLUMN patient_medications.refill_count IS 'Total number of times this medication has been refilled';
COMMENT ON COLUMN patient_medications.refill_notes IS 'Staff notes about refill processing and history';
COMMENT ON COLUMN patient_medications.sent_to_pharmacy_confirmation IS 'Pharmacy confirmation number or reference';

COMMENT ON COLUMN unified_patients.preferred_pharmacy_name IS 'Patient preferred pharmacy name';
COMMENT ON COLUMN unified_patients.preferred_pharmacy_phone IS 'Patient preferred pharmacy phone number';
COMMENT ON COLUMN unified_patients.preferred_pharmacy_address IS 'Patient preferred pharmacy address';
COMMENT ON COLUMN unified_patients.preferred_pharmacy_fax IS 'Patient preferred pharmacy fax number';

-- Function to automatically calculate next refill due date
CREATE OR REPLACE FUNCTION calculate_next_refill_date()
RETURNS TRIGGER AS $$
BEGIN
  -- When last_refill_date or refill_duration_days is set, calculate next due date
  IF NEW.last_refill_date IS NOT NULL AND NEW.refill_duration_days IS NOT NULL THEN
    NEW.next_refill_due_date := NEW.last_refill_date + (NEW.refill_duration_days || ' days')::INTERVAL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate next refill date
DROP TRIGGER IF EXISTS calculate_refill_date_trigger ON patient_medications;
CREATE TRIGGER calculate_refill_date_trigger
  BEFORE INSERT OR UPDATE OF last_refill_date, refill_duration_days
  ON patient_medications
  FOR EACH ROW
  EXECUTE FUNCTION calculate_next_refill_date();
