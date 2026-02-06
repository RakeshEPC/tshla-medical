-- ============================================
-- Migration 033: Create Patient Daily Status Table
-- ============================================
-- Purpose: Store pre-computed AI status for patient portal HOME screen
--          Computed nightly + after significant events
-- Created: 2026-02-06
-- ============================================

-- This table powers the "Single Headline Priority System"
-- Priority ladder: Safety → New Info → Trends → Stable

-- ============================================
-- 1. Create patient_daily_status table
-- ============================================

CREATE TABLE IF NOT EXISTS patient_daily_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unified_patient_id UUID NOT NULL REFERENCES unified_patients(id) ON DELETE CASCADE,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  computed_date DATE NOT NULL DEFAULT CURRENT_DATE, -- For unique constraint (one status per patient per day)

  -- ========================================
  -- PRIORITY HEADLINE (Single line)
  -- ========================================
  status_type VARCHAR(20) NOT NULL CHECK (status_type IN ('safety', 'new_info', 'trend', 'stable')),
  status_headline TEXT NOT NULL,
  status_emoji VARCHAR(10),

  -- Priority explanation (internal use)
  priority_reason TEXT,

  -- ========================================
  -- WHAT CHANGED (Max 3 items)
  -- ========================================
  changes JSONB DEFAULT '[]'::jsonb,
  -- [
  --   {
  --     "type": "lab",
  --     "description": "A1C improved to 6.8%",
  --     "trend": "improving",
  --     "date": "2026-02-05"
  --   },
  --   {
  --     "type": "medication",
  --     "description": "Started Ozempic 0.25mg",
  --     "trend": "new",
  --     "date": "2026-02-03"
  --   }
  -- ]

  -- ========================================
  -- WHAT MATTERS NOW (1 focus item)
  -- ========================================
  focus_item TEXT,
  focus_category VARCHAR(50), -- 'glucose_control', 'medication', 'appointment', 'lab', 'education'
  focus_detail JSONB, -- Additional structured data for the focus item

  -- ========================================
  -- NEXT STEP (1 action)
  -- ========================================
  next_action TEXT,
  next_action_type VARCHAR(50) CHECK (next_action_type IN ('refill', 'schedule', 'question', 'lab', 'message', 'none')),
  next_action_url TEXT, -- Deep link in app
  next_action_priority INTEGER DEFAULT 0, -- 0=low, 1=medium, 2=high

  -- ========================================
  -- SPECIALIST COUNCIL STATUS
  -- ========================================
  council_status JSONB DEFAULT '{}'::jsonb,
  -- {
  --   "cardiology": {
  --     "status": "stable",
  --     "last_note_date": "2026-01-15",
  --     "summary": "Echo normal, continue current regimen",
  --     "provider_name": "Dr. Heart"
  --   },
  --   "nephrology": {
  --     "status": "monitoring",
  --     "last_note_date": "2026-01-20",
  --     "summary": "eGFR stable at 65, recheck in 3 months",
  --     "provider_name": "Dr. Kidney"
  --   },
  --   "ophthalmology": {
  --     "status": "due",
  --     "last_exam_date": "2025-02-10",
  --     "summary": "Annual diabetic eye exam due",
  --     "provider_name": null
  --   }
  -- }

  -- ========================================
  -- CLINICAL SNAPSHOT (for context)
  -- ========================================
  clinical_snapshot JSONB DEFAULT '{}'::jsonb,
  -- {
  --   "latest_a1c": {"value": 6.8, "date": "2026-02-05", "trend": "improving"},
  --   "latest_glucose": {"value": 142, "trend": "→", "timestamp": "2026-02-06T08:30:00Z"},
  --   "time_in_range_24h": 78,
  --   "active_medications_count": 5,
  --   "pending_refills": 1,
  --   "days_since_last_visit": 14,
  --   "next_appointment": "2026-03-01"
  -- }

  -- ========================================
  -- METADATA
  -- ========================================
  data_sources JSONB DEFAULT '[]'::jsonb, -- What was used to compute this
  -- ["labs", "cgm", "medications", "dictated_notes", "external_documents"]

  computation_duration_ms INTEGER, -- How long AI took to compute
  model_version VARCHAR(50), -- AI model version used
  expires_at TIMESTAMPTZ, -- When this status should be recomputed

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. Create indexes
-- ============================================

-- Unique constraint: Only one status per patient per day
CREATE UNIQUE INDEX IF NOT EXISTS unique_patient_status_date
  ON patient_daily_status(unified_patient_id, computed_date);

-- Primary lookup: Get current status for patient
CREATE INDEX idx_patient_status_patient_current
  ON patient_daily_status(unified_patient_id, computed_at DESC);

-- Find expired statuses (for recomputation) - query will filter by NOW() at runtime
CREATE INDEX idx_patient_status_expired
  ON patient_daily_status(expires_at)
  WHERE expires_at IS NOT NULL;

-- Find statuses by type (for analytics)
CREATE INDEX idx_patient_status_type
  ON patient_daily_status(status_type, computed_at DESC);

-- Find safety-priority statuses (for alerts)
CREATE INDEX idx_patient_status_safety
  ON patient_daily_status(unified_patient_id, computed_at DESC)
  WHERE status_type = 'safety';

-- ============================================
-- 3. Create function to get current patient status
-- ============================================

CREATE OR REPLACE FUNCTION get_current_patient_status(p_patient_id UUID)
RETURNS patient_daily_status AS $$
DECLARE
  status_record patient_daily_status;
BEGIN
  SELECT * INTO status_record
  FROM patient_daily_status
  WHERE unified_patient_id = p_patient_id
    AND (expires_at IS NULL OR expires_at > NOW())
  ORDER BY computed_at DESC
  LIMIT 1;

  RETURN status_record;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_current_patient_status IS 'Get the most recent valid status for a patient';

-- ============================================
-- 4. Create function to check if status needs refresh
-- ============================================

CREATE OR REPLACE FUNCTION patient_status_needs_refresh(p_patient_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  last_status RECORD;
BEGIN
  SELECT computed_at, computed_date, expires_at INTO last_status
  FROM patient_daily_status
  WHERE unified_patient_id = p_patient_id
  ORDER BY computed_at DESC
  LIMIT 1;

  -- No status exists
  IF last_status IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Status has expired
  IF last_status.expires_at IS NOT NULL AND last_status.expires_at < NOW() THEN
    RETURN TRUE;
  END IF;

  -- Status is from yesterday or earlier
  IF last_status.computed_date < CURRENT_DATE THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION patient_status_needs_refresh IS 'Check if patient status needs to be recomputed';

-- ============================================
-- 5. Create view for patients needing status refresh
-- ============================================

CREATE OR REPLACE VIEW v_patients_needing_status_refresh AS
SELECT
  up.id as unified_patient_id,
  up.tshla_id,
  up.full_name,
  up.phone_primary,
  pds.computed_at as last_computed,
  pds.computed_date,
  pds.expires_at,
  CASE
    WHEN pds.id IS NULL THEN 'never_computed'
    WHEN pds.expires_at < NOW() THEN 'expired'
    WHEN pds.computed_date < CURRENT_DATE THEN 'stale'
    ELSE 'unknown'
  END as refresh_reason
FROM unified_patients up
LEFT JOIN LATERAL (
  SELECT id, computed_at, computed_date, expires_at
  FROM patient_daily_status
  WHERE unified_patient_id = up.id
  ORDER BY computed_at DESC
  LIMIT 1
) pds ON true
WHERE up.has_portal_access = true
  AND up.is_active = true
  AND (
    pds.id IS NULL
    OR pds.expires_at < NOW()
    OR pds.computed_date < CURRENT_DATE
  )
ORDER BY
  CASE WHEN pds.id IS NULL THEN 0 ELSE 1 END,
  pds.computed_at ASC NULLS FIRST;

COMMENT ON VIEW v_patients_needing_status_refresh IS 'Portal patients whose status needs recomputation';

-- ============================================
-- 6. Create trigger to invalidate status on data changes
-- ============================================

-- Function to mark status as expired when relevant data changes
CREATE OR REPLACE FUNCTION invalidate_patient_status_on_change()
RETURNS TRIGGER AS $$
DECLARE
  patient_uuid UUID;
BEGIN
  -- Get the patient UUID from the changed record
  IF TG_TABLE_NAME = 'patient_medications' THEN
    patient_uuid := NEW.patient_id;
  ELSIF TG_TABLE_NAME = 'cgm_readings' THEN
    patient_uuid := NEW.unified_patient_id;
  ELSIF TG_TABLE_NAME = 'dictated_notes' THEN
    patient_uuid := NEW.unified_patient_id;
  ELSIF TG_TABLE_NAME = 'patient_comprehensive_chart' THEN
    patient_uuid := NEW.unified_patient_id;
  END IF;

  -- Mark existing status as expired (will be recomputed)
  IF patient_uuid IS NOT NULL THEN
    UPDATE patient_daily_status
    SET expires_at = NOW()
    WHERE unified_patient_id = patient_uuid
      AND (expires_at IS NULL OR expires_at > NOW());
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers on relevant tables
DROP TRIGGER IF EXISTS trigger_invalidate_status_medications ON patient_medications;
CREATE TRIGGER trigger_invalidate_status_medications
  AFTER INSERT OR UPDATE ON patient_medications
  FOR EACH ROW
  EXECUTE FUNCTION invalidate_patient_status_on_change();

-- Note: Triggers for cgm_readings, dictated_notes, etc. can be added
-- but may cause too frequent invalidation. Consider batch approach instead.

-- ============================================
-- 7. RLS Policies
-- ============================================

ALTER TABLE patient_daily_status ENABLE ROW LEVEL SECURITY;

-- Patients can see their own status
CREATE POLICY "Patients see their own status" ON patient_daily_status
  FOR SELECT USING (
    unified_patient_id IN (
      SELECT id FROM unified_patients
      WHERE auth_user_id = auth.uid()
    )
  );

-- Medical staff can see all statuses
CREATE POLICY "Staff can view all statuses" ON patient_daily_status
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM medical_staff
      WHERE auth_user_id = auth.uid()
    )
  );

-- Service role can do everything (for nightly job)
CREATE POLICY "Service role full access" ON patient_daily_status
  FOR ALL USING (
    auth.jwt()->>'role' = 'service_role'
  );

-- ============================================
-- 8. Verification queries (run manually)
-- ============================================

-- Check status distribution
-- SELECT status_type, COUNT(*) FROM patient_daily_status GROUP BY status_type;

-- Check patients without status
-- SELECT COUNT(*) as patients_without_status
-- FROM unified_patients up
-- WHERE up.has_portal_access = true
--   AND up.is_active = true
--   AND NOT EXISTS (
--     SELECT 1 FROM patient_daily_status pds
--     WHERE pds.unified_patient_id = up.id
--   );

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- patient_daily_status table is ready for AI status computation
-- Use get_current_patient_status() to retrieve status
-- Use v_patients_needing_status_refresh to find patients needing update
-- Status automatically invalidates when medications change
-- ============================================
