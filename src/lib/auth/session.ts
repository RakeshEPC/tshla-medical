import { NextRequest } from 'next/server';
import crypto from 'crypto';

// Session store (in production, use Redis or database)
const sessions = new Map<
  string,
  {
    email: string;
    name: string;
    createdAt: number;
    lastActivity: number;
  }
>();

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

export function createSession(email: string, name: string): string {
  const sessionId = crypto.randomBytes(32).toString('hex');

  sessions.set(sessionId, {
    email,
    name,
    createdAt: Date.now(),
    lastActivity: Date.now(),
  });

  return sessionId;
}

export function validateSession(sessionId: string | undefined): {
  valid: boolean;
  email?: string;
  name?: string;
} {
  if (!sessionId) {
    return { valid: false };
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return { valid: false };
  }

  const now = Date.now();

  // Check if session has expired
  if (now - session.lastActivity > SESSION_TIMEOUT) {
    sessions.delete(sessionId);
    return { valid: false };
  }

  // Update last activity
  session.lastActivity = now;

  return {
    valid: true,
    email: session.email,
    name: session.name,
  };
}

export function deleteSession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function cleanupSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      sessions.delete(id);
    }
  }
}

// Helper to get session from request
export function getSessionFromRequest(req: NextRequest): {
  valid: boolean;
  email?: string;
  name?: string;
} {
  const sessionId =
    req.cookies.get('tshla_session')?.value || req.headers.get('X-Session-Id') || undefined;

  return validateSession(sessionId);
}

// Export for use in other files
export { sessions, SESSION_TIMEOUT };
