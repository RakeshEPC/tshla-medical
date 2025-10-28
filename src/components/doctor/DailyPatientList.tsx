/**
 * DailyPatientList Component
 * Displays daily schedule in 15-minute time slots with patient appointments
 * Created: September 16, 2025
 */

import { useState, useEffect } from 'react';
import {
  Clock,
  User,
  Phone,
  FileText,
  Play,
  Plus,
  AlertCircle,
  CheckCircle,
  Circle,
} from 'lucide-react';
import type { UnifiedAppointment } from '../../services/unifiedAppointment.service';

interface DailyPatientListProps {
  providerId: string;
  selectedDate: Date;
  appointments: UnifiedAppointment[];
  onPatientClick: (appointment: UnifiedAppointment) => void;
  onAddAppointment: (timeSlot: string) => void;
  isLoading?: boolean;
}

// Generate 15-minute time slots from 8 AM to 5:30 PM
const generateTimeSlots = (): string[] => {
  const slots: string[] = [];

  // Morning slots (8:00 AM to 11:45 AM)
  for (let hour = 8; hour < 12; hour++) {
    slots.push(`${hour}:00 AM`);
    slots.push(`${hour}:15 AM`);
    slots.push(`${hour}:30 AM`);
    slots.push(`${hour}:45 AM`);
  }

  // Noon slots
  slots.push('12:00 PM');
  slots.push('12:15 PM');
  slots.push('12:30 PM');
  slots.push('12:45 PM');

  // Afternoon slots (1:00 PM to 5:30 PM)
  for (let hour = 1; hour <= 5; hour++) {
    slots.push(`${hour}:00 PM`);
    slots.push(`${hour}:15 PM`);
    slots.push(`${hour}:30 PM`);
    if (hour < 5) {
      // Don't add 5:45 PM slot
      slots.push(`${hour}:45 PM`);
    }
  }

  return slots;
};

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

export default function DailyPatientList({
  providerId,
  selectedDate,
  appointments,
  onPatientClick,
  onAddAppointment,
  isLoading = false,
}: DailyPatientListProps) {
  const timeSlots = generateTimeSlots();

  // Create a map of appointments by time for quick lookup
  const appointmentsByTime = appointments.reduce(
    (acc, appointment) => {
      acc[appointment.time] = appointment;
      return acc;
    },
    {} as Record<string, UnifiedAppointment>
  );

  const formatDateDisplay = () => {
    const today = new Date();
    const isToday = selectedDate.toDateString() === today.toDateString();

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = selectedDate.toDateString() === tomorrow.toDateString();

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = selectedDate.toDateString() === yesterday.toDateString();

    if (isToday) return 'Today';
    if (isTomorrow) return 'Tomorrow';
    if (isYesterday) return 'Yesterday';

    return selectedDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4 w-1/3"></div>
          {[...Array(10)].map((_, index) => (
            <div key={index} className="flex items-center p-3 mb-2 border rounded">
              <div className="w-16 h-4 bg-gray-200 rounded mr-4"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded mb-2 w-1/2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/3"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <h2 className="text-xl font-semibold text-gray-900">
          Daily Schedule - {formatDateDisplay()}
          {appointments.length > 0 && appointments[0].doctorName && appointments[0].doctorName !== 'Dr. Unknown' && (
            <span className="text-base font-normal text-gray-600 ml-2">
              ({appointments[0].doctorName})
            </span>
          )}
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          {selectedDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
        <div className="flex items-center space-x-4 mt-2 text-sm">
          <span className="flex items-center">
            <Circle className="w-3 h-3 text-gray-400 mr-1" />
            Scheduled ({appointments.filter(a => a.status === 'scheduled').length})
          </span>
          <span className="flex items-center">
            <Play className="w-3 h-3 text-blue-500 mr-1" />
            In Progress ({appointments.filter(a => a.status === 'in-progress').length})
          </span>
          <span className="flex items-center">
            <CheckCircle className="w-3 h-3 text-green-500 mr-1" />
            Completed ({appointments.filter(a => a.status === 'completed').length})
          </span>
        </div>
      </div>

      {/* Time Slots */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-1">
          {timeSlots.map(timeSlot => {
            const appointment = appointmentsByTime[timeSlot];

            if (appointment) {
              // Appointment card
              return (
                <div
                  key={timeSlot}
                  className={`p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 ${getStatusColor(appointment.status)}`}
                  onClick={() => onPatientClick(appointment)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <span className="font-medium text-sm">{timeSlot}</span>
                      </div>
                      {getStatusIcon(appointment.status)}
                    </div>
                    <div className="flex items-center space-x-2">
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
                      {appointment.patientPhone && <Phone className="w-4 h-4 text-gray-400" />}
                    </div>
                  </div>

                  <div className="mt-2">
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4 text-gray-500" />
                      <span className="font-semibold">{appointment.patientName}</span>
                      {appointment.visitType && (
                        <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600">
                          {appointment.visitType.replace('-', ' ')}
                        </span>
                      )}
                    </div>

                    {appointment.visitReason && (
                      <p className="text-sm text-gray-600 mt-1 ml-6">{appointment.visitReason}</p>
                    )}

                    {appointment.patientPhone && (
                      <p className="text-sm text-gray-500 mt-1 ml-6">
                        📞 {appointment.patientPhone}
                      </p>
                    )}
                  </div>
                </div>
              );
            } else {
              // Empty time slot
              return (
                <div
                  key={timeSlot}
                  className="p-3 border border-dashed border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group"
                  onClick={() => onAddAppointment(timeSlot)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-gray-500">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm">{timeSlot}</span>
                    </div>
                    <Plus className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                  </div>
                  <span className="text-xs text-gray-400 ml-6 group-hover:text-gray-500">
                    Click to add appointment
                  </span>
                </div>
              );
            }
          })}
        </div>
      </div>
    </div>
  );
}
