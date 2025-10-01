import { cookies } from 'next/headers';
import { env } from "../config/environment";
import { SignJWT, jwtVerify } from 'jose';
import { encryptPHI, decryptPHI, generateSecureToken } from './encryption';
import { auditLogger, AuditAction, ResourceType } from './auditLog';
import { logError, logWarn, logInfo, logDebug } from '../../services/logger.service';

const SESSION_DURATION = 15 * 60 * 1000; // 15 minutes
const SESSION_COOKIE_NAME = 'tshla_session';
const JWT_SECRET = new TextEncoder().encode(
  env.JWT_SECRET || 'your-secret-key-change-this-in-production'
);

export interface SessionData {
  userId: string;
  userRole: 'physician' | 'nurse' | 'admin' | 'staff';
  permissions: string[];
  loginTime: string;
  lastActivity: string;
  ipAddress?: string;
  mfaVerified: boolean;
}

export interface EncryptedPatientData {
  patientId: string;
  data: string; // Encrypted JSON
  integrityHash: string;
  timestamp: string;
}

/**
 * Create a new secure session
 */
export async function createSession(
  userId: string,
  userRole: SessionData['userRole'],
  permissions: string[],
  ipAddress?: string
): Promise<string> {
  const sessionId = generateSecureToken();
  const now = new Date().toISOString();
  
  const sessionData: SessionData = {
    userId,
    userRole,
    permissions,
    loginTime: now,
    lastActivity: now,
    ipAddress,
    mfaVerified: false
  };

  // Create JWT token
  const token = await new SignJWT({ 
    ...sessionData, 
    sessionId 
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('15m')
    .setIssuedAt()
    .sign(JWT_SECRET);

  // Set secure cookie
  const cookieStore = cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: SESSION_DURATION / 1000,
    path: '/'
  });

  // Log session creation
  await auditLogger.log({
    userId,
    userRole,
    action: AuditAction.LOGIN,
    resourceType: ResourceType.PATIENT,
    resourceId: sessionId,
    ipAddress,
    success: true
  });

  return sessionId;
}

/**
 * Validate and get current session
 */
export async function getSession(): Promise<SessionData | null> {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME);
    
    if (!token) return null;

    const { payload } = await jwtVerify(token.value, JWT_SECRET);
    const sessionData = payload as unknown as SessionData;

    // Check if session is expired based on last activity
    const lastActivity = new Date(sessionData.lastActivity);
    const now = new Date();
    const timeSinceActivity = now.getTime() - lastActivity.getTime();

    if (timeSinceActivity > SESSION_DURATION) {
      await terminateSession(sessionData.userId);
      return null;
    }

    // Update last activity
    await updateSessionActivity(sessionData.userId);

    return sessionData;
  } catch (error) {
    logError('App', 'Error message', {});
    return null;
  }
}

/**
 * Update session activity timestamp
 */
export async function updateSessionActivity(userId: string): Promise<void> {
  const session = await getSession();
  if (!session) return;

  const updatedSession = {
    ...session,
    lastActivity: new Date().toISOString()
  };

  const token = await new SignJWT(updatedSession)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('15m')
    .setIssuedAt()
    .sign(JWT_SECRET);

  const cookieStore = cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: SESSION_DURATION / 1000,
    path: '/'
  });
}

/**
 * Terminate session
 */
export async function terminateSession(userId: string): Promise<void> {
  const cookieStore = cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);

  await auditLogger.log({
    userId,
    action: AuditAction.LOGOUT,
    resourceType: ResourceType.PATIENT,
    resourceId: 'session',
    success: true
  });
}

/**
 * Check if user has permission for an action
 */
export async function hasPermission(
  permission: string,
  session?: SessionData | null
): Promise<boolean> {
  const currentSession = session || await getSession();
  if (!currentSession) return false;

  // Admin has all permissions
  if (currentSession.userRole === 'admin') return true;

  return currentSession.permissions.includes(permission);
}

/**
 * Store patient data securely (server-side only)
 */
export async function storePatientData(
  patientId: string,
  data: any,
  session?: SessionData | null
): Promise<void> {
  const currentSession = session || await getSession();
  if (!currentSession) {
    throw new Error('No active session');
  }

  // Check permissions
  if (!await hasPermission('write:patient_data', currentSession)) {
    await auditLogger.logFailedAccess(
      currentSession.userId,
      AuditAction.UNAUTHORIZED_ACCESS,
      ResourceType.PATIENT,
      patientId,
      'Insufficient permissions'
    );
    throw new Error('Insufficient permissions');
  }

  // Encrypt the data
  const encryptedData = encryptPHI(JSON.stringify(data));

  // Store in secure database (implement based on your database)
  // For now, using a secure server-side cache
  await storeInSecureCache(patientId, encryptedData);

  // Log the access
  await auditLogger.logPHIAccess(
    currentSession.userId,
    patientId,
    AuditAction.UPDATE_NOTE,
    ResourceType.PATIENT,
    patientId
  );
}

/**
 * Retrieve patient data securely
 */
export async function retrievePatientData(
  patientId: string,
  session?: SessionData | null
): Promise<any> {
  const currentSession = session || await getSession();
  if (!currentSession) {
    throw new Error('No active session');
  }

  // Check permissions
  if (!await hasPermission('read:patient_data', currentSession)) {
    await auditLogger.logFailedAccess(
      currentSession.userId,
      AuditAction.UNAUTHORIZED_ACCESS,
      ResourceType.PATIENT,
      patientId,
      'Insufficient permissions'
    );
    throw new Error('Insufficient permissions');
  }

  // Retrieve from secure storage
  const encryptedData = await retrieveFromSecureCache(patientId);
  if (!encryptedData) return null;

  // Decrypt the data
  const decryptedData = decryptPHI(encryptedData);

  // Log the access
  await auditLogger.logPHIAccess(
    currentSession.userId,
    patientId,
    AuditAction.VIEW_PATIENT,
    ResourceType.PATIENT,
    patientId
  );

  return JSON.parse(decryptedData);
}

// Temporary secure cache (replace with database in production)
const secureCache = new Map<string, string>();

async function storeInSecureCache(key: string, value: string): Promise<void> {
  secureCache.set(key, value);
}

async function retrieveFromSecureCache(key: string): Promise<string | undefined> {
  return secureCache.get(key);
}

/**
 * Middleware to check session and auto-logout
 */
export async function requireSession() {
  const session = await getSession();
  
  if (!session) {
    throw new Error('Authentication required');
  }

  // Check if session is about to expire (warn at 2 minutes)
  const lastActivity = new Date(session.lastActivity);
  const now = new Date();
  const timeSinceActivity = now.getTime() - lastActivity.getTime();
  const timeRemaining = SESSION_DURATION - timeSinceActivity;

  if (timeRemaining < 2 * 60 * 1000) {
    logWarn("App", "Warning message", {});  'seconds');
  }

  return session;
}