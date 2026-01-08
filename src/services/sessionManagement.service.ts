/**
 * Session Management Service
 *
 * Manages user sessions with device tracking, concurrent session limits,
 * and automatic cleanup.
 *
 * Part of HIPAA Phase 6: Session Management Hardening
 * HIPAA Compliance: §164.312(a)(2)(iii) - Automatic Logoff
 *                   §164.312(b) - Audit Controls
 */

import { supabase } from '../lib/supabase';
import { deviceFingerprintService } from './deviceFingerprint.service';
import { logInfo, logError, logWarn, logSecurity } from './logger.service';

/**
 * User Session
 */
export interface UserSession {
  id: string;
  user_id: string;
  session_token: string;
  device_fingerprint: string;
  device_type?: string;
  browser_name?: string;
  os_name?: string;
  device_description?: string;
  ip_address?: string;
  user_agent?: string;
  timezone?: string;
  created_at: string;
  last_activity_at: string;
  expires_at: string;
  is_active: boolean;
  revoked_at?: string;
  revoked_reason?: string;
  login_method?: string;
  login_location?: string;
}

/**
 * Maximum concurrent sessions per user
 */
const MAX_CONCURRENT_SESSIONS = 3;

/**
 * Session timeout in minutes
 */
const SESSION_TIMEOUT_MINUTES = 120; // 2 hours

/**
 * Activity check interval in minutes
 */
const ACTIVITY_CHECK_INTERVAL = 5; // 5 minutes

/**
 * Session Management Service
 */
export const sessionManagementService = {
  /**
   * Create a new session when user logs in
   *
   * @param userId - User ID from Supabase auth
   * @param loginMethod - How user logged in ('password', 'mfa', 'sso')
   * @returns Promise<UserSession | null>
   */
  async createSession(
    userId: string,
    loginMethod: 'password' | 'mfa' | 'sso' = 'password'
  ): Promise<UserSession | null> {
    try {
      // Get device information
      const deviceInfo = await deviceFingerprintService.getDeviceInfo();
      const ipAddress = await deviceFingerprintService.getIPAddress();
      const deviceDescription = await deviceFingerprintService.getDeviceDescription();
      const deviceType = deviceFingerprintService.getDeviceType();
      const browserName = deviceFingerprintService.getBrowserName();
      const osName = deviceFingerprintService.getOSName();

      // Get current Supabase session token
      const { data: { session } } = await supabase.auth.getSession();
      const sessionToken = session?.access_token || '';

      // Calculate expiration time
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + SESSION_TIMEOUT_MINUTES);

      // Insert session record
      const { data, error } = await supabase
        .from('user_sessions')
        .insert({
          user_id: userId,
          session_token: sessionToken,
          device_fingerprint: deviceInfo.fingerprint,
          device_type: deviceType,
          browser_name: browserName,
          os_name: osName,
          device_description: deviceDescription,
          ip_address: ipAddress,
          user_agent: deviceInfo.userAgent,
          timezone: deviceInfo.timezone,
          expires_at: expiresAt.toISOString(),
          login_method: loginMethod,
          is_active: true
        })
        .select()
        .single();

      if (error) {
        logError('SessionManagement', 'Failed to create session', { error, userId });
        return null;
      }

      logSecurity('session_created', 'SessionManagement', {
        userId,
        sessionId: data.id,
        deviceType,
        browserName,
        osName,
        ipAddress
      });

      // Enforce concurrent session limit
      await this.enforceConcurrentSessionLimit(userId);

      return data;
    } catch (error) {
      logError('SessionManagement', 'Exception creating session', { error, userId });
      return null;
    }
  },

  /**
   * Update session activity timestamp
   * Call this periodically to keep session alive
   *
   * @param sessionToken - Current session token
   * @returns Promise<boolean> - Success status
   */
  async updateActivity(sessionToken: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .rpc('update_session_activity', {
          p_session_token: sessionToken
        });

      if (error) {
        logError('SessionManagement', 'Failed to update activity', { error });
        return false;
      }

      return data === true;
    } catch (error) {
      logError('SessionManagement', 'Exception updating activity', { error });
      return false;
    }
  },

  /**
   * Get all active sessions for current user
   *
   * @returns Promise<UserSession[]>
   */
  async getActiveSessions(): Promise<UserSession[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return [];
      }

      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .order('last_activity_at', { ascending: false });

      if (error) {
        logError('SessionManagement', 'Failed to get active sessions', { error });
        return [];
      }

      return data || [];
    } catch (error) {
      logError('SessionManagement', 'Exception getting active sessions', { error });
      return [];
    }
  },

  /**
   * Revoke a specific session
   *
   * @param sessionId - Session ID to revoke
   * @param reason - Reason for revocation
   * @returns Promise<boolean> - Success status
   */
  async revokeSession(sessionId: string, reason: string = 'User initiated'): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_sessions')
        .update({
          is_active: false,
          revoked_at: new Date().toISOString(),
          revoked_reason: reason
        })
        .eq('id', sessionId);

      if (error) {
        logError('SessionManagement', 'Failed to revoke session', { error, sessionId });
        return false;
      }

      logSecurity('session_revoked', 'SessionManagement', {
        sessionId,
        reason
      });

      return true;
    } catch (error) {
      logError('SessionManagement', 'Exception revoking session', { error, sessionId });
      return false;
    }
  },

  /**
   * Revoke all sessions except current one
   *
   * @returns Promise<number> - Number of sessions revoked
   */
  async revokeOtherSessions(): Promise<number> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: { session } } = await supabase.auth.getSession();

      if (!user || !session) {
        return 0;
      }

      const currentSessionToken = session.access_token;

      const { data, error } = await supabase
        .from('user_sessions')
        .update({
          is_active: false,
          revoked_at: new Date().toISOString(),
          revoked_reason: 'User revoked all other sessions'
        })
        .eq('user_id', user.id)
        .eq('is_active', true)
        .neq('session_token', currentSessionToken)
        .select();

      if (error) {
        logError('SessionManagement', 'Failed to revoke other sessions', { error });
        return 0;
      }

      const revokedCount = data?.length || 0;

      if (revokedCount > 0) {
        logSecurity('other_sessions_revoked', 'SessionManagement', {
          userId: user.id,
          revokedCount
        });
      }

      return revokedCount;
    } catch (error) {
      logError('SessionManagement', 'Exception revoking other sessions', { error });
      return 0;
    }
  },

  /**
   * Enforce concurrent session limit
   * Keeps only the N most recent sessions
   *
   * @param userId - User ID
   * @returns Promise<number> - Number of sessions revoked
   */
  async enforceConcurrentSessionLimit(userId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .rpc('revoke_old_sessions', {
          p_user_id: userId,
          p_max_sessions: MAX_CONCURRENT_SESSIONS
        });

      if (error) {
        logError('SessionManagement', 'Failed to enforce session limit', { error, userId });
        return 0;
      }

      const revokedCount = data || 0;

      if (revokedCount > 0) {
        logWarn('SessionManagement', `Revoked ${revokedCount} old sessions for user`, {
          userId,
          maxSessions: MAX_CONCURRENT_SESSIONS
        });
      }

      return revokedCount;
    } catch (error) {
      logError('SessionManagement', 'Exception enforcing session limit', { error, userId });
      return 0;
    }
  },

  /**
   * Clean up expired sessions (older than 30 days)
   *
   * @returns Promise<number> - Number of sessions cleaned up
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const { data, error } = await supabase
        .rpc('cleanup_expired_sessions');

      if (error) {
        logError('SessionManagement', 'Failed to cleanup expired sessions', { error });
        return 0;
      }

      const cleanedCount = data || 0;

      if (cleanedCount > 0) {
        logInfo('SessionManagement', `Cleaned up ${cleanedCount} expired sessions`);
      }

      return cleanedCount;
    } catch (error) {
      logError('SessionManagement', 'Exception cleaning up expired sessions', { error });
      return 0;
    }
  },

  /**
   * Check if current session is valid
   *
   * @returns Promise<boolean>
   */
  async isSessionValid(): Promise<boolean> {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        return false;
      }

      const { data, error } = await supabase
        .from('user_sessions')
        .select('id, is_active, expires_at')
        .eq('session_token', session.access_token)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        return false;
      }

      // Check if expired
      const expiresAt = new Date(data.expires_at);
      const now = new Date();

      return expiresAt > now;
    } catch (error) {
      logError('SessionManagement', 'Exception checking session validity', { error });
      return false;
    }
  },

  /**
   * Get current session info
   *
   * @returns Promise<UserSession | null>
   */
  async getCurrentSession(): Promise<UserSession | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        return null;
      }

      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('session_token', session.access_token)
        .eq('is_active', true)
        .single();

      if (error) {
        logError('SessionManagement', 'Failed to get current session', { error });
        return null;
      }

      return data;
    } catch (error) {
      logError('SessionManagement', 'Exception getting current session', { error });
      return null;
    }
  },

  /**
   * Start activity tracking
   * Updates session activity every 5 minutes
   *
   * @returns () => void - Cleanup function to stop tracking
   */
  startActivityTracking(): () => void {
    let intervalId: NodeJS.Timeout;

    const updateActivity = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        await this.updateActivity(session.access_token);
      }
    };

    // Update immediately
    updateActivity();

    // Then every 5 minutes
    intervalId = setInterval(updateActivity, ACTIVITY_CHECK_INTERVAL * 60 * 1000);

    // Return cleanup function
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }
};
