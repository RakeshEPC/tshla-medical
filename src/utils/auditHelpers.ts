/**
 * Audit Logging Helpers
 *
 * Utility functions to make audit logging easier across the application.
 * Part of HIPAA Phase 7: Enhanced Audit Logging
 */

import { enhancedAuditService, AuditAction, AuditResourceType } from '../services/enhancedAudit.service';

/**
 * Wrap an async function with audit logging
 * Automatically logs success/failure and timing
 *
 * @example
 * const getPatient = withAudit('view', 'patient', async (id: string) => {
 *   return await supabase.from('patients').select('*').eq('id', id).single();
 * });
 */
export function withAudit<T extends (...args: any[]) => Promise<any>>(
  action: AuditAction,
  resourceType: AuditResourceType,
  fn: T,
  options: {
    containsPHI?: boolean;
    phiFields?: string[];
    getResourceId?: (...args: Parameters<T>) => string;
    getMetadata?: (...args: Parameters<T>) => Record<string, any>;
  } = {}
): T {
  return (async (...args: Parameters<T>) => {
    const startTime = Date.now();
    let resourceId: string | undefined;
    let metadata: Record<string, any> | undefined;

    try {
      // Get resource ID if function provided
      if (options.getResourceId) {
        resourceId = options.getResourceId(...args);
      }

      // Get metadata if function provided
      if (options.getMetadata) {
        metadata = options.getMetadata(...args);
      }

      // Execute the function
      const result = await fn(...args);

      // Log successful audit event
      await enhancedAuditService.logEvent({
        action,
        resourceType,
        resourceId,
        success: true,
        containsPHI: options.containsPHI,
        phiFields: options.phiFields,
        metadata,
        responseTimeMs: Date.now() - startTime
      });

      return result;
    } catch (error) {
      // Log failed audit event
      await enhancedAuditService.logEvent({
        action,
        resourceType,
        resourceId,
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
        containsPHI: options.containsPHI,
        metadata,
        responseTimeMs: Date.now() - startTime
      });

      // Re-throw the error
      throw error;
    }
  }) as T;
}

/**
 * Quick audit log for PHI access
 *
 * @example
 * await auditPHIAccess('view', 'patient', patientId, ['name', 'dob', 'ssn']);
 */
export async function auditPHIAccess(
  action: AuditAction,
  resourceType: AuditResourceType,
  resourceId: string,
  phiFields: string[],
  metadata?: Record<string, any>
): Promise<void> {
  await enhancedAuditService.logPHIAccess(action, resourceType, resourceId, phiFields, metadata);
}

/**
 * Quick audit log for general actions
 *
 * @example
 * await auditAction('search', 'patient', { query: 'john doe' });
 */
export async function auditAction(
  action: AuditAction,
  resourceType: AuditResourceType,
  metadata?: Record<string, any>
): Promise<void> {
  await enhancedAuditService.logEvent({
    action,
    resourceType,
    metadata,
    success: true
  });
}

/**
 * Audit log for failed actions
 *
 * @example
 * await auditFailure('delete', 'patient', 'Insufficient permissions', 403);
 */
export async function auditFailure(
  action: AuditAction,
  resourceType: AuditResourceType,
  errorMessage: string,
  statusCode?: number
): Promise<void> {
  await enhancedAuditService.logFailure(action, resourceType, errorMessage, statusCode);
}

/**
 * Common PHI fields for different resource types
 */
export const PHI_FIELDS = {
  patient: [
    'name',
    'first_name',
    'last_name',
    'date_of_birth',
    'ssn',
    'email',
    'phone',
    'address',
    'city',
    'state',
    'zip',
    'medical_record_number'
  ],
  pump_report: [
    'patient_id',
    'blood_glucose_readings',
    'insulin_doses',
    'meal_logs',
    'activity_logs',
    'notes'
  ],
  medical_record: [
    'diagnosis',
    'medications',
    'allergies',
    'procedures',
    'lab_results',
    'vital_signs',
    'clinical_notes'
  ],
  appointment: [
    'patient_id',
    'reason_for_visit',
    'chief_complaint',
    'visit_notes'
  ]
};
