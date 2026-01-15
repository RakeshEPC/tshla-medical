-- Fix patient_payment_requests table - Add all missing columns
-- The table was created but many columns from the schema were missing
-- Created: 2026-01-15

-- Add all missing columns with IF NOT EXISTS for safety
ALTER TABLE patient_payment_requests
  ADD COLUMN IF NOT EXISTS previsit_id UUID REFERENCES previsit_data(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES provider_schedules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS patient_id UUID,
  ADD COLUMN IF NOT EXISTS tshla_id VARCHAR(20),
  ADD COLUMN IF NOT EXISTS share_link_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS patient_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS patient_phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS athena_mrn VARCHAR(50),
  ADD COLUMN IF NOT EXISTS em_code VARCHAR(10),
  ADD COLUMN IF NOT EXISTS stripe_session_id VARCHAR(255) UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS stripe_charge_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS posted_in_emr BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS posted_in_emr_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS posted_in_emr_by UUID REFERENCES medical_staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provider_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS visit_date DATE,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES medical_staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add constraints if they don't exist
DO $$
BEGIN
  -- Add payment_status check constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'patient_payment_requests_payment_status_check'
  ) THEN
    ALTER TABLE patient_payment_requests
      ADD CONSTRAINT patient_payment_requests_payment_status_check
      CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'canceled'));
  END IF;

  -- Add payment_type check constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'patient_payment_requests_payment_type_check'
  ) THEN
    ALTER TABLE patient_payment_requests
      ADD CONSTRAINT patient_payment_requests_payment_type_check
      CHECK (payment_type IN ('copay', 'deductible', 'balance', 'other'));
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_requests_patient
  ON patient_payment_requests(patient_id);

CREATE INDEX IF NOT EXISTS idx_payment_requests_tshla_id
  ON patient_payment_requests(tshla_id)
  WHERE tshla_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_requests_status
  ON patient_payment_requests(payment_status);

CREATE INDEX IF NOT EXISTS idx_payment_requests_posted
  ON patient_payment_requests(posted_in_emr)
  WHERE posted_in_emr = FALSE;

CREATE INDEX IF NOT EXISTS idx_payment_requests_stripe_session
  ON patient_payment_requests(stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_requests_created_at
  ON patient_payment_requests(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_requests_pending_payments
  ON patient_payment_requests(tshla_id, payment_status, created_at DESC)
  WHERE payment_status = 'pending';

-- Add trigger for auto-updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_payment_request_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_payment_request_timestamp ON patient_payment_requests;
CREATE TRIGGER trigger_update_payment_request_timestamp
  BEFORE UPDATE ON patient_payment_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_request_timestamp();

-- Add comments
COMMENT ON TABLE patient_payment_requests IS 'Tracks online payment requests sent to patients for copays, deductibles, and balances via Stripe';
COMMENT ON COLUMN patient_payment_requests.amount_cents IS 'Payment amount in cents (e.g., 2500 = $25.00)';
COMMENT ON COLUMN patient_payment_requests.payment_type IS 'Type of payment: copay, deductible, balance, or other';
COMMENT ON COLUMN patient_payment_requests.payment_status IS 'Current status: pending (awaiting payment), paid, failed, refunded, or canceled';
COMMENT ON COLUMN patient_payment_requests.posted_in_emr IS 'Whether payment has been posted to EMR system (for reconciliation)';
COMMENT ON COLUMN patient_payment_requests.stripe_session_id IS 'Stripe Checkout Session ID for tracking payment';
COMMENT ON COLUMN patient_payment_requests.tshla_id IS 'Patient TSHLA ID for portal access and payment lookup';
COMMENT ON COLUMN patient_payment_requests.share_link_id IS 'Share link ID from patient_audio_summaries for payment portal URL';
COMMENT ON COLUMN patient_payment_requests.created_by IS 'Staff member who created this payment request';

-- Verify all critical columns exist
DO $$
DECLARE
  missing_columns TEXT[];
  col TEXT;
BEGIN
  -- Check for required columns
  SELECT ARRAY_AGG(column_name::TEXT)
  INTO missing_columns
  FROM (
    VALUES
      ('patient_id'),
      ('tshla_id'),
      ('patient_name'),
      ('amount_cents'),
      ('payment_type'),
      ('payment_status'),
      ('created_by'),
      ('created_at')
  ) AS required(column_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'patient_payment_requests'
    AND column_name = required.column_name
  );

  IF missing_columns IS NOT NULL THEN
    RAISE EXCEPTION '❌ Missing columns in patient_payment_requests: %', array_to_string(missing_columns, ', ');
  ELSE
    RAISE NOTICE '✅ All required columns exist in patient_payment_requests table';
  END IF;
END $$;
