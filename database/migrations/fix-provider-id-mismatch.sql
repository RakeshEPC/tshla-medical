-- =====================================================
-- Fix Provider ID Mismatch Between Tables
-- =====================================================
-- Problem: medical_staff uses UUIDs, provider_schedules uses Athena IDs (GC_EPC_*)
-- Solution: Add athena_provider_id field and populate it
-- =====================================================

-- =====================================================
-- 1. ADD ATHENA PROVIDER ID FIELD
-- =====================================================

ALTER TABLE medical_staff
  ADD COLUMN IF NOT EXISTS athena_provider_id VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_medical_staff_athena_id
  ON medical_staff(athena_provider_id)
  WHERE athena_provider_id IS NOT NULL;

COMMENT ON COLUMN medical_staff.athena_provider_id IS
  'Maps to provider_schedules.provider_id (format: GC_EPC_LastName_Initial)';

-- =====================================================
-- 2. POPULATE ATHENA IDs BY MATCHING LAST NAMES
-- =====================================================

-- Bernander, Radha → GC_EPC_Bernander_R
UPDATE medical_staff
SET athena_provider_id = 'GC_EPC_Bernander_R'
WHERE LOWER(last_name) = 'bernander'
  AND athena_provider_id IS NULL;

-- Chamakkala, Tess → GC_EPC_Chamakkala_T
UPDATE medical_staff
SET athena_provider_id = 'GC_EPC_Chamakkala_T'
WHERE LOWER(last_name) = 'chamakkala'
  AND athena_provider_id IS NULL;

-- Gregorek, Shannon → GC_EPC_Gregorek_S
UPDATE medical_staff
SET athena_provider_id = 'GC_EPC_Gregorek_S'
WHERE LOWER(last_name) IN ('gregorek', 'gregroek')  -- Note: typo in one entry
  AND athena_provider_id IS NULL;

-- Laverde, Cindy/Vanessa → GC_EPC_Laverde_C
-- Note: Two people with same last name - need to match by first name
UPDATE medical_staff
SET athena_provider_id = 'GC_EPC_Laverde_C'
WHERE LOWER(last_name) = 'laverde'
  AND LOWER(first_name) = 'cindy'
  AND athena_provider_id IS NULL;

-- Patel, Neha → GC_EPC_Patel_N
UPDATE medical_staff
SET athena_provider_id = 'GC_EPC_Patel_N'
WHERE LOWER(last_name) = 'patel'
  AND LOWER(first_name) = 'neha'
  AND athena_provider_id IS NULL;

-- Patel, Rakesh → GC_EPC_Patel_R
UPDATE medical_staff
SET athena_provider_id = 'GC_EPC_Patel_R'
WHERE LOWER(last_name) = 'patel'
  AND LOWER(first_name) = 'rakesh'
  AND role = 'doctor'  -- Exclude admin entry
  AND athena_provider_id IS NULL;

-- Shakya, Elinia → GC_EPC_Shakya_E
UPDATE medical_staff
SET athena_provider_id = 'GC_EPC_Shakya_E'
WHERE LOWER(last_name) = 'shakya'
  AND athena_provider_id IS NULL;

-- Tonye, Ghislaine → GC_EPC_Tonye_G
UPDATE medical_staff
SET athena_provider_id = 'GC_EPC_Tonye_G'
WHERE LOWER(last_name) = 'tonye'
  AND athena_provider_id IS NULL;

-- Wade-Reescano, Kamili → GC_EPC_Wade-Reescano
UPDATE medical_staff
SET athena_provider_id = 'GC_EPC_Wade-Reescano'
WHERE LOWER(last_name) = 'wade-reescano'
  AND athena_provider_id IS NULL;

-- Watwe, Veena → GC_EPC_Watwe_V
UPDATE medical_staff
SET athena_provider_id = 'GC_EPC_Watwe_V'
WHERE LOWER(last_name) = 'watwe'
  AND athena_provider_id IS NULL;

-- Younus, Nadia → GC_EPC_Younus_N
UPDATE medical_staff
SET athena_provider_id = 'GC_EPC_Younus_N'
WHERE LOWER(last_name) = 'younus'
  AND athena_provider_id IS NULL;

-- =====================================================
-- 3. ADD MISSING PROVIDERS FROM SCHEDULE
-- =====================================================

-- These providers exist in schedule but NOT in medical_staff:
-- GC_EPC_Adeleke_A, GC_EPC_Leal_E, GC_EPC_Nebeolisa_O,
-- GC_EPC_Patel-Konasag, GC_EPC_Raghu_P, GC_EPC_Subawalla_D

-- Adeleke (NP)
INSERT INTO medical_staff (first_name, last_name, role, is_active, athena_provider_id, email)
VALUES ('A', 'Adeleke', 'nurse_practitioner', true, 'GC_EPC_Adeleke_A', 'adeleke@tshla.ai')
ON CONFLICT DO NOTHING;

-- Leal (Dietitian)
INSERT INTO medical_staff (first_name, last_name, role, is_active, athena_provider_id, email)
VALUES ('E', 'Leal', 'dietitian', true, 'GC_EPC_Leal_E', 'leal@tshla.ai')
ON CONFLICT DO NOTHING;

-- Nebeolisa (MD)
INSERT INTO medical_staff (first_name, last_name, role, is_active, athena_provider_id, email)
VALUES ('O', 'Nebeolisa', 'doctor', true, 'GC_EPC_Nebeolisa_O', 'nebeolisa@tshla.ai')
ON CONFLICT DO NOTHING;

-- Patel-Konasag (NP - Kruti)
INSERT INTO medical_staff (first_name, last_name, role, is_active, athena_provider_id, email)
VALUES ('Kruti', 'Patel-Konasag', 'nurse_practitioner', true, 'GC_EPC_Patel-Konasag', 'kruti.patel@tshla.ai')
ON CONFLICT DO NOTHING;

-- Raghu, Preeya (MD)
INSERT INTO medical_staff (first_name, last_name, role, is_active, athena_provider_id, email)
VALUES ('Preeya', 'Raghu', 'doctor', true, 'GC_EPC_Raghu_P', 'preeya.raghu@tshla.ai')
ON CONFLICT DO NOTHING;

-- Subawalla, Dil (PhD/Psychologist)
INSERT INTO medical_staff (first_name, last_name, role, is_active, athena_provider_id, email)
VALUES ('Dil', 'Subawalla', 'psychologist', true, 'GC_EPC_Subawalla_D', 'dil.subawalla@tshla.ai')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 4. VERIFICATION
-- =====================================================

-- Check mapping results
SELECT
  id,
  first_name,
  last_name,
  role,
  athena_provider_id,
  email,
  CASE
    WHEN athena_provider_id IS NULL THEN '❌ NO MAPPING'
    ELSE '✅ MAPPED'
  END as mapping_status
FROM medical_staff
WHERE is_active = true
ORDER BY last_name, first_name;

-- Check if all schedule providers are now mapped
SELECT
  ps.provider_id as athena_id,
  COUNT(DISTINCT ps.id) as appointment_count,
  ms.first_name,
  ms.last_name,
  ms.role,
  CASE
    WHEN ms.id IS NULL THEN '❌ MISSING'
    ELSE '✅ EXISTS'
  END as in_medical_staff
FROM provider_schedules ps
LEFT JOIN medical_staff ms ON ps.provider_id = ms.athena_provider_id
WHERE ps.scheduled_date >= '2025-01-01'
  AND ps.provider_id NOT LIKE 'unknown%'
  AND ps.provider_id != 'GC_EPC_Idealprotein'
  AND ps.provider_id != 'GC_EPC_Thrive'
GROUP BY ps.provider_id, ms.first_name, ms.last_name, ms.role, ms.id
ORDER BY ps.provider_id;

-- =====================================================
-- MIGRATION COMPLETE ✅
-- =====================================================
