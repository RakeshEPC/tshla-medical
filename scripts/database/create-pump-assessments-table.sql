-- =====================================================
-- Create pump_assessments table with pump choice tracking
-- Run in Supabase SQL Editor
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create pump_assessments table
CREATE TABLE IF NOT EXISTS public.pump_assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- User Information
  user_id UUID REFERENCES public.pump_users(id) ON DELETE CASCADE,
  patient_name VARCHAR(255) NOT NULL,

  -- Assessment Data (JSON fields for flexibility)
  slider_values JSONB,
  selected_features JSONB,
  lifestyle_text TEXT,
  challenges_text TEXT,
  priorities_text TEXT,
  clarification_responses JSONB,

  -- AI Scores and Recommendations
  gpt4_scores JSONB,
  claude_scores JSONB,
  hybrid_scores JSONB,
  final_recommendation JSONB NOT NULL,

  -- Pump Recommendation Tracking (NEW - for analytics)
  first_choice_pump VARCHAR(255),
  second_choice_pump VARCHAR(255),
  third_choice_pump VARCHAR(255),
  recommendation_date TIMESTAMPTZ DEFAULT NOW(),
  assessment_version INTEGER DEFAULT 1,

  -- Payment and Delivery
  payment_status VARCHAR(50) DEFAULT 'pending',
  payment_amount DECIMAL(10,2),
  payment_date TIMESTAMPTZ,
  stripe_payment_intent_id VARCHAR(255),
  provider_email VARCHAR(255),
  provider_sent_date TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Indexes for Performance
-- =====================================================

-- User lookups
CREATE INDEX IF NOT EXISTS idx_pump_assessments_user_id
  ON public.pump_assessments(user_id);

-- Pump choice analytics
CREATE INDEX IF NOT EXISTS idx_pump_assessments_first_choice
  ON public.pump_assessments(first_choice_pump);

CREATE INDEX IF NOT EXISTS idx_pump_assessments_recommendation_date
  ON public.pump_assessments(recommendation_date DESC);

CREATE INDEX IF NOT EXISTS idx_pump_assessments_user_date
  ON public.pump_assessments(user_id, recommendation_date DESC);

-- Payment tracking
CREATE INDEX IF NOT EXISTS idx_pump_assessments_payment_status
  ON public.pump_assessments(payment_status);

CREATE INDEX IF NOT EXISTS idx_pump_assessments_created
  ON public.pump_assessments(created_at DESC);

-- =====================================================
-- Column Documentation
-- =====================================================

COMMENT ON TABLE public.pump_assessments IS 'Stores complete pump assessment data with AI recommendations and payment tracking';

COMMENT ON COLUMN public.pump_assessments.first_choice_pump IS 'Top recommended insulin pump from assessment';
COMMENT ON COLUMN public.pump_assessments.second_choice_pump IS 'Second choice backup pump';
COMMENT ON COLUMN public.pump_assessments.third_choice_pump IS 'Third choice backup pump';
COMMENT ON COLUMN public.pump_assessments.recommendation_date IS 'When this pump recommendation was made';
COMMENT ON COLUMN public.pump_assessments.assessment_version IS 'Version number if user retakes assessment (1, 2, 3...)';

COMMENT ON COLUMN public.pump_assessments.slider_values IS 'User preferences from slider inputs';
COMMENT ON COLUMN public.pump_assessments.selected_features IS 'Features selected by user during assessment';
COMMENT ON COLUMN public.pump_assessments.final_recommendation IS 'AI-generated pump recommendations with reasoning';

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================

ALTER TABLE public.pump_assessments ENABLE ROW LEVEL SECURITY;

-- Users can view their own assessments
CREATE POLICY "Users can view own assessments"
  ON public.pump_assessments FOR SELECT
  USING (
    auth.uid() = (
      SELECT auth_user_id FROM public.pump_users
      WHERE id = pump_assessments.user_id
    )
  );

-- Users can insert their own assessments
CREATE POLICY "Users can create own assessments"
  ON public.pump_assessments FOR INSERT
  WITH CHECK (
    auth.uid() = (
      SELECT auth_user_id FROM public.pump_users
      WHERE id = pump_assessments.user_id
    )
  );

-- Admins can view all assessments
CREATE POLICY "Admins can view all assessments"
  ON public.pump_assessments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.pump_users
      WHERE auth_user_id = auth.uid() AND is_admin = true
    )
  );

-- Service role has full access (for backend API)
CREATE POLICY "Service role has full access to pump_assessments"
  ON public.pump_assessments FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- Auto-update timestamp trigger
-- =====================================================

CREATE TRIGGER update_pump_assessments_updated_at
  BEFORE UPDATE ON public.pump_assessments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON public.pump_assessments TO authenticated;
GRANT SELECT ON public.pump_assessments TO anon;

-- =====================================================
-- Success Message
-- =====================================================

SELECT
  'SUCCESS! pump_assessments table created with pump choice tracking' AS status,
  'Columns: first_choice_pump, second_choice_pump, third_choice_pump, recommendation_date, assessment_version' AS tracking_columns;
