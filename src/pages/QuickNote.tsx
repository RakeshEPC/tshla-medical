import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import MedicalDictation from '../components/MedicalDictation';
import MicroDictation from '../components/MicroDictation';
import PreVisitSummary from '../components/PreVisitSummary';
import { supabase } from '../lib/supabase';
import '../styles/unified-theme.css';
import { formatDOB } from '../utils/date';
import { FileText, Layers, ArrowLeft, Calendar, LayoutDashboard } from 'lucide-react';
import type { ExtractionResult } from '../components/MicroDictation';

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
  const navigate = useNavigate();
  const [appointmentData, setAppointmentData] = useState<AppointmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dictationMode, setDictationMode] = useState<'standard' | 'micro'>('standard');

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
        {/* Navigation Links */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            Back to Dashboard
          </button>
          <button
            onClick={() => navigate('/schedule')}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-colors"
          >
            <Calendar className="w-4 h-4" />
            Back to Schedule
          </button>
          {patientData?.id && (
            <button
              onClick={() => navigate(`/patient-chart?id=${patientData.id}`)}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Patient Chart
            </button>
          )}
        </div>

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
                      DOB: {formatDOB(appointmentData.patient_dob)}
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

        {/* Patient Info Header - from patient chart (no appointment) */}
        {!appointmentData && patientData && (
          <div className="unified-card mb-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-3">{patientData.full_name}</h2>
                <div className="flex items-center gap-4">
                  {patientData.mrn && (
                    <span className="px-4 py-2 bg-blue-50 border-2 border-blue-400 text-blue-800 text-sm font-mono font-bold rounded-lg inline-flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      MRN: {patientData.mrn}
                    </span>
                  )}
                  {patientData.tshla_id && (
                    <span className="px-3 py-1 bg-purple-50 border border-purple-300 text-purple-700 text-sm font-medium rounded">
                      {patientData.tshla_id}
                    </span>
                  )}
                  {patientData.date_of_birth && (
                    <span className="text-sm text-slate-600 font-medium">
                      DOB: {formatDOB(patientData.date_of_birth)}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-slate-500">
                  From Patient Chart
                </div>
                <div className="text-sm font-medium text-slate-700">
                  {new Date().toLocaleDateString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pre-Visit Summary Section (if appointment ID provided) */}
        {appointmentId && (
          <PreVisitSummary appointmentId={appointmentId} />
        )}

        {/* Dictation Mode Toggle */}
        <div className="unified-card mb-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-800">Dictation Mode</h3>
            <div className="flex bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setDictationMode('standard')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  dictationMode === 'standard'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <FileText className="w-4 h-4" />
                Standard Note
              </button>
              <button
                onClick={() => setDictationMode('micro')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  dictationMode === 'micro'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <Layers className="w-4 h-4" />
                Micro-Dictation
              </button>
            </div>
          </div>
          <p className="text-sm text-slate-500 mt-2">
            {dictationMode === 'standard'
              ? 'Record continuously and generate a formatted clinical note.'
              : 'Pause anytime to review AI-extracted clinical data (meds, labs, vitals) before continuing.'}
          </p>
        </div>

        {/* Standard Medical Dictation */}
        {dictationMode === 'standard' && (
          <MedicalDictation
            appointmentId={appointmentId}
            appointmentData={appointmentData}
            patientId={appointmentData?.unified_patient_id || patientData?.id}
            preloadPatientData={true}
          />
        )}

        {/* Micro-Dictation Mode */}
        {dictationMode === 'micro' && (
          <MicroDictation
            patientId={appointmentData?.unified_patient_id || patientData?.id}
            patientName={appointmentData?.patient_name || patientData?.full_name}
            tshlaId={patientData?.tshla_id}
            onFinalSubmit={async (data: ExtractionResult, transcript: string) => {
              // Apply extracted data to chart
              try {
                const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000';

                // Convert to merge format
                const mergeResult = {
                  medications: data.medications.map(m => ({
                    medication: m,
                    decision: { action: 'add' as const, reason: 'New from micro-dictation' }
                  })),
                  labs: data.labs.map(l => ({
                    lab: l,
                    decision: { action: 'add' as const, reason: 'New from micro-dictation' }
                  })),
                  vitals: data.vitals.map(v => ({
                    vital: v,
                    decision: { action: 'add' as const, reason: 'New from micro-dictation' }
                  })),
                  summary: {
                    medicationsToAdd: data.medications.length,
                    medicationsToUpdate: 0,
                    medicationsSkipped: 0,
                    labsToAdd: data.labs.length,
                    labsToUpdate: 0,
                    labsSkipped: 0,
                    vitalsToAdd: data.vitals.length,
                    vitalsToUpdate: 0,
                    vitalsSkipped: 0
                  }
                };

                const response = await fetch(`${apiBase}/api/chart-update/apply`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    mergeResult,
                    patientId: appointmentData?.unified_patient_id || patientData?.id,
                    tshlaId: patientData?.tshla_id
                  })
                });

                if (response.ok) {
                  alert('Chart updated successfully!');
                  // Navigate back to patient chart or dashboard
                  if (patientData?.id) {
                    navigate(`/patient-chart?id=${patientData.id}`);
                  } else {
                    navigate('/dashboard');
                  }
                } else {
                  alert('Failed to update chart. Please try again.');
                }
              } catch (error) {
                console.error('Failed to apply micro-dictation data:', error);
                alert('Failed to update chart. Please try again.');
              }
            }}
            onCancel={() => {
              // Navigate back
              if (patientData?.id) {
                navigate(`/patient-chart?id=${patientData.id}`);
              } else {
                navigate('/dashboard');
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
