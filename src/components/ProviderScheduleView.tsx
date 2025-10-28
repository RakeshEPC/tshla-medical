import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProviderScheduleGroup, ProviderScheduleAppointment, AppointmentStatus } from '../types/schedule.types';

interface ProviderScheduleViewProps {
  date: string;
  providerIds?: string[];
  onRefresh?: () => void;
}

export function ProviderScheduleView({ date, providerIds, onRefresh }: ProviderScheduleViewProps) {
  const navigate = useNavigate();
  const [scheduleData, setScheduleData] = useState<ProviderScheduleGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(date);

  useEffect(() => {
    loadSchedule();
  }, [selectedDate, providerIds]);

  const loadSchedule = async () => {
    setIsLoading(true);
    try {
      // TODO: Call scheduleService to get grouped schedule
      // For now, using mock data
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock data - replace with real Supabase query
      const mockData: ProviderScheduleGroup[] = [
        {
          providerId: 'doc1',
          providerName: 'Dr. Rakesh Patel',
          providerSpecialty: 'Endocrinology',
          appointments: [
            {
              id: '1',
              provider_id: 'doc1',
              provider_name: 'Dr. Rakesh Patel',
              patient_name: 'John Smith',
              patient_age: 45,
              patient_gender: 'M',
              chief_diagnosis: 'Type 2 Diabetes follow-up',
              appointment_type: 'follow-up',
              scheduled_date: selectedDate,
              start_time: '9:00 AM',
              end_time: '9:30 AM',
              duration_minutes: 30,
              status: 'scheduled',
              is_telehealth: false,
            },
            {
              id: '2',
              provider_id: 'doc1',
              provider_name: 'Dr. Rakesh Patel',
              patient_name: 'Sarah Jones',
              patient_age: 32,
              patient_gender: 'F',
              chief_diagnosis: 'Annual physical exam',
              appointment_type: 'wellness',
              scheduled_date: selectedDate,
              start_time: '9:30 AM',
              end_time: '9:45 AM',
              duration_minutes: 15,
              status: 'completed',
              is_telehealth: false,
            },
          ],
          appointmentCount: 2,
          completedCount: 1,
          scheduledCount: 1,
          firstAppointment: '9:00 AM',
          lastAppointment: '9:45 AM',
          totalMinutes: 45,
        },
      ];

      setScheduleData(mockData);
    } catch (error) {
      console.error('Failed to load schedule:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartDictation = (appointment: ProviderScheduleAppointment) => {
    // Navigate to dictation page with appointment context
    navigate(`/dictation/appointment/${appointment.id}`, {
      state: { appointment },
    });
  };

  const handleCompleteAppointment = async (appointmentId: string | number) => {
    // TODO: Call scheduleService to update status
    console.log('Completing appointment:', appointmentId);
    await new Promise(resolve => setTimeout(resolve, 500));
    loadSchedule();
  };

  const getStatusColor = (status: AppointmentStatus): string => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'in-progress':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'cancelled':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'no-show':
        return 'bg-gray-100 text-gray-700 border-gray-300';
      default:
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
    }
  };

  const getAppointmentTypeColor = (type: string): string => {
    switch (type) {
      case 'new-patient':
        return 'bg-purple-50 border-l-purple-500';
      case 'follow-up':
        return 'bg-blue-50 border-l-blue-500';
      case 'wellness':
        return 'bg-green-50 border-l-green-500';
      case 'emergency':
        return 'bg-red-50 border-l-red-500';
      default:
        return 'bg-gray-50 border-l-gray-500';
    }
  };

  // Date navigation
  const handlePrevDay = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    setSelectedDate(prev.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    setSelectedDate(next.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Date Navigation */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-900">
              📅 Schedule for {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevDay}
              className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              ← Prev Day
            </button>
            <button
              onClick={handleToday}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Today
            </button>
            <button
              onClick={handleNextDay}
              className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Next Day →
            </button>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                🔄 Refresh
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Schedule by Provider (Vertical Stack) */}
      {scheduleData.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <div className="text-4xl mb-4">📭</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Appointments Scheduled</h3>
          <p className="text-gray-600">There are no appointments for this date.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {scheduleData.map(provider => (
            <div key={provider.providerId} className="bg-white rounded-lg shadow-md overflow-hidden">
              {/* Provider Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold">{provider.providerName}</h3>
                    {provider.providerSpecialty && (
                      <p className="text-blue-100 text-sm mt-1">{provider.providerSpecialty}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold">{provider.appointmentCount}</div>
                    <div className="text-blue-100 text-sm">patients today</div>
                    <div className="text-blue-200 text-xs mt-1">
                      {provider.completedCount} completed • {provider.scheduledCount} pending
                    </div>
                  </div>
                </div>
              </div>

              {/* Appointments List */}
              <div className="divide-y divide-gray-200">
                {provider.appointments.map(appointment => (
                  <div
                    key={appointment.id}
                    className={`p-6 border-l-4 ${getAppointmentTypeColor(appointment.appointment_type)} transition-all hover:bg-gray-50`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Appointment Details */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="text-lg font-bold text-gray-900">
                            {appointment.start_time} - {appointment.end_time}
                          </div>
                          <span className="text-sm text-gray-500">
                            ({appointment.duration_minutes} min)
                          </span>
                          <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor(appointment.status)}`}>
                            {appointment.status.toUpperCase()}
                          </span>
                          {appointment.is_telehealth && (
                            <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded">
                              🎥 Telehealth
                            </span>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xl font-bold text-gray-900">
                              {appointment.patient_name}
                            </span>
                            {appointment.patient_age && (
                              <span className="text-sm text-gray-600">
                                {appointment.patient_age}yo
                              </span>
                            )}
                            {appointment.patient_gender && (
                              <span className="text-sm text-gray-600">
                                {appointment.patient_gender}
                              </span>
                            )}
                          </div>

                          {appointment.chief_diagnosis && (
                            <div className="text-sm text-gray-700">
                              <span className="font-semibold">DX:</span> {appointment.chief_diagnosis}
                            </div>
                          )}

                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="capitalize">{appointment.appointment_type.replace('-', ' ')}</span>
                            {appointment.patient_dob && (
                              <span>DOB: {new Date(appointment.patient_dob).toLocaleDateString()}</span>
                            )}
                            {appointment.patient_phone && (
                              <span>📞 {appointment.patient_phone}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col gap-2">
                        {appointment.status !== 'completed' && (
                          <>
                            <button
                              onClick={() => handleStartDictation(appointment)}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
                            >
                              ✍️ Start Dictation
                            </button>
                            <button
                              onClick={() => handleCompleteAppointment(appointment.id)}
                              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
                            >
                              ✓ Mark Complete
                            </button>
                          </>
                        )}
                        {appointment.status === 'completed' && (
                          <div className="text-sm text-green-600 font-semibold text-center">
                            ✓ Completed
                          </div>
                        )}
                        <button
                          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                        >
                          View Chart
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
