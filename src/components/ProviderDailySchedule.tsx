import React, { useState, useEffect } from 'react';
import { simpleAppointmentService } from '../services/simpleAppointment.service';
import { supabaseAuthService as unifiedAuthService } from '../services/supabaseAuth.service';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

interface Appointment {
  id: string;
  date: string;
  time: string;
  patientName: string;
  patientId: string;
  doctorName: string;
  provider: string;
  status: string;
  email?: string;
  phone?: string;
  dob?: string;
  chiefComplaint?: string;
  duration?: number;
}

interface GroupedAppointments {
  [provider: string]: Appointment[];
}

export default function ProviderDailySchedule() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [groupedAppointments, setGroupedAppointments] = useState<GroupedAppointments>({});
  const [loading, setLoading] = useState(false);
  const [currentProviderIndex, setCurrentProviderIndex] = useState(0);

  useEffect(() => {
    loadAppointments();
    setCurrentProviderIndex(0); // Reset to first provider when date changes
  }, [selectedDate]);

  const loadAppointments = async () => {
    setLoading(true);
    try {
      const dateStr = formatDateForAPI(selectedDate);
      const allAppointments = await simpleAppointmentService.getAppointments();

      // Filter appointments for selected date
      const dayAppointments = allAppointments.filter((appt: Appointment) => appt.date === dateStr);

      // Sort by time
      dayAppointments.sort((a: Appointment, b: Appointment) => {
        const timeA = parseTime(a.time);
        const timeB = parseTime(b.time);
        return timeA - timeB;
      });

      setAppointments(dayAppointments);

      // Group by provider
      const grouped: GroupedAppointments = {};
      dayAppointments.forEach((appt: Appointment) => {
        const provider = appt.doctorName || appt.provider || 'Unassigned';
        if (!grouped[provider]) {
          grouped[provider] = [];
        }
        grouped[provider].push(appt);
      });

      setGroupedAppointments(grouped);
    } catch (error) {
      logError('ProviderDailySchedule', 'Error message', {});
    } finally {
      setLoading(false);
    }
  };

  const formatDateForAPI = (date: Date): string => {
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  const formatDateDisplay = (date: Date): string => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    return date.toLocaleDateString('en-US', options);
  };

  const parseTime = (timeStr: string): number => {
    const [time, period] = timeStr.split(/\s+/);
    let [hours, minutes] = time.split(':').map(Number);

    if (period?.toUpperCase() === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period?.toUpperCase() === 'AM' && hours === 12) {
      hours = 0;
    }

    return hours * 60 + (minutes || 0);
  };

  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const goToPreviousProvider = () => {
    if (currentProviderIndex > 0) {
      setCurrentProviderIndex(currentProviderIndex - 1);
    }
  };

  const goToNextProvider = () => {
    const providers = Object.keys(groupedAppointments);
    if (currentProviderIndex < providers.length - 1) {
      setCurrentProviderIndex(currentProviderIndex + 1);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'completed':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getProviderColor = (index: number) => {
    const colors = [
      'bg-blue-50 border-blue-200',
      'bg-green-50 border-green-200',
      'bg-purple-50 border-purple-200',
      'bg-orange-50 border-orange-200',
      'bg-pink-50 border-pink-200',
      'bg-indigo-50 border-indigo-200',
      'bg-teal-50 border-teal-200',
      'bg-yellow-50 border-yellow-200',
    ];
    return colors[index % colors.length];
  };

  const providers = Object.keys(groupedAppointments).sort();
  const currentProvider = providers[currentProviderIndex];
  const currentProviderAppointments = currentProvider ? groupedAppointments[currentProvider] : [];
  const totalAppointments = appointments.length;
  const providerCount = providers.length;

  return (
    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg shadow-lg p-6 border-4 border-purple-400">
      {/* Header with Day Navigation */}
      <div className="flex items-center justify-between mb-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 rounded-lg">
        <div className="flex items-center space-x-4">
          <button
            onClick={goToPreviousDay}
            className="p-2 bg-white text-purple-600 hover:bg-purple-100 rounded-lg transition-colors"
            title="Previous Day"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          <div className="text-center">
            <h2 className="text-2xl font-bold text-white">{formatDateDisplay(selectedDate)}</h2>
            <p className="text-sm text-purple-100">
              {totalAppointments} appointments • {providerCount} providers
            </p>
          </div>

          <button
            onClick={goToNextDay}
            className="p-2 bg-white text-purple-600 hover:bg-purple-100 rounded-lg transition-colors"
            title="Next Day"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <button
          onClick={goToToday}
          className="px-4 py-2 bg-yellow-400 text-purple-900 font-bold rounded-lg hover:bg-yellow-300 transition-colors animate-pulse"
        >
          🌟 TODAY 🌟
        </button>
      </div>

      {/* Provider Navigation */}
      {providerCount > 0 && (
        <div className="flex items-center justify-between mb-6 p-4 bg-gradient-to-r from-green-400 to-blue-500 rounded-lg border-2 border-green-600">
          <button
            onClick={goToPreviousProvider}
            disabled={currentProviderIndex === 0}
            className={`p-3 rounded-lg transition-colors text-2xl ${
              currentProviderIndex === 0
                ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                : 'bg-yellow-400 hover:bg-yellow-300 text-black font-bold'
            }`}
            title="Previous Provider"
          >
            ⬅️
          </button>

          <div className="text-center bg-white rounded-lg px-6 py-3">
            <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-blue-600">
              🩺 Dr. {currentProvider} 🩺
            </h3>
            <p className="text-lg text-gray-700 font-semibold">
              Provider {currentProviderIndex + 1} of {providerCount}
            </p>
          </div>

          <button
            onClick={goToNextProvider}
            disabled={currentProviderIndex === providers.length - 1}
            className={`p-3 rounded-lg transition-colors text-2xl ${
              currentProviderIndex === providers.length - 1
                ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                : 'bg-yellow-400 hover:bg-yellow-300 text-black font-bold'
            }`}
            title="Next Provider"
          >
            ➡️
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* No Appointments Message */}
      {!loading && appointments.length === 0 && (
        <div className="text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-gray-400 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="text-gray-500 text-lg">No appointments scheduled for this day</p>
        </div>
      )}

      {/* Current Provider's Appointments */}
      {!loading && currentProvider && currentProviderAppointments.length > 0 && (
        <div
          className={`border-2 rounded-lg overflow-hidden ${getProviderColor(currentProviderIndex)}`}
        >
          {/* Provider Summary */}
          <div className="bg-white bg-opacity-70 px-4 py-3 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xl">
                  {currentProvider.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-800">
                    Dr. {currentProvider}'s Schedule
                  </h3>
                  <p className="text-sm text-gray-600">
                    {currentProviderAppointments.length} appointment
                    {currentProviderAppointments.length !== 1 ? 's' : ''} today
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">
                  {currentProviderAppointments.filter(a => a.status === 'completed').length}{' '}
                  completed
                </p>
                <p className="text-sm text-gray-500">
                  {
                    currentProviderAppointments.filter(
                      a => a.status !== 'completed' && a.status !== 'cancelled'
                    ).length
                  }{' '}
                  remaining
                </p>
              </div>
            </div>
          </div>

          {/* Appointments List */}
          <div className="divide-y divide-gray-200">
            {currentProviderAppointments.map((appointment, index) => (
              <div
                key={appointment.id || index}
                className="px-4 py-3 hover:bg-white hover:bg-opacity-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className="text-sm font-semibold text-gray-700 bg-white px-2 py-1 rounded">
                        {appointment.time}
                      </span>
                      <span
                        className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(appointment.status)}`}
                      >
                        {appointment.status || 'Scheduled'}
                      </span>
                      {appointment.duration && (
                        <span className="text-xs text-gray-500">{appointment.duration} min</span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div>
                        <p className="font-medium text-gray-900">{appointment.patientName}</p>
                        {appointment.patientId && (
                          <p className="text-sm text-gray-600">ID: {appointment.patientId}</p>
                        )}
                        {appointment.dob && (
                          <p className="text-sm text-gray-600">DOB: {appointment.dob}</p>
                        )}
                      </div>

                      <div className="space-y-1">
                        {appointment.phone && (
                          <p className="text-sm text-gray-600 flex items-center">
                            <svg
                              className="w-4 h-4 mr-1"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                              />
                            </svg>
                            {appointment.phone}
                          </p>
                        )}
                        {appointment.email && (
                          <p className="text-sm text-gray-600 flex items-center">
                            <svg
                              className="w-4 h-4 mr-1"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                              />
                            </svg>
                            {appointment.email}
                          </p>
                        )}
                      </div>
                    </div>

                    {appointment.chiefComplaint && (
                      <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-700">
                        <span className="font-medium">Chief Complaint:</span>{' '}
                        {appointment.chiefComplaint}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="ml-4 flex space-x-2">
                    <button
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="View Details"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    </button>
                    <button
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Start Visit"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
