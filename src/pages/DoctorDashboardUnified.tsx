import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { unifiedAuthService } from '../services/unifiedAuth.service';
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-semibold text-gray-700 mb-2">Loading schedule...</div>
          <div className="text-gray-500">Connecting to database</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <DoctorNavBar
        currentView={dashboardView}
        onViewChange={handleViewChange}
        practiceInfo={{ name: 'TSHLA Medical' }}
        showNotifications={true}
      />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="text-red-800 font-medium">Database Error</div>
            <div className="text-red-600 text-sm mt-1">{error}</div>
            <button
              onClick={refreshSchedule}
              className="mt-2 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Dashboard Content */}
        {renderDashboardContent()}
      </div>

      {/* Add Patient Modal */}
      {showAddPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {editingAppointment ? 'Edit Appointment' : 'Add New Patient'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Patient Name *</label>
                <input
                  type="text"
                  value={newAppointment.patientName}
                  onChange={e =>
                    setNewAppointment({ ...newAppointment, patientName: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter patient name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input
                  type="tel"
                  value={newAppointment.patientPhone}
                  onChange={e =>
                    setNewAppointment({ ...newAppointment, patientPhone: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Phone number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={newAppointment.patientEmail}
                  onChange={e =>
                    setNewAppointment({ ...newAppointment, patientEmail: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Email address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Time *</label>
                <input
                  type="time"
                  value={newAppointment.appointmentTime}
                  onChange={e =>
                    setNewAppointment({ ...newAppointment, appointmentTime: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Visit Type</label>
                <select
                  value={newAppointment.visitType}
                  onChange={e =>
                    setNewAppointment({ ...newAppointment, visitType: e.target.value as any })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <label className="block text-sm font-medium mb-1">Visit Reason</label>
                <input
                  type="text"
                  value={newAppointment.visitReason}
                  onChange={e =>
                    setNewAppointment({ ...newAppointment, visitReason: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Reason for visit"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  value={newAppointment.notes}
                  onChange={e => setNewAppointment({ ...newAppointment, notes: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Additional notes"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={saveAppointment}
                disabled={isLoading}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Saving...' : editingAppointment ? 'Update' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setShowAddPatient(false);
                  setEditingAppointment(null);
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
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
