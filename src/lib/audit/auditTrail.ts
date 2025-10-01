import crypto from 'crypto';
import { logError, logWarn, logInfo, logDebug } from '../../services/logger.service';

/**
 * HIPAA-Compliant Audit Trail with Hash Chaining
 * Provides tamper-evident logging of all PHI access
 */

export interface AuditEntry {
  id: string;
  actorId: string; // User who performed the action
  patientId: string; // Patient record accessed
  action: AuditAction; // Type of action performed
  timestamp: string; // ISO timestamp
  ip: string; // IP address of actor
  success: boolean; // Whether action succeeded
  metadata?: AuditMetadata; // Additional context (no PHI)
  previousHash: string; // Hash of previous entry (for chain)
  hash: string; // Hash of this entry
}

export interface AuditMetadata {
  resource?: string; // Resource accessed (e.g., 'medications', 'labs')
  fieldsAccessed?: string[]; // Which fields were accessed (names only, no values)
  reason?: string; // Reason for access (if provided)
  sessionId?: string; // Session identifier
  userAgent?: string; // Browser/client info
  method?: string; // HTTP method
  endpoint?: string; // API endpoint
}

export enum AuditAction {
  // Authentication
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  LOGIN_FAILED = 'LOGIN_FAILED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',

  // Patient Data Access
  VIEW_PATIENT_LIST = 'VIEW_PATIENT_LIST',
  VIEW_PATIENT = 'VIEW_PATIENT',
  SEARCH_PATIENT = 'SEARCH_PATIENT',

  // Patient Data Modification
  CREATE_PATIENT = 'CREATE_PATIENT',
  UPDATE_PATIENT = 'UPDATE_PATIENT',
  DELETE_PATIENT = 'DELETE_PATIENT',

  // Medical Records
  VIEW_MEDICAL_RECORD = 'VIEW_MEDICAL_RECORD',
  CREATE_VISIT = 'CREATE_VISIT',
  UPDATE_VISIT = 'UPDATE_VISIT',
  VIEW_VISIT = 'VIEW_VISIT',

  // Specific PHI Access
  VIEW_MEDICATIONS = 'VIEW_MEDICATIONS',
  UPDATE_MEDICATIONS = 'UPDATE_MEDICATIONS',
  VIEW_LABS = 'VIEW_LABS',
  VIEW_CONDITIONS = 'VIEW_CONDITIONS',
  VIEW_MENTAL_HEALTH = 'VIEW_MENTAL_HEALTH',
  UPDATE_MENTAL_HEALTH = 'UPDATE_MENTAL_HEALTH',

  // Documents
  GENERATE_SOAP_NOTE = 'GENERATE_SOAP_NOTE',
  EXPORT_RECORD = 'EXPORT_RECORD',
  PRINT_RECORD = 'PRINT_RECORD',

  // Encryption Events
  ENCRYPT_DATA = 'ENCRYPT_DATA',
  DECRYPT_DATA = 'DECRYPT_DATA',

  // Emergency Access
  EMERGENCY_ACCESS = 'EMERGENCY_ACCESS',
  BREAK_GLASS = 'BREAK_GLASS', // Emergency override
}

class AuditTrail {
  private entries: AuditEntry[] = [];
  private lastHash: string = '0'; // Genesis hash

  constructor() {
    // In production, load from persistent storage
    this.initializeFromStorage();
  }

  /**
   * Create a new audit entry
   */
  public async logEntry(
    actorId: string,
    patientId: string,
    action: AuditAction,
    ip: string,
    success: boolean,
    metadata?: AuditMetadata
  ): Promise<string> {
    const timestamp = new Date().toISOString();
    const id = `audit_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

    // Create entry without hash
    const entry: Partial<AuditEntry> = {
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

    // Calculate hash of this entry
    const hash = this.calculateHash(entry);

    // Complete the entry
    const completeEntry: AuditEntry = {
      ...entry,
      hash,
    } as AuditEntry;

    // Store the entry
    this.entries.push(completeEntry);
    this.lastHash = hash;

    // Persist to storage (async)
    this.persistEntry(completeEntry).catch(err => {
      logError('App', 'Error message', {});
    });

    // Return entry ID for reference
    return id;
  }

  /**
   * Calculate hash for an entry (for chain integrity)
   */
  private calculateHash(entry: Partial<AuditEntry>): string {
    const content = JSON.stringify({
      id: entry.id,
      actorId: entry.actorId,
      patientId: entry.patientId,
      action: entry.action,
      timestamp: entry.timestamp,
      ip: entry.ip,
      success: entry.success,
      metadata: entry.metadata,
      previousHash: entry.previousHash,
    });

    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Verify the integrity of the audit chain
   */
  public verifyChainIntegrity(): { valid: boolean; brokenAt?: number } {
    if (this.entries.length === 0) {
      return { valid: true };
    }

    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];

      // Verify hash
      const calculatedHash = this.calculateHash({
        id: entry.id,
        actorId: entry.actorId,
        patientId: entry.patientId,
        action: entry.action,
        timestamp: entry.timestamp,
        ip: entry.ip,
        success: entry.success,
        metadata: entry.metadata,
        previousHash: entry.previousHash,
      });

      if (calculatedHash !== entry.hash) {
        return { valid: false, brokenAt: i };
      }

      // Verify chain (except for first entry)
      if (i > 0 && entry.previousHash !== this.entries[i - 1].hash) {
        return { valid: false, brokenAt: i };
      }
    }

    return { valid: true };
  }

  /**
   * Get audit entries for a specific patient (no PHI exposed)
   */
  public getPatientAuditLog(patientId: string, limit?: number): AuditEntry[] {
    const filtered = this.entries.filter(e => e.patientId === patientId);
    return limit ? filtered.slice(-limit) : filtered;
  }

  /**
   * Get audit entries for a specific actor
   */
  public getActorAuditLog(actorId: string, limit?: number): AuditEntry[] {
    const filtered = this.entries.filter(e => e.actorId === actorId);
    return limit ? filtered.slice(-limit) : filtered;
  }

  /**
   * Get recent audit entries
   */
  public getRecentEntries(limit: number = 100): AuditEntry[] {
    return this.entries.slice(-limit);
  }

  /**
   * Search audit log (no PHI in results)
   */
  public searchAuditLog(criteria: {
    actorId?: string;
    patientId?: string;
    action?: AuditAction;
    startDate?: Date;
    endDate?: Date;
    success?: boolean;
  }): AuditEntry[] {
    return this.entries.filter(entry => {
      if (criteria.actorId && entry.actorId !== criteria.actorId) return false;
      if (criteria.patientId && entry.patientId !== criteria.patientId) return false;
      if (criteria.action && entry.action !== criteria.action) return false;
      if (criteria.success !== undefined && entry.success !== criteria.success) return false;

      const entryDate = new Date(entry.timestamp);
      if (criteria.startDate && entryDate < criteria.startDate) return false;
      if (criteria.endDate && entryDate > criteria.endDate) return false;

      return true;
    });
  }

  /**
   * Get suspicious activity (multiple failed attempts, unusual patterns)
   */
  public detectSuspiciousActivity(): {
    failedLogins: AuditEntry[];
    afterHoursAccess: AuditEntry[];
    unusualPatterns: AuditEntry[];
  } {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Failed login attempts
    const failedLogins = this.entries.filter(
      e => e.action === AuditAction.LOGIN_FAILED && new Date(e.timestamp) > oneHourAgo
    );

    // After hours access (assuming 6 PM to 6 AM)
    const afterHoursAccess = this.entries.filter(e => {
      const hour = new Date(e.timestamp).getHours();
      return (hour >= 18 || hour < 6) && e.success;
    });

    // Unusual patterns (rapid access to multiple patients)
    const recentAccess = this.entries.filter(
      e => new Date(e.timestamp) > oneHourAgo && e.action === AuditAction.VIEW_PATIENT
    );

    const actorPatientCount = new Map<string, Set<string>>();
    recentAccess.forEach(e => {
      if (!actorPatientCount.has(e.actorId)) {
        actorPatientCount.set(e.actorId, new Set());
      }
      actorPatientCount.get(e.actorId)!.add(e.patientId);
    });

    const unusualPatterns = recentAccess.filter(e => {
      const count = actorPatientCount.get(e.actorId)?.size || 0;
      return count > 10; // More than 10 different patients in an hour
    });

    return {
      failedLogins,
      afterHoursAccess,
      unusualPatterns,
    };
  }

  /**
   * Generate audit report (for compliance)
   */
  public generateAuditReport(
    startDate: Date,
    endDate: Date
  ): {
    summary: any;
    entries: AuditEntry[];
    integrity: { valid: boolean };
  } {
    const entries = this.searchAuditLog({ startDate, endDate });

    const summary = {
      totalEntries: entries.length,
      uniqueActors: new Set(entries.map(e => e.actorId)).size,
      uniquePatients: new Set(entries.map(e => e.patientId)).size,
      successfulActions: entries.filter(e => e.success).length,
      failedActions: entries.filter(e => !e.success).length,
      actionBreakdown: this.getActionBreakdown(entries),
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    };

    return {
      summary,
      entries,
      integrity: this.verifyChainIntegrity(),
    };
  }

  /**
   * Get breakdown of actions
   */
  private getActionBreakdown(entries: AuditEntry[]): Record<string, number> {
    const breakdown: Record<string, number> = {};
    entries.forEach(e => {
      breakdown[e.action] = (breakdown[e.action] || 0) + 1;
    });
    return breakdown;
  }

  /**
   * Persist entry to storage (in production, use database)
   */
  private async persistEntry(entry: AuditEntry): Promise<void> {
    // In production, this would:
    // 1. Write to immutable database
    // 2. Send to SIEM system
    // 3. Backup to secure storage
    // 4. Trigger alerts for suspicious activity
    // For now, just log that we would persist
    // In production, this would write to database
    // await db.auditLog.create({ data: entry });
  }

  /**
   * Initialize from storage
   */
  private initializeFromStorage(): void {
    // In production, load existing entries from database
    // and set lastHash to the hash of the most recent entry
    // const entries = await db.auditLog.findMany({ orderBy: { timestamp: 'asc' } });
    // this.entries = entries;
    // this.lastHash = entries[entries.length - 1]?.hash || '0';
  }

  /**
   * Export audit log (for backup/compliance)
   */
  public exportAuditLog(): string {
    const data = {
      version: '1.0',
      exported: new Date().toISOString(),
      integrity: this.verifyChainIntegrity(),
      entries: this.entries,
    };
    return JSON.stringify(data, null, 2);
  }
}

// Singleton instance
export const auditTrail = new AuditTrail();

// Helper function for easy logging
export async function logAudit(
  actorId: string,
  patientId: string,
  action: AuditAction,
  req?: { ip?: string; headers?: any },
  success: boolean = true,
  metadata?: AuditMetadata
): Promise<string> {
  const ip =
    req?.ip || req?.headers?.['x-forwarded-for'] || req?.headers?.['x-real-ip'] || '0.0.0.0';

  return auditTrail.logEntry(actorId, patientId, action, ip, success, metadata);
}

export default auditTrail;
