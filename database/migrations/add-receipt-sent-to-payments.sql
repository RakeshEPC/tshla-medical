-- Add receipt sent tracking to patient_payment_requests
-- Created: 2026-01-15
-- Purpose: Track when payment receipts are sent to patients

ALTER TABLE patient_payment_requests
  ADD COLUMN IF NOT EXISTS receipt_sent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS receipt_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS receipt_sent_by UUID REFERENCES medical_staff(id) ON DELETE SET NULL;

-- Add index for receipt filtering
CREATE INDEX IF NOT EXISTS idx_payment_requests_receipt_sent
  ON patient_payment_requests(receipt_sent)
  WHERE receipt_sent = FALSE AND payment_status = 'paid';

-- Add comments
COMMENT ON COLUMN patient_payment_requests.receipt_sent IS 'Whether payment receipt has been sent to patient';
COMMENT ON COLUMN patient_payment_requests.receipt_sent_at IS 'When receipt was sent to patient';
COMMENT ON COLUMN patient_payment_requests.receipt_sent_by IS 'Staff member who sent the receipt';

-- Verify columns were added
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'patient_payment_requests'
    AND column_name = 'receipt_sent'
  ) THEN
    RAISE NOTICE '✅ receipt_sent column exists in patient_payment_requests';
  ELSE
    RAISE EXCEPTION '❌ Failed to add receipt_sent column';
  END IF;
END $$;
