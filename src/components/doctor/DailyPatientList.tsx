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

// Get provider initials for avatar badge
const getProviderInitials = (name: string): string => {
  if (!name || name === 'Dr. Unknown') return '??';
  const parts = name.replace(/^Dr\.\s*/i, '').split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

// Get color for provider badge
const getProviderBadgeColor = (doctorName: string): string => {
  // Create consistent color based on name hash
  const hash = doctorName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-teal-500',
    'bg-red-500',
  ];
  return colors[hash % colors.length];
};

export default function DailyPatientList({
  selectedDate,
  appointments,
  onPatientClick,
  onAddAppointment,
  isLoading = false,
}: DailyPatientListProps) {
  // Group appointments by provider
  const appointmentsByProvider = appointments.reduce(
    (acc, appointment) => {
      const providerName = appointment.doctorName || 'Unknown Provider';
      if (!acc[providerName]) {
        acc[providerName] = [];
      }
      acc[providerName].push(appointment);
      return acc;
    },
    {} as Record<string, UnifiedAppointment[]>
  );

  // Sort providers alphabetically
  const providerNames = Object.keys(appointmentsByProvider).sort();

  // Sort appointments within each provider by time
  providerNames.forEach(provider => {
    appointmentsByProvider[provider].sort((a, b) => {
      // Convert time to comparable format
      const timeToMinutes = (time: string) => {
        const [timePart, period] = time.split(' ');
        const [hours, minutes] = timePart.split(':').map(Number);
        const hour24 = period === 'PM' && hours !== 12 ? hours + 12 : period === 'AM' && hours === 12 ? 0 : hours;
        return hour24 * 60 + minutes;
      };
      return timeToMinutes(a.time) - timeToMinutes(b.time);
    });
  });

  // Debug: show provider distribution
  if (appointments.length > 0) {
    console.log('📊 [DailyPatientList] Provider distribution:', {
      totalAppointments: appointments.length,
      totalProviders: providerNames.length,
      providerBreakdown: providerNames.map(name => ({
        provider: name,
        appointmentCount: appointmentsByProvider[name].length,
        timeRange: appointmentsByProvider[name].length > 0 ?
          `${appointmentsByProvider[name][0].time} - ${appointmentsByProvider[name][appointmentsByProvider[name].length - 1].time}` :
          'N/A'
      }))
    });
  }

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

      {/* Provider Sections */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-6">
          {providerNames.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No appointments scheduled for this date</p>
              <p className="text-gray-400 text-sm mt-2">Select a different date or add appointments</p>
            </div>
          ) : (
            providerNames.map(providerName => {
              const providerAppointments = appointmentsByProvider[providerName];
              const providerColor = getProviderBadgeColor(providerName);
              const providerInitials = getProviderInitials(providerName);

              return (
                <div key={providerName} className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden">
                  {/* Provider Header */}
                  <div className={`${providerColor} p-4 flex items-center space-x-3`}>
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-lg">
                      {providerInitials}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white">{providerName}</h3>
                      <p className="text-sm text-white/90">
                        {providerAppointments.length} appointment{providerAppointments.length !== 1 ? 's' : ''}
                        {providerAppointments.length > 0 && (
                          <span className="ml-2">
                            ({providerAppointments[0].time} - {providerAppointments[providerAppointments.length - 1].time})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Provider's Appointments */}
                  <div className="divide-y divide-gray-200">
                    {providerAppointments.map((appointment, idx) => (
                      <div
                        key={`${providerName}-${idx}`}
                        className={`p-4 cursor-pointer transition-all duration-200 hover:bg-gray-50 ${
                          appointment.status === 'completed' ? 'bg-green-50/50' :
                          appointment.status === 'in-progress' ? 'bg-blue-50/50' :
                          appointment.status === 'cancelled' ? 'bg-red-50/50' :
                          'bg-white'
                        }`}
                        onClick={() => onPatientClick(appointment)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-2">
                              <Clock className="w-4 h-4 text-gray-500" />
                              <span className="font-bold text-base">{appointment.time}</span>
                            </div>
                            {getStatusIcon(appointment.status)}
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                onPatientClick(appointment);
                              }}
                              className="p-2 rounded hover:bg-gray-200 transition-colors"
                              title="Start Dictation"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                            {appointment.patientPhone && <Phone className="w-4 h-4 text-gray-400" />}
                          </div>
                        </div>

                        <div className="ml-6">
                          <div className="flex items-center space-x-2 mb-1">
                            <User className="w-4 h-4 text-gray-500" />
                            <span className="font-semibold text-lg">{appointment.patientName}</span>
                            {appointment.visitType && (
                              <span className="px-2 py-1 text-xs rounded-full bg-gray-200 text-gray-700 font-medium">
                                {appointment.visitType.replace('-', ' ')}
                              </span>
                            )}
                          </div>

                          {appointment.visitReason && (
                            <p className="text-sm text-gray-600 mt-1">{appointment.visitReason}</p>
                          )}

                          {appointment.patientPhone && (
                            <p className="text-sm text-gray-500 mt-1">
                              📞 {appointment.patientPhone}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
