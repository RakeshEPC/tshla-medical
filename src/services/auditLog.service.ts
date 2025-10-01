import { logError, logWarn, logInfo, logDebug } from './logger.service';
/**
 * HIPAA Audit Logging Service
 * Tracks all PHI access and system events for compliance
 */

export enum AuditAction {
  // Authentication Events
  LOGIN_ATTEMPT = 'LOGIN_ATTEMPT',
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  LOGOUT = 'LOGOUT',
  SESSION_TIMEOUT = 'SESSION_TIMEOUT',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',

  // Patient Data Access
  VIEW_PATIENT = 'VIEW_PATIENT',
  VIEW_PATIENT_LIST = 'VIEW_PATIENT_LIST',
  CREATE_PATIENT = 'CREATE_PATIENT',
  UPDATE_PATIENT = 'UPDATE_PATIENT',
  DELETE_PATIENT = 'DELETE_PATIENT',
  SEARCH_PATIENT = 'SEARCH_PATIENT',

  // Visit/Note Operations
  VIEW_VISIT = 'VIEW_VISIT',
  CREATE_VISIT = 'CREATE_VISIT',
  UPDATE_VISIT = 'UPDATE_VISIT',
  DELETE_VISIT = 'DELETE_VISIT',
  EXPORT_VISIT = 'EXPORT_VISIT',
  PRINT_VISIT = 'PRINT_VISIT',

  // Transcription Operations
  START_TRANSCRIPTION = 'START_TRANSCRIPTION',
  STOP_TRANSCRIPTION = 'STOP_TRANSCRIPTION',
  SAVE_TRANSCRIPTION = 'SAVE_TRANSCRIPTION',

  // Template Operations
  VIEW_TEMPLATE = 'VIEW_TEMPLATE',
  CREATE_TEMPLATE = 'CREATE_TEMPLATE',
  UPDATE_TEMPLATE = 'UPDATE_TEMPLATE',
  DELETE_TEMPLATE = 'DELETE_TEMPLATE',

  // System Events
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  DATA_EXPORT = 'DATA_EXPORT',
  SETTINGS_CHANGE = 'SETTINGS_CHANGE',
}

export interface AuditLogEntry {
  userId: string;
  userName?: string;
  action: AuditAction;
  resourceType?: 'patient' | 'visit' | 'template' | 'system' | 'authentication';
  resourceId?: string;
  resourceName?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
  phiAccessed: boolean;
  timestamp?: Date;
}

class AuditLogService {
  private isEnabled: boolean;
  private currentUserId: string | null = null;
  private currentUserName: string | null = null;
  private sessionId: string | null = null;

  constructor() {
    // HIPAA requires audit logging - enabled by default
    this.isEnabled = import.meta.env.VITE_ENABLE_AUDIT_LOGGING !== 'false';

    // Generate session ID
    this.sessionId = this.generateSessionId();

    // Log service initialization
    if (this.isEnabled) {
      logDebug('auditLog', 'Debug message', {});
    }
  }

  /**
   * Set current user for audit context
   */
  setCurrentUser(userId: string, userName?: string) {
    this.currentUserId = userId;
    this.currentUserName = userName;
  }

  /**
   * Clear current user (on logout)
   */
  clearCurrentUser() {
    this.currentUserId = null;
    this.currentUserName = null;
    this.sessionId = this.generateSessionId(); // New session ID for next user
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get client information
   */
  private getClientInfo(): { ipAddress: string; userAgent: string } {
    return {
      ipAddress: 'client', // In production, get from request headers
      userAgent: navigator.userAgent,
    };
  }

  /**
   * Check if action involves PHI
   */
  private involvesPHI(action: AuditAction, resourceType?: string): boolean {
    const phiActions = [
      AuditAction.VIEW_PATIENT,
      AuditAction.VIEW_PATIENT_LIST,
      AuditAction.CREATE_PATIENT,
      AuditAction.UPDATE_PATIENT,
      AuditAction.DELETE_PATIENT,
      AuditAction.SEARCH_PATIENT,
      AuditAction.VIEW_VISIT,
      AuditAction.CREATE_VISIT,
      AuditAction.UPDATE_VISIT,
      AuditAction.DELETE_VISIT,
      AuditAction.EXPORT_VISIT,
      AuditAction.PRINT_VISIT,
      AuditAction.SAVE_TRANSCRIPTION,
    ];

    return phiActions.includes(action) || resourceType === 'patient' || resourceType === 'visit';
  }

  /**
   * Log an audit event
   */
  async log(entry: Partial<AuditLogEntry>): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const clientInfo = this.getClientInfo();
      const fullEntry: AuditLogEntry = {
        userId: entry.userId || this.currentUserId || 'anonymous',
        userName: entry.userName || this.currentUserName,
        action: entry.action || AuditAction.SYSTEM_ERROR,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        resourceName: entry.resourceName,
        details: {
          ...entry.details,
          sessionId: this.sessionId,
        },
        ipAddress: entry.ipAddress || clientInfo.ipAddress,
        userAgent: entry.userAgent || clientInfo.userAgent,
        success: entry.success !== false,
        errorMessage: entry.errorMessage,
        phiAccessed:
          entry.phiAccessed !== undefined
            ? entry.phiAccessed
            : this.involvesPHI(entry.action!, entry.resourceType),
        timestamp: new Date(),
      };

      // Log to console in development
      if (import.meta.env.DEV) {
        logDebug('auditLog', 'Debug message', {});
      }

      // Save to localStorage (no database connection in frontend-only mode)
      const auditLogs = JSON.parse(localStorage.getItem('audit_logs') || '[]');
      auditLogs.push({
        ...fullEntry,
        timestamp: new Date().toISOString(),
      });
      // Keep only last 100 entries in localStorage
      if (auditLogs.length > 100) {
        auditLogs.shift();
      }
      localStorage.setItem('audit_logs', JSON.stringify(auditLogs));
    } catch (error) {
      // Don't throw errors from audit logging - log to console instead
      logError('auditLog', 'Error message', {});
    }
  }

  /**
   * Log login attempt
   */
  async logLogin(email: string, success: boolean, errorReason?: string): Promise<void> {
    await this.log({
      action: success ? AuditAction.LOGIN_SUCCESS : AuditAction.LOGIN_FAILURE,
      resourceType: 'authentication',
      details: { email },
      errorMessage: errorReason,
      success,
      phiAccessed: false,
    });
  }

  /**
   * Log logout
   */
  async logLogout(reason: 'manual' | 'timeout' | 'forced' = 'manual'): Promise<void> {
    await this.log({
      action: reason === 'timeout' ? AuditAction.SESSION_TIMEOUT : AuditAction.LOGOUT,
      resourceType: 'authentication',
      details: { reason },
      success: true,
      phiAccessed: false,
    });
  }

  /**
   * Log patient access
   */
  async logPatientAccess(
    patientId: string,
    patientName: string,
    action: 'view' | 'create' | 'update' | 'delete' = 'view'
  ): Promise<void> {
    const actionMap = {
      view: AuditAction.VIEW_PATIENT,
      create: AuditAction.CREATE_PATIENT,
      update: AuditAction.UPDATE_PATIENT,
      delete: AuditAction.DELETE_PATIENT,
    };

    await this.log({
      action: actionMap[action],
      resourceType: 'patient',
      resourceId: patientId,
      resourceName: patientName,
      success: true,
      phiAccessed: true,
    });
  }

  /**
   * Log visit/note access
   */
  async logVisitAccess(
    visitId: string,
    patientId: string,
    action: 'view' | 'create' | 'update' | 'delete' | 'export' | 'print' = 'view'
  ): Promise<void> {
    const actionMap = {
      view: AuditAction.VIEW_VISIT,
      create: AuditAction.CREATE_VISIT,
      update: AuditAction.UPDATE_VISIT,
      delete: AuditAction.DELETE_VISIT,
      export: AuditAction.EXPORT_VISIT,
      print: AuditAction.PRINT_VISIT,
    };

    await this.log({
      action: actionMap[action],
      resourceType: 'visit',
      resourceId: visitId,
      details: { patientId },
      success: true,
      phiAccessed: true,
    });
  }

  /**
   * Log transcription operation
   */
  async logTranscription(
    action: 'start' | 'stop' | 'save',
    patientId?: string,
    success: boolean = true
  ): Promise<void> {
    const actionMap = {
      start: AuditAction.START_TRANSCRIPTION,
      stop: AuditAction.STOP_TRANSCRIPTION,
      save: AuditAction.SAVE_TRANSCRIPTION,
    };

    await this.log({
      action: actionMap[action],
      resourceType: 'visit',
      details: { patientId },
      success,
      phiAccessed: action === 'save',
    });
  }

  /**
   * Log permission denied
   */
  async logPermissionDenied(
    attemptedAction: string,
    resourceType?: string,
    resourceId?: string
  ): Promise<void> {
    await this.log({
      action: AuditAction.PERMISSION_DENIED,
      resourceType: resourceType as any,
      resourceId,
      details: { attemptedAction },
      success: false,
      phiAccessed: false,
    });
  }

  /**
   * Log system error
   */
  async logError(error: Error | string, context?: any): Promise<void> {
    await this.log({
      action: AuditAction.SYSTEM_ERROR,
      resourceType: 'system',
      details: {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        context,
      },
      success: false,
      phiAccessed: false,
    });
  }

  /**
   * Get audit logs for reporting
   */
  async getAuditLogs(filters?: {
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    action?: AuditAction;
    phiOnly?: boolean;
  }): Promise<any[]> {
    // This would query the database with filters
    // For now, return empty array
    return [];
  }

  /**
   * Generate HIPAA compliance report
   */
  async generateComplianceReport(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalEvents: number;
    phiAccess: number;
    failedLogins: number;
    uniqueUsers: number;
    topActions: Array<{ action: string; count: number }>;
  }> {
    // This would generate a comprehensive report from audit logs
    return {
      totalEvents: 0,
      phiAccess: 0,
      failedLogins: 0,
      uniqueUsers: 0,
      topActions: [],
    };
  }
}

// Export singleton instance
export const auditLogService = new AuditLogService();
