import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabaseAuthService as unifiedAuthService } from '../services/supabaseAuth.service';
import { type UnifiedAppointment } from '../services/unifiedAppointment.service';
import { useSchedule } from '../hooks/useSchedule';
import DoctorNavBar from '../components/layout/DoctorNavBar';
import ScheduleNavigation from '../components/doctor/ScheduleNavigation';
import DailyPatientList from '../components/doctor/DailyPatientList';
import { Plus, Calendar, FileText } from 'lucide-react';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

export default function DoctorDashboardUnified() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const currentUser = unifiedAuthService.getCurrentUser();
  const providerId = currentUser?.id || currentUser?.email || 'doctor-default-001';

  // State for dashboard view
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<'day' | 'week' | 'month'>('day');
  const [dashboardView, setDashboardView] = useState<'calendar' | 'templates' | 'notes'>(
    'calendar'
  );
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('');
  const [editingAppointment, setEditingAppointment] = useState<UnifiedAppointment | null>(null);

  // New appointment form state
  const [newAppointment, setNewAppointment] = useState({
    patientName: '',
    patientPhone: '',
    patientEmail: '',
    appointmentTime: '',
    visitType: 'follow-up' as const,
    visitReason: '',
    notes: '',
  });

  // Use our new schedule hook for database integration
  const {
    appointments,
    isLoading,
    error,
    refreshSchedule,
    createAppointment,
    updateAppointment,
    deleteAppointment,
    updateAppointmentStatus,
  } = useSchedule({
    providerId,
    date: selectedDate,
    autoRefresh: true,
    refreshInterval: 30000,
  });

  logInfo('DoctorDashboardUnified', 'Info message', {});

  const saveAppointment = async () => {
    if (!newAppointment.appointmentTime || !newAppointment.patientName.trim()) {
      alert('Please enter patient name and select a time');
      return;
    }

    try {
      if (editingAppointment) {
        // Update existing appointment
        await updateAppointment(editingAppointment.id, {
          patientName: newAppointment.patientName,
          patientPhone: newAppointment.patientPhone,
          patientEmail: newAppointment.patientEmail,
          time: newAppointment.appointmentTime,
          visitType: newAppointment.visitType,
          visitReason: newAppointment.visitReason,
          notes: newAppointment.notes,
        });
      } else {
        // Create new appointment
        await createAppointment({
          patientName: newAppointment.patientName,
          patientPhone: newAppointment.patientPhone,
          patientEmail: newAppointment.patientEmail,
          time: newAppointment.appointmentTime,
          visitType: newAppointment.visitType,
          visitReason: newAppointment.visitReason,
          notes: newAppointment.notes,
        });
      }

      // Reset form
      setNewAppointment({
        patientName: '',
        patientPhone: '',
        patientEmail: '',
        appointmentTime: '',
        visitType: 'follow-up',
        visitReason: '',
        notes: '',
      });
      setShowAddPatient(false);
      setEditingAppointment(null);
    } catch (error) {
      logError('DoctorDashboardUnified', 'Error message', {});
      alert('Failed to save appointment. Please try again.');
    }
  };

  const editAppointment = (appointment: UnifiedAppointment) => {
    setEditingAppointment(appointment);
    setNewAppointment({
      patientName: appointment.patientName,
      patientPhone: appointment.patientPhone || '',
      patientEmail: appointment.patientEmail || '',
      appointmentTime: appointment.time,
      visitType: appointment.visitType,
      visitReason: appointment.visitReason,
      notes: appointment.notes || '',
    });
    setShowAddPatient(true);
  };

  const handlePatientClick = (appointment: UnifiedAppointment) => {
    updateAppointmentStatus(appointment.id, 'in-progress');

    // Store patient info for dictation
    sessionStorage.setItem(
      'current_patient',
      JSON.stringify({
        id: appointment.patientId,
        name: appointment.patientName,
        appointmentId: appointment.id,
        date: selectedDate.toISOString().split('T')[0],
        time: appointment.time,
      })
    );

    navigate('/quick-note');
  };

  const handleAddAppointment = (timeSlot: string) => {
    setSelectedTimeSlot(timeSlot);
    setNewAppointment({
      patientName: '',
      patientPhone: '',
      patientEmail: '',
      appointmentTime: timeSlot,
      visitType: 'follow-up',
      visitReason: '',
      notes: '',
    });
    setShowAddPatient(true);
  };

  const handleViewChange = (view: 'calendar' | 'templates' | 'notes') => {
    setDashboardView(view);
  };

  // Handle different dashboard views
  const renderDashboardContent = () => {
    if (dashboardView === 'templates') {
      return (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">Templates</h2>
          <p className="text-gray-600">Template management coming soon...</p>
        </div>
      );
    }

    if (dashboardView === 'notes') {
      return (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">Notes</h2>
          <p className="text-gray-600">Note management coming soon...</p>
        </div>
      );
    }

    // Calendar view (default)
    return (
      <>
        <ScheduleNavigation
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          onViewChange={setCurrentView}
          currentView={currentView}
        />

        <DailyPatientList
          providerId={providerId}
          selectedDate={selectedDate}
          appointments={appointments}
          onPatientClick={handlePatientClick}
          onAddAppointment={handleAddAppointment}
        />
      </>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="spinner-tesla mx-auto mb-4"></div>
          <div className="text-lg font-medium text-tesla-dark-gray mb-2">Loading schedule</div>
          <div className="text-tesla-light-gray font-light">Connecting to database</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Top Navigation */}
      <DoctorNavBar
        currentView={dashboardView}
        onViewChange={handleViewChange}
        practiceInfo={{ name: 'TSHLA Medical' }}
        showNotifications={true}
      />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-8">
        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-6 mb-6">
            <div className="text-red-800 font-medium mb-2">Database Error</div>
            <div className="text-red-600 text-sm mb-4 font-light">{error}</div>
            <button
              onClick={refreshSchedule}
              className="btn-tesla btn-tesla-secondary text-sm px-6 py-2"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Dashboard Content */}
        {renderDashboardContent()}
      </div>

      {/* Add Patient Modal - Tesla Style */}
      {showAddPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-gray-200 rounded-lg p-8 w-full max-w-md">
            <h3 className="text-xl font-bold text-tesla-dark-gray mb-6">
              {editingAppointment ? 'Edit Appointment' : 'Add New Patient'}
            </h3>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-tesla-dark-gray mb-2">Patient Name *</label>
                <input
                  type="text"
                  value={newAppointment.patientName}
                  onChange={e =>
                    setNewAppointment({ ...newAppointment, patientName: e.target.value })
                  }
                  className="input-tesla-minimal"
                  placeholder="Enter patient name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-tesla-dark-gray mb-2">Phone</label>
                <input
                  type="tel"
                  value={newAppointment.patientPhone}
                  onChange={e =>
                    setNewAppointment({ ...newAppointment, patientPhone: e.target.value })
                  }
                  className="input-tesla-minimal"
                  placeholder="Phone number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-tesla-dark-gray mb-2">Email</label>
                <input
                  type="email"
                  value={newAppointment.patientEmail}
                  onChange={e =>
                    setNewAppointment({ ...newAppointment, patientEmail: e.target.value })
                  }
                  className="input-tesla-minimal"
                  placeholder="Email address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-tesla-dark-gray mb-2">Time *</label>
                <input
                  type="time"
                  value={newAppointment.appointmentTime}
                  onChange={e =>
                    setNewAppointment({ ...newAppointment, appointmentTime: e.target.value })
                  }
                  className="input-tesla-minimal"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-tesla-dark-gray mb-2">Visit Type</label>
                <select
                  value={newAppointment.visitType}
                  onChange={e =>
                    setNewAppointment({ ...newAppointment, visitType: e.target.value as any })
                  }
                  className="input-tesla-minimal"
                >
                  <option value="new-patient">New Patient</option>
                  <option value="follow-up">Follow-up</option>
                  <option value="urgent">Urgent</option>
                  <option value="procedure">Procedure</option>
                  <option value="lab-review">Lab Review</option>
                  <option value="telemedicine">Telemedicine</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-tesla-dark-gray mb-2">Visit Reason</label>
                <input
                  type="text"
                  value={newAppointment.visitReason}
                  onChange={e =>
                    setNewAppointment({ ...newAppointment, visitReason: e.target.value })
                  }
                  className="input-tesla-minimal"
                  placeholder="Reason for visit"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-tesla-dark-gray mb-2">Notes</label>
                <textarea
                  value={newAppointment.notes}
                  onChange={e => setNewAppointment({ ...newAppointment, notes: e.target.value })}
                  className="input-tesla-minimal resize-none"
                  rows={3}
                  placeholder="Additional notes"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={saveAppointment}
                disabled={isLoading}
                className="flex-1 btn-tesla btn-tesla-secondary py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Saving...' : editingAppointment ? 'Update' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setShowAddPatient(false);
                  setEditingAppointment(null);
                }}
                className="btn-tesla btn-tesla-outline-dark py-3 px-6"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
