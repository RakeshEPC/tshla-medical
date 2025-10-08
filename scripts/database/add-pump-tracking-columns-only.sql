-- =====================================================
-- Add ONLY the missing pump choice tracking columns
-- Run this if pump_assessments table already exists
-- =====================================================

-- Add pump tracking columns (IF NOT EXISTS prevents errors if already added)
ALTER TABLE public.pump_assessments
  ADD COLUMN IF NOT EXISTS first_choice_pump VARCHAR(255),
  ADD COLUMN IF NOT EXISTS second_choice_pump VARCHAR(255),
  ADD COLUMN IF NOT EXISTS third_choice_pump VARCHAR(255),
  ADD COLUMN IF NOT EXISTS recommendation_date TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS assessment_version INTEGER DEFAULT 1;

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_pump_assessments_first_choice
  ON public.pump_assessments(first_choice_pump);

CREATE INDEX IF NOT EXISTS idx_pump_assessments_recommendation_date
  ON public.pump_assessments(recommendation_date DESC);

CREATE INDEX IF NOT EXISTS idx_pump_assessments_user_date
  ON public.pump_assessments(user_id, recommendation_date DESC);

-- Add documentation
COMMENT ON COLUMN public.pump_assessments.first_choice_pump IS 'Top recommended insulin pump from assessment';
COMMENT ON COLUMN public.pump_assessments.second_choice_pump IS 'Second choice backup pump';
COMMENT ON COLUMN public.pump_assessments.third_choice_pump IS 'Third choice backup pump';
COMMENT ON COLUMN public.pump_assessments.recommendation_date IS 'When this pump recommendation was made';
COMMENT ON COLUMN public.pump_assessments.assessment_version IS 'Version number if user retakes assessment (1, 2, 3...)';

-- Success message
SELECT 'SUCCESS! Pump choice tracking columns added to existing table.' AS status;
