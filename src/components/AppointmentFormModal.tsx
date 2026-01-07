import React, { useState, useEffect } from 'react';
import PatientSearchAutocomplete from './PatientSearchAutocomplete';
import { scheduleManagementService, type AppointmentFormData } from '../services/scheduleManagement.service';
import { patientSearchService, type PatientSearchResult } from '../services/patientSearch.service';
import { supabase } from '../lib/supabase';

interface AppointmentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  appointmentId?: number; // If editing existing
  initialDate?: string; // Pre-fill date
  initialProviderId?: string; // Pre-fill provider
}

interface Provider {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: string;
  specialty?: string;
}

export default function AppointmentFormModal({
  isOpen,
  onClose,
  onSuccess,
  appointmentId,
  initialDate,
  initialProviderId
}: AppointmentFormModalProps) {
  // Form state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [conflicts, setConflicts] = useState<any[]>([]);

  // Patient state
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchResult | null>(null);
  const [showNewPatientForm, setShowNewPatientForm] = useState(false);

  // New patient fields
  const [patientFirstName, setPatientFirstName] = useState('');
  const [patientLastName, setPatientLastName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [patientDOB, setPatientDOB] = useState('');
  const [patientGender, setPatientGender] = useState('');
  const [patientMRN, setPatientMRN] = useState('');

  // Appointment fields
  const [providerId, setProviderId] = useState(initialProviderId || '');
  const [scheduledDate, setScheduledDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('09:00');
  const [duration, setDuration] = useState(30);
  const [appointmentType, setAppointmentType] = useState('office-visit');
  const [visitReason, setVisitReason] = useState('');
  const [chiefDiagnosis, setChiefDiagnosis] = useState('');
  const [urgencyLevel, setUrgencyLevel] = useState<'routine' | 'urgent' | 'emergency'>('routine');
  const [isTelehealth, setIsTelehealth] = useState(false);
  const [status, setStatus] = useState('scheduled');
  const [providerNotes, setProviderNotes] = useState('');

  // Providers list
  const [providers, setProviders] = useState<Provider[]>([]);

  const isEditMode = !!appointmentId;

  // Load providers on mount
  useEffect(() => {
    if (isOpen) {
      loadProviders();
      if (appointmentId) {
        loadAppointment(appointmentId);
      }
    }
  }, [isOpen, appointmentId]);

  // Check for conflicts when time/date/provider changes
  useEffect(() => {
    if (providerId && scheduledDate && startTime) {
      checkConflicts();
    }
  }, [providerId, scheduledDate, startTime]);

  const loadProviders = async () => {
    try {
      const { data, error } = await supabase
        .from('medical_staff')
        .select('id, email, first_name, last_name, role, specialty')
        .in('role', ['doctor', 'nurse_practitioner', 'physician_assistant'])
        .eq('is_active', true)
        .order('last_name');

      if (error) throw error;

      const providerList = data.map((p: any) => ({
        ...p,
        full_name: `${p.first_name} ${p.last_name}`
      }));

      setProviders(providerList);
    } catch (err) {
      console.error('Failed to load providers:', err);
    }
  };

  const loadAppointment = async (id: number) => {
    setIsLoading(true);
    try {
      const appointment = await scheduleManagementService.getAppointment(id);
      if (appointment) {
        // Load patient if linked
        if (appointment.unified_patient_id) {
          const patient = await patientSearchService.getPatientById(appointment.unified_patient_id);
          if (patient) {
            setSelectedPatient(patient);
          }
        }

        // Set form fields
        setProviderId(appointment.provider_id);
        setScheduledDate(appointment.scheduled_date);
        setStartTime(appointment.start_time);
        setDuration(appointment.duration_minutes);
        setAppointmentType(appointment.appointment_type || 'office-visit');
        setVisitReason(appointment.visit_reason || '');
        setChiefDiagnosis(appointment.chief_diagnosis || '');
        setIsTelehealth(appointment.is_telehealth);
        setStatus(appointment.status);

        // Patient fields (if not linked)
        if (!appointment.unified_patient_id) {
          setPatientPhone(appointment.patient_phone || '');
          setPatientEmail(appointment.patient_email || '');
          setPatientDOB(appointment.patient_dob || '');
          setPatientMRN(appointment.patient_mrn || '');
        }
      }
    } catch (err) {
      setError('Failed to load appointment');
    } finally {
      setIsLoading(false);
    }
  };

  const checkConflicts = async () => {
    const conflictList = await scheduleManagementService.checkTimeSlotConflict(
      providerId,
      scheduledDate,
      startTime,
      appointmentId
    );
    setConflicts(conflictList);
  };

  const handlePatientSelect = (patient: PatientSearchResult | null) => {
    setSelectedPatient(patient);
    setShowNewPatientForm(false);
    setError(null);

    if (patient) {
      // Pre-fill patient fields
      setPatientPhone(patient.phone_display || patient.phone_primary);
      setPatientEmail(patient.email || '');
      setPatientDOB(patient.date_of_birth || '');
      setPatientGender(patient.gender || '');
      setPatientMRN(patient.mrn || '');
    }
  };

  const handleCreateNewPatient = () => {
    setShowNewPatientForm(true);
    setSelectedPatient(null);
    setError(null);
  };

  const validateForm = (): string | null => {
    if (!providerId) return 'Please select a provider';

    if (!selectedPatient && !showNewPatientForm) {
      return 'Please select or create a patient';
    }

    if (showNewPatientForm) {
      if (!patientFirstName.trim()) return 'Patient first name is required';
      if (!patientLastName.trim()) return 'Patient last name is required';
      if (!patientPhone.trim()) return 'Patient phone is required';
      if (!patientSearchService.isValidPhone(patientPhone)) {
        return 'Please enter a valid 10-digit phone number';
      }
    }

    if (!scheduledDate) return 'Please select a date';
    if (!startTime) return 'Please select a start time';
    if (!duration || duration <= 0) return 'Please enter a valid duration';

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);

    try {
      // Build form data
      const formData: AppointmentFormData = {
        provider_id: providerId,
        provider_name: providers.find(p => p.id === providerId)?.full_name || '',
        provider_specialty: providers.find(p => p.id === providerId)?.specialty,

        unified_patient_id: selectedPatient?.id,
        patient_name: selectedPatient
          ? selectedPatient.full_name
          : `${patientFirstName} ${patientLastName}`,
        patient_phone: patientPhone,
        patient_email: patientEmail,
        patient_dob: patientDOB,
        patient_mrn: patientMRN,
        patient_gender: patientGender,

        patient_first_name: showNewPatientForm ? patientFirstName : undefined,
        patient_last_name: showNewPatientForm ? patientLastName : undefined,

        scheduled_date: scheduledDate,
        start_time: startTime,
        duration_minutes: duration,
        appointment_type: appointmentType,

        chief_diagnosis: chiefDiagnosis,
        visit_reason: visitReason,
        urgency_level: urgencyLevel,

        is_telehealth: isTelehealth,
        status: status,
        provider_notes: providerNotes
      };

      // Create or update
      const result = isEditMode
        ? await scheduleManagementService.updateAppointment(appointmentId, formData)
        : await scheduleManagementService.createAppointment(formData);

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 1500);
      } else {
        setError(result.error || 'Failed to save appointment');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    // Reset form
    setSelectedPatient(null);
    setShowNewPatientForm(false);
    setPatientFirstName('');
    setPatientLastName('');
    setPatientPhone('');
    setPatientEmail('');
    setPatientDOB('');
    setPatientGender('');
    setPatientMRN('');
    setVisitReason('');
    setChiefDiagnosis('');
    setProviderNotes('');
    setError(null);
    setSuccess(false);
    setConflicts([]);
    onClose();
  };

  if (!isOpen) return null;

  // Generate time slots (7 AM to 7 PM, 15 min intervals)
  const timeSlots: string[] = [];
  for (let hour = 7; hour <= 19; hour++) {
    for (let min = 0; min < 60; min += 15) {
      if (hour === 19 && min > 0) break; // Stop at 7:00 PM
      timeSlots.push(`${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 rounded-t-lg">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">
              {isEditMode ? '✏️ Edit Appointment' : '➕ New Appointment'}
            </h2>
            <button
              onClick={handleClose}
              className="text-white hover:text-gray-200 text-3xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Success Message */}
          {success && (
            <div className="bg-green-100 border-2 border-green-500 text-green-700 px-4 py-3 rounded-lg">
              ✅ Appointment {isEditMode ? 'updated' : 'created'} successfully!
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-100 border-2 border-red-500 text-red-700 px-4 py-3 rounded-lg">
              ❌ {error}
            </div>
          )}

          {/* Conflict Warning */}
          {conflicts.length > 0 && (
            <div className="bg-yellow-100 border-2 border-yellow-500 text-yellow-800 px-4 py-3 rounded-lg">
              <div className="font-bold mb-2">⚠️ Time Slot Conflict Detected</div>
              <div className="text-sm">
                This provider already has an appointment at this time:
                <ul className="ml-4 mt-1">
                  {conflicts.map((c, i) => (
                    <li key={i}>• {c.patient_name} ({c.status})</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Patient Search Section */}
          <div className="border-2 border-gray-300 rounded-lg p-4">
            <h3 className="text-lg font-bold text-gray-900 mb-3">👤 Patient Information</h3>

            {!showNewPatientForm && (
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Search Patient *
                </label>
                <PatientSearchAutocomplete
                  onSelect={handlePatientSelect}
                  onCreateNew={handleCreateNewPatient}
                  placeholder="Search by name, phone, or MRN..."
                />

                {selectedPatient && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-300 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-green-900">{selectedPatient.full_name}</div>
                        <div className="text-sm text-green-700 space-y-1 mt-1">
                          <div>📞 {selectedPatient.phone_display || selectedPatient.phone_primary}</div>
                          {selectedPatient.email && <div>✉️ {selectedPatient.email}</div>}
                          {selectedPatient.date_of_birth && (
                            <div>🎂 {new Date(selectedPatient.date_of_birth).toLocaleDateString()}</div>
                          )}
                          {selectedPatient.mrn && (
                            <div className="font-mono">MRN: {selectedPatient.mrn}</div>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedPatient(null)}
                        className="text-green-700 hover:text-green-900 font-semibold"
                      >
                        Change
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {showNewPatientForm && (
              <div className="space-y-4 bg-blue-50 border border-blue-300 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-semibold text-blue-900">Create New Patient</h4>
                  <button
                    type="button"
                    onClick={() => setShowNewPatientForm(false)}
                    className="text-blue-700 hover:text-blue-900 text-sm font-semibold"
                  >
                    ← Back to Search
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={patientFirstName}
                      onChange={(e) => setPatientFirstName(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      value={patientLastName}
                      onChange={(e) => setPatientLastName(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Phone *
                    </label>
                    <input
                      type="tel"
                      value={patientPhone}
                      onChange={(e) => setPatientPhone(e.target.value)}
                      placeholder="(555) 123-4567"
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={patientEmail}
                      onChange={(e) => setPatientEmail(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={patientDOB}
                      onChange={(e) => setPatientDOB(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Gender
                    </label>
                    <select
                      value={patientGender}
                      onChange={(e) => setPatientGender(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500"
                    >
                      <option value="">Select...</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      MRN (Medical Record Number)
                    </label>
                    <input
                      type="text"
                      value={patientMRN}
                      onChange={(e) => setPatientMRN(e.target.value)}
                      placeholder="From Athena or EHR"
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Provider *
            </label>
            <select
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500"
              required
            >
              <option value="">Select Provider...</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.full_name} - {provider.role}
                  {provider.specialty && ` (${provider.specialty})`}
                </option>
              ))}
            </select>
          </div>

          {/* Appointment Details */}
          <div className="border-2 border-gray-300 rounded-lg p-4">
            <h3 className="text-lg font-bold text-gray-900 mb-3">📅 Appointment Details</h3>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Date *
                </label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Start Time *
                </label>
                <select
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500"
                  required
                >
                  {timeSlots.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Duration (min) *
                </label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500"
                  required
                >
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="90">1.5 hours</option>
                  <option value="120">2 hours</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Appointment Type
                </label>
                <select
                  value={appointmentType}
                  onChange={(e) => setAppointmentType(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500"
                >
                  <option value="office-visit">Office Visit</option>
                  <option value="telehealth">Telehealth</option>
                  <option value="follow-up">Follow-up</option>
                  <option value="new-patient">New Patient</option>
                  <option value="annual-physical">Annual Physical</option>
                  <option value="lab-review">Lab Review</option>
                  <option value="consultation">Consultation</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500"
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="checked-in">Checked In</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isTelehealth}
                  onChange={(e) => setIsTelehealth(e.target.checked)}
                  className="w-5 h-5 text-blue-600 border-2 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-semibold text-gray-700">
                  📹 Telehealth Visit
                </span>
              </label>

              <div className="ml-4">
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Urgency
                </label>
                <div className="flex gap-2">
                  {(['routine', 'urgent', 'emergency'] as const).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setUrgencyLevel(level)}
                      className={`px-3 py-1 rounded-lg font-semibold text-sm transition-colors ${
                        urgencyLevel === level
                          ? level === 'emergency'
                            ? 'bg-red-600 text-white'
                            : level === 'urgent'
                            ? 'bg-orange-600 text-white'
                            : 'bg-green-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Clinical Information */}
          <div className="border-2 border-gray-300 rounded-lg p-4">
            <h3 className="text-lg font-bold text-gray-900 mb-3">🩺 Clinical Information</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Visit Reason / Chief Complaint
                </label>
                <textarea
                  value={visitReason}
                  onChange={(e) => setVisitReason(e.target.value)}
                  rows={3}
                  placeholder="Why is the patient coming in? (e.g., Follow-up for diabetes management)"
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Chief Diagnosis / Conditions
                </label>
                <textarea
                  value={chiefDiagnosis}
                  onChange={(e) => setChiefDiagnosis(e.target.value)}
                  rows={2}
                  placeholder="Primary diagnoses (e.g., Type 2 Diabetes, Hypertension)"
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Provider Notes (Internal)
                </label>
                <textarea
                  value={providerNotes}
                  onChange={(e) => setProviderNotes(e.target.value)}
                  rows={2}
                  placeholder="Internal notes for the provider"
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t-2 border-gray-300">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || success}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              {isEditMode ? 'Update Appointment' : 'Create Appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
