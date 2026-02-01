/**
 * Unified Patient Types
 *
 * CRITICAL FIELD USAGE NOTES:
 * ==========================
 *
 * patient_id vs tshla_id - DO NOT CONFUSE THESE!
 *
 * ❌ WRONG: Using patient_id for display
 *    patient_id = "99364924" (8-digit internal ID)
 *    This is ONLY for internal database operations
 *
 * ✅ CORRECT: Using tshla_id for display
 *    tshla_id = "TSH 972-918" (formatted TSH ID)
 *    This is what shows to users in purple
 *
 * REMEMBER: Always use tshla_id for schedule display!
 */

export interface UnifiedPatient {
  // Primary Key
  id: string;  // UUID - database primary key

  // ====================================
  // PATIENT IDENTIFIERS - READ CAREFULLY
  // ====================================

  /**
   * 8-digit internal patient ID (PERMANENT - never changes)
   * @example "99364924"
   *
   * ⚠️ WARNING: DO NOT use this for UI display!
   * This is for internal database operations only.
   *
   * For display, use tshla_id instead!
   */
  patient_id: string;

  /**
   * Formatted TSH ID for display (can be reset by staff)
   * @example "TSH 972-918"
   *
   * ✅ USE THIS for schedule display (purple number)
   * This is the formatted ID that patients and staff see
   *
   * Format: "TSH XXX-XXX" where X is a digit 0-9
   */
  tshla_id: string;

  /**
   * Medical Record Number from external EMR (e.g., Athena)
   * @example "26996854"
   *
   * ✅ USE THIS for MRN display (blue number)
   * This links to external practice management systems
   */
  mrn?: string;

  // ====================================
  // PERSONAL INFORMATION
  // ====================================

  first_name: string;
  last_name: string;
  email?: string;
  phone_primary?: string;
  phone_secondary?: string;
  date_of_birth?: string;
  gender?: 'M' | 'F' | 'Other' | string;

  // ====================================
  // ADDRESS
  // ====================================

  street_address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;

  // ====================================
  // CLINICAL INFO
  // ====================================

  blood_type?: string;
  allergies?: string[];
  medications?: string[];
  medical_conditions?: string[];

  // ====================================
  // INSURANCE
  // ====================================

  insurance_provider?: string;
  insurance_member_id?: string;
  insurance_group_number?: string;

  // ====================================
  // EMERGENCY CONTACT
  // ====================================

  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;

  // ====================================
  // ACCOUNT STATUS
  // ====================================

  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_visit_date?: string;

  // ====================================
  // PREFERENCES
  // ====================================

  preferred_language?: string;
  communication_preference?: 'email' | 'sms' | 'phone' | 'portal';
  timezone?: string;

  // ====================================
  // PORTAL ACCESS
  // ====================================

  portal_access_enabled?: boolean;
  last_portal_login?: string;
}

/**
 * Type for patient data as it comes from Supabase joins in schedule queries
 */
export interface SchedulePatientData {
  patient_id: string;
  tshla_id: string;
  mrn?: string;
  first_name?: string;
  last_name?: string;
  phone_primary?: string;
  email?: string;
  date_of_birth?: string;
  gender?: string;
}

/**
 * Helper type for schedule appointment display
 * This ensures we always use the correct fields
 */
export interface SchedulePatientIds {
  /**
   * Formatted TSH ID for display
   * @example "TSH 972-918"
   */
  tsh_id: string | null;

  /**
   * Medical Record Number for display
   * @example "26996854"
   */
  mrn: string | null;

  /**
   * 8-digit internal ID (typically not displayed)
   * @example "99364924"
   */
  internal_id: string | null;
}

/**
 * Validation regex patterns for patient IDs
 */
export const PATIENT_ID_PATTERNS = {
  /**
   * 8-digit patient_id format
   * @example "99364924"
   */
  PATIENT_ID: /^\d{8}$/,

  /**
   * Formatted TSH ID format
   * @example "TSH 972-918"
   */
  TSH_ID: /^TSH \d{3}-\d{3}$/,

  /**
   * MRN can be variable (from external systems)
   * Usually numeric but may have letters
   */
  MRN: /^[A-Z0-9]+$/i,
} as const;
