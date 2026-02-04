import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  User,
  Phone,
  Mail,
  Calendar,
  FileText,
  Activity,
  Pill,
  AlertCircle,
  ChevronRight,
  Edit2,
  Save,
  X,
  ArrowLeft,
  Clock,
  Stethoscope,
  Headphones,
  Upload,
  CalendarDays,
  Droplets,
} from 'lucide-react';
import GlucoseTab from '../components/GlucoseTab';
import type { CGMSummary } from '../types/cgm.types';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface Patient {
  id: string;
  patient_id: string;
  phone_primary: string;
  phone_display: string;
  first_name: string;
  last_name: string;
  full_name: string;
  date_of_birth: string;
  email: string;
  mrn: string;
  active_conditions: string[];
  current_medications: any[];
  allergies: string[];
  primary_provider_name: string;
  data_sources: string[];
  data_completeness_score: number;
  created_from: string;
  created_at: string;
  has_portal_access: boolean;
  portal_last_login: string;
}

interface Dictation {
  id: string;
  visit_date: string;
  provider_name: string;
  chief_complaint: string;
  processed_note: string;
  raw_transcript: string;
  status: string;
  created_at: string;
}

interface PreVisit {
  id: string;
  conversation_id: string;
  patient_name: string;
  patient_phone: string;
  scheduled_date: string;
  concerns: any[];
  medications: any[];
  call_duration_seconds: number;
  created_at: string;
}

interface Appointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  provider_name: string;
  patient_name: string;
  patient_phone: string;
  created_at: string;
}

interface PatientChart {
  patient: Patient;
  dictations: Dictation[];
  previsits: PreVisit[];
  appointments: Appointment[];
  cgm?: CGMSummary | null;
  stats: {
    totalVisits: number;
    totalDictations: number;
    totalPreVisits: number;
    totalAppointments: number;
    lastVisitDate: string;
  };
}

interface TimelineEvent {
  id: string;
  type: 'dictation' | 'previsit' | 'appointment' | 'created';
  date: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  data: any;
}

const UnifiedPatientChart: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientChart, setPatientChart] = useState<PatientChart | null>(null);
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'dictations' | 'demographics' | 'glucose'>('overview');
  const [isEditingDemographics, setIsEditingDemographics] = useState(false);
  const [editedPatient, setEditedPatient] = useState<Partial<Patient>>({});
  const [error, setError] = useState<string | null>(null);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [lastAlertValue, setLastAlertValue] = useState<number | null>(null);

  // Glucose alert logic
  const currentGlucose = patientChart?.cgm?.currentGlucose;
  const glucoseAlert = (() => {
    if (!currentGlucose || alertDismissed) return null;
    if (currentGlucose.minutesAgo > 15) return null;
    const v = currentGlucose.glucoseValue;
    if (v < 54) return { level: 'urgent_low', label: 'URGENT LOW', color: 'bg-red-600', textColor: 'text-white', value: v };
    if (v > 300) return { level: 'very_high', label: 'VERY HIGH', color: 'bg-amber-500', textColor: 'text-white', value: v };
    return null;
  })();

  // Reset alert dismissed when glucose value changes
  useEffect(() => {
    if (currentGlucose && currentGlucose.glucoseValue !== lastAlertValue) {
      setAlertDismissed(false);
      setLastAlertValue(currentGlucose.glucoseValue);
    }
  }, [currentGlucose?.glucoseValue]);

  // Auto-dismiss alert after 30s
  useEffect(() => {
    if (!glucoseAlert) return;
    const timer = setTimeout(() => setAlertDismissed(true), 30000);
    return () => clearTimeout(timer);
  }, [glucoseAlert?.value]);

  // Check for patient ID in URL params on mount
  useEffect(() => {
    const patientId = searchParams.get('patient');
    if (!patientId) return;
    // Skip refetch if we already have this patient loaded
    const loaded = selectedPatient;
    if (loaded && (loaded.patient_id === patientId || loaded.phone_primary === patientId)) return;
    loadPatientChart(patientId);
  }, [searchParams]);

  // Search patients
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/patient-chart/search/query?q=${encodeURIComponent(searchQuery)}`
      );

      if (!response.ok) throw new Error('Search failed');

      const data = await response.json();
      setSearchResults(data.patients || []);
    } catch (err) {
      setError('Failed to search patients. Please try again.');
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Load full patient chart
  const loadPatientChart = async (identifier: string) => {
    setIsLoadingChart(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/patient-chart/${identifier}`);

      if (!response.ok) throw new Error('Failed to load patient chart');

      const data = await response.json();
      setPatientChart(data.chart);
      setSelectedPatient(data.chart.patient);
      setEditedPatient(data.chart.patient);

      // Update URL with patient ID (fall back to phone if patient_id is null)
      const urlId = data.chart.patient.patient_id || data.chart.patient.phone_primary;
      if (urlId && urlId !== identifier) {
        setSearchParams({ patient: urlId }, { replace: true });
      }
    } catch (err) {
      setError('Failed to load patient chart. Please try again.');
      console.error('Chart load error:', err);
    } finally {
      setIsLoadingChart(false);
    }
  };

  // Select patient from search results
  const handleSelectPatient = (patient: Patient) => {
    setSearchResults([]);
    setSearchQuery('');
    loadPatientChart(patient.patient_id);
  };

  // Update patient demographics
  const handleSaveDemographics = async () => {
    if (!selectedPatient) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/patient-chart/${selectedPatient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedPatient),
      });

      if (!response.ok) throw new Error('Failed to update patient');

      const data = await response.json();
      setSelectedPatient(data.patient);
      setPatientChart(prev => prev ? { ...prev, patient: data.patient } : null);
      setIsEditingDemographics(false);
      alert('Patient information updated successfully!');
    } catch (err) {
      alert('Failed to update patient information');
      console.error('Update error:', err);
    }
  };

  // Build timeline from all events
  const buildTimeline = (): TimelineEvent[] => {
    if (!patientChart) return [];

    const events: TimelineEvent[] = [];

    // Patient created event
    events.push({
      id: 'created',
      type: 'created',
      date: patientChart.patient.created_at,
      title: 'Patient Record Created',
      description: `Created from ${patientChart.patient.created_from}`,
      icon: <User className="w-5 h-5" />,
      color: 'bg-gray-500',
      data: null,
    });

    // Dictations
    patientChart.dictations.forEach(dictation => {
      events.push({
        id: dictation.id,
        type: 'dictation',
        date: dictation.visit_date || dictation.created_at,
        title: 'Medical Visit',
        description: dictation.chief_complaint || 'Dictated note',
        icon: <Stethoscope className="w-5 h-5" />,
        color: 'bg-blue-500',
        data: dictation,
      });
    });

    // Pre-visits
    patientChart.previsits.forEach(previsit => {
      events.push({
        id: previsit.id,
        type: 'previsit',
        date: previsit.scheduled_date || previsit.created_at,
        title: 'Pre-Visit Call',
        description: `${previsit.concerns?.length || 0} concerns discussed`,
        icon: <Headphones className="w-5 h-5" />,
        color: 'bg-green-500',
        data: previsit,
      });
    });

    // Appointments
    patientChart.appointments.forEach(appointment => {
      events.push({
        id: appointment.id,
        type: 'appointment',
        date: appointment.appointment_date,
        title: 'Scheduled Appointment',
        description: `${appointment.appointment_time} with ${appointment.provider_name}`,
        icon: <CalendarDays className="w-5 h-5" />,
        color: 'bg-purple-500',
        data: appointment,
      });
    });

    // Sort by date (most recent first)
    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  // Go back to search
  const handleBackToSearch = () => {
    setSelectedPatient(null);
    setPatientChart(null);
    setSearchParams({});
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Critical Glucose Alert Banner */}
      {glucoseAlert && (
        <div className={`fixed top-16 left-4 right-4 z-50 ${glucoseAlert.color} ${glucoseAlert.textColor} rounded-lg shadow-lg px-4 py-3 flex items-center justify-between animate-pulse`}>
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 flex-shrink-0" />
            <span className="font-bold text-lg">
              {glucoseAlert.label}: {glucoseAlert.value} mg/dl
            </span>
            <span className="text-sm opacity-90">
              — {selectedPatient?.full_name || 'Patient'} ({currentGlucose?.minutesAgo}m ago)
            </span>
          </div>
          <button
            onClick={() => setAlertDismissed(true)}
            className={`${glucoseAlert.textColor} hover:opacity-80 p-1`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Unified Patient Charts</h1>
              <p className="text-gray-600 mt-1">Search and view complete patient medical records</p>
            </div>
            {selectedPatient && (
              <button
                onClick={handleBackToSearch}
                className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Search</span>
              </button>
            )}
          </div>
        </div>

        {/* Search Section */}
        {!selectedPatient && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search by name, phone number, MRN, or patient ID..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={isSearching}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-medium"
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mt-6 space-y-2">
                <p className="text-sm text-gray-600 mb-3">Found {searchResults.length} patient(s)</p>
                {searchResults.map((patient) => (
                  <div
                    key={patient.id}
                    onClick={() => handleSelectPatient(patient)}
                    className="p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{patient.full_name}</h3>
                          <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                            <span className="flex items-center gap-1">
                              <Phone className="w-4 h-4" />
                              {patient.phone_display}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString() : 'N/A'}
                            </span>
                            <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                              {patient.patient_id}
                            </span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {searchQuery && !isSearching && searchResults.length === 0 && (
              <div className="mt-6 text-center text-gray-500">
                <p>No patients found matching "{searchQuery}"</p>
              </div>
            )}
          </div>
        )}

        {/* Patient Chart View */}
        {selectedPatient && patientChart && (
          <div className="space-y-6">
            {/* Patient Header Card */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                    {selectedPatient.first_name?.[0]}{selectedPatient.last_name?.[0]}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{selectedPatient.full_name}</h2>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Phone className="w-4 h-4" />
                        {selectedPatient.phone_display}
                      </span>
                      {selectedPatient.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          {selectedPatient.email}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        DOB: {selectedPatient.date_of_birth ? new Date(selectedPatient.date_of_birth).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="font-mono text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        {selectedPatient.patient_id}
                      </span>
                      {selectedPatient.mrn && (
                        <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                          MRN: {selectedPatient.mrn}
                        </span>
                      )}
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                        {selectedPatient.data_sources.join(', ')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Primary Provider</p>
                  <p className="font-semibold text-gray-900">{selectedPatient.primary_provider_name || 'Not assigned'}</p>
                  {selectedPatient.has_portal_access && (
                    <p className="text-xs text-green-600 mt-1">✓ Portal Access Enabled</p>
                  )}
                </div>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Visits</p>
                    <p className="text-2xl font-bold text-gray-900">{patientChart.stats.totalVisits}</p>
                  </div>
                  <Activity className="w-8 h-8 text-blue-500" />
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Dictations</p>
                    <p className="text-2xl font-bold text-gray-900">{patientChart.stats.totalDictations}</p>
                  </div>
                  <FileText className="w-8 h-8 text-green-500" />
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Pre-Visits</p>
                    <p className="text-2xl font-bold text-gray-900">{patientChart.stats.totalPreVisits}</p>
                  </div>
                  <Headphones className="w-8 h-8 text-purple-500" />
                </div>
              </div>
              {patientChart.cgm?.currentGlucose ? (
                <div
                  className="bg-white rounded-lg shadow p-4 cursor-pointer hover:ring-2 hover:ring-blue-300 transition-all"
                  onClick={() => setActiveTab('glucose')}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Glucose</p>
                      <p className="text-2xl font-bold" style={{
                        color: patientChart.cgm.currentGlucose.glucoseValue < 70 ? '#ef4444'
                          : patientChart.cgm.currentGlucose.glucoseValue > 180 ? '#f59e0b'
                          : '#22c55e'
                      }}>
                        {patientChart.cgm.currentGlucose.glucoseValue}
                        <span className="text-sm ml-1">{patientChart.cgm.currentGlucose.trendArrow}</span>
                      </p>
                    </div>
                    <Droplets className="w-8 h-8 text-teal-500" />
                  </div>
                  {/* Mini TIR bar + A1C */}
                  {patientChart.cgm.stats14day && (
                    <div className="mt-2">
                      <div className="flex h-2 rounded-full overflow-hidden">
                        <div className="bg-red-400" style={{ width: `${patientChart.cgm.stats14day.timeBelowRangePercent}%` }} />
                        <div className="bg-green-400" style={{ width: `${patientChart.cgm.stats14day.timeInRangePercent}%` }} />
                        <div className="bg-amber-400" style={{ width: `${patientChart.cgm.stats14day.timeAboveRangePercent}%` }} />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-xs text-gray-500">TIR {patientChart.cgm.stats14day.timeInRangePercent}%</span>
                        <span className="text-xs text-gray-500">A1C ~{patientChart.cgm.stats14day.estimatedA1c}%</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Last Visit</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {patientChart.stats.lastVisitDate
                          ? new Date(patientChart.stats.lastVisitDate).toLocaleDateString()
                          : 'N/A'}
                      </p>
                    </div>
                    <Clock className="w-8 h-8 text-orange-500" />
                  </div>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-lg shadow-lg">
              <div className="border-b border-gray-200">
                <div className="flex">
                  {[
                    { id: 'overview', label: 'Overview', icon: <Activity className="w-4 h-4" /> },
                    ...(patientChart.cgm?.configured ? [{ id: 'glucose', label: 'Glucose', icon: <Droplets className="w-4 h-4" /> }] : []),
                    { id: 'timeline', label: 'Timeline', icon: <Clock className="w-4 h-4" /> },
                    { id: 'dictations', label: 'Dictations', icon: <FileText className="w-4 h-4" /> },
                    { id: 'demographics', label: 'Demographics', icon: <User className="w-4 h-4" /> },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${
                        activeTab === tab.id
                          ? 'text-blue-600 border-b-2 border-blue-600'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-6">
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Active Conditions */}
                    {selectedPatient.active_conditions && selectedPatient.active_conditions.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <AlertCircle className="w-5 h-5 text-red-500" />
                          Active Conditions
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedPatient.active_conditions.map((condition, idx) => (
                            <span key={idx} className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-sm">
                              {condition}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Current Medications */}
                    {selectedPatient.current_medications && selectedPatient.current_medications.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <Pill className="w-5 h-5 text-blue-500" />
                          Current Medications
                        </h3>
                        <div className="space-y-2">
                          {selectedPatient.current_medications.map((med: any, idx) => (
                            <div key={idx} className="p-3 bg-blue-50 rounded-lg">
                              <p className="font-medium text-blue-900">
                                {typeof med === 'string' ? med : med.medication || med.name}
                              </p>
                              {typeof med === 'object' && (med.dosage || med.frequency) && (
                                <p className="text-sm text-blue-700 mt-1">
                                  {med.dosage} {med.frequency && `- ${med.frequency}`}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Allergies */}
                    {selectedPatient.allergies && selectedPatient.allergies.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <AlertCircle className="w-5 h-5 text-yellow-500" />
                          Allergies
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedPatient.allergies.map((allergy, idx) => (
                            <span key={idx} className="px-3 py-1 bg-yellow-50 text-yellow-700 rounded-full text-sm font-medium">
                              {allergy}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recent Activity */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Recent Activity</h3>
                      <div className="space-y-3">
                        {patientChart.dictations.slice(0, 3).map((dictation) => (
                          <div key={dictation.id} className="p-4 bg-gray-50 rounded-lg">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3">
                                <Stethoscope className="w-5 h-5 text-blue-500 mt-1" />
                                <div>
                                  <p className="font-medium text-gray-900">{dictation.chief_complaint || 'Medical Visit'}</p>
                                  <p className="text-sm text-gray-600 mt-1">
                                    {dictation.provider_name} • {new Date(dictation.visit_date).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              <span className={`px-2 py-1 text-xs rounded ${
                                dictation.status === 'completed'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-yellow-100 text-yellow-700'
                              }`}>
                                {dictation.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Glucose Tab */}
                {activeTab === 'glucose' && patientChart.cgm?.configured && (
                  <GlucoseTab
                    patientPhone={selectedPatient.phone_primary}
                    currentGlucose={patientChart.cgm.currentGlucose}
                    stats14day={patientChart.cgm.stats14day}
                    comparison={patientChart.cgm.comparison}
                  />
                )}

                {/* Timeline Tab */}
                {activeTab === 'timeline' && (
                  <div className="space-y-4">
                    {buildTimeline().map((event, idx) => (
                      <div key={event.id} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className={`w-10 h-10 ${event.color} rounded-full flex items-center justify-center text-white`}>
                            {event.icon}
                          </div>
                          {idx < buildTimeline().length - 1 && <div className="w-0.5 h-full bg-gray-200 my-2" />}
                        </div>
                        <div className="flex-1 pb-8">
                          <div className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-semibold text-gray-900">{event.title}</h4>
                                <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                              </div>
                              <span className="text-xs text-gray-500">
                                {new Date(event.date).toLocaleDateString()}
                              </span>
                            </div>
                            {event.data && event.type === 'dictation' && (
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <p className="text-sm text-gray-700 line-clamp-3">{event.data.processed_note}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Dictations Tab */}
                {activeTab === 'dictations' && (
                  <div className="space-y-4">
                    {patientChart.dictations.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <p>No dictations found for this patient</p>
                      </div>
                    ) : (
                      patientChart.dictations.map((dictation) => (
                        <div key={dictation.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-semibold text-gray-900">{dictation.chief_complaint || 'Medical Visit'}</h4>
                              <p className="text-sm text-gray-600 mt-1">
                                {dictation.provider_name} • {new Date(dictation.visit_date).toLocaleDateString()}
                              </p>
                            </div>
                            <span className={`px-3 py-1 text-sm rounded ${
                              dictation.status === 'completed'
                                ? 'bg-green-100 text-green-700'
                                : dictation.status === 'draft'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {dictation.status}
                            </span>
                          </div>
                          <div className="bg-gray-50 rounded p-3">
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{dictation.processed_note}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Demographics Tab */}
                {activeTab === 'demographics' && (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-gray-900">Patient Information</h3>
                      {!isEditingDemographics ? (
                        <button
                          onClick={() => setIsEditingDemographics(true)}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          <Edit2 className="w-4 h-4" />
                          Edit
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveDemographics}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                          >
                            <Save className="w-4 h-4" />
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setIsEditingDemographics(false);
                              setEditedPatient(selectedPatient);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                          >
                            <X className="w-4 h-4" />
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {[
                        { key: 'first_name', label: 'First Name', type: 'text' },
                        { key: 'last_name', label: 'Last Name', type: 'text' },
                        { key: 'date_of_birth', label: 'Date of Birth', type: 'date' },
                        { key: 'email', label: 'Email', type: 'email' },
                        { key: 'phone_primary', label: 'Phone Number', type: 'tel' },
                        { key: 'mrn', label: 'MRN', type: 'text' },
                      ].map((field) => (
                        <div key={field.key}>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {field.label}
                          </label>
                          {isEditingDemographics ? (
                            <input
                              type={field.type}
                              value={(editedPatient as any)[field.key] || ''}
                              onChange={(e) =>
                                setEditedPatient({ ...editedPatient, [field.key]: e.target.value })
                              }
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          ) : (
                            <p className="px-4 py-2 bg-gray-50 rounded-lg text-gray-900">
                              {(selectedPatient as any)[field.key] || 'Not provided'}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {isLoadingChart && (
          <div className="text-center py-12">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-lg font-medium text-gray-700">Loading patient chart...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UnifiedPatientChart;
