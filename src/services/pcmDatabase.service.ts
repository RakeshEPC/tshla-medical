/**
 * PCM Database Service
 * Supabase-backed service for Principal Care Management
 * Replaces localStorage-based pcm.service.ts
 * Created: 2025-01-26
 */

import { supabase } from '../lib/supabase';
import type {
  PCMEnrollment,
  PCMContact,
  PCMVital,
  PCMTask,
  PCMTimeEntry,
  PCMLabOrder,
  PCMGoal,
  CreatePCMEnrollmentInput,
  CreatePCMContactInput,
  CreatePCMVitalInput,
  CreatePCMTaskInput,
  CreatePCMTimeEntryInput,
  CreatePCMLabOrderInput,
  CreatePCMGoalInput,
  UpdatePCMEnrollmentInput,
  UpdatePCMTaskInput,
  UpdatePCMLabOrderInput,
  UpdatePCMGoalInput,
  PCMEnrollmentFilters,
  PCMContactFilters,
  PCMVitalFilters,
  PCMTaskFilters,
  PCMTimeEntryFilters,
  PCMLabOrderFilters,
  PCMGoalFilters,
  PCMPatientSummary,
  PCMBillingReport,
  PCMQualityMetrics,
  VitalTrend,
  VitalTrendPoint,
  UrgentTask,
  PCMRealtimeEvent,
  PCMSubscriptionCallback,
  PCMServiceError,
  RiskLevel,
  LabOrderSource
} from '../types/pcm.database.types';
import type { OrderExtractionResult } from './orderExtraction.service';

class PCMDatabaseService {
  private subscriptions: Map<string, any> = new Map();

  // =====================================================
  // ENROLLMENT MANAGEMENT
  // =====================================================

  /**
   * Enroll a patient in PCM program
   */
  async enrollPatient(data: CreatePCMEnrollmentInput): Promise<PCMEnrollment> {
    try {
      const { data: enrollment, error } = await supabase
        .from('pcm_enrollments')
        .insert({
          ...data,
          enrolled_date: new Date().toISOString(),
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;
      return enrollment as PCMEnrollment;
    } catch (error) {
      throw new PCMServiceError(
        'Failed to enroll patient in PCM',
        'ENROLLMENT_CREATE_ERROR',
        error
      );
    }
  }

  /**
   * Get PCM enrollment for a patient
   */
  async getPCMEnrollment(patientId: string): Promise<PCMEnrollment | null> {
    try {
      const { data, error } = await supabase
        .from('pcm_enrollments')
        .select('*')
        .eq('patient_id', patientId)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
      return data as PCMEnrollment | null;
    } catch (error) {
      throw new PCMServiceError(
        'Failed to get PCM enrollment',
        'ENROLLMENT_FETCH_ERROR',
        error
      );
    }
  }

  /**
   * Get all active PCM enrollments with optional filters
   */
  async getPCMEnrollments(filters?: PCMEnrollmentFilters): Promise<PCMEnrollment[]> {
    try {
      let query = supabase
        .from('pcm_enrollments')
        .select('*')
        .order('risk_score', { ascending: false });

      if (filters?.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active);
      }

      if (filters?.risk_level) {
        if (Array.isArray(filters.risk_level)) {
          query = query.in('risk_level', filters.risk_level);
        } else {
          query = query.eq('risk_level', filters.risk_level);
        }
      }

      if (filters?.next_contact_due_before) {
        query = query.lte('next_contact_due', filters.next_contact_due_before);
      }

      if (filters?.enrolled_by) {
        query = query.eq('enrolled_by', filters.enrolled_by);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data as PCMEnrollment[]) || [];
    } catch (error) {
      throw new PCMServiceError(
        'Failed to get PCM enrollments',
        'ENROLLMENTS_FETCH_ERROR',
        error
      );
    }
  }

  /**
   * Update PCM enrollment
   */
  async updatePCMEnrollment(
    enrollmentId: string,
    updates: UpdatePCMEnrollmentInput
  ): Promise<PCMEnrollment> {
    try {
      const { data, error } = await supabase
        .from('pcm_enrollments')
        .update(updates)
        .eq('id', enrollmentId)
        .select()
        .single();

      if (error) throw error;
      return data as PCMEnrollment;
    } catch (error) {
      throw new PCMServiceError(
        'Failed to update PCM enrollment',
        'ENROLLMENT_UPDATE_ERROR',
        error
      );
    }
  }

  /**
   * Calculate risk score for a patient
   * (This is also done by database trigger, but can be called manually)
   */
  async calculateRiskScore(enrollmentId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .rpc('calculate_pcm_risk_score', { enrollment_id: enrollmentId });

      if (error) throw error;
      return data as number;
    } catch (error) {
      console.warn('Risk score calculation failed, using default', error);
      return 50; // Default medium risk
    }
  }

  // =====================================================
  // CONTACT MANAGEMENT
  // =====================================================

  /**
   * Log a patient contact
   */
  async logContact(data: CreatePCMContactInput): Promise<PCMContact> {
    try {
      const { data: contact, error } = await supabase
        .from('pcm_contacts')
        .insert({
          ...data,
          contact_date: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // Update enrollment's last contact date
      await this.updatePCMEnrollment(data.enrollment_id, {
        last_contact_date: new Date().toISOString(),
        next_contact_due: this.calculateNextContactDue(new Date(), 30) // 30 days from now
      });

      return contact as PCMContact;
    } catch (error) {
      throw new PCMServiceError(
        'Failed to log patient contact',
        'CONTACT_CREATE_ERROR',
        error
      );
    }
  }

  /**
   * Get contact history for a patient
   */
  async getContactHistory(patientId: string, limit = 50): Promise<PCMContact[]> {
    try {
      const { data, error } = await supabase
        .from('pcm_contacts')
        .select('*')
        .eq('patient_id', patientId)
        .order('contact_date', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data as PCMContact[]) || [];
    } catch (error) {
      throw new PCMServiceError(
        'Failed to get contact history',
        'CONTACTS_FETCH_ERROR',
        error
      );
    }
  }

  /**
   * Get contacts with filters
   */
  async getContacts(filters?: PCMContactFilters): Promise<PCMContact[]> {
    try {
      let query = supabase
        .from('pcm_contacts')
        .select('*')
        .order('contact_date', { ascending: false });

      if (filters?.patient_id) {
        query = query.eq('patient_id', filters.patient_id);
      }

      if (filters?.staff_id) {
        query = query.eq('staff_id', filters.staff_id);
      }

      if (filters?.contact_type) {
        query = query.eq('contact_type', filters.contact_type);
      }

      if (filters?.outcome) {
        query = query.eq('outcome', filters.outcome);
      }

      if (filters?.date_from) {
        query = query.gte('contact_date', filters.date_from);
      }

      if (filters?.date_to) {
        query = query.lte('contact_date', filters.date_to);
      }

      if (filters?.follow_up_needed !== undefined) {
        query = query.eq('follow_up_needed', filters.follow_up_needed);
      }

      if (filters?.billed !== undefined) {
        query = query.eq('billed', filters.billed);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data as PCMContact[]) || [];
    } catch (error) {
      throw new PCMServiceError(
        'Failed to get contacts',
        'CONTACTS_FETCH_ERROR',
        error
      );
    }
  }

  // =====================================================
  // VITALS TRACKING
  // =====================================================

  /**
   * Record patient vitals
   */
  async recordVitals(data: CreatePCMVitalInput): Promise<PCMVital> {
    try {
      // Check for abnormal values
      const abnormalFields: string[] = [];
      if (data.blood_sugar && (data.blood_sugar < 70 || data.blood_sugar > 180)) {
        abnormalFields.push('blood_sugar');
      }
      if (data.blood_pressure_systolic && data.blood_pressure_systolic > 140) {
        abnormalFields.push('bp_systolic');
      }
      if (data.blood_pressure_diastolic && data.blood_pressure_diastolic > 90) {
        abnormalFields.push('bp_diastolic');
      }

      const { data: vital, error } = await supabase
        .from('pcm_vitals')
        .insert({
          ...data,
          reading_date: new Date().toISOString(),
          is_abnormal: abnormalFields.length > 0,
          abnormal_fields: abnormalFields
        })
        .select()
        .single();

      if (error) throw error;
      return vital as PCMVital;
    } catch (error) {
      throw new PCMServiceError(
        'Failed to record vitals',
        'VITALS_CREATE_ERROR',
        error
      );
    }
  }

  /**
   * Get vital signs for a patient
   */
  async getPatientVitals(patientId: string, limit = 30): Promise<PCMVital[]> {
    try {
      const { data, error } = await supabase
        .from('pcm_vitals')
        .select('*')
        .eq('patient_id', patientId)
        .order('reading_date', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data as PCMVital[]) || [];
    } catch (error) {
      throw new PCMServiceError(
        'Failed to get patient vitals',
        'VITALS_FETCH_ERROR',
        error
      );
    }
  }

  /**
   * Get vital trend data for graphing
   */
  async getVitalTrends(
    patientId: string,
    vitalType: 'blood_sugar' | 'bp_systolic' | 'weight',
    days = 90
  ): Promise<VitalTrend> {
    try {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);

      const { data, error } = await supabase
        .from('pcm_vitals')
        .select('reading_date, blood_sugar, blood_pressure_systolic, weight, is_abnormal, meal_context')
        .eq('patient_id', patientId)
        .gte('reading_date', fromDate.toISOString())
        .order('reading_date', { ascending: true });

      if (error) throw error;

      const vitals = data as PCMVital[];
      const trendData: VitalTrendPoint[] = vitals
        .filter(v => {
          if (vitalType === 'blood_sugar') return v.blood_sugar != null;
          if (vitalType === 'bp_systolic') return v.blood_pressure_systolic != null;
          if (vitalType === 'weight') return v.weight != null;
          return false;
        })
        .map(v => ({
          date: v.reading_date,
          value: vitalType === 'blood_sugar' ? v.blood_sugar! :
                 vitalType === 'bp_systolic' ? v.blood_pressure_systolic! :
                 v.weight!,
          abnormal: v.is_abnormal,
          meal_context: v.meal_context || undefined
        }));

      const latestValue = trendData.length > 0 ? trendData[trendData.length - 1].value : null;

      // Calculate trend direction
      let trendDirection: 'improving' | 'stable' | 'worsening' = 'stable';
      if (trendData.length >= 3) {
        const recent = trendData.slice(-3).map(d => d.value);
        const avg = recent.reduce((sum, v) => sum + v, 0) / recent.length;
        const firstHalf = trendData.slice(0, Math.floor(trendData.length / 2));
        const firstAvg = firstHalf.reduce((sum, d) => sum + d.value, 0) / firstHalf.length;

        if (vitalType === 'blood_sugar' || vitalType === 'bp_systolic') {
          trendDirection = avg < firstAvg ? 'improving' : avg > firstAvg ? 'worsening' : 'stable';
        } else if (vitalType === 'weight') {
          // Weight trend depends on goal
          trendDirection = avg < firstAvg ? 'improving' : avg > firstAvg ? 'worsening' : 'stable';
        }
      }

      return {
        test_name: vitalType.replace('_', ' ').toUpperCase(),
        unit: vitalType === 'blood_sugar' ? 'mg/dL' :
              vitalType === 'bp_systolic' ? 'mmHg' :
              'lbs',
        data: trendData,
        target: vitalType === 'blood_sugar' ? 120 :
                vitalType === 'bp_systolic' ? 130 :
                null,
        latest_value: latestValue,
        trend_direction: trendDirection
      };
    } catch (error) {
      throw new PCMServiceError(
        'Failed to get vital trends',
        'VITAL_TRENDS_ERROR',
        error
      );
    }
  }

  // =====================================================
  // TASK MANAGEMENT
  // =====================================================

  /**
   * Create a patient task
   */
  async createTask(data: CreatePCMTaskInput): Promise<PCMTask> {
    try {
      const { data: task, error } = await supabase
        .from('pcm_tasks')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return task as PCMTask;
    } catch (error) {
      throw new PCMServiceError(
        'Failed to create task',
        'TASK_CREATE_ERROR',
        error
      );
    }
  }

  /**
   * Get patient tasks with filters
   */
  async getPatientTasks(patientId: string, filters?: Partial<PCMTaskFilters>): Promise<PCMTask[]> {
    try {
      let query = supabase
        .from('pcm_tasks')
        .select('*')
        .eq('patient_id', patientId)
        .order('urgency_score', { ascending: false });

      if (filters?.is_completed !== undefined) {
        query = query.eq('is_completed', filters.is_completed);
      }

      if (filters?.is_overdue !== undefined) {
        query = query.eq('is_overdue', filters.is_overdue);
      }

      if (filters?.category) {
        query = query.eq('category', filters.category);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data as PCMTask[]) || [];
    } catch (error) {
      throw new PCMServiceError(
        'Failed to get patient tasks',
        'TASKS_FETCH_ERROR',
        error
      );
    }
  }

  /**
   * Update a task
   */
  async updateTask(taskId: string, updates: UpdatePCMTaskInput): Promise<PCMTask> {
    try {
      const { data, error } = await supabase
        .from('pcm_tasks')
        .update(updates)
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;
      return data as PCMTask;
    } catch (error) {
      throw new PCMServiceError(
        'Failed to update task',
        'TASK_UPDATE_ERROR',
        error
      );
    }
  }

  /**
   * Mark task as complete
   */
  async completeTask(taskId: string, completedBy: string, notes?: string): Promise<PCMTask> {
    return this.updateTask(taskId, {
      is_completed: true,
      completed_date: new Date().toISOString(),
      completed_by: completedBy,
      completion_notes: notes
    });
  }

  // =====================================================
  // TIME TRACKING
  // =====================================================

  /**
   * Start a new time entry
   */
  async startTimeEntry(data: Omit<CreatePCMTimeEntryInput, 'end_time' | 'duration_minutes'>): Promise<string> {
    try {
      const month = new Date(data.start_time).toISOString().substring(0, 7);

      const { data: entry, error } = await supabase
        .from('pcm_time_entries')
        .insert({
          ...data,
          billing_month: month
        })
        .select('id')
        .single();

      if (error) throw error;
      return entry.id;
    } catch (error) {
      throw new PCMServiceError(
        'Failed to start time entry',
        'TIME_ENTRY_START_ERROR',
        error
      );
    }
  }

  /**
   * Stop a time entry
   */
  async stopTimeEntry(entryId: string): Promise<PCMTimeEntry> {
    try {
      const endTime = new Date().toISOString();

      // Get start time
      const { data: existing, error: fetchError } = await supabase
        .from('pcm_time_entries')
        .select('start_time')
        .eq('id', entryId)
        .single();

      if (fetchError) throw fetchError;

      const startTime = new Date(existing.start_time);
      const endTimeDate = new Date(endTime);
      const durationMinutes = Math.round((endTimeDate.getTime() - startTime.getTime()) / 60000);

      const { data, error } = await supabase
        .from('pcm_time_entries')
        .update({
          end_time: endTime,
          duration_minutes: durationMinutes
        })
        .eq('id', entryId)
        .select()
        .single();

      if (error) throw error;
      return data as PCMTimeEntry;
    } catch (error) {
      throw new PCMServiceError(
        'Failed to stop time entry',
        'TIME_ENTRY_STOP_ERROR',
        error
      );
    }
  }

  /**
   * Get monthly time entries for a patient
   */
  async getMonthlyTime(patientId: string, month?: string): Promise<PCMTimeEntry[]> {
    try {
      const targetMonth = month || new Date().toISOString().substring(0, 7);

      const { data, error } = await supabase
        .from('pcm_time_entries')
        .select('*')
        .eq('patient_id', patientId)
        .eq('billing_month', targetMonth)
        .order('start_time', { ascending: false });

      if (error) throw error;
      return (data as PCMTimeEntry[]) || [];
    } catch (error) {
      throw new PCMServiceError(
        'Failed to get monthly time',
        'TIME_ENTRIES_FETCH_ERROR',
        error
      );
    }
  }

  /**
   * Calculate total billable time for a patient this month
   */
  async calculateBillableTime(patientId: string, month?: string): Promise<number> {
    const entries = await this.getMonthlyTime(patientId, month);
    return entries
      .filter(e => e.billable && e.duration_minutes)
      .reduce((sum, e) => sum + e.duration_minutes!, 0);
  }

  // =====================================================
  // LAB ORDER MANAGEMENT
  // =====================================================

  /**
   * Create a lab order
   */
  async createLabOrder(data: CreatePCMLabOrderInput): Promise<PCMLabOrder> {
    try {
      const { data: order, error } = await supabase
        .from('pcm_lab_orders')
        .insert({
          ...data,
          order_date: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return order as PCMLabOrder;
    } catch (error) {
      throw new PCMServiceError(
        'Failed to create lab order',
        'LAB_ORDER_CREATE_ERROR',
        error
      );
    }
  }

  /**
   * Create lab orders from AI extraction (from dictation)
   */
  async createLabOrdersFromExtraction(
    extractedOrders: OrderExtractionResult,
    patientId: string,
    enrollmentId: string,
    providerId: string,
    providerName: string
  ): Promise<{ created: number; orders: PCMLabOrder[] }> {
    try {
      const createdOrders: PCMLabOrder[] = [];

      // Process only lab orders from extraction
      for (const lab of extractedOrders.labs) {
        const dueDate = this.calculateLabDueDate(lab.urgency || 'routine');

        const order = await this.createLabOrder({
          patient_id: patientId,
          enrollment_id: enrollmentId,
          ordered_by: providerId,
          ordered_by_name: providerName,
          due_date: dueDate,
          tests_requested: [lab.text],
          priority: (lab.urgency as LabOrderSource) || 'routine',
          order_source: 'ai_extraction',
          order_text: lab.text,
          extraction_confidence: lab.confidence,
          requires_verification: !lab.confidence || lab.confidence < 0.8
        });

        createdOrders.push(order);
      }

      return {
        created: createdOrders.length,
        orders: createdOrders
      };
    } catch (error) {
      throw new PCMServiceError(
        'Failed to create lab orders from extraction',
        'LAB_EXTRACTION_ERROR',
        error
      );
    }
  }

  /**
   * Get pending lab orders
   */
  async getPendingLabs(staffId?: string): Promise<PCMLabOrder[]> {
    try {
      let query = supabase
        .from('pcm_lab_orders')
        .select('*')
        .in('status', ['pending', 'scheduled'])
        .order('urgency_level', { ascending: false })
        .order('due_date', { ascending: true });

      if (staffId) {
        query = query.eq('ordered_by', staffId);
      }

      const { data, error} = await query;

      if (error) throw error;
      return (data as PCMLabOrder[]) || [];
    } catch (error) {
      throw new PCMServiceError(
        'Failed to get pending labs',
        'LABS_FETCH_ERROR',
        error
      );
    }
  }

  /**
   * Update lab order
   */
  async updateLabOrder(orderId: string, updates: UpdatePCMLabOrderInput): Promise<PCMLabOrder> {
    try {
      const { data, error } = await supabase
        .from('pcm_lab_orders')
        .update(updates)
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw error;
      return data as PCMLabOrder;
    } catch (error) {
      throw new PCMServiceError(
        'Failed to update lab order',
        'LAB_ORDER_UPDATE_ERROR',
        error
      );
    }
  }

  // =====================================================
  // GOALS MANAGEMENT
  // =====================================================

  /**
   * Create a patient goal
   */
  async createGoal(data: CreatePCMGoalInput): Promise<PCMGoal> {
    try {
      const { data: goal, error } = await supabase
        .from('pcm_goals')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return goal as PCMGoal;
    } catch (error) {
      throw new PCMServiceError(
        'Failed to create goal',
        'GOAL_CREATE_ERROR',
        error
      );
    }
  }

  /**
   * Get patient goals
   */
  async getPatientGoals(patientId: string, filters?: Partial<PCMGoalFilters>): Promise<PCMGoal[]> {
    try {
      let query = supabase
        .from('pcm_goals')
        .select('*')
        .eq('patient_id', patientId)
        .order('target_date', { ascending: true });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.goal_type) {
        query = query.eq('goal_type', filters.goal_type);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data as PCMGoal[]) || [];
    } catch (error) {
      throw new PCMServiceError(
        'Failed to get patient goals',
        'GOALS_FETCH_ERROR',
        error
      );
    }
  }

  // =====================================================
  // AGGREGATE / SUMMARY METHODS
  // =====================================================

  /**
   * Get comprehensive patient summary
   */
  async getPatientSummary(patientId: string): Promise<PCMPatientSummary | null> {
    try {
      const enrollment = await this.getPCMEnrollment(patientId);
      if (!enrollment) return null;

      const thisMonth = new Date().toISOString().substring(0, 7);

      const [
        contacts,
        timeEntries,
        pendingLabs,
        tasks,
        vitals,
        goals
      ] = await Promise.all([
        this.getContacts({ patient_id: patientId, date_from: `${thisMonth}-01` }),
        this.getMonthlyTime(patientId, thisMonth),
        this.getPendingLabs(),
        this.getPatientTasks(patientId, { is_overdue: true }),
        this.getPatientVitals(patientId, 1),
        this.getPatientGoals(patientId, { status: 'active' })
      ]);

      const totalTime = timeEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);

      return {
        enrollment,
        total_contacts_this_month: contacts.length,
        total_time_this_month: totalTime,
        pending_labs: pendingLabs.filter(l => l.patient_id === patientId).length,
        overdue_tasks: tasks.length,
        latest_vitals: vitals[0] || null,
        latest_contact: contacts[0] || null,
        active_goals: goals.length,
        risk_score: enrollment.risk_score || 0,
        compliance_score: this.calculateComplianceScore(enrollment, totalTime)
      };
    } catch (error) {
      throw new PCMServiceError(
        'Failed to get patient summary',
        'SUMMARY_FETCH_ERROR',
        error
      );
    }
  }

  /**
   * Get urgent tasks for priority queue
   */
  async getUrgentTasks(staffId?: string): Promise<UrgentTask[]> {
    try {
      const urgentTasks: UrgentTask[] = [];

      // Get STAT and urgent labs
      const labs = await this.getPendingLabs(staffId);
      labs.forEach(lab => {
        if (lab.priority === 'stat' || lab.priority === 'urgent') {
          urgentTasks.push({
            id: `lab-${lab.id}`,
            type: 'lab',
            patient_id: lab.patient_id,
            patient_name: 'Patient', // Would join with patients table
            urgency_score: lab.urgency_level,
            due_date: lab.due_date,
            description: `${lab.priority.toUpperCase()}: ${lab.tests_requested.join(', ')}`,
            source_id: lab.id,
            metadata: lab
          });
        }
      });

      // Get overdue tasks
      const { data: overdueTasks, error: tasksError } = await supabase
        .from('pcm_tasks')
        .select('*')
        .eq('is_overdue', true)
        .limit(50);

      if (!tasksError && overdueTasks) {
        overdueTasks.forEach((task: PCMTask) => {
          urgentTasks.push({
            id: `task-${task.id}`,
            type: 'task',
            patient_id: task.patient_id,
            patient_name: 'Patient',
            urgency_score: task.urgency_score,
            due_date: task.due_date,
            description: task.title,
            source_id: task.id,
            metadata: task
          });
        });
      }

      // Sort by urgency score
      urgentTasks.sort((a, b) => b.urgency_score - a.urgency_score);

      return urgentTasks;
    } catch (error) {
      throw new PCMServiceError(
        'Failed to get urgent tasks',
        'URGENT_TASKS_ERROR',
        error
      );
    }
  }

  // =====================================================
  // REALTIME SUBSCRIPTIONS
  // =====================================================

  /**
   * Subscribe to abnormal vitals
   */
  subscribeToAbnormalVitals(callback: (vital: PCMVital) => void): string {
    const channel = supabase
      .channel('abnormal-vitals')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pcm_vitals',
          filter: 'is_abnormal=eq.true'
        },
        (payload) => {
          callback(payload.new as PCMVital);
        }
      )
      .subscribe();

    const subscriptionId = `abnormal-vitals-${Date.now()}`;
    this.subscriptions.set(subscriptionId, channel);
    return subscriptionId;
  }

  /**
   * Subscribe to urgent lab orders
   */
  subscribeToUrgentLabs(callback: (lab: PCMLabOrder) => void): string {
    const channel = supabase
      .channel('urgent-labs')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pcm_lab_orders',
          filter: 'priority=in.(stat,urgent)'
        },
        (payload) => {
          callback(payload.new as PCMLabOrder);
        }
      )
      .subscribe();

    const subscriptionId = `urgent-labs-${Date.now()}`;
    this.subscriptions.set(subscriptionId, channel);
    return subscriptionId;
  }

  /**
   * Unsubscribe from a specific subscription
   */
  unsubscribe(subscriptionId: string): void {
    const channel = this.subscriptions.get(subscriptionId);
    if (channel) {
      supabase.removeChannel(channel);
      this.subscriptions.delete(subscriptionId);
    }
  }

  /**
   * Unsubscribe from all subscriptions
   */
  unsubscribeAll(): void {
    this.subscriptions.forEach((channel) => {
      supabase.removeChannel(channel);
    });
    this.subscriptions.clear();
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  private calculateNextContactDue(fromDate: Date, days: number): string {
    const nextDate = new Date(fromDate);
    nextDate.setDate(nextDate.getDate() + days);
    return nextDate.toISOString().split('T')[0];
  }

  private calculateLabDueDate(urgency: string): string {
    const today = new Date();
    let daysToAdd = 7; // Default: routine = 7 days

    switch (urgency) {
      case 'stat':
        daysToAdd = 1;
        break;
      case 'urgent':
        daysToAdd = 3;
        break;
      case 'routine':
        daysToAdd = 7;
        break;
    }

    today.setDate(today.getDate() + daysToAdd);
    return today.toISOString().split('T')[0];
  }

  private calculateComplianceScore(enrollment: PCMEnrollment, monthlyTime: number): number {
    let score = 0;

    // Time requirement (40%)
    if (monthlyTime >= enrollment.monthly_time_requirement) {
      score += 40;
    } else {
      score += (monthlyTime / enrollment.monthly_time_requirement) * 40;
    }

    // Medication adherence (30%)
    score += (enrollment.medication_adherence_pct / 100) * 30;

    // Appointment adherence (20%)
    score += (enrollment.appointment_adherence_pct / 100) * 20;

    // No missed appointments bonus (10%)
    if (enrollment.missed_appointments === 0) {
      score += 10;
    }

    return Math.round(score);
  }
}

// Export singleton instance
export const pcmDatabaseService = new PCMDatabaseService();
