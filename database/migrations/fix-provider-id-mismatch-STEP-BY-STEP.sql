-- =====================================================
-- Fix Provider ID Mismatch - STEP BY STEP
-- =====================================================
-- Run each section ONE AT A TIME, checking output
-- =====================================================

-- =====================================================
-- STEP 1: ADD COLUMN (Run this first)
-- =====================================================

ALTER TABLE medical_staff
  ADD COLUMN IF NOT EXISTS athena_provider_id VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_medical_staff_athena_id
  ON medical_staff(athena_provider_id)
  WHERE athena_provider_id IS NOT NULL;

-- ✅ Run this, then proceed to STEP 2


-- =====================================================
-- STEP 2: MAP EXISTING PROVIDERS (Run after Step 1)
-- =====================================================

-- Bernander, Radha
UPDATE medical_staff
SET athena_provider_id = 'GC_EPC_Bernander_R'
WHERE LOWER(last_name) = 'bernander';

-- Chamakkala, Tess
UPDATE medical_staff
SET athena_provider_id = 'GC_EPC_Chamakkala_T'
WHERE LOWER(last_name) = 'chamakkala';

-- Gregorek, Shannon (handles typo 'Gregroek')
UPDATE medical_staff
SET athena_provider_id = 'GC_EPC_Gregorek_S'
WHERE LOWER(last_name) IN ('gregorek', 'gregroek');

-- Laverde, Cindy
UPDATE medical_staff
SET athena_provider_id = 'GC_EPC_Laverde_C'
WHERE LOWER(last_name) = 'laverde'
  AND LOWER(first_name) = 'cindy';

-- Patel, Neha
UPDATE medical_staff
SET athena_provider_id = 'GC_EPC_Patel_N'
WHERE LOWER(last_name) = 'patel'
  AND LOWER(first_name) = 'neha';

-- Patel, Rakesh (only doctor role, not admin)
UPDATE medical_staff
SET athena_provider_id = 'GC_EPC_Patel_R'
WHERE LOWER(last_name) = 'patel'
  AND LOWER(first_name) = 'rakesh'
  AND role = 'doctor';

-- Shakya, Elinia
UPDATE medical_staff
SET athena_provider_id = 'GC_EPC_Shakya_E'
WHERE LOWER(last_name) = 'shakya';

-- Tonye, Ghislaine
UPDATE medical_staff
SET athena_provider_id = 'GC_EPC_Tonye_G'
WHERE LOWER(last_name) = 'tonye';

-- Wade-Reescano, Kamili
UPDATE medical_staff
SET athena_provider_id = 'GC_EPC_Wade-Reescano'
WHERE LOWER(last_name) = 'wade-reescano';

-- Watwe, Veena
UPDATE medical_staff
SET athena_provider_id = 'GC_EPC_Watwe_V'
WHERE LOWER(last_name) = 'watwe';

-- Younus, Nadia
UPDATE medical_staff
SET athena_provider_id = 'GC_EPC_Younus_N'
WHERE LOWER(last_name) = 'younus';

-- ✅ Check results:
SELECT first_name, last_name, role, athena_provider_id
FROM medical_staff
WHERE is_active = true
ORDER BY last_name;


-- =====================================================
-- STEP 3: ADD MISSING PROVIDERS (Run after Step 2)
-- =====================================================

-- Adeleke (NP)
INSERT INTO medical_staff (first_name, last_name, role, is_active, athena_provider_id, email)
VALUES ('A', 'Adeleke', 'nurse_practitioner', true, 'GC_EPC_Adeleke_A', 'adeleke@tshla.ai')
ON CONFLICT (email) DO UPDATE SET athena_provider_id = 'GC_EPC_Adeleke_A';

-- Leal (Dietitian)
INSERT INTO medical_staff (first_name, last_name, role, is_active, athena_provider_id, email)
VALUES ('E', 'Leal', 'dietitian', true, 'GC_EPC_Leal_E', 'leal@tshla.ai')
ON CONFLICT (email) DO UPDATE SET athena_provider_id = 'GC_EPC_Leal_E';

-- Nebeolisa (MD)
INSERT INTO medical_staff (first_name, last_name, role, is_active, athena_provider_id, email)
VALUES ('O', 'Nebeolisa', 'doctor', true, 'GC_EPC_Nebeolisa_O', 'nebeolisa@tshla.ai')
ON CONFLICT (email) DO UPDATE SET athena_provider_id = 'GC_EPC_Nebeolisa_O';

-- Patel-Konasag, Kruti (NP)
INSERT INTO medical_staff (first_name, last_name, role, is_active, athena_provider_id, email)
VALUES ('Kruti', 'Patel-Konasag', 'nurse_practitioner', true, 'GC_EPC_Patel-Konasag', 'kruti.patel@tshla.ai')
ON CONFLICT (email) DO UPDATE SET athena_provider_id = 'GC_EPC_Patel-Konasag';

-- Raghu, Preeya (MD)
INSERT INTO medical_staff (first_name, last_name, role, is_active, athena_provider_id, email)
VALUES ('Preeya', 'Raghu', 'doctor', true, 'GC_EPC_Raghu_P', 'preeya.raghu@tshla.ai')
ON CONFLICT (email) DO UPDATE SET athena_provider_id = 'GC_EPC_Raghu_P';

-- Subawalla, Dil (Psychologist)
INSERT INTO medical_staff (first_name, last_name, role, is_active, athena_provider_id, email)
VALUES ('Dil', 'Subawalla', 'psychologist', true, 'GC_EPC_Subawalla_D', 'dil.subawalla@tshla.ai')
ON CONFLICT (email) DO UPDATE SET athena_provider_id = 'GC_EPC_Subawalla_D';

-- ✅ Check all providers now:
SELECT first_name, last_name, role, athena_provider_id, email
FROM medical_staff
WHERE is_active = true
  AND athena_provider_id IS NOT NULL
ORDER BY last_name;


-- =====================================================
-- STEP 4: VERIFICATION (Run after Step 3)
-- =====================================================

-- Count by role
SELECT
  role,
  COUNT(*) as total,
  COUNT(athena_provider_id) as with_mapping
FROM medical_staff
WHERE is_active = true
GROUP BY role
ORDER BY total DESC;

-- All active providers with mapping
SELECT
  first_name || ' ' || last_name as name,
  role,
  athena_provider_id,
  email
FROM medical_staff
WHERE is_active = true
  AND athena_provider_id IS NOT NULL
ORDER BY last_name, first_name;

-- ✅ Should show ~16-17 providers

-- =====================================================
-- DONE! ✅
-- =====================================================
-- Now refresh your app and test the provider dropdown
-- =====================================================
