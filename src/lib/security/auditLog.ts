import { hashIdentifier } from './encryption';
import { env } from "../config/environment";
import { logError, logWarn, logInfo, logDebug } from '../../services/logger.service';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userRole?: string;
  action: AuditAction;
  resourceType: ResourceType;
  resourceId: string;
  patientId?: string; // Hashed
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}

export enum AuditAction {
  // Authentication
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  LOGIN_FAILED = 'LOGIN_FAILED',
  SESSION_TIMEOUT = 'SESSION_TIMEOUT',
  
  // Data Access
  VIEW_PATIENT = 'VIEW_PATIENT',
  VIEW_TRANSCRIPT = 'VIEW_TRANSCRIPT',
  VIEW_RESULTS = 'VIEW_RESULTS',
  
  // Data Modification
  CREATE_NOTE = 'CREATE_NOTE',
  UPDATE_NOTE = 'UPDATE_NOTE',
  DELETE_NOTE = 'DELETE_NOTE',
  
  // PHI Transmission
  SEND_EMAIL = 'SEND_EMAIL',
  EXPORT_DATA = 'EXPORT_DATA',
  PRINT_DATA = 'PRINT_DATA',
  
  // Prior Auth
  SUBMIT_PA = 'SUBMIT_PA',
  VIEW_PA = 'VIEW_PA',
  
  // System
  API_CALL = 'API_CALL',
  ENCRYPTION_FAILURE = 'ENCRYPTION_FAILURE',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS'
}

export enum ResourceType {
  PATIENT = 'PATIENT',
  TRANSCRIPT = 'TRANSCRIPT',
  NOTE = 'NOTE',
  TEMPLATE = 'TEMPLATE',
  PRIOR_AUTH = 'PRIOR_AUTH',
  PUMP_SELECTION = 'PUMP_SELECTION'
}

class AuditLogger {
  private queue: AuditLogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Flush logs every 10 seconds
    if (typeof window === 'undefined') {
      this.flushInterval = setInterval(() => this.flush(), 10000);
    }
  }

  /**
   * Log an audit event
   */
  async log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
    const logEntry: AuditLogEntry = {
      ...entry,
      id: this.generateLogId(),
      timestamp: new Date().toISOString(),
      // Hash patient ID if present
      patientId: entry.patientId ? hashIdentifier(entry.patientId) : undefined
    };

    // Add to queue
    this.queue.push(logEntry);

    // Flush immediately for critical events
    if (this.isCriticalEvent(entry.action)) {
      await this.flush();
    }
  }

  /**
   * Log a PHI access event
   */
  async logPHIAccess(
    userId: string,
    patientId: string,
    action: AuditAction,
    resourceType: ResourceType,
    resourceId: string,
    success: boolean = true
  ): Promise<void> {
    await this.log({
      userId,
      patientId,
      action,
      resourceType,
      resourceId,
      success
    });
  }

  /**
   * Log a failed access attempt
   */
  async logFailedAccess(
    userId: string,
    action: AuditAction,
    resourceType: ResourceType,
    resourceId: string,
    reason: string
  ): Promise<void> {
    await this.log({
      userId,
      action,
      resourceType,
      resourceId,
      success: false,
      errorMessage: reason
    });
  }

  /**
   * Flush logs to persistent storage
   */
  private async flush(): Promise<void> {
    if (this.queue.length === 0) return;

    const logsToFlush = [...this.queue];
    this.queue = [];

    try {
      // In production, send to secure logging service
      if (env.NODE_ENV === 'production') {
        await this.sendToLoggingService(logsToFlush);
      } else {
        // In development, write to console (never do this in production!)
        logDebug('App', 'Debug message', {}); 
      }
    } catch (error) {
      logError('App', 'Error message', {});
      // Re-add to queue to retry
      this.queue.unshift(...logsToFlush);
    }
  }

  /**
   * Send logs to secure logging service
   */
  private async sendToLoggingService(logs: AuditLogEntry[]): Promise<void> {
    // Implement based on your logging service (e.g., CloudWatch, Datadog, Splunk)
    const response = await fetch('/api/audit/log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Audit-Token': env.AUDIT_TOKEN || ''
      },
      body: JSON.stringify({ logs })
    });

    if (!response.ok) {
      throw new Error(`Audit log failed: ${response.status}`);
    }
  }

  /**
   * Generate unique log ID
   */
  private generateLogId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if event is critical and needs immediate logging
   */
  private isCriticalEvent(action: AuditAction): boolean {
    return [
      AuditAction.LOGIN_FAILED,
      AuditAction.UNAUTHORIZED_ACCESS,
      AuditAction.DELETE_NOTE,
      AuditAction.EXPORT_DATA,
      AuditAction.ENCRYPTION_FAILURE
    ].includes(action);
  }

  /**
   * Cleanup on shutdown
   */
  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    await this.flush();
  }
}

// Singleton instance
export const auditLogger = new AuditLogger();
export const AuditLog = auditLogger;

// Helper function for API routes
export async function withAuditLog<T>(
  userId: string,
  action: AuditAction,
  resourceType: ResourceType,
  resourceId: string,
  operation: () => Promise<T>
): Promise<T> {
  try {
    const result = await operation();
    await auditLogger.log({
      userId,
      action,
      resourceType,
      resourceId,
      success: true
    });
    return result;
  } catch (error) {
    await auditLogger.log({
      userId,
      action,
      resourceType,
      resourceId,
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}