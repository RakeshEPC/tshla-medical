/**
 * AppointmentCard Component
 * Individual appointment card showing patient details and quick actions
 * Created: September 16, 2025
 */

import {
  Clock,
  User,
  Phone,
  FileText,
  Play,
  Edit,
  AlertCircle,
  CheckCircle,
  Circle,
  Mail,
  Calendar,
} from 'lucide-react';
import type { UnifiedAppointment } from '../../services/unifiedAppointment.service';

interface AppointmentCardProps {
  appointment: UnifiedAppointment;
  onPatientClick: (appointment: UnifiedAppointment) => void;
  onEditClick?: (appointment: UnifiedAppointment) => void;
  onStatusChange?: (appointmentId: string, status: UnifiedAppointment['status']) => void;
  className?: string;
  showActions?: boolean;
}

const getStatusIcon = (status: UnifiedAppointment['status']) => {
  switch (status) {
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'in-progress':
      return <Play className="w-4 h-4 text-blue-500" />;
    case 'cancelled':
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    default:
      return <Circle className="w-4 h-4 text-gray-400" />;
  }
};

const getStatusColor = (status: UnifiedAppointment['status']) => {
  switch (status) {
    case 'completed':
      return 'bg-green-50 border-green-200 text-green-800';
    case 'in-progress':
      return 'bg-blue-50 border-blue-200 text-blue-800';
    case 'cancelled':
      return 'bg-red-50 border-red-200 text-red-800';
    default:
      return 'bg-white border-gray-200 text-gray-900 hover:bg-gray-50';
  }
};

const getVisitTypeBadgeColor = (visitType?: string) => {
  switch (visitType) {
    case 'new-patient':
      return 'bg-purple-100 text-purple-800';
    case 'follow-up':
      return 'bg-blue-100 text-blue-800';
    case 'consultation':
      return 'bg-green-100 text-green-800';
    case 'emergency':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-600';
  }
};

export default function AppointmentCard({
  appointment,
  onPatientClick,
  onEditClick,
  onStatusChange,
  className = '',
  showActions = true,
}: AppointmentCardProps) {
  const handleQuickStatusChange = (
    e: React.MouseEvent,
    newStatus: UnifiedAppointment['status']
  ) => {
    e.stopPropagation();
    if (onStatusChange) {
      onStatusChange(appointment.id, newStatus);
    }
  };

  return (
    <div
      className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${getStatusColor(appointment.status)} ${className}`}
      onClick={() => onPatientClick(appointment)}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="font-medium text-sm">{appointment.time}</span>
          </div>
          {getStatusIcon(appointment.status)}
        </div>

        {showActions && (
          <div className="flex items-center space-x-2">
            {/* Quick Actions */}
            <button
              onClick={e => {
                e.stopPropagation();
                onPatientClick(appointment);
              }}
              className="p-1 rounded hover:bg-white/50 transition-colors"
              title="Start Dictation"
            >
              <FileText className="w-4 h-4" />
            </button>

            {onEditClick && (
              <button
                onClick={e => {
                  e.stopPropagation();
                  onEditClick(appointment);
                }}
                className="p-1 rounded hover:bg-white/50 transition-colors"
                title="Edit Appointment"
              >
                <Edit className="w-4 h-4" />
              </button>
            )}

            {appointment.patientPhone && (
              <a
                href={`tel:${appointment.patientPhone}`}
                onClick={e => e.stopPropagation()}
                className="p-1 rounded hover:bg-white/50 transition-colors"
                title={`Call ${appointment.patientPhone}`}
              >
                <Phone className="w-4 h-4 text-gray-400" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Patient Information */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <User className="w-4 h-4 text-gray-500" />
            <span className="font-semibold text-base">{appointment.patientName}</span>
          </div>

          {appointment.visitType && (
            <span
              className={`px-2 py-1 text-xs rounded-full ${getVisitTypeBadgeColor(appointment.visitType)}`}
            >
              {appointment.visitType.replace('-', ' ').toUpperCase()}
            </span>
          )}
        </div>

        {/* Patient ID/MRN */}
        {appointment.patientId && (
          <p className="text-sm text-gray-500 ml-6">ID: {appointment.patientId}</p>
        )}

        {/* Visit Reason */}
        {appointment.visitReason && (
          <p className="text-sm text-gray-600 ml-6">
            <span className="font-medium">Reason:</span> {appointment.visitReason}
          </p>
        )}

        {/* Contact Information */}
        <div className="ml-6 space-y-1">
          {appointment.patientPhone && (
            <p className="text-sm text-gray-500 flex items-center">
              <Phone className="w-3 h-3 mr-2" />
              {appointment.patientPhone}
            </p>
          )}

          {appointment.patientEmail && (
            <p className="text-sm text-gray-500 flex items-center">
              <Mail className="w-3 h-3 mr-2" />
              {appointment.patientEmail}
            </p>
          )}
        </div>

        {/* Notes */}
        {appointment.notes && (
          <p className="text-sm text-gray-600 ml-6 italic">
            <span className="font-medium">Notes:</span> {appointment.notes}
          </p>
        )}
      </div>

      {/* Quick Status Actions */}
      {onStatusChange && appointment.status !== 'completed' && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex space-x-2">
            {appointment.status === 'scheduled' && (
              <button
                onClick={e => handleQuickStatusChange(e, 'in-progress')}
                className="px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded-full hover:bg-blue-200 transition-colors"
              >
                Start Visit
              </button>
            )}

            {appointment.status === 'in-progress' && (
              <button
                onClick={e => handleQuickStatusChange(e, 'completed')}
                className="px-3 py-1 text-xs bg-green-100 text-green-800 rounded-full hover:bg-green-200 transition-colors"
              >
                Complete
              </button>
            )}

            <button
              onClick={e => handleQuickStatusChange(e, 'cancelled')}
              className="px-3 py-1 text-xs bg-red-100 text-red-800 rounded-full hover:bg-red-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Last Updated */}
      {appointment.updatedAt && (
        <div className="mt-2 text-xs text-gray-400 flex items-center">
          <Calendar className="w-3 h-3 mr-1" />
          Updated {new Date(appointment.updatedAt).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}
