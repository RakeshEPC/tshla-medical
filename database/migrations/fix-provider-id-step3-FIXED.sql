-- =====================================================
-- STEP 3: ADD MISSING PROVIDERS (FIXED)
-- =====================================================
-- Run this after completing Step 1 and Step 2
-- =====================================================

-- Adeleke (NP)
INSERT INTO medical_staff (username, first_name, last_name, role, is_active, athena_provider_id, email)
VALUES ('adeleke', 'A', 'Adeleke', 'nurse_practitioner', true, 'GC_EPC_Adeleke_A', 'adeleke@tshla.ai')
ON CONFLICT (email) DO UPDATE SET athena_provider_id = 'GC_EPC_Adeleke_A', username = 'adeleke';

-- Leal (Dietitian)
INSERT INTO medical_staff (username, first_name, last_name, role, is_active, athena_provider_id, email)
VALUES ('leal', 'E', 'Leal', 'dietitian', true, 'GC_EPC_Leal_E', 'leal@tshla.ai')
ON CONFLICT (email) DO UPDATE SET athena_provider_id = 'GC_EPC_Leal_E', username = 'leal';

-- Nebeolisa (MD)
INSERT INTO medical_staff (username, first_name, last_name, role, is_active, athena_provider_id, email)
VALUES ('nebeolisa', 'O', 'Nebeolisa', 'doctor', true, 'GC_EPC_Nebeolisa_O', 'nebeolisa@tshla.ai')
ON CONFLICT (email) DO UPDATE SET athena_provider_id = 'GC_EPC_Nebeolisa_O', username = 'nebeolisa';

-- Patel-Konasag, Kruti (NP)
INSERT INTO medical_staff (username, first_name, last_name, role, is_active, athena_provider_id, email)
VALUES ('kruti.patel', 'Kruti', 'Patel-Konasag', 'nurse_practitioner', true, 'GC_EPC_Patel-Konasag', 'kruti.patel@tshla.ai')
ON CONFLICT (email) DO UPDATE SET athena_provider_id = 'GC_EPC_Patel-Konasag', username = 'kruti.patel';

-- Raghu, Preeya (MD)
INSERT INTO medical_staff (username, first_name, last_name, role, is_active, athena_provider_id, email)
VALUES ('preeya.raghu', 'Preeya', 'Raghu', 'doctor', true, 'GC_EPC_Raghu_P', 'preeya.raghu@tshla.ai')
ON CONFLICT (email) DO UPDATE SET athena_provider_id = 'GC_EPC_Raghu_P', username = 'preeya.raghu';

-- Subawalla, Dil (Psychologist)
INSERT INTO medical_staff (username, first_name, last_name, role, is_active, athena_provider_id, email)
VALUES ('dil.subawalla', 'Dil', 'Subawalla', 'psychologist', true, 'GC_EPC_Subawalla_D', 'dil.subawalla@tshla.ai')
ON CONFLICT (email) DO UPDATE SET athena_provider_id = 'GC_EPC_Subawalla_D', username = 'dil.subawalla';


-- ✅ Check all providers now:
SELECT
  first_name,
  last_name,
  role,
  athena_provider_id,
  email,
  username
FROM medical_staff
WHERE is_active = true
  AND athena_provider_id IS NOT NULL
ORDER BY last_name, first_name;

-- Expected: ~17 providers total
