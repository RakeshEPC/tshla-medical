-- =====================================================
-- HIPAA Phase 7: Enhanced Audit Logging (Migration)
-- =====================================================
-- Created: 2026-01-08
-- Purpose: Comprehensive audit trail for all PHI access and system events
-- HIPAA: §164.308(a)(1)(ii)(D) - Information System Activity Review
--        §164.312(b) - Audit Controls

-- Step 1: Rename the old table as backup (just in case)
ALTER TABLE IF EXISTS public.audit_logs RENAME TO audit_logs_backup_old;

-- Step 2: Create new audit_logs table with full schema
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID,
  user_email TEXT NOT NULL,
  user_role TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  ip_address INET,
  user_agent TEXT,
  request_path TEXT,
  request_method TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  status_code INTEGER,
  metadata JSONB,
  contains_phi BOOLEAN NOT NULL DEFAULT false,
  phi_fields TEXT[],
  response_time_ms INTEGER,
  session_id UUID,
  device_fingerprint TEXT
);

-- Step 3: Migrate existing data from old table to new table
INSERT INTO public.audit_logs (
  id,
  timestamp,
  user_id,
  user_email,
  user_role,
  action,
  resource_type,
  resource_id,
  ip_address,
  user_agent,
  metadata,
  contains_phi,
  success
)
SELECT
  id,
  created_at,
  user_id,
  COALESCE(user_type, 'unknown'),  -- Map user_type to user_email temporarily
  user_type,  -- Map user_type to user_role
  action,
  resource_type,
  resource_id::TEXT,
  ip_address,
  user_agent,
  details,  -- Map details to metadata
  COALESCE(phi_accessed, false),
  true  -- Assume old logs were successful
FROM public.audit_logs_backup_old;

-- Step 4: Drop the backup table (optional - comment this out if you want to keep it)
-- DROP TABLE IF EXISTS public.audit_logs_backup_old;

-- Step 5: Create indexes
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
CREATE INDEX idx_audit_logs_metadata ON public.audit_logs USING GIN(metadata);

-- Step 6: Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Step 7: Create policies
CREATE POLICY "Admins can view all audit logs"
  ON public.audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.medical_staff
      WHERE medical_staff.auth_user_id = auth.uid()
        AND medical_staff.role IN ('admin', 'super_admin')
        AND medical_staff.is_active = true
    )
  );

CREATE POLICY "Users can view own audit logs"
  ON public.audit_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Step 8: Create log_audit_event function
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
    user_id, user_email, user_role, action, resource_type, resource_id,
    ip_address, user_agent, request_path, request_method, success,
    error_message, status_code, metadata, contains_phi, phi_fields,
    response_time_ms, session_id, device_fingerprint
  ) VALUES (
    p_user_id, p_user_email, p_user_role, p_action, p_resource_type, p_resource_id,
    p_ip_address, p_user_agent, p_request_path, p_request_method, p_success,
    p_error_message, p_status_code, p_metadata, p_contains_phi, p_phi_fields,
    p_response_time_ms, p_session_id, p_device_fingerprint
  ) RETURNING id INTO audit_id;

  RETURN audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 9: Create get_audit_statistics function
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
DECLARE
  v_total_events BIGINT;
  v_total_users BIGINT;
  v_total_phi_access BIGINT;
  v_total_failures BIGINT;
  v_actions_by_type JSONB;
  v_resources_by_type JSONB;
  v_top_users JSONB;
BEGIN
  SELECT
    COUNT(*)::BIGINT,
    COUNT(DISTINCT al.user_id)::BIGINT,
    COUNT(*) FILTER (WHERE al.contains_phi = true)::BIGINT,
    COUNT(*) FILTER (WHERE al.success = false)::BIGINT
  INTO v_total_events, v_total_users, v_total_phi_access, v_total_failures
  FROM public.audit_logs al
  WHERE al.timestamp BETWEEN p_start_date AND p_end_date;

  SELECT COALESCE(jsonb_object_agg(action, count), '{}'::jsonb)
  INTO v_actions_by_type
  FROM (
    SELECT al.action, COUNT(*)::INTEGER as count
    FROM public.audit_logs al
    WHERE al.timestamp BETWEEN p_start_date AND p_end_date
    GROUP BY al.action
  ) action_counts;

  SELECT COALESCE(jsonb_object_agg(resource_type, count), '{}'::jsonb)
  INTO v_resources_by_type
  FROM (
    SELECT al.resource_type, COUNT(*)::INTEGER as count
    FROM public.audit_logs al
    WHERE al.timestamp BETWEEN p_start_date AND p_end_date
    GROUP BY al.resource_type
  ) resource_counts;

  SELECT COALESCE(jsonb_agg(user_data), '[]'::jsonb)
  INTO v_top_users
  FROM (
    SELECT jsonb_build_object('email', al.user_email, 'count', COUNT(*)) as user_data
    FROM public.audit_logs al
    WHERE al.timestamp BETWEEN p_start_date AND p_end_date
    GROUP BY al.user_email
    ORDER BY COUNT(*) DESC
    LIMIT 10
  ) top_users_sub;

  RETURN QUERY SELECT
    v_total_events,
    v_total_users,
    v_total_phi_access,
    v_total_failures,
    v_actions_by_type,
    v_resources_by_type,
    v_top_users;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 10: Create detect_suspicious_activity function
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
  RETURN QUERY
  SELECT
    al.user_email,
    'Excessive failed attempts'::TEXT,
    COUNT(*)::BIGINT,
    jsonb_agg(
      jsonb_build_object(
        'timestamp', al.timestamp,
        'action', al.action,
        'resource_type', al.resource_type,
        'error_message', al.error_message
      )
      ORDER BY al.timestamp DESC
    )
  FROM public.audit_logs al
  WHERE al.timestamp > NOW() - (p_lookback_minutes || ' minutes')::INTERVAL
    AND al.success = false
  GROUP BY al.user_email
  HAVING COUNT(*) > 10;

  RETURN QUERY
  SELECT
    al.user_email,
    'Excessive PHI access'::TEXT,
    COUNT(*)::BIGINT,
    jsonb_agg(
      jsonb_build_object(
        'timestamp', al.timestamp,
        'action', al.action,
        'resource_type', al.resource_type,
        'resource_id', al.resource_id
      )
      ORDER BY al.timestamp DESC
    )
  FROM public.audit_logs al
  WHERE al.timestamp > NOW() - (p_lookback_minutes || ' minutes')::INTERVAL
    AND al.contains_phi = true
    AND al.resource_type IN ('patient', 'medical_record', 'pump_report')
  GROUP BY al.user_email
  HAVING COUNT(*) > 50;

  RETURN QUERY
  SELECT
    al.user_email,
    'Multiple IP addresses'::TEXT,
    COUNT(DISTINCT al.ip_address)::BIGINT,
    jsonb_agg(DISTINCT jsonb_build_object(
      'ip_address', al.ip_address::TEXT,
      'user_email', al.user_email
    ))
  FROM public.audit_logs al
  WHERE al.timestamp > NOW() - (p_lookback_minutes || ' minutes')::INTERVAL
    AND al.ip_address IS NOT NULL
  GROUP BY al.user_email
  HAVING COUNT(DISTINCT al.ip_address) > 3;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 11: Create cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs(
  p_retention_days INTEGER DEFAULT 2555
)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.audit_logs
  WHERE timestamp < NOW() - (p_retention_days || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 12: Grant permissions
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit_event TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_audit_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION public.detect_suspicious_activity TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_audit_logs TO authenticated;

-- Step 13: Add comments
COMMENT ON TABLE public.audit_logs IS 'HIPAA-compliant audit trail for all system activities and PHI access';
COMMENT ON FUNCTION public.log_audit_event IS 'Centralized function to log audit events';
COMMENT ON FUNCTION public.get_audit_statistics IS 'Returns aggregate statistics for audit logs';
COMMENT ON FUNCTION public.detect_suspicious_activity IS 'Detects suspicious activity patterns';
COMMENT ON FUNCTION public.cleanup_old_audit_logs IS 'Removes audit logs older than retention period (7 years for HIPAA)';
