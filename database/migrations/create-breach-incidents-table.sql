-- =====================================================
-- Create breach_incidents table for HIPAA breach tracking
-- =====================================================

CREATE TABLE IF NOT EXISTS breach_incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_type VARCHAR(50) NOT NULL,
  discovered_at TIMESTAMP NOT NULL,
  breach_occurred_at TIMESTAMP,
  affected_patient_count INTEGER DEFAULT 0,
  affected_patient_ids TEXT[], -- Array of patient IDs
  severity VARCHAR(20) DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH, CRITICAL
  status VARCHAR(20) DEFAULT 'INVESTIGATING', -- INVESTIGATING, CONFIRMED, MITIGATED, RESOLVED
  notification_deadline TIMESTAMP NOT NULL,
  hhs_notified BOOLEAN DEFAULT false,
  hhs_notification_date TIMESTAMP,
  individuals_notified BOOLEAN DEFAULT false,
  individuals_notification_date TIMESTAMP,
  media_notified BOOLEAN DEFAULT false,
  media_notification_date TIMESTAMP,
  root_cause TEXT,
  mitigation_steps TEXT,
  lessons_learned TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_breach_status ON breach_incidents(status);
CREATE INDEX IF NOT EXISTS idx_breach_discovered ON breach_incidents(discovered_at);
CREATE INDEX IF NOT EXISTS idx_breach_deadline ON breach_incidents(notification_deadline);
CREATE INDEX IF NOT EXISTS idx_breach_severity ON breach_incidents(severity);

-- Enable RLS
ALTER TABLE breach_incidents ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "service_role_all_breach_incidents"
ON breach_incidents
FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- Only admins can view breach incidents
CREATE POLICY "admin_view_breach_incidents"
ON breach_incidents
FOR SELECT
TO authenticated
USING (
  auth.jwt()->>'role' = 'admin'
  OR auth.jwt()->>'email' IN ('admin@tshla.ai', 'rakesh@tshla.ai')
);

COMMENT ON TABLE breach_incidents IS 'HIPAA breach incident tracking and notification management';
