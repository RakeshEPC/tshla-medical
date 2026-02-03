-- Add card_last_4 column to patient_payment_requests table
-- This stores the last 4 digits of the credit card used for payment
-- Created: 2026-02-02

-- Add the column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patient_payment_requests'
    AND column_name = 'card_last_4'
  ) THEN
    ALTER TABLE patient_payment_requests
    ADD COLUMN card_last_4 VARCHAR(4);

    COMMENT ON COLUMN patient_payment_requests.card_last_4 IS 'Last 4 digits of credit card used for payment';

    RAISE NOTICE 'Column card_last_4 added successfully';
  ELSE
    RAISE NOTICE 'Column card_last_4 already exists';
  END IF;
END $$;

-- Verify the column was added
SELECT
  column_name,
  data_type,
  character_maximum_length,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'patient_payment_requests'
  AND column_name = 'card_last_4';
