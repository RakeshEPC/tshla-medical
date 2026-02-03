-- ============================================
-- TSHLA Medical - CGM Data Integration Schema
-- Nightscout Integration for Continuous Glucose Monitoring
-- ============================================
-- Created: 2026-02-02
-- Database: Supabase PostgreSQL
-- Purpose: Store and manage CGM data from Nightscout
-- ============================================

-- ============================================
-- CGM READINGS TABLE
-- Stores individual glucose readings from Nightscout
-- ============================================
CREATE TABLE IF NOT EXISTS cgm_readings (
  id BIGSERIAL PRIMARY KEY,

  -- Patient Identification
  patient_phone VARCHAR(50) NOT NULL,
  patient_mrn VARCHAR(50),
  patient_name VARCHAR(255),

  -- CGM Data
  glucose_value INTEGER NOT NULL,           -- Glucose reading (e.g., 142)
  glucose_units VARCHAR(10) DEFAULT 'mg/dl' CHECK (glucose_units IN ('mg/dl', 'mmol/L')),
  trend_direction VARCHAR(20),              -- 'Flat', 'FortyFiveUp', 'SingleUp', 'DoubleUp', 'FortyFiveDown', 'SingleDown', 'DoubleDown'
  trend_arrow VARCHAR(10),                  -- '→', '↗', '↑', '↑↑', '↘', '↓', '↓↓'

  -- Reading Metadata
  reading_timestamp TIMESTAMPTZ NOT NULL,   -- When glucose was measured
  device_name VARCHAR(100),                 -- 'Dexcom G6', etc.
  nightscout_id VARCHAR(100) UNIQUE,        -- Nightscout entry ID (prevent duplicates)
  nightscout_url VARCHAR(255),              -- Source Nightscout instance

  -- Data Quality
  is_calibration BOOLEAN DEFAULT false,
  noise_level VARCHAR(20),                  -- 'Clean', 'Light', 'Medium', 'Heavy'

  -- Sync Tracking
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Performance Indexes
  CONSTRAINT unique_nightscout_reading UNIQUE(nightscout_id)
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_cgm_patient_phone ON cgm_readings(patient_phone);
CREATE INDEX IF NOT EXISTS idx_cgm_patient_mrn ON cgm_readings(patient_mrn) WHERE patient_mrn IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cgm_timestamp ON cgm_readings(reading_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_cgm_patient_recent ON cgm_readings(patient_phone, reading_timestamp DESC);

-- ============================================
-- PATIENT NIGHTSCOUT CONFIGURATION TABLE
-- Stores connection details for each patient's Nightscout instance
-- ============================================
CREATE TABLE IF NOT EXISTS patient_nightscout_config (
  id BIGSERIAL PRIMARY KEY,

  -- Patient Identification
  patient_phone VARCHAR(50) UNIQUE NOT NULL,
  patient_mrn VARCHAR(50),
  patient_name VARCHAR(255),
  provider_id VARCHAR(100),                 -- Provider who configured this

  -- Nightscout Connection Details
  nightscout_url VARCHAR(255) NOT NULL,     -- e.g., 'patelcyfair.nightscoutpro.com' or 'https://...'
  api_secret_encrypted TEXT NOT NULL,       -- Encrypted API secret (never store plain text!)

  -- Sync Settings
  sync_enabled BOOLEAN DEFAULT true,
  sync_interval_minutes INTEGER DEFAULT 15 CHECK (sync_interval_minutes >= 5),
  last_sync_at TIMESTAMPTZ,
  last_successful_sync_at TIMESTAMPTZ,
  sync_error_count INTEGER DEFAULT 0,

  -- Connection Status
  connection_status VARCHAR(50) DEFAULT 'active' CHECK (connection_status IN ('active', 'inactive', 'error', 'unauthorized')),
  last_error TEXT,
  last_connection_test_at TIMESTAMPTZ,

  -- Data Retention
  keep_days_of_data INTEGER DEFAULT 30 CHECK (keep_days_of_data >= 7),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  configured_by_provider_name VARCHAR(255)
);

-- Indexes for configuration lookups
CREATE INDEX IF NOT EXISTS idx_nightscout_config_phone ON patient_nightscout_config(patient_phone);
CREATE INDEX IF NOT EXISTS idx_nightscout_config_sync_enabled ON patient_nightscout_config(sync_enabled) WHERE sync_enabled = true;
CREATE INDEX IF NOT EXISTS idx_nightscout_config_status ON patient_nightscout_config(connection_status);

-- ============================================
-- CGM STATISTICS TABLE (Aggregated Data)
-- Pre-calculated statistics for faster dashboard loading
-- ============================================
CREATE TABLE IF NOT EXISTS cgm_statistics (
  id BIGSERIAL PRIMARY KEY,

  -- Patient Identification
  patient_phone VARCHAR(50) NOT NULL,
  patient_mrn VARCHAR(50),

  -- Time Period
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  period_type VARCHAR(20) CHECK (period_type IN ('daily', 'weekly', 'monthly')),

  -- Glucose Statistics
  avg_glucose DECIMAL(5,1),                 -- Average glucose (e.g., 165.3 mg/dl)
  median_glucose DECIMAL(5,1),
  std_deviation DECIMAL(5,1),

  -- Time in Range (%)
  time_in_range_percent DECIMAL(5,2),      -- % between 70-180 mg/dl
  time_above_range_percent DECIMAL(5,2),   -- % above 180 mg/dl
  time_below_range_percent DECIMAL(5,2),   -- % below 70 mg/dl

  -- Event Counts
  low_events_count INTEGER DEFAULT 0,      -- Number of readings <70
  very_low_events_count INTEGER DEFAULT 0, -- Number of readings <54
  high_events_count INTEGER DEFAULT 0,     -- Number of readings >180
  very_high_events_count INTEGER DEFAULT 0,-- Number of readings >250

  -- Data Quality
  total_readings INTEGER,
  readings_per_day DECIMAL(5,1),
  data_completeness_percent DECIMAL(5,2),

  -- Calculated HbA1c Estimate (GMI - Glucose Management Indicator)
  estimated_a1c DECIMAL(3,1),              -- e.g., 7.2%

  -- Timestamps
  calculated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate stat periods
  CONSTRAINT unique_patient_period UNIQUE(patient_phone, period_start, period_type)
);

-- Indexes for statistics queries
CREATE INDEX IF NOT EXISTS idx_cgm_stats_patient ON cgm_statistics(patient_phone, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_cgm_stats_period ON cgm_statistics(period_type, period_start DESC);

-- ============================================
-- CGM ALERTS TABLE
-- Track glucose alerts and notifications
-- ============================================
CREATE TABLE IF NOT EXISTS cgm_alerts (
  id BIGSERIAL PRIMARY KEY,

  -- Patient Identification
  patient_phone VARCHAR(50) NOT NULL,
  patient_mrn VARCHAR(50),

  -- Alert Details
  alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('low', 'very_low', 'high', 'very_high', 'urgent_low', 'rapid_rise', 'rapid_fall')),
  glucose_value INTEGER NOT NULL,
  trend_direction VARCHAR(20),

  -- Alert Metadata
  alert_timestamp TIMESTAMPTZ NOT NULL,
  alert_message TEXT,
  severity VARCHAR(20) CHECK (severity IN ('info', 'warning', 'critical', 'urgent')),

  -- Provider Notification
  provider_notified BOOLEAN DEFAULT false,
  provider_notified_at TIMESTAMPTZ,
  provider_id VARCHAR(100),

  -- Resolution
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for alert queries
CREATE INDEX IF NOT EXISTS idx_cgm_alerts_patient ON cgm_alerts(patient_phone, alert_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_cgm_alerts_unresolved ON cgm_alerts(patient_phone) WHERE is_resolved = false;
CREATE INDEX IF NOT EXISTS idx_cgm_alerts_severity ON cgm_alerts(severity, alert_timestamp DESC);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp for nightscout config
CREATE OR REPLACE FUNCTION update_nightscout_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_nightscout_config_timestamp
BEFORE UPDATE ON patient_nightscout_config
FOR EACH ROW
EXECUTE FUNCTION update_nightscout_config_updated_at();

-- Auto-cleanup old CGM readings (keep only configured days of data)
CREATE OR REPLACE FUNCTION cleanup_old_cgm_readings()
RETURNS void AS $$
DECLARE
  config_record RECORD;
  deleted_count INTEGER;
BEGIN
  -- For each patient with Nightscout configured
  FOR config_record IN
    SELECT patient_phone, keep_days_of_data
    FROM patient_nightscout_config
    WHERE sync_enabled = true
  LOOP
    -- Delete readings older than keep_days_of_data
    DELETE FROM cgm_readings
    WHERE patient_phone = config_record.patient_phone
      AND reading_timestamp < NOW() - (config_record.keep_days_of_data || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    IF deleted_count > 0 THEN
      RAISE NOTICE 'Deleted % old CGM readings for patient %', deleted_count, config_record.patient_phone;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get patient's current glucose reading
CREATE OR REPLACE FUNCTION get_current_glucose(p_patient_phone VARCHAR)
RETURNS TABLE (
  glucose_value INTEGER,
  trend_arrow VARCHAR,
  reading_timestamp TIMESTAMPTZ,
  minutes_ago INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cr.glucose_value,
    cr.trend_arrow,
    cr.reading_timestamp,
    EXTRACT(EPOCH FROM (NOW() - cr.reading_timestamp))::INTEGER / 60 as minutes_ago
  FROM cgm_readings cr
  WHERE cr.patient_phone = p_patient_phone
  ORDER BY cr.reading_timestamp DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Calculate time in range for a patient
CREATE OR REPLACE FUNCTION calculate_time_in_range(
  p_patient_phone VARCHAR,
  p_hours_back INTEGER DEFAULT 24
)
RETURNS TABLE (
  total_readings INTEGER,
  in_range_count INTEGER,
  below_range_count INTEGER,
  above_range_count INTEGER,
  time_in_range_percent DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  WITH readings AS (
    SELECT glucose_value
    FROM cgm_readings
    WHERE patient_phone = p_patient_phone
      AND reading_timestamp > NOW() - (p_hours_back || ' hours')::INTERVAL
  )
  SELECT
    COUNT(*)::INTEGER as total_readings,
    COUNT(*) FILTER (WHERE glucose_value BETWEEN 70 AND 180)::INTEGER as in_range_count,
    COUNT(*) FILTER (WHERE glucose_value < 70)::INTEGER as below_range_count,
    COUNT(*) FILTER (WHERE glucose_value > 180)::INTEGER as above_range_count,
    ROUND(
      (COUNT(*) FILTER (WHERE glucose_value BETWEEN 70 AND 180)::DECIMAL / NULLIF(COUNT(*), 0) * 100),
      2
    ) as time_in_range_percent
  FROM readings;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- HIPAA Compliance - CGM data is PHI
-- ============================================

-- Enable RLS on all CGM tables
ALTER TABLE cgm_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_nightscout_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE cgm_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE cgm_alerts ENABLE ROW LEVEL SECURITY;

-- CGM Readings Policies
CREATE POLICY "Providers can view CGM data for their patients" ON cgm_readings
  FOR SELECT USING (
    -- Allow if provider has access to this patient (via shared patients table or provider assignment)
    EXISTS (
      SELECT 1 FROM patient_nightscout_config pnc
      WHERE pnc.patient_phone = cgm_readings.patient_phone
        AND (
          pnc.provider_id = current_setting('app.current_provider_id', true)
          OR current_setting('app.is_admin', true)::boolean = true
        )
    )
  );

CREATE POLICY "System can insert CGM readings" ON cgm_readings
  FOR INSERT WITH CHECK (true);  -- Sync service runs as system

-- Nightscout Config Policies
CREATE POLICY "Providers can view their patients' Nightscout config" ON patient_nightscout_config
  FOR SELECT USING (
    provider_id = current_setting('app.current_provider_id', true)
    OR current_setting('app.is_admin', true)::boolean = true
  );

CREATE POLICY "Providers can manage their patients' Nightscout config" ON patient_nightscout_config
  FOR ALL USING (
    provider_id = current_setting('app.current_provider_id', true)
    OR current_setting('app.is_admin', true)::boolean = true
  );

-- Statistics Policies (same as readings)
CREATE POLICY "Providers can view CGM statistics" ON cgm_statistics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM patient_nightscout_config pnc
      WHERE pnc.patient_phone = cgm_statistics.patient_phone
        AND (
          pnc.provider_id = current_setting('app.current_provider_id', true)
          OR current_setting('app.is_admin', true)::boolean = true
        )
    )
  );

-- Alerts Policies
CREATE POLICY "Providers can view CGM alerts" ON cgm_alerts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM patient_nightscout_config pnc
      WHERE pnc.patient_phone = cgm_alerts.patient_phone
        AND (
          pnc.provider_id = current_setting('app.current_provider_id', true)
          OR current_setting('app.is_admin', true)::boolean = true
        )
    )
  );

CREATE POLICY "Providers can update their alerts" ON cgm_alerts
  FOR UPDATE USING (
    provider_id = current_setting('app.current_provider_id', true)
  );

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check all tables exist
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('cgm_readings', 'patient_nightscout_config', 'cgm_statistics', 'cgm_alerts')
-- ORDER BY table_name;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- CGM Data schema is ready for Nightscout integration!
-- Next steps:
-- 1. Run this SQL in Supabase SQL Editor
-- 2. Create encryption key for API secrets
-- 3. Build Nightscout service backend
-- 4. Test with real Nightscout data
-- ============================================
