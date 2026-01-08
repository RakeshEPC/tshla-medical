/**
 * Enhanced Audit Service
 *
 * Comprehensive audit logging for all PHI access and system events.
 * Part of HIPAA Phase 7: Enhanced Audit Logging
 *
 * HIPAA Compliance: §164.308(a)(1)(ii)(D) - Information System Activity Review
 *                   §164.312(b) - Audit Controls
 */

import { supabase } from '../lib/supabase';
import { deviceFingerprintService } from './deviceFingerprint.service';
import { sessionManagementService } from './sessionManagement.service';
import { logError, logInfo } from './logger.service';

/**
 * Audit event types
 */
export type AuditAction =
  | 'view'
  | 'create'
  | 'update'
  | 'delete'
  | 'export'
  | 'login'
  | 'logout'
  | 'search'
  | 'print'
  | 'download';

/**
 * Resource types that can be audited
 */
export type AuditResourceType =
  | 'patient'
  | 'pump_report'
  | 'medical_record'
  | 'appointment'
  | 'session'
  | 'user'
  | 'settings'
  | 'template'
  | 'dictation';

/**
 * Audit event details
 */
export interface AuditEvent {
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string;
  success?: boolean;
  errorMessage?: string;
  statusCode?: number;
  metadata?: Record<string, any>;
  containsPHI?: boolean;
  phiFields?: string[];
  responseTimeMs?: number;
}

/**
 * Audit log entry (as stored in database)
 */
export interface AuditLog {
  id: string;
  timestamp: string;
  user_id: string;
  user_email: string;
  user_role: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  ip_address?: string;
  user_agent?: string;
  request_path?: string;
  request_method?: string;
  success: boolean;
  error_message?: string;
  status_code?: number;
  metadata?: Record<string, any>;
  contains_phi: boolean;
  phi_fields?: string[];
  response_time_ms?: number;
  session_id?: string;
  device_fingerprint?: string;
}

/**
 * Audit statistics
 */
export interface AuditStatistics {
  total_events: number;
  total_users: number;
  total_phi_access: number;
  total_failures: number;
  actions_by_type: Record<string, number>;
  resources_by_type: Record<string, number>;
  top_users: Array<{ email: string; count: number }>;
}

/**
 * Suspicious activity detection result
 */
export interface SuspiciousActivity {
  user_email: string;
  suspicious_reason: string;
  event_count: number;
  recent_events: any[];
}

/**
 * Enhanced Audit Service
 */
export const enhancedAuditService = {
  /**
   * Log an audit event
   *
   * @param event - Audit event details
   * @returns Promise<string | null> - Audit log ID or null if failed
   */
  async logEvent(event: AuditEvent): Promise<string | null> {
    try {
      const startTime = Date.now();

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        logError('EnhancedAudit', 'Cannot log event - no authenticated user');
        return null;
      }

      // Get user profile to get role
      const { data: staffData } = await supabase
        .from('medical_staff')
        .select('role, email')
        .eq('auth_user_id', user.id)
        .single();

      const userEmail = staffData?.email || user.email || 'unknown';
      const userRole = staffData?.role || 'unknown';

      // Get current session
      const currentSession = await sessionManagementService.getCurrentSession();

      // Get device info
      const deviceFingerprint = await deviceFingerprintService.getFingerprint();
      const ipAddress = await deviceFingerprintService.getIPAddress();

      // Get request details
      const userAgent = navigator.userAgent;
      const requestPath = window.location.pathname;

      // Calculate response time if not provided
      const responseTime = event.responseTimeMs || (Date.now() - startTime);

      // Call the stored procedure
      const { data, error } = await supabase
        .rpc('log_audit_event', {
          p_user_id: user.id,
          p_user_email: userEmail,
          p_user_role: userRole,
          p_action: event.action,
          p_resource_type: event.resourceType,
          p_resource_id: event.resourceId || null,
          p_ip_address: ipAddress,
          p_user_agent: userAgent,
          p_request_path: requestPath,
          p_request_method: 'GET', // Default, can be overridden in metadata
          p_success: event.success ?? true,
          p_error_message: event.errorMessage || null,
          p_status_code: event.statusCode || null,
          p_metadata: event.metadata || null,
          p_contains_phi: event.containsPHI ?? false,
          p_phi_fields: event.phiFields || null,
          p_response_time_ms: responseTime,
          p_session_id: currentSession?.id || null,
          p_device_fingerprint: deviceFingerprint
        });

      if (error) {
        logError('EnhancedAudit', 'Failed to log audit event', { error, event });
        return null;
      }

      return data as string;
    } catch (error) {
      logError('EnhancedAudit', 'Exception logging audit event', { error, event });
      return null;
    }
  },

  /**
   * Log PHI access (patient data, medical records, etc.)
   *
   * @param action - What action was performed
   * @param resourceType - Type of resource
   * @param resourceId - ID of the resource
   * @param phiFields - Specific PHI fields accessed
   * @param metadata - Additional context
   */
  async logPHIAccess(
    action: AuditAction,
    resourceType: AuditResourceType,
    resourceId: string,
    phiFields: string[],
    metadata?: Record<string, any>
  ): Promise<string | null> {
    return this.logEvent({
      action,
      resourceType,
      resourceId,
      containsPHI: true,
      phiFields,
      metadata,
      success: true
    });
  },

  /**
   * Log failed action (for security monitoring)
   *
   * @param action - Action that failed
   * @param resourceType - Type of resource
   * @param errorMessage - Error message
   * @param statusCode - HTTP status code
   */
  async logFailure(
    action: AuditAction,
    resourceType: AuditResourceType,
    errorMessage: string,
    statusCode?: number
  ): Promise<string | null> {
    return this.logEvent({
      action,
      resourceType,
      success: false,
      errorMessage,
      statusCode: statusCode || 500
    });
  },

  /**
   * Get audit logs with filters
   *
   * @param filters - Query filters
   * @param limit - Maximum number of results
   * @returns Promise<AuditLog[]>
   */
  async getAuditLogs(
    filters: {
      userId?: string;
      action?: AuditAction;
      resourceType?: AuditResourceType;
      containsPHI?: boolean;
      success?: boolean;
      startDate?: Date;
      endDate?: Date;
    } = {},
    limit: number = 100
  ): Promise<AuditLog[]> {
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);

      // Apply filters
      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }

      if (filters.action) {
        query = query.eq('action', filters.action);
      }

      if (filters.resourceType) {
        query = query.eq('resource_type', filters.resourceType);
      }

      if (filters.containsPHI !== undefined) {
        query = query.eq('contains_phi', filters.containsPHI);
      }

      if (filters.success !== undefined) {
        query = query.eq('success', filters.success);
      }

      if (filters.startDate) {
        query = query.gte('timestamp', filters.startDate.toISOString());
      }

      if (filters.endDate) {
        query = query.lte('timestamp', filters.endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        logError('EnhancedAudit', 'Failed to get audit logs', { error, filters });
        return [];
      }

      return (data || []) as AuditLog[];
    } catch (error) {
      logError('EnhancedAudit', 'Exception getting audit logs', { error, filters });
      return [];
    }
  },

  /**
   * Get audit statistics
   *
   * @param startDate - Start of date range
   * @param endDate - End of date range
   * @returns Promise<AuditStatistics | null>
   */
  async getStatistics(
    startDate: Date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    endDate: Date = new Date()
  ): Promise<AuditStatistics | null> {
    try {
      const { data, error } = await supabase.rpc('get_audit_statistics', {
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString()
      });

      if (error) {
        logError('EnhancedAudit', 'Failed to get audit statistics', { error });
        return null;
      }

      return data?.[0] || null;
    } catch (error) {
      logError('EnhancedAudit', 'Exception getting audit statistics', { error });
      return null;
    }
  },

  /**
   * Detect suspicious activity
   *
   * @param lookbackMinutes - How far back to look (default 60 minutes)
   * @returns Promise<SuspiciousActivity[]>
   */
  async detectSuspiciousActivity(lookbackMinutes: number = 60): Promise<SuspiciousActivity[]> {
    try {
      const { data, error } = await supabase.rpc('detect_suspicious_activity', {
        p_lookback_minutes: lookbackMinutes
      });

      if (error) {
        logError('EnhancedAudit', 'Failed to detect suspicious activity', { error });
        return [];
      }

      return (data || []) as SuspiciousActivity[];
    } catch (error) {
      logError('EnhancedAudit', 'Exception detecting suspicious activity', { error });
      return [];
    }
  },

  /**
   * Get recent PHI access for a specific resource
   *
   * @param resourceType - Type of resource
   * @param resourceId - ID of the resource
   * @param limit - Maximum results
   * @returns Promise<AuditLog[]>
   */
  async getPHIAccessHistory(
    resourceType: AuditResourceType,
    resourceId: string,
    limit: number = 50
  ): Promise<AuditLog[]> {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('resource_type', resourceType)
        .eq('resource_id', resourceId)
        .eq('contains_phi', true)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        logError('EnhancedAudit', 'Failed to get PHI access history', {
          error,
          resourceType,
          resourceId
        });
        return [];
      }

      return (data || []) as AuditLog[];
    } catch (error) {
      logError('EnhancedAudit', 'Exception getting PHI access history', {
        error,
        resourceType,
        resourceId
      });
      return [];
    }
  },

  /**
   * Export audit logs to CSV
   *
   * @param filters - Query filters
   * @returns Promise<string> - CSV content
   */
  async exportToCSV(filters: Parameters<typeof this.getAuditLogs>[0] = {}): Promise<string> {
    const logs = await this.getAuditLogs(filters, 10000); // Max 10k records

    if (logs.length === 0) {
      return 'No audit logs found';
    }

    // CSV headers
    const headers = [
      'Timestamp',
      'User Email',
      'User Role',
      'Action',
      'Resource Type',
      'Resource ID',
      'Success',
      'Contains PHI',
      'IP Address',
      'Device',
      'Error Message'
    ];

    // CSV rows
    const rows = logs.map(log => [
      log.timestamp,
      log.user_email,
      log.user_role,
      log.action,
      log.resource_type,
      log.resource_id || '',
      log.success ? 'Yes' : 'No',
      log.contains_phi ? 'Yes' : 'No',
      log.ip_address || '',
      log.user_agent || '',
      log.error_message || ''
    ]);

    // Build CSV
    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    return csv;
  }
};
