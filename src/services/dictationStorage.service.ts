/**
 * Dictation Storage Service
 * Handles saving dictations to Supabase with auto-save functionality
 */

import { supabase } from '../lib/supabase';

export interface DictationData {
  id?: string;
  appointment_id?: number | null;
  patient_id?: string;
  provider_id?: string;
  patient_name?: string;
  patient_dob?: string;
  patient_mrn?: string;
  visit_date?: string;
  visit_type?: string;
  transcription_text?: string;
  final_note?: string;
  status?: 'draft' | 'in_progress' | 'completed' | 'signed';
  diagnosis_codes?: string[];
  procedure_codes?: string[];
  medications_prescribed?: any;
  orders_placed?: any;
}

class DictationStorageService {
  /**
   * Create or update a dictation
   */
  async saveDictation(data: DictationData): Promise<{ success: boolean; id?: string; error?: string }> {
    console.log('💾 [DictationStorage] saveDictation called with:', {
      hasId: !!data.id,
      patientName: data.patient_name,
      appointmentId: data.appointment_id,
      providerId: data.provider_id,
      status: data.status
    });

    try {
      const dictationData: any = {
        appointment_id: data.appointment_id,
        patient_id: data.patient_id,
        provider_id: data.provider_id,
        patient_name: data.patient_name,
        patient_dob: data.patient_dob,
        patient_mrn: data.patient_mrn,
        visit_date: data.visit_date,
        visit_type: data.visit_type,
        transcription_text: data.transcription_text,
        final_note: data.final_note,
        status: data.status || 'draft',
        last_autosave_at: new Date().toISOString(),
        diagnosis_codes: data.diagnosis_codes,
        procedure_codes: data.procedure_codes,
        medications_prescribed: data.medications_prescribed,
        orders_placed: data.orders_placed
      };

      if (data.id) {
        // Update existing dictation
        console.log('🔄 [DictationStorage] Updating existing dictation:', data.id);
        const { data: result, error } = await supabase
          .from('dictations')
          .update(dictationData)
          .eq('id', data.id)
          .select()
          .single();

        if (error) {
          console.error('❌ [DictationStorage] Update error:', error);
          throw error;
        }
        console.log('✅ [DictationStorage] Dictation updated successfully:', result.id);
        return { success: true, id: result.id };
      } else {
        // Create new dictation
        console.log('➕ [DictationStorage] Creating new dictation in "dictations" table');
        const { data: result, error } = await supabase
          .from('dictations')
          .insert([dictationData])
          .select()
          .single();

        if (error) {
          console.error('❌ [DictationStorage] Insert error:', error);
          throw error;
        }
        console.log('✅ [DictationStorage] Dictation created successfully in "dictations" table, ID:', result.id);
        return { success: true, id: result.id };
      }
    } catch (error: any) {
      console.error('❌ [DictationStorage] Error saving dictation:', error);
      console.error('❌ [DictationStorage] Error details:', JSON.stringify(error, null, 2));
      return { success: false, error: error.message };
    }
  }

  /**
   * Load existing dictation for an appointment (excludes deleted)
   */
  async loadDictationByAppointment(appointmentId: number): Promise<DictationData | null> {
    try {
      const { data, error } = await supabase
        .from('dictations')
        .select('*')
        .eq('appointment_id', appointmentId)
        .is('deleted_at', null)  // CRITICAL: Exclude soft-deleted dictations
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error loading dictation:', error);
      return null;
    }
  }

  /**
   * Mark dictation as completed and link to appointment
   */
  async completeDictation(dictationId: string, appointmentId?: number): Promise<{ success: boolean; error?: string }> {
    try {
      // Update dictation status
      const { error: dictationError } = await supabase
        .from('dictations')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', dictationId);

      if (dictationError) throw dictationError;

      // Link dictation to appointment if provided
      if (appointmentId) {
        const { error: scheduleError } = await supabase
          .from('provider_schedules')
          .update({
            dictation_id: dictationId,
            dictation_complete: true,
            dictation_completed_at: new Date().toISOString()
          })
          .eq('id', appointmentId);

        if (scheduleError) throw scheduleError;
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error completing dictation:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all dictations for a provider (excludes deleted)
   */
  async getDictationsForProvider(providerId: string, limit = 50): Promise<DictationData[]> {
    try {
      const { data, error } = await supabase
        .from('dictations')
        .select('*')
        .eq('provider_id', providerId)
        .is('deleted_at', null)  // CRITICAL: Exclude soft-deleted dictations
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading dictations:', error);
      return [];
    }
  }

  /**
   * Auto-save manager - call this every 30 seconds while dictating
   */
  createAutoSaveManager(
    getDictationData: () => DictationData,
    onSaveSuccess: (id: string) => void,
    onSaveError: (error: string) => void,
    intervalMs = 30000
  ) {
    let intervalId: NodeJS.Timeout | null = null;
    let currentDictationId: string | null = null;

    const start = () => {
      intervalId = setInterval(async () => {
        const data = getDictationData();

        // Only auto-save if there's content
        if (!data.transcription_text && !data.final_note) {
          return;
        }

        const result = await this.saveDictation({
          ...data,
          id: currentDictationId || undefined,
          status: 'in_progress'
        });

        if (result.success && result.id) {
          currentDictationId = result.id;
          onSaveSuccess(result.id);
        } else if (result.error) {
          onSaveError(result.error);
        }
      }, intervalMs);
    };

    const stop = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const getCurrentId = () => currentDictationId;

    return { start, stop, getCurrentId };
  }

  /**
   * Soft delete a dictation (mark as deleted, don't remove from database)
   * IMPORTANT: This completely isolates the dictation from all queries
   */
  async deleteDictation(
    dictationId: string,
    providerId: string,
    reason: 'wrong_chart' | 'duplicate' | 'test' | 'other'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🗑️ [DictationStorage] Deleting dictation:', dictationId, 'Reason:', reason);

      // First, verify the dictation exists and is not already deleted
      const { data: existing, error: checkError } = await supabase
        .from('dictated_notes')  // Fixed: Use dictated_notes table
        .select('id, status, patient_name, deleted_at')
        .eq('id', dictationId)
        .single();

      console.log('📋 [DictationStorage] Existing dictation:', existing, 'Error:', checkError);

      if (checkError) throw new Error('Dictation not found');
      if (existing.deleted_at) throw new Error('Dictation already deleted');

      // Cannot delete signed/final notes (safety check)
      if (existing.status === 'signed' || existing.status === 'final') {
        throw new Error('Cannot delete signed or finalized notes');
      }

      // Soft delete: Mark as deleted
      const { error: deleteError } = await supabase
        .from('dictated_notes')  // Fixed: Use dictated_notes table
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by_provider_id: providerId,
          deletion_reason: reason
        })
        .eq('id', dictationId);

      if (deleteError) {
        console.error('❌ [DictationStorage] Delete error:', deleteError);
        throw deleteError;
      }

      console.log('✅ [DictationStorage] Dictation soft-deleted successfully');
      return { success: true };
    } catch (error: any) {
      console.error('❌ [DictationStorage] Error deleting dictation:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get dictation details for verification before delete
   */
  async getDictationForDeletion(dictationId: string): Promise<{
    id: string;
    patient_name: string;
    patient_mrn: string;
    visit_date: string;
    status: string;
  } | null> {
    try {
      const { data, error } = await supabase
        .from('dictated_notes')  // Fixed: Use dictated_notes table
        .select('id, patient_name, patient_mrn, visit_date, status, deleted_at')
        .eq('id', dictationId)
        .is('deleted_at', null)  // Only return if not already deleted
        .single();

      if (error) return null;
      return data;
    } catch (error) {
      console.error('Error loading dictation for deletion:', error);
      return null;
    }
  }
}

export const dictationStorageService = new DictationStorageService();
