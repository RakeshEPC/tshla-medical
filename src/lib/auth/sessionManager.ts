import crypto from 'crypto';
import { env } from '../config/environment';
import { logAudit, AuditAction } from '@/lib/audit/auditTrail';

/**
 * Server-side Session Manager with Idle and Absolute Timeouts
 * HIPAA-compliant session management
 */

export interface Session {
  id: string;
  email: string;
  name: string;
  createdAt: number;
  lastActivity: number;
  absoluteExpiry: number;
  idleExpiry: number;
  ip: string;
  userAgent?: string;
  active: boolean;
  warningShown?: boolean;
}

export interface SessionConfig {
  idleTimeout: number; // Default: 30 minutes
  absoluteTimeout: number; // Default: 12 hours
  warningBefore: number; // Default: 2 minutes before idle timeout
}

class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private config: SessionConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<SessionConfig>) {
    this.config = {
      idleTimeout: config?.idleTimeout || 30 * 60 * 1000, // 30 minutes
      absoluteTimeout: config?.absoluteTimeout || 12 * 60 * 60 * 1000, // 12 hours
      warningBefore: config?.warningBefore || 2 * 60 * 1000, // 2 minutes
    };

    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Create a new session
   */
  public createSession(email: string, name: string, ip: string, userAgent?: string): string {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const now = Date.now();

    const session: Session = {
      id: sessionId,
      email,
      name,
      createdAt: now,
      lastActivity: now,
      absoluteExpiry: now + this.config.absoluteTimeout,
      idleExpiry: now + this.config.idleTimeout,
      ip,
      userAgent,
      active: true,
      warningShown: false,
    };

    this.sessions.set(sessionId, session);

    logDebug('App', 'Debug message', {});

    return sessionId;
  }

  /**
   * Validate a session and update activity
   */
  public validateSession(sessionId: string | undefined): {
    valid: boolean;
    session?: Session;
    reason?: string;
    shouldWarn?: boolean;
  } {
    if (!sessionId) {
      return { valid: false, reason: 'No session ID provided' };
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      return { valid: false, reason: 'Session not found' };
    }

    const now = Date.now();

    // Check if session is marked as inactive
    if (!session.active) {
      return { valid: false, reason: 'Session inactive' };
    }

    // Check absolute timeout (cannot be extended)
    if (now > session.absoluteExpiry) {
      this.expireSession(sessionId, 'absolute_timeout');
      return { valid: false, reason: 'Session absolute timeout' };
    }

    // Check idle timeout
    if (now > session.idleExpiry) {
      this.expireSession(sessionId, 'idle_timeout');
      return { valid: false, reason: 'Session idle timeout' };
    }

    // Check if we should warn about upcoming idle timeout
    const timeUntilIdle = session.idleExpiry - now;
    const shouldWarn = timeUntilIdle <= this.config.warningBefore && !session.warningShown;

    // Update activity and extend idle timeout
    session.lastActivity = now;
    session.idleExpiry = now + this.config.idleTimeout;

    if (shouldWarn) {
      session.warningShown = true;
    }

    return {
      valid: true,
      session,
      shouldWarn,
    };
  }

  /**
   * Touch session (update last activity)
   */
  public touchSession(sessionId: string): boolean {
    const result = this.validateSession(sessionId);
    return result.valid;
  }

  /**
   * Get session info (for status checks)
   */
  public getSessionInfo(sessionId: string): {
    active: boolean;
    timeUntilIdle?: number;
    timeUntilAbsolute?: number;
    idleWarning?: boolean;
  } | null {
    const session = this.sessions.get(sessionId);
    if (!session || !session.active) {
      return null;
    }

    const now = Date.now();
    const timeUntilIdle = Math.max(0, session.idleExpiry - now);
    const timeUntilAbsolute = Math.max(0, session.absoluteExpiry - now);

    return {
      active: true,
      timeUntilIdle,
      timeUntilAbsolute,
      idleWarning: timeUntilIdle <= this.config.warningBefore,
    };
  }

  /**
   * Extend session (reset idle timeout only)
   */
  public extendSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.active) {
      return false;
    }

    const now = Date.now();

    // Cannot extend past absolute timeout
    if (now > session.absoluteExpiry) {
      return false;
    }

    session.lastActivity = now;
    session.idleExpiry = now + this.config.idleTimeout;
    session.warningShown = false; // Reset warning flag

    return true;
  }

  /**
   * Expire a session
   */
  private expireSession(sessionId: string, reason: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.active = false;

    // Log the expiration
    logAudit(session.email, 'self', AuditAction.SESSION_EXPIRED, { ip: session.ip } as any, true, {
      reason,
      sessionId,
    }).catch(console.error);

    // Remove from active sessions
    this.sessions.delete(sessionId);

    logDebug('App', 'Debug message', {});
  }

  /**
   * Manually destroy a session (logout)
   */
  public destroySession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.active = false;
    this.sessions.delete(sessionId);

    logDebug('App', 'Debug message', {});
    return true;
  }

  /**
   * Clean up expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now > session.absoluteExpiry || now > session.idleExpiry || !session.active) {
        const reason =
          now > session.absoluteExpiry
            ? 'absolute_timeout'
            : now > session.idleExpiry
              ? 'idle_timeout'
              : 'inactive';

        if (session.active) {
          this.expireSession(sessionId, reason);
        } else {
          this.sessions.delete(sessionId);
        }
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logDebug('App', 'Debug message', {});
    }
  }

  /**
   * Start cleanup interval
   */
  private startCleanupInterval(): void {
    // Clean up every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60 * 1000);
  }

  /**
   * Stop cleanup interval (for shutdown)
   */
  public stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get all active sessions (for monitoring)
   */
  public getActiveSessions(): {
    total: number;
    sessions: Array<{
      email: string;
      createdAt: string;
      lastActivity: string;
      ip: string;
    }>;
  } {
    const activeSessions = Array.from(this.sessions.values())
      .filter(s => s.active)
      .map(s => ({
        email: s.email,
        createdAt: new Date(s.createdAt).toISOString(),
        lastActivity: new Date(s.lastActivity).toISOString(),
        ip: s.ip,
      }));

    return {
      total: activeSessions.length,
      sessions: activeSessions,
    };
  }

  /**
   * Check if user has existing session
   */
  public getUserSession(email: string): Session | null {
    for (const session of this.sessions.values()) {
      if (session.email === email && session.active) {
        const validation = this.validateSession(session.id);
        if (validation.valid) {
          return session;
        }
      }
    }
    return null;
  }

  /**
   * Force logout all sessions for a user
   */
  public forceLogoutUser(email: string): number {
    let count = 0;
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.email === email) {
        this.destroySession(sessionId);
        count++;
      }
    }
    return count;
  }
}

// Create singleton instance with configuration from environment
const sessionManager = new SessionManager({
  idleTimeout: parseInt(env.SESSION_IDLE_TIMEOUT || '1800000'), // 30 min default
  absoluteTimeout: parseInt(env.SESSION_ABSOLUTE_TIMEOUT || '43200000'), // 12 hours default
  warningBefore: parseInt(env.SESSION_WARNING_BEFORE || '120000'), // 2 min default
});

export default sessionManager;
