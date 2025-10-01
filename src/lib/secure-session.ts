/**
 * HIPAA-Compliant Session Management
 * Implements automatic logout and session security
 * Required by HIPAA Security Rule 45 CFR §164.312(a)(2)(iii)
 */

import { auditLogger, AuditEventType } from './audit-logger';

export interface SecureSession {
  sessionId: string;
  userId: string;
  userRole: string;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
}

class SecureSessionManager {
  private readonly INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes (HIPAA requirement)
  private readonly MAX_SESSION_DURATION = 12 * 60 * 60 * 1000; // 12 hours absolute max
  private readonly WARNING_THRESHOLD = 2 * 60 * 1000; // Warn 2 minutes before timeout

  private sessions: Map<string, SecureSession> = new Map();
  private activityTimers: Map<string, NodeJS.Timeout> = new Map();
  private warningCallbacks: Map<string, () => void> = new Map();

  constructor() {
    // Check for expired sessions every minute
    if (typeof window !== 'undefined') {
      setInterval(() => this.cleanupExpiredSessions(), 60000);

      // Monitor user activity
      this.setupActivityMonitoring();
    }
  }

  /**
   * Create a new secure session
   */
  public createSession(userId: string, userRole: string): string {
    const sessionId = this.generateSecureSessionId();
    const now = new Date();

    const session: SecureSession = {
      sessionId,
      userId,
      userRole,
      createdAt: now,
      lastActivity: now,
      expiresAt: new Date(now.getTime() + this.MAX_SESSION_DURATION),
      ipAddress: this.getClientIP(),
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'server',
      isActive: true,
    };

    this.sessions.set(sessionId, session);
    this.startInactivityTimer(sessionId);

    // Log session creation
    auditLogger.logEvent(AuditEventType.LOGIN_SUCCESS, userId, 'Session created', {
      userRole,
      success: true,
    });

    return sessionId;
  }

  /**
   * Validate and get session
   */
  public getSession(sessionId: string): SecureSession | null {
    const session = this.sessions.get(sessionId);

    if (!session || !session.isActive) {
      return null;
    }

    const now = new Date();

    // Check if session expired
    if (now > session.expiresAt) {
      this.terminateSession(sessionId, 'SESSION_EXPIRED');
      return null;
    }

    // Check inactivity timeout
    const inactivityDuration = now.getTime() - session.lastActivity.getTime();
    if (inactivityDuration > this.INACTIVITY_TIMEOUT) {
      this.terminateSession(sessionId, 'INACTIVITY_TIMEOUT');
      return null;
    }

    return session;
  }

  /**
   * Update session activity
   */
  public updateActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session && session.isActive) {
      session.lastActivity = new Date();
      this.resetInactivityTimer(sessionId);
    }
  }

  /**
   * Terminate session
   */
  public terminateSession(sessionId: string, reason: string = 'USER_LOGOUT'): void {
    const session = this.sessions.get(sessionId);

    if (session) {
      session.isActive = false;

      // Clear timers
      const timer = this.activityTimers.get(sessionId);
      if (timer) {
        clearTimeout(timer);
        this.activityTimers.delete(sessionId);
      }

      // Log session termination
      auditLogger.logEvent(
        reason === 'INACTIVITY_TIMEOUT' ? AuditEventType.SESSION_TIMEOUT : AuditEventType.LOGOUT,
        session.userId,
        `Session terminated: ${reason}`,
        { userRole: session.userRole, success: true }
      );

      // Remove session
      this.sessions.delete(sessionId);

      // Clear any stored data
      this.clearSessionData(sessionId);
    }
  }

  /**
   * Start inactivity timer for a session
   */
  private startInactivityTimer(sessionId: string): void {
    this.resetInactivityTimer(sessionId);
  }

  /**
   * Reset inactivity timer
   */
  private resetInactivityTimer(sessionId: string): void {
    // Clear existing timer
    const existingTimer = this.activityTimers.get(sessionId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set warning timer (2 minutes before timeout)
    const warningTimer = setTimeout(() => {
      this.showInactivityWarning(sessionId);
    }, this.INACTIVITY_TIMEOUT - this.WARNING_THRESHOLD);

    // Set final timeout timer
    const timer = setTimeout(() => {
      this.terminateSession(sessionId, 'INACTIVITY_TIMEOUT');

      // Redirect to login if in browser
      if (typeof window !== 'undefined') {
        window.location.href = '/simple-login?reason=timeout';
      }
    }, this.INACTIVITY_TIMEOUT);

    this.activityTimers.set(sessionId, timer);
  }

  /**
   * Show inactivity warning
   */
  private showInactivityWarning(sessionId: string): void {
    const callback = this.warningCallbacks.get(sessionId);
    if (callback) {
      callback();
    } else if (typeof window !== 'undefined') {
      // Default warning
      const remaining = Math.floor(this.WARNING_THRESHOLD / 60000);
      if (
        confirm(
          `Your session will expire in ${remaining} minutes due to inactivity. Click OK to continue working.`
        )
      ) {
        this.updateActivity(sessionId);
      }
    }
  }

  /**
   * Register warning callback
   */
  public onInactivityWarning(sessionId: string, callback: () => void): void {
    this.warningCallbacks.set(sessionId, callback);
  }

  /**
   * Setup activity monitoring in browser
   */
  private setupActivityMonitoring(): void {
    if (typeof window === 'undefined') return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    events.forEach(event => {
      document.addEventListener(
        event,
        () => {
          // Update activity for all active sessions
          this.sessions.forEach((session, sessionId) => {
            if (session.isActive) {
              this.updateActivity(sessionId);
            }
          });
        },
        { passive: true }
      );
    });
  }

  /**
   * Generate cryptographically secure session ID
   */
  private generateSecureSessionId(): string {
    if (typeof window !== 'undefined' && window.crypto) {
      const array = new Uint8Array(32);
      window.crypto.getRandomValues(array);
      return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    // Fallback for server/older browsers
    return `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  /**
   * Get client IP (would come from server in production)
   */
  private getClientIP(): string {
    // In production, this would come from the server
    // Browser cannot reliably get real IP
    return 'client_ip_masked';
  }

  /**
   * Clear session data
   */
  private clearSessionData(sessionId: string): void {
    // Clear any session-specific data from memory
    // In production, also clear from secure session store

    if (typeof window !== 'undefined') {
      // Clear any session cookies
      document.cookie = `sessionId=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; secure; samesite=strict`;

      // Clear session storage (not localStorage for PHI!)
      sessionStorage.clear();
    }
  }

  /**
   * Clean up expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = new Date();

    this.sessions.forEach((session, sessionId) => {
      if (!session.isActive || now > session.expiresAt) {
        this.terminateSession(sessionId, 'SESSION_EXPIRED');
      }
    });
  }

  /**
   * Validate session has required permissions
   */
  public validatePermissions(
    sessionId: string,
    requiredRole: string | string[],
    resource?: string
  ): boolean {
    const session = this.getSession(sessionId);

    if (!session) {
      return false;
    }

    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    const hasPermission = roles.includes(session.userRole);

    // Log authorization attempt
    auditLogger.logEvent(
      AuditEventType.SYSTEM_ACCESS,
      session.userId,
      `Authorization check for ${resource || 'resource'}`,
      {
        userRole: session.userRole,
        requiredRole: roles.join(','),
        success: hasPermission,
        additionalInfo: { resource },
      }
    );

    return hasPermission;
  }

  /**
   * Get all active sessions (admin only)
   */
  public getActiveSessions(requestingSessionId: string): SecureSession[] {
    // Validate admin permissions
    if (!this.validatePermissions(requestingSessionId, 'admin', 'active_sessions')) {
      return [];
    }

    return Array.from(this.sessions.values()).filter(s => s.isActive);
  }

  /**
   * Force logout a user (admin only)
   */
  public forceLogout(targetUserId: string, requestingSessionId: string): boolean {
    // Validate admin permissions
    if (!this.validatePermissions(requestingSessionId, 'admin', 'force_logout')) {
      return false;
    }

    let terminated = false;
    this.sessions.forEach((session, sessionId) => {
      if (session.userId === targetUserId && session.isActive) {
        this.terminateSession(sessionId, 'ADMIN_FORCE_LOGOUT');
        terminated = true;
      }
    });

    return terminated;
  }
}

// Singleton instance
export const sessionManager = new SecureSessionManager();

// Session hook for React components
export function useSecureSession() {
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [isActive, setIsActive] = React.useState(false);
  const [timeRemaining, setTimeRemaining] = React.useState<number | null>(null);

  React.useEffect(() => {
    // Get session from secure cookie
    const cookieSession = document.cookie
      .split('; ')
      .find(row => row.startsWith('sessionId='))
      ?.split('=')[1];

    if (cookieSession) {
      const session = sessionManager.getSession(cookieSession);
      if (session) {
        setSessionId(cookieSession);
        setIsActive(true);

        // Setup warning callback
        sessionManager.onInactivityWarning(cookieSession, () => {
          if (confirm('Your session will expire in 2 minutes. Continue working?')) {
            sessionManager.updateActivity(cookieSession);
          }
        });
      }
    }

    // Update time remaining every minute
    const interval = setInterval(() => {
      if (cookieSession) {
        const session = sessionManager.getSession(cookieSession);
        if (session) {
          const remaining =
            sessionManager.INACTIVITY_TIMEOUT - (Date.now() - session.lastActivity.getTime());
          setTimeRemaining(Math.max(0, remaining));
        }
      }
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  return {
    sessionId,
    isActive,
    timeRemaining,
    logout: () => {
      if (sessionId) {
        sessionManager.terminateSession(sessionId);
        window.location.href = '/simple-login';
      }
    },
  };
}

export default sessionManager;
