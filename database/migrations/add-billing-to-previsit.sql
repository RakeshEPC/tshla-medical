-- Add billing and payment tracking to previsit_data table
-- Created: 2026-01-14
-- Purpose: Track E/M codes, copays, amounts charged, and payment status in pre-visit workflow

ALTER TABLE previsit_data
  ADD COLUMN IF NOT EXISTS em_code VARCHAR(10),
  ADD COLUMN IF NOT EXISTS copay_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS amount_charged DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS patient_paid BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
  ADD COLUMN IF NOT EXISTS billing_notes TEXT,
  ADD COLUMN IF NOT EXISTS billing_updated_at TIMESTAMPTZ;

-- Add index for querying unpaid visits
CREATE INDEX IF NOT EXISTS idx_previsit_patient_paid
  ON previsit_data(patient_paid)
  WHERE patient_paid = false;

-- Add index for E/M code reporting
CREATE INDEX IF NOT EXISTS idx_previsit_em_code
  ON previsit_data(em_code)
  WHERE em_code IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN previsit_data.em_code IS 'Evaluation and Management code (e.g., 99213, 99214)';
COMMENT ON COLUMN previsit_data.copay_amount IS 'Patient copay or deductible amount in dollars';
COMMENT ON COLUMN previsit_data.amount_charged IS 'Total amount charged to patient for visit';
COMMENT ON COLUMN previsit_data.patient_paid IS 'Whether patient has paid their balance';
COMMENT ON COLUMN previsit_data.payment_method IS 'How patient paid: cash, credit card, debit card, check, etc.';
COMMENT ON COLUMN previsit_data.billing_notes IS 'Free-text notes about billing, payment plans, or special circumstances';
COMMENT ON COLUMN previsit_data.billing_updated_at IS 'Timestamp when billing information was last updated';
