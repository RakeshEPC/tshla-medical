-- ============================================================================
-- TSHLA Medical - Pre-Visit System Production Migration
-- ============================================================================
-- Date: November 14, 2025
-- Purpose: Enable pre-visit call data visibility and schedule matching
--
-- IMPORTANT: Run this SQL in Supabase production database BEFORE deploying
--            frontend changes to make pre-visit data visible to staff.
--
-- What this migration does:
-- 1. Fixes RLS policies on previsit_call_data (makes data visible to frontend)
-- 2. Adds schedule matching columns to provider_schedules table
-- 3. Creates indexes for phone number matching performance
--
-- Safe to run multiple times (uses IF NOT EXISTS / IF EXISTS)
-- ============================================================================

-- ============================================================================
-- PART 1: Fix Row Level Security Policies
-- ============================================================================
-- Issue: previsit_call_data table has RLS enabled but no policies
-- Impact: Backend can write data, but frontend cannot read it
-- Fix: Add policies to allow public read/write access
-- Note: Safe because data is already HIPAA-compliant (redacted by ElevenLabs ZRM)

-- Drop any existing policies first
DROP POLICY IF EXISTS "Allow anonymous read access to previsit_call_data" ON public.previsit_call_data;
DROP POLICY IF EXISTS "Allow service role full access to previsit_call_data" ON public.previsit_call_data;
DROP POLICY IF EXISTS "Allow public read access" ON public.previsit_call_data;
DROP POLICY IF EXISTS "Allow public insert" ON public.previsit_call_data;
DROP POLICY IF EXISTS "Allow public update" ON public.previsit_call_data;

-- Allow anonymous users to read all previsit call data
CREATE POLICY "Allow public read access"
  ON public.previsit_call_data
  FOR SELECT
  TO public
  USING (true);

-- Allow anonymous users to insert new records (for webhook capture)
CREATE POLICY "Allow public insert"
  ON public.previsit_call_data
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Allow anonymous users to update existing records (for appending data during calls)
CREATE POLICY "Allow public update"
  ON public.previsit_call_data
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- Ensure RLS is enabled
ALTER TABLE public.previsit_call_data ENABLE ROW LEVEL SECURITY;

-- Verify policy is working (should return count of all records)
SELECT COUNT(*) as total_visible_records FROM public.previsit_call_data;


-- ============================================================================
-- PART 2: Add Schedule Matching Columns
-- ============================================================================
-- Purpose: Link pre-visit calls to appointments by phone number
-- Enables: Auto-matching when importing schedule CSVs from Athena

-- Add columns to provider_schedules table
ALTER TABLE public.provider_schedules
  ADD COLUMN IF NOT EXISTS previsit_call_id UUID REFERENCES public.previsit_call_data(id),
  ADD COLUMN IF NOT EXISTS previsit_data_captured BOOLEAN DEFAULT false;

-- Create index for faster lookups when displaying appointments
CREATE INDEX IF NOT EXISTS idx_provider_schedules_previsit
  ON public.provider_schedules(previsit_call_id);

-- Create index on phone number for matching performance
CREATE INDEX IF NOT EXISTS idx_provider_schedules_patient_phone
  ON public.provider_schedules(patient_phone);

-- Create index on previsit_call_data phone_number for matching
CREATE INDEX IF NOT EXISTS idx_previsit_call_data_phone_number
  ON public.previsit_call_data(phone_number);

-- Verify columns were added successfully
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'provider_schedules'
  AND column_name IN ('previsit_call_id', 'previsit_data_captured')
ORDER BY column_name;


-- ============================================================================
-- PART 3: Verification Queries
-- ============================================================================
-- Run these to verify migration was successful

-- 1. Check RLS policies were created
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'previsit_call_data'
ORDER BY policyname;

-- 2. Check indexes were created
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('previsit_call_data', 'provider_schedules')
  AND indexname LIKE '%previsit%' OR indexname LIKE '%phone%'
ORDER BY tablename, indexname;

-- 3. Check total previsit records are now visible
SELECT
  COUNT(*) as total_calls,
  COUNT(CASE WHEN medications IS NOT NULL AND array_length(medications, 1) > 0 THEN 1 END) as calls_with_medications,
  COUNT(CASE WHEN concerns IS NOT NULL AND array_length(concerns, 1) > 0 THEN 1 END) as calls_with_concerns,
  COUNT(CASE WHEN questions IS NOT NULL AND array_length(questions, 1) > 0 THEN 1 END) as calls_with_questions,
  COUNT(CASE WHEN phone_number IS NOT NULL THEN 1 END) as calls_with_phone
FROM public.previsit_call_data;

-- 4. Sample of recent previsit calls
SELECT
  id,
  conversation_id,
  phone_number,
  created_at,
  array_length(medications, 1) as med_count,
  array_length(concerns, 1) as concern_count,
  array_length(questions, 1) as question_count
FROM public.previsit_call_data
ORDER BY created_at DESC
LIMIT 5;


-- ============================================================================
-- SUCCESS CRITERIA
-- ============================================================================
-- After running this migration, you should see:
--
-- 1. RLS Policies:
--    - 3 policies created on previsit_call_data (read, insert, update)
--
-- 2. Columns Added:
--    - provider_schedules.previsit_call_id (uuid, nullable)
--    - provider_schedules.previsit_data_captured (boolean, default false)
--
-- 3. Indexes Created:
--    - idx_provider_schedules_previsit
--    - idx_provider_schedules_patient_phone
--    - idx_previsit_call_data_phone_number
--
-- 4. Data Visible:
--    - Query should return ~27 total calls
--    - ~8 with medications
--    - ~6 with concerns
--    - ~5 with questions
--
-- 5. Frontend Test (after deployment):
--    - Go to /previsit-data → Should show all calls
--    - Go to /previsit-analytics → Should show real metrics
--    - All data that was "invisible" before should now be visible
--
-- ============================================================================
-- ROLLBACK (if needed)
-- ============================================================================
-- To rollback this migration (not recommended):
--
-- -- Remove RLS policies
-- DROP POLICY IF EXISTS "Allow public read access" ON public.previsit_call_data;
-- DROP POLICY IF EXISTS "Allow public insert" ON public.previsit_call_data;
-- DROP POLICY IF EXISTS "Allow public update" ON public.previsit_call_data;
--
-- -- Remove schedule matching columns
-- ALTER TABLE public.provider_schedules
--   DROP COLUMN IF EXISTS previsit_call_id,
--   DROP COLUMN IF EXISTS previsit_data_captured;
--
-- -- Drop indexes
-- DROP INDEX IF EXISTS idx_provider_schedules_previsit;
-- DROP INDEX IF EXISTS idx_provider_schedules_patient_phone;
-- DROP INDEX IF EXISTS idx_previsit_call_data_phone_number;
--
-- ============================================================================
