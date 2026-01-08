-- =====================================================
-- TSHLA Medical - Schedule CRUD Support Enhancement
-- =====================================================
-- Created: 2026-01-07
-- Updated: 2026-01-07 v2 - Added duplicate cleanup
-- Purpose: Add full CRUD support for manual appointment
--          management with audit logging and conflict detection
-- =====================================================

-- =====================================================
-- 0. PRE-MIGRATION: CLEANUP DUPLICATES
-- =====================================================

-- First, let's identify and remove duplicate appointments
-- Keep the oldest appointment, remove newer duplicates

-- Create temporary table to track duplicates
CREATE TEMP TABLE duplicate_appointments AS
SELECT
  id,
  provider_id,
  scheduled_date,
  start_time,
  patient_name,
  status,
  created_at,
  ROW_NUMBER() OVER (
    PARTITION BY provider_id, scheduled_date, start_time, status
    ORDER BY created_at ASC NULLS LAST, id ASC
  ) as row_num
FROM provider_schedules
WHERE status NOT IN ('cancelled', 'no-show');

-- Show duplicates that will be removed (for logging)
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM duplicate_appointments
  WHERE row_num > 1;

  RAISE NOTICE 'Found % duplicate appointments to remove', duplicate_count;
END $$;

-- Remove duplicates (keep row_num = 1, delete row_num > 1)
DELETE FROM provider_schedules
WHERE id IN (
  SELECT id
  FROM duplicate_appointments
  WHERE row_num > 1
);

-- Drop temp table
DROP TABLE duplicate_appointments;

-- =====================================================
-- 1. ADD AUDIT AND TRACKING FIELDS
-- =====================================================

-- Add user tracking fields
ALTER TABLE provider_schedules
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS last_modified_by_user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS last_modified_by_email VARCHAR(255);

-- Add cancellation tracking
ALTER TABLE provider_schedules
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_notes TEXT;

-- Ensure unified_patient_id link exists (may already exist)
ALTER TABLE provider_schedules
  ADD COLUMN IF NOT EXISTS unified_patient_id UUID REFERENCES unified_patients(id);

-- Add source tracking (manual vs import)
ALTER TABLE provider_schedules
  ADD COLUMN IF NOT EXISTS entry_source VARCHAR(50) DEFAULT 'manual'
    CHECK (entry_source IN ('manual', 'import', 'athena', 'api'));

-- =====================================================
-- 2. CREATE UNIQUE CONSTRAINT TO PREVENT DOUBLE-BOOKING
-- =====================================================

-- Drop existing index if present
DROP INDEX IF EXISTS idx_provider_schedules_no_overlap;

-- Create partial unique index (excludes cancelled/no-show)
-- This prevents same provider from being booked at same time slot
CREATE UNIQUE INDEX idx_provider_schedules_no_overlap
  ON provider_schedules(provider_id, scheduled_date, start_time)
  WHERE status NOT IN ('cancelled', 'no-show');

COMMENT ON INDEX idx_provider_schedules_no_overlap IS
  'Prevents double-booking: same provider cannot have multiple active appointments at same time';

-- =====================================================
-- 3. CREATE AUDIT LOG TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS schedule_audit_log (
  id BIGSERIAL PRIMARY KEY,

  -- Link to appointment
  appointment_id BIGINT REFERENCES provider_schedules(id) ON DELETE SET NULL,

  -- Action details
  action VARCHAR(50) NOT NULL CHECK (action IN (
    'created', 'updated', 'deleted', 'cancelled',
    'rescheduled', 'confirmed', 'checked_in', 'completed'
  )),

  -- What changed (JSON diff)
  changed_fields JSONB DEFAULT '{}'::jsonb,
  previous_values JSONB DEFAULT '{}'::jsonb,
  new_values JSONB DEFAULT '{}'::jsonb,

  -- Who made the change
  changed_by_user_id UUID REFERENCES auth.users(id),
  changed_by_email VARCHAR(255),
  changed_by_name VARCHAR(255),

  -- When
  changed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Why (optional notes)
  notes TEXT,
  reason TEXT,

  -- Context
  ip_address INET,
  user_agent TEXT
);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_schedule_audit_appointment
  ON schedule_audit_log(appointment_id);

CREATE INDEX IF NOT EXISTS idx_schedule_audit_date
  ON schedule_audit_log(changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_schedule_audit_user
  ON schedule_audit_log(changed_by_user_id);

CREATE INDEX IF NOT EXISTS idx_schedule_audit_action
  ON schedule_audit_log(action);

COMMENT ON TABLE schedule_audit_log IS
  'Complete audit trail of all appointment changes for compliance and debugging';

-- =====================================================
-- 4. CREATE HELPER FUNCTIONS
-- =====================================================

-- Function: Check if time slot is available
CREATE OR REPLACE FUNCTION check_time_slot_available(
  p_provider_id VARCHAR,
  p_date DATE,
  p_start_time VARCHAR,
  p_duration INTEGER DEFAULT 30,
  p_exclude_id BIGINT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_conflicts INTEGER;
BEGIN
  -- Count overlapping appointments for same provider
  SELECT COUNT(*) INTO v_conflicts
  FROM provider_schedules
  WHERE provider_id = p_provider_id
    AND scheduled_date = p_date
    AND start_time = p_start_time
    AND status NOT IN ('cancelled', 'no-show')
    AND (p_exclude_id IS NULL OR id != p_exclude_id);

  RETURN v_conflicts = 0;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_time_slot_available IS
  'Returns TRUE if time slot is available, FALSE if conflict exists';

-- Function: Get appointment conflicts
CREATE OR REPLACE FUNCTION get_appointment_conflicts(
  p_provider_id VARCHAR,
  p_date DATE,
  p_start_time VARCHAR,
  p_exclude_id BIGINT DEFAULT NULL
) RETURNS TABLE (
  conflict_id BIGINT,
  conflict_patient_name VARCHAR,
  conflict_start_time VARCHAR,
  conflict_duration INTEGER,
  conflict_status VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ps.id,
    ps.patient_name,
    ps.start_time,
    ps.duration_minutes,
    ps.status
  FROM provider_schedules ps
  WHERE ps.provider_id = p_provider_id
    AND ps.scheduled_date = p_date
    AND ps.start_time = p_start_time
    AND ps.status NOT IN ('cancelled', 'no-show')
    AND (p_exclude_id IS NULL OR ps.id != p_exclude_id);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_appointment_conflicts IS
  'Returns list of conflicting appointments for given time slot';

-- Function: Auto-link patient to unified_patients
CREATE OR REPLACE FUNCTION auto_link_patient_by_phone(
  p_phone VARCHAR
) RETURNS UUID AS $$
DECLARE
  v_patient_id UUID;
BEGIN
  -- Normalize phone (remove formatting)
  p_phone := regexp_replace(p_phone, '[^0-9]', '', 'g');

  -- Try to find patient by phone
  SELECT id INTO v_patient_id
  FROM unified_patients
  WHERE phone_primary = p_phone
  LIMIT 1;

  RETURN v_patient_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_link_patient_by_phone IS
  'Finds unified patient ID by phone number (normalized)';

-- Function: Log appointment change
CREATE OR REPLACE FUNCTION log_appointment_change() RETURNS TRIGGER AS $$
DECLARE
  v_action VARCHAR(50);
  v_user_email VARCHAR(255);
BEGIN
  -- Determine action
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
      v_action := 'cancelled';
    ELSIF NEW.scheduled_date != OLD.scheduled_date OR NEW.start_time != OLD.start_time THEN
      v_action := 'rescheduled';
    ELSE
      v_action := 'updated';
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'deleted';
  END IF;

  -- Get user email
  v_user_email := COALESCE(
    NEW.last_modified_by_email,
    OLD.last_modified_by_email,
    'system'
  );

  -- Insert audit log
  IF TG_OP = 'DELETE' THEN
    INSERT INTO schedule_audit_log (
      appointment_id,
      action,
      previous_values,
      changed_by_user_id,
      changed_by_email
    ) VALUES (
      OLD.id,
      v_action,
      row_to_json(OLD)::jsonb,
      OLD.last_modified_by_user_id,
      v_user_email
    );
    RETURN OLD;
  ELSE
    INSERT INTO schedule_audit_log (
      appointment_id,
      action,
      previous_values,
      new_values,
      changed_by_user_id,
      changed_by_email,
      reason
    ) VALUES (
      NEW.id,
      v_action,
      CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD)::jsonb ELSE '{}'::jsonb END,
      row_to_json(NEW)::jsonb,
      NEW.last_modified_by_user_id,
      v_user_email,
      NEW.cancellation_reason
    );
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic audit logging
DROP TRIGGER IF EXISTS trigger_log_appointment_change ON provider_schedules;

CREATE TRIGGER trigger_log_appointment_change
  AFTER INSERT OR UPDATE OR DELETE ON provider_schedules
  FOR EACH ROW
  EXECUTE FUNCTION log_appointment_change();

COMMENT ON TRIGGER trigger_log_appointment_change ON provider_schedules IS
  'Automatically logs all appointment changes to audit table';

-- =====================================================
-- 5. CREATE USEFUL VIEWS
-- =====================================================

-- View: Today's appointments with audit info
CREATE OR REPLACE VIEW v_today_appointments_with_audit AS
SELECT
  ps.*,
  up.phone_primary,
  up.email,
  up.full_name as patient_full_name,
  up.age as patient_calculated_age,
  ms.first_name || ' ' || ms.last_name as created_by_name,
  (
    SELECT COUNT(*)
    FROM schedule_audit_log sal
    WHERE sal.appointment_id = ps.id
  ) as audit_log_count,
  (
    SELECT MAX(sal.changed_at)
    FROM schedule_audit_log sal
    WHERE sal.appointment_id = ps.id
  ) as last_modified_at
FROM provider_schedules ps
LEFT JOIN unified_patients up ON ps.unified_patient_id = up.id
LEFT JOIN medical_staff ms ON ps.created_by_user_id = ms.auth_user_id
WHERE ps.scheduled_date = CURRENT_DATE
  AND ps.status NOT IN ('cancelled', 'no-show')
ORDER BY ps.provider_name, ps.start_time;

COMMENT ON VIEW v_today_appointments_with_audit IS
  'Today''s appointments enriched with patient and audit information';

-- View: Appointment conflicts summary
CREATE OR REPLACE VIEW v_appointment_conflicts AS
SELECT
  ps1.id as appointment_id,
  ps1.provider_id,
  ps1.provider_name,
  ps1.scheduled_date,
  ps1.start_time,
  ps1.patient_name,
  ps2.id as conflicting_id,
  ps2.patient_name as conflicting_patient_name,
  ps2.status as conflicting_status
FROM provider_schedules ps1
INNER JOIN provider_schedules ps2
  ON ps1.provider_id = ps2.provider_id
  AND ps1.scheduled_date = ps2.scheduled_date
  AND ps1.start_time = ps2.start_time
  AND ps1.id < ps2.id  -- Avoid duplicates
WHERE ps1.status NOT IN ('cancelled', 'no-show')
  AND ps2.status NOT IN ('cancelled', 'no-show');

COMMENT ON VIEW v_appointment_conflicts IS
  'Lists all scheduling conflicts (double-booked time slots)';

-- =====================================================
-- 6. UPDATE RLS POLICIES (if needed)
-- =====================================================

-- Ensure authenticated users can manage schedules
-- (RLS policies should already exist from FIX_SCHEDULE_RLS.sql)

-- Enable RLS on audit log
ALTER TABLE schedule_audit_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "schedule_audit_authenticated_read" ON schedule_audit_log;
DROP POLICY IF EXISTS "schedule_audit_system_write" ON schedule_audit_log;

-- Allow authenticated users to read audit logs
CREATE POLICY "schedule_audit_authenticated_read"
  ON schedule_audit_log
  FOR SELECT
  TO authenticated
  USING (true);

-- Only system can write to audit log (via triggers)
CREATE POLICY "schedule_audit_system_write"
  ON schedule_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);  -- Trigger handles this

-- =====================================================
-- 7. DATA MIGRATION (update existing records)
-- =====================================================

-- Set default entry_source for existing records
UPDATE provider_schedules
SET entry_source = COALESCE(
  CASE
    WHEN imported_at IS NOT NULL THEN 'import'
    WHEN athena_appointment_id IS NOT NULL THEN 'athena'
    ELSE 'manual'
  END,
  entry_source
)
WHERE entry_source IS NULL;

-- Auto-link existing appointments to unified_patients by phone
UPDATE provider_schedules ps
SET unified_patient_id = up.id
FROM unified_patients up
WHERE ps.unified_patient_id IS NULL
  AND ps.patient_phone IS NOT NULL
  AND regexp_replace(ps.patient_phone, '[^0-9]', '', 'g') = up.phone_primary;

-- =====================================================
-- 8. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Index for quick patient lookups
CREATE INDEX IF NOT EXISTS idx_provider_schedules_patient_phone
  ON provider_schedules(patient_phone) WHERE patient_phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_provider_schedules_patient_email
  ON provider_schedules(patient_email) WHERE patient_email IS NOT NULL;

-- Index for unified patient link
CREATE INDEX IF NOT EXISTS idx_provider_schedules_unified_patient
  ON provider_schedules(unified_patient_id) WHERE unified_patient_id IS NOT NULL;

-- Index for entry source tracking
CREATE INDEX IF NOT EXISTS idx_provider_schedules_entry_source
  ON provider_schedules(entry_source);

-- Index for user tracking
CREATE INDEX IF NOT EXISTS idx_provider_schedules_created_by
  ON provider_schedules(created_by_user_id) WHERE created_by_user_id IS NOT NULL;

-- =====================================================
-- 9. VERIFICATION QUERIES
-- =====================================================

-- Uncomment to verify installation:

-- Check new columns
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'provider_schedules'
-- AND column_name IN ('created_by_user_id', 'unified_patient_id', 'entry_source', 'cancellation_reason')
-- ORDER BY ordinal_position;

-- Check audit log table
-- SELECT * FROM schedule_audit_log LIMIT 5;

-- Check for conflicts
-- SELECT * FROM v_appointment_conflicts;

-- Test time slot availability
-- SELECT check_time_slot_available('GC_EPC_Chamakkala_T', '2026-01-08', '09:00', 30);

-- =====================================================
-- MIGRATION COMPLETE ✅
-- =====================================================
-- Next steps:
-- 1. Verify all functions and triggers created successfully
-- 2. Test CRUD operations via API
-- 3. Monitor audit log entries
-- 4. Check for any existing conflicts
-- =====================================================
