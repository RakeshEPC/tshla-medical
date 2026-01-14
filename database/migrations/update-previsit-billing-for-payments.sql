-- Add Payment Request Tracking to Pre-Visit Data
-- Created: 2026-01-14
-- Purpose: Link pre-visit billing to payment requests for online payments

-- Add column to track active payment request
ALTER TABLE previsit_data
  ADD COLUMN IF NOT EXISTS active_payment_request_id UUID REFERENCES patient_payment_requests(id) ON DELETE SET NULL;

-- Add index for quick lookup
CREATE INDEX IF NOT EXISTS idx_previsit_active_payment
  ON previsit_data(active_payment_request_id)
  WHERE active_payment_request_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN previsit_data.active_payment_request_id IS 'Current active payment request for this visit (if online payment enabled)';
