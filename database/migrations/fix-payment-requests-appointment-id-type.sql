-- Fix appointment_id column type in patient_payment_requests
-- Should be INTEGER to match provider_schedules.id, not UUID
-- Created: 2026-01-15

-- First, drop the existing column if it has wrong type
ALTER TABLE patient_payment_requests
  DROP COLUMN IF EXISTS appointment_id;

-- Add it back with correct INTEGER type
ALTER TABLE patient_payment_requests
  ADD COLUMN appointment_id INTEGER REFERENCES provider_schedules(id) ON DELETE SET NULL;

-- Also fix previsit_id - it should also be INTEGER
ALTER TABLE patient_payment_requests
  DROP COLUMN IF EXISTS previsit_id;

ALTER TABLE patient_payment_requests
  ADD COLUMN previsit_id INTEGER;

-- Add comment
COMMENT ON COLUMN patient_payment_requests.appointment_id IS 'Reference to provider_schedules.id (integer)';
COMMENT ON COLUMN patient_payment_requests.previsit_id IS 'Reference to appointment ID (matches appointment_id for pre-visit workflow)';

-- Verify the columns have correct types
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'patient_payment_requests'
    AND column_name = 'appointment_id'
    AND data_type = 'integer'
  ) THEN
    RAISE NOTICE '✅ appointment_id is INTEGER type';
  ELSE
    RAISE EXCEPTION '❌ appointment_id is not INTEGER type';
  END IF;
END $$;
