-- Patient Payment Requests Table
-- Created: 2026-01-14
-- Purpose: Track online payment requests sent to patients for copays, deductibles, and balances
--          Integrates with Stripe for payment processing

CREATE TABLE IF NOT EXISTS patient_payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links to other tables
  previsit_id UUID REFERENCES previsit_data(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES provider_schedules(id) ON DELETE SET NULL,
  patient_id UUID,  -- References unified_patients.id (no FK to avoid circular dependency)
  tshla_id VARCHAR(20),  -- For patient portal lookup
  share_link_id VARCHAR(50),  -- For payment portal URL

  -- Patient Information (denormalized for reporting)
  patient_name VARCHAR(255),
  patient_phone VARCHAR(20),
  athena_mrn VARCHAR(50),

  -- Payment Details
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),  -- Amount in cents (e.g., 2500 = $25.00)
  payment_type VARCHAR(50) NOT NULL,  -- 'copay', 'deductible', 'balance'
  em_code VARCHAR(10),  -- E/M code from visit

  -- Stripe Integration
  stripe_session_id VARCHAR(255) UNIQUE,  -- Stripe checkout session ID
  stripe_payment_intent_id VARCHAR(255),  -- Stripe payment intent ID
  stripe_charge_id VARCHAR(255),  -- Stripe charge ID (for refunds)

  -- Payment Status
  payment_status VARCHAR(50) DEFAULT 'pending' NOT NULL,  -- 'pending', 'paid', 'failed', 'refunded', 'canceled'
  paid_at TIMESTAMPTZ,  -- When payment was completed

  -- EMR Posting (Reconciliation)
  posted_in_emr BOOLEAN DEFAULT FALSE,
  posted_in_emr_at TIMESTAMPTZ,
  posted_in_emr_by UUID REFERENCES medical_staff(id) ON DELETE SET NULL,

  -- Visit Metadata
  provider_name VARCHAR(255),
  visit_date DATE,
  notes TEXT,  -- Staff notes about this payment request

  -- Audit Fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES medical_staff(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'canceled')),
  CHECK (payment_type IN ('copay', 'deductible', 'balance', 'other'))
);

-- Indexes for Performance
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

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_payment_request_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_payment_request_timestamp
  BEFORE UPDATE ON patient_payment_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_request_timestamp();

-- Row Level Security
ALTER TABLE patient_payment_requests ENABLE ROW LEVEL SECURITY;

-- Staff can view all payment requests
CREATE POLICY "Staff can view all payment requests" ON patient_payment_requests
  FOR SELECT
  USING (true);

-- Staff can create payment requests
CREATE POLICY "Staff can create payment requests" ON patient_payment_requests
  FOR INSERT
  WITH CHECK (true);

-- Staff can update payment requests
CREATE POLICY "Staff can update payment requests" ON patient_payment_requests
  FOR UPDATE
  USING (true);

-- Service role has full access (for webhooks)
CREATE POLICY "Service role full access" ON patient_payment_requests
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Comments for Documentation
COMMENT ON TABLE patient_payment_requests IS 'Tracks online payment requests sent to patients for copays, deductibles, and balances via Stripe';
COMMENT ON COLUMN patient_payment_requests.amount_cents IS 'Payment amount in cents (e.g., 2500 = $25.00)';
COMMENT ON COLUMN patient_payment_requests.payment_type IS 'Type of payment: copay, deductible, balance, or other';
COMMENT ON COLUMN patient_payment_requests.payment_status IS 'Current status: pending (awaiting payment), paid, failed, refunded, or canceled';
COMMENT ON COLUMN patient_payment_requests.posted_in_emr IS 'Whether payment has been posted to EMR system (for reconciliation)';
COMMENT ON COLUMN patient_payment_requests.stripe_session_id IS 'Stripe Checkout Session ID for tracking payment';
COMMENT ON COLUMN patient_payment_requests.tshla_id IS 'Patient TSHLA ID for portal access and payment lookup';
COMMENT ON COLUMN patient_payment_requests.share_link_id IS 'Share link ID from patient_audio_summaries for payment portal URL';
