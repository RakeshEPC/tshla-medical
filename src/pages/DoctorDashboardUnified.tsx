import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabaseAuthService as unifiedAuthService } from '../services/supabaseAuth.service';
import { type UnifiedAppointment } from '../services/unifiedAppointment.service';
import { useSchedule } from '../hooks/useSchedule';
import DoctorNavBar from '../components/layout/DoctorNavBar';
import ScheduleNavigation from '../components/doctor/ScheduleNavigation';
import DailyPatientList from '../components/doctor/DailyPatientList';
import ProviderFilter, { type Provider } from '../components/doctor/ProviderFilter';
import { Plus, Calendar, FileText, Phone, Upload, BarChart3, MessageSquare, Users, Heart } from 'lucide-react';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

export default function DoctorDashboardUnified() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const currentUser = unifiedAuthService.getCurrentUser();

  // State for dashboard view
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<'day' | 'week' | 'month'>('day');
  const [dashboardView, setDashboardView] = useState<'calendar' | 'templates' | 'notes'>(
    'calendar'
  );
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('');
  const [editingAppointment, setEditingAppointment] = useState<UnifiedAppointment | null>(null);

  // Provider filtering state
  const [selectedProviders, setSelectedProviders] = useState<string[]>(['ALL']);
  const [availableProviders, setAvailableProviders] = useState<Provider[]>([]);
  const [appointmentCounts, setAppointmentCounts] = useState<Record<string, number>>({});

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
    selectedProviders,
    date: selectedDate,
    autoRefresh: true,
    refreshInterval: 30000,
  });

  logInfo('DoctorDashboardUnified', 'Dashboard loaded with provider filter', {});

  // Load available providers from appointments
  useEffect(() => {
    const loadProviders = async () => {
      try {
        const { supabase } = await import('../lib/supabase');

        const dateString = selectedDate.toISOString().split('T')[0];
        console.log('🔍 [Dashboard] Loading providers for date:', dateString);

        // Get unique providers from provider_schedules for the selected date
        const { data, error } = await supabase
          .from('provider_schedules')
          .select('provider_id, provider_name')
          .eq('scheduled_date', dateString);

        console.log('📊 [Dashboard] Provider query result:', {
          error,
          dataCount: data?.length || 0,
          sampleData: data?.slice(0, 3)
        });

        if (error) {
          console.error('❌ [Dashboard] Error loading providers:', error);
          return;
        }

        if (data && data.length > 0) {
          // Create unique provider list
          const providerMap = new Map<string, Provider>();
          const counts: Record<string, number> = {};

          data.forEach((apt: any) => {
            // Use provider_name as unique ID since provider_id may be the same for all
            const name = apt.provider_name || 'Unknown Provider';
            const id = name; // Use the name as the unique identifier

            if (!providerMap.has(id)) {
              providerMap.set(id, {
                id,
                name,
                specialty: '', // Could be enhanced later
              });
              counts[id] = 0;
            }
            counts[id]++;
          });

          const providers = Array.from(providerMap.values()).sort((a, b) =>
            a.name.localeCompare(b.name)
          );

          console.log('✅ [Dashboard] Found unique providers:', {
            count: providers.length,
            providers: providers.map(p => ({ id: p.id, name: p.name })),
            counts
          });

          setAvailableProviders(providers);
          setAppointmentCounts(counts);
        } else {
          console.warn('⚠️ [Dashboard] No provider data found for date:', dateString);
        }
      } catch (error) {
        console.error('❌ [Dashboard] Failed to load providers:', error);
      }
    };

    loadProviders();
  }, [selectedDate, appointments.length]);

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
      visitType: (appointment.visitType || 'follow-up') as 'follow-up',
      visitReason: appointment.visitReason,
      notes: appointment.notes || '',
    });
    setShowAddPatient(true);
  };

  const handlePatientClick = (appointment: UnifiedAppointment) => {
    updateAppointmentStatus(appointment.id, 'in-progress');

    // Store comprehensive patient info for dictation auto-population
    sessionStorage.setItem(
      'current_patient',
      JSON.stringify({
        id: appointment.patientId,
        name: appointment.patientName,
        phone: appointment.patientPhone || '',
        email: appointment.patientEmail || '',
        dob: appointment.patientDob || '',
        age: appointment.patientAge || null,
        appointmentId: appointment.id,
        date: selectedDate.toISOString().split('T')[0],
        time: appointment.time,
        visitReason: appointment.visitReason || '',
        visitType: appointment.visitType || 'follow-up',
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
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold text-tesla-dark-gray">Template Management</h2>
              <p className="text-tesla-light-gray font-light mt-1">
                Create and manage your clinical note templates
              </p>
            </div>
            <button
              onClick={() => navigate('/templates/doctor')}
              className="btn-tesla btn-tesla-secondary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Template
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 transition-colors">
              <FileText className="w-8 h-8 text-blue-500 mb-3" />
              <h3 className="font-medium text-tesla-dark-gray mb-1">View All Templates</h3>
              <p className="text-sm text-tesla-light-gray mb-4">
                Browse, edit, and manage your templates
              </p>
              <button
                onClick={() => navigate('/templates/list')}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Go to Templates →
              </button>
            </div>

            <div className="border border-gray-200 rounded-lg p-4 hover:border-green-500 transition-colors">
              <Plus className="w-8 h-8 text-green-500 mb-3" />
              <h3 className="font-medium text-tesla-dark-gray mb-1">Create Template</h3>
              <p className="text-sm text-tesla-light-gray mb-4">
                Build custom templates with AI guidance
              </p>
              <button
                onClick={() => navigate('/templates/doctor')}
                className="text-sm text-green-600 hover:text-green-700 font-medium"
              >
                Start Building →
              </button>
            </div>

            <div className="border border-gray-200 rounded-lg p-4 hover:border-purple-500 transition-colors">
              <Calendar className="w-8 h-8 text-purple-500 mb-3" />
              <h3 className="font-medium text-tesla-dark-gray mb-1">Import/Export</h3>
              <p className="text-sm text-tesla-light-gray mb-4">
                Share templates with your team
              </p>
              <button
                onClick={() => navigate('/templates/import-export')}
                className="text-sm text-purple-600 hover:text-purple-700 font-medium"
              >
                Manage →
              </button>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="font-medium text-tesla-dark-gray mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <button
                onClick={() => navigate('/templates/list')}
                className="w-full text-left p-3 border border-gray-200 rounded hover:bg-gray-50 transition-colors"
              >
                <div className="font-medium text-sm">Browse Template Library</div>
                <div className="text-xs text-tesla-light-gray mt-1">
                  View all available templates organized by specialty
                </div>
              </button>
              <button
                onClick={() => navigate('/templates/doctor')}
                className="w-full text-left p-3 border border-gray-200 rounded hover:bg-gray-50 transition-colors"
              >
                <div className="font-medium text-sm">Doctor Template Editor</div>
                <div className="text-xs text-tesla-light-gray mt-1">
                  Advanced template editing with custom sections
                </div>
              </button>
            </div>
          </div>
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
        {/* Debug marker - will remove after confirming deployment */}
        <div className="mb-2 px-4 py-1 bg-blue-50 border border-blue-200 rounded text-xs text-blue-600">
          ✅ Dashboard v2.1 - Provider Filter Active
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Date Navigation - takes 2 columns */}
          <div className="lg:col-span-2">
            <ScheduleNavigation
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              onViewChange={setCurrentView}
              currentView={currentView}
            />
          </div>

          {/* Provider Filter - takes 1 column */}
          <div className="lg:col-span-1">
            <ProviderFilter
              selectedProviders={selectedProviders}
              onSelectionChange={setSelectedProviders}
              availableProviders={availableProviders}
              appointmentCounts={appointmentCounts}
            />
          </div>
        </div>

        <DailyPatientList
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

        {/* Quick Access Links */}
        {dashboardView === 'calendar' && (
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
            <button
              onClick={() => navigate('/pcm/provider')}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:border-red-500 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg group-hover:bg-red-200 transition">
                  <Heart className="w-5 h-5 text-red-600" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-900">PCM Dashboard</div>
                  <div className="text-xs text-gray-500">Diabetes care mgmt</div>
                </div>
              </div>
            </button>

            <button
              onClick={() => navigate('/patient-chart')}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:border-indigo-500 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg group-hover:bg-indigo-200 transition">
                  <Users className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-900">Patient Charts</div>
                  <div className="text-xs text-gray-500">Unified records</div>
                </div>
              </div>
            </button>

            <button
              onClick={() => navigate('/previsit-data')}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition">
                  <Phone className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-900">Pre-Visit Calls</div>
                  <div className="text-xs text-gray-500">View captured data</div>
                </div>
              </div>
            </button>

            <button
              onClick={() => navigate('/patient-import')}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:border-purple-500 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition">
                  <Upload className="w-5 h-5 text-purple-600" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-900">Import Profiles</div>
                  <div className="text-xs text-gray-500">Upload progress notes</div>
                </div>
              </div>
            </button>

            <button
              onClick={() => navigate('/previsit-analytics')}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:border-green-500 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg group-hover:bg-green-200 transition">
                  <BarChart3 className="w-5 h-5 text-green-600" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-900">Analytics</div>
                  <div className="text-xs text-gray-500">Call metrics & trends</div>
                </div>
              </div>
            </button>

            <button
              onClick={() => navigate('/previsit-conversations')}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:border-orange-500 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg group-hover:bg-orange-200 transition">
                  <MessageSquare className="w-5 h-5 text-orange-600" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-900">Conversations</div>
                  <div className="text-xs text-gray-500">View call transcripts</div>
                </div>
              </div>
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
