import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { unifiedAuthService } from '../services/unifiedAuth.service';
import { scheduleDatabaseService } from '../services/scheduleDatabase.service';
import ProviderDailySchedule from '../components/ProviderDailySchedule';
import ScheduleImportModal from '../components/ScheduleImportModal';
import { runAppointmentMigration } from '../utils/appointmentMigration';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

interface Patient {
  id: string;
  name: string;
  mrn: string;
  appointmentTime: string;
  status: 'pending' | 'in-progress' | 'completed';
  phone?: string;
  dob?: string;
  isPlaceholder?: boolean;
}

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

export default function DoctorDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const currentUser = unifiedAuthService.getCurrentUser();
  const currentDoctor = currentUser?.name || "Dr. Smith";
  const providerId = currentUser?.id || currentUser?.email || 'doctor-default-001';

  const [viewMode, setViewMode] = useState<'slots' | 'provider-daily'>('slots');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showNewVersion] = useState(true);

  // Date navigation state
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  logInfo('DoctorDashboard', 'Component initialized', { timestamp: new Date() });

  // Initialize with empty array - we'll load from database
  const [patients, setPatients] = useState<Patient[]>([]);

  const [showAddPatient, setShowAddPatient] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('');
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [newPatient, setNewPatient] = useState({
    name: '',
    mrn: '',
    appointmentTime: '',
    phone: '',
    dob: ''
  });

  const timeSlots = generateTimeSlots();

  // Run appointment migration on first load
  useEffect(() => {
    // Run migration to consolidate appointments from different storage systems
    runAppointmentMigration();
  }, []); // Run once on component mount

  // Load schedule from database when date or provider changes
  useEffect(() => {
    loadScheduleFromDatabase();
  }, [selectedDate, providerId]);

  const loadScheduleFromDatabase = async () => {
    setIsLoading(true);
    try {
      const schedule = await scheduleDatabaseService.getScheduleForDate(providerId, selectedDate);
      setPatients(schedule);
      logDebug('DoctorDashboard', 'Debug message', {});
    } catch (error) {
      logError('DoctorDashboard', 'Error message', {});
      setSaveStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  // Save appointment to database
  const saveAppointmentToDatabase = async (patient: Patient) => {
    setSaveStatus('saving');
    try {
      const success = await scheduleDatabaseService.saveAppointment(
        providerId,
        currentDoctor,
        patient,
        selectedDate
      );

      if (success) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
        // Reload to get fresh data with IDs
        loadScheduleFromDatabase();
      } else {
        setSaveStatus('error');
      }
    } catch (error) {
      logError('DoctorDashboard', 'Error message', {});
      setSaveStatus('error');
    }
  };

  const startDictation = (patientId: string) => {
    navigate(`/dictation/${patientId}`);
  };

  // Quick add placeholder patient to a time slot
  const quickAddPatient = async (timeSlot: string) => {
    const placeholder: Patient = {
      id: `placeholder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `Patient @ ${timeSlot}`,
      mrn: `TBD-${Date.now().toString().slice(-6)}`,
      appointmentTime: timeSlot,
      status: 'pending',
      isPlaceholder: true
    };

    // Add to local state immediately for responsive UI
    const updatedPatients = [...patients, placeholder].sort((a, b) => {
      const timeA = convertTo24Hour(a.appointmentTime);
      const timeB = convertTo24Hour(b.appointmentTime);
      return timeA.localeCompare(timeB);
    });
    setPatients(updatedPatients);
    setSelectedTimeSlot('');

    // Save to database
    await saveAppointmentToDatabase(placeholder);
  };

  // Edit patient information
  const editPatientInfo = (patient: Patient) => {
    setEditingPatient(patient);
    setNewPatient({
      name: patient.name === `Patient @ ${patient.appointmentTime}` ? '' : patient.name,
      mrn: patient.mrn.startsWith('TBD-') ? '' : patient.mrn,
      appointmentTime: patient.appointmentTime,
      phone: patient.phone || '',
      dob: patient.dob || ''
    });
    setShowAddPatient(true);
  };

  const addPatientToSchedule = async () => {
    if (!newPatient.appointmentTime) {
      alert('Please select an appointment time');
      return;
    }

    const patient: Patient = {
      id: editingPatient?.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: newPatient.name || `Patient @ ${newPatient.appointmentTime}`,
      mrn: newPatient.mrn || `MRN${Date.now().toString().slice(-6)}`,
      appointmentTime: newPatient.appointmentTime,
      status: editingPatient?.status || 'pending',
      phone: newPatient.phone,
      isPlaceholder: !newPatient.name
    };

    let updatedPatients;
    if (editingPatient) {
      // Update existing patient
      updatedPatients = patients.map(p => p.id === editingPatient.id ? patient : p);

      // Update in database if it has a numeric ID (from database)
      if (editingPatient.id && !editingPatient.id.includes('placeholder')) {
        await scheduleDatabaseService.updateAppointment(editingPatient.id, patient);
      } else {
        // New patient, save to database
        await saveAppointmentToDatabase(patient);
      }
    } else {
      // Add new patient
      updatedPatients = [...patients, patient];
      await saveAppointmentToDatabase(patient);
    }

    // Sort by appointment time
    updatedPatients.sort((a, b) => {
      const timeA = convertTo24Hour(a.appointmentTime);
      const timeB = convertTo24Hour(b.appointmentTime);
      return timeA.localeCompare(timeB);
    });

    setPatients(updatedPatients);

    // Reset form
    setNewPatient({
      name: '',
      mrn: '',
      appointmentTime: '',
      phone: '',
      dob: ''
    });
    setShowAddPatient(false);
    setEditingPatient(null);
  };

  const convertTo24Hour = (time12h: string): string => {
    const [time, modifier] = time12h.split(' ');
    let [hours, minutes] = time.split(':');
    if (hours === '12') {
      hours = modifier === 'AM' ? '00' : '12';
    } else if (modifier === 'PM') {
      hours = String(parseInt(hours, 10) + 12);
    }
    return `${hours.padStart(2, '0')}:${minutes}`;
  };

  const removePatient = async (patientId: string) => {
    // Remove from local state immediately
    const updatedPatients = patients.filter(p => p.id !== patientId);
    setPatients(updatedPatients);

    // Delete from database if it has a numeric ID (from database)
    if (patientId && !patientId.includes('placeholder')) {
      await scheduleDatabaseService.deleteAppointment(patientId);
    }
  };

  // Date navigation functions
  const changeDate = (delta: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + delta);
    setSelectedDate(newDate.toISOString().split('T')[0]);
  };

  const goToToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const formatDisplayDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (dateString === today.toISOString().split('T')[0]) {
      return 'Today';
    } else if (dateString === yesterday.toISOString().split('T')[0]) {
      return 'Yesterday';
    } else if (dateString === tomorrow.toISOString().split('T')[0]) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
      });
    }
  };

  const getOccupiedSlots = () => {
    return patients.map(p => p.appointmentTime);
  };

  const occupiedSlots = getOccupiedSlots();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* DATABASE VERSION BANNER */}
      {showNewVersion && (
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 text-center text-xl font-bold">
          🗄️ DATABASE-ENABLED SCHEDULE - SAVE ACROSS DAYS! 🗄️
        </div>
      )}
      
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
              <button
                onClick={logout}
                className="text-xs text-gray-600 hover:text-gray-900"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>


      {/* Main Content - Always show slots view */}
      {(
      <div className="flex gap-3 p-3 bg-gray-50 min-h-screen">
        {/* Compact Stats Bar - Left Side */}
        <div className="w-44">
          {/* Mini Stats Card */}
          <div className="bg-white rounded-lg shadow-sm p-3 mb-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="text-center py-1">
                <p className="text-xl font-bold text-blue-600">{patients.length}</p>
                <p className="text-xs text-gray-500">Total</p>
              </div>
              <div className="text-center py-1">
                <p className="text-xl font-bold text-green-600">{patients.filter(p => p.status === 'completed').length}</p>
                <p className="text-xs text-gray-500">Done</p>
              </div>
              <div className="text-center py-1">
                <p className="text-xl font-bold text-yellow-600">{patients.filter(p => p.status === 'in-progress').length}</p>
                <p className="text-xs text-gray-500">Active</p>
              </div>
              <div className="text-center py-1">
                <p className="text-xl font-bold text-gray-500">{patients.filter(p => p.status === 'pending').length}</p>
                <p className="text-xs text-gray-500">Pending</p>
              </div>
            </div>
          </div>
          
          {/* Quick Actions */}
          <div className="space-y-2">
            <button
              onClick={() => navigate('/quick-note')}
              className="w-full px-3 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition"
            >
              ⚡ Quick Note
            </button>
            <button
              onClick={() => {
                setEditingPatient(null);
                setNewPatient({ name: '', mrn: '', appointmentTime: '', phone: '', dob: '' });
                setShowAddPatient(true);
              }}
              className="w-full px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition"
            >
              + Add Patient
            </button>
          </div>
        </div>
        
        {/* Main Schedule Area - Takes Most Space */}
        <div className="flex-1">
          <div className="bg-white rounded-lg shadow-sm h-[calc(100vh-100px)]">
            {/* Schedule Header with Date Navigation */}
            <div className="px-4 py-3 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">📅 Schedule - DATABASE ENABLED</h2>

                  {/* Date Navigation */}
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => changeDate(-1)}
                      className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm transition"
                    >
                      ← Previous
                    </button>

                    <span className="text-sm font-medium text-gray-700 px-3">
                      {formatDisplayDate(selectedDate)} ({selectedDate})
                    </span>

                    <button
                      onClick={() => changeDate(1)}
                      className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm transition"
                    >
                      Next →
                    </button>

                    <button
                      onClick={goToToday}
                      className="px-2 py-1 bg-blue-600 text-white hover:bg-blue-700 rounded text-sm transition ml-2"
                    >
                      Today
                    </button>

                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="px-2 py-1 border rounded text-sm ml-2"
                    />
                  </div>
                </div>

                <div className="text-right">
                  <div className="flex items-center gap-2">
                    {saveStatus !== 'idle' && (
                      <div className={`text-xs px-2 py-1 rounded ${
                        saveStatus === 'saving' ? 'bg-yellow-100 text-yellow-800' :
                        saveStatus === 'saved' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {saveStatus === 'saving' ? 'Saving...' :
                         saveStatus === 'saved' ? 'Saved ✓' : 'Error saving'}
                      </div>
                    )}

                    <span className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                      {isLoading ? 'Loading...' : `${patients.length} patients • ${timeSlots.length - patients.length} open`}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Time Slots - Compact Design */}
            <div className="overflow-y-auto" style={{maxHeight: 'calc(100vh - 230px)'}}>
              {isLoading ? (
                <div className="flex items-center justify-center p-8">
                  <div className="text-gray-500">Loading schedule from database...</div>
                </div>
              ) : (
                <div>
                  {timeSlots.map(slot => {
                  const patient = patients.find(p => p.appointmentTime === slot);
                  const isOccupied = !!patient;
                  
                  return (
                    <div key={slot} className="flex items-center border-b border-gray-100 hover:bg-blue-50/50 transition-colors">
                      {/* Time Column - More Prominent */}
                      <div className="w-24 py-3 px-4 font-semibold text-gray-700 bg-gray-50 border-r text-sm">
                        {slot}
                      </div>
                      
                      {isOccupied && patient ? (
                        <div className="flex-1 py-2.5 px-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className={`text-sm font-medium ${patient.isPlaceholder ? 'text-gray-400 italic' : 'text-gray-900'}`}>
                                {patient.name}
                              </p>
                              <p className="text-xs text-gray-500">MRN: {patient.mrn}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => editPatientInfo(patient)}
                                className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded transition"
                                title="Edit"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => startDictation(patient.id)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                                title="Dictation"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => removePatient(patient.id)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition"
                                title="Remove"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 py-3 px-4">
                          <button
                            onClick={() => quickAddPatient(slot)}
                            className="w-full text-left flex items-center justify-between group"
                          >
                            <span className="text-sm text-gray-400 group-hover:text-green-600 transition">Available</span>
                            <span className="text-xs text-green-600 opacity-0 group-hover:opacity-100 transition">
                              + Add
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right Side - Patient Form (Only when needed) */}
        <div className="w-96">
          {showAddPatient ? (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">
                {editingPatient ? 'Edit Patient Information' : 'Add New Patient'}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Patient Name
                  </label>
                  <input
                    type="text"
                    value={newPatient.name}
                    onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter patient name (or leave blank for placeholder)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    MRN (Medical Record Number)
                  </label>
                  <input
                    type="text"
                    value={newPatient.mrn}
                    onChange={(e) => setNewPatient({ ...newPatient, mrn: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter MRN (or leave blank to auto-generate)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Appointment Time *
                  </label>
                  <select
                    value={newPatient.appointmentTime}
                    onChange={(e) => setNewPatient({ ...newPatient, appointmentTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a time slot</option>
                    {timeSlots.map(slot => {
                      const isOccupied = occupiedSlots.includes(slot) && (!editingPatient || editingPatient.appointmentTime !== slot);
                      return (
                        <option key={slot} value={slot} disabled={isOccupied}>
                          {slot} {isOccupied ? '(Occupied)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={newPatient.phone}
                    onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="(555) 555-5555"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={newPatient.dob}
                    onChange={(e) => setNewPatient({ ...newPatient, dob: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={addPatientToSchedule}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                  >
                    {editingPatient ? 'Update Patient' : 'Add to Schedule'}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddPatient(false);
                      setEditingPatient(null);
                      setNewPatient({ name: '', mrn: '', appointmentTime: '', phone: '', dob: '' });
                    }}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <div className="text-gray-400 text-6xl mb-4">📋</div>
                <p className="text-gray-500 text-sm">Click <span className="font-semibold">+ Full Add</span> to add a patient</p>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Import Modal */}
      <ScheduleImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={() => {
          // Refresh the schedule view
          window.location.reload();
        }}
      />
    </div>
  );
}
