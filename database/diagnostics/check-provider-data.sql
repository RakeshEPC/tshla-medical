-- =====================================================
-- Provider Data Diagnostic Queries
-- =====================================================
-- Run these in Supabase SQL Editor to diagnose why
-- only 2 providers show in the appointment dropdown
-- =====================================================

-- =====================================================
-- 1. Check ALL providers in medical_staff table
-- =====================================================
SELECT
  id,
  first_name,
  last_name,
  first_name || ' ' || last_name as full_name,
  role,
  specialty,
  is_active,
  email,
  created_at
FROM medical_staff
ORDER BY last_name, first_name;

-- Expected: Should see all your providers (Chamakkala, Patel, Watwe, Raghu, etc.)
-- Check: How many have is_active = true?
-- Check: What role values exist? (doctor, nurse_practitioner, dietitian, therapist, etc.)


-- =====================================================
-- 2. Check what ROLE values exist
-- =====================================================
SELECT
  role,
  COUNT(*) as provider_count,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_count
FROM medical_staff
GROUP BY role
ORDER BY provider_count DESC;

-- This shows what roles exist and which might be filtered out


-- =====================================================
-- 3. Check providers that WOULD show in dropdown
-- =====================================================
-- This is what the current AppointmentFormModal query returns:
SELECT
  id,
  first_name,
  last_name,
  first_name || ' ' || last_name as full_name,
  role,
  specialty,
  email
FROM medical_staff
WHERE role IN ('doctor', 'nurse_practitioner', 'physician_assistant')
  AND is_active = true
ORDER BY last_name;

-- Expected: You said only 2 show up - this query will show you which 2


-- =====================================================
-- 4. Check providers from actual schedule
-- =====================================================
SELECT DISTINCT
  provider_id,
  provider_name,
  COUNT(*) as appointment_count,
  MIN(scheduled_date) as first_appointment,
  MAX(scheduled_date) as last_appointment
FROM provider_schedules
WHERE scheduled_date >= '2025-01-01'
GROUP BY provider_id, provider_name
ORDER BY provider_name;

-- This shows all providers who have appointments in the schedule
-- Compare these provider_id values with medical_staff.id


-- =====================================================
-- 5. Check if provider IDs match between tables
-- =====================================================
-- Providers in schedule but NOT in medical_staff:
SELECT DISTINCT
  ps.provider_id,
  ps.provider_name,
  'Missing from medical_staff' as issue
FROM provider_schedules ps
LEFT JOIN medical_staff ms ON ps.provider_id = ms.id
WHERE ms.id IS NULL
  AND ps.scheduled_date >= '2025-01-01'
GROUP BY ps.provider_id, ps.provider_name
ORDER BY ps.provider_name;

-- If this returns rows, it means provider_schedules has providers
-- that don't exist in medical_staff table


-- =====================================================
-- 6. Check format of provider_id
-- =====================================================
SELECT
  provider_id,
  LENGTH(provider_id) as id_length,
  CASE
    WHEN provider_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN 'UUID'
    WHEN provider_id LIKE 'GC_%' THEN 'Athena Format (GC_EPC_*)'
    ELSE 'Other'
  END as id_format
FROM provider_schedules
WHERE scheduled_date >= '2025-01-01'
GROUP BY provider_id
ORDER BY provider_id
LIMIT 20;

-- This checks what format the provider IDs are in


-- =====================================================
-- DIAGNOSIS CHECKLIST
-- =====================================================
-- Run queries above and answer these:
--
-- [ ] How many providers in medical_staff table?
-- [ ] How many have is_active = true?
-- [ ] What role values exist? (doctor, NP, PA, dietitian, therapist, etc.)
-- [ ] How many providers match the current filter (query #3)?
-- [ ] How many providers exist in provider_schedules (query #4)?
-- [ ] Do provider_schedules.provider_id values match medical_staff.id?
-- [ ] What format are the provider IDs? (UUID vs GC_EPC_*)
--
-- =====================================================
