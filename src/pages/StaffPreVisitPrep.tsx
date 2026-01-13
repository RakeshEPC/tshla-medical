import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

// Get API URL from environment
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface AppointmentInfo {
  id: number;
  patient_name: string;
  patient_phone: string;
  scheduled_date: string;
  start_time: string;
  provider_name: string;
  internal_id?: string;
  tsh_id?: string;
  old_emr_number?: string;  // MRN from Athena/old system
}

export default function StaffPreVisitPrep() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const appointmentId = searchParams.get('appointmentId');

  const [appointment, setAppointment] = useState<AppointmentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);

  // Form data
  const [previousNotes, setPreviousNotes] = useState('');
  const [medications, setMedications] = useState('');
  const [labResults, setLabResults] = useState('');
  const [vitals, setVitals] = useState({
    bp: '',
    hr: '',
    temp: '',
    weight: '',
    height: '',
    bmi: ''
  });
  const [questionnaire, setQuestionnaire] = useState('');
  const [insuranceNotes, setInsuranceNotes] = useState('');
  const [otherDocs, setOtherDocs] = useState('');

  useEffect(() => {
    if (appointmentId) {
      loadAppointmentData();
      loadExistingPreVisit();
    }
  }, [appointmentId]);

  const loadAppointmentData = async () => {
    try {
      const { data, error } = await supabase
        .from('provider_schedules')
        .select(`
          *,
          unified_patients!unified_patient_id (
            patient_id,
            tshla_id,
            phone_primary,
            mrn
          )
        `)
        .eq('id', appointmentId)
        .single();

      if (error) throw error;

      const patient = data.unified_patients;
      setAppointment({
        id: data.id,
        patient_name: data.patient_name || 'Unknown',
        patient_phone: data.patient_phone || patient?.phone_primary || 'N/A',
        scheduled_date: data.scheduled_date,
        start_time: data.start_time,
        provider_name: data.provider_name || data.provider_id,
        internal_id: patient?.patient_id,
        tsh_id: patient?.tshla_id,
        old_emr_number: patient?.mrn
      });
    } catch (error) {
      console.error('Error loading appointment:', error);
      alert('Failed to load appointment data');
    } finally {
      setLoading(false);
    }
  };

  const loadExistingPreVisit = async () => {
    try {
      const { data, error } = await supabase
        .from('previsit_data')
        .select('*')
        .eq('appointment_id', appointmentId)
        .single();

      if (data) {
        setPreviousNotes(data.previous_notes || '');
        setMedications(data.medications_list || '');
        setLabResults(data.lab_results || '');
        setVitals(data.vitals || {});
        setQuestionnaire(data.patient_questionnaire || '');
        setInsuranceNotes(data.insurance_notes || '');
        setOtherDocs(data.other_documents || '');
      }
    } catch (error) {
      // No existing data, that's fine
      console.log('No existing pre-visit data found');
    }
  };

  const handleSaveDraft = async () => {
    if (!appointmentId) return;

    setSaving(true);
    try {
      const previsitData = {
        appointment_id: appointmentId,
        previous_notes: previousNotes,
        medications_list: medications,
        lab_results: labResults,
        vitals: vitals,
        patient_questionnaire: questionnaire,
        insurance_notes: insuranceNotes,
        other_documents: otherDocs,
        completed: false
      };

      const { error } = await supabase
        .from('previsit_data')
        .upsert(previsitData, { onConflict: 'appointment_id' });

      if (error) throw error;

      alert('Draft saved successfully!');
    } catch (error) {
      console.error('Error saving draft:', error);
      alert('Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!appointmentId) return;

    setAiProcessing(true);
    try {
      // First save the data
      await handleSaveDraft();

      // Call AI service to generate summary via Azure Container App
      const response = await fetch(`${API_URL}/api/ai/generate-previsit-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId,
          previousNotes,
          medications,
          labResults,
          vitals,
          questionnaire
        })
      });

      if (!response.ok) throw new Error('AI processing failed');

      const { summary, chiefComplaint, medicationChanges, abnormalLabs } = await response.json();

      // Save AI-generated summary
      const { error } = await supabase
        .from('previsit_data')
        .update({
          ai_summary: summary,
          chief_complaint: chiefComplaint,
          medication_changes: medicationChanges,
          abnormal_labs: abnormalLabs,
          ai_summary_generated_at: new Date().toISOString(),
          completed: true,
          completed_at: new Date().toISOString()
        })
        .eq('appointment_id', appointmentId);

      if (error) throw error;

      // Mark appointment as pre-visit complete
      await supabase
        .from('provider_schedules')
        .update({
          pre_visit_complete: true,
          pre_visit_completed_at: new Date().toISOString()
        })
        .eq('id', appointmentId);

      alert('Pre-visit summary generated successfully!');
      navigate('/staff-previsit-workflow');
    } catch (error) {
      console.error('Error generating summary:', error);
      alert('Failed to generate AI summary. Draft has been saved.');
    } finally {
      setAiProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading appointment...</p>
        </div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Appointment Not Found</h2>
          <button
            onClick={() => navigate('/staff-previsit-workflow')}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Back to Pre-Visit Workflow
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => navigate('/staff-previsit-workflow')}
              className="text-purple-100 hover:text-white"
            >
              ← Back to Pre-Visit Workflow
            </button>
            <button
              onClick={() => navigate('/staff-dashboard')}
              className="px-4 py-2 bg-white text-purple-700 rounded-lg hover:bg-purple-50 font-medium transition-colors"
            >
              ← Back to Dashboard
            </button>
          </div>
          <h1 className="text-3xl font-bold">Pre-Visit Preparation</h1>
          <p className="text-purple-100 mt-1">Prepare patient information before provider visit</p>
        </div>
      </div>

      {/* Patient Info Card */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Appointment Information</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Patient</p>
              <p className="font-semibold">{appointment.patient_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Old EMR # (Athena)</p>
              <p className="font-mono font-semibold text-orange-600 text-lg">{appointment.old_emr_number || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Internal ID</p>
              <p className="font-mono font-semibold text-blue-600">{appointment.internal_id || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">TSH ID</p>
              <p className="font-mono font-semibold text-purple-600">{appointment.tsh_id || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Provider</p>
              <p className="font-semibold">{appointment.provider_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Date</p>
              <p className="font-semibold">{new Date(appointment.scheduled_date).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Time</p>
              <p className="font-semibold">{appointment.start_time}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Phone</p>
              <p className="font-semibold">{appointment.patient_phone}</p>
            </div>
          </div>
        </div>

        {/* Data Entry Form */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Previous Notes */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">📝 Previous Visit Notes</h3>
            <p className="text-sm text-gray-600 mb-3">Copy/paste from old EMR</p>
            <textarea
              value={previousNotes}
              onChange={(e) => setPreviousNotes(e.target.value)}
              className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
              placeholder="Paste previous visit notes here..."
            />
          </div>

          {/* Medications */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">💊 Current Medications</h3>
            <p className="text-sm text-gray-600 mb-3">List all current medications</p>
            <textarea
              value={medications}
              onChange={(e) => setMedications(e.target.value)}
              className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
              placeholder="e.g., Metformin 1000mg BID&#10;Lisinopril 10mg daily"
            />
          </div>

          {/* Lab Results */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">🧪 Recent Lab Results</h3>
            <p className="text-sm text-gray-600 mb-3">Paste lab results with dates</p>
            <textarea
              value={labResults}
              onChange={(e) => setLabResults(e.target.value)}
              className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
              placeholder="e.g., A1C: 7.2% (12/15/2025)&#10;Creatinine: 1.1 (12/15/2025)"
            />
          </div>

          {/* Vitals */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">🩺 Vitals (Today)</h3>
            <p className="text-sm text-gray-600 mb-3">Enter today's vital signs</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Blood Pressure</label>
                <input
                  type="text"
                  value={vitals.bp}
                  onChange={(e) => setVitals({...vitals, bp: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="120/80"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Heart Rate</label>
                <input
                  type="text"
                  value={vitals.hr}
                  onChange={(e) => setVitals({...vitals, hr: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="72"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Temperature (°F)</label>
                <input
                  type="text"
                  value={vitals.temp}
                  onChange={(e) => setVitals({...vitals, temp: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="98.6"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Weight (lbs)</label>
                <input
                  type="text"
                  value={vitals.weight}
                  onChange={(e) => setVitals({...vitals, weight: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="150"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Height (in)</label>
                <input
                  type="text"
                  value={vitals.height}
                  onChange={(e) => setVitals({...vitals, height: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="65"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">BMI</label>
                <input
                  type="text"
                  value={vitals.bmi}
                  onChange={(e) => setVitals({...vitals, bmi: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="25.0"
                />
              </div>
            </div>
          </div>

          {/* Questionnaire */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">📋 Patient Questionnaire</h3>
            <p className="text-sm text-gray-600 mb-3">Patient responses, concerns, goals</p>
            <textarea
              value={questionnaire}
              onChange={(e) => setQuestionnaire(e.target.value)}
              className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              placeholder="Patient concerns, questions, goals for visit..."
            />
          </div>

          {/* Insurance Notes */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">🏥 Insurance / Authorization</h3>
            <p className="text-sm text-gray-600 mb-3">Insurance status, prior auth needed</p>
            <textarea
              value={insuranceNotes}
              onChange={(e) => setInsuranceNotes(e.target.value)}
              className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              placeholder="Insurance active, deductible met, prior auth for XYZ..."
            />
          </div>

          {/* Other Documents */}
          <div className="bg-white rounded-lg shadow-md p-6 lg:col-span-2">
            <h3 className="text-lg font-bold text-gray-900 mb-3">📄 Other Documents / Notes</h3>
            <p className="text-sm text-gray-600 mb-3">Any additional information</p>
            <textarea
              value={otherDocs}
              onChange={(e) => setOtherDocs(e.target.value)}
              className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              placeholder="Additional notes, documents, context..."
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex gap-4 justify-end">
          <button
            onClick={handleSaveDraft}
            disabled={saving}
            className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : '💾 Save Draft'}
          </button>
          <button
            onClick={handleGenerateSummary}
            disabled={aiProcessing || saving}
            className="px-8 py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-lg font-semibold shadow-lg transition-all disabled:opacity-50"
          >
            {aiProcessing ? '🤖 AI Processing...' : '✨ Generate Summary & Complete'}
          </button>
        </div>

        <div className="mt-4 text-center text-sm text-gray-600">
          <p>💡 Tip: Save drafts frequently. Click "Generate Summary" when all data is entered to create AI summary for provider.</p>
        </div>
      </div>
    </div>
  );
}
