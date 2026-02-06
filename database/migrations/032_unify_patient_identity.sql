-- ============================================
-- Migration 032: Unify Patient Identity
-- ============================================
-- Purpose: Ensure all patient-related tables use unified_patient_id
--          as the foreign key instead of phone, mrn, or other identifiers
-- Created: 2026-02-06
-- ============================================

-- ISSUE: Many tables still use phone number or other identifiers
--        instead of unified_patients.id as the patient reference

-- SOLUTION: Add unified_patient_id FK to all relevant tables,
--           backfill from existing identifiers, create lookup views

-- ============================================
-- 1. diabetes_education_patients - Link to unified_patients
-- ============================================

DO $$
DECLARE
  has_phone_number BOOLEAN;
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'diabetes_education_patients'
  ) THEN
    -- Add unified_patient_id column
    ALTER TABLE diabetes_education_patients
      ADD COLUMN IF NOT EXISTS unified_patient_id UUID REFERENCES unified_patients(id) ON DELETE SET NULL;

    -- Create index
    CREATE INDEX IF NOT EXISTS idx_diabetes_education_unified_patient_id
      ON diabetes_education_patients(unified_patient_id) WHERE unified_patient_id IS NOT NULL;

    -- Check if phone_number column exists for backfill
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'diabetes_education_patients' AND column_name = 'phone_number'
    ) INTO has_phone_number;

    -- Backfill from phone if column exists
    IF has_phone_number THEN
      UPDATE diabetes_education_patients dep
      SET unified_patient_id = up.id
      FROM unified_patients up
      WHERE dep.unified_patient_id IS NULL
        AND dep.phone_number IS NOT NULL
        AND (
          REGEXP_REPLACE(dep.phone_number, '[^0-9]', '', 'g') = up.phone_primary
          OR REGEXP_REPLACE(dep.phone_number, '[^0-9]', '', 'g') = REGEXP_REPLACE(up.phone_primary, '[^0-9]', '', 'g')
        );
    END IF;

    RAISE NOTICE 'Added unified_patient_id to diabetes_education_patients';
  ELSE
    RAISE NOTICE 'diabetes_education_patients does not exist - skipping';
  END IF;
END $$;

-- ============================================
-- 2. patient_ai_conversations - Link to unified_patients
-- ============================================

DO $$
DECLARE
  has_tshla_id BOOLEAN;
  has_patient_phone BOOLEAN;
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'patient_ai_conversations'
  ) THEN
    ALTER TABLE patient_ai_conversations
      ADD COLUMN IF NOT EXISTS unified_patient_id UUID REFERENCES unified_patients(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_patient_ai_conversations_unified_patient_id
      ON patient_ai_conversations(unified_patient_id) WHERE unified_patient_id IS NOT NULL;

    -- Check which columns exist for backfill
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'patient_ai_conversations' AND column_name = 'tshla_id'
    ) INTO has_tshla_id;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'patient_ai_conversations' AND column_name = 'patient_phone'
    ) INTO has_patient_phone;

    -- Backfill from tshla_id if column exists
    IF has_tshla_id THEN
      UPDATE patient_ai_conversations pac
      SET unified_patient_id = up.id
      FROM unified_patients up
      WHERE pac.unified_patient_id IS NULL
        AND pac.tshla_id IS NOT NULL
        AND up.tshla_id = pac.tshla_id;
    END IF;

    -- Backfill from patient_phone if column exists
    IF has_patient_phone THEN
      UPDATE patient_ai_conversations pac
      SET unified_patient_id = up.id
      FROM unified_patients up
      WHERE pac.unified_patient_id IS NULL
        AND pac.patient_phone IS NOT NULL
        AND REGEXP_REPLACE(pac.patient_phone, '[^0-9]', '', 'g') = up.phone_primary;
    END IF;

    RAISE NOTICE 'Added unified_patient_id to patient_ai_conversations';
  ELSE
    RAISE NOTICE 'patient_ai_conversations does not exist - skipping';
  END IF;
END $$;

-- ============================================
-- 3. patient_audio_summaries - Link to unified_patients
-- ============================================

DO $$
DECLARE
  has_tshla_id BOOLEAN;
  has_patient_phone BOOLEAN;
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'patient_audio_summaries'
  ) THEN
    ALTER TABLE patient_audio_summaries
      ADD COLUMN IF NOT EXISTS unified_patient_id UUID REFERENCES unified_patients(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_patient_audio_summaries_unified_patient_id
      ON patient_audio_summaries(unified_patient_id) WHERE unified_patient_id IS NOT NULL;

    -- Check which columns exist for backfill
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'patient_audio_summaries' AND column_name = 'tshla_id'
    ) INTO has_tshla_id;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'patient_audio_summaries' AND column_name = 'patient_phone'
    ) INTO has_patient_phone;

    -- Backfill from tshla_id if column exists
    IF has_tshla_id THEN
      UPDATE patient_audio_summaries pas
      SET unified_patient_id = up.id
      FROM unified_patients up
      WHERE pas.unified_patient_id IS NULL
        AND pas.tshla_id IS NOT NULL
        AND up.tshla_id = pas.tshla_id;
    END IF;

    -- Backfill from patient_phone if column exists
    IF has_patient_phone THEN
      UPDATE patient_audio_summaries pas
      SET unified_patient_id = up.id
      FROM unified_patients up
      WHERE pas.unified_patient_id IS NULL
        AND pas.patient_phone IS NOT NULL
        AND (
          REGEXP_REPLACE(pas.patient_phone, '[^0-9]', '', 'g') = up.phone_primary
          OR REGEXP_REPLACE(pas.patient_phone, '[^0-9]', '', 'g') = REGEXP_REPLACE(up.phone_primary, '[^0-9]', '', 'g')
        );
    END IF;

    RAISE NOTICE 'Added unified_patient_id to patient_audio_summaries';
  ELSE
    RAISE NOTICE 'patient_audio_summaries does not exist - skipping';
  END IF;
END $$;

-- ============================================
-- 4. dictated_notes - Ensure unified_patient_id is populated
-- ============================================

DO $$
DECLARE
  has_tshla_id BOOLEAN;
  has_patient_phone BOOLEAN;
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'dictated_notes'
  ) THEN
    -- Column likely exists from earlier migration
    ALTER TABLE dictated_notes
      ADD COLUMN IF NOT EXISTS unified_patient_id UUID REFERENCES unified_patients(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_dictated_notes_unified_patient_id
      ON dictated_notes(unified_patient_id) WHERE unified_patient_id IS NOT NULL;

    -- Check which columns exist for backfill
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'dictated_notes' AND column_name = 'tshla_id'
    ) INTO has_tshla_id;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'dictated_notes' AND column_name = 'patient_phone'
    ) INTO has_patient_phone;

    -- Backfill from tshla_id if column exists
    IF has_tshla_id THEN
      UPDATE dictated_notes dn
      SET unified_patient_id = up.id
      FROM unified_patients up
      WHERE dn.unified_patient_id IS NULL
        AND dn.tshla_id IS NOT NULL
        AND (
          up.tshla_id = dn.tshla_id
          OR REPLACE(up.tshla_id, ' ', '') = REPLACE(dn.tshla_id, ' ', '')
          OR REPLACE(REPLACE(up.tshla_id, ' ', ''), '-', '') = REPLACE(REPLACE(dn.tshla_id, ' ', ''), '-', '')
        );
    END IF;

    -- Backfill from patient_phone if column exists
    IF has_patient_phone THEN
      UPDATE dictated_notes dn
      SET unified_patient_id = up.id
      FROM unified_patients up
      WHERE dn.unified_patient_id IS NULL
        AND dn.patient_phone IS NOT NULL
        AND (
          REGEXP_REPLACE(dn.patient_phone, '[^0-9]', '', 'g') = up.phone_primary
          OR REGEXP_REPLACE(dn.patient_phone, '[^0-9]', '', 'g') = REGEXP_REPLACE(up.phone_primary, '[^0-9]', '', 'g')
        );
    END IF;

    RAISE NOTICE 'Populated unified_patient_id in dictated_notes';
  ELSE
    RAISE NOTICE 'dictated_notes does not exist - skipping';
  END IF;
END $$;

-- ============================================
-- 5. patient_comprehensive_chart - Link to unified_patients
-- ============================================

DO $$
DECLARE
  has_tshla_id BOOLEAN;
  has_patient_phone BOOLEAN;
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'patient_comprehensive_chart'
  ) THEN
    ALTER TABLE patient_comprehensive_chart
      ADD COLUMN IF NOT EXISTS unified_patient_id UUID REFERENCES unified_patients(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_patient_comprehensive_chart_unified_patient_id
      ON patient_comprehensive_chart(unified_patient_id) WHERE unified_patient_id IS NOT NULL;

    -- Check which columns exist for backfill
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'patient_comprehensive_chart' AND column_name = 'tshla_id'
    ) INTO has_tshla_id;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'patient_comprehensive_chart' AND column_name = 'patient_phone'
    ) INTO has_patient_phone;

    -- Backfill from tshla_id if column exists
    IF has_tshla_id THEN
      UPDATE patient_comprehensive_chart pcc
      SET unified_patient_id = up.id
      FROM unified_patients up
      WHERE pcc.unified_patient_id IS NULL
        AND pcc.tshla_id IS NOT NULL
        AND (
          up.tshla_id = pcc.tshla_id
          OR REPLACE(up.tshla_id, ' ', '') = REPLACE(pcc.tshla_id, ' ', '')
        );
    END IF;

    -- Backfill from patient_phone if column exists
    IF has_patient_phone THEN
      UPDATE patient_comprehensive_chart pcc
      SET unified_patient_id = up.id
      FROM unified_patients up
      WHERE pcc.unified_patient_id IS NULL
        AND pcc.patient_phone IS NOT NULL
        AND (
          REGEXP_REPLACE(pcc.patient_phone, '[^0-9]', '', 'g') = up.phone_primary
          OR REGEXP_REPLACE(pcc.patient_phone, '[^0-9]', '', 'g') = REGEXP_REPLACE(up.phone_primary, '[^0-9]', '', 'g')
        );
    END IF;

    RAISE NOTICE 'Added unified_patient_id to patient_comprehensive_chart';
  ELSE
    RAISE NOTICE 'patient_comprehensive_chart does not exist - skipping';
  END IF;
END $$;

-- ============================================
-- 6. previsit_data - Link to unified_patients
-- ============================================

DO $$
DECLARE
  has_patient_phone BOOLEAN;
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'previsit_data'
  ) THEN
    ALTER TABLE previsit_data
      ADD COLUMN IF NOT EXISTS unified_patient_id UUID REFERENCES unified_patients(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_previsit_data_unified_patient_id
      ON previsit_data(unified_patient_id) WHERE unified_patient_id IS NOT NULL;

    -- Check if patient_phone column exists for backfill
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'previsit_data' AND column_name = 'patient_phone'
    ) INTO has_patient_phone;

    -- Backfill from phone if column exists
    IF has_patient_phone THEN
      UPDATE previsit_data pvd
      SET unified_patient_id = up.id
      FROM unified_patients up
      WHERE pvd.unified_patient_id IS NULL
        AND pvd.patient_phone IS NOT NULL
        AND (
          REGEXP_REPLACE(pvd.patient_phone, '[^0-9]', '', 'g') = up.phone_primary
          OR REGEXP_REPLACE(pvd.patient_phone, '[^0-9]', '', 'g') = REGEXP_REPLACE(up.phone_primary, '[^0-9]', '', 'g')
        );
    END IF;

    RAISE NOTICE 'Added unified_patient_id to previsit_data';
  ELSE
    RAISE NOTICE 'previsit_data does not exist - skipping';
  END IF;
END $$;

-- ============================================
-- 7. external_documents (specialist notes, faxes)
-- ============================================

DO $$
DECLARE
  has_tshla_id BOOLEAN;
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'external_documents'
  ) THEN
    ALTER TABLE external_documents
      ADD COLUMN IF NOT EXISTS unified_patient_id UUID REFERENCES unified_patients(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_external_documents_unified_patient_id
      ON external_documents(unified_patient_id) WHERE unified_patient_id IS NOT NULL;

    -- Check if tshla_id column exists for backfill
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'external_documents' AND column_name = 'tshla_id'
    ) INTO has_tshla_id;

    -- Backfill from tshla_id if column exists
    IF has_tshla_id THEN
      UPDATE external_documents ed
      SET unified_patient_id = up.id
      FROM unified_patients up
      WHERE ed.unified_patient_id IS NULL
        AND ed.tshla_id IS NOT NULL
        AND up.tshla_id = ed.tshla_id;
    END IF;

    RAISE NOTICE 'Added unified_patient_id to external_documents';
  ELSE
    RAISE NOTICE 'external_documents does not exist - skipping';
  END IF;
END $$;

-- ============================================
-- 8. Create helper function for patient lookup
-- ============================================

CREATE OR REPLACE FUNCTION find_unified_patient_id(
  p_phone VARCHAR DEFAULT NULL,
  p_tshla_id VARCHAR DEFAULT NULL,
  p_mrn VARCHAR DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  found_id UUID;
BEGIN
  -- Try tshla_id first (most specific)
  IF p_tshla_id IS NOT NULL THEN
    SELECT id INTO found_id
    FROM unified_patients
    WHERE tshla_id = p_tshla_id
       OR REPLACE(REPLACE(tshla_id, ' ', ''), '-', '') = REPLACE(REPLACE(p_tshla_id, ' ', ''), '-', '')
    LIMIT 1;

    IF found_id IS NOT NULL THEN
      RETURN found_id;
    END IF;
  END IF;

  -- Try phone
  IF p_phone IS NOT NULL THEN
    SELECT id INTO found_id
    FROM unified_patients
    WHERE phone_primary = REGEXP_REPLACE(p_phone, '[^0-9]', '', 'g')
       OR phone_primary = p_phone
    LIMIT 1;

    IF found_id IS NOT NULL THEN
      RETURN found_id;
    END IF;
  END IF;

  -- Try MRN
  IF p_mrn IS NOT NULL THEN
    SELECT id INTO found_id
    FROM unified_patients
    WHERE mrn = p_mrn
    LIMIT 1;

    IF found_id IS NOT NULL THEN
      RETURN found_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION find_unified_patient_id IS 'Find unified_patient_id by phone, tshla_id, or MRN';

-- ============================================
-- 9. Create comprehensive patient lookup view
-- ============================================

CREATE OR REPLACE VIEW v_patient_identity_map AS
SELECT
  up.id as unified_patient_id,
  up.tshla_id,
  up.phone_primary,
  up.phone_display,
  up.mrn,
  up.ava_id,
  up.patient_id as legacy_patient_id,
  up.first_name,
  up.last_name,
  up.full_name,
  up.date_of_birth,
  up.age,
  up.has_portal_access,
  up.is_active
FROM unified_patients up
WHERE up.is_active = true
ORDER BY up.last_name, up.first_name;

COMMENT ON VIEW v_patient_identity_map IS 'Lookup view mapping all patient identifiers to unified_patient_id';

-- ============================================
-- 10. Verification queries (run manually)
-- ============================================

-- Check tables with orphaned patient references
-- SELECT 'dictated_notes' as table_name, COUNT(*) as orphaned
-- FROM dictated_notes WHERE unified_patient_id IS NULL AND tshla_id IS NOT NULL
-- UNION ALL
-- SELECT 'cgm_readings', COUNT(*)
-- FROM cgm_readings WHERE unified_patient_id IS NULL AND patient_phone IS NOT NULL
-- UNION ALL
-- SELECT 'patient_comprehensive_chart', COUNT(*)
-- FROM patient_comprehensive_chart WHERE unified_patient_id IS NULL;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- All patient-related tables now have unified_patient_id column
-- Use find_unified_patient_id() function for future lookups
-- Legacy identifiers (phone, tshla_id) are still available for backwards compatibility
-- ============================================
