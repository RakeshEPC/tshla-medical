import { supabase, auditLog, subscribeToChanges } from './client';
import { logError, logWarn, logInfo, logDebug } from '../../services/logger.service';

export interface PreVisitData {
  patient_id: string;
  visit_date: string;
  provider_id?: string;
  chief_complaints?: string[];
  symptom_duration?: string;
  symptom_severity?: number;
  medication_changes?: any;
  allergies_updated?: any;
  lab_requests?: string[];
  self_reported_vitals?: any;
  uploaded_documents?: any[];
  completion_status?: 'in_progress' | 'completed' | 'partial';
  completed_at?: string;
}

export interface Questionnaire {
  patient_id: string;
  visit_date: string;
  questionnaire_type: 'PHQ9' | 'GAD7';
  responses: any;
  score: number;
  severity: string;
}

class PreVisitService {
  // Save or update pre-visit data
  async savePreVisitData(data: PreVisitData) {
    try {
      const { data: result, error } = await supabase
        .from('previsit_data')
        .upsert(
          {
            ...data,
            last_updated: new Date().toISOString(),
            sync_status: 'synced',
          },
          {
            onConflict: 'patient_id,visit_date',
            returning: 'representation',
          }
        )
        .select()
        .single();

      if (error) throw error;

      // Audit log
      await auditLog('SAVE_PREVISIT_DATA', 'previsit_data', result.id, data.patient_id, {
        visit_date: data.visit_date,
      });

      // Notify provider in real-time
      await this.notifyProvider(data.patient_id, data.visit_date, 'previsit_updated');

      return { success: true, data: result };
    } catch (error) {
      logError('App', 'Error message', {});
      return { success: false, error };
    }
  }

  // Save questionnaire response
  async saveQuestionnaire(questionnaire: Questionnaire) {
    try {
      const { data, error } = await supabase
        .from('previsit_questionnaires')
        .upsert(
          {
            ...questionnaire,
            completed_at: new Date().toISOString(),
          },
          {
            onConflict: 'patient_id,visit_date,questionnaire_type',
          }
        )
        .select()
        .single();

      if (error) throw error;

      // Audit log
      await auditLog(
        'SAVE_QUESTIONNAIRE',
        'previsit_questionnaires',
        data.id,
        questionnaire.patient_id,
        { type: questionnaire.questionnaire_type, score: questionnaire.score }
      );

      // Notify provider
      await this.notifyProvider(
        questionnaire.patient_id,
        questionnaire.visit_date,
        `${questionnaire.questionnaire_type}_completed`
      );

      return { success: true, data };
    } catch (error) {
      logError('App', 'Error message', {});
      return { success: false, error };
    }
  }

  // Get all pre-visit data for a patient visit
  async getPreVisitData(patientId: string, visitDate: string) {
    try {
      // Get pre-visit data
      const { data: previsitData, error: previsitError } = await supabase
        .from('previsit_data')
        .select('*')
        .eq('patient_id', patientId)
        .eq('visit_date', visitDate)
        .single();

      // Get questionnaires
      const { data: questionnaires, error: questError } = await supabase
        .from('previsit_questionnaires')
        .select('*')
        .eq('patient_id', patientId)
        .eq('visit_date', visitDate);

      if (previsitError && previsitError.code !== 'PGRST116') throw previsitError;
      if (questError && questError.code !== 'PGRST116') throw questError;

      return {
        success: true,
        data: {
          previsit: previsitData,
          questionnaires: questionnaires || [],
        },
      };
    } catch (error) {
      logError('App', 'Error message', {});
      return { success: false, error };
    }
  }

  // Get compiled data for dictation
  async getCompiledVisitData(patientId: string, visitDate: string) {
    try {
      // Get all pre-visit data
      const previsitResult = await this.getPreVisitData(patientId, visitDate);

      // Get patient info
      const { data: patient } = await supabase
        .from('patients')
        .select('*')
        .eq('patient_id', patientId)
        .single();

      // Get previous visit notes
      const { data: previousNotes } = await supabase
        .from('visit_notes')
        .select('*')
        .eq('patient_id', patientId)
        .lt('visit_date', visitDate)
        .order('visit_date', { ascending: false })
        .limit(3);

      // Compile all data
      const compiledData = {
        patient,
        currentVisit: {
          date: visitDate,
          previsitData: previsitResult.data?.previsit,
          questionnaires: previsitResult.data?.questionnaires,
        },
        previousVisits: previousNotes || [],
        compiledAt: new Date().toISOString(),
      };

      // Format for dictation
      const formattedText = this.formatForDictation(compiledData);

      return {
        success: true,
        data: compiledData,
        formattedText,
      };
    } catch (error) {
      logError('App', 'Error message', {});
      return { success: false, error };
    }
  }

  // Format compiled data for dictation
  private formatForDictation(data: any): string {
    let text = `=== VISIT DATE: ${data.currentVisit.date} ===\n\n`;

    // Patient info
    if (data.patient) {
      text += `PATIENT: ${data.patient.first_name} ${data.patient.last_name}\n`;
      text += `ID: ${data.patient.patient_id} | AVA: ${data.patient.ava_id}\n`;
      text += `DOB: ${data.patient.date_of_birth}\n\n`;
    }

    // Pre-visit data from patient portal
    if (data.currentVisit.previsitData) {
      text += `=== PRE-VISIT INFORMATION (Submitted by Patient) ===\n\n`;

      const pv = data.currentVisit.previsitData;

      if (pv.chief_complaints?.length) {
        text += `CHIEF COMPLAINTS:\n`;
        pv.chief_complaints.forEach((cc: string) => (text += `• ${cc}\n`));
        text += '\n';
      }

      if (pv.symptom_severity) {
        text += `SYMPTOM SEVERITY: ${pv.symptom_severity}/10\n`;
        text += `DURATION: ${pv.symptom_duration || 'Not specified'}\n\n`;
      }

      if (pv.lab_requests?.length) {
        text += `PATIENT REQUESTED LABS:\n`;
        pv.lab_requests.forEach((lab: string) => (text += `• ${lab}\n`));
        text += '\n';
      }
    }

    // Questionnaire results
    if (data.currentVisit.questionnaires?.length) {
      text += `=== SCREENING QUESTIONNAIRES ===\n\n`;

      data.currentVisit.questionnaires.forEach((q: any) => {
        text += `${q.questionnaire_type}: Score ${q.score} - ${q.severity}\n`;

        // Add interpretation
        if (q.questionnaire_type === 'PHQ9' && q.score >= 10) {
          text += `⚠️ Moderate to severe depression - consider treatment adjustment\n`;
        }
        if (q.questionnaire_type === 'GAD7' && q.score >= 10) {
          text += `⚠️ Moderate to severe anxiety - evaluate current management\n`;
        }
        text += '\n';
      });
    }

    // Previous visit summary
    if (data.previousVisits?.length) {
      text += `=== LAST VISIT (${data.previousVisits[0].visit_date}) ===\n\n`;
      if (data.previousVisits[0].processed_soap) {
        const soap = data.previousVisits[0].processed_soap;
        text += `Assessment: ${soap.assessment || 'N/A'}\n`;
        text += `Plan: ${soap.plan || 'N/A'}\n\n`;
      }
    }

    text += `=== TODAY'S ENCOUNTER ===\n\n`;
    text += `[Begin dictation here]\n\n`;

    return text;
  }

  // Send real-time notification to provider
  private async notifyProvider(patientId: string, visitDate: string, type: string) {
    try {
      // Get provider ID (in real app, this would come from context)
      const providerId = 'current_provider';

      const { error } = await supabase.from('notifications').insert({
        recipient_id: providerId,
        sender_id: patientId,
        type,
        title: `Pre-visit update: ${type}`,
        message: `Patient ${patientId} has updated their pre-visit information for ${visitDate}`,
        data: { patientId, visitDate },
      });

      if (error) logError('App', 'Error message', {});
    } catch (err) {
      logError('App', 'Error message', {});
    }
  }

  // Subscribe to real-time updates for a visit
  subscribeToVisitUpdates(patientId: string, visitDate: string, callback: (data: any) => void) {
    // Subscribe to pre-visit data changes
    const previsitChannel = subscribeToChanges(
      'previsit_data',
      { column: 'patient_id', value: patientId },
      payload => {
        if (payload.new?.visit_date === visitDate) {
          callback({ type: 'previsit', data: payload.new });
        }
      }
    );

    // Subscribe to questionnaire changes
    const questChannel = subscribeToChanges(
      'previsit_questionnaires',
      { column: 'patient_id', value: patientId },
      payload => {
        if (payload.new?.visit_date === visitDate) {
          callback({ type: 'questionnaire', data: payload.new });
        }
      }
    );

    // Return cleanup function
    return () => {
      supabase.removeChannel(previsitChannel);
      supabase.removeChannel(questChannel);
    };
  }
}

export const preVisitService = new PreVisitService();
