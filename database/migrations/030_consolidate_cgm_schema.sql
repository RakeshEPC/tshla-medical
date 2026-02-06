-- ============================================
-- Migration 030: Consolidate CGM Schema
-- ============================================
-- Purpose: Resolve dual CGM schemas and ensure all CGM data
--          is properly linked to unified_patients via unified_patient_id
-- Created: 2026-02-06
-- ============================================

-- ISSUE: Two CGM schemas exist:
-- 1. create-cgm-data-tables.sql: Uses patient_phone, BIGSERIAL IDs
-- 2. 020_cgm_nightscout_integration.sql: Uses patient_id UUID, references unified_patients

-- SOLUTION: Keep phone-based schema (simpler, already has data), ensure unified_patient_id populated

-- ============================================
-- 1. Ensure unified_patient_id column exists on cgm_readings (from migration 022)
-- ============================================

ALTER TABLE cgm_readings
  ADD COLUMN IF NOT EXISTS unified_patient_id UUID REFERENCES unified_patients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cgm_readings_unified_patient_id
  ON cgm_readings(unified_patient_id) WHERE unified_patient_id IS NOT NULL;

-- ============================================
-- 2. Backfill unified_patient_id from phone lookups
-- ============================================

-- Try direct phone match first
UPDATE cgm_readings cr
SET unified_patient_id = up.id
FROM unified_patients up
WHERE cr.unified_patient_id IS NULL
  AND cr.patient_phone IS NOT NULL
  AND (
    cr.patient_phone = up.phone_primary
    OR cr.patient_phone = '+1' || up.phone_primary
    OR REGEXP_REPLACE(cr.patient_phone, '[^0-9]', '', 'g') = up.phone_primary
    OR REGEXP_REPLACE(cr.patient_phone, '[^0-9]', '', 'g') = REGEXP_REPLACE(up.phone_primary, '[^0-9]', '', 'g')
  );

-- ============================================
-- 3. Ensure patient_nightscout_config has unified_patient_id
-- ============================================

ALTER TABLE patient_nightscout_config
  ADD COLUMN IF NOT EXISTS unified_patient_id UUID REFERENCES unified_patients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_patient_nightscout_config_unified_patient_id
  ON patient_nightscout_config(unified_patient_id) WHERE unified_patient_id IS NOT NULL;

-- Backfill patient_nightscout_config
UPDATE patient_nightscout_config pnc
SET unified_patient_id = up.id
FROM unified_patients up
WHERE pnc.unified_patient_id IS NULL
  AND pnc.patient_phone IS NOT NULL
  AND (
    pnc.patient_phone = up.phone_primary
    OR pnc.patient_phone = '+1' || up.phone_primary
    OR REGEXP_REPLACE(pnc.patient_phone, '[^0-9]', '', 'g') = up.phone_primary
    OR REGEXP_REPLACE(pnc.patient_phone, '[^0-9]', '', 'g') = REGEXP_REPLACE(up.phone_primary, '[^0-9]', '', 'g')
  );

-- ============================================
-- 4. Handle nightscout_patient_connections if it exists
-- ============================================

-- Check if nightscout_patient_connections exists and has data we need to preserve
DO $$
DECLARE
  npc_exists BOOLEAN;
  npc_count INTEGER;
BEGIN
  -- Check if table exists
  SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'nightscout_patient_connections'
  ) INTO npc_exists;

  IF npc_exists THEN
    -- Count records
    EXECUTE 'SELECT COUNT(*) FROM nightscout_patient_connections' INTO npc_count;

    IF npc_count > 0 THEN
      RAISE NOTICE 'nightscout_patient_connections has % records - migrating to patient_nightscout_config', npc_count;

      -- Migrate any unique data from nightscout_patient_connections to patient_nightscout_config
      -- Note: The newer table has device-specific credentials which is more flexible
      INSERT INTO patient_nightscout_config (
        patient_phone,
        unified_patient_id,
        provider_id,
        nightscout_url,
        api_secret_encrypted,
        sync_enabled,
        last_sync_at,
        connection_status,
        last_error,
        created_at,
        updated_at
      )
      SELECT
        up.phone_primary,
        npc.patient_id,
        npc.created_by::text,
        'https://dexcom-share.nightscout.pro', -- Placeholder URL for Dexcom Share connections
        COALESCE(npc.dexcom_password_encrypted, npc.libre_password_encrypted),
        npc.is_active,
        npc.last_sync_at,
        CASE
          WHEN npc.last_sync_status = 'success' THEN 'active'
          WHEN npc.last_sync_status = 'auth_failed' THEN 'unauthorized'
          ELSE 'error'
        END,
        npc.last_error_message,
        npc.created_at,
        npc.updated_at
      FROM nightscout_patient_connections npc
      JOIN unified_patients up ON up.id = npc.patient_id
      WHERE NOT EXISTS (
        SELECT 1 FROM patient_nightscout_config pnc
        WHERE pnc.unified_patient_id = npc.patient_id
      )
      ON CONFLICT (patient_phone) DO NOTHING;

      RAISE NOTICE 'Migration from nightscout_patient_connections complete';
    ELSE
      RAISE NOTICE 'nightscout_patient_connections exists but is empty';
    END IF;
  ELSE
    RAISE NOTICE 'nightscout_patient_connections does not exist - skipping migration';
  END IF;
END $$;

-- ============================================
-- 5. Ensure cgm_statistics has unified_patient_id
-- ============================================

ALTER TABLE cgm_statistics
  ADD COLUMN IF NOT EXISTS unified_patient_id UUID REFERENCES unified_patients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cgm_statistics_unified_patient_id
  ON cgm_statistics(unified_patient_id) WHERE unified_patient_id IS NOT NULL;

-- Backfill cgm_statistics
UPDATE cgm_statistics cs
SET unified_patient_id = up.id
FROM unified_patients up
WHERE cs.unified_patient_id IS NULL
  AND cs.patient_phone IS NOT NULL
  AND (
    cs.patient_phone = up.phone_primary
    OR cs.patient_phone = '+1' || up.phone_primary
    OR REGEXP_REPLACE(cs.patient_phone, '[^0-9]', '', 'g') = up.phone_primary
  );

-- ============================================
-- 6. Ensure cgm_alerts has unified_patient_id
-- ============================================

ALTER TABLE cgm_alerts
  ADD COLUMN IF NOT EXISTS unified_patient_id UUID REFERENCES unified_patients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cgm_alerts_unified_patient_id
  ON cgm_alerts(unified_patient_id) WHERE unified_patient_id IS NOT NULL;

-- Backfill cgm_alerts
UPDATE cgm_alerts ca
SET unified_patient_id = up.id
FROM unified_patients up
WHERE ca.unified_patient_id IS NULL
  AND ca.patient_phone IS NOT NULL
  AND (
    ca.patient_phone = up.phone_primary
    OR ca.patient_phone = '+1' || up.phone_primary
    OR REGEXP_REPLACE(ca.patient_phone, '[^0-9]', '', 'g') = up.phone_primary
  );

-- ============================================
-- 7. Create view for unified CGM access
-- ============================================

CREATE OR REPLACE VIEW v_patient_cgm_readings AS
SELECT
  cr.id,
  cr.unified_patient_id,
  up.tshla_id,
  up.first_name,
  up.last_name,
  cr.glucose_value,
  cr.glucose_units,
  cr.trend_direction,
  cr.trend_arrow,
  cr.reading_timestamp,
  cr.device_name,
  cr.synced_at,
  cr.created_at
FROM cgm_readings cr
JOIN unified_patients up ON up.id = cr.unified_patient_id
WHERE cr.unified_patient_id IS NOT NULL
ORDER BY cr.reading_timestamp DESC;

COMMENT ON VIEW v_patient_cgm_readings IS 'Unified view of CGM readings joined with patient data';

-- ============================================
-- 8. Verification queries (run manually)
-- ============================================

-- Check orphaned CGM records (no unified_patient_id)
-- SELECT COUNT(*) as orphaned_cgm_readings FROM cgm_readings WHERE unified_patient_id IS NULL;

-- Check orphaned config records
-- SELECT COUNT(*) as orphaned_cgm_configs FROM patient_nightscout_config WHERE unified_patient_id IS NULL;

-- Check orphaned stats records
-- SELECT COUNT(*) as orphaned_cgm_stats FROM cgm_statistics WHERE unified_patient_id IS NULL;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- CGM schema is now consolidated with unified_patient_id as the link
-- Phone numbers are still stored for backwards compatibility and display
-- The nightscout_patient_connections table can be dropped after verification
-- ============================================
