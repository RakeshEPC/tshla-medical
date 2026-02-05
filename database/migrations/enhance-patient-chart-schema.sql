-- =====================================================
-- TSHLA Medical - Patient Chart Schema Enhancement
-- =====================================================
-- Created: 2026-02-05
-- Purpose: Add appointment linking and emergency contact support
--
-- Changes:
-- 1. Add unified_patient_id FK to provider_schedules
-- 2. Add emergency contact fields to unified_patients
-- 3. Add portal invite tracking fields
-- =====================================================

-- =====================================================
-- 1. ADD UNIFIED_PATIENT_ID TO PROVIDER_SCHEDULES
-- =====================================================
-- This links appointments to patients for the patient chart

ALTER TABLE provider_schedules
ADD COLUMN IF NOT EXISTS unified_patient_id UUID REFERENCES unified_patients(id);

-- Add comment for documentation
COMMENT ON COLUMN provider_schedules.unified_patient_id IS
  'Links appointment to unified_patients table. Enables patient chart to show upcoming appointments.';

-- Create index for fast lookups by patient
CREATE INDEX IF NOT EXISTS idx_provider_schedules_unified_patient
ON provider_schedules(unified_patient_id)
WHERE unified_patient_id IS NOT NULL;

-- =====================================================
-- 2. ADD EMERGENCY CONTACT FIELDS TO UNIFIED_PATIENTS
-- =====================================================

ALTER TABLE unified_patients
ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS emergency_contact_relationship VARCHAR(100);

-- Add comments for documentation
COMMENT ON COLUMN unified_patients.emergency_contact_name IS 'Emergency contact full name';
COMMENT ON COLUMN unified_patients.emergency_contact_phone IS 'Emergency contact phone number';
COMMENT ON COLUMN unified_patients.emergency_contact_relationship IS 'Relationship to patient (e.g., Spouse, Parent, Sibling)';

-- =====================================================
-- 3. ADD PORTAL INVITE TRACKING FIELDS
-- =====================================================

ALTER TABLE unified_patients
ADD COLUMN IF NOT EXISTS portal_invite_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS portal_invite_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS portal_invite_clicked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS portal_registered_at TIMESTAMPTZ;

-- Add comments for documentation
COMMENT ON COLUMN unified_patients.portal_invite_token IS 'Unique token for portal registration invite';
COMMENT ON COLUMN unified_patients.portal_invite_sent_at IS 'When portal invite email was sent';
COMMENT ON COLUMN unified_patients.portal_invite_clicked_at IS 'When patient clicked invite link';
COMMENT ON COLUMN unified_patients.portal_registered_at IS 'When patient completed portal registration';

-- Index for looking up patients by invite token
CREATE INDEX IF NOT EXISTS idx_unified_patients_portal_token
ON unified_patients(portal_invite_token)
WHERE portal_invite_token IS NOT NULL;

-- =====================================================
-- 4. CREATE FUNCTION TO LINK APPOINTMENTS TO PATIENTS
-- =====================================================
-- This function matches appointments to patients by phone number

CREATE OR REPLACE FUNCTION link_appointment_to_patient(
  p_schedule_id UUID
) RETURNS UUID AS $$
DECLARE
  v_patient_id UUID;
  v_patient_phone TEXT;
  v_patient_name TEXT;
BEGIN
  -- Get patient info from the schedule record
  SELECT patient_phone, patient_name
  INTO v_patient_phone, v_patient_name
  FROM provider_schedules
  WHERE id = p_schedule_id;

  -- If no phone, cannot match
  IF v_patient_phone IS NULL OR v_patient_phone = '' THEN
    RETURN NULL;
  END IF;

  -- Normalize phone (remove formatting)
  v_patient_phone := REGEXP_REPLACE(v_patient_phone, '[^0-9]', '', 'g');

  -- Try to find matching patient by phone
  SELECT id INTO v_patient_id
  FROM unified_patients
  WHERE phone_primary = v_patient_phone
    AND is_active = true
  LIMIT 1;

  -- If found, update the schedule record
  IF v_patient_id IS NOT NULL THEN
    UPDATE provider_schedules
    SET unified_patient_id = v_patient_id
    WHERE id = p_schedule_id;
  END IF;

  RETURN v_patient_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. CREATE FUNCTION TO BULK LINK UNLINKED APPOINTMENTS
-- =====================================================

CREATE OR REPLACE FUNCTION link_all_unlinked_appointments()
RETURNS TABLE (
  total_processed INTEGER,
  total_linked INTEGER,
  total_failed INTEGER
) AS $$
DECLARE
  v_total INTEGER := 0;
  v_linked INTEGER := 0;
  v_schedule RECORD;
  v_patient_id UUID;
BEGIN
  -- Loop through all unlinked appointments with phone numbers
  FOR v_schedule IN
    SELECT id, patient_phone
    FROM provider_schedules
    WHERE unified_patient_id IS NULL
      AND patient_phone IS NOT NULL
      AND patient_phone != ''
  LOOP
    v_total := v_total + 1;
    v_patient_id := link_appointment_to_patient(v_schedule.id);

    IF v_patient_id IS NOT NULL THEN
      v_linked := v_linked + 1;
    END IF;
  END LOOP;

  total_processed := v_total;
  total_linked := v_linked;
  total_failed := v_total - v_linked;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. CREATE TRIGGER TO AUTO-LINK NEW APPOINTMENTS
-- =====================================================

CREATE OR REPLACE FUNCTION auto_link_appointment_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Only try to link if unified_patient_id is not already set
  IF NEW.unified_patient_id IS NULL AND NEW.patient_phone IS NOT NULL THEN
    PERFORM link_appointment_to_patient(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_auto_link_appointment ON provider_schedules;

-- Create trigger on INSERT
CREATE TRIGGER trigger_auto_link_appointment
  AFTER INSERT ON provider_schedules
  FOR EACH ROW
  EXECUTE FUNCTION auto_link_appointment_trigger();

-- =====================================================
-- 7. RUN INITIAL BACKFILL
-- =====================================================
-- Link all existing appointments to patients

SELECT * FROM link_all_unlinked_appointments();

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check schema changes were applied:
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'provider_schedules'
--   AND column_name = 'unified_patient_id';

-- Check emergency contact fields:
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'unified_patients'
--   AND column_name LIKE 'emergency_%';

-- Check linking results:
-- SELECT
--   COUNT(*) as total_schedules,
--   COUNT(unified_patient_id) as linked,
--   COUNT(*) - COUNT(unified_patient_id) as unlinked
-- FROM provider_schedules;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION link_appointment_to_patient TO authenticated;
GRANT EXECUTE ON FUNCTION link_appointment_to_patient TO service_role;
GRANT EXECUTE ON FUNCTION link_all_unlinked_appointments TO service_role;
