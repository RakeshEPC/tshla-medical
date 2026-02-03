-- CGM Nightscout Integration
-- Stores patient Dexcom/Libre credentials and CGM readings
-- Created: 2026-02-01

-- ============================================================================
-- Table: nightscout_patient_connections
-- Stores encrypted patient CGM credentials for Nightscout to pull data
-- ============================================================================
CREATE TABLE IF NOT EXISTS nightscout_patient_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES unified_patients(id) ON DELETE CASCADE,

  -- Device type
  device_type VARCHAR(50) NOT NULL CHECK (device_type IN ('dexcom', 'libre')),

  -- Dexcom credentials (encrypted)
  dexcom_username_encrypted TEXT,
  dexcom_password_encrypted TEXT,
  dexcom_region VARCHAR(10) DEFAULT 'us' CHECK (dexcom_region IN ('us', 'ous')),

  -- Libre credentials (encrypted)
  libre_username_encrypted TEXT,
  libre_password_encrypted TEXT,
  libre_region VARCHAR(10) DEFAULT 'us',

  -- Sync status
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  last_sync_status VARCHAR(50) DEFAULT 'pending', -- 'success', 'auth_failed', 'error', 'pending'
  last_error_message TEXT,
  sync_frequency_minutes INTEGER DEFAULT 5,

  -- Audit fields
  created_by UUID REFERENCES medical_staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_patient_device UNIQUE (patient_id, device_type),
  CONSTRAINT dexcom_credentials_required CHECK (
    (device_type = 'dexcom' AND dexcom_username_encrypted IS NOT NULL AND dexcom_password_encrypted IS NOT NULL) OR
    device_type != 'dexcom'
  ),
  CONSTRAINT libre_credentials_required CHECK (
    (device_type = 'libre' AND libre_username_encrypted IS NOT NULL AND libre_password_encrypted IS NOT NULL) OR
    device_type != 'libre'
  )
);

-- Index for active connections query (used by Nightscout plugin)
CREATE INDEX idx_nightscout_connections_active ON nightscout_patient_connections(is_active, last_sync_at)
  WHERE is_active = true;

-- Index for patient lookup
CREATE INDEX idx_nightscout_connections_patient ON nightscout_patient_connections(patient_id);

-- Updated at trigger
CREATE TRIGGER update_nightscout_connections_updated_at
  BEFORE UPDATE ON nightscout_patient_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE nightscout_patient_connections IS 'Stores encrypted patient CGM credentials for automatic data synchronization via Nightscout';
COMMENT ON COLUMN nightscout_patient_connections.dexcom_username_encrypted IS 'AES-256 encrypted Dexcom Share username';
COMMENT ON COLUMN nightscout_patient_connections.dexcom_password_encrypted IS 'AES-256 encrypted Dexcom Share password';
COMMENT ON COLUMN nightscout_patient_connections.last_sync_status IS 'Last sync status: success, auth_failed, error, pending';

-- ============================================================================
-- Table: cgm_readings
-- Stores individual glucose readings from CGM devices
-- ============================================================================
CREATE TABLE IF NOT EXISTS cgm_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES unified_patients(id) ON DELETE CASCADE,

  -- Glucose data
  sgv INTEGER NOT NULL, -- Sensor Glucose Value in mg/dL
  direction VARCHAR(20), -- 'Flat', 'FortyFiveUp', 'FortyFiveDown', 'SingleUp', 'SingleDown', 'DoubleUp', 'DoubleDown', 'NOT COMPUTABLE', 'RATE OUT OF RANGE'
  trend INTEGER, -- Numeric trend value

  -- Metadata
  device VARCHAR(100), -- Device name (e.g., 'Dexcom G7', 'Libre 2')
  device_type VARCHAR(50) NOT NULL CHECK (device_type IN ('dexcom', 'libre')),
  source VARCHAR(50) DEFAULT 'nightscout', -- 'nightscout', 'manual', 'api'

  -- Timestamps
  recorded_at TIMESTAMPTZ NOT NULL, -- When the glucose was measured
  received_at TIMESTAMPTZ DEFAULT NOW(), -- When we received this data

  -- Nightscout sync metadata
  nightscout_id VARCHAR(255), -- Original Nightscout _id for deduplication
  nightscout_created_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT valid_glucose_range CHECK (sgv >= 20 AND sgv <= 600),
  CONSTRAINT unique_patient_reading UNIQUE (patient_id, recorded_at, nightscout_id)
);

-- Index for patient glucose history queries
CREATE INDEX idx_cgm_readings_patient_time ON cgm_readings(patient_id, recorded_at DESC);

-- Index for recent readings (commonly queried)
CREATE INDEX idx_cgm_readings_recent ON cgm_readings(recorded_at DESC)
  WHERE recorded_at > NOW() - INTERVAL '7 days';

-- Index for Nightscout deduplication
CREATE INDEX idx_cgm_readings_nightscout_id ON cgm_readings(nightscout_id)
  WHERE nightscout_id IS NOT NULL;

COMMENT ON TABLE cgm_readings IS 'Individual glucose readings from patient CGM devices';
COMMENT ON COLUMN cgm_readings.sgv IS 'Sensor Glucose Value in mg/dL (20-600 range)';
COMMENT ON COLUMN cgm_readings.direction IS 'Glucose trend direction (e.g., SingleUp, Flat, DoubleDown)';
COMMENT ON COLUMN cgm_readings.recorded_at IS 'Timestamp when glucose was measured by CGM device';

-- ============================================================================
-- Table: cgm_statistics
-- Stores calculated CGM statistics (time-in-range, averages, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS cgm_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES unified_patients(id) ON DELETE CASCADE,

  -- Time period
  period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('1day', '7day', '14day', '30day', '90day')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,

  -- Statistics
  total_readings INTEGER NOT NULL DEFAULT 0,
  average_glucose NUMERIC(5,1), -- Average in mg/dL
  median_glucose NUMERIC(5,1),
  std_deviation NUMERIC(5,1),

  -- Glucose Management Indicator (estimated A1C)
  gmi NUMERIC(4,2), -- GMI percentage (e.g., 7.5%)
  estimated_a1c NUMERIC(4,2), -- Estimated A1C percentage

  -- Time in Range (TIR) - percentages
  time_in_range_percent NUMERIC(5,2), -- 70-180 mg/dL (standard range)
  time_below_range_percent NUMERIC(5,2), -- < 70 mg/dL
  time_above_range_percent NUMERIC(5,2), -- > 180 mg/dL
  time_very_low_percent NUMERIC(5,2), -- < 54 mg/dL
  time_very_high_percent NUMERIC(5,2), -- > 250 mg/dL

  -- Custom ranges (if patient has different targets)
  custom_low_threshold INTEGER, -- mg/dL
  custom_high_threshold INTEGER, -- mg/dL
  time_in_custom_range_percent NUMERIC(5,2),

  -- Variability
  coefficient_of_variation NUMERIC(5,2), -- CV% (lower is better, <36% is goal)

  -- Min/Max
  min_glucose INTEGER,
  max_glucose INTEGER,

  -- Calculation metadata
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  calculation_version VARCHAR(10) DEFAULT '1.0',

  -- Constraints
  CONSTRAINT unique_patient_period UNIQUE (patient_id, period_type, period_start),
  CONSTRAINT valid_period_dates CHECK (period_end > period_start),
  CONSTRAINT valid_percentages CHECK (
    time_in_range_percent + time_below_range_percent + time_above_range_percent <= 100.1
  )
);

-- Index for patient statistics queries
CREATE INDEX idx_cgm_stats_patient_period ON cgm_statistics(patient_id, period_type, period_start DESC);

-- Index for recent statistics
CREATE INDEX idx_cgm_stats_recent ON cgm_statistics(calculated_at DESC);

COMMENT ON TABLE cgm_statistics IS 'Calculated CGM statistics for various time periods (TIR, averages, GMI, etc.)';
COMMENT ON COLUMN cgm_statistics.gmi IS 'Glucose Management Indicator - estimated A1C from CGM data';
COMMENT ON COLUMN cgm_statistics.time_in_range_percent IS 'Percentage of time in target range (70-180 mg/dL)';
COMMENT ON COLUMN cgm_statistics.coefficient_of_variation IS 'Glucose variability metric (goal: <36%)';

-- ============================================================================
-- Table: cgm_access_audit
-- HIPAA compliance - audit log of who accessed CGM data
-- ============================================================================
CREATE TABLE IF NOT EXISTS cgm_access_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES unified_patients(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES medical_staff(id),

  -- Action details
  action VARCHAR(50) NOT NULL, -- 'viewed_readings', 'created_connection', 'updated_credentials', 'deleted_connection', 'exported_data'
  resource VARCHAR(100), -- e.g., 'cgm_readings', 'cgm_statistics', 'nightscout_patient_connections'
  details JSONB, -- Additional context (e.g., date range viewed, number of records)

  -- Request metadata
  ip_address INET,
  user_agent TEXT,

  -- Timestamp
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Index for patient audit queries
CREATE INDEX idx_cgm_audit_patient ON cgm_access_audit(patient_id, timestamp DESC);

-- Index for staff audit queries
CREATE INDEX idx_cgm_audit_staff ON cgm_access_audit(staff_id, timestamp DESC);

-- Index for recent audit logs
CREATE INDEX idx_cgm_audit_recent ON cgm_access_audit(timestamp DESC);

COMMENT ON TABLE cgm_access_audit IS 'HIPAA audit log for CGM data access';
COMMENT ON COLUMN cgm_access_audit.action IS 'Type of action performed (viewed_readings, created_connection, etc.)';

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all CGM tables
ALTER TABLE nightscout_patient_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE cgm_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cgm_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE cgm_access_audit ENABLE ROW LEVEL SECURITY;

-- Policy: Medical staff can access CGM connections for their patients
CREATE POLICY cgm_connections_staff_access ON nightscout_patient_connections
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM medical_staff
      WHERE medical_staff.user_id = auth.uid()
    )
  );

-- Policy: Medical staff can view CGM readings for their patients
CREATE POLICY cgm_readings_staff_access ON cgm_readings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM medical_staff
      WHERE medical_staff.user_id = auth.uid()
    )
  );

-- Policy: Medical staff can view CGM statistics
CREATE POLICY cgm_statistics_staff_access ON cgm_statistics
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM medical_staff
      WHERE medical_staff.user_id = auth.uid()
    )
  );

-- Policy: Staff can view audit logs (admin only could be added later)
CREATE POLICY cgm_audit_staff_access ON cgm_access_audit
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM medical_staff
      WHERE medical_staff.user_id = auth.uid()
    )
  );

-- Policy: Patients can view their own CGM data
CREATE POLICY cgm_readings_patient_access ON cgm_readings
  FOR SELECT
  TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM unified_patients
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY cgm_statistics_patient_access ON cgm_statistics
  FOR SELECT
  TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM unified_patients
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to calculate GMI from average glucose
-- GMI = 3.31 + (0.02392 * average_glucose_mg_dL)
-- Reference: Bergenstal et al., Diabetes Care 2018
CREATE OR REPLACE FUNCTION calculate_gmi(avg_glucose_mg_dl NUMERIC)
RETURNS NUMERIC AS $$
BEGIN
  RETURN ROUND(3.31 + (0.02392 * avg_glucose_mg_dl), 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_gmi IS 'Calculate Glucose Management Indicator (GMI) from average glucose';

-- Function to get latest glucose reading for a patient
CREATE OR REPLACE FUNCTION get_latest_glucose(p_patient_id UUID)
RETURNS TABLE (
  sgv INTEGER,
  direction VARCHAR(20),
  recorded_at TIMESTAMPTZ,
  device VARCHAR(100),
  minutes_ago INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.sgv,
    r.direction,
    r.recorded_at,
    r.device,
    EXTRACT(EPOCH FROM (NOW() - r.recorded_at))::INTEGER / 60 AS minutes_ago
  FROM cgm_readings r
  WHERE r.patient_id = p_patient_id
  ORDER BY r.recorded_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_latest_glucose IS 'Get most recent glucose reading for a patient';

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION calculate_gmi TO authenticated;
GRANT EXECUTE ON FUNCTION get_latest_glucose TO authenticated;

-- ============================================================================
-- Sample data cleanup function
-- Auto-delete old readings (keep last 90 days in MongoDB, archive rest in Supabase)
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_old_cgm_readings()
RETURNS void AS $$
BEGIN
  -- This function is a placeholder for future cleanup logic
  -- Currently we keep all readings in Supabase indefinitely
  -- MongoDB will only keep last 90 days via Nightscout plugin
  NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_cgm_readings IS 'Placeholder for future CGM data archival logic';
