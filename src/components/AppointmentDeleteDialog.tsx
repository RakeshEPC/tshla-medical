import React, { useState } from 'react';
import { scheduleManagementService } from '../services/scheduleManagement.service';

interface AppointmentDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  appointment: {
    id: number;
    patient_name: string;
    provider_name: string;
    scheduled_date: string;
    start_time: string;
    appointment_type?: string;
  } | null;
}

export default function AppointmentDeleteDialog({
  isOpen,
  onClose,
  onSuccess,
  appointment
}: AppointmentDeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !appointment) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      const result = await scheduleManagementService.deleteAppointment(appointment.id);

      if (result.success) {
        onSuccess();
        onClose();
      } else {
        setError(result.error || 'Failed to delete appointment');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (date: string) => {
    try {
      return new Date(date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return date;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        {/* Header */}
        <div className="bg-red-600 text-white px-6 py-4 rounded-t-lg">
          <h2 className="text-xl font-bold">🗑️ Delete Appointment</h2>
        </div>

        <div className="p-6">
          {/* Warning */}
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="text-3xl">⚠️</div>
              <div>
                <div className="font-bold text-red-900 mb-1">
                  Permanent Deletion
                </div>
                <div className="text-sm text-red-700">
                  This action <strong>CANNOT be undone</strong>. The appointment will be permanently removed from the database.
                  <br /><br />
                  <strong>Note:</strong> Consider using "Cancel" instead to keep the record for history.
                </div>
              </div>
            </div>
          </div>

          {/* Appointment Details */}
          <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 mb-4">
            <div className="font-semibold text-gray-900 mb-2">
              Appointment to Delete:
            </div>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-semibold">Patient:</span>{' '}
                {appointment.patient_name}
              </div>
              <div>
                <span className="font-semibold">Provider:</span>{' '}
                {appointment.provider_name}
              </div>
              <div>
                <span className="font-semibold">Date:</span>{' '}
                {formatDate(appointment.scheduled_date)}
              </div>
              <div>
                <span className="font-semibold">Time:</span>{' '}
                {appointment.start_time}
              </div>
              {appointment.appointment_type && (
                <div>
                  <span className="font-semibold">Type:</span>{' '}
                  {appointment.appointment_type}
                </div>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-100 border-2 border-red-500 text-red-700 px-4 py-3 rounded-lg mb-4">
              ❌ {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold disabled:opacity-50 flex items-center gap-2"
            >
              {isDeleting && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              {isDeleting ? 'Deleting...' : 'Delete Permanently'}
            </button>
          </div>

          {/* Admin Note */}
          <div className="mt-4 text-xs text-gray-500 text-center">
            ⚠️ This action requires admin privileges and is logged for audit purposes.
          </div>
        </div>
      </div>
    </div>
  );
}
