-- Fix the ambiguous column reference in link_profile_to_appointments function

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
  SELECT patient_phone, patient_mrn, patient_name
  INTO v_phone, v_mrn, v_name
  FROM public.patient_profiles
  WHERE id = p_profile_id;

  IF v_phone IS NULL AND v_mrn IS NULL THEN
    UPDATE public.patient_profiles
    SET needs_manual_linking = true,
        linking_notes = 'No phone or MRN - requires manual linking'
    WHERE id = p_profile_id;
    RETURN;
  END IF;

  -- First, update appointments table
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

  GET DIAGNOSTICS v_matched_count = ROW_COUNT;

  -- Then, create audit records and return results
  RETURN QUERY
  WITH matching_appointments AS (
    SELECT
      a.id as appt_id,
      a.appointment_date as appt_date,
      a.appointment_time as appt_time,
      a.provider_name as appt_provider,
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
      a.patient_profile_id = p_profile_id
      AND a.appointment_date >= CURRENT_DATE
      AND a.appointment_date <= CURRENT_DATE + p_search_days_ahead
  ),
  audit_inserts AS (
    INSERT INTO public.profile_appointment_links (
      patient_profile_id,
      appointment_id,
      link_method,
      link_confidence,
      matched_on,
      matched_value,
      linked_by
    )
    SELECT
      p_profile_id,
      ma.appt_id,
      'auto_' || ma.match_type,
      1.00,
      ma.match_type,
      ma.match_value,
      'system'
    FROM matching_appointments ma
    WHERE ma.match_type != 'none'
    ON CONFLICT DO NOTHING
    RETURNING appointment_id
  )
  SELECT
    ma.appt_id,
    ma.appt_date,
    ma.appt_time,
    ma.appt_provider,
    ma.match_type,
    true as link_created
  FROM matching_appointments ma
  WHERE ma.match_type != 'none';

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
