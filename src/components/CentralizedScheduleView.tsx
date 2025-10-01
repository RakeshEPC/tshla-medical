/**
 * Centralized Schedule View Component
 * Shows unified schedule with role-based access and real-time updates
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  centralizedScheduleService,
  Appointment,
  UserRole,
} from '../services/centralizedSchedule.service';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

interface CentralizedScheduleViewProps {
  selectedDate: string;
  onAppointmentClick?: (appointment: Appointment) => void;
}

const CentralizedScheduleView: React.FC<CentralizedScheduleViewProps> = ({
  selectedDate,
  onAppointmentClick,
}) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<
    Array<{ id: string; name: string; specialty?: string }>
  >([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  // ============================================================================
  // INITIALIZATION & PERMISSIONS
  // ============================================================================

  useEffect(() => {
    initializeSchedule();
    setupEventListeners();

    return () => {
      // Cleanup event listeners
      centralizedScheduleService.removeEventListener('scheduleLoaded', handleScheduleLoaded);
      centralizedScheduleService.removeEventListener(
        'appointmentAddedRemotely',
        handleRemoteAppointmentAdded
      );
      centralizedScheduleService.removeEventListener(
        'appointmentUpdatedRemotely',
        handleRemoteAppointmentUpdated
      );
      centralizedScheduleService.removeEventListener(
        'appointmentDeletedRemotely',
        handleRemoteAppointmentDeleted
      );
      centralizedScheduleService.removeEventListener('scheduleSynced', handleScheduleSynced);
    };
  }, []);

  useEffect(() => {
    if (userRole) {
      loadScheduleForDate();
    }
  }, [selectedDate, selectedProvider, userRole]);

  const initializeSchedule = async () => {
    try {
      setLoading(true);

      // Check user permissions
      const permissions = await centralizedScheduleService.checkUserPermissions();
      setUserRole(permissions);

      // Load available providers based on role
      const availableProviders = await centralizedScheduleService.getAvailableProviders();
      setProviders(availableProviders);

      // Set default provider selection based on role
      if (permissions.role === 'doctor' && permissions.assignedProvider) {
        setSelectedProvider(permissions.assignedProvider.id);
      } else {
        setSelectedProvider('all');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize schedule');
    } finally {
      setLoading(false);
    }
  };

  const setupEventListeners = () => {
    centralizedScheduleService.addEventListener('scheduleLoaded', handleScheduleLoaded);
    centralizedScheduleService.addEventListener(
      'appointmentAddedRemotely',
      handleRemoteAppointmentAdded
    );
    centralizedScheduleService.addEventListener(
      'appointmentUpdatedRemotely',
      handleRemoteAppointmentUpdated
    );
    centralizedScheduleService.addEventListener(
      'appointmentDeletedRemotely',
      handleRemoteAppointmentDeleted
    );
    centralizedScheduleService.addEventListener('scheduleSynced', handleScheduleSynced);
  };

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  const loadScheduleForDate = async () => {
    try {
      setLoading(true);
      setError(null);

      let appointmentData: Appointment[];

      if (userRole?.role === 'doctor') {
        // Doctors see only their own schedule
        appointmentData = await centralizedScheduleService.getMySchedule(selectedDate);
      } else if (selectedProvider === 'all') {
        // Staff/Admin can see all schedules
        appointmentData = await centralizedScheduleService.getAllSchedules(selectedDate);
      } else {
        // Staff/Admin viewing specific provider
        appointmentData = await centralizedScheduleService.getScheduleForDate(
          selectedDate,
          selectedProvider
        );
      }

      setAppointments(appointmentData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // REAL-TIME EVENT HANDLERS
  // ============================================================================

  const handleScheduleLoaded = useCallback((data: any) => {
    logDebug('CentralizedScheduleView', 'Debug message', {});
  }, []);

  const handleRemoteAppointmentAdded = useCallback(
    (data: any) => {
      logDebug('CentralizedScheduleView', 'Debug message', {});
      // Refresh the schedule to show new appointment
      loadScheduleForDate();
    },
    [selectedDate, selectedProvider]
  );

  const handleRemoteAppointmentUpdated = useCallback(
    (data: any) => {
      logDebug('CentralizedScheduleView', 'Debug message', {});
      // Refresh the schedule to show updates
      loadScheduleForDate();
    },
    [selectedDate, selectedProvider]
  );

  const handleRemoteAppointmentDeleted = useCallback(
    (data: any) => {
      logDebug('CentralizedScheduleView', 'Debug message', {});
      // Refresh the schedule to remove deleted appointment
      loadScheduleForDate();
    },
    [selectedDate, selectedProvider]
  );

  const handleScheduleSynced = useCallback((data: any) => {
    logDebug('CentralizedScheduleView', 'Debug message', {});
    // Show a subtle indicator that data was synced
  }, []);

  // ============================================================================
  // APPOINTMENT MANAGEMENT
  // ============================================================================

  const handleAddAppointment = async (appointmentData: any) => {
    try {
      await centralizedScheduleService.addAppointment(appointmentData);
      setShowAddModal(false);
      // Schedule will refresh automatically via real-time sync
    } catch (err) {
      logError('CentralizedScheduleView', 'Error message', {});
      alert('Failed to add appointment: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleUpdateAppointment = async (appointmentId: string, updates: Partial<Appointment>) => {
    try {
      await centralizedScheduleService.updateAppointment(appointmentId, updates);
      // Schedule will refresh automatically via real-time sync
    } catch (err) {
      logError('CentralizedScheduleView', 'Error message', {});
      alert(
        'Failed to update appointment: ' + (err instanceof Error ? err.message : 'Unknown error')
      );
    }
  };

  const handleDeleteAppointment = async (appointmentId: string, reason?: string) => {
    if (!userRole?.permissions.canDeleteAppointments) {
      alert('You do not have permission to delete appointments');
      return;
    }

    if (confirm('Are you sure you want to delete this appointment?')) {
      try {
        await centralizedScheduleService.deleteAppointment(appointmentId, reason);
        // Schedule will refresh automatically via real-time sync
      } catch (err) {
        logError('CentralizedScheduleView', 'Error message', {});
        alert(
          'Failed to delete appointment: ' + (err instanceof Error ? err.message : 'Unknown error')
        );
      }
    }
  };

  // ============================================================================
  // FILE UPLOAD (Admin Only)
  // ============================================================================

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!userRole?.permissions.canUploadSchedules) {
      alert('Only admin users can upload schedule files');
      return;
    }

    try {
      setIsUploadingFile(true);
      const result = await centralizedScheduleService.uploadScheduleFile(file);

      alert(
        `File uploaded successfully!\n\nImported: ${result.summary.successful} appointments\nDuplicates skipped: ${result.summary.duplicates}\nFailed: ${result.summary.failed}`
      );

      // Schedule will refresh automatically via real-time sync
    } catch (err) {
      logError('CentralizedScheduleView', 'Error message', {});
      alert('File upload failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsUploadingFile(false);
      // Clear the file input
      event.target.value = '';
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading schedule...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="text-red-800">
          <strong>Error:</strong> {error}
        </div>
        <button
          onClick={initializeSchedule}
          className="mt-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header with Controls */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Schedule for {new Date(selectedDate).toLocaleDateString()}
            </h2>

            {/* Provider Filter (Staff/Admin only) */}
            {userRole?.permissions.canViewAllSchedules && (
              <select
                value={selectedProvider}
                onChange={e => setSelectedProvider(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1 text-sm"
              >
                <option value="all">All Providers</option>
                {providers.map(provider => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name} {provider.specialty && `(${provider.specialty})`}
                  </option>
                ))}
              </select>
            )}

            {/* Role Badge */}
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                userRole?.role === 'admin'
                  ? 'bg-purple-100 text-purple-800'
                  : userRole?.role === 'staff'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-blue-100 text-blue-800'
              }`}
            >
              {userRole?.role?.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {/* Add Appointment Button */}
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
            >
              Add Appointment
            </button>

            {/* File Upload (Admin only) */}
            {userRole?.permissions.canUploadSchedules && (
              <div className="relative">
                <input
                  type="file"
                  accept=".csv,.tsv,.txt"
                  onChange={handleFileUpload}
                  disabled={isUploadingFile}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <button
                  disabled={isUploadingFile}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm disabled:opacity-50"
                >
                  {isUploadingFile ? 'Uploading...' : 'Upload Schedule'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Appointments List */}
      <div className="p-4">
        {appointments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No appointments scheduled for this date.
          </div>
        ) : (
          <div className="space-y-2">
            {appointments.map(appointment => (
              <div
                key={appointment.id}
                onClick={() => onAppointmentClick?.(appointment)}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4">
                      <span className="font-medium text-gray-900">
                        {centralizedScheduleService.formatAppointmentTime(appointment)}
                      </span>

                      <span
                        className="w-3 h-3 rounded-full"
                        style={{
                          backgroundColor: centralizedScheduleService.getAppointmentStatusColor(
                            appointment.status
                          ),
                        }}
                      ></span>

                      <span className="text-sm text-gray-600 capitalize">
                        {appointment.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="mt-1 text-sm text-gray-600">
                      <span className="font-medium">
                        {appointment.patient_first_name} {appointment.patient_last_name}
                      </span>
                      {userRole?.permissions.canViewAllSchedules && (
                        <span className="ml-4 text-blue-600">{appointment.provider_name}</span>
                      )}
                    </div>

                    {appointment.chief_complaint && (
                      <div className="mt-1 text-sm text-gray-500">
                        {appointment.chief_complaint}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleUpdateAppointment(appointment.id, {
                          status: appointment.status === 'scheduled' ? 'confirmed' : 'scheduled',
                        });
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      {appointment.status === 'scheduled' ? 'Confirm' : 'Unconfirm'}
                    </button>

                    {userRole?.permissions.canDeleteAppointments && (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleDeleteAppointment(appointment.id);
                        }}
                        className="text-sm text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Appointment Modal */}
      {showAddModal && (
        <AddAppointmentModal
          providers={providers}
          selectedDate={selectedDate}
          userRole={userRole}
          onAdd={handleAddAppointment}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
};

// ============================================================================
// ADD APPOINTMENT MODAL COMPONENT
// ============================================================================

interface AddAppointmentModalProps {
  providers: Array<{ id: string; name: string; specialty?: string }>;
  selectedDate: string;
  userRole: UserRole | null;
  onAdd: (appointmentData: any) => void;
  onClose: () => void;
}

const AddAppointmentModal: React.FC<AddAppointmentModalProps> = ({
  providers,
  selectedDate,
  userRole,
  onAdd,
  onClose,
}) => {
  const [formData, setFormData] = useState({
    provider_id:
      userRole?.role === 'doctor' && userRole.assignedProvider
        ? userRole.assignedProvider.id
        : providers[0]?.id || '',
    patient_first_name: '',
    patient_last_name: '',
    patient_email: '',
    patient_phone: '',
    start_time: '09:00',
    end_time: '09:30',
    appointment_type: 'routine',
    chief_complaint: '',
    notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const appointmentData = {
      provider_id: formData.provider_id,
      patient_data: {
        first_name: formData.patient_first_name,
        last_name: formData.patient_last_name,
        email: formData.patient_email || undefined,
        phone: formData.patient_phone || undefined,
      },
      appointment_data: {
        date: selectedDate,
        start_time: formData.start_time,
        end_time: formData.end_time,
        type: formData.appointment_type,
        chief_complaint: formData.chief_complaint || undefined,
        notes: formData.notes || undefined,
        patient_email: formData.patient_email || undefined,
        patient_phone: formData.patient_phone || undefined,
      },
    };

    onAdd(appointmentData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Add New Appointment</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Provider Selection */}
          {userRole?.permissions.canViewAllSchedules && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
              <select
                value={formData.provider_id}
                onChange={e => setFormData({ ...formData, provider_id: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
              >
                {providers.map(provider => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Patient Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input
                type="text"
                value={formData.patient_first_name}
                onChange={e => setFormData({ ...formData, patient_first_name: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input
                type="text"
                value={formData.patient_last_name}
                onChange={e => setFormData({ ...formData, patient_last_name: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
              />
            </div>
          </div>

          {/* Contact Information */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={formData.patient_email}
              onChange={e => setFormData({ ...formData, patient_email: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={formData.patient_phone}
              onChange={e => setFormData({ ...formData, patient_phone: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>

          {/* Appointment Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
              <input
                type="time"
                value={formData.start_time}
                onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
              <input
                type="time"
                value={formData.end_time}
                onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
          </div>

          {/* Appointment Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={formData.appointment_type}
              onChange={e => setFormData({ ...formData, appointment_type: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="routine">Routine</option>
              <option value="followup">Follow-up</option>
              <option value="consultation">Consultation</option>
              <option value="procedure">Procedure</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>

          {/* Chief Complaint */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chief Complaint</label>
            <input
              type="text"
              value={formData.chief_complaint}
              onChange={e => setFormData({ ...formData, chief_complaint: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="Brief description of the reason for visit"
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Add Appointment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CentralizedScheduleView;
