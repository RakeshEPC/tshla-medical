-- Add created_by column to patient_payment_requests table
-- This column should have been in the original schema but was missing in production
-- Created: 2026-01-15

-- Add created_by column if it doesn't exist
ALTER TABLE patient_payment_requests
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES medical_staff(id) ON DELETE SET NULL;

-- Add comment
COMMENT ON COLUMN patient_payment_requests.created_by IS 'Staff member who created this payment request';

-- Verify the column was added
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'patient_payment_requests'
    AND column_name = 'created_by'
  ) THEN
    RAISE NOTICE '✅ created_by column exists in patient_payment_requests';
  ELSE
    RAISE EXCEPTION '❌ Failed to add created_by column';
  END IF;
END $$;
