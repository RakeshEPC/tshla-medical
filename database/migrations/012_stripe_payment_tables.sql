-- =====================================================
-- Stripe Payment Integration Tables
-- =====================================================
-- Created: 2026-01-09
-- Purpose: Support Stripe payment processing for pump reports
-- Dependencies: Requires pump_assessments table from previous migrations

-- =====================================================
-- Create payment_records table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Assessment reference
  assessment_id UUID NOT NULL REFERENCES public.pump_assessments(id) ON DELETE CASCADE,

  -- Stripe details
  stripe_session_id TEXT UNIQUE NOT NULL,
  stripe_payment_intent_id TEXT,
  stripe_customer_id TEXT,

  -- Payment info
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'succeeded', 'failed', 'refunded'

  -- Customer details
  customer_email TEXT,
  customer_name TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded', 'canceled')),
  CONSTRAINT positive_amount CHECK (amount_cents > 0)
);

-- =====================================================
-- Update pump_assessments table schema
-- =====================================================
-- Add payment_status column if it doesn't exist
ALTER TABLE public.pump_assessments
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';

-- Add payment_completed_at timestamp
ALTER TABLE public.pump_assessments
ADD COLUMN IF NOT EXISTS payment_completed_at TIMESTAMPTZ;

-- Add constraint for payment_status
ALTER TABLE public.pump_assessments
DROP CONSTRAINT IF EXISTS valid_payment_status;

ALTER TABLE public.pump_assessments
ADD CONSTRAINT valid_payment_status
CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'free'));

-- =====================================================
-- Create indexes for performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_payment_records_assessment_id
  ON public.payment_records(assessment_id);

CREATE INDEX IF NOT EXISTS idx_payment_records_stripe_session_id
  ON public.payment_records(stripe_session_id);

CREATE INDEX IF NOT EXISTS idx_payment_records_status
  ON public.payment_records(status);

CREATE INDEX IF NOT EXISTS idx_payment_records_customer_email
  ON public.payment_records(customer_email);

CREATE INDEX IF NOT EXISTS idx_payment_records_created_at
  ON public.payment_records(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pump_assessments_payment_status
  ON public.pump_assessments(payment_status);

-- =====================================================
-- Enable Row Level Security (RLS)
-- =====================================================
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own payment records
CREATE POLICY "Users can view own payment records"
  ON public.payment_records
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.pump_assessments
      WHERE pump_assessments.id = payment_records.assessment_id
        AND pump_assessments.patient_id = auth.uid()
    )
  );

-- Policy: Admins can view all payment records
CREATE POLICY "Admins can view all payment records"
  ON public.payment_records
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.medical_staff
      WHERE medical_staff.auth_user_id = auth.uid()
        AND medical_staff.role IN ('admin', 'super_admin')
        AND medical_staff.is_active = true
    )
  );

-- Policy: System can insert payment records
CREATE POLICY "System can insert payment records"
  ON public.payment_records
  FOR INSERT
  WITH CHECK (true); -- Server-side only, using service role key

-- Policy: System can update payment records
CREATE POLICY "System can update payment records"
  ON public.payment_records
  FOR UPDATE
  USING (true); -- Server-side only, using service role key

-- =====================================================
-- Create function to update payment status
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_payment_status(
  p_stripe_session_id TEXT,
  p_status TEXT,
  p_stripe_payment_intent_id TEXT DEFAULT NULL,
  p_stripe_customer_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_assessment_id UUID;
  v_updated_count INTEGER;
BEGIN
  -- Update payment record
  UPDATE public.payment_records
  SET
    status = p_status,
    stripe_payment_intent_id = COALESCE(p_stripe_payment_intent_id, stripe_payment_intent_id),
    stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
    paid_at = CASE WHEN p_status = 'succeeded' THEN NOW() ELSE paid_at END,
    updated_at = NOW()
  WHERE stripe_session_id = p_stripe_session_id
  RETURNING assessment_id INTO v_assessment_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  -- If payment succeeded, update assessment
  IF v_updated_count > 0 AND p_status = 'succeeded' THEN
    UPDATE public.pump_assessments
    SET
      payment_status = 'paid',
      payment_completed_at = NOW(),
      updated_at = NOW()
    WHERE id = v_assessment_id;
  END IF;

  RETURN v_updated_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Create function to get payment statistics
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_payment_statistics(
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  total_payments BIGINT,
  total_revenue_cents BIGINT,
  successful_payments BIGINT,
  pending_payments BIGINT,
  failed_payments BIGINT,
  average_amount_cents NUMERIC,
  unique_customers BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_payments,
    SUM(amount_cents)::BIGINT as total_revenue_cents,
    COUNT(*) FILTER (WHERE status = 'succeeded')::BIGINT as successful_payments,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT as pending_payments,
    COUNT(*) FILTER (WHERE status = 'failed')::BIGINT as failed_payments,
    AVG(amount_cents)::NUMERIC as average_amount_cents,
    COUNT(DISTINCT customer_email)::BIGINT as unique_customers
  FROM public.payment_records
  WHERE created_at BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Create function to check if assessment is paid
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_assessment_paid(p_assessment_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_payment_status TEXT;
BEGIN
  SELECT payment_status INTO v_payment_status
  FROM public.pump_assessments
  WHERE id = p_assessment_id;

  RETURN v_payment_status = 'paid';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Grant permissions
-- =====================================================
GRANT SELECT ON public.payment_records TO authenticated;
GRANT SELECT ON public.pump_assessments TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_payment_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_payment_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_assessment_paid TO authenticated;

-- =====================================================
-- Add helpful comments
-- =====================================================
COMMENT ON TABLE public.payment_records IS 'Stripe payment records for pump report purchases';
COMMENT ON COLUMN public.payment_records.stripe_session_id IS 'Stripe Checkout Session ID';
COMMENT ON COLUMN public.payment_records.stripe_payment_intent_id IS 'Stripe Payment Intent ID (populated after payment)';
COMMENT ON COLUMN public.payment_records.amount_cents IS 'Payment amount in cents (e.g., 999 = $9.99)';
COMMENT ON COLUMN public.payment_records.status IS 'Payment status: pending, processing, succeeded, failed, refunded, canceled';
COMMENT ON FUNCTION public.update_payment_status IS 'Updates payment status and associated assessment after Stripe webhook';
COMMENT ON FUNCTION public.get_payment_statistics IS 'Returns payment statistics for analytics dashboard';
COMMENT ON FUNCTION public.is_assessment_paid IS 'Checks if a pump assessment has been paid for';
