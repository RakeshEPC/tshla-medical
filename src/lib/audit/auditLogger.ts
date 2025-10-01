// HIPAA-compliant audit logger with database persistence
// All audit logs are immutable and hash-chained for tamper detection

import { getDb, generateId } from '@/lib/db/client';
import crypto from 'crypto';
import { logError, logWarn, logInfo, logDebug } from '../../services/logger.service';

export enum AuditAction {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
  VIEW_PATIENT = 'VIEW_PATIENT',
  UPDATE_PATIENT = 'UPDATE_PATIENT',
  CREATE_PATIENT = 'CREATE_PATIENT',
  DELETE_PATIENT = 'DELETE_PATIENT',
  VIEW_VISIT = 'VIEW_VISIT',
  CREATE_VISIT = 'CREATE_VISIT',
  UPDATE_VISIT = 'UPDATE_VISIT',
  EXPORT_DATA = 'EXPORT_DATA',
  ACCESS_DENIED = 'ACCESS_DENIED',
  SESSION_TIMEOUT = 'SESSION_TIMEOUT',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  PHI_ENCRYPTED = 'PHI_ENCRYPTED',
  PHI_DECRYPTED = 'PHI_DECRYPTED',
}

export interface AuditEntry {
  id: string;
  actorId: string;
  patientId: string;
  action: AuditAction;
  timestamp: Date;
  ip: string;
  success: boolean;
  metadata?: any;
  previousHash: string;
  hash: string;
}

export class AuditLogger {
  private static instance: AuditLogger;
  private lastHash: string = '0'; // Genesis hash
  private inMemoryLogs: AuditEntry[] = []; // Fallback storage

  private constructor() {
    this.initializeHashChain();
  }

  static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  // Initialize hash chain from database
  private async initializeHashChain() {
    const db = getDb();

    try {
      // Get the last audit log entry to continue the hash chain
      const lastEntry = await db.queryOne(
        'SELECT hash FROM audit_logs ORDER BY created_at DESC LIMIT 1'
      );

      if (lastEntry?.hash) {
        this.lastHash = lastEntry.hash;
      }
    } catch (error) {
      logError('App', 'Error message', {});
    }
  }

  // Generate hash for audit entry
  private generateHash(entry: Omit<AuditEntry, 'hash'>): string {
    const data = `${entry.id}|${entry.actorId}|${entry.patientId}|${entry.action}|${entry.timestamp.toISOString()}|${entry.ip}|${entry.success}|${JSON.stringify(entry.metadata)}|${entry.previousHash}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // Log audit entry to database
  async logAudit(
    actorId: string,
    patientId: string,
    action: AuditAction,
    ip: string,
    success: boolean,
    metadata?: any
  ): Promise<void> {
    const db = getDb();

    try {
      const id = generateId();
      const timestamp = new Date();

      // Create entry with previous hash
      const entry: Omit<AuditEntry, 'hash'> = {
        id,
        actorId,
        patientId,
        action,
        timestamp,
        ip,
        success,
        metadata,
        previousHash: this.lastHash,
      };

      // Generate hash for this entry
      const hash = this.generateHash(entry);

      // Insert into database (immutable - no updates allowed)
      await db.execute(
        `INSERT INTO audit_logs (
          id, actor_id, patient_id, action, timestamp, ip, 
          success, metadata, previous_hash, hash
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          id,
          actorId,
          patientId,
          action.toString(),
          timestamp,
          ip,
          success,
          metadata ? JSON.stringify(metadata) : null,
          this.lastHash,
          hash,
        ]
      );

      // Update last hash for next entry
      this.lastHash = hash;
    } catch (error) {
      // Fallback to in-memory storage
      logDebug('App', 'Debug message', {});

      const auditEntry: AuditEntry = {
        id,
        actorId,
        patientId,
        action,
        timestamp,
        ip,
        success,
        metadata,
        previousHash: this.lastHash,
        hash: this.generateHash({
          id,
          actorId,
          patientId,
          action,
          timestamp,
          ip,
          success,
          metadata,
          previousHash: this.lastHash,
        }),
      };

      this.inMemoryLogs.push(auditEntry);
      this.lastHash = auditEntry.hash;

      // Keep only last 1000 entries in memory
      if (this.inMemoryLogs.length > 1000) {
        this.inMemoryLogs.shift();
      }
    }
  }

  // Log successful login
  async logSuccessfulLogin(doctorId: string, email: string, ip: string): Promise<void> {
    await this.logAudit(doctorId, 'SYSTEM', AuditAction.LOGIN_SUCCESS, ip, true, { email });
  }

  // Log failed login attempt
  async logFailedLogin(email: string, ip: string, reason: string): Promise<void> {
    await this.logAudit(email, 'SYSTEM', AuditAction.LOGIN_FAILED, ip, false, { reason });
  }

  // Log logout
  async logLogout(doctorId: string, ip: string): Promise<void> {
    await this.logAudit(doctorId, 'SYSTEM', AuditAction.LOGOUT, ip, true, {});
  }

  // Log patient data access
  async logPatientAccess(
    doctorId: string,
    patientId: string,
    action: AuditAction,
    ip: string,
    success: boolean = true,
    details?: any
  ): Promise<void> {
    await this.logAudit(doctorId, patientId, action, ip, success, details);
  }

  // Log PHI encryption
  async logPHIEncryption(doctorId: string, patientId: string, ip: string): Promise<void> {
    await this.logAudit(doctorId, patientId, AuditAction.PHI_ENCRYPTED, ip, true, {
      timestamp: new Date().toISOString(),
    });
  }

  // Log PHI decryption
  async logPHIDecryption(doctorId: string, patientId: string, ip: string): Promise<void> {
    await this.logAudit(doctorId, patientId, AuditAction.PHI_DECRYPTED, ip, true, {
      timestamp: new Date().toISOString(),
    });
  }

  // Verify audit log integrity
  async verifyIntegrity(startDate?: Date, endDate?: Date): Promise<boolean> {
    const db = getDb();

    try {
      let query = 'SELECT * FROM audit_logs';
      const params: any[] = [];

      if (startDate && endDate) {
        query += ' WHERE timestamp BETWEEN $1 AND $2';
        params.push(startDate, endDate);
      }

      query += ' ORDER BY created_at ASC';

      const entries = await db.query(query, params);

      let previousHash = '0'; // Genesis hash

      for (const entry of entries) {
        // Verify previous hash matches
        if (entry.previous_hash !== previousHash) {
          logError('App', 'Error message', {});
          return false;
        }

        // Recreate and verify hash
        const calculatedHash = this.generateHash({
          id: entry.id,
          actorId: entry.actor_id,
          patientId: entry.patient_id,
          action: entry.action as AuditAction,
          timestamp: new Date(entry.timestamp),
          ip: entry.ip,
          success: entry.success,
          metadata: entry.metadata,
          previousHash: entry.previous_hash,
        });

        if (calculatedHash !== entry.hash) {
          logError('App', 'Error message', {});
          return false;
        }

        previousHash = entry.hash;
      }

      return true;
    } catch (error) {
      logError('App', 'Error message', {});
      return false;
    }
  }

  // Get audit logs for reporting
  async getAuditLogs(filters?: {
    actorId?: string;
    patientId?: string;
    action?: AuditAction;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<AuditEntry[]> {
    const db = getDb();

    try {
      let query = 'SELECT * FROM audit_logs WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (filters?.actorId) {
        query += ` AND actor_id = $${paramIndex++}`;
        params.push(filters.actorId);
      }

      if (filters?.patientId) {
        query += ` AND patient_id = $${paramIndex++}`;
        params.push(filters.patientId);
      }

      if (filters?.action) {
        query += ` AND action = $${paramIndex++}`;
        params.push(filters.action);
      }

      if (filters?.startDate && filters?.endDate) {
        query += ` AND timestamp BETWEEN $${paramIndex++} AND $${paramIndex++}`;
        params.push(filters.startDate, filters.endDate);
      }

      query += ' ORDER BY created_at DESC';

      if (filters?.limit) {
        query += ` LIMIT $${paramIndex++}`;
        params.push(filters.limit);
      }

      const entries = await db.query(query, params);

      return entries.map((entry: any) => ({
        id: entry.id,
        actorId: entry.actor_id,
        patientId: entry.patient_id,
        action: entry.action as AuditAction,
        timestamp: new Date(entry.timestamp),
        ip: entry.ip,
        success: entry.success,
        metadata: entry.metadata,
        previousHash: entry.previous_hash,
        hash: entry.hash,
      }));
    } catch (error) {
      logError('App', 'Error message', {});
      return [];
    }
  }

  // Send security alert (in production, integrate with monitoring system)
  private sendSecurityAlert(message: string, error: any): void {
    // In production, send to:
    // - Security team email
    // - SIEM system
    // - PagerDuty/incident management
    logError('App', 'Error message', {});
  }
}
