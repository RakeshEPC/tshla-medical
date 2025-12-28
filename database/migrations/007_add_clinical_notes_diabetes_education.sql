-- =====================================================
-- Diabetes Education Enhancement
-- Migration 007: Add clinical notes and focus areas
-- Created: 2025-12-26
-- Purpose: Enable staff to add custom notes and focus areas for each patient
-- =====================================================

-- Add clinical_notes field for free-form text
ALTER TABLE diabetes_education_patients
ADD COLUMN IF NOT EXISTS clinical_notes TEXT;

-- Add focus_areas field for structured focus items
ALTER TABLE diabetes_education_patients
ADD COLUMN IF NOT EXISTS focus_areas JSONB DEFAULT '[]'::jsonb;

-- Add comments
COMMENT ON COLUMN diabetes_education_patients.clinical_notes IS 'Free-form clinical notes and instructions for AI (e.g., "focus on weight loss")';
COMMENT ON COLUMN diabetes_education_patients.focus_areas IS 'Array of focus area tags: ["weight loss", "insulin technique", "carb counting"]';

-- Create index for focus_areas JSONB queries
CREATE INDEX IF NOT EXISTS idx_diabetes_education_patients_focus_areas
  ON diabetes_education_patients USING gin(focus_areas);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 007 completed successfully: Added clinical_notes and focus_areas to diabetes_education_patients';
END $$;
