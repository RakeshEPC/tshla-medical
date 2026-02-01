/**
 * Patient ID Formatter Utilities
 *
 * Helper functions to safely extract and display patient identifiers
 * Prevents the common mistake of using patient_id instead of tshla_id
 */

import type { UnifiedPatient, SchedulePatientData, SchedulePatientIds, PATIENT_ID_PATTERNS } from '../types/unified-patient.types';

/**
 * Get formatted TSH ID for display in schedule
 *
 * @param patient - Unified patient record from database join
 * @returns Formatted TSH ID (e.g., "TSH 972-918") or null if not available
 *
 * @example
 * const tshId = getDisplayTshId(appointment.unified_patients);
 * // Returns: "TSH 972-918"
 *
 * ⚠️ This function will log warnings if:
 * - TSH ID format is invalid
 * - You're accidentally using patient_id field
 */
export function getDisplayTshId(
  patient: UnifiedPatient | SchedulePatientData | null | undefined
): string | null {
  if (!patient) return null;

  const tshId = patient.tshla_id;

  if (!tshId) return null;

  // Validate format: Must be "TSH XXX-XXX"
  const TSH_ID_PATTERN = /^TSH \d{3}-\d{3}$/;

  if (!TSH_ID_PATTERN.test(tshId)) {
    console.error('⚠️ Invalid TSH ID format detected:', tshId);
    console.error('Expected format: "TSH XXX-XXX" (e.g., "TSH 972-918")');
    console.error('Patient record:', {
      patient_id: patient.patient_id,
      tshla_id: patient.tshla_id,
    });

    // Check if someone accidentally used patient_id
    if (/^\d{8}$/.test(tshId)) {
      console.error('❌ CRITICAL ERROR: This looks like patient_id (8-digit), not tshla_id!');
      console.error('   Fix: Use patient.tshla_id instead of patient.patient_id');
      console.error('   See: src/types/unified-patient.types.ts for field definitions');
    }
  }

  return tshId;
}

/**
 * Get MRN (Medical Record Number) for display
 *
 * @param patient - Patient record
 * @param fallbackMrn - MRN from schedule if patient record doesn't have it
 * @returns MRN string or null
 *
 * @example
 * const mrn = getDisplayMrn(appointment.unified_patients, appointment.patient_mrn);
 * // Returns: "26996854"
 */
export function getDisplayMrn(
  patient: UnifiedPatient | SchedulePatientData | null | undefined,
  fallbackMrn?: string | null
): string | null {
  // Prefer patient record MRN, fallback to schedule MRN
  return patient?.mrn || fallbackMrn || null;
}

/**
 * Get internal patient ID (8-digit)
 *
 * @param patient - Patient record
 * @returns 8-digit internal ID or null
 *
 * ⚠️ WARNING: This is for internal use only, NOT for UI display!
 * For UI display, use getDisplayTshId() instead
 *
 * @example
 * const internalId = getInternalPatientId(patient);
 * // Returns: "99364924"
 * // But DON'T display this to users!
 */
export function getInternalPatientId(
  patient: UnifiedPatient | SchedulePatientData | null | undefined
): string | null {
  if (!patient) return null;

  const patientId = patient.patient_id;

  if (!patientId) return null;

  // Validate format: Must be 8 digits
  if (!/^\d{8}$/.test(patientId)) {
    console.warn('⚠️ Invalid patient_id format:', patientId);
    console.warn('Expected: 8-digit number (e.g., "99364924")');
  }

  return patientId;
}

/**
 * Get all patient IDs for schedule display
 *
 * This is the SAFEST way to get patient IDs for display
 * Use this instead of accessing fields directly
 *
 * @param patient - Patient record from schedule join
 * @param fallbackMrn - MRN from schedule appointment if not in patient record
 * @returns Object with all formatted IDs
 *
 * @example
 * const ids = getSchedulePatientIds(
 *   appointment.unified_patients,
 *   appointment.patient_mrn
 * );
 *
 * // Use in component:
 * <span className="text-purple-700">TSH ID: {ids.tsh_id}</span>
 * <span className="text-blue-700">MRN: {ids.mrn}</span>
 */
export function getSchedulePatientIds(
  patient: UnifiedPatient | SchedulePatientData | null | undefined,
  fallbackMrn?: string | null
): SchedulePatientIds {
  return {
    tsh_id: getDisplayTshId(patient),
    mrn: getDisplayMrn(patient, fallbackMrn),
    internal_id: getInternalPatientId(patient),
  };
}

/**
 * Validate TSH ID format
 *
 * @param tshId - TSH ID to validate
 * @returns true if valid format, false otherwise
 *
 * @example
 * isValidTshIdFormat("TSH 972-918");  // true
 * isValidTshIdFormat("99364924");     // false (this is patient_id!)
 * isValidTshIdFormat("TSH123-456");   // false (missing space)
 */
export function isValidTshIdFormat(tshId: string | null | undefined): boolean {
  if (!tshId) return false;
  return /^TSH \d{3}-\d{3}$/.test(tshId);
}

/**
 * Validate patient_id format (8 digits)
 *
 * @param patientId - Patient ID to validate
 * @returns true if valid format, false otherwise
 *
 * @example
 * isValidPatientIdFormat("99364924");  // true
 * isValidPatientIdFormat("TSH 972-918");  // false (this is tshla_id!)
 */
export function isValidPatientIdFormat(patientId: string | null | undefined): boolean {
  if (!patientId) return false;
  return /^\d{8}$/.test(patientId);
}

/**
 * Format patient name from first and last name
 *
 * @param firstName - Patient first name
 * @param lastName - Patient last name
 * @param fallbackName - Full name from schedule if first/last not available
 * @returns Formatted full name
 */
export function formatPatientName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  fallbackName?: string | null
): string {
  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  }

  return fallbackName || 'Unknown Patient';
}

/**
 * Check if patient data has valid TSH ID
 *
 * @param patient - Patient record
 * @returns true if patient has valid TSH ID
 */
export function hasValidTshId(
  patient: UnifiedPatient | SchedulePatientData | null | undefined
): boolean {
  if (!patient) return false;
  return isValidTshIdFormat(patient.tshla_id);
}

/**
 * Development mode warning for incorrect field usage
 * Call this in development to detect if wrong field is being used
 *
 * @param value - The value being used for TSH ID display
 * @param fieldName - Name of field being used
 */
export function warnIfWrongField(value: string | null | undefined, fieldName: string): void {
  if (process.env.NODE_ENV !== 'development') return;

  if (!value) return;

  // Check if 8-digit number is being used (likely patient_id mistake)
  if (/^\d{8}$/.test(value)) {
    console.error('❌❌❌ CRITICAL ERROR ❌❌❌');
    console.error(`Field "${fieldName}" contains 8-digit number: ${value}`);
    console.error('This looks like patient_id, NOT tshla_id!');
    console.error('');
    console.error('FIX:');
    console.error('  ❌ WRONG: patient.patient_id');
    console.error('  ✅ CORRECT: patient.tshla_id');
    console.error('');
    console.error('See: src/utils/patient-id-formatter.ts');
    console.error('See: TSH_ID_FORMAT_FIX.md');
  }

  // Check if formatted TSH ID is NOT being used
  if (!isValidTshIdFormat(value)) {
    console.warn('⚠️ Warning: TSH ID format may be incorrect');
    console.warn(`Value: ${value}`);
    console.warn(`Expected format: "TSH XXX-XXX" (e.g., "TSH 972-918")`);
  }
}
