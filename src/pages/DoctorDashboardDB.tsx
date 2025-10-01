import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { unifiedAuthService } from '../services/unifiedAuth.service';
import AppointmentAPI from '../api/appointments.api';
import type { Appointment, AppointmentCreateData } from '../services/appointment.service';
import OrderStatusPanel from '../components/OrderStatusPanel';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

// Generate time slots for the day
const generateTimeSlots = () => {
  const slots = [];
  // Morning slots (9 AM to 12 PM)
  for (let hour = 9; hour < 12; hour++) {
    slots.push(`${hour}:00 AM`);
    slots.push(`${hour}:30 AM`);
  }
  // Noon
  slots.push('12:00 PM');
  slots.push('12:30 PM');
  // Afternoon slots (1 PM to 5 PM)
  for (let hour = 1; hour <= 5; hour++) {
    slots.push(`${hour}:00 PM`);
    slots.push(`${hour}:30 PM`);
  }
  return slots;
};

export default function DoctorDashboardDB() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const currentUser = unifiedAuthService.getCurrentUser();
  const currentDoctor = currentUser?.name || 'Dr. Smith';

  // State for appointments from database
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Current date for appointments
  const [selectedDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    scheduled: 0,
    cancelled: 0,
    noShow: 0,
  });

  // Form states
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [newPatient, setNewPatient] = useState<AppointmentCreateData>({
    patient_name: '',
    patient_mrn: '',
    appointment_date: selectedDate,
    appointment_time: '',
    patient_phone: '',
    patient_email: '',
    patient_dob: '',
    chief_complaint: '',
    visit_type: 'follow-up',
  });

  const timeSlots = generateTimeSlots();

  // Load appointments from database
  const loadAppointments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch appointments for the selected date
      const [appointmentData, statsData] = await Promise.all([
        AppointmentAPI.getMyAppointments(selectedDate),
        AppointmentAPI.getAppointmentStats(selectedDate),
      ]);

      setAppointments(appointmentData);
      setStats(statsData);
    } catch (err) {
      logError('DoctorDashboardDB', 'Error message', {});
      setError('Failed to load appointments. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  // Initial load and periodic refresh
  useEffect(() => {
    loadAppointments();

    // Auto-refresh every 30 seconds for real-time updates
    const interval = setInterval(() => {
      setRefreshing(true);
      loadAppointments().finally(() => setRefreshing(false));
    }, 30000);

    return () => clearInterval(interval);
  }, [loadAppointments]);

  // Start dictation for a patient
  const startDictation = (patientId: string) => {
    navigate(`/dictation/${patientId}`);
  };

  // Quick add placeholder patient to a time slot
  const quickAddPatient = async (timeSlot: string) => {
    try {
      const newAppointment = await AppointmentAPI.quickAddAppointment(selectedDate, timeSlot);

      // Update local state immediately for responsive UI
      setAppointments(prev =>
        [...prev, newAppointment].sort((a, b) =>
          a.appointment_slot.localeCompare(b.appointment_slot)
        )
      );

      // Update stats
      setStats(prev => ({ ...prev, total: prev.total + 1, scheduled: prev.scheduled + 1 }));
    } catch (err) {
      logError('DoctorDashboardDB', 'Error message', {});
      alert('Failed to add appointment. Please try again.');
    }
  };

  // Edit appointment information
  const editAppointmentInfo = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setNewPatient({
      patient_name: appointment.patient_name.startsWith('Patient @')
        ? ''
        : appointment.patient_name,
      patient_mrn: appointment.patient_mrn.startsWith('TBD-') ? '' : appointment.patient_mrn,
      appointment_date: appointment.appointment_date,
      appointment_time: appointment.appointment_time,
      patient_phone: appointment.patient_phone || '',
      patient_email: appointment.patient_email || '',
      patient_dob: appointment.patient_dob || '',
      chief_complaint: appointment.chief_complaint || '',
      visit_type: appointment.visit_type || 'follow-up',
    });
    setShowAddPatient(true);
  };

  // Add or update appointment
  const saveAppointment = async () => {
    if (!newPatient.appointment_time) {
      alert('Please select an appointment time');
      return;
    }

    try {
      let savedAppointment: Appointment;

      if (editingAppointment) {
        // Update existing appointment
        savedAppointment = await AppointmentAPI.updateAppointment(
          editingAppointment.id,
          newPatient
        );

        // Update local state
        setAppointments(prev =>
          prev.map(a => (a.id === editingAppointment.id ? savedAppointment : a))
        );
      } else {
        // Create new appointment
        savedAppointment = await AppointmentAPI.createAppointment({
          ...newPatient,
          patient_name: newPatient.patient_name || `Patient @ ${newPatient.appointment_time}`,
          patient_mrn: newPatient.patient_mrn || `MRN${Date.now().toString().slice(-6)}`,
        });

        // Update local state
        setAppointments(prev =>
          [...prev, savedAppointment].sort((a, b) =>
            a.appointment_slot.localeCompare(b.appointment_slot)
          )
        );

        // Update stats
        setStats(prev => ({ ...prev, total: prev.total + 1, scheduled: prev.scheduled + 1 }));
      }

      // Reset form
      setNewPatient({
        patient_name: '',
        patient_mrn: '',
        appointment_date: selectedDate,
        appointment_time: '',
        patient_phone: '',
        patient_email: '',
        patient_dob: '',
        chief_complaint: '',
        visit_type: 'follow-up',
      });
      setShowAddPatient(false);
      setEditingAppointment(null);
    } catch (err: any) {
      logError('DoctorDashboardDB', 'Error message', {});
      alert(err.message || 'Failed to save appointment. Please try again.');
    }
  };

  // Remove appointment
  const removeAppointment = async (appointmentId: string) => {
    if (!confirm('Are you sure you want to cancel this appointment?')) {
      return;
    }

    try {
      await AppointmentAPI.cancelAppointment(appointmentId, 'Cancelled by doctor');

      // Update local state
      setAppointments(prev => prev.filter(a => a.id !== appointmentId));

      // Update stats
      setStats(prev => ({
        ...prev,
        total: prev.total - 1,
        scheduled: Math.max(0, prev.scheduled - 1),
        cancelled: prev.cancelled + 1,
      }));
    } catch (err) {
      logError('DoctorDashboardDB', 'Error message', {});
      alert('Failed to cancel appointment. Please try again.');
    }
  };

  // Update appointment status
  const updateAppointmentStatus = async (appointmentId: string, status: Appointment['status']) => {
    try {
      await AppointmentAPI.updateAppointmentStatus(appointmentId, status);

      // Update local state
      setAppointments(prev => prev.map(a => (a.id === appointmentId ? { ...a, status } : a)));

      // Update stats based on status change
      if (status === 'completed') {
        setStats(prev => ({
          ...prev,
          scheduled: Math.max(0, prev.scheduled - 1),
          completed: prev.completed + 1,
        }));
      }
    } catch (err) {
      logError('DoctorDashboardDB', 'Error message', {});
      alert('Failed to update status. Please try again.');
    }
  };

  // Get occupied time slots
  const getOccupiedSlots = () => {
    return appointments.map(a => a.appointment_time);
  };

  const occupiedSlots = getOccupiedSlots();

  if (loading && !refreshing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading appointments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Compact Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-4">
          <div className="flex justify-between items-center h-12">
            <div className="flex items-center space-x-6">
              <h1 className="text-lg font-semibold">TSHLA Medical</h1>
              <span className="text-xs text-gray-500">
                {currentDoctor?.name || user?.name || 'Dr. Provider'}
                {currentDoctor?.specialty && ` • ${currentDoctor.specialty}`}
              </span>
              {refreshing && (
                <span className="text-xs text-blue-600 animate-pulse">Syncing...</span>
              )}
            </div>

            {/* Quick Note Button - Center */}
            <button
              onClick={() => navigate('/quick-note')}
              className="px-4 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
            >
              ⚡ Quick Note
            </button>

            {/* Header Links */}
            <div className="flex items-center space-x-4">
              <button
                onClick={loadAppointments}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                disabled={refreshing}
              >
                🔄 Refresh
              </button>
              <button
                onClick={() => navigate('/doctor/templates')}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                📝 Templates
              </button>
              <button
                onClick={() => navigate('/doctor/profile')}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                ⚙️ Profile
              </button>
              <button onClick={logout} className="text-xs text-gray-600 hover:text-gray-900">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 m-4">
          <div className="flex">
            <div className="flex-shrink-0">⚠️</div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Two Column Layout */}
      <div className="flex">
        {/* Left Side - Today's Schedule with Time Slots */}
        <div className="w-1/2 p-4">
          <div className="mb-3 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Today's Schedule</h2>
              <p className="text-xs text-gray-600">
                {new Date(selectedDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditingAppointment(null);
                  setNewPatient({
                    patient_name: '',
                    patient_mrn: '',
                    appointment_date: selectedDate,
                    appointment_time: '',
                    patient_phone: '',
                    patient_email: '',
                    patient_dob: '',
                    chief_complaint: '',
                    visit_type: 'follow-up',
                  });
                  setShowAddPatient(true);
                }}
                className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition"
              >
                + Full Add
              </button>
            </div>
          </div>

          {/* Time Slot Grid with Appointments */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-3 py-2 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-medium text-gray-900">Time Slots</h3>
                <span className="text-xs text-gray-500">
                  {appointments.length} appointments scheduled
                </span>
              </div>
            </div>
            <div className="max-h-[calc(100vh-200px)] overflow-y-auto p-2">
              <div className="space-y-1">
                {timeSlots.map(slot => {
                  const appointment = appointments.find(a => a.appointment_time === slot);
                  const isOccupied = !!appointment;

                  return (
                    <div
                      key={slot}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition"
                    >
                      <div className="w-20 text-xs font-medium text-gray-600">{slot}</div>

                      {isOccupied && appointment ? (
                        <div
                          className={`flex-1 rounded-lg p-2 border ${
                            appointment.status === 'completed'
                              ? 'bg-green-50 border-green-200'
                              : appointment.status === 'in-progress'
                                ? 'bg-yellow-50 border-yellow-200'
                                : appointment.status === 'cancelled'
                                  ? 'bg-red-50 border-red-200'
                                  : 'bg-blue-50 border-blue-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p
                                className={`text-sm font-medium ${
                                  appointment.patient_name.startsWith('Patient @')
                                    ? 'text-gray-500 italic'
                                    : 'text-gray-900'
                                }`}
                              >
                                {appointment.patient_name}
                                {appointment.patient_name.startsWith('Patient @') &&
                                  ' (Placeholder)'}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <p className="text-xs text-gray-500">{appointment.patient_mrn}</p>
                                {appointment.status !== 'scheduled' && (
                                  <span
                                    className={`text-xs px-2 py-0.5 rounded-full ${
                                      appointment.status === 'completed'
                                        ? 'bg-green-100 text-green-700'
                                        : appointment.status === 'in-progress'
                                          ? 'bg-yellow-100 text-yellow-700'
                                          : appointment.status === 'cancelled'
                                            ? 'bg-red-100 text-red-700'
                                            : 'bg-gray-100 text-gray-700'
                                    }`}
                                  >
                                    {appointment.status}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {appointment.status === 'scheduled' && (
                                <button
                                  onClick={() =>
                                    updateAppointmentStatus(appointment.id, 'in-progress')
                                  }
                                  className="px-2 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600"
                                  title="Start appointment"
                                >
                                  ▶️
                                </button>
                              )}
                              {appointment.status === 'in-progress' && (
                                <button
                                  onClick={() =>
                                    updateAppointmentStatus(appointment.id, 'completed')
                                  }
                                  className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                                  title="Complete appointment"
                                >
                                  ✓
                                </button>
                              )}
                              <button
                                onClick={() => editAppointmentInfo(appointment)}
                                className="px-2 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600"
                                title="Edit patient info"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => startDictation(appointment.patient_id)}
                                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                              >
                                🎤
                              </button>
                              <button
                                onClick={() => removeAppointment(appointment.id)}
                                className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                                title="Cancel"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 border-2 border-dashed border-gray-300 rounded-lg p-2 hover:border-green-400 transition">
                          <button
                            onClick={() => quickAddPatient(slot)}
                            className="w-full text-left flex items-center justify-between group"
                          >
                            <span className="text-xs text-gray-400 group-hover:text-green-600">
                              Available slot
                            </span>
                            <span className="text-xs text-green-600 opacity-0 group-hover:opacity-100 transition">
                              + Quick Add
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="bg-white rounded-lg shadow p-3">
              <h4 className="text-xs font-medium text-gray-500">Total</h4>
              <p className="mt-1 text-xl font-bold text-blue-600">{stats.total}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-3">
              <h4 className="text-xs font-medium text-gray-500">Completed</h4>
              <p className="mt-1 text-xl font-bold text-green-600">{stats.completed}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-3">
              <h4 className="text-xs font-medium text-gray-500">Available</h4>
              <p className="mt-1 text-xl font-bold text-gray-600">
                {timeSlots.length - appointments.length}
              </p>
            </div>
          </div>
        </div>

        {/* Right Side - Add/Edit Patient Form */}
        <div className="w-1/2 p-4">
          {showAddPatient ? (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">
                {editingAppointment ? 'Edit Appointment' : 'Add New Appointment'}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Patient Name *
                  </label>
                  <input
                    type="text"
                    value={newPatient.patient_name}
                    onChange={e => setNewPatient({ ...newPatient, patient_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter patient name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">MRN</label>
                    <input
                      type="text"
                      value={newPatient.patient_mrn}
                      onChange={e => setNewPatient({ ...newPatient, patient_mrn: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Auto-generated"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Appointment Time *
                    </label>
                    <select
                      value={newPatient.appointment_time}
                      onChange={e =>
                        setNewPatient({ ...newPatient, appointment_time: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select time</option>
                      {timeSlots.map(slot => (
                        <option
                          key={slot}
                          value={slot}
                          disabled={
                            occupiedSlots.includes(slot) &&
                            (!editingAppointment || editingAppointment.appointment_time !== slot)
                          }
                        >
                          {slot}{' '}
                          {occupiedSlots.includes(slot) &&
                          (!editingAppointment || editingAppointment.appointment_time !== slot)
                            ? '(Occupied)'
                            : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={newPatient.patient_phone || ''}
                      onChange={e =>
                        setNewPatient({ ...newPatient, patient_phone: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="(555) 123-4567"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={newPatient.patient_dob || ''}
                      onChange={e => setNewPatient({ ...newPatient, patient_dob: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={newPatient.patient_email || ''}
                    onChange={e => setNewPatient({ ...newPatient, patient_email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="patient@email.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Visit Type</label>
                  <select
                    value={newPatient.visit_type}
                    onChange={e =>
                      setNewPatient({ ...newPatient, visit_type: e.target.value as any })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="follow-up">Follow-up</option>
                    <option value="new-patient">New Patient</option>
                    <option value="urgent">Urgent</option>
                    <option value="telehealth">Telehealth</option>
                    <option value="procedure">Procedure</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Chief Complaint
                  </label>
                  <textarea
                    value={newPatient.chief_complaint || ''}
                    onChange={e =>
                      setNewPatient({ ...newPatient, chief_complaint: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={2}
                    placeholder="Reason for visit..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={saveAppointment}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
                  >
                    {editingAppointment ? 'Update Appointment' : 'Add Appointment'}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddPatient(false);
                      setEditingAppointment(null);
                      setNewPatient({
                        patient_name: '',
                        patient_mrn: '',
                        appointment_date: selectedDate,
                        appointment_time: '',
                        patient_phone: '',
                        patient_email: '',
                        patient_dob: '',
                        chief_complaint: '',
                        visit_type: 'follow-up',
                      });
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Recent Appointments */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Recent Appointments</h3>
                <div className="space-y-3">
                  {appointments.slice(0, 5).map(appointment => (
                    <div
                      key={appointment.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-sm">{appointment.patient_name}</p>
                        <p className="text-xs text-gray-500">
                          {appointment.appointment_time} • {appointment.patient_mrn}
                        </p>
                      </div>
                      <button
                        onClick={() => startDictation(appointment.patient_id)}
                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Start Dictation
                      </button>
                    </div>
                  ))}
                  {appointments.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No appointments scheduled yet
                    </p>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => navigate('/quick-note')}
                    className="p-3 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition text-sm font-medium"
                  >
                    ⚡ Quick Note
                  </button>
                  <button
                    onClick={() => navigate('/doctor/templates')}
                    className="p-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition text-sm font-medium"
                  >
                    📝 Templates
                  </button>
                  <button
                    onClick={() => navigate('/doctor/patients')}
                    className="p-3 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition text-sm font-medium"
                  >
                    👥 All Patients
                  </button>
                  <button
                    onClick={() => navigate('/doctor/reports')}
                    className="p-3 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition text-sm font-medium"
                  >
                    📊 Reports
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
