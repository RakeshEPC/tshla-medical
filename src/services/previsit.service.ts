/**
 * Pre-Visit Service
 * Handles fetching and managing pre-visit call data
 * Created: January 2025
 */

import { supabase } from '../lib/supabase';
import type { PreVisitData } from '../components/previsit/PreVisitSummaryCard';

export interface PreVisitResponse {
  id: string;
  patient_id: string;
  appointment_id: string | null;
  call_completed: boolean;
  call_status: 'completed' | 'no-answer' | 'voicemail' | 'failed' | 'pending';
  call_date: string | null;
  call_duration_seconds: number | null;
  current_medications: string[] | null;
  chief_concerns: string[] | null;
  questions_for_provider: string[] | null;
  lab_status: string | null;
  recent_changes: string | null;
  requires_urgent_callback: boolean;
  risk_flags: string[] | null;
  urgency_level: 'low' | 'medium' | 'high' | 'critical';
  ai_summary: string | null;
  full_transcript: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch pre-visit data for a specific patient
 */
export async function getPreVisitDataByPatientId(
  patientId: string
): Promise<PreVisitData | null> {
  try {
    const { data, error } = await supabase
      .from('previsit_responses')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // No pre-visit data found is not an error
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error fetching pre-visit data:', error);
      return null;
    }

    return mapToPreVisitData(data);
  } catch (error) {
    console.error('Error in getPreVisitDataByPatientId:', error);
    return null;
  }
}

/**
 * Fetch pre-visit data for a specific appointment
 */
export async function getPreVisitDataByAppointmentId(
  appointmentId: string
): Promise<PreVisitData | null> {
  try {
    const { data, error } = await supabase
      .from('previsit_responses')
      .select('*')
      .eq('appointment_id', appointmentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error fetching pre-visit data:', error);
      return null;
    }

    return mapToPreVisitData(data);
  } catch (error) {
    console.error('Error in getPreVisitDataByAppointmentId:', error);
    return null;
  }
}

/**
 * Fetch pre-visit data for multiple patients at once
 */
export async function getPreVisitDataBatch(
  patientIds: string[]
): Promise<Map<string, PreVisitData>> {
  try {
    const { data, error } = await supabase
      .from('previsit_responses')
      .select('*')
      .in('patient_id', patientIds)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching batch pre-visit data:', error);
      return new Map();
    }

    // Create a map with only the most recent entry per patient
    const resultMap = new Map<string, PreVisitData>();

    if (data) {
      for (const item of data) {
        if (!resultMap.has(item.patient_id)) {
          resultMap.set(item.patient_id, mapToPreVisitData(item));
        }
      }
    }

    return resultMap;
  } catch (error) {
    console.error('Error in getPreVisitDataBatch:', error);
    return new Map();
  }
}

/**
 * Get call log for a patient (all attempts)
 */
export async function getCallLog(patientId: string) {
  try {
    const { data, error } = await supabase
      .from('previsit_call_log')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching call log:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getCallLog:', error);
    return [];
  }
}

/**
 * Get analytics for pre-visit calls within a date range
 * Updated to use previsit_call_data table (ElevenLabs integration)
 */
export async function getPreVisitAnalytics(startDate: string, endDate: string) {
  try {
    const { data, error } = await supabase
      .from('previsit_call_data')
      .select('*')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (error) {
      console.error('Error fetching analytics:', error);
      return null;
    }

    // Calculate metrics using correct column names
    const total = data.length;
    const completed = data.filter(d => d.completed_at !== null).length;

    // Check urgency flags array for urgent cases
    const urgent = data.filter(d =>
      d.urgency_flags &&
      Array.isArray(d.urgency_flags) &&
      d.urgency_flags.length > 0
    ).length;

    // Use correct column names: medications, concerns, questions (not current_medications, etc.)
    const withMedications = data.filter(d =>
      d.medications &&
      Array.isArray(d.medications) &&
      d.medications.length > 0
    ).length;

    const withConcerns = data.filter(d =>
      d.concerns &&
      Array.isArray(d.concerns) &&
      d.concerns.length > 0
    ).length;

    const withQuestions = data.filter(d =>
      d.questions &&
      Array.isArray(d.questions) &&
      d.questions.length > 0
    ).length;

    // Derive urgency levels from flags and concerns count
    const urgencyBreakdown = {
      low: data.filter(d =>
        (!d.concerns || d.concerns.length === 0) &&
        (!d.urgency_flags || d.urgency_flags.length === 0)
      ).length,
      medium: data.filter(d =>
        (d.concerns && d.concerns.length > 0 && d.concerns.length <= 2) &&
        (!d.urgency_flags || d.urgency_flags.length === 0)
      ).length,
      high: data.filter(d =>
        (d.concerns && d.concerns.length > 2) ||
        (d.urgency_flags && d.urgency_flags.length > 0)
      ).length,
      critical: data.filter(d =>
        d.urgency_flags &&
        d.urgency_flags.some((flag: string) =>
          flag.includes('critical') || flag.includes('urgent')
        )
      ).length,
    };

    return {
      total,
      completed,
      completionRate: total > 0 ? (completed / total) * 100 : 0,
      urgent,
      urgentRate: total > 0 ? (urgent / total) * 100 : 0,
      withMedications,
      withConcerns,
      withQuestions,
      urgencyBreakdown,
      rawData: data,
    };
  } catch (error) {
    console.error('Error in getPreVisitAnalytics:', error);
    return null;
  }
}

/**
 * Mark a pre-visit response as reviewed by provider
 */
export async function markAsReviewed(responseId: string) {
  try {
    const { error } = await supabase
      .from('previsit_responses')
      .update({
        provider_reviewed: true,
        provider_reviewed_at: new Date().toISOString()
      })
      .eq('id', responseId);

    if (error) {
      console.error('Error marking as reviewed:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in markAsReviewed:', error);
    return false;
  }
}

/**
 * Helper function to map database response to PreVisitData
 */
function mapToPreVisitData(data: any): PreVisitData {
  return {
    id: data.id,
    patient_id: data.patient_id,
    call_completed: data.call_completed,
    call_status: data.call_status || 'pending',
    call_date: data.call_date,
    current_medications: data.current_medications || [],
    chief_concerns: data.chief_concerns || [],
    questions_for_provider: data.questions_for_provider || [],
    lab_status: data.lab_status,
    requires_urgent_callback: data.requires_urgent_callback || false,
    risk_flags: data.risk_flags || [],
    urgency_level: data.urgency_level || 'low',
    ai_summary: data.ai_summary,
    full_transcript: data.full_transcript,
  };
}
