/**
 * Patient Portal Dashboard
 * Self-service patient view of medical records
 * Created: 2025-01-16
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Calendar,
  FileText,
  Pill,
  Activity,
  LogOut,
  Phone,
  Mail,
  AlertCircle,
  Clock,
  ChevronRight,
  Heart,
  CheckCircle2,
  Check,
  X
} from 'lucide-react';
import PCMConsentForm from '../components/PCMConsentForm';
import type { PCMConsentData } from '../types/pcm.types';

interface PatientData {
  id: string;
  patient_id: string;
  full_name: string;
  first_name: string;
  phone_display: string;
  email: string;
  date_of_birth: string;
  age: number;
  gender: string;
  primary_provider_name: string;
  pcm_enrolled?: boolean;
  pcm_status?: string;
  pcm_start_date?: string;
  pcm_target_a1c?: number;
  pcm_current_a1c?: number;
  pcm_target_bp?: string;
  pcm_current_bp?: string;
  pcm_target_weight?: number;
  pcm_current_weight?: number;
}

interface ChartData {
  recentVisits: any[];
  upcomingAppointments: any[];
  currentMedications: any[];
  activeConditions: string[];
  stats: {
    totalVisits: number;
    totalPrevisitCalls: number;
    lastVisit: string | null;
  };
}

export default function PatientPortalDashboard() {
  const navigate = useNavigate();

  const [patient, setPatient] = useState<PatientData | null>(null);
  const [chart, setChart] = useState<ChartData | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'visits' | 'medications' | 'appointments' | 'diabetes'>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [showPCMConsent, setShowPCMConsent] = useState(false);

  useEffect(() => {
    // Load patient data from session storage
    const patientData = sessionStorage.getItem('patient_portal_user');
    const chartData = sessionStorage.getItem('patient_portal_chart');

    if (!patientData || !chartData) {
      // Not logged in - redirect to login
      navigate('/patient-portal-login');
      return;
    }

    try {
      const parsedPatient = JSON.parse(patientData);
      setPatient(parsedPatient);
      setChart(JSON.parse(chartData));

      // Check if patient needs to sign PCM consent
      if (!parsedPatient.pcm_enrolled) {
        setShowPCMConsent(true);
      }
    } catch (error) {
      console.error('Error parsing patient data:', error);
      navigate('/patient-portal-login');
      return;
    }

    setIsLoading(false);
  }, [navigate]);

  /**
   * Handle PCM consent submission
   */
  const handlePCMConsentSubmit = async (consentData: PCMConsentData) => {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

    try {
      const response = await fetch(`${API_BASE_URL}/api/patient-chart/portal/pcm-consent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          patientId: patient?.id,
          ...consentData
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save PCM consent');
      }

      // Update patient data with PCM enrollment
      const updatedPatient = {
        ...patient!,
        pcm_enrolled: true,
        pcm_status: 'active',
        pcm_start_date: data.patient.pcm_start_date
      };

      setPatient(updatedPatient);
      sessionStorage.setItem('patient_portal_user', JSON.stringify(updatedPatient));
      setShowPCMConsent(false);

      alert('Successfully enrolled in PCM program!');
    } catch (error) {
      console.error('Error submitting PCM consent:', error);
      throw error;
    }
  };

  /**
   * Handle logout
   */
  const handleLogout = () => {
    sessionStorage.removeItem('patient_portal_user');
    sessionStorage.removeItem('patient_portal_chart');
    navigate('/patient-portal-login');
  };

  /**
   * Format date for display
   */
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (isLoading || !patient || !chart) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your medical records...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo/Title */}
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-green-600 rounded-lg flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">TSHLA Patient Portal</h1>
                <p className="text-xs text-gray-500">ID: {patient.patient_id}</p>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100 transition"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Patient Info Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-green-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">{patient.full_name}</h2>
              <div className="mt-2 flex items-center space-x-6 text-blue-100">
                <div className="flex items-center space-x-2">
                  <Phone className="w-4 h-4" />
                  <span className="text-sm">{patient.phone_display}</span>
                </div>
                {patient.email && (
                  <div className="flex items-center space-x-2">
                    <Mail className="w-4 h-4" />
                    <span className="text-sm">{patient.email}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-blue-100">Primary Care Provider</p>
              <p className="text-lg font-semibold">{patient.primary_provider_name || 'Not assigned'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto">
            {[
              { id: 'overview', label: 'Overview', icon: Activity },
              ...(patient.pcm_enrolled ? [{ id: 'diabetes', label: 'Diabetes Goals', icon: Heart }] : []),
              { id: 'visits', label: 'Medical Visits', icon: FileText },
              { id: 'medications', label: 'Medications', icon: Pill },
              { id: 'appointments', label: 'Appointments', icon: Calendar }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm whitespace-nowrap transition ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">

            {/* PCM Enrollment Status Card */}
            {patient.pcm_enrolled && patient.pcm_status === 'active' && (
              <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl shadow-sm p-6 border-2 border-green-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">PCM Diabetes Care Program</h3>
                        <p className="text-sm text-green-700">Active since {formatDate(patient.pcm_start_date || '')}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                      {/* A1C Goal */}
                      {patient.pcm_target_a1c && (
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">A1C Goal</p>
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-gray-900">
                              {patient.pcm_current_a1c || '--'}%
                            </span>
                            <span className="text-sm text-gray-500">/ {patient.pcm_target_a1c}%</span>
                          </div>
                          {patient.pcm_current_a1c && patient.pcm_target_a1c && (
                            <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${
                                  patient.pcm_current_a1c <= patient.pcm_target_a1c
                                    ? 'bg-green-500'
                                    : 'bg-yellow-500'
                                }`}
                                style={{
                                  width: `${Math.min(
                                    100,
                                    (patient.pcm_target_a1c / patient.pcm_current_a1c) * 100
                                  )}%`
                                }}
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Blood Pressure Goal */}
                      {patient.pcm_target_bp && (
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Blood Pressure</p>
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-gray-900">
                              {patient.pcm_current_bp || '--'}
                            </span>
                            <span className="text-sm text-gray-500">/ {patient.pcm_target_bp}</span>
                          </div>
                        </div>
                      )}

                      {/* Weight Goal */}
                      {patient.pcm_target_weight && (
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Weight (lbs)</p>
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-gray-900">
                              {patient.pcm_current_weight || '--'}
                            </span>
                            <span className="text-sm text-gray-500">/ {patient.pcm_target_weight}</span>
                          </div>
                          {patient.pcm_current_weight && patient.pcm_target_weight && (
                            <p className="text-xs text-gray-600 mt-1">
                              {patient.pcm_current_weight > patient.pcm_target_weight
                                ? `${(patient.pcm_current_weight - patient.pcm_target_weight).toFixed(1)} lbs to goal`
                                : 'Goal achieved! '}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm text-blue-900">
                        <span className="font-semibold">Monthly Care Coordination:</span> You receive at least 30 minutes of
                        clinical staff time each month for diabetes management support.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Visits</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{chart.stats.totalVisits}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Active Medications</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{chart.currentMedications.length}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <Pill className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Upcoming Appointments</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{chart.upcomingAppointments.length}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Active Conditions */}
            {chart.activeConditions && chart.activeConditions.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                  <Heart className="w-5 h-5 text-red-500" />
                  <span>Active Conditions</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {chart.activeConditions.map((condition, idx) => (
                    <div key={idx} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">{condition}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Visits Summary */}
            {chart.recentVisits.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Visits</h3>
                <div className="space-y-3">
                  {chart.recentVisits.slice(0, 3).map((visit, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{visit.note_title || 'Medical Visit'}</p>
                          <p className="text-sm text-gray-500">{formatDate(visit.visit_date)}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Visits Tab */}
        {activeTab === 'visits' && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Medical Visit History</h3>
            {chart.recentVisits.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No visit records found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {chart.recentVisits.map((visit, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-900">{visit.note_title || 'Medical Visit'}</h4>
                        <p className="text-sm text-gray-500 mt-1">{formatDate(visit.visit_date)}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        visit.status === 'signed' ? 'bg-green-100 text-green-800' :
                        visit.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {visit.status}
                      </span>
                    </div>
                    {visit.chief_complaint && (
                      <p className="text-sm text-gray-600 mb-2">
                        <span className="font-medium">Chief Complaint:</span> {visit.chief_complaint}
                      </p>
                    )}
                    {visit.ai_summary && (
                      <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                        {visit.ai_summary}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Medications Tab */}
        {activeTab === 'medications' && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Medications</h3>
            {chart.currentMedications.length === 0 ? (
              <div className="text-center py-12">
                <Pill className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No medications on file</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {chart.currentMedications.map((med: any, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">{med.name}</h4>
                    <div className="space-y-1 text-sm">
                      {med.dosage && (
                        <p className="text-gray-600">
                          <span className="font-medium">Dosage:</span> {med.dosage || med.dose}
                        </p>
                      )}
                      {med.frequency && (
                        <p className="text-gray-600">
                          <span className="font-medium">Frequency:</span> {med.frequency}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Appointments Tab */}
        {activeTab === 'appointments' && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Appointments</h3>
            {chart.upcomingAppointments.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No upcoming appointments scheduled</p>
                <p className="text-sm text-gray-400 mt-2">Contact your doctor's office to schedule</p>
              </div>
            ) : (
              <div className="space-y-4">
                {chart.upcomingAppointments.map((appt: any, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4">
                        <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                          <Clock className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">
                            {appt.appointment_type || 'Appointment'}
                          </h4>
                          <p className="text-sm text-gray-600 mt-1">
                            {formatDate(appt.scheduled_date)} at {appt.start_time}
                          </p>
                          {appt.provider_name && (
                            <p className="text-sm text-gray-500 mt-1">
                              with {appt.provider_name}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        appt.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                        appt.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {appt.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Diabetes Goals Tab */}
        {activeTab === 'diabetes' && patient.pcm_enrolled && (
          <div className="space-y-6">

            {/* PCM Program Header */}
            <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                    <Heart className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Diabetes Management Dashboard</h2>
                    <p className="text-green-100">PCM Program - Enrolled since {formatDate(patient.pcm_start_date || '')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-green-100">Next Check-in</p>
                  <p className="text-lg font-bold">This Month</p>
                </div>
              </div>
            </div>

            {/* Patient Action Items / Todo List */}
            <div className="bg-white rounded-xl shadow-sm border-2 border-indigo-200">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 rounded-t-xl">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Your Action Items This Week
                </h3>
              </div>
              <div className="p-6">
                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-4 bg-green-50 border-2 border-green-200 rounded-lg hover:bg-green-100 cursor-pointer transition">
                    <input type="checkbox" className="mt-1 w-5 h-5 text-green-600 rounded border-gray-300 focus:ring-green-500" />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">Check blood sugar before breakfast</p>
                      <p className="text-sm text-gray-600 mt-1">Target: 80-130 mg/dL fasting</p>
                    </div>
                    <span className="px-3 py-1 bg-green-600 text-white text-xs font-bold rounded-full">Daily</span>
                  </label>

                  <label className="flex items-start gap-3 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg hover:bg-blue-100 cursor-pointer transition">
                    <input type="checkbox" className="mt-1 w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">Take all prescribed medications</p>
                      <p className="text-sm text-gray-600 mt-1">See medication list below for details</p>
                    </div>
                    <span className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-full">Daily</span>
                  </label>

                  <label className="flex items-start gap-3 p-4 bg-orange-50 border-2 border-orange-200 rounded-lg hover:bg-orange-100 cursor-pointer transition">
                    <input type="checkbox" className="mt-1 w-5 h-5 text-orange-600 rounded border-gray-300 focus:ring-orange-500" />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">Exercise for 30 minutes</p>
                      <p className="text-sm text-gray-600 mt-1">Walking, swimming, or any physical activity you enjoy</p>
                    </div>
                    <span className="px-3 py-1 bg-orange-600 text-white text-xs font-bold rounded-full">5x/week</span>
                  </label>

                  <label className="flex items-start gap-3 p-4 bg-purple-50 border-2 border-purple-200 rounded-lg hover:bg-purple-100 cursor-pointer transition">
                    <input type="checkbox" className="mt-1 w-5 h-5 text-purple-600 rounded border-gray-300 focus:ring-purple-500" />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">Log your meals and carb intake</p>
                      <p className="text-sm text-gray-600 mt-1">Helps identify patterns and make better food choices</p>
                    </div>
                    <span className="px-3 py-1 bg-purple-600 text-white text-xs font-bold rounded-full">Daily</span>
                  </label>

                  <label className="flex items-start gap-3 p-4 bg-red-50 border-2 border-red-200 rounded-lg hover:bg-red-100 cursor-pointer transition">
                    <input type="checkbox" className="mt-1 w-5 h-5 text-red-600 rounded border-gray-300 focus:ring-red-500" />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">Check your feet for any issues</p>
                      <p className="text-sm text-gray-600 mt-1">Look for cuts, blisters, redness, or swelling</p>
                    </div>
                    <span className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-full">Daily</span>
                  </label>

                  <label className="flex items-start gap-3 p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg hover:bg-yellow-100 cursor-pointer transition">
                    <input type="checkbox" className="mt-1 w-5 h-5 text-yellow-600 rounded border-gray-300 focus:ring-yellow-500" />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">Schedule eye exam (annual)</p>
                      <p className="text-sm text-gray-600 mt-1">Diabetic retinopathy screening is critical</p>
                    </div>
                    <span className="px-3 py-1 bg-yellow-600 text-white text-xs font-bold rounded-full">Yearly</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Medication Compliance Tracker */}
            <div className="bg-white rounded-xl shadow-sm border-2 border-pink-200">
              <div className="bg-gradient-to-r from-pink-600 to-red-600 text-white p-4 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Pill className="w-5 h-5" />
                    Medication Compliance This Week
                  </h3>
                  <span className="px-3 py-1 bg-white bg-opacity-20 rounded-full text-sm font-bold">85% Adherence</span>
                </div>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {/* Medication 1 */}
                  <div className="border-2 border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-bold text-gray-900">Metformin 1000mg</h4>
                        <p className="text-sm text-gray-600">Twice daily with meals</p>
                      </div>
                      <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full">90% This Week</span>
                    </div>
                    <div className="flex gap-2">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => (
                        <div key={day} className="flex-1 text-center">
                          <p className="text-xs text-gray-500 mb-1">{day}</p>
                          <div className={`h-8 rounded ${idx < 5 ? 'bg-green-500' : idx === 5 ? 'bg-yellow-300' : 'bg-gray-200'} flex items-center justify-center`}>
                            {idx < 6 ? (
                              <Check className="w-4 h-4 text-white" />
                            ) : (
                              <span className="text-xs text-gray-400">--</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Medication 2 */}
                  <div className="border-2 border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-bold text-gray-900">Insulin Glargine (Lantus)</h4>
                        <p className="text-sm text-gray-600">30 units at bedtime</p>
                      </div>
                      <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full">100% This Week</span>
                    </div>
                    <div className="flex gap-2">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => (
                        <div key={day} className="flex-1 text-center">
                          <p className="text-xs text-gray-500 mb-1">{day}</p>
                          <div className={`h-8 rounded ${idx < 7 ? 'bg-green-500' : 'bg-gray-200'} flex items-center justify-center`}>
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Medication 3 */}
                  <div className="border-2 border-red-200 rounded-lg p-4 bg-red-50">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-bold text-gray-900">Lisinopril 10mg</h4>
                        <p className="text-sm text-gray-600">Once daily for blood pressure</p>
                      </div>
                      <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-full">65% This Week</span>
                    </div>
                    <div className="flex gap-2 mb-3">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => (
                        <div key={day} className="flex-1 text-center">
                          <p className="text-xs text-gray-500 mb-1">{day}</p>
                          <div className={`h-8 rounded ${idx === 0 || idx === 2 || idx === 3 || idx === 5 ? 'bg-green-500' : idx < 6 ? 'bg-red-400' : 'bg-gray-200'} flex items-center justify-center`}>
                            {idx === 0 || idx === 2 || idx === 3 || idx === 5 ? (
                              <Check className="w-4 h-4 text-white" />
                            ) : idx < 6 ? (
                              <X className="w-4 h-4 text-white" />
                            ) : (
                              <span className="text-xs text-gray-400">--</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="bg-white border-l-4 border-red-500 p-3 rounded">
                      <p className="text-sm text-red-900">
                        <span className="font-semibold">Reminder:</span> Taking this medication consistently helps prevent heart attack and stroke
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-900">
                    <span className="font-semibold">Tip:</span> Set phone alarms for each medication time to improve adherence. Missing doses can affect your diabetes control.
                  </p>
                </div>
              </div>
            </div>

            {/* Clinical Goals Progress */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              {/* A1C Goal Card */}
              {patient.pcm_target_a1c && (
                <div className="bg-white rounded-xl shadow-sm p-6 border-2 border-red-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">Hemoglobin A1C</h3>
                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                      <Activity className="w-6 h-6 text-red-600" />
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Current Value */}
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Current A1C</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold text-gray-900">
                          {patient.pcm_current_a1c || '--'}
                        </span>
                        <span className="text-xl text-gray-500">%</span>
                      </div>
                      {patient.pcm_last_a1c_date && (
                        <p className="text-xs text-gray-500 mt-1">
                          Last checked: {formatDate(patient.pcm_last_a1c_date)}
                        </p>
                      )}
                    </div>

                    {/* Target Value */}
                    <div className="bg-red-50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-red-900 uppercase tracking-wide mb-1">Target Goal</p>
                      <p className="text-2xl font-bold text-red-700">{'<'} {patient.pcm_target_a1c}%</p>
                    </div>

                    {/* Progress Bar */}
                    {patient.pcm_current_a1c && patient.pcm_target_a1c && (
                      <div>
                        <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                          <span>Progress to Goal</span>
                          <span className={patient.pcm_current_a1c <= patient.pcm_target_a1c ? 'text-green-600 font-semibold' : 'text-yellow-600'}>
                            {patient.pcm_current_a1c <= patient.pcm_target_a1c ? 'Goal Achieved!' : `${(patient.pcm_current_a1c - patient.pcm_target_a1c).toFixed(1)}% above target`}
                          </span>
                        </div>
                        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              patient.pcm_current_a1c <= patient.pcm_target_a1c
                                ? 'bg-green-500'
                                : patient.pcm_current_a1c <= patient.pcm_target_a1c + 1
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                            style={{
                              width: `${Math.min(100, (patient.pcm_target_a1c / patient.pcm_current_a1c) * 100)}%`
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Initial Value */}
                    {patient.pcm_initial_a1c && (
                      <div className="pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-500">Starting A1C: <span className="font-semibold text-gray-700">{patient.pcm_initial_a1c}%</span></p>
                        {patient.pcm_current_a1c && (
                          <p className="text-xs text-gray-500 mt-1">
                            Change: <span className={`font-semibold ${patient.pcm_current_a1c < patient.pcm_initial_a1c ? 'text-green-600' : 'text-red-600'}`}>
                              {patient.pcm_current_a1c < patient.pcm_initial_a1c ? '-' : '+'}{Math.abs(patient.pcm_current_a1c - patient.pcm_initial_a1c).toFixed(1)}%
                            </span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Blood Pressure Goal Card */}
              {patient.pcm_target_bp && (
                <div className="bg-white rounded-xl shadow-sm p-6 border-2 border-orange-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">Blood Pressure</h3>
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                      <Activity className="w-6 h-6 text-orange-600" />
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Current Value */}
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Current BP</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold text-gray-900">
                          {patient.pcm_current_bp || '--'}
                        </span>
                        <span className="text-xl text-gray-500">mmHg</span>
                      </div>
                      {patient.pcm_last_bp_date && (
                        <p className="text-xs text-gray-500 mt-1">
                          Last checked: {formatDate(patient.pcm_last_bp_date)}
                        </p>
                      )}
                    </div>

                    {/* Target Value */}
                    <div className="bg-orange-50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-orange-900 uppercase tracking-wide mb-1">Target Goal</p>
                      <p className="text-2xl font-bold text-orange-700">{'<'} {patient.pcm_target_bp} mmHg</p>
                    </div>

                    {/* Status Indicator */}
                    {patient.pcm_current_bp && (
                      <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                        <p className="text-sm text-blue-900">
                          <span className="font-semibold">Target:</span> Keep systolic below 130 and diastolic below 80 to reduce cardiovascular risk
                        </p>
                      </div>
                    )}

                    {/* Initial Value */}
                    {patient.pcm_initial_bp && (
                      <div className="pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-500">Starting BP: <span className="font-semibold text-gray-700">{patient.pcm_initial_bp} mmHg</span></p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Weight Goal Card */}
              {patient.pcm_target_weight && (
                <div className="bg-white rounded-xl shadow-sm p-6 border-2 border-green-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">Weight Management</h3>
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <Activity className="w-6 h-6 text-green-600" />
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Current Value */}
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Current Weight</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold text-gray-900">
                          {patient.pcm_current_weight || '--'}
                        </span>
                        <span className="text-xl text-gray-500">lbs</span>
                      </div>
                      {patient.pcm_last_weight_date && (
                        <p className="text-xs text-gray-500 mt-1">
                          Last checked: {formatDate(patient.pcm_last_weight_date)}
                        </p>
                      )}
                    </div>

                    {/* Target Value */}
                    <div className="bg-green-50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-green-900 uppercase tracking-wide mb-1">Target Goal</p>
                      <p className="text-2xl font-bold text-green-700">{patient.pcm_target_weight} lbs</p>
                    </div>

                    {/* Progress */}
                    {patient.pcm_current_weight && patient.pcm_target_weight && (
                      <div>
                        {patient.pcm_current_weight > patient.pcm_target_weight ? (
                          <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                            <p className="text-sm text-yellow-900">
                              <span className="font-semibold">{(patient.pcm_current_weight - patient.pcm_target_weight).toFixed(1)} lbs to goal</span>
                            </p>
                            <div className="mt-2 h-2 bg-yellow-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-yellow-500"
                                style={{
                                  width: `${(patient.pcm_target_weight / patient.pcm_current_weight) * 100}%`
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                            <p className="text-sm text-green-900 font-semibold">Goal Achieved!</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Initial Value */}
                    {patient.pcm_initial_weight && (
                      <div className="pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-500">Starting weight: <span className="font-semibold text-gray-700">{patient.pcm_initial_weight} lbs</span></p>
                        {patient.pcm_current_weight && (
                          <p className="text-xs text-gray-500 mt-1">
                            Change: <span className={`font-semibold ${patient.pcm_current_weight < patient.pcm_initial_weight ? 'text-green-600' : 'text-red-600'}`}>
                              {patient.pcm_current_weight < patient.pcm_initial_weight ? '-' : '+'}{Math.abs(patient.pcm_current_weight - patient.pcm_initial_weight).toFixed(1)} lbs
                            </span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Additional Clinical Goals - Grid of 6 */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Additional Diabetes Metrics</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

                {/* LDL Cholesterol */}
                <div className="border-2 border-purple-200 rounded-lg p-4 bg-purple-50">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-900 text-sm">LDL Cholesterol</h4>
                    <Activity className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-gray-900">95</span>
                    <span className="text-sm text-gray-500">mg/dL</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500" style={{width: '95%'}}></div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">Target: {'<'}100 mg/dL <span className="text-green-600 font-semibold">✓</span></p>
                </div>

                {/* HDL Cholesterol */}
                <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-900 text-sm">HDL Cholesterol</h4>
                    <Activity className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-gray-900">48</span>
                    <span className="text-sm text-gray-500">mg/dL</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-yellow-500" style={{width: '80%'}}></div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">Target: {'>'}60 mg/dL <span className="text-yellow-600 font-semibold">⚠</span></p>
                </div>

                {/* Triglycerides */}
                <div className="border-2 border-indigo-200 rounded-lg p-4 bg-indigo-50">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-900 text-sm">Triglycerides</h4>
                    <Activity className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-gray-900">142</span>
                    <span className="text-sm text-gray-500">mg/dL</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500" style={{width: '85%'}}></div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">Target: {'<'}150 mg/dL <span className="text-green-600 font-semibold">✓</span></p>
                </div>

                {/* Kidney Function (eGFR) */}
                <div className="border-2 border-teal-200 rounded-lg p-4 bg-teal-50">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-900 text-sm">Kidney Function</h4>
                    <Activity className="w-5 h-5 text-teal-600" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-gray-900">82</span>
                    <span className="text-sm text-gray-500">eGFR</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500" style={{width: '90%'}}></div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">Target: {'>'}60 <span className="text-green-600 font-semibold">✓ Normal</span></p>
                </div>

                {/* Microalbumin (Kidney) */}
                <div className="border-2 border-cyan-200 rounded-lg p-4 bg-cyan-50">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-900 text-sm">Urine Albumin</h4>
                    <Activity className="w-5 h-5 text-cyan-600" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-gray-900">18</span>
                    <span className="text-sm text-gray-500">mg/g</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500" style={{width: '95%'}}></div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">Target: {'<'}30 mg/g <span className="text-green-600 font-semibold">✓</span></p>
                </div>

                {/* BMI */}
                <div className="border-2 border-amber-200 rounded-lg p-4 bg-amber-50">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-900 text-sm">Body Mass Index</h4>
                    <Activity className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-gray-900">28.4</span>
                    <span className="text-sm text-gray-500">BMI</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-yellow-500" style={{width: '75%'}}></div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">Target: {'<'}25 <span className="text-yellow-600 font-semibold">⚠ Overweight</span></p>
                </div>

              </div>
            </div>

            {/* Program Benefits */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Your PCM Benefits</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-gray-900">Monthly Care Coordination</p>
                    <p className="text-sm text-gray-600 mt-1">At least 30 minutes of clinical staff time each month dedicated to your diabetes care</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-gray-900">24/7 Access to Care Team</p>
                    <p className="text-sm text-gray-600 mt-1">Round-the-clock access to our clinical team for diabetes-related questions</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-gray-900">Goal Tracking & Monitoring</p>
                    <p className="text-sm text-gray-600 mt-1">Regular monitoring of A1C, blood pressure, and weight with progress tracking</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-orange-50 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-gray-900">Medication Management</p>
                    <p className="text-sm text-gray-600 mt-1">Support with diabetes medications, refills, and adjustments</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Educational Resources */}
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl shadow-sm p-6 border border-indigo-200">
              <h3 className="text-lg font-bold text-gray-900 mb-3">Understanding Your Numbers</h3>
              <div className="space-y-3 text-sm text-gray-700">
                <div>
                  <p className="font-semibold text-indigo-900">A1C (Hemoglobin A1C)</p>
                  <p>Measures your average blood sugar over the past 2-3 months. Goal: below 7% for most adults with diabetes.</p>
                </div>
                <div>
                  <p className="font-semibold text-indigo-900">Blood Pressure</p>
                  <p>Target: below 130/80 mmHg. High blood pressure increases risk of heart disease and stroke in people with diabetes.</p>
                </div>
                <div>
                  <p className="font-semibold text-indigo-900">Weight Loss</p>
                  <p>Even 5-10% weight loss can significantly improve blood sugar control and reduce diabetes complications.</p>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Footer Notice */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-blue-900">
                <span className="font-semibold">Need help?</span> Contact your doctor's office at{' '}
                <span className="font-mono">{patient.phone_display}</span> or email{' '}
                {patient.email || 'your provider'}.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* PCM Consent Modal */}
      {showPCMConsent && patient && (
        <PCMConsentForm
          patientName={patient.full_name}
          patientId={patient.patient_id}
          onSubmit={handlePCMConsentSubmit}
          onCancel={() => setShowPCMConsent(false)}
        />
      )}
    </div>
  );
}
