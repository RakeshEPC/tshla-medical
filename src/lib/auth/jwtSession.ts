import crypto from 'crypto';
import { env } from '../config/environment';
import { logError, logWarn, logInfo, logDebug } from '../../services/logger.service';

/**
 * JWT-based Session Management for Azure deployment
 * Uses signed cookies instead of in-memory storage
 */

const SECRET_KEY = env.SESSION_SECRET || 'tshla-medical-session-secret-2024-secure-key';

export interface SessionData {
  email: string;
  name: string;
  createdAt: number;
  expiresAt: number;
}

/**
 * Create a signed session token
 */
export function createSessionToken(email: string, name: string): string {
  const sessionData: SessionData = {
    email,
    name,
    createdAt: Date.now(),
    expiresAt: Date.now() + 12 * 60 * 60 * 1000, // 12 hours
  };

  const payload = Buffer.from(JSON.stringify(sessionData)).toString('base64');
  const signature = crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('hex');

  return `${payload}.${signature}`;
}

/**
 * Verify and decode a session token
 */
export function verifySessionToken(token: string | undefined): {
  valid: boolean;
  data?: SessionData;
  reason?: string;
} {
  if (!token) {
    return { valid: false, reason: 'No token provided' };
  }

  try {
    const [payload, signature] = token.split('.');

    if (!payload || !signature) {
      return { valid: false, reason: 'Invalid token format' };
    }

    // Verify signature
    const expectedSignature = crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('hex');

    if (signature !== expectedSignature) {
      return { valid: false, reason: 'Invalid signature' };
    }

    // Decode and check expiration
    const sessionData: SessionData = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));

    if (Date.now() > sessionData.expiresAt) {
      return { valid: false, reason: 'Session expired' };
    }

    return { valid: true, data: sessionData };
  } catch (error) {
    logError('App', 'Error message', {});
    return { valid: false, reason: 'Token verification failed' };
  }
}

/**
 * Extend session expiration
 */
export function extendSession(token: string): string | null {
  const result = verifySessionToken(token);

  if (!result.valid || !result.data) {
    return null;
  }

  // Create new token with extended expiration
  return createSessionToken(result.data.email, result.data.name);
}
