import React, { useState } from 'react';
import { scheduleManagementService } from '../services/scheduleManagement.service';

interface AppointmentCancelDialogProps {
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

export default function AppointmentCancelDialog({
  isOpen,
  onClose,
  onSuccess,
  appointment
}: AppointmentCancelDialogProps) {
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  if (!isOpen || !appointment) return null;

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reason.trim()) {
      setError('Please provide a cancellation reason');
      return;
    }

    setIsCancelling(true);
    setError(null);

    try {
      const result = await scheduleManagementService.cancelAppointment(
        appointment.id,
        reason,
        notes || undefined
      );

      if (result.success) {
        onSuccess();
        handleClose();
      } else {
        setError(result.error || 'Failed to cancel appointment');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleClose = () => {
    setReason('');
    setNotes('');
    setError(null);
    onClose();
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

  // Common cancellation reasons
  const commonReasons = [
    'Patient requested cancellation',
    'Patient no-show',
    'Provider unavailable',
    'Rescheduled to different date/time',
    'Patient illness',
    'Transportation issues',
    'Insurance issues',
    'Facility closure',
    'Other'
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl">
        {/* Header */}
        <div className="bg-orange-600 text-white px-6 py-4 rounded-t-lg">
          <h2 className="text-xl font-bold">❌ Cancel Appointment</h2>
        </div>

        <form onSubmit={handleCancel} className="p-6">
          {/* Info Notice */}
          <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl">ℹ️</div>
              <div className="text-sm text-blue-700">
                <strong>Soft Cancellation:</strong> The appointment record will be kept in the system with status "cancelled". This preserves history for reporting and audit purposes.
              </div>
            </div>
          </div>

          {/* Appointment Details */}
          <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 mb-4">
            <div className="font-semibold text-gray-900 mb-2">
              Appointment to Cancel:
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

          {/* Cancellation Reason */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Cancellation Reason * (Required)
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 mb-2"
              required
            >
              <option value="">Select a reason...</option>
              {commonReasons.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            {reason === 'Other' && (
              <input
                type="text"
                placeholder="Please specify the reason"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500"
              />
            )}
          </div>

          {/* Additional Notes */}
          {reason && reason !== 'Other' && (
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Additional Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Any additional details about the cancellation..."
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500"
              />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-100 border-2 border-red-500 text-red-700 px-4 py-3 rounded-lg mb-4">
              ❌ {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t-2 border-gray-300">
            <button
              type="button"
              onClick={handleClose}
              disabled={isCancelling}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold disabled:opacity-50"
            >
              Keep Appointment
            </button>
            <button
              type="submit"
              disabled={isCancelling || !reason}
              className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-semibold disabled:opacity-50 flex items-center gap-2"
            >
              {isCancelling && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              {isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
            </button>
          </div>

          {/* Audit Note */}
          <div className="mt-4 text-xs text-gray-500 text-center">
            📝 Cancellation will be logged with timestamp and user for audit purposes.
          </div>
        </form>
      </div>
    </div>
  );
}
