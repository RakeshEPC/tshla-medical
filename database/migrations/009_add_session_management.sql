-- =====================================================
-- HIPAA Phase 6: Session Management Hardening
-- =====================================================
-- Created: 2026-01-08
-- Purpose: Track active user sessions with device fingerprinting
-- HIPAA: §164.312(a)(2)(iii) - Automatic Logoff
--        §164.312(b) - Audit Controls

-- =====================================================
-- Create user_sessions table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,

  -- Device identification
  device_fingerprint TEXT NOT NULL,
  device_type TEXT, -- 'mobile', 'tablet', 'desktop'
  browser_name TEXT,
  os_name TEXT,
  device_description TEXT,

  -- Location tracking
  ip_address INET,
  user_agent TEXT,
  timezone TEXT,

  -- Session metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,

  -- Session status
  is_active BOOLEAN NOT NULL DEFAULT true,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,

  -- Audit trail
  login_method TEXT, -- 'password', 'mfa', 'sso'
  login_location TEXT -- Derived from IP (city, country)
);

-- =====================================================
-- Create indexes for performance
-- =====================================================
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_session_token ON public.user_sessions(session_token);
CREATE INDEX idx_user_sessions_device_fingerprint ON public.user_sessions(device_fingerprint);
CREATE INDEX idx_user_sessions_is_active ON public.user_sessions(is_active);
CREATE INDEX idx_user_sessions_created_at ON public.user_sessions(created_at);
CREATE INDEX idx_user_sessions_last_activity_at ON public.user_sessions(last_activity_at);
CREATE INDEX idx_user_sessions_expires_at ON public.user_sessions(expires_at);

-- =====================================================
-- Enable Row Level Security (RLS)
-- =====================================================
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own sessions
CREATE POLICY "Users can view own sessions"
  ON public.user_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can revoke their own sessions
CREATE POLICY "Users can revoke own sessions"
  ON public.user_sessions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: System can insert sessions (authenticated users)
CREATE POLICY "System can insert sessions"
  ON public.user_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: System can delete expired sessions
CREATE POLICY "System can delete expired sessions"
  ON public.user_sessions
  FOR DELETE
  USING (
    expires_at < NOW() OR
    (is_active = false AND revoked_at < NOW() - INTERVAL '30 days')
  );

-- =====================================================
-- Create function to clean up expired sessions
-- =====================================================
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete sessions that have expired more than 30 days ago
  DELETE FROM public.user_sessions
  WHERE expires_at < NOW() - INTERVAL '30 days'
     OR (is_active = false AND revoked_at < NOW() - INTERVAL '30 days');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Create function to revoke old sessions for a user
-- =====================================================
CREATE OR REPLACE FUNCTION public.revoke_old_sessions(
  p_user_id UUID,
  p_max_sessions INTEGER DEFAULT 3
)
RETURNS INTEGER AS $$
DECLARE
  revoked_count INTEGER;
BEGIN
  -- Keep only the N most recent active sessions per user
  WITH sessions_to_keep AS (
    SELECT id
    FROM public.user_sessions
    WHERE user_id = p_user_id
      AND is_active = true
    ORDER BY last_activity_at DESC
    LIMIT p_max_sessions
  )
  UPDATE public.user_sessions
  SET
    is_active = false,
    revoked_at = NOW(),
    revoked_reason = 'Exceeded maximum concurrent sessions'
  WHERE user_id = p_user_id
    AND is_active = true
    AND id NOT IN (SELECT id FROM sessions_to_keep);

  GET DIAGNOSTICS revoked_count = ROW_COUNT;

  RETURN revoked_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Create function to update session activity
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_session_activity(
  p_session_token TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.user_sessions
  SET last_activity_at = NOW()
  WHERE session_token = p_session_token
    AND is_active = true
    AND expires_at > NOW();

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Grant permissions
-- =====================================================
GRANT SELECT, INSERT, UPDATE ON public.user_sessions TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_sessions TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_old_sessions TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_session_activity TO authenticated;

-- =====================================================
-- Add helpful comments
-- =====================================================
COMMENT ON TABLE public.user_sessions IS 'Tracks active user sessions with device fingerprinting for HIPAA compliance';
COMMENT ON COLUMN public.user_sessions.device_fingerprint IS 'Unique device identifier generated by FingerprintJS';
COMMENT ON COLUMN public.user_sessions.session_token IS 'Unique session identifier (from Supabase auth)';
COMMENT ON COLUMN public.user_sessions.last_activity_at IS 'Last time this session had any activity';
COMMENT ON COLUMN public.user_sessions.expires_at IS 'When this session expires (typically 2 hours from creation)';
COMMENT ON FUNCTION public.cleanup_expired_sessions IS 'Removes expired sessions older than 30 days';
COMMENT ON FUNCTION public.revoke_old_sessions IS 'Limits concurrent sessions per user to N most recent';
COMMENT ON FUNCTION public.update_session_activity IS 'Updates last_activity_at timestamp for a session';
