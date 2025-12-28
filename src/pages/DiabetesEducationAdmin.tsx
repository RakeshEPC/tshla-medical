/**
 * Diabetes Education Admin Portal
 * Staff interface for managing diabetes education patients and viewing call logs
 * Created: 2025-12-03
 */

import React, { useState, useEffect } from 'react';
import { Plus, Phone, FileText, User, Calendar, Globe, Activity, X, Edit, Eye, Info } from 'lucide-react';
import {
  getDiabetesEducationPatients,
  getPatientCallHistory,
  getCallStats,
  createDiabetesEducationPatient,
  updateDiabetesEducationPatient,
  deactivateDiabetesEducationPatient,
  formatPhoneDisplay,
  getLanguageDisplay,
  formatDuration,
  formatCallDateTime,
  validatePhoneNumber,
  type DiabetesEducationPatient,
  type DiabetesEducationCall,
  type CallStats,
  type CreatePatientData,
} from '../services/diabetesEducation.service';
import PatientDetailModal from '../components/diabetes/PatientDetailModal';

export default function DiabetesEducationAdmin() {
  const [patients, setPatients] = useState<DiabetesEducationPatient[]>([]);
  const [stats, setStats] = useState<CallStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<DiabetesEducationPatient | null>(null);
  const [selectedPatientCalls, setSelectedPatientCalls] = useState<DiabetesEducationCall[]>([]);
  const [showCallHistory, setShowCallHistory] = useState(false);
  const [showPatientDetail, setShowPatientDetail] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      // TEMPORARY: Fetch directly from Supabase to bypass API issues
      const supabase = (await import('../lib/supabase')).supabase;

      // Fetch patients
      const { data: patientsData, error: patientsError } = await supabase
        .from('diabetes_education_patients')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (patientsError) throw patientsError;

      // Fetch call stats
      const { data: callsData, error: callsError } = await supabase
        .from('diabetes_education_calls')
        .select('*');

      if (callsError) throw callsError;

      // Calculate stats
      const totalCalls = callsData?.length || 0;
      const completedCalls = callsData?.filter((c: any) => c.call_status === 'completed').length || 0;
      const avgDuration = callsData && callsData.length > 0
        ? callsData.reduce((sum: number, c: any) => sum + (c.duration_seconds || 0), 0) / callsData.length
        : 0;

      setPatients(patientsData || []);
      setStats({
        total_calls: totalCalls,
        completed_calls: completedCalls,
        average_duration_seconds: Math.round(avgDuration),
        total_patients: patientsData?.length || 0,
      });
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load diabetes education data');
    } finally {
      setLoading(false);
    }
  }

  async function handleViewCallHistory(patient: DiabetesEducationPatient) {
    try {
      // TEMPORARY: Fetch directly from Supabase
      const supabase = (await import('../lib/supabase')).supabase;
      const { data: calls, error } = await supabase
        .from('diabetes_education_calls')
        .select('*')
        .eq('patient_id', patient.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Could not load call history (may be RLS policy issue):', error);
        // Show modal with empty calls list
        setSelectedPatient(patient);
        setSelectedPatientCalls([]);
        setShowCallHistory(true);
        return;
      }

      setSelectedPatient(patient);
      setSelectedPatientCalls(calls || []);
      setShowCallHistory(true);
    } catch (error) {
      console.error('Error loading call history:', error);
      // Still show modal with empty calls
      setSelectedPatient(patient);
      setSelectedPatientCalls([]);
      setShowCallHistory(true);
    }
  }

  async function handleViewPatientDetail(patient: DiabetesEducationPatient) {
    try {
      // TEMPORARY: Fetch directly from Supabase
      const supabase = (await import('../lib/supabase')).supabase;
      const { data: calls, error } = await supabase
        .from('diabetes_education_calls')
        .select('*')
        .eq('patient_id', patient.id)
        .order('created_at', { ascending: false });

      // Log error but don't fail - just show patient details without calls
      if (error) {
        console.warn('Could not load call history (may be RLS policy issue):', error);
      }

      setSelectedPatient(patient);
      setSelectedPatientCalls(calls || []);
      setShowPatientDetail(true);
    } catch (error) {
      console.error('Error loading patient details:', error);
      // Still show the modal even if calls fail to load
      setSelectedPatient(patient);
      setSelectedPatientCalls([]);
      setShowPatientDetail(true);
    }
  }

  function handleCreatePatient() {
    setShowCreateModal(true);
  }

  function handleCloseModals() {
    setShowCreateModal(false);
    setShowCallHistory(false);
    setShowPatientDetail(false);
    setSelectedPatient(null);
    setSelectedPatientCalls([]);
  }

  async function handlePatientCreated() {
    handleCloseModals();
    await loadData();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading diabetes education data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Phone className="w-8 h-8 text-blue-600" />
                Diabetes Education Admin
              </h1>
              <p className="mt-1 text-gray-600">Manage phone-based AI diabetes education consultations</p>
            </div>
            <button
              onClick={handleCreatePatient}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md"
            >
              <Plus className="w-5 h-5" />
              New Patient
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <StatCard
              icon={<User className="w-6 h-6" />}
              label="Active Patients"
              value={stats.active_patients}
              color="blue"
            />
            <StatCard
              icon={<Phone className="w-6 h-6" />}
              label="Total Calls"
              value={stats.total_calls}
              color="green"
            />
            <StatCard
              icon={<Activity className="w-6 h-6" />}
              label="Calls Today"
              value={stats.calls_today}
              color="purple"
            />
            <StatCard
              icon={<Calendar className="w-6 h-6" />}
              label="Avg Duration"
              value={`${stats.avg_duration_minutes} min`}
              color="orange"
            />
          </div>
        )}

        {/* Patients Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-xl font-semibold text-gray-900">Enrolled Patients</h2>
            <p className="text-sm text-gray-600 mt-1">
              Patients registered for phone-based diabetes education
            </p>
          </div>

          {patients.length === 0 ? (
            <div className="p-12 text-center">
              <Phone className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No patients enrolled yet</h3>
              <p className="text-gray-600 mb-6">Get started by creating your first diabetes education patient</p>
              <button
                onClick={handleCreatePatient}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Create First Patient
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Patient
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Phone
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Language
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      DOB
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Enrolled
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {patients.map((patient) => (
                    <tr key={patient.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold">
                            {patient.first_name[0]}{patient.last_name[0]}
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">
                              {patient.first_name} {patient.last_name}
                            </div>
                            {patient.medical_data && (
                              <div className="text-xs text-green-600 flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                Medical data loaded
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatPhoneDisplay(patient.phone_number)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                          <Globe className="w-3 h-3" />
                          {getLanguageDisplay(patient.preferred_language)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(patient.date_of_birth).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(patient.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleViewPatientDetail(patient)}
                            className="inline-flex items-center gap-1 px-3 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors font-medium"
                          >
                            <Info className="w-4 h-4" />
                            View Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create Patient Modal */}
      {showCreateModal && (
        <CreatePatientModal
          onClose={handleCloseModals}
          onSuccess={handlePatientCreated}
        />
      )}

      {/* Call History Modal */}
      {showCallHistory && selectedPatient && (
        <CallHistoryModal
          patient={selectedPatient}
          calls={selectedPatientCalls}
          onClose={handleCloseModals}
        />
      )}

      {/* Patient Detail Modal (NEW - comprehensive view with documents and notes) */}
      {showPatientDetail && selectedPatient && (
        <PatientDetailModal
          patient={selectedPatient}
          calls={selectedPatientCalls}
          onClose={handleCloseModals}
          onUpdate={loadData}
        />
      )}
    </div>
  );
}

// =====================================================
// STAT CARD COMPONENT
// =====================================================

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

function StatCard({ icon, label, value, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600',
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 font-medium">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// =====================================================
// CREATE PATIENT MODAL
// =====================================================

interface CreatePatientModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function CreatePatientModal({ onClose, onSuccess }: CreatePatientModalProps) {
  const [formData, setFormData] = useState<CreatePatientData>({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    phone_number: '',
    preferred_language: 'en',
  });
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Validate phone number
    if (!validatePhoneNumber(formData.phone_number)) {
      setError('Invalid phone number format');
      return;
    }

    try {
      setSubmitting(true);

      const dataToSubmit: CreatePatientData = {
        ...formData,
        medical_document: file || undefined,
      };

      await createDiabetesEducationPatient(dataToSubmit);
      onSuccess();

    } catch (err: any) {
      setError(err.message || 'Failed to create patient');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Create New Patient</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                First Name *
              </label>
              <input
                type="text"
                required
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="John"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Last Name *
              </label>
              <input
                type="text"
                required
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date of Birth *
              </label>
              <input
                type="date"
                required
                value={formData.date_of_birth}
                onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number *
              </label>
              <input
                type="tel"
                required
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="(555) 123-4567"
              />
              <p className="text-xs text-gray-500 mt-1">
                Patient will use this number to call for diabetes education
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preferred Language *
              </label>
              <select
                required
                value={formData.preferred_language}
                onChange={(e) => setFormData({ ...formData, preferred_language: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Medical Document (Optional)
            </label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Upload patient's medical records (PDF or image). AI will extract medications, lab values, and diagnoses.
            </p>
            {file && (
              <p className="text-sm text-green-600 mt-2">
                ✓ {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating...' : 'Create Patient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =====================================================
// CALL HISTORY MODAL
// =====================================================

interface CallHistoryModalProps {
  patient: DiabetesEducationPatient;
  calls: DiabetesEducationCall[];
  onClose: () => void;
}

function CallHistoryModal({ patient, calls, onClose }: CallHistoryModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Call History: {patient.first_name} {patient.last_name}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {formatPhoneDisplay(patient.phone_number)} • {getLanguageDisplay(patient.preferred_language)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <div className="p-6">
          {calls.length === 0 ? (
            <div className="text-center py-12">
              <Phone className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-600">No calls yet from this patient</p>
            </div>
          ) : (
            <div className="space-y-4">
              {calls.map((call) => (
                <div key={call.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-semibold text-gray-900">
                          {formatCallDateTime(call.call_started_at)}
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          call.call_status === 'completed' ? 'bg-green-100 text-green-800' :
                          call.call_status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {call.call_status}
                        </span>
                        {call.duration_seconds && (
                          <span className="text-sm text-gray-600">
                            Duration: {formatDuration(call.duration_seconds)}
                          </span>
                        )}
                      </div>

                      {call.summary && (
                        <p className="text-sm text-gray-700 mb-2">{call.summary}</p>
                      )}

                      {call.topics_discussed && call.topics_discussed.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {call.topics_discussed.map((topic, idx) => (
                            <span key={idx} className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded">
                              {topic}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {call.transcript && (
                    <details className="mt-3">
                      <summary className="text-sm font-medium text-blue-600 cursor-pointer hover:text-blue-800">
                        View Transcript
                      </summary>
                      <div className="mt-2 p-3 bg-white rounded border border-gray-200 text-sm text-gray-700 whitespace-pre-wrap">
                        {call.transcript}
                      </div>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
