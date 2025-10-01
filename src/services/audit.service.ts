/**
 * Audit Service - Tracks all system actions for HIPAA compliance
 * Logs user actions, data changes, and access patterns
 */

import type { AuditLog, AuditAction } from '../types/clinic.types';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

interface AuditContext {
  userId?: string;
  userName?: string;
  userRole?: string;
  ipAddress?: string;
  userAgent?: string;
}

class AuditService {
  private readonly STORAGE_PREFIX = 'tshla_audit_';
  private readonly MAX_LOGS = 10000; // Maximum logs to keep in localStorage
  private context: AuditContext = {};

  constructor() {
    // Initialize context from current session
    this.initializeContext();
  }

  /**
   * Initialize audit context from current session
   */
  private initializeContext(): void {
    if (typeof window === 'undefined') return;

    // Get user info from session
    const userData = localStorage.getItem('user_data');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        this.context.userId = user.id || user.email;
        this.context.userName = user.name;
        this.context.userRole = user.role;
      } catch (e) {
        logError('audit', 'Error message', {});
      }
    }

    // Get browser info
    if (typeof navigator !== 'undefined') {
      this.context.userAgent = navigator.userAgent;
    }
  }

  /**
   * Update audit context (e.g., after login)
   */
  updateContext(context: Partial<AuditContext>): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Log an audit event
   */
  async log(
    action: AuditAction,
    entityType: AuditLog['entityType'],
    entityId?: string,
    details?: Record<string, any>,
    changes?: AuditLog['changes']
  ): Promise<void> {
    const auditLog: AuditLog = {
      id: this.generateId(),
      actorId: this.context.userId || 'anonymous',
      actorName: this.context.userName,
      actorRole: this.context.userRole,
      action,
      entityType,
      entityId,
      entityDetails: details,
      changes,
      ipAddress: this.context.ipAddress,
      userAgent: this.context.userAgent,
      createdAt: new Date(),
    };

    // Save to storage
    this.saveLog(auditLog);

    // Also log to console in development
    if (import.meta.env.DEV) {
      logDebug('audit', 'Debug message', {});
    }

    // Clean up old logs if needed
    this.cleanupOldLogs();
  }

  /**
   * Log a create action
   */
  async logCreate(
    entityType: AuditLog['entityType'],
    entityId: string,
    entityData: Record<string, any>
  ): Promise<void> {
    await this.log('create', entityType, entityId, entityData);
  }

  /**
   * Log an update action
   */
  async logUpdate(
    entityType: AuditLog['entityType'],
    entityId: string,
    before: Record<string, any>,
    after: Record<string, any>
  ): Promise<void> {
    // Calculate what changed
    const changes = this.calculateChanges(before, after);

    await this.log(
      'update',
      entityType,
      entityId,
      { updated: Object.keys(changes) },
      {
        before: changes.before,
        after: changes.after,
      }
    );
  }

  /**
   * Log a delete action
   */
  async logDelete(
    entityType: AuditLog['entityType'],
    entityId: string,
    entityData?: Record<string, any>
  ): Promise<void> {
    await this.log('delete', entityType, entityId, entityData);
  }

  /**
   * Log a view/access action
   */
  async logView(
    entityType: AuditLog['entityType'],
    entityId: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log('view', entityType, entityId, details);
  }

  /**
   * Log a login action
   */
  async logLogin(userId: string, userName?: string, role?: string): Promise<void> {
    // Update context with new user info
    this.updateContext({
      userId,
      userName,
      userRole: role,
    });

    await this.log('login', 'patient', userId, {
      userName,
      role,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log a logout action
   */
  async logLogout(): Promise<void> {
    const userId = this.context.userId;

    await this.log('logout', 'patient', userId, {
      timestamp: new Date().toISOString(),
    });

    // Clear context
    this.context = {};
  }

  /**
   * Log note signing
   */
  async logNoteSigned(noteId: string, patientId: string): Promise<void> {
    await this.log('sign', 'note', noteId, {
      patientId,
      signedBy: this.context.userId,
      signedAt: new Date().toISOString(),
    });
  }

  /**
   * Log action item processing
   */
  async logActionItemProcessed(
    itemId: string,
    itemType: 'medication' | 'lab',
    action: string,
    patientId: string
  ): Promise<void> {
    await this.log('process', 'action_item', itemId, {
      itemType,
      action,
      patientId,
      processedBy: this.context.userId,
      processedAt: new Date().toISOString(),
    });
  }

  /**
   * Get audit logs with filtering
   */
  async getAuditLogs(filters?: {
    actorId?: string;
    entityType?: AuditLog['entityType'];
    entityId?: string;
    action?: AuditAction;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<AuditLog[]> {
    const allLogs = this.getAllLogs();

    let filtered = allLogs;

    // Apply filters
    if (filters) {
      if (filters.actorId) {
        filtered = filtered.filter(log => log.actorId === filters.actorId);
      }
      if (filters.entityType) {
        filtered = filtered.filter(log => log.entityType === filters.entityType);
      }
      if (filters.entityId) {
        filtered = filtered.filter(log => log.entityId === filters.entityId);
      }
      if (filters.action) {
        filtered = filtered.filter(log => log.action === filters.action);
      }
      if (filters.startDate) {
        filtered = filtered.filter(log => new Date(log.createdAt) >= filters.startDate!);
      }
      if (filters.endDate) {
        filtered = filtered.filter(log => new Date(log.createdAt) <= filters.endDate!);
      }
    }

    // Sort by date (newest first)
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Apply limit
    if (filters?.limit) {
      filtered = filtered.slice(0, filters.limit);
    }

    return filtered;
  }

  /**
   * Get audit logs for a specific entity
   */
  async getEntityAuditTrail(
    entityType: AuditLog['entityType'],
    entityId: string
  ): Promise<AuditLog[]> {
    return this.getAuditLogs({
      entityType,
      entityId,
    });
  }

  /**
   * Get audit logs for a specific user
   */
  async getUserAuditTrail(userId: string): Promise<AuditLog[]> {
    return this.getAuditLogs({
      actorId: userId,
    });
  }

  /**
   * Generate unique ID for audit log
   */
  private generateId(): number {
    return Date.now() + Math.floor(Math.random() * 1000);
  }

  /**
   * Save log to storage
   */
  private saveLog(log: AuditLog): void {
    if (typeof window === 'undefined') return;

    const key = `${this.STORAGE_PREFIX}${log.id}`;
    localStorage.setItem(key, JSON.stringify(log));
  }

  /**
   * Get all logs from storage
   */
  private getAllLogs(): AuditLog[] {
    const logs: AuditLog[] = [];

    if (typeof window === 'undefined') return logs;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.STORAGE_PREFIX)) {
        const logData = localStorage.getItem(key);
        if (logData) {
          try {
            logs.push(JSON.parse(logData));
          } catch (e) {
            logError('audit', 'Error message', {});
          }
        }
      }
    }

    return logs;
  }

  /**
   * Clean up old logs to prevent storage overflow
   */
  private cleanupOldLogs(): void {
    const logs = this.getAllLogs();

    if (logs.length > this.MAX_LOGS) {
      // Sort by date (oldest first)
      logs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      // Remove oldest logs
      const toRemove = logs.slice(0, logs.length - this.MAX_LOGS);

      for (const log of toRemove) {
        const key = `${this.STORAGE_PREFIX}${log.id}`;
        localStorage.removeItem(key);
      }

      logDebug('audit', 'Debug message', {});
    }
  }

  /**
   * Calculate changes between two objects
   */
  private calculateChanges(
    before: Record<string, any>,
    after: Record<string, any>
  ): {
    before: Record<string, any>;
    after: Record<string, any>;
  } {
    const changes = {
      before: {} as Record<string, any>,
      after: {} as Record<string, any>,
    };

    // Find changed fields
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

    for (const key of allKeys) {
      const beforeValue = before[key];
      const afterValue = after[key];

      if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
        changes.before[key] = beforeValue;
        changes.after[key] = afterValue;
      }
    }

    return changes;
  }

  /**
   * Export audit logs (for compliance reporting)
   */
  async exportAuditLogs(filters?: Parameters<typeof this.getAuditLogs>[0]): Promise<string> {
    const logs = await this.getAuditLogs(filters);

    // Convert to CSV format
    const headers = [
      'Timestamp',
      'Actor ID',
      'Actor Name',
      'Actor Role',
      'Action',
      'Entity Type',
      'Entity ID',
      'Details',
    ];

    const rows = logs.map(log => [
      new Date(log.createdAt).toISOString(),
      log.actorId,
      log.actorName || '',
      log.actorRole || '',
      log.action,
      log.entityType,
      log.entityId || '',
      JSON.stringify(log.entityDetails || {}),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    return csv;
  }
}

// Export singleton instance
export const auditService = new AuditService();

// Also export for backward compatibility
export default auditService;
