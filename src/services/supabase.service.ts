/**
 * Supabase Service for TSHLA Medical
 * Handles all database operations with HIPAA compliance
 */

import {
  supabase,
  type Doctor,
  type Patient,
  type Visit,
  type Template,
  type Dictation,
  type AuditLog,
} from '../lib/supabase';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

class SupabaseService {
  /**
   * Initialize database schema
   * Run this once to set up tables
   */
  async initializeDatabase() {
    try {
      // This would run the SQL schema
      // In production, run this through Supabase dashboard
      logDebug('supabase', 'Debug message', {});
      return { success: true };
    } catch (error) {
      logError('supabase', 'Error message', {});
      return { success: false, error };
    }
  }

  /**
   * Doctor Authentication
   */
  async doctorLogin(email: string, password: string) {
    try {
      // First try Supabase auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      // Get doctor details
      const { data: doctor, error: doctorError } = await supabase
        .from('doctors')
        .select('*')
        .eq('email', email)
        .single();

      if (doctorError) throw doctorError;

      // Log audit
      await this.logAudit(doctor.id, 'LOGIN', 'doctor', doctor.id);

      return { success: true, doctor, session: authData.session };
    } catch (error) {
      logError('supabase', 'Error message', {});
      return { success: false, error };
    }
  }

  async doctorLoginByCode(code: string) {
    try {
      const { data: doctor, error } = await supabase
        .from('doctors')
        .select('*')
        .eq('verification_code', code)
        .single();

      if (error) throw error;

      // Create session token
      // In production, implement proper JWT
      const session = {
        doctor_id: doctor.id,
        token: btoa(JSON.stringify({ doctor_id: doctor.id, timestamp: Date.now() })),
      };

      await this.logAudit(doctor.id, 'LOGIN_BY_CODE', 'doctor', doctor.id);

      return { success: true, doctor, session };
    } catch (error) {
      logError('supabase', 'Error message', {});
      return { success: false, error };
    }
  }

  /**
   * Patient Management
   */
  async getPatients() {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('last_name', { ascending: true });

      if (error) throw error;
      return { success: true, patients: data };
    } catch (error) {
      logError('supabase', 'Error message', {});
      return { success: false, error };
    }
  }

  async getPatient(patientId: string) {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single();

      if (error) throw error;
      return { success: true, patient: data };
    } catch (error) {
      logError('supabase', 'Error message', {});
      return { success: false, error };
    }
  }

  async createPatient(patient: Omit<Patient, 'id' | 'created_at' | 'updated_at'>) {
    try {
      const { data, error } = await supabase.from('patients').insert(patient).select().single();

      if (error) throw error;

      await this.logAudit(null, 'CREATE_PATIENT', 'patient', data.id, {
        patient_name: `${patient.first_name} ${patient.last_name}`,
      });

      return { success: true, patient: data };
    } catch (error) {
      logError('supabase', 'Error message', {});
      return { success: false, error };
    }
  }

  /**
   * Visit Management
   */
  async getVisits(patientId?: string) {
    try {
      let query = supabase
        .from('visits')
        .select(
          `
          *,
          patient:patients(*),
          doctor:doctors(*)
        `
        )
        .order('visit_date', { ascending: false });

      if (patientId) {
        query = query.eq('patient_id', patientId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { success: true, visits: data };
    } catch (error) {
      logError('supabase', 'Error message', {});
      return { success: false, error };
    }
  }

  async createVisit(visit: Omit<Visit, 'id' | 'created_at' | 'updated_at'>) {
    try {
      const { data, error } = await supabase.from('visits').insert(visit).select().single();

      if (error) throw error;

      await this.logAudit(
        visit.doctor_id,
        'CREATE_VISIT',
        'visit',
        data.id,
        { patient_id: visit.patient_id },
        true
      );

      return { success: true, visit: data };
    } catch (error) {
      logError('supabase', 'Error message', {});
      return { success: false, error };
    }
  }

  async updateVisit(visitId: string, updates: Partial<Visit>) {
    try {
      const { data, error } = await supabase
        .from('visits')
        .update(updates)
        .eq('id', visitId)
        .select()
        .single();

      if (error) throw error;

      await this.logAudit(null, 'UPDATE_VISIT', 'visit', visitId, { updates }, true);

      return { success: true, visit: data };
    } catch (error) {
      logError('supabase', 'Error message', {});
      return { success: false, error };
    }
  }

  /**
   * Template Management
   */
  async getTemplates() {
    try {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .order('usage_count', { ascending: false });

      if (error) throw error;
      return { success: true, templates: data };
    } catch (error) {
      logError('supabase', 'Error message', {});
      return { success: false, error };
    }
  }

  async createTemplate(template: Omit<Template, 'id' | 'created_at' | 'updated_at'>) {
    try {
      const { data, error } = await supabase.from('templates').insert(template).select().single();

      if (error) throw error;
      return { success: true, template: data };
    } catch (error) {
      logError('supabase', 'Error message', {});
      return { success: false, error };
    }
  }

  async updateTemplateUsage(templateId: string) {
    try {
      const { data: template } = await supabase
        .from('templates')
        .select('usage_count')
        .eq('id', templateId)
        .single();

      if (template) {
        await supabase
          .from('templates')
          .update({ usage_count: (template.usage_count || 0) + 1 })
          .eq('id', templateId);
      }
    } catch (error) {
      logError('supabase', 'Error message', {});
    }
  }

  /**
   * Dictation Management
   */
  async saveDictation(dictation: Omit<Dictation, 'id' | 'created_at'>) {
    try {
      const { data, error } = await supabase.from('dictations').insert(dictation).select().single();

      if (error) throw error;

      await this.logAudit(
        dictation.doctor_id,
        'CREATE_DICTATION',
        'dictation',
        data.id,
        { visit_id: dictation.visit_id },
        true
      );

      return { success: true, dictation: data };
    } catch (error) {
      logError('supabase', 'Error message', {});
      return { success: false, error };
    }
  }

  /**
   * Audit Logging (HIPAA Requirement)
   */
  async logAudit(
    userId: string | null,
    action: string,
    resourceType?: string,
    resourceId?: string,
    details?: any,
    phiAccessed: boolean = false
  ) {
    try {
      const auditLog: Omit<AuditLog, 'id' | 'created_at'> = {
        user_id: userId || 'system',
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        details,
        phi_accessed: phiAccessed,
        ip_address: 'client', // In production, get real IP
        user_agent: navigator.userAgent,
      };

      await supabase.from('audit_logs').insert(auditLog);
    } catch (error) {
      logError('supabase', 'Error message', {});
      // Don't throw - audit failures shouldn't break operations
    }
  }

  /**
   * Real-time subscriptions
   */
  subscribeToVisits(callback: (payload: any) => void) {
    return supabase
      .channel('visits-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, callback)
      .subscribe();
  }

  subscribeToDictations(visitId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`dictation-${visitId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dictations', filter: `visit_id=eq.${visitId}` },
        callback
      )
      .subscribe();
  }

  /**
   * Check if Supabase is configured
   */
  isConfigured(): boolean {
    return !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;
  }
}

// Singleton instance
export const supabaseService = new SupabaseService();
