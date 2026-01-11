-- =====================================================
-- Access Gate Tracking for Pump Selector
-- =====================================================
-- Created: 2026-01-09
-- Purpose: Track clinic vs independent user access for pump recommendations
-- Business Logic: Clinic patients (EPC) get free access, independent users pay $9.99

-- =====================================================
-- Add access tracking columns to pump_assessments
-- =====================================================
ALTER TABLE public.pump_assessments
ADD COLUMN IF NOT EXISTS access_type TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS clinic_name TEXT,
ADD COLUMN IF NOT EXISTS access_granted_at TIMESTAMPTZ;

-- Add constraint for valid access types
ALTER TABLE public.pump_assessments
DROP CONSTRAINT IF EXISTS valid_access_type;

ALTER TABLE public.pump_assessments
ADD CONSTRAINT valid_access_type
CHECK (access_type IN ('pending', 'clinic', 'independent'));

-- =====================================================
-- Create indexes for analytics and performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_pump_assessments_access_type
  ON public.pump_assessments(access_type);

CREATE INDEX IF NOT EXISTS idx_pump_assessments_clinic_name
  ON public.pump_assessments(clinic_name)
  WHERE clinic_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pump_assessments_access_granted
  ON public.pump_assessments(access_granted_at DESC)
  WHERE access_granted_at IS NOT NULL;

-- =====================================================
-- Create function to grant access
-- =====================================================
CREATE OR REPLACE FUNCTION public.grant_assessment_access(
  p_assessment_id UUID,
  p_access_type TEXT,
  p_clinic_name TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Validate access type
  IF p_access_type NOT IN ('clinic', 'independent') THEN
    RAISE EXCEPTION 'Invalid access type: %', p_access_type;
  END IF;

  -- Grant access
  UPDATE public.pump_assessments
  SET
    access_type = p_access_type,
    clinic_name = p_clinic_name,
    access_granted_at = NOW(),
    updated_at = NOW()
  WHERE id = p_assessment_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Create function to check if user has access to results
-- =====================================================
CREATE OR REPLACE FUNCTION public.has_assessment_access(p_assessment_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_access_type TEXT;
  v_payment_status TEXT;
BEGIN
  SELECT access_type, payment_status
  INTO v_access_type, v_payment_status
  FROM public.pump_assessments
  WHERE id = p_assessment_id;

  -- Clinic patients have free access
  IF v_access_type = 'clinic' THEN
    RETURN TRUE;
  END IF;

  -- Independent users need payment
  IF v_access_type = 'independent' AND v_payment_status = 'paid' THEN
    RETURN TRUE;
  END IF;

  -- Pending or unpaid
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Create analytics function for access statistics
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_access_statistics(
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  total_assessments BIGINT,
  clinic_access BIGINT,
  paid_access BIGINT,
  pending_access BIGINT,
  clinic_percentage NUMERIC,
  paid_percentage NUMERIC,
  epc_clinic_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_assessments,
    COUNT(*) FILTER (WHERE access_type = 'clinic')::BIGINT as clinic_access,
    COUNT(*) FILTER (WHERE access_type = 'independent' AND payment_status = 'paid')::BIGINT as paid_access,
    COUNT(*) FILTER (WHERE access_type = 'pending')::BIGINT as pending_access,
    ROUND(
      (COUNT(*) FILTER (WHERE access_type = 'clinic')::NUMERIC / NULLIF(COUNT(*), 0)) * 100,
      2
    ) as clinic_percentage,
    ROUND(
      (COUNT(*) FILTER (WHERE access_type = 'independent' AND payment_status = 'paid')::NUMERIC / NULLIF(COUNT(*), 0)) * 100,
      2
    ) as paid_percentage,
    COUNT(*) FILTER (WHERE clinic_name = 'Endocrine & Psychiatry Center')::BIGINT as epc_clinic_count
  FROM public.pump_assessments
  WHERE created_at BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Update existing RLS policies
-- =====================================================
-- Users can view their own assessments regardless of payment status
-- (Payment check will be done in application logic)

-- =====================================================
-- Grant permissions
-- =====================================================
GRANT EXECUTE ON FUNCTION public.grant_assessment_access TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_assessment_access TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_access_statistics TO authenticated;

-- =====================================================
-- Add helpful comments
-- =====================================================
COMMENT ON COLUMN public.pump_assessments.access_type IS 'How user accessed tool: pending (not selected), clinic (free via EPC), independent (paid)';
COMMENT ON COLUMN public.pump_assessments.clinic_name IS 'Name of participating clinic if access_type = clinic';
COMMENT ON COLUMN public.pump_assessments.access_granted_at IS 'Timestamp when access was granted (clinic selected or payment completed)';
COMMENT ON FUNCTION public.grant_assessment_access IS 'Grant access to assessment results (clinic free or after payment)';
COMMENT ON FUNCTION public.has_assessment_access IS 'Check if user has access to view assessment results';
COMMENT ON FUNCTION public.get_access_statistics IS 'Analytics: clinic vs paid access breakdown';
