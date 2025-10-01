import crypto from 'crypto';
import { env } from '../config/environment';
import { logError, logWarn, logInfo, logDebug } from '../../services/logger.service';

// Server-side only encryption utilities
// IMPORTANT: These should only run on the server, never in the browser

const ENCRYPTION_KEY = env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const IV_LENGTH = 16;
const ALGORITHM = 'aes-256-cbc';

/**
 * Encrypts sensitive data (PHI)
 * Use this before storing any patient data
 */
export function encryptPHI(text: string): string {
  if (!text) return '';

  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);

    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (error) {
    logError('App', 'Error message', {});
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypts sensitive data (PHI)
 */
export function decryptPHI(text: string): string {
  if (!text) return '';

  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);

    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString();
  } catch (error) {
    logError('App', 'Error message', {});
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Hash sensitive identifiers (for indexing without exposing PHI)
 */
export function hashIdentifier(identifier: string): string {
  return crypto
    .createHash('sha256')
    .update(identifier + (env.SALT || 'default-salt'))
    .digest('hex');
}

/**
 * Generate secure tokens for sessions
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Mask sensitive data for logs (show only last 4 characters)
 */
export function maskPHI(text: string, showLast: number = 4): string {
  if (!text || text.length <= showLast) return '****';
  return '*'.repeat(text.length - showLast) + text.slice(-showLast);
}

/**
 * Validate data integrity with HMAC
 */
export function createIntegrityHash(data: string): string {
  const hmac = crypto.createHmac('sha256', ENCRYPTION_KEY);
  hmac.update(data);
  return hmac.digest('hex');
}

export function verifyIntegrity(data: string, hash: string): boolean {
  const computedHash = createIntegrityHash(data);
  return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(hash));
}
