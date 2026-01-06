import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import MedicalDictation from '../components/MedicalDictation';
import PreVisitSummary from '../components/PreVisitSummary';
import { supabase } from '../lib/supabase';

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading appointment data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Patient Info Header - shows MRN prominently */}
        {appointmentData && (
          <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">{appointmentData.patient_name}</h2>
                <div className="flex items-center gap-3">
                  {appointmentData.patient_mrn && (
                    <span className="px-3 py-1.5 bg-green-50 border-2 border-green-400 text-green-700 text-sm font-mono font-bold rounded-lg">
                      🏥 Athena MRN: {appointmentData.patient_mrn}
                    </span>
                  )}
                  {appointmentData.patient_dob && (
                    <span className="text-sm text-gray-600">
                      DOB: {new Date(appointmentData.patient_dob).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right text-sm text-gray-600">
                <div>📅 {new Date(appointmentData.scheduled_date).toLocaleDateString()}</div>
                <div>🕐 {appointmentData.start_time}</div>
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
