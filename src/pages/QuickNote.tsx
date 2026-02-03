import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import MedicalDictation from '../components/MedicalDictation';
import PreVisitSummary from '../components/PreVisitSummary';
import { supabase } from '../lib/supabase';
import '../styles/unified-theme.css';

interface AppointmentData {
  id: number;
  patient_name: string;
  patient_phone: string;
  scheduled_date: string;
  start_time: string;
  provider_name: string;
  unified_patient_id: string;
  patient_dob?: string;
  patient_mrn?: string;
}

export default function QuickNote() {
  const [searchParams] = useSearchParams();
  const [appointmentData, setAppointmentData] = useState<AppointmentData | null>(null);
  const [loading, setLoading] = useState(true);

  // Get appointment ID from URL params (passed from schedule)
  const appointmentIdParam = searchParams.get('appointmentId');
  const appointmentId = appointmentIdParam ? parseInt(appointmentIdParam, 10) : null;

  // Load appointment and patient data from database
  useEffect(() => {
    if (appointmentId) {
      loadAppointmentData();
    } else {
      setLoading(false);
    }
  }, [appointmentId]);

  const loadAppointmentData = async () => {
    try {
      const { data, error } = await supabase
        .from('provider_schedules')
        .select(`
          *,
          unified_patients!provider_schedules_unified_patient_id_fkey (
            id,
            patient_id,
            tshla_id,
            mrn,
            date_of_birth,
            phone_primary,
            first_name,
            last_name,
            full_name
          )
        `)
        .eq('id', appointmentId)
        .single();

      if (error) throw error;

      const patient = data.unified_patients;
      setAppointmentData({
        id: data.id,
        patient_name: data.patient_name || patient?.full_name || 'Unknown Patient',
        patient_phone: data.patient_phone || patient?.phone_primary || '',
        scheduled_date: data.scheduled_date,
        start_time: data.start_time,
        provider_name: data.provider_name || data.provider_id,
        unified_patient_id: patient?.id,
        patient_dob: patient?.date_of_birth,
        patient_mrn: patient?.mrn
      });
    } catch (error) {
      console.error('Error loading appointment data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fallback: Read patient data from sessionStorage
  const storedPatient = sessionStorage.getItem('current_patient');
  const patientData = storedPatient ? JSON.parse(storedPatient) : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="unified-card text-center py-12">
          <div className="unified-spinner mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Loading appointment data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Patient Info Header - shows MRN prominently */}
        {appointmentData && (
          <div className="unified-card mb-6 border-l-4 border-teal-500">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-3">{appointmentData.patient_name}</h2>
                <div className="flex items-center gap-4">
                  {appointmentData.patient_mrn && (
                    <span className="px-4 py-2 bg-teal-50 border-2 border-teal-400 text-teal-800 text-sm font-mono font-bold rounded-lg inline-flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Athena MRN: {appointmentData.patient_mrn}
                    </span>
                  )}
                  {appointmentData.patient_dob && (
                    <span className="text-sm text-slate-600 font-medium">
                      DOB: {new Date(appointmentData.patient_dob).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-slate-900 mb-1">
                  {new Date(appointmentData.scheduled_date).toLocaleDateString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </div>
                <div className="text-sm text-slate-600">{appointmentData.start_time}</div>
              </div>
            </div>
          </div>
        )}

        {/* Pre-Visit Summary Section (if appointment ID provided) */}
        {appointmentId && (
          <PreVisitSummary appointmentId={appointmentId} />
        )}

        {/* Medical Dictation Component */}
        <MedicalDictation
          appointmentId={appointmentId}
          appointmentData={appointmentData}
          patientId={appointmentData?.unified_patient_id || patientData?.id}
          preloadPatientData={true}
        />
      </div>
    </div>
  );
}
