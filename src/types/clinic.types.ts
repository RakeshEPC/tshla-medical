/**
 * Type definitions for clinic workflow system
 * Supports dual ID system (AVA for patient portal, TSH for EMR)
 */

// ===== Core Entities =====

export interface Chart {
  id: string;
  patientId: string;
  avaId: string; // AVA-###-### for patient portal (cross-clinic)
  tshId: string; // TSH-###-### for EMR (clinic-specific)
  clinicId?: string;
  oldNotes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Note {
  id: string;
  patientId: string;
  chartId: string;
  authorId: string;
  authorName?: string;
  authorRole?: 'doctor' | 'nurse' | 'staff';
  body: string;
  oldNotes?: string;
  actionItems?: ActionItems;
  isSigned: boolean;
  signedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Appointment {
  id: string;
  patientId: string;
  chartId?: string;
  providerId?: string;
  providerName?: string;
  startTime: Date;
  endTime: Date;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show';
  notes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// ===== Action Items (Extracted from Notes) =====

export interface MedicationAction {
  action: 'start' | 'continue' | 'stop' | 'increase' | 'decrease' | 'refill';
  drug: string;
  dose?: string;
  frequency?: string;
  instructions?: string;
}

export interface LabAction {
  action: 'order' | 'check';
  tests: string[];
  urgency?: 'routine' | 'urgent' | 'stat';
  notes?: string;
}

export interface ActionItems {
  meds: MedicationAction[];
  labs: LabAction[];
}

export interface ActionItem {
  id: string;
  noteId: string;
  patientId: string;
  chartId: string;
  itemType: 'medication' | 'lab';
  action: string;
  details: MedicationAction | LabAction;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  processedBy?: string;
  processedAt?: Date;
  createdAt: Date;
}

// ===== Audit Logging =====

export interface AuditLog {
  id: number;
  actorId: string;
  actorName?: string;
  actorRole?: string;
  action: AuditAction;
  entityType: 'patient' | 'chart' | 'note' | 'appointment' | 'action_item';
  entityId?: string;
  entityDetails?: Record<string, any>;
  changes?: {
    before?: Record<string, any>;
    after?: Record<string, any>;
  };
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'view'
  | 'sign'
  | 'process'
  | 'login'
  | 'logout';

// ===== User Permissions =====

export interface StaffPermissions {
  canCreatePatients: boolean;
  canEditPatients: boolean;
  canCreateCharts: boolean;
  canViewNotes: boolean;
  canEditNotes: boolean;
  canManageCalendar: boolean;
  canProcessActionItems: boolean;
  canViewAuditLogs: boolean;
}

export interface UserWithPermissions {
  id: string;
  email: string;
  name: string;
  role: 'staff' | 'doctor' | 'nurse' | 'admin';
  permissions: StaffPermissions;
}

// ===== API Request/Response Types =====

export interface CreateChartRequest {
  patientId: string;
  clinicId?: string;
  oldNotes?: string;
}

export interface CreateChartResponse {
  chart: Chart;
  avaId: string;
  tshId: string;
}

export interface CreateNoteRequest {
  patientId: string;
  chartId: string;
  body: string;
  oldNotes?: string;
}

export interface CreateNoteResponse {
  note: Note;
  extractedActions: ActionItems;
}

export interface ExtractActionsRequest {
  noteBody: string;
}

export interface ExtractActionsResponse {
  meds: MedicationAction[];
  labs: LabAction[];
}

export interface CreateAppointmentRequest {
  patientId: string;
  chartId?: string;
  providerId?: string;
  providerName?: string;
  startTime: Date | string;
  endTime: Date | string;
  notes?: string;
}

export interface SearchPatientsRequest {
  query: string;
  searchBy?: 'name' | 'avaId' | 'tshId' | 'email' | 'phone' | 'all';
  clinicId?: string;
  limit?: number;
}

// ===== Workflow States =====

export interface StaffWorkflowState {
  currentPatient?: {
    id: string;
    name: string;
    avaId?: string;
    tshId?: string;
  };
  currentChart?: Chart;
  pendingActionItems: ActionItem[];
  recentActivity: AuditLog[];
}

export interface DoctorWorkflowState {
  currentPatient?: {
    id: string;
    name: string;
    chartId: string;
  };
  currentNote?: Note;
  previousNotes: Note[];
  extractedActions: ActionItems;
}
