-- ============================================
-- Migration 031: Consolidate Medications
-- ============================================
-- Purpose: Make patient_medications the single source of truth
--          for all medication data across the system
-- Created: 2026-02-06
-- ============================================

-- ISSUE: Medications exist in 4 places:
-- 1. patient_medications (proper table with status tracking)
-- 2. unified_patients.current_medications (JSONB cache)
-- 3. patient_comprehensive_chart.medications (JSONB for AI context)
-- 4. previsit_data.medications_list (JSONB from previsit forms)

-- SOLUTION: patient_medications is source of truth
-- Other JSONB fields become read-only views or are synced via triggers

-- ============================================
-- 1. Ensure patient_medications has all needed columns
-- ============================================

-- Add unified_patient_id if missing (table uses patient_id UUID already)
-- The table already references unified_patients(id) via patient_id column

-- Add tshla_id column for easier lookups if missing
ALTER TABLE patient_medications
  ADD COLUMN IF NOT EXISTS tshla_id TEXT;

-- Add index for tshla_id lookups
CREATE INDEX IF NOT EXISTS idx_patient_medications_tshla_id
  ON patient_medications(tshla_id) WHERE tshla_id IS NOT NULL;

-- Backfill tshla_id from unified_patients if missing
UPDATE patient_medications pm
SET tshla_id = up.tshla_id
FROM unified_patients up
WHERE pm.patient_id = up.id
  AND pm.tshla_id IS NULL
  AND up.tshla_id IS NOT NULL;

-- ============================================
-- 2. Import medications from patient_comprehensive_chart
-- ============================================

-- Create function to import medications from JSONB
CREATE OR REPLACE FUNCTION import_medications_from_jsonb(
  p_patient_id UUID,
  p_tshla_id TEXT,
  p_medications JSONB,
  p_source TEXT DEFAULT 'hp_import'
)
RETURNS INTEGER AS $$
DECLARE
  med JSONB;
  imported_count INTEGER := 0;
BEGIN
  IF p_medications IS NULL OR jsonb_array_length(p_medications) = 0 THEN
    RETURN 0;
  END IF;

  FOR med IN SELECT * FROM jsonb_array_elements(p_medications)
  LOOP
    -- Only insert if medication doesn't already exist (by name match)
    INSERT INTO patient_medications (
      patient_id,
      tshla_id,
      medication_name,
      dosage,
      frequency,
      route,
      sig,
      status,
      source
    )
    SELECT
      p_patient_id,
      p_tshla_id,
      med->>'name',
      COALESCE(med->>'dose', med->>'dosage'),
      med->>'frequency',
      med->>'route',
      med->>'notes',
      CASE
        WHEN (med->>'active')::boolean = true THEN 'active'
        WHEN (med->>'active')::boolean = false THEN 'prior'
        ELSE 'active'
      END,
      p_source
    WHERE NOT EXISTS (
      SELECT 1 FROM patient_medications pm
      WHERE pm.patient_id = p_patient_id
        AND LOWER(pm.medication_name) = LOWER(med->>'name')
        AND pm.status = 'active'
    )
    AND med->>'name' IS NOT NULL
    AND med->>'name' != '';

    IF FOUND THEN
      imported_count := imported_count + 1;
    END IF;
  END LOOP;

  RETURN imported_count;
END;
$$ LANGUAGE plpgsql;

-- Import from patient_comprehensive_chart (only if table exists and has data)
DO $$
DECLARE
  pcc_record RECORD;
  import_count INTEGER;
  total_imported INTEGER := 0;
BEGIN
  -- Check if table exists
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'patient_comprehensive_chart'
  ) THEN
    -- Loop through charts with medications
    FOR pcc_record IN
      SELECT
        pcc.tshla_id,
        pcc.medications,
        up.id as patient_id
      FROM patient_comprehensive_chart pcc
      JOIN unified_patients up ON up.tshla_id = pcc.tshla_id
      WHERE pcc.medications IS NOT NULL
        AND jsonb_array_length(pcc.medications) > 0
    LOOP
      SELECT import_medications_from_jsonb(
        pcc_record.patient_id,
        pcc_record.tshla_id,
        pcc_record.medications,
        'hp_import'
      ) INTO import_count;

      total_imported := total_imported + import_count;
    END LOOP;

    RAISE NOTICE 'Imported % medications from patient_comprehensive_chart', total_imported;
  ELSE
    RAISE NOTICE 'patient_comprehensive_chart does not exist - skipping import';
  END IF;
END $$;

-- ============================================
-- 3. Create trigger to sync unified_patients.current_medications
-- ============================================

-- Function to build current medications JSON for a patient
CREATE OR REPLACE FUNCTION build_current_medications_json(p_patient_id UUID)
RETURNS JSONB AS $$
BEGIN
  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'name', pm.medication_name,
          'dosage', pm.dosage,
          'frequency', pm.frequency,
          'route', pm.route,
          'status', pm.status,
          'source', pm.source
        ) ORDER BY pm.medication_name
      )
      FROM patient_medications pm
      WHERE pm.patient_id = p_patient_id
        AND pm.status = 'active'
    ),
    '[]'::jsonb
  );
END;
$$ LANGUAGE plpgsql;

-- Trigger function to sync medications to unified_patients
CREATE OR REPLACE FUNCTION sync_medications_to_unified_patients()
RETURNS TRIGGER AS $$
BEGIN
  -- Update unified_patients.current_medications when patient_medications changes
  UPDATE unified_patients
  SET
    current_medications = build_current_medications_json(NEW.patient_id),
    updated_at = NOW()
  WHERE id = NEW.patient_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on patient_medications
DROP TRIGGER IF EXISTS trigger_sync_medications_to_unified ON patient_medications;
CREATE TRIGGER trigger_sync_medications_to_unified
  AFTER INSERT OR UPDATE OR DELETE ON patient_medications
  FOR EACH ROW
  EXECUTE FUNCTION sync_medications_to_unified_patients();

-- ============================================
-- 4. Backfill unified_patients.current_medications
-- ============================================

UPDATE unified_patients up
SET current_medications = build_current_medications_json(up.id)
WHERE EXISTS (
  SELECT 1 FROM patient_medications pm
  WHERE pm.patient_id = up.id
    AND pm.status = 'active'
);

-- ============================================
-- 5. Create view for medication list with patient info
-- ============================================

CREATE OR REPLACE VIEW v_patient_medications AS
SELECT
  pm.id,
  pm.patient_id,
  up.tshla_id,
  up.first_name,
  up.last_name,
  up.phone_primary,
  pm.medication_name,
  pm.dosage,
  pm.frequency,
  pm.route,
  pm.sig,
  pm.status,
  pm.need_refill,
  pm.refill_requested_at,
  pm.send_to_pharmacy,
  pm.sent_to_pharmacy_at,
  pm.pharmacy_name,
  pm.source,
  pm.created_at,
  pm.updated_at
FROM patient_medications pm
JOIN unified_patients up ON up.id = pm.patient_id
ORDER BY pm.status, pm.medication_name;

COMMENT ON VIEW v_patient_medications IS 'Unified view of medications joined with patient data';

-- ============================================
-- 6. Create view for medications needing action
-- ============================================

CREATE OR REPLACE VIEW v_medications_needing_action AS
SELECT
  pm.id,
  pm.patient_id,
  up.tshla_id,
  up.full_name as patient_name,
  up.phone_display,
  pm.medication_name,
  pm.dosage,
  CASE
    WHEN pm.need_refill = true THEN 'Refill Requested'
    WHEN pm.send_to_pharmacy = true THEN 'Pending Pharmacy Send'
  END as action_needed,
  pm.refill_requested_at,
  pm.created_at
FROM patient_medications pm
JOIN unified_patients up ON up.id = pm.patient_id
WHERE pm.status = 'active'
  AND (pm.need_refill = true OR pm.send_to_pharmacy = true)
ORDER BY
  CASE WHEN pm.need_refill = true THEN 0 ELSE 1 END,
  pm.refill_requested_at DESC;

COMMENT ON VIEW v_medications_needing_action IS 'Medications requiring staff action (refills, pharmacy sends)';

-- ============================================
-- 7. Function to get patient medication summary
-- ============================================

CREATE OR REPLACE FUNCTION get_patient_medication_summary(p_patient_id UUID)
RETURNS TABLE (
  total_active INTEGER,
  total_prior INTEGER,
  needing_refill INTEGER,
  pending_pharmacy INTEGER,
  last_updated TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE status = 'active')::INTEGER as total_active,
    COUNT(*) FILTER (WHERE status = 'prior')::INTEGER as total_prior,
    COUNT(*) FILTER (WHERE need_refill = true AND status = 'active')::INTEGER as needing_refill,
    COUNT(*) FILTER (WHERE send_to_pharmacy = true AND status = 'active')::INTEGER as pending_pharmacy,
    MAX(updated_at) as last_updated
  FROM patient_medications
  WHERE patient_id = p_patient_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. Verification queries (run manually)
-- ============================================

-- Count medications by source
-- SELECT source, COUNT(*) FROM patient_medications GROUP BY source ORDER BY COUNT(*) DESC;

-- Check patients with meds in JSONB but not in table
-- SELECT pcc.tshla_id, jsonb_array_length(pcc.medications) as jsonb_count,
--        (SELECT COUNT(*) FROM patient_medications pm
--         JOIN unified_patients up ON up.id = pm.patient_id
--         WHERE up.tshla_id = pcc.tshla_id) as table_count
-- FROM patient_comprehensive_chart pcc
-- WHERE pcc.medications IS NOT NULL
--   AND jsonb_array_length(pcc.medications) > 0;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- patient_medications is now the single source of truth
-- unified_patients.current_medications is auto-synced via trigger
-- patient_comprehensive_chart.medications can be deprecated
-- ============================================
