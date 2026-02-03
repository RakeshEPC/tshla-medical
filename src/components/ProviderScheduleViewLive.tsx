import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { ProviderScheduleGroup, ProviderScheduleAppointment, AppointmentStatus } from '../types/schedule.types';
import { formatDOB } from '../utils/date';

interface ProviderScheduleViewProps {
  date: string;
  providerIds?: string[];
  onRefresh?: () => void;
}

export function ProviderScheduleViewLive({ date, providerIds, onRefresh }: ProviderScheduleViewProps) {
  const navigate = useNavigate();
  const [scheduleData, setScheduleData] = useState<ProviderScheduleGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(date);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSchedule();
  }, [selectedDate, providerIds]);

  const loadSchedule = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('Loading schedule for date:', selectedDate);

      // Query provider_schedules table from Supabase
      let query = supabase
        .from('provider_schedules')
        .select(`
          *,
          unified_patients!provider_schedules_unified_patient_id_fkey (
            patient_id,
            tshla_id,
            first_name,
            last_name,
            phone_primary,
            email,
            date_of_birth,
            gender
          )
        `)
        .eq('scheduled_date', selectedDate)
        .order('provider_id')
        .order('start_time');

      // Filter by specific providers if provided
      if (providerIds && providerIds.length > 0) {
        query = query.in('provider_id', providerIds);
      }

      const { data: appointments, error: queryError } = await query;

      if (queryError) {
        console.error('Supabase query error:', queryError);
        setError(`Database error: ${queryError.message}`);
        setScheduleData([]);
        return;
      }

      console.log(`Found ${appointments?.length || 0} appointments`);

      if (!appointments || appointments.length === 0) {
        setScheduleData([]);
        return;
      }

      // Group appointments by provider
      const groupedByProvider = appointments.reduce((acc, appt) => {
        const providerId = appt.provider_id || 'unknown';
        if (!acc[providerId]) {
          acc[providerId] = [];
        }
        acc[providerId].push(appt);
        return acc;
      }, {} as Record<string, any[]>);

      // Transform into ProviderScheduleGroup format
      const scheduleGroups: ProviderScheduleGroup[] = Object.entries(groupedByProvider).map(
        ([providerId, providerAppts]) => {
          const completedCount = providerAppts.filter(a => a.status === 'completed').length;
          const scheduledCount = providerAppts.filter(a => a.status === 'scheduled').length;

          return {
            providerId,
            providerName: providerAppts[0]?.provider_name || providerId,
            providerSpecialty: providerAppts[0]?.provider_specialty,
            appointments: providerAppts.map(appt => {
              // Get patient data from join
              const patient = appt.unified_patients;

              return {
                id: appt.id,
                provider_id: appt.provider_id,
                provider_name: appt.provider_name,
                patient_name: appt.patient_name || (patient ? `${patient.first_name} ${patient.last_name}` : 'Unknown'),
                patient_age: appt.patient_age,
                patient_gender: appt.patient_gender || patient?.gender,
                patient_dob: appt.patient_dob || patient?.date_of_birth,
                patient_phone: appt.patient_phone || patient?.phone_primary,
                patient_email: appt.patient_email || patient?.email,

                // ========================================
                // PATIENT IDENTIFIERS - CRITICAL!
                // ========================================
                // ⚠️ DO NOT CONFUSE patient_id with tshla_id!
                //
                // patient_id  = 8-digit internal ID (e.g., "99364924")
                //               → ONLY for internal_id field
                //               → NEVER use for display!
                //
                // tshla_id    = Formatted TSH ID (e.g., "TSH 972-918")
                //               → USE for tsh_id field
                //               → THIS is what shows in purple!
                //
                // See: src/types/unified-patient.types.ts
                // See: TSH_ID_FORMAT_FIX.md
                // ========================================
                internal_id: patient?.patient_id,      // 8-digit (not displayed)
                tsh_id: patient?.tshla_id,             // Formatted "TSH XXX-XXX" (purple display)
                mrn: appt.patient_mrn || patient?.mrn, // Medical Record Number (blue display)
                chief_diagnosis: appt.chief_diagnosis || appt.visit_reason,
                appointment_type: appt.appointment_type || 'follow-up',
                scheduled_date: appt.scheduled_date,
                start_time: appt.start_time,
                end_time: appt.end_time,
                duration_minutes: appt.duration_minutes || 20,
                status: appt.status,
                is_telehealth: appt.is_telehealth || false,
              };
            }),
            appointmentCount: providerAppts.length,
            completedCount,
            scheduledCount,
            firstAppointment: providerAppts[0]?.start_time,
            lastAppointment: providerAppts[providerAppts.length - 1]?.end_time,
            totalMinutes: providerAppts.reduce((sum, a) => sum + (a.duration_minutes || 20), 0),
          };
        }
      );

      console.log('Schedule groups:', scheduleGroups.length);
      setScheduleData(scheduleGroups);
    } catch (error) {
      console.error('Failed to load schedule:', error);
      setError(`Failed to load schedule: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    try {
      const { error } = await supabase
        .from('provider_schedules')
        .update({ status: 'completed' })
        .eq('id', appointmentId);

      if (error) {
        console.error('Error completing appointment:', error);
        return;
      }

      loadSchedule();
    } catch (error) {
      console.error('Failed to complete appointment:', error);
    }
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
        <p className="ml-4 text-gray-600">Loading schedule...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="text-red-700 font-semibold mb-2">Error Loading Schedule</div>
        <div className="text-red-600 text-sm">{error}</div>
        <button
          onClick={loadSchedule}
          className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
        >
          Retry
        </button>
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
            <button
              onClick={loadSchedule}
              className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Schedule by Provider (Vertical Stack) */}
      {scheduleData.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <div className="text-4xl mb-4">📭</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Appointments Scheduled</h3>
          <p className="text-gray-600">There are no appointments for {selectedDate}.</p>
          <p className="text-sm text-gray-500 mt-2">Try selecting a different date or check back later.</p>
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

                          {/* Show MRN and TSH ID */}
                          <div className="flex items-center gap-4 text-xs font-mono bg-gray-50 px-3 py-2 rounded">
                            {appointment.mrn && (
                              <span className="text-blue-700">
                                MRN: <strong>{appointment.mrn}</strong>
                              </span>
                            )}
                            {(appointment as any).tsh_id && (
                              <span className="text-purple-700">
                                TSH ID: <strong>{(appointment as any).tsh_id}</strong>
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
                              <span>DOB: {formatDOB(appointment.patient_dob)}</span>
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
