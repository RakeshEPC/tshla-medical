import { supabaseService } from './supabase.service';
import type { Patient } from '../lib/supabase';
import { getPatientData as getLocalPatientData, type PatientData } from './patientData.service';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

/**
 * Convert Supabase Patient to PatientData format
 */
const convertPatientToPatientData = (patient: Patient): PatientData => {
  // Get the most recent visit for this patient to get medications and vitals
  const lastVisit = localStorage.getItem(`last-visit-${patient.id}`);
  let visitData: any = {};

  if (lastVisit) {
    try {
      visitData = JSON.parse(localStorage.getItem(lastVisit) || '{}');
    } catch (e) {
      logError('patientData.supabase', 'Error message', {});
    }
  }

  return {
    id: patient.id,
    name: `${patient.first_name} ${patient.last_name}`,
    mrn: patient.mrn,
    dob: patient.date_of_birth,
    diagnosis: visitData.diagnosis || [],
    medications: visitData.medications || [],
    labResults: visitData.labResults || [],
    vitalSigns: visitData.vitals || {
      bp: '120/80',
      hr: '72',
      temp: '98.6°F',
      weight: '150 lbs',
      bmi: '25',
    },
    mentalHealth: visitData.mentalHealth,
  };
};

/**
 * Get patient data from Supabase or fallback to local data
 */
export const getPatientDataWithSupabase = async (
  patientId: string
): Promise<PatientData | undefined> => {
  // First try Supabase if configured
  if (supabaseService.isConfigured()) {
    try {
      const result = await supabaseService.getPatient(patientId);
      if (result.success && result.patient) {
        return convertPatientToPatientData(result.patient);
      }
    } catch (error) {
      logError('patientData.supabase', 'Error message', {});
    }
  }

  // Fallback to local patient data
  return getLocalPatientData(patientId);
};

/**
 * Get all patients from Supabase
 */
export const getAllPatientsFromSupabase = async (): Promise<PatientData[]> => {
  if (supabaseService.isConfigured()) {
    try {
      const result = await supabaseService.getPatients();
      if (result.success && result.patients) {
        return result.patients.map(convertPatientToPatientData);
      }
    } catch (error) {
      logError('patientData.supabase', 'Error message', {});
    }
  }

  // Fallback to local data
  const localPatients: PatientData[] = [];
  const patientIds = [
    '444-444',
    '111-111',
    '222-222',
    '333-333',
    '555-555',
    '666-666',
    '777-777',
    '888-888',
    '999-999',
  ];

  for (const id of patientIds) {
    const patient = getLocalPatientData(id);
    if (patient) {
      localPatients.push(patient);
    }
  }

  return localPatients;
};
