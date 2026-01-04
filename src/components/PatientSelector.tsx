/**
 * PatientSelector Component
 *
 * Pre-dictation patient selection interface with:
 * - Search by phone, name, or MRN
 * - Quick selection from today's schedule
 * - Create new patient on-the-fly
 * - Duplicate detection and prevention
 *
 * Usage:
 * <PatientSelector
 *   onPatientSelected={(patient) => console.log('Selected:', patient)}
 *   onCancel={() => console.log('Cancelled')}
 * />
 */

import { useState, useEffect } from 'react';
import { Search, Calendar, UserPlus, Phone, User, FileText, Loader2 } from 'lucide-react';
import { supabaseService } from '../services/supabase.service';

interface Patient {
  id: string;
  tshla_id?: string;
  mrn?: string;
  first_name: string;
  last_name: string;
  phone_primary: string;
  phone_display?: string;
  date_of_birth?: string;
  email?: string;
}

interface ScheduledAppointment {
  id: string;
  patient_id: string;
  patient_name: string;
  patient_phone: string;
  scheduled_date: string;
  scheduled_time: string;
  appointment_type: string;
  patient?: Patient;
}

interface PatientSelectorProps {
  onPatientSelected: (patient: Patient) => void;
  onCancel: () => void;
  preloadSchedule?: boolean;
}

export default function PatientSelector({
  onPatientSelected,
  onCancel,
  preloadSchedule = true
}: PatientSelectorProps) {
  const [activeTab, setActiveTab] = useState<'search' | 'schedule' | 'create'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [todaysSchedule, setTodaysSchedule] = useState<ScheduledAppointment[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);

  // New patient form
  const [newPatient, setNewPatient] = useState({
    first_name: '',
    last_name: '',
    phone_primary: '',
    date_of_birth: '',
    email: ''
  });
  const [isCreating, setIsCreating] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<Patient | null>(null);

  // Load today's schedule on mount
  useEffect(() => {
    if (preloadSchedule && activeTab === 'schedule') {
      loadTodaysSchedule();
    }
  }, [activeTab, preloadSchedule]);

  // Search patients as user types
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (searchQuery.length >= 2) {
        searchPatients();
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Check for duplicates when phone is entered
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (newPatient.phone_primary.length >= 10) {
        checkForDuplicates();
      } else {
        setDuplicateWarning(null);
      }
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [newPatient.phone_primary]);

  /**
   * Search patients by phone, name, or MRN
   * Uses existing patientMatching service for phone-first search
   */
  const searchPatients = async () => {
    setIsSearching(true);
    try {
      const query = searchQuery.trim();

      // Use API endpoint that leverages patientMatching.service.js
      const response = await fetch(`/api/patient-chart/search/query?q=${encodeURIComponent(query)}`);

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const { patients } = await response.json();
      setSearchResults(patients || []);

    } catch (error) {
      console.error('Search error:', error);
      // Fallback to direct Supabase search if API fails
      await searchPatientsFallback();
    } finally {
      setIsSearching(false);
    }
  };

  /**
   * Fallback search using Supabase directly
   */
  const searchPatientsFallback = async () => {
    try {
      const query = searchQuery.trim().toLowerCase();
      const isPhone = /^\d+$/.test(query.replace(/[-()\s]/g, ''));

      let results: Patient[] = [];

      if (isPhone) {
        const normalizedPhone = query.replace(/\D/g, '');
        const { data, error } = await supabaseService.client
          .from('unified_patients')
          .select('*')
          .or(`phone_primary.ilike.%${normalizedPhone}%,phone_display.ilike.%${normalizedPhone}%`)
          .limit(10);

        if (!error && data) {
          results = data;
        }
      } else {
        const { data, error } = await supabaseService.client
          .from('unified_patients')
          .select('*')
          .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,mrn.ilike.%${query}%,tshla_id.ilike.%${query}%`)
          .limit(10);

        if (!error && data) {
          results = data;
        }
      }

      setSearchResults(results);
    } catch (error) {
      console.error('Fallback search error:', error);
    }
  };

  /**
   * Load today's scheduled appointments
   */
  const loadTodaysSchedule = async () => {
    setIsLoadingSchedule(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabaseService.client
        .from('schedule')
        .select(`
          *,
          patient:unified_patients(*)
        `)
        .eq('scheduled_date', today)
        .order('scheduled_time', { ascending: true });

      if (!error && data) {
        setTodaysSchedule(data);
      }
    } catch (error) {
      console.error('Error loading schedule:', error);
    } finally {
      setIsLoadingSchedule(false);
    }
  };

  /**
   * Check for duplicate patients by phone
   */
  const checkForDuplicates = async () => {
    const normalizedPhone = newPatient.phone_primary.replace(/\D/g, '');

    try {
      const { data, error } = await supabaseService.client
        .from('unified_patients')
        .select('*')
        .or(`phone_primary.ilike.%${normalizedPhone}%`)
        .limit(1);

      if (!error && data && data.length > 0) {
        setDuplicateWarning(data[0]);
      } else {
        setDuplicateWarning(null);
      }
    } catch (error) {
      console.error('Duplicate check error:', error);
    }
  };

  /**
   * Create new patient
   * Uses existing patientMatching.service.js for creation and duplicate prevention
   */
  const createPatient = async () => {
    setIsCreating(true);
    try {
      // Use API endpoint that leverages patientMatching.service.js
      // This service handles:
      // - TSHLA ID generation
      // - Duplicate checking
      // - Phone normalization
      // - Portal PIN generation
      const response = await fetch('/api/patient-chart/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: newPatient.phone_primary,
          patientData: {
            first_name: newPatient.first_name,
            last_name: newPatient.last_name,
            date_of_birth: newPatient.date_of_birth,
            email: newPatient.email
          },
          source: 'dictation'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create patient');
      }

      const { patient } = await response.json();

      if (patient) {
        console.log('✅ Created patient:', patient);
        onPatientSelected(patient);
      }
    } catch (error) {
      console.error('Error creating patient:', error);
      alert(`Failed to create patient: ${error.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  /**
   * Format phone number for display
   */
  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <h2 className="text-2xl font-bold">Select Patient</h2>
          <p className="text-blue-100 mt-1">Search, select from schedule, or create new patient</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 px-6 py-4 font-medium transition-colors ${
              activeTab === 'search'
                ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <Search className="w-5 h-5 inline-block mr-2" />
            Search Patients
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex-1 px-6 py-4 font-medium transition-colors ${
              activeTab === 'schedule'
                ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <Calendar className="w-5 h-5 inline-block mr-2" />
            Today's Schedule
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 px-6 py-4 font-medium transition-colors ${
              activeTab === 'create'
                ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <UserPlus className="w-5 h-5 inline-block mr-2" />
            Create New Patient
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Search Tab */}
          {activeTab === 'search' && (
            <div>
              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by phone, name, or MRN..."
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-lg"
                  autoFocus
                />
                {isSearching && (
                  <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
                )}
              </div>

              {searchResults.length === 0 && searchQuery.length >= 2 && !isSearching && (
                <div className="text-center py-12 text-gray-500">
                  <User className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg">No patients found</p>
                  <p className="text-sm mt-2">Try searching by phone number, name, or MRN</p>
                </div>
              )}

              {searchResults.length === 0 && searchQuery.length < 2 && (
                <div className="text-center py-12 text-gray-400">
                  <Search className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg">Start typing to search</p>
                  <p className="text-sm mt-2">Enter at least 2 characters</p>
                </div>
              )}

              <div className="space-y-2">
                {searchResults.map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => onPatientSelected(patient)}
                    className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-lg text-gray-900">
                          {patient.first_name} {patient.last_name}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <Phone className="w-4 h-4" />
                            {formatPhone(patient.phone_primary)}
                          </span>
                          {patient.tshla_id && (
                            <span className="flex items-center gap-1">
                              <FileText className="w-4 h-4" />
                              {patient.tshla_id}
                            </span>
                          )}
                          {patient.mrn && (
                            <span className="text-gray-500">
                              MRN: {patient.mrn}
                            </span>
                          )}
                        </div>
                        {patient.date_of_birth && (
                          <div className="text-sm text-gray-500 mt-1">
                            DOB: {new Date(patient.date_of_birth).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Schedule Tab */}
          {activeTab === 'schedule' && (
            <div>
              {isLoadingSchedule ? (
                <div className="text-center py-12">
                  <Loader2 className="w-12 h-12 mx-auto mb-4 text-blue-600 animate-spin" />
                  <p className="text-gray-600">Loading today's schedule...</p>
                </div>
              ) : todaysSchedule.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg">No appointments scheduled for today</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {todaysSchedule.map((appt) => (
                    <button
                      key={appt.id}
                      onClick={() => appt.patient && onPatientSelected(appt.patient)}
                      className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded">
                              {appt.scheduled_time}
                            </span>
                            <span className="font-semibold text-lg text-gray-900">
                              {appt.patient_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Phone className="w-4 h-4" />
                              {formatPhone(appt.patient_phone)}
                            </span>
                            <span className="text-gray-500">
                              {appt.appointment_type}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Create Tab */}
          {activeTab === 'create' && (
            <div className="max-w-2xl mx-auto">
              {duplicateWarning && (
                <div className="mb-6 p-4 bg-yellow-50 border-2 border-yellow-400 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="text-yellow-600 mt-0.5">⚠️</div>
                    <div className="flex-1">
                      <div className="font-semibold text-yellow-900">Possible Duplicate Patient</div>
                      <p className="text-sm text-yellow-800 mt-1">
                        A patient with phone number {formatPhone(duplicateWarning.phone_primary)} already exists:
                        <strong> {duplicateWarning.first_name} {duplicateWarning.last_name}</strong>
                      </p>
                      <button
                        onClick={() => onPatientSelected(duplicateWarning)}
                        className="mt-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm font-medium"
                      >
                        Use Existing Patient
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={newPatient.first_name}
                      onChange={(e) => setNewPatient({ ...newPatient, first_name: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      value={newPatient.last_name}
                      onChange={(e) => setNewPatient({ ...newPatient, last_name: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    value={newPatient.phone_primary}
                    onChange={(e) => setNewPatient({ ...newPatient, phone_primary: e.target.value })}
                    placeholder="(555) 123-4567"
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={newPatient.date_of_birth}
                    onChange={(e) => setNewPatient({ ...newPatient, date_of_birth: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newPatient.email}
                    onChange={(e) => setNewPatient({ ...newPatient, email: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <button
                  onClick={createPatient}
                  disabled={!newPatient.first_name || !newPatient.last_name || !newPatient.phone_primary || isCreating}
                  className="w-full mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium text-lg transition-colors"
                >
                  {isCreating ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Creating Patient...
                    </span>
                  ) : (
                    'Create Patient'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
