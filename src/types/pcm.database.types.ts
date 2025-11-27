/**
 * PCM (Principal Care Management) Database Types
 * TypeScript definitions matching Supabase schema
 * Created: 2025-01-26
 */

// =====================================================
// CORE PCM TYPES
// =====================================================

export type RiskLevel = 'high' | 'medium' | 'low';
export type ContactType = 'phone_call' | 'video_call' | 'in_person' | 'secure_message' | 'other';
export type ContactOutcome = 'completed' | 'no_answer' | 'voicemail' | 'rescheduled' | 'cancelled';
export type VitalRecordedBy = 'patient' | 'staff' | 'device' | 'import';
export type MealContext = 'before_meal' | 'after_meal' | 'bedtime' | 'fasting' | 'random';
export type TaskCategory = 'vitals' | 'medication' | 'exercise' | 'nutrition' | 'screening' | 'appointment' | 'lab' | 'education' | 'other';
export type TaskFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'one_time';
export type Priority = 'high' | 'medium' | 'low';
export type ActivityType = 'phone_call' | 'care_coordination' | 'med_review' | 'lab_review' | 'documentation' | 'education' | 'referral' | 'other';
export type LabOrderStatus = 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type LabPriority = 'routine' | 'urgent' | 'stat';
export type LabOrderSource = 'manual' | 'ai_extraction' | 'protocol' | 'scheduled' | 'standing_order';
export type GoalType = 'a1c' | 'weight' | 'bp_systolic' | 'bp_diastolic' | 'medication_adherence' | 'exercise' | 'nutrition' | 'blood_sugar' | 'other';
export type GoalStatus = 'active' | 'achieved' | 'not_achieved' | 'modified' | 'cancelled';

// =====================================================
// DATABASE TABLE INTERFACES
// =====================================================

export interface PCMEnrollment {
  id: string;
  patient_id: string;
  enrolled_by: string | null;
  enrolled_date: string;

  // Risk Management
  risk_level: RiskLevel;
  risk_score: number | null;
  risk_factors: Record<string, any>;

  // Clinical Information
  primary_diagnoses: Array<{
    code: string;
    description: string;
  }>;
  comorbidities: Array<{
    code: string;
    description: string;
  }>;

  // Current Vitals & Targets
  current_a1c: number | null;
  target_a1c: number;
  current_bp: string | null;
  target_bp: string;
  current_weight: number | null;
  target_weight: number | null;

  // Medications
  medication_list: Array<{
    name: string;
    dosage: string;
    frequency: string;
    adherence?: number;
  }>;
  medication_adherence_pct: number;

  // PCM Program Requirements
  monthly_time_requirement: number;
  contact_frequency: string;
  next_contact_due: string | null;
  last_contact_date: string | null;

  // Goals & Care Plan
  patient_goals: Array<any>;
  care_plan_url: string | null;
  care_plan_version: number;

  // Status
  is_active: boolean;
  disenrolled_date: string | null;
  disenrollment_reason: string | null;

  // Compliance Tracking
  appointment_adherence_pct: number;
  vitals_logging_frequency: string;
  missed_appointments: number;

  // Contact Information
  phone: string | null;
  email: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;

  // Metadata
  created_at: string;
  updated_at: string;
}

export interface PCMContact {
  id: string;
  patient_id: string;
  enrollment_id: string;
  staff_id: string | null;
  staff_name: string;

  // Contact Details
  contact_date: string;
  contact_type: ContactType;
  duration_minutes: number | null;

  // Outcome
  outcome: ContactOutcome;
  notes: string;

  // Clinical Data
  vitals_recorded: {
    bp?: string;
    weight?: number;
    bg?: number;
    [key: string]: any;
  };
  symptoms_reported: string[];
  medication_changes: Array<{
    medication: string;
    change_type: 'added' | 'removed' | 'dosage_changed' | 'frequency_changed';
    details: string;
  }>;
  patient_concerns: string[];

  // Follow-up
  follow_up_needed: boolean;
  follow_up_date: string | null;
  follow_up_reason: string | null;

  // Billing
  billable: boolean;
  billed: boolean;
  billing_date: string | null;
  billing_code: string | null;
  billing_units: number;

  // Quality
  patient_satisfaction_score: number | null;
  call_quality_notes: string | null;

  // Metadata
  created_at: string;
  updated_at: string;
}

export interface PCMVital {
  id: string;
  patient_id: string;
  enrollment_id: string;

  // Reading Details
  reading_date: string;
  recorded_by: VitalRecordedBy;
  source_device: string | null;

  // Vital Signs
  blood_sugar: number | null;
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  heart_rate: number | null;
  weight: number | null;
  weight_unit: string;
  temperature: number | null;
  temperature_unit: string;
  oxygen_saturation: number | null;

  // Diabetes-Specific
  insulin_dose: number | null;
  insulin_type: string | null;
  carbs_consumed: number | null;
  meal_context: MealContext | null;

  // Exercise
  exercise_minutes: number | null;
  exercise_type: string | null;
  steps_count: number | null;

  // Flags
  is_abnormal: boolean;
  abnormal_reason: string | null;
  abnormal_fields: string[];
  staff_notified: boolean;
  staff_notified_at: string | null;

  // Patient Context
  patient_notes: string | null;
  symptoms: string | null;
  feeling_score: number | null;

  // Metadata
  created_at: string;
}

export interface PCMTask {
  id: string;
  patient_id: string;
  enrollment_id: string;
  assigned_to: string | null;
  assigned_by: string | null;

  // Task Details
  title: string;
  description: string | null;
  category: TaskCategory;

  // Frequency
  frequency: TaskFrequency | null;
  recurrence_rule: string | null;
  starts_on: string | null;
  ends_on: string | null;

  // Completion
  is_completed: boolean;
  completed_date: string | null;
  completed_by: string | null;
  completion_notes: string | null;
  completion_evidence: Record<string, any> | null;

  // Reminders
  reminder_enabled: boolean;
  reminder_days_before: number;
  last_reminder_sent: string | null;
  reminder_count: number;

  // Due Date & Priority
  due_date: string | null;
  is_overdue: boolean; // Generated field
  priority: Priority;
  urgency_score: number;

  // Patient Compliance
  patient_acknowledged: boolean;
  patient_acknowledged_at: string | null;
  skip_reason: string | null;

  // Metadata
  created_at: string;
  updated_at: string;
}

export interface PCMTimeEntry {
  id: string;
  patient_id: string;
  enrollment_id: string;
  staff_id: string;
  staff_name: string;

  // Time Details
  activity_type: ActivityType;
  activity_description: string | null;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;

  // Billing
  billing_month: string; // YYYY-MM
  related_contact_id: string | null;
  related_task_id: string | null;

  // Billing Status
  billable: boolean;
  billed: boolean;
  billing_date: string | null;
  billing_code: string | null;

  // Quality
  notes: string | null;
  documented_in_ehr: boolean;
  supervised: boolean;
  supervisor_id: string | null;

  // Metadata
  created_at: string;
}

export interface PCMLabOrder {
  id: string;
  patient_id: string;
  enrollment_id: string;
  ordered_by: string;
  ordered_by_name: string;

  // Order Details
  order_date: string;
  due_date: string;
  status: LabOrderStatus;

  // Tests
  tests_requested: string[];
  panel_type: string | null;
  panel_description: string | null;

  // Priority
  priority: LabPriority;
  urgency_level: number;
  urgency_reason: string | null;

  // Source
  order_source: LabOrderSource;
  order_text: string | null;
  extraction_confidence: number | null;
  requires_verification: boolean;
  verified: boolean;
  verified_by: string | null;
  verified_at: string | null;

  // Results
  results_received: boolean;
  results_date: string | null;
  results_data: Array<{
    test: string;
    value: number | string;
    unit: string;
    range: string;
    abnormal: boolean;
  }>;
  abnormal_flags: string[];
  critical_flags: string[];

  // Provider Review
  reviewed: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;

  // Actions
  action_required: boolean;
  action_taken: string | null;
  action_plan: Record<string, any> | null;
  follow_up_needed: boolean;
  follow_up_date: string | null;

  // External Integration
  external_order_id: string | null;
  lab_vendor: string | null;
  tracking_number: string | null;

  // Patient Instructions
  fasting_required: boolean;
  special_instructions: string | null;
  patient_notified: boolean;
  patient_notified_at: string | null;

  // Metadata
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PCMGoal {
  id: string;
  patient_id: string;
  enrollment_id: string;

  // Goal Details
  goal_type: GoalType;
  goal_title: string;
  goal_description: string | null;

  // Target Values
  baseline_value: number | null;
  baseline_unit: string | null;
  target_value: number;
  target_unit: string;
  current_value: number | null;

  // Timeline
  start_date: string;
  target_date: string;
  achieved_date: string | null;

  // Progress
  status: GoalStatus;
  progress_pct: number;

  // Milestones
  milestones: Array<{
    date: string;
    value: number;
    notes: string;
  }>;

  // Support
  support_strategies: string[];
  barriers_identified: string[];

  // Metadata
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// =====================================================
// INPUT / CREATE TYPES
// =====================================================

export interface CreatePCMEnrollmentInput {
  patient_id: string;
  enrolled_by?: string;
  risk_level?: RiskLevel;
  primary_diagnoses?: Array<{ code: string; description: string }>;
  comorbidities?: Array<{ code: string; description: string }>;
  current_a1c?: number;
  target_a1c?: number;
  current_bp?: string;
  target_bp?: string;
  current_weight?: number;
  target_weight?: number;
  medication_list?: Array<{ name: string; dosage: string; frequency: string }>;
  phone?: string;
  email?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
}

export interface CreatePCMContactInput {
  patient_id: string;
  enrollment_id: string;
  staff_id?: string;
  staff_name: string;
  contact_type: ContactType;
  duration_minutes?: number;
  outcome: ContactOutcome;
  notes: string;
  vitals_recorded?: Record<string, any>;
  symptoms_reported?: string[];
  medication_changes?: Array<any>;
  patient_concerns?: string[];
  follow_up_needed?: boolean;
  follow_up_date?: string;
  follow_up_reason?: string;
}

export interface CreatePCMVitalInput {
  patient_id: string;
  enrollment_id: string;
  recorded_by: VitalRecordedBy;
  source_device?: string;
  blood_sugar?: number;
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  heart_rate?: number;
  weight?: number;
  weight_unit?: string;
  temperature?: number;
  temperature_unit?: string;
  oxygen_saturation?: number;
  insulin_dose?: number;
  insulin_type?: string;
  carbs_consumed?: number;
  meal_context?: MealContext;
  exercise_minutes?: number;
  exercise_type?: string;
  steps_count?: number;
  patient_notes?: string;
  symptoms?: string;
  feeling_score?: number;
}

export interface CreatePCMTaskInput {
  patient_id: string;
  enrollment_id: string;
  assigned_to?: string;
  assigned_by?: string;
  title: string;
  description?: string;
  category: TaskCategory;
  frequency?: TaskFrequency;
  recurrence_rule?: string;
  starts_on?: string;
  ends_on?: string;
  due_date?: string;
  priority?: Priority;
  urgency_score?: number;
  reminder_enabled?: boolean;
  reminder_days_before?: number;
}

export interface CreatePCMTimeEntryInput {
  patient_id: string;
  enrollment_id: string;
  staff_id: string;
  staff_name: string;
  activity_type: ActivityType;
  activity_description?: string;
  start_time: string;
  end_time?: string;
  duration_minutes?: number;
  related_contact_id?: string;
  related_task_id?: string;
  notes?: string;
}

export interface CreatePCMLabOrderInput {
  patient_id: string;
  enrollment_id: string;
  ordered_by: string;
  ordered_by_name: string;
  due_date: string;
  tests_requested: string[];
  panel_type?: string;
  panel_description?: string;
  priority?: LabPriority;
  urgency_level?: number;
  urgency_reason?: string;
  order_source?: LabOrderSource;
  order_text?: string;
  extraction_confidence?: number;
  requires_verification?: boolean;
  fasting_required?: boolean;
  special_instructions?: string;
  notes?: string;
}

export interface CreatePCMGoalInput {
  patient_id: string;
  enrollment_id: string;
  goal_type: GoalType;
  goal_title: string;
  goal_description?: string;
  baseline_value?: number;
  baseline_unit?: string;
  target_value: number;
  target_unit: string;
  current_value?: number;
  start_date?: string;
  target_date: string;
  support_strategies?: string[];
  barriers_identified?: string[];
  created_by?: string;
}

// =====================================================
// UPDATE TYPES
// =====================================================

export interface UpdatePCMEnrollmentInput {
  risk_level?: RiskLevel;
  risk_score?: number;
  current_a1c?: number;
  target_a1c?: number;
  current_bp?: string;
  target_bp?: string;
  current_weight?: number;
  target_weight?: number;
  medication_adherence_pct?: number;
  appointment_adherence_pct?: number;
  missed_appointments?: number;
  next_contact_due?: string;
  last_contact_date?: string;
  is_active?: boolean;
  disenrolled_date?: string;
  disenrollment_reason?: string;
}

export interface UpdatePCMTaskInput {
  is_completed?: boolean;
  completed_date?: string;
  completed_by?: string;
  completion_notes?: string;
  completion_evidence?: Record<string, any>;
  due_date?: string;
  priority?: Priority;
  urgency_score?: number;
  patient_acknowledged?: boolean;
  skip_reason?: string;
}

export interface UpdatePCMLabOrderInput {
  status?: LabOrderStatus;
  verified?: boolean;
  verified_by?: string;
  verified_at?: string;
  results_received?: boolean;
  results_date?: string;
  results_data?: Array<any>;
  abnormal_flags?: string[];
  critical_flags?: string[];
  reviewed?: boolean;
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  action_required?: boolean;
  action_taken?: string;
  follow_up_needed?: boolean;
  follow_up_date?: string;
  patient_notified?: boolean;
}

export interface UpdatePCMGoalInput {
  current_value?: number;
  progress_pct?: number;
  status?: GoalStatus;
  achieved_date?: string;
  milestones?: Array<{ date: string; value: number; notes: string }>;
}

// =====================================================
// QUERY FILTER TYPES
// =====================================================

export interface PCMEnrollmentFilters {
  is_active?: boolean;
  risk_level?: RiskLevel | RiskLevel[];
  next_contact_due_before?: string;
  enrolled_by?: string;
}

export interface PCMContactFilters {
  patient_id?: string;
  staff_id?: string;
  contact_type?: ContactType;
  outcome?: ContactOutcome;
  date_from?: string;
  date_to?: string;
  follow_up_needed?: boolean;
  billed?: boolean;
}

export interface PCMVitalFilters {
  patient_id?: string;
  recorded_by?: VitalRecordedBy;
  date_from?: string;
  date_to?: string;
  is_abnormal?: boolean;
  vital_type?: 'blood_sugar' | 'bp' | 'weight' | 'temperature';
}

export interface PCMTaskFilters {
  patient_id?: string;
  assigned_to?: string;
  category?: TaskCategory;
  is_completed?: boolean;
  is_overdue?: boolean;
  priority?: Priority;
  due_date_before?: string;
}

export interface PCMTimeEntryFilters {
  patient_id?: string;
  staff_id?: string;
  billing_month?: string;
  activity_type?: ActivityType;
  billable?: boolean;
  billed?: boolean;
}

export interface PCMLabOrderFilters {
  patient_id?: string;
  ordered_by?: string;
  status?: LabOrderStatus | LabOrderStatus[];
  priority?: LabPriority;
  requires_verification?: boolean;
  reviewed?: boolean;
  results_received?: boolean;
  abnormal_only?: boolean;
  due_date_before?: string;
}

export interface PCMGoalFilters {
  patient_id?: string;
  goal_type?: GoalType;
  status?: GoalStatus;
  created_by?: string;
}

// =====================================================
// AGGREGATE / SUMMARY TYPES
// =====================================================

export interface PCMPatientSummary {
  enrollment: PCMEnrollment;
  total_contacts_this_month: number;
  total_time_this_month: number;
  pending_labs: number;
  overdue_tasks: number;
  latest_vitals: PCMVital | null;
  latest_contact: PCMContact | null;
  active_goals: number;
  risk_score: number;
  compliance_score: number;
}

export interface PCMBillingReport {
  staff_id: string;
  staff_name: string;
  month: string;
  total_patients: number;
  total_minutes: number;
  billable_minutes: number;
  billed_minutes: number;
  unbilled_minutes: number;
  patients_meeting_threshold: number; // >= 30 minutes
  estimated_revenue: number;
}

export interface PCMQualityMetrics {
  total_patients: number;
  high_risk_patients: number;
  patients_with_overdue_contact: number;
  average_contact_frequency_days: number;
  medication_adherence_avg: number;
  a1c_control_rate: number; // % meeting target
  patients_with_abnormal_vitals: number;
  pending_lab_results: number;
}

export interface VitalTrendPoint {
  date: string;
  value: number;
  abnormal: boolean;
  meal_context?: string;
}

export interface VitalTrend {
  test_name: string;
  unit: string;
  data: VitalTrendPoint[];
  target: number | null;
  latest_value: number | null;
  trend_direction: 'improving' | 'stable' | 'worsening';
}

// =====================================================
// URGENT TASK TYPES (for Priority Queue)
// =====================================================

export interface UrgentTask {
  id: string;
  type: 'lab' | 'call' | 'task' | 'abnormal_vital' | 'ai_summary';
  patient_id: string;
  patient_name: string;
  urgency_score: number; // 0-100
  due_date: string | null;
  description: string;
  source_id: string; // ID of the lab order, task, etc
  metadata: Record<string, any>;
}

// =====================================================
// REALTIME SUBSCRIPTION TYPES
// =====================================================

export interface PCMRealtimeEvent {
  event_type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: any;
  old_record?: any;
}

export type PCMSubscriptionCallback = (event: PCMRealtimeEvent) => void;

// =====================================================
// ERROR TYPES
// =====================================================

export class PCMServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'PCMServiceError';
  }
}

// =====================================================
// UTILITY TYPES
// =====================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
