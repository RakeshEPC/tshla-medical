/**
 * TSHLA Medical - Schedule Type Definitions
 * Consolidated types for schedule management and Athena integration
 */

// =============================================
// CORE SCHEDULE TYPES
// =============================================

export interface ProviderScheduleAppointment {
  id: string | number;

  // Provider Information
  provider_id: string;
  provider_name: string;
  provider_specialty?: string;

  // Patient Information
  patient_name: string;
  patient_age?: number;
  patient_gender?: 'M' | 'F' | 'Other' | string;
  patient_dob?: string | Date;
  patient_phone?: string;
  patient_email?: string;
  patient_mrn?: string;

  // Appointment Details
  appointment_type: AppointmentType;
  appointment_title?: string;
  scheduled_date: string | Date;
  start_time: string; // Format: "9:00 AM"
  end_time?: string;
  duration_minutes: number;

  // Clinical Information
  chief_complaint?: string;
  chief_diagnosis?: string;
  visit_reason?: string;
  urgency_level?: UrgencyLevel;

  // Status & Tracking
  status: AppointmentStatus;
  is_telehealth: boolean;
  color_code?: string;

  // Athena Integration
  athena_appointment_id?: string;
  external_patient_id?: string;

  // Import Tracking
  imported_by?: string;
  imported_at?: string | Date;
  import_batch_id?: string;

  // Provider Notes
  provider_notes?: string;

  // Timestamps
  created_at?: string | Date;
  updated_at?: string | Date;
}

export type AppointmentType =
  | 'new-patient'
  | 'follow-up'
  | 'consultation'
  | 'emergency'
  | 'wellness'
  | 'procedure'
  | 'office-visit'
  | 'telehealth'
  | 'block-time'
  | 'break';

export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'checked-in'
  | 'in-progress'
  | 'completed'
  | 'cancelled'
  | 'no-show'
  | 'rescheduled';

export type UrgencyLevel = 'routine' | 'urgent' | 'emergency';

// =============================================
// ATHENA IMPORT TYPES
// =============================================

export interface AthenaScheduleRow {
  // Athena column names (flexible)
  Date?: string;
  'Appt Date'?: string;
  'Appointment Date'?: string;

  Time?: string;
  'Appt Time'?: string;
  'Start Time'?: string;
  'Appt Start Time'?: string;

  'Provider'?: string;
  'Doctor'?: string;
  'Rendering Provider'?: string;
  'Appt Schdlng Prvdr Full Nme'?: string;

  'Patient First Name'?: string;
  'First Name'?: string;
  'Patient Last Name'?: string;
  'Last Name'?: string;

  'Patient Age'?: string | number;
  'Age'?: string | number;
  'Patient DOB'?: string;
  'DOB'?: string;
  'Date of Birth'?: string;

  'Gender'?: string;
  'Patient Gender'?: string;

  'Diagnosis'?: string;
  'DX'?: string;
  'Chief Complaint'?: string;
  'Reason for Visit'?: string;

  'Visit Type'?: string;
  'Appt Type'?: string;
  'Appointment Type'?: string;

  'Duration'?: string | number;
  'Appt Duration'?: string | number;

  'Patient ID'?: string;
  'MRN'?: string;
  'Medical Record Number'?: string;

  'Phone'?: string;
  'Patient Phone'?: string;
  'Mobile'?: string;

  'Email'?: string;
  'Patient Email'?: string;

  // Allow any other columns
  [key: string]: string | number | undefined;
}

export interface ParsedAthenaAppointment {
  // Normalized fields
  date: string;
  time: string;
  providerName: string;
  providerId?: string;
  patientFirstName: string;
  patientLastName: string;
  patientAge?: number;
  patientGender?: string;
  patientDOB?: string;
  patientPhone?: string;
  patientEmail?: string;
  patientMRN?: string;
  diagnosis?: string;
  visitType?: string;
  visitReason?: string;
  duration: number;
  isValid: boolean;
  errors: string[];
  confidence: number; // 0-1
  rawRow: AthenaScheduleRow;
}

export interface ScheduleImportResult {
  success: boolean;
  batchId?: string;
  summary: {
    totalRows: number;
    successful: number;
    duplicates: number;
    failed: number;
  };
  appointments: ProviderScheduleAppointment[];
  errors: ImportError[];
  warnings: string[];
}

export interface ImportError {
  row: number;
  field?: string;
  message: string;
  data?: any;
}

// =============================================
// GROUPED SCHEDULE TYPES
// =============================================

export interface GroupedSchedule {
  date: string;
  providers: ProviderScheduleGroup[];
  totalAppointments: number;
  totalProviders: number;
}

export interface ProviderScheduleGroup {
  providerId: string;
  providerName: string;
  providerSpecialty?: string;
  appointments: ProviderScheduleAppointment[];
  appointmentCount: number;
  completedCount: number;
  scheduledCount: number;
  firstAppointment?: string;
  lastAppointment?: string;
  totalMinutes: number;
}

// =============================================
// SCHEDULE IMPORT LOG
// =============================================

export interface ScheduleImportLog {
  id: string;
  batch_id: string;
  file_name: string;
  file_size: number;
  schedule_date: string | Date;
  total_rows: number;
  successful_imports: number;
  duplicate_skips: number;
  failed_imports: number;
  error_details?: any;
  imported_by_email?: string;
  imported_by_name?: string;
  imported_by_user_id?: string;
  started_at: string | Date;
  completed_at?: string | Date;
  status: 'processing' | 'completed' | 'failed' | 'cancelled';
}

// =============================================
// PROVIDER TYPES
// =============================================

export interface ProviderInfo {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  specialty?: string;
  practice?: string;
  isActive: boolean;
}

// =============================================
// SCHEDULE VIEW FILTERS
// =============================================

export interface ScheduleViewFilters {
  date?: string;
  providerIds?: string[];
  statuses?: AppointmentStatus[];
  appointmentTypes?: AppointmentType[];
  searchQuery?: string;
}

// =============================================
// APPOINTMENT ACTIONS
// =============================================

export interface AppointmentAction {
  type: 'start-dictation' | 'mark-complete' | 'cancel' | 'reschedule' | 'view-chart';
  appointmentId: string | number;
  appointment?: ProviderScheduleAppointment;
}

// =============================================
// API REQUEST/RESPONSE TYPES
// =============================================

export interface CreateAppointmentRequest {
  provider_id: string;
  provider_name: string;
  patient_name: string;
  patient_phone?: string;
  patient_email?: string;
  patient_age?: number;
  patient_gender?: string;
  patient_dob?: string;
  appointment_type: AppointmentType;
  scheduled_date: string;
  start_time: string;
  end_time?: string;
  duration_minutes?: number;
  chief_complaint?: string;
  chief_diagnosis?: string;
  visit_reason?: string;
  urgency_level?: UrgencyLevel;
  is_telehealth?: boolean;
  provider_notes?: string;
}

export interface UpdateAppointmentRequest {
  status?: AppointmentStatus;
  provider_notes?: string;
  chief_diagnosis?: string;
  is_telehealth?: boolean;
}

export interface GetScheduleRequest {
  providerId?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  status?: AppointmentStatus[];
}

export interface ImportScheduleRequest {
  fileData: ParsedAthenaAppointment[];
  scheduleDate: string;
  importedBy: string;
  importedByName?: string;
  importedByUserId?: string;
}

// =============================================
// UTILITY TYPES
// =============================================

export interface TimeSlot {
  time: string;
  hour: number;
  minute: number;
  period: 'AM' | 'PM';
  formattedTime: string; // "9:00 AM"
}

export interface ScheduleStats {
  totalAppointments: number;
  completedAppointments: number;
  scheduledAppointments: number;
  cancelledAppointments: number;
  noShowAppointments: number;
  inProgressAppointments: number;
  totalPatients: number;
  totalProviders: number;
  averageDuration: number;
  totalMinutes: number;
}

// =============================================
// TYPE GUARDS
// =============================================

export function isValidAppointmentStatus(status: string): status is AppointmentStatus {
  return [
    'scheduled',
    'confirmed',
    'checked-in',
    'in-progress',
    'completed',
    'cancelled',
    'no-show',
    'rescheduled',
  ].includes(status);
}

export function isValidAppointmentType(type: string): type is AppointmentType {
  return [
    'new-patient',
    'follow-up',
    'consultation',
    'emergency',
    'wellness',
    'procedure',
    'office-visit',
    'telehealth',
    'block-time',
    'break',
  ].includes(type);
}

export function isValidUrgencyLevel(level: string): level is UrgencyLevel {
  return ['routine', 'urgent', 'emergency'].includes(level);
}

// =============================================
// EXPORT ALL TYPES
// =============================================

export type {
  // Re-export for convenience
  ProviderScheduleAppointment as Appointment,
  ParsedAthenaAppointment as ParsedAppointment,
};
