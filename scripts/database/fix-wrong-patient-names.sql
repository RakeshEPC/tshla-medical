-- =====================================================
-- Fix Wrong Patient Names in Pump Assessments
-- Run this in Supabase SQL Editor
-- =====================================================
-- Created: 2025-10-10
-- Purpose: Fix pump_assessments that have wrong patient names due to stale sessionStorage bug
-- This script updates patient_name to match the actual name from the patients table
-- =====================================================

-- Step 1: Show assessments with mismatched names (for verification)
SELECT
  pa.id AS assessment_id,
  pa.patient_name AS current_wrong_name,
  CONCAT(p.first_name, ' ', p.last_name) AS correct_name_from_db,
  pa.created_at,
  pa.first_choice_pump
FROM public.pump_assessments pa
INNER JOIN public.patients p ON pa.patient_id = p.id
WHERE pa.patient_name != CONCAT(p.first_name, ' ', p.last_name)
ORDER BY pa.created_at DESC;

-- Step 2: Update all pump_assessments to use correct patient names from patients table
UPDATE public.pump_assessments pa
SET
  patient_name = CONCAT(p.first_name, ' ', p.last_name),
  updated_at = NOW()
FROM public.patients p
WHERE pa.patient_id = p.id
  AND pa.patient_name != CONCAT(p.first_name, ' ', p.last_name);

-- Step 3: Verify the fix - this should return 0 rows if successful
SELECT
  pa.id AS assessment_id,
  pa.patient_name AS updated_name,
  CONCAT(p.first_name, ' ', p.last_name) AS db_name,
  CASE
    WHEN pa.patient_name = CONCAT(p.first_name, ' ', p.last_name) THEN '✅ FIXED'
    ELSE '❌ STILL WRONG'
  END AS status
FROM public.pump_assessments pa
INNER JOIN public.patients p ON pa.patient_id = p.id
ORDER BY pa.created_at DESC;

-- Step 4: Show summary statistics
SELECT
  COUNT(*) AS total_assessments,
  COUNT(DISTINCT pa.patient_id) AS unique_patients,
  COUNT(CASE
    WHEN pa.patient_name = CONCAT(p.first_name, ' ', p.last_name)
    THEN 1
  END) AS correct_names,
  COUNT(CASE
    WHEN pa.patient_name != CONCAT(p.first_name, ' ', p.last_name)
    THEN 1
  END) AS wrong_names
FROM public.pump_assessments pa
INNER JOIN public.patients p ON pa.patient_id = p.id;

-- =====================================================
-- IMPORTANT NOTES:
-- 1. This script fixes existing data in the database
-- 2. The code fixes (PatientRegistration.tsx, PumpDriveResults.tsx, supabaseAuth.service.ts)
--    prevent this bug from happening in the future
-- 3. Run this script AFTER deploying the code fixes
-- 4. This is a one-time cleanup script
-- =====================================================

-- Step 5: Optional - Show all assessments with patient details
SELECT
  pa.id AS assessment_id,
  pa.patient_name,
  CONCAT(p.first_name, ' ', p.last_name) AS patient_full_name_from_db,
  p.email,
  p.ava_id,
  pa.first_choice_pump,
  pa.second_choice_pump,
  pa.third_choice_pump,
  pa.created_at,
  pa.updated_at
FROM public.pump_assessments pa
INNER JOIN public.patients p ON pa.patient_id = p.id
ORDER BY pa.created_at DESC;
