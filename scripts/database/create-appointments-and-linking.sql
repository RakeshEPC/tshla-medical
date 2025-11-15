-- Appointments Table and Linking System
-- Creates appointments table, linking relationships, and auto-linking functions
-- Part of Phase 1: Database & Core Linking

-- ============================================================================
-- 1. APPOINTMENTS TABLE
-- ============================================================================
-- Stores scheduled appointments from CSV imports or manual entry
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Appointment Details
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  provider_id TEXT NOT NULL,
  provider_name TEXT NOT NULL,

  -- Patient Information (from schedule)
  patient_name TEXT NOT NULL,
  patient_phone TEXT,
  patient_email TEXT,
  patient_mrn TEXT,

  -- Visit Details
  visit_type TEXT, -- 'new-patient', 'follow-up', 'consultation', etc.
  visit_reason TEXT,
  duration_minutes INTEGER DEFAULT 30,

  -- Status Tracking
  status TEXT DEFAULT 'scheduled', -- 'scheduled', 'in-progress', 'completed', 'cancelled', 'no-show'

  -- Linking to Patient Profile
  patient_profile_id UUID REFERENCES public.patient_profiles(id),
  link_method TEXT, -- 'auto_phone', 'auto_mrn', 'manual', null
  linked_at TIMESTAMPTZ,
  linked_by TEXT,

  -- Import Tracking
  source TEXT, -- 'csv_import', 'manual_entry', 'api'
  import_batch_id TEXT, -- Groups appointments from same CSV upload

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_provider ON public.appointments(provider_id);
CREATE INDEX IF NOT EXISTS idx_appointments_phone ON public.appointments(patient_phone);
CREATE INDEX IF NOT EXISTS idx_appointments_mrn ON public.appointments(patient_mrn);
CREATE INDEX IF NOT EXISTS idx_appointments_profile ON public.appointments(patient_profile_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_date_provider ON public.appointments(appointment_date, provider_id);

-- Phone number constraint (E.164 format with country code)
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_phone_format;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_phone_format
  CHECK (patient_phone IS NULL OR patient_phone ~ '^\+?1?[0-9]{10}$');

-- ============================================================================
-- 2. LINKING AUDIT TABLE
-- ============================================================================
-- Tracks all linking operations for troubleshooting and compliance
CREATE TABLE IF NOT EXISTS public.profile_appointment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  patient_profile_id UUID REFERENCES public.patient_profiles(id),
  appointment_id UUID REFERENCES public.appointments(id),

  link_method TEXT NOT NULL, -- 'auto_phone', 'auto_mrn', 'auto_name', 'manual'
  link_confidence DECIMAL(3,2), -- 0.00 to 1.00 for fuzzy matching confidence

  matched_on TEXT, -- 'phone', 'mrn', 'name', 'manual_selection'
  matched_value TEXT, -- The actual value that matched

  linked_at TIMESTAMPTZ DEFAULT NOW(),
  linked_by TEXT, -- user_id or 'system' for auto-linking

  is_active BOOLEAN DEFAULT true, -- false if link was later removed
  unlinked_at TIMESTAMPTZ,
  unlinked_by TEXT,
  unlink_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_links_profile ON public.profile_appointment_links(patient_profile_id);
CREATE INDEX IF NOT EXISTS idx_links_appointment ON public.profile_appointment_links(appointment_id);
CREATE INDEX IF NOT EXISTS idx_links_active ON public.profile_appointment_links(is_active);

-- ============================================================================
-- 3. UPDATE PATIENT_PROFILES TABLE
-- ============================================================================
-- Add linking metadata columns
DO $$
BEGIN
  -- Add last_linked_at if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patient_profiles'
    AND column_name = 'last_linked_at'
  ) THEN
    ALTER TABLE public.patient_profiles
      ADD COLUMN last_linked_at TIMESTAMPTZ,
      ADD COLUMN linked_appointments_count INTEGER DEFAULT 0,
      ADD COLUMN needs_manual_linking BOOLEAN DEFAULT false,
      ADD COLUMN linking_notes TEXT;
  END IF;
END $$;

-- ============================================================================
-- 4. AUTO-LINKING FUNCTION
-- ============================================================================
-- Automatically links patient profiles to appointments based on phone number
CREATE OR REPLACE FUNCTION link_profile_to_appointments(
  p_profile_id UUID,
  p_search_days_ahead INTEGER DEFAULT 30
)
RETURNS TABLE (
  appointment_id UUID,
  appointment_date DATE,
  appointment_time TIME,
  provider_name TEXT,
  matched_on TEXT,
  link_created BOOLEAN
) AS $$
DECLARE
  v_phone TEXT;
  v_mrn TEXT;
  v_name TEXT;
  v_matched_count INTEGER := 0;
BEGIN
  -- Get patient profile data
  SELECT patient_phone, patient_mrn, patient_name
  INTO v_phone, v_mrn, v_name
  FROM public.patient_profiles
  WHERE id = p_profile_id;

  -- Return if no phone or MRN (can't auto-link)
  IF v_phone IS NULL AND v_mrn IS NULL THEN
    UPDATE public.patient_profiles
    SET needs_manual_linking = true,
        linking_notes = 'No phone or MRN - requires manual linking'
    WHERE id = p_profile_id;

    RETURN;
  END IF;

  -- Find matching appointments (30 days ahead by default)
  RETURN QUERY
  WITH matching_appointments AS (
    SELECT
      a.id as appt_id,
      a.appointment_date,
      a.appointment_time,
      a.provider_name,
      CASE
        WHEN a.patient_phone = v_phone THEN 'phone'
        WHEN a.patient_mrn = v_mrn THEN 'mrn'
        ELSE 'none'
      END as match_type,
      CASE
        WHEN a.patient_phone = v_phone THEN v_phone
        WHEN a.patient_mrn = v_mrn THEN v_mrn
        ELSE NULL
      END as match_value
    FROM public.appointments a
    WHERE
      -- Match on phone or MRN
      (a.patient_phone = v_phone OR a.patient_mrn = v_mrn)
      -- Only future appointments within search window
      AND a.appointment_date >= CURRENT_DATE
      AND a.appointment_date <= CURRENT_DATE + p_search_days_ahead
      -- Not already linked to a different profile
      AND (a.patient_profile_id IS NULL OR a.patient_profile_id = p_profile_id)
      -- Not cancelled or no-show
      AND a.status NOT IN ('cancelled', 'no-show')
  )
  SELECT
    ma.appt_id,
    ma.appointment_date,
    ma.appointment_time,
    ma.provider_name,
    ma.match_type,
    CASE
      WHEN ma.match_type != 'none' THEN (
        -- Create link in audit table
        INSERT INTO public.profile_appointment_links (
          patient_profile_id,
          appointment_id,
          link_method,
          link_confidence,
          matched_on,
          matched_value,
          linked_by
        ) VALUES (
          p_profile_id,
          ma.appt_id,
          'auto_' || ma.match_type,
          1.00,
          ma.match_type,
          ma.match_value,
          'system'
        )
        ON CONFLICT DO NOTHING
        RETURNING true
      ) IS NOT NULL
      ELSE false
    END as link_created
  FROM matching_appointments ma
  WHERE ma.match_type != 'none';

  -- Update appointment records with profile_id
  UPDATE public.appointments
  SET
    patient_profile_id = p_profile_id,
    link_method = CASE
      WHEN patient_phone = v_phone THEN 'auto_phone'
      WHEN patient_mrn = v_mrn THEN 'auto_mrn'
    END,
    linked_at = NOW(),
    linked_by = 'system'
  WHERE id IN (
    SELECT a.id
    FROM public.appointments a
    WHERE
      (a.patient_phone = v_phone OR a.patient_mrn = v_mrn)
      AND a.appointment_date >= CURRENT_DATE
      AND a.appointment_date <= CURRENT_DATE + p_search_days_ahead
      AND (a.patient_profile_id IS NULL OR a.patient_profile_id = p_profile_id)
      AND a.status NOT IN ('cancelled', 'no-show')
  );

  -- Get count of linked appointments
  GET DIAGNOSTICS v_matched_count = ROW_COUNT;

  -- Update patient profile with linking metadata
  UPDATE public.patient_profiles
  SET
    last_linked_at = NOW(),
    linked_appointments_count = v_matched_count,
    needs_manual_linking = (v_matched_count = 0)
  WHERE id = p_profile_id;

  RETURN;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. BULK AUTO-LINKING FUNCTION
-- ============================================================================
-- Links all unlinked profiles to appointments
CREATE OR REPLACE FUNCTION link_all_profiles(
  p_search_days_ahead INTEGER DEFAULT 30
)
RETURNS TABLE (
  profile_id UUID,
  patient_name TEXT,
  appointments_linked INTEGER,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH profile_linking AS (
    SELECT
      pp.id,
      pp.patient_name,
      (SELECT COUNT(*)
       FROM link_profile_to_appointments(pp.id, p_search_days_ahead)
       WHERE link_created = true
      ) as linked_count
    FROM public.patient_profiles pp
    WHERE pp.patient_phone IS NOT NULL
       OR pp.patient_mrn IS NOT NULL
  )
  SELECT
    pl.id,
    pl.patient_name,
    pl.linked_count::INTEGER,
    CASE
      WHEN pl.linked_count > 0 THEN 'linked'
      ELSE 'no_matches'
    END::TEXT
  FROM profile_linking pl;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. TRIGGER TO AUTO-UPDATE updated_at
-- ============================================================================
DROP TRIGGER IF EXISTS update_appointments_updated_at ON public.appointments;
CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 7. HELPFUL VIEWS
-- ============================================================================

-- View: Unlinked Profiles (need manual attention)
CREATE OR REPLACE VIEW unlinked_patient_profiles AS
SELECT
  pp.id,
  pp.patient_name,
  pp.patient_phone,
  pp.patient_mrn,
  pp.conditions,
  pp.created_at,
  pp.needs_manual_linking,
  pp.linking_notes
FROM public.patient_profiles pp
WHERE pp.patient_profile_id IS NULL
  AND pp.created_at >= NOW() - INTERVAL '90 days'
ORDER BY pp.created_at DESC;

-- View: Appointments with Profile Data
CREATE OR REPLACE VIEW appointments_with_profiles AS
SELECT
  a.id as appointment_id,
  a.appointment_date,
  a.appointment_time,
  a.provider_name,
  a.patient_name as appt_patient_name,
  a.status,
  a.patient_profile_id,
  a.link_method,
  a.linked_at,
  pp.patient_name as profile_patient_name,
  pp.patient_phone,
  pp.conditions,
  pp.medications,
  pp.last_note_date
FROM public.appointments a
LEFT JOIN public.patient_profiles pp ON a.patient_profile_id = pp.id
ORDER BY a.appointment_date DESC, a.appointment_time DESC;

-- View: Linking Statistics
CREATE OR REPLACE VIEW linking_statistics AS
SELECT
  COUNT(*) FILTER (WHERE patient_profile_id IS NOT NULL) as linked_appointments,
  COUNT(*) FILTER (WHERE patient_profile_id IS NULL) as unlinked_appointments,
  COUNT(DISTINCT patient_profile_id) as unique_profiles_linked,
  COUNT(*) FILTER (WHERE link_method = 'auto_phone') as auto_phone_links,
  COUNT(*) FILTER (WHERE link_method = 'auto_mrn') as auto_mrn_links,
  COUNT(*) FILTER (WHERE link_method = 'manual') as manual_links
FROM public.appointments
WHERE appointment_date >= CURRENT_DATE;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE public.appointments IS 'Scheduled patient appointments imported from CSV or entered manually';
COMMENT ON TABLE public.profile_appointment_links IS 'Audit trail of all patient profile to appointment linking operations';
COMMENT ON FUNCTION link_profile_to_appointments IS 'Auto-links a patient profile to matching appointments within search window (default 30 days)';
COMMENT ON FUNCTION link_all_profiles IS 'Bulk auto-linking for all patient profiles - returns summary of results';
COMMENT ON VIEW unlinked_patient_profiles IS 'Patient profiles that need manual linking attention';
COMMENT ON VIEW appointments_with_profiles IS 'Appointments joined with patient profile data for easy display';
COMMENT ON VIEW linking_statistics IS 'Summary statistics of linking operations for monitoring';
