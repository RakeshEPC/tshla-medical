-- =====================================================
-- HIPAA Phase 7: Enhanced Audit Logging
-- =====================================================
-- Created: 2026-01-08
-- Purpose: Comprehensive audit trail for all PHI access and system events
-- HIPAA: §164.308(a)(1)(ii)(D) - Information System Activity Review
--        §164.312(b) - Audit Controls

-- =====================================================
-- Create audit_logs table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Timestamp
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- User information
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT NOT NULL,
  user_role TEXT,

  -- Action details
  action TEXT NOT NULL, -- 'view', 'create', 'update', 'delete', 'export', 'login', 'logout', 'search'
  resource_type TEXT NOT NULL, -- 'patient', 'pump_report', 'medical_record', 'appointment', 'session'
  resource_id TEXT, -- ID of the resource accessed

  -- Request details
  ip_address INET,
  user_agent TEXT,
  request_path TEXT,
  request_method TEXT, -- GET, POST, PUT, DELETE

  -- Outcome
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  status_code INTEGER,

  -- Additional context (flexible JSON field)
  metadata JSONB,

  -- PHI flags (for quick filtering of PHI-related events)
  contains_phi BOOLEAN NOT NULL DEFAULT false,
  phi_fields TEXT[], -- Array of field names that contain PHI

  -- Performance tracking
  response_time_ms INTEGER,

  -- Session tracking
  session_id UUID REFERENCES public.user_sessions(id) ON DELETE SET NULL,
  device_fingerprint TEXT
);

-- =====================================================
-- Create indexes for performance and querying
-- =====================================================
CREATE INDEX idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_user_email ON public.audit_logs(user_email);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_resource_type ON public.audit_logs(resource_type);
CREATE INDEX idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_contains_phi ON public.audit_logs(contains_phi) WHERE contains_phi = true;
CREATE INDEX idx_audit_logs_success ON public.audit_logs(success) WHERE success = false;
CREATE INDEX idx_audit_logs_user_action ON public.audit_logs(user_id, action);
CREATE INDEX idx_audit_logs_timestamp_action ON public.audit_logs(timestamp DESC, action);

-- GIN index for JSONB metadata queries
CREATE INDEX idx_audit_logs_metadata ON public.audit_logs USING GIN(metadata);

-- =====================================================
-- Enable Row Level Security (RLS)
-- =====================================================
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view all audit logs
CREATE POLICY "Admins can view all audit logs"
  ON public.audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.medical_staff
      WHERE medical_staff.auth_user_id = auth.uid()
        AND medical_staff.role IN ('admin', 'super_admin')
        AND medical_staff.is_active = true
    )
  );

-- Policy: Users can view their own audit logs
CREATE POLICY "Users can view own audit logs"
  ON public.audit_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: System can insert audit logs (authenticated users)
CREATE POLICY "System can insert audit logs"
  ON public.audit_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- Create function to log audit event
-- =====================================================
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_user_id UUID,
  p_user_email TEXT,
  p_user_role TEXT,
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_request_path TEXT DEFAULT NULL,
  p_request_method TEXT DEFAULT NULL,
  p_success BOOLEAN DEFAULT true,
  p_error_message TEXT DEFAULT NULL,
  p_status_code INTEGER DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_contains_phi BOOLEAN DEFAULT false,
  p_phi_fields TEXT[] DEFAULT NULL,
  p_response_time_ms INTEGER DEFAULT NULL,
  p_session_id UUID DEFAULT NULL,
  p_device_fingerprint TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  audit_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    user_email,
    user_role,
    action,
    resource_type,
    resource_id,
    ip_address,
    user_agent,
    request_path,
    request_method,
    success,
    error_message,
    status_code,
    metadata,
    contains_phi,
    phi_fields,
    response_time_ms,
    session_id,
    device_fingerprint
  ) VALUES (
    p_user_id,
    p_user_email,
    p_user_role,
    p_action,
    p_resource_type,
    p_resource_id,
    p_ip_address,
    p_user_agent,
    p_request_path,
    p_request_method,
    p_success,
    p_error_message,
    p_status_code,
    p_metadata,
    p_contains_phi,
    p_phi_fields,
    p_response_time_ms,
    p_session_id,
    p_device_fingerprint
  ) RETURNING id INTO audit_id;

  RETURN audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Create function to get audit statistics
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_audit_statistics(
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  total_events BIGINT,
  total_users BIGINT,
  total_phi_access BIGINT,
  total_failures BIGINT,
  actions_by_type JSONB,
  resources_by_type JSONB,
  top_users JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_events,
    COUNT(DISTINCT user_id)::BIGINT as total_users,
    COUNT(*) FILTER (WHERE contains_phi = true)::BIGINT as total_phi_access,
    COUNT(*) FILTER (WHERE success = false)::BIGINT as total_failures,
    jsonb_object_agg(action_count.action, action_count.count) as actions_by_type,
    jsonb_object_agg(resource_count.resource_type, resource_count.count) as resources_by_type,
    (
      SELECT jsonb_agg(jsonb_build_object('email', user_email, 'count', event_count))
      FROM (
        SELECT user_email, COUNT(*) as event_count
        FROM public.audit_logs
        WHERE timestamp BETWEEN p_start_date AND p_end_date
        GROUP BY user_email
        ORDER BY event_count DESC
        LIMIT 10
      ) top_users_sub
    ) as top_users
  FROM public.audit_logs
  CROSS JOIN LATERAL (
    SELECT action, COUNT(*) as count
    FROM public.audit_logs
    WHERE timestamp BETWEEN p_start_date AND p_end_date
    GROUP BY action
  ) action_count
  CROSS JOIN LATERAL (
    SELECT resource_type, COUNT(*) as count
    FROM public.audit_logs
    WHERE timestamp BETWEEN p_start_date AND p_end_date
    GROUP BY resource_type
  ) resource_count
  WHERE timestamp BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Create function to detect suspicious activity
-- =====================================================
CREATE OR REPLACE FUNCTION public.detect_suspicious_activity(
  p_lookback_minutes INTEGER DEFAULT 60
)
RETURNS TABLE (
  user_email TEXT,
  suspicious_reason TEXT,
  event_count BIGINT,
  recent_events JSONB
) AS $$
BEGIN
  -- Detect users with excessive failed attempts
  RETURN QUERY
  SELECT
    al.user_email,
    'Excessive failed attempts' as suspicious_reason,
    COUNT(*) as event_count,
    jsonb_agg(
      jsonb_build_object(
        'timestamp', al.timestamp,
        'action', al.action,
        'resource_type', al.resource_type,
        'error_message', al.error_message
      )
      ORDER BY al.timestamp DESC
    ) as recent_events
  FROM public.audit_logs al
  WHERE al.timestamp > NOW() - (p_lookback_minutes || ' minutes')::INTERVAL
    AND al.success = false
  GROUP BY al.user_email
  HAVING COUNT(*) > 10;

  -- Detect users accessing unusually high number of patient records
  RETURN QUERY
  SELECT
    al.user_email,
    'Excessive PHI access' as suspicious_reason,
    COUNT(*) as event_count,
    jsonb_agg(
      jsonb_build_object(
        'timestamp', al.timestamp,
        'action', al.action,
        'resource_type', al.resource_type,
        'resource_id', al.resource_id
      )
      ORDER BY al.timestamp DESC
    ) as recent_events
  FROM public.audit_logs al
  WHERE al.timestamp > NOW() - (p_lookback_minutes || ' minutes')::INTERVAL
    AND al.contains_phi = true
    AND al.resource_type IN ('patient', 'medical_record', 'pump_report')
  GROUP BY al.user_email
  HAVING COUNT(*) > 50;

  -- Detect users with multiple IP addresses in short time
  RETURN QUERY
  SELECT
    al.user_email,
    'Multiple IP addresses' as suspicious_reason,
    COUNT(DISTINCT al.ip_address) as event_count,
    jsonb_agg(DISTINCT jsonb_build_object(
      'ip_address', al.ip_address::TEXT,
      'first_seen', MIN(al.timestamp)
    )) as recent_events
  FROM public.audit_logs al
  WHERE al.timestamp > NOW() - (p_lookback_minutes || ' minutes')::INTERVAL
  GROUP BY al.user_email
  HAVING COUNT(DISTINCT al.ip_address) > 3;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Create function to cleanup old audit logs
-- =====================================================
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs(
  p_retention_days INTEGER DEFAULT 2555 -- 7 years for HIPAA compliance
)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- HIPAA requires 6 years retention, we use 7 years (2555 days) to be safe
  DELETE FROM public.audit_logs
  WHERE timestamp < NOW() - (p_retention_days || ' days')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Grant permissions
-- =====================================================
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit_event TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_audit_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION public.detect_suspicious_activity TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_audit_logs TO authenticated;

-- =====================================================
-- Add helpful comments
-- =====================================================
COMMENT ON TABLE public.audit_logs IS 'Comprehensive audit trail for all system activities and PHI access - HIPAA compliant';
COMMENT ON COLUMN public.audit_logs.contains_phi IS 'True if this action involved access to Protected Health Information';
COMMENT ON COLUMN public.audit_logs.phi_fields IS 'Array of specific PHI field names that were accessed';
COMMENT ON COLUMN public.audit_logs.metadata IS 'Flexible JSONB field for additional context (query params, changed fields, etc)';
COMMENT ON COLUMN public.audit_logs.response_time_ms IS 'Response time in milliseconds for performance monitoring';
COMMENT ON FUNCTION public.log_audit_event IS 'Centralized function to log audit events with full context';
COMMENT ON FUNCTION public.get_audit_statistics IS 'Returns aggregate statistics for audit logs over a time period';
COMMENT ON FUNCTION public.detect_suspicious_activity IS 'Detects potentially suspicious activity patterns (failed attempts, excessive access, IP changes)';
COMMENT ON FUNCTION public.cleanup_old_audit_logs IS 'Removes audit logs older than retention period (default 7 years for HIPAA)';
