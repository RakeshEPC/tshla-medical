-- =====================================================
-- Add Pump Choice Tracking Columns to pump_assessments
-- Run this in: Supabase Dashboard → SQL Editor
-- URL: https://supabase.com/dashboard/project/minvvjdflezibmgkplqb/sql/new
-- =====================================================

-- Add columns for tracking pump recommendations
ALTER TABLE public.pump_assessments
  ADD COLUMN IF NOT EXISTS first_choice_pump VARCHAR(255),
  ADD COLUMN IF NOT EXISTS second_choice_pump VARCHAR(255),
  ADD COLUMN IF NOT EXISTS third_choice_pump VARCHAR(255),
  ADD COLUMN IF NOT EXISTS recommendation_date TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS assessment_version INTEGER DEFAULT 1;

-- Add index for faster queries by pump choices
CREATE INDEX IF NOT EXISTS idx_pump_assessments_first_choice
  ON public.pump_assessments(first_choice_pump);

CREATE INDEX IF NOT EXISTS idx_pump_assessments_recommendation_date
  ON public.pump_assessments(recommendation_date DESC);

CREATE INDEX IF NOT EXISTS idx_pump_assessments_user_date
  ON public.pump_assessments(user_id, recommendation_date DESC);

-- Add comment documentation
COMMENT ON COLUMN public.pump_assessments.first_choice_pump IS 'Top recommended insulin pump from assessment';
COMMENT ON COLUMN public.pump_assessments.second_choice_pump IS 'Second choice backup pump';
COMMENT ON COLUMN public.pump_assessments.third_choice_pump IS 'Third choice backup pump';
COMMENT ON COLUMN public.pump_assessments.recommendation_date IS 'When this pump recommendation was made';
COMMENT ON COLUMN public.pump_assessments.assessment_version IS 'Version number if user retakes assessment (1, 2, 3...)';

-- Success message
SELECT
  'SUCCESS! Pump choice tracking columns added.' AS status,
  'Columns: first_choice_pump, second_choice_pump, third_choice_pump, recommendation_date, assessment_version' AS details;

-- =====================================================
-- VERIFICATION QUERY
-- Run this to verify columns were added successfully:
-- =====================================================
/*
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'pump_assessments'
  AND column_name IN ('first_choice_pump', 'second_choice_pump', 'third_choice_pump', 'recommendation_date', 'assessment_version')
ORDER BY column_name;
*/

-- =====================================================
-- EXAMPLE QUERIES AFTER IMPLEMENTATION
-- =====================================================

-- Get user's latest assessment with pump choices
/*
SELECT
  id,
  patient_name,
  first_choice_pump,
  second_choice_pump,
  third_choice_pump,
  recommendation_date,
  assessment_version
FROM pump_assessments
WHERE user_id = YOUR_USER_ID
ORDER BY recommendation_date DESC
LIMIT 1;
*/

-- Get user's full assessment history
/*
SELECT
  assessment_version,
  first_choice_pump,
  second_choice_pump,
  third_choice_pump,
  recommendation_date
FROM pump_assessments
WHERE user_id = YOUR_USER_ID
ORDER BY assessment_version ASC;
*/

-- Most popular pumps in last 30 days
/*
SELECT
  first_choice_pump,
  COUNT(*) as recommendation_count
FROM pump_assessments
WHERE recommendation_date >= NOW() - INTERVAL '30 days'
  AND first_choice_pump IS NOT NULL
GROUP BY first_choice_pump
ORDER BY recommendation_count DESC;
*/

-- Track how user preferences changed over time
/*
SELECT
  user_id,
  assessment_version,
  first_choice_pump,
  recommendation_date
FROM pump_assessments
WHERE user_id = YOUR_USER_ID
ORDER BY assessment_version ASC;
*/

-- Top 3 pump combination patterns
/*
SELECT
  first_choice_pump,
  second_choice_pump,
  third_choice_pump,
  COUNT(*) as combo_count
FROM pump_assessments
WHERE first_choice_pump IS NOT NULL
GROUP BY first_choice_pump, second_choice_pump, third_choice_pump
ORDER BY combo_count DESC
LIMIT 10;
*/
