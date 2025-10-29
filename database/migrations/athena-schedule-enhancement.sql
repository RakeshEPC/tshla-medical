-- =============================================
-- TSHLA Medical - Athena Schedule Enhancement
-- =============================================
-- Created: 2025-01-28
-- Purpose: Enhance provider_schedules table for Athena Health integration
-- Run in: Supabase Dashboard → SQL Editor
-- =============================================

-- =============================================
-- 1. ADD NEW COLUMNS TO provider_schedules
-- =============================================

-- Add patient demographic fields
ALTER TABLE provider_schedules
  ADD COLUMN IF NOT EXISTS patient_age INTEGER,
  ADD COLUMN IF NOT EXISTS patient_gender VARCHAR(10),
  ADD COLUMN IF NOT EXISTS chief_diagnosis TEXT,
  ADD COLUMN IF NOT EXISTS visit_reason TEXT;

-- Add Athena-specific fields
ALTER TABLE provider_schedules
  ADD COLUMN IF NOT EXISTS athena_appointment_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS external_patient_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS color_code VARCHAR(20) DEFAULT 'blue';

-- Add import tracking
ALTER TABLE provider_schedules
  ADD COLUMN IF NOT EXISTS imported_by VARCHAR(255),
  ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS import_batch_id UUID;

-- Add provider identification
ALTER TABLE provider_schedules
  ADD COLUMN IF NOT EXISTS provider_specialty VARCHAR(100);

-- =============================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX IF NOT EXISTS idx_provider_schedules_athena_id
  ON provider_schedules(athena_appointment_id);

CREATE INDEX IF NOT EXISTS idx_provider_schedules_batch
  ON provider_schedules(import_batch_id) WHERE import_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_provider_schedules_provider_date
  ON provider_schedules(provider_id, scheduled_date);

CREATE INDEX IF NOT EXISTS idx_provider_schedules_date_status
  ON provider_schedules(scheduled_date, status);

-- =============================================
-- 3. CREATE SCHEDULE IMPORT LOG TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS schedule_imports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Import Details
  batch_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  file_name VARCHAR(255),
  file_size INTEGER,
  schedule_date DATE NOT NULL,

  -- Import Results
  total_rows INTEGER DEFAULT 0,
  successful_imports INTEGER DEFAULT 0,
  duplicate_skips INTEGER DEFAULT 0,
  failed_imports INTEGER DEFAULT 0,
  error_details JSONB,

  -- Who imported
  imported_by_email VARCHAR(255),
  imported_by_name VARCHAR(255),
  imported_by_user_id UUID,

  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Status
  status VARCHAR(50) DEFAULT 'processing'
    CHECK (status IN ('processing', 'completed', 'failed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_schedule_imports_date
  ON schedule_imports(schedule_date DESC);

CREATE INDEX IF NOT EXISTS idx_schedule_imports_user
  ON schedule_imports(imported_by_user_id);

-- =============================================
-- 4. CREATE USEFUL VIEWS
-- =============================================

-- View: Today's schedule across all providers
CREATE OR REPLACE VIEW v_today_schedule AS
SELECT
  ps.id,
  ps.provider_id,
  ps.provider_name,
  ps.provider_specialty,
  ps.patient_name,
  ps.patient_age,
  ps.patient_gender,
  ps.patient_dob,
  ps.patient_phone,
  ps.chief_diagnosis,
  ps.visit_reason,
  ps.appointment_type,
  ps.scheduled_date,
  ps.start_time,
  ps.end_time,
  ps.duration_minutes,
  ps.status,
  ps.is_telehealth,
  COUNT(dn.id) as notes_count,
  MAX(dn.created_at) as last_note_at
FROM provider_schedules ps
LEFT JOIN dictated_notes dn ON ps.id = dn.appointment_id
WHERE ps.scheduled_date = CURRENT_DATE
GROUP BY ps.id
ORDER BY ps.provider_name, ps.start_time;

-- View: Provider schedule summary by date
CREATE OR REPLACE VIEW v_provider_schedule_summary AS
SELECT
  ps.provider_id,
  ps.provider_name,
  ps.provider_specialty,
  ps.scheduled_date,
  COUNT(*) as total_appointments,
  COUNT(*) FILTER (WHERE ps.status = 'completed') as completed_count,
  COUNT(*) FILTER (WHERE ps.status = 'scheduled') as scheduled_count,
  COUNT(*) FILTER (WHERE ps.status = 'cancelled') as cancelled_count,
  MIN(ps.start_time) as first_appointment,
  MAX(ps.end_time) as last_appointment,
  SUM(ps.duration_minutes) as total_minutes
FROM provider_schedules ps
GROUP BY ps.provider_id, ps.provider_name, ps.provider_specialty, ps.scheduled_date
ORDER BY ps.scheduled_date DESC, ps.provider_name;

-- =============================================
-- 5. HELPER FUNCTIONS
-- =============================================

-- Function: Check for duplicate appointment
CREATE OR REPLACE FUNCTION check_duplicate_appointment(
  p_provider_id VARCHAR,
  p_date DATE,
  p_time VARCHAR,
  p_patient_name VARCHAR
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM provider_schedules
    WHERE provider_id = p_provider_id
      AND scheduled_date = p_date
      AND start_time = p_time
      AND patient_name = p_patient_name
      AND status != 'cancelled'
  );
END;
$$ LANGUAGE plpgsql;

-- Function: Get provider's schedule for a date
CREATE OR REPLACE FUNCTION get_provider_schedule(
  p_provider_id VARCHAR,
  p_date DATE
) RETURNS TABLE (
  id BIGINT,
  patient_name VARCHAR,
  patient_age INTEGER,
  patient_gender VARCHAR,
  chief_diagnosis TEXT,
  start_time VARCHAR,
  end_time VARCHAR,
  duration_minutes INTEGER,
  status VARCHAR,
  is_telehealth BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ps.id,
    ps.patient_name,
    ps.patient_age,
    ps.patient_gender,
    ps.chief_diagnosis,
    ps.start_time,
    ps.end_time,
    ps.duration_minutes,
    ps.status,
    ps.is_telehealth
  FROM provider_schedules ps
  WHERE ps.provider_id = p_provider_id
    AND ps.scheduled_date = p_date
  ORDER BY ps.start_time;
END;
$$ LANGUAGE plpgsql;

-- Function: Get all providers with appointments on a date
CREATE OR REPLACE FUNCTION get_providers_with_schedule(
  p_date DATE
) RETURNS TABLE (
  provider_id VARCHAR,
  provider_name VARCHAR,
  provider_specialty VARCHAR,
  appointment_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ps.provider_id,
    ps.provider_name,
    ps.provider_specialty,
    COUNT(*) as appointment_count
  FROM provider_schedules ps
  WHERE ps.scheduled_date = p_date
  GROUP BY ps.provider_id, ps.provider_name, ps.provider_specialty
  ORDER BY ps.provider_name;
END;
$$ LANGUAGE plpgsql;

-- Function: Calculate patient age from DOB
CREATE OR REPLACE FUNCTION calculate_age_from_dob(p_dob DATE)
RETURNS INTEGER AS $$
BEGIN
  IF p_dob IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN EXTRACT(YEAR FROM AGE(CURRENT_DATE, p_dob))::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 6. UPDATE EXISTING RLS POLICIES
-- =============================================

-- Allow admins to view all schedules for import management
DROP POLICY IF EXISTS "Providers can view their own schedule" ON provider_schedules;

CREATE POLICY "Providers and admins can view schedules" ON provider_schedules
  FOR SELECT USING (
    provider_id = current_setting('app.current_provider_id', true)
    OR current_setting('app.is_admin', true)::boolean = true
  );

-- Allow admins to insert schedules (for imports)
DROP POLICY IF EXISTS "Providers can manage their own schedule" ON provider_schedules;

CREATE POLICY "Providers can manage own schedule, admins can manage all" ON provider_schedules
  FOR ALL USING (
    provider_id = current_setting('app.current_provider_id', true)
    OR current_setting('app.is_admin', true)::boolean = true
  );

-- RLS for schedule_imports table
ALTER TABLE schedule_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view import logs" ON schedule_imports
  FOR SELECT USING (
    current_setting('app.is_admin', true)::boolean = true
  );

CREATE POLICY "Only admins can create imports" ON schedule_imports
  FOR INSERT WITH CHECK (
    current_setting('app.is_admin', true)::boolean = true
  );

-- =============================================
-- 7. DATA MIGRATION (if needed)
-- =============================================

-- Calculate age from existing DOB entries
UPDATE provider_schedules
SET patient_age = EXTRACT(YEAR FROM AGE(CURRENT_DATE, patient_dob))::INTEGER
WHERE patient_dob IS NOT NULL
  AND patient_age IS NULL;

-- =============================================
-- 8. VERIFICATION QUERIES
-- =============================================

-- Uncomment to verify installation:

-- Check new columns exist
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'provider_schedules'
-- ORDER BY ordinal_position;

-- Check indexes
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'provider_schedules';

-- Check views
-- SELECT viewname
-- FROM pg_views
-- WHERE schemaname = 'public'
-- AND viewname LIKE 'v_%schedule%';

-- Check functions
-- SELECT routine_name
-- FROM information_schema.routines
-- WHERE routine_schema = 'public'
-- AND routine_type = 'FUNCTION'
-- AND routine_name LIKE '%schedule%';

-- =============================================
-- MIGRATION COMPLETE ✅
-- =============================================
-- Next steps:
-- 1. Verify all tables, indexes, and functions created
-- 2. Test RLS policies with different user roles
-- 3. Import sample Athena schedule file
-- 4. Monitor performance with schedule queries
-- =============================================
