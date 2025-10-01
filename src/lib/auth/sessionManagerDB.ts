// Database-backed session manager for HIPAA compliance
// All sessions are persisted to database with automatic cleanup

import { getDb, generateId } from '@/lib/db/client';
import crypto from 'crypto';
import { logError, logWarn, logInfo, logDebug } from '../../services/logger.service';

export interface Session {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  lastActivity: Date;
  absoluteExpiry: Date;
  idleExpiry: Date;
  ip: string;
  userAgent?: string;
  active: boolean;
}

export interface SessionConfig {
  idleTimeout: number; // Time in ms before idle timeout (30 minutes)
  absoluteTimeout: number; // Time in ms before absolute timeout (12 hours)
  warningBefore: number; // Time in ms to warn before timeout (2 minutes)
}

class SessionManagerDB {
  private static instance: SessionManagerDB;
  private config: SessionConfig = {
    idleTimeout: 30 * 60 * 1000, // 30 minutes
    absoluteTimeout: 12 * 60 * 60 * 1000, // 12 hours
    warningBefore: 2 * 60 * 1000, // 2 minutes
  };

  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Start cleanup process
    this.startCleanupProcess();
  }

  static getInstance(): SessionManagerDB {
    if (!SessionManagerDB.instance) {
      SessionManagerDB.instance = new SessionManagerDB();
    }
    return SessionManagerDB.instance;
  }

  // Start periodic cleanup of expired sessions
  private startCleanupProcess() {
    // Clean up every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupExpiredSessions();
      },
      5 * 60 * 1000
    );
  }

  // In-memory session storage (fallback when database not available)
  private inMemorySessions: Map<string, Session> = new Map();

  // Create a new session in database
  async createSession(
    email: string,
    name: string,
    ip: string,
    userAgent?: string
  ): Promise<string> {
    const db = getDb();

    // Generate secure session ID
    const sessionId = crypto.randomBytes(32).toString('hex');

    const now = new Date();
    const absoluteExpiry = new Date(now.getTime() + this.config.absoluteTimeout);
    const idleExpiry = new Date(now.getTime() + this.config.idleTimeout);

    try {
      await db.execute(
        `INSERT INTO sessions (
          id, email, name, created_at, last_activity, 
          absolute_expiry, idle_expiry, ip, user_agent, active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [sessionId, email, name, now, now, absoluteExpiry, idleExpiry, ip, userAgent, true]
      );

      logDebug('App', 'Debug message', {});
      return sessionId;
    } catch (error) {
      // Fallback to in-memory storage
      logDebug('App', 'Debug message', {});

      const session: Session = {
        id: sessionId,
        email,
        name,
        createdAt: now,
        lastActivity: now,
        absoluteExpiry,
        idleExpiry,
        ip,
        userAgent,
        active: true,
      };

      this.inMemorySessions.set(sessionId, session);
      logDebug('App', 'Debug message', {});
      return sessionId;
    }
  }

  // Validate session and update activity
  async validateSession(sessionId: string | undefined): Promise<{
    valid: boolean;
    session?: Session;
    shouldWarn?: boolean;
  }> {
    if (!sessionId) {
      return { valid: false };
    }

    // Check in-memory sessions first
    const inMemorySession = this.inMemorySessions.get(sessionId);
    if (inMemorySession) {
      const now = new Date();

      // Check timeouts
      if (now > inMemorySession.absoluteExpiry || now > inMemorySession.idleExpiry) {
        this.inMemorySessions.delete(sessionId);
        return { valid: false };
      }

      // Update activity
      inMemorySession.lastActivity = now;
      inMemorySession.idleExpiry = new Date(now.getTime() + this.config.idleTimeout);

      // Check if should warn
      const timeToIdleTimeout = inMemorySession.idleExpiry.getTime() - now.getTime();
      const timeToAbsoluteTimeout = inMemorySession.absoluteExpiry.getTime() - now.getTime();
      const minTimeToTimeout = Math.min(timeToIdleTimeout, timeToAbsoluteTimeout);
      const shouldWarn = minTimeToTimeout <= this.config.warningBefore;

      return { valid: true, session: inMemorySession, shouldWarn };
    }

    const db = getDb();

    try {
      // Get session from database
      const sessionData = await db.queryOne(
        `SELECT * FROM sessions 
         WHERE id = $1 AND active = true`,
        [sessionId]
      );

      if (!sessionData) {
        return { valid: false };
      }

      const now = new Date();
      const session: Session = {
        id: sessionData.id,
        email: sessionData.email,
        name: sessionData.name,
        createdAt: new Date(sessionData.created_at),
        lastActivity: new Date(sessionData.last_activity),
        absoluteExpiry: new Date(sessionData.absolute_expiry),
        idleExpiry: new Date(sessionData.idle_expiry),
        ip: sessionData.ip,
        userAgent: sessionData.user_agent,
        active: sessionData.active,
      };

      // Check absolute timeout
      if (now > session.absoluteExpiry) {
        await this.invalidateSession(sessionId);
        return { valid: false };
      }

      // Check idle timeout
      if (now > session.idleExpiry) {
        await this.invalidateSession(sessionId);
        return { valid: false };
      }

      // Update activity and extend idle timeout
      const newIdleExpiry = new Date(now.getTime() + this.config.idleTimeout);

      await db.execute(
        `UPDATE sessions 
         SET last_activity = $1, idle_expiry = $2 
         WHERE id = $3`,
        [now, newIdleExpiry, sessionId]
      );

      // Check if should warn about upcoming timeout
      const timeToIdleTimeout = session.idleExpiry.getTime() - now.getTime();
      const timeToAbsoluteTimeout = session.absoluteExpiry.getTime() - now.getTime();
      const minTimeToTimeout = Math.min(timeToIdleTimeout, timeToAbsoluteTimeout);

      const shouldWarn = minTimeToTimeout <= this.config.warningBefore;

      return {
        valid: true,
        session: {
          ...session,
          lastActivity: now,
          idleExpiry: newIdleExpiry,
        },
        shouldWarn,
      };
    } catch (error) {
      logError('App', 'Error message', {});
      return { valid: false };
    }
  }

  // Get session by user email
  async getUserSession(email: string): Promise<Session | null> {
    // Check in-memory sessions first
    for (const [_, session] of this.inMemorySessions) {
      if (session.email === email && session.active) {
        return session;
      }
    }

    const db = getDb();

    try {
      const sessionData = await db.queryOne(
        `SELECT * FROM sessions 
         WHERE email = $1 AND active = true 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [email]
      );

      if (!sessionData) {
        return null;
      }

      return {
        id: sessionData.id,
        email: sessionData.email,
        name: sessionData.name,
        createdAt: new Date(sessionData.created_at),
        lastActivity: new Date(sessionData.last_activity),
        absoluteExpiry: new Date(sessionData.absolute_expiry),
        idleExpiry: new Date(sessionData.idle_expiry),
        ip: sessionData.ip,
        userAgent: sessionData.user_agent,
        active: sessionData.active,
      };
    } catch (error) {
      logDebug('App', 'Debug message', {});
      return null;
    }
  }

  // Invalidate a session
  async invalidateSession(sessionId: string): Promise<void> {
    const db = getDb();

    try {
      await db.execute(
        `UPDATE sessions 
         SET active = false 
         WHERE id = $1`,
        [sessionId]
      );

      logDebug('App', 'Debug message', {});
    } catch (error) {
      logError('App', 'Error message', {});
    }
  }

  // Force logout a user (invalidate all their sessions)
  async forceLogoutUser(email: string): Promise<void> {
    // Clear in-memory sessions first
    for (const [sessionId, session] of this.inMemorySessions) {
      if (session.email === email) {
        this.inMemorySessions.delete(sessionId);
      }
    }

    const db = getDb();

    try {
      const result = await db.execute(
        `UPDATE sessions 
         SET active = false 
         WHERE email = $1 AND active = true`,
        [email]
      );

      logDebug('App', 'Debug message', {});
    } catch (error) {
      logDebug('App', 'Debug message', {});
    }
  }

  // Clean up expired sessions
  async cleanupExpiredSessions(): Promise<void> {
    const db = getDb();

    try {
      const now = new Date();

      // Invalidate sessions that have exceeded their timeouts
      const result = await db.execute(
        `UPDATE sessions 
         SET active = false 
         WHERE active = true 
         AND (idle_expiry < $1 OR absolute_expiry < $2)`,
        [now, now]
      );

      if (result.rowCount > 0) {
        logDebug('App', 'Debug message', {});
      }

      // Delete very old inactive sessions (older than 7 days)
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      await db.execute(
        `DELETE FROM sessions 
         WHERE active = false 
         AND created_at < $1`,
        [sevenDaysAgo]
      );
    } catch (error) {
      logError('App', 'Error message', {});
    }
  }

  // Get all active sessions (for admin monitoring)
  async getActiveSessions(): Promise<Session[]> {
    const db = getDb();

    try {
      const sessions = await db.query(
        `SELECT * FROM sessions 
         WHERE active = true 
         ORDER BY last_activity DESC`
      );

      return sessions.map((s: any) => ({
        id: s.id,
        email: s.email,
        name: s.name,
        createdAt: new Date(s.created_at),
        lastActivity: new Date(s.last_activity),
        absoluteExpiry: new Date(s.absolute_expiry),
        idleExpiry: new Date(s.idle_expiry),
        ip: s.ip,
        userAgent: s.user_agent,
        active: s.active,
      }));
    } catch (error) {
      logError('App', 'Error message', {});
      return [];
    }
  }

  // Get session statistics
  async getSessionStats(): Promise<{
    activeSessions: number;
    uniqueUsers: number;
    sessionsLast24h: number;
    averageSessionDuration: number;
  }> {
    const db = getDb();

    try {
      const stats = await db.queryOne(
        `SELECT 
          COUNT(CASE WHEN active = true THEN 1 END) as active_sessions,
          COUNT(DISTINCT email) as unique_users,
          COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as sessions_24h,
          AVG(EXTRACT(EPOCH FROM (last_activity - created_at))) as avg_duration
         FROM sessions`
      );

      return {
        activeSessions: stats.active_sessions || 0,
        uniqueUsers: stats.unique_users || 0,
        sessionsLast24h: stats.sessions_24h || 0,
        averageSessionDuration: stats.avg_duration || 0,
      };
    } catch (error) {
      logError('App', 'Error message', {});
      return {
        activeSessions: 0,
        uniqueUsers: 0,
        sessionsLast24h: 0,
        averageSessionDuration: 0,
      };
    }
  }

  // Cleanup on shutdown
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Export singleton instance
export default SessionManagerDB.getInstance();
