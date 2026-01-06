import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface ProviderGroup {
  providerId: string;
  providerName: string;
  appointments: AppointmentData[];
}

interface AppointmentData {
  id: string;
  time: string;
  patient: string;
  internalId?: string;
  tshId?: string;
  mrn?: string;  // Athena Patient ID (MRN)
  phone?: string;
  dob?: string;
  status: string;
  notes?: string;
  preVisitComplete?: boolean;
  dictationComplete?: boolean;
  dictationId?: string;
  postVisitComplete?: boolean;
  summarySent?: boolean;
  hasPriorDictation?: boolean;  // New: indicates if patient has previous dictation notes
  priorDictationCount?: number;  // New: count of prior dictations
}

type ViewMode = 'daily' | 'weekly';

// Helper function to format provider name
function formatProviderName(providerName: string): string {
  if (!providerName) return 'Unknown Provider';

  // Map of all provider credentials
  const providerCredentials: Record<string, string> = {
    // Physicians - DO
    'Chamakkala': 'DO',
    'Patel': 'DO',          // Rakesh Patel, DO and Neha Patel, DO

    // Physicians - MD
    'Watwe': 'MD',          // Veena
    'Raghu': 'MD',          // Preeya
    'Shakya': 'MD',

    // Nurse Practitioners
    'Patel-Konasag': 'NP',  // Kruti
    'Gregorek': 'NP',       // Shannon
    'Adeleke': 'NP',

    // Physician Assistants
    'Bernander': 'PA',
    'Younus': 'PA',         // Nadia Younus

    // Dietitians
    'Laverde': 'RD',
    'Leal': 'RDN, CDE',

    // Other Professionals
    'Subawalla': 'PhD',     // Dil
    'Wade': 'LMFT',         // Kamili Wade
    'Tonye': 'NP',          // Keeping as NP unless specified otherwise
    'Nebeolisa': 'MD',      // Adding as MD (common for endocrinology)
  };

  // Handle format like "GC_EPC_Adeleke_A" or "GC_EPC_Bernander_R"
  if (providerName.includes('_')) {
    const parts = providerName.split('_');
    // Get the last name (e.g., "Adeleke" from "GC_EPC_Adeleke_A")
    let lastName = parts.length >= 3 ? parts[2] : parts[parts.length - 1];
    const initial = parts.length >= 4 ? parts[3] : '';

    // Handle hyphenated names like "Wade-Reescano" or "Patel-Konasag"
    if (lastName.includes('-')) {
      const hyphenParts = lastName.split('-');
      // Use full hyphenated name for lookup first
      if (providerCredentials[lastName]) {
        const credential = providerCredentials[lastName];
        const capitalizedLastName = lastName.split('-').map(part =>
          part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
        ).join('-');

        if (initial) {
          return `${capitalizedLastName}, ${initial}. ${credential}`;
        }
        return `${capitalizedLastName}, ${credential}`;
      }
      lastName = hyphenParts[0]; // Fall back to first part
    }

    // Capitalize first letter of last name
    const capitalizedLastName = lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase();

    // Get credential for this provider
    const credential = providerCredentials[lastName];

    if (credential) {
      // Determine if they should have "Dr." prefix (MD, DO, PhD)
      const isDr = ['MD', 'DO', 'PhD'].includes(credential);

      if (initial) {
        return isDr
          ? `Dr. ${capitalizedLastName}, ${initial}. ${credential}`
          : `${capitalizedLastName}, ${initial}. ${credential}`;
      }
      return isDr
        ? `Dr. ${capitalizedLastName}, ${credential}`
        : `${capitalizedLastName}, ${credential}`;
    }

    // Default to MD if not in our list
    if (initial) {
      return `Dr. ${capitalizedLastName}, ${initial}. MD`;
    }
    return `Dr. ${capitalizedLastName}, MD`;
  }

  return providerName;
}

// Weekly View Component
interface WeeklyViewProps {
  weeklyData: Record<string, ProviderGroup[]>;
  navigate: any;
  getStatusColor: (status: string) => string;
}

function WeeklyView({ weeklyData, navigate, getStatusColor }: WeeklyViewProps) {
  const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  // Get all unique providers across the week
  const allProviders = Array.from(
    new Set(
      Object.values(weeklyData)
        .flat()
        .map(pg => pg.providerId)
    )
  );

  if (allProviders.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-12 text-center">
        <div className="text-6xl mb-4">📭</div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">No Appointments This Week</h3>
        <p className="text-gray-600">There are no appointments scheduled for this week.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Render each provider */}
      {allProviders.map((providerId) => {
        // Get provider name from first occurrence
        const providerName = Object.values(weeklyData)
          .flat()
          .find(pg => pg.providerId === providerId)?.providerName || providerId;

        return (
          <div key={providerId} className="bg-white rounded-lg shadow-lg overflow-hidden">
            {/* Provider Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4">
              <h3 className="text-2xl font-bold">{formatProviderName(providerName)}</h3>
              <p className="text-blue-100 text-sm">Provider ID: {providerId}</p>
            </div>

            {/* Weekly Grid: 5 columns for Mon-Fri */}
            <div className="grid grid-cols-5 gap-0 border-l border-gray-300">
              {weekDays.map((day) => {
                const dayProviders = weeklyData[day] || [];
                const providerGroup = dayProviders.find(pg => pg.providerId === providerId);
                const appointments = providerGroup?.appointments || [];

                return (
                  <div key={day} className="border-r border-gray-300">
                    {/* Day Header */}
                    <div className="bg-gray-100 border-b-2 border-gray-300 px-3 py-3 text-center">
                      <div className="font-bold text-gray-900">{day}</div>
                      <div className="text-sm text-gray-600">{appointments.length} appts</div>
                    </div>

                    {/* Appointments for this day */}
                    <div className="p-2 space-y-2 min-h-[400px] bg-gray-50">
                      {appointments.length === 0 ? (
                        <div className="text-center text-gray-400 text-sm py-8">
                          No appointments
                        </div>
                      ) : (
                        appointments.map((apt) => (
                          <div
                            key={apt.id}
                            className="bg-white rounded border border-gray-200 p-2 hover:border-blue-400 hover:shadow-md transition-all text-xs"
                          >
                            {/* Time */}
                            <div className="font-bold text-blue-600 mb-1">{apt.time}</div>

                            {/* Patient Name */}
                            <div className="font-semibold text-gray-900 mb-1 text-sm">{apt.patient}</div>

                            {/* IDs */}
                            {(apt.internalId || apt.tshId || apt.mrn) && (
                              <div className="space-y-1 mb-2">
                                {apt.mrn && (
                                  <div className="px-1.5 py-0.5 bg-green-50 border border-green-400 text-green-700 font-mono font-bold rounded text-[10px]">
                                    MRN: {apt.mrn}
                                  </div>
                                )}
                                {apt.internalId && (
                                  <div className="px-1.5 py-0.5 bg-blue-50 border border-blue-300 text-blue-700 font-mono font-bold rounded text-[10px]">
                                    ID: {apt.internalId}
                                  </div>
                                )}
                                {apt.tshId && (
                                  <div className="px-1.5 py-0.5 bg-purple-50 border border-purple-300 text-purple-700 font-mono font-bold rounded text-[10px]">
                                    {apt.tshId}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Status - only show if NOT scheduled */}
                            {apt.status !== 'scheduled' && (
                              <div className={`px-2 py-0.5 text-[10px] font-bold rounded border ${getStatusColor(apt.status)} inline-block mb-2`}>
                                {apt.status.toUpperCase()}
                              </div>
                            )}

                            {/* Prior Dictation Indicator */}
                            {apt.hasPriorDictation && (
                              <div className="mb-2 px-2 py-1 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-300 rounded">
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="text-blue-700 font-bold">📝 {apt.priorDictationCount} Prior Note{apt.priorDictationCount! > 1 ? 's' : ''}</span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/dictation-history?patientMrn=${apt.internalId}`);
                                    }}
                                    className="text-blue-600 hover:text-blue-800 underline font-semibold"
                                  >
                                    View
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Workflow Status Indicators */}
                            <div className="space-y-1 mb-2 text-[10px]">
                              {/* Pre-Visit */}
                              <div>
                                {apt.preVisitComplete ? (
                                  <span className="text-green-600 font-semibold">✅ Pre-Visit Ready</span>
                                ) : apt.hasPriorDictation ? (
                                  <div className="flex items-center justify-between">
                                    <span className="text-blue-600 font-semibold">📝 Has Prior Notes</span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/staff-previsit-prep?appointmentId=${apt.id}`);
                                      }}
                                      className="text-purple-600 hover:underline text-[9px]"
                                    >
                                      Add More
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/staff-previsit-prep?appointmentId=${apt.id}`);
                                    }}
                                    className="text-purple-600 font-semibold hover:underline cursor-pointer"
                                  >
                                    📋 Prep Pre-Visit
                                  </button>
                                )}
                              </div>

                              {/* Dictation */}
                              <div>
                                {apt.dictationComplete ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/quick-note?dictationId=${apt.dictationId}`);
                                    }}
                                    className="text-green-600 font-semibold hover:underline cursor-pointer"
                                  >
                                    ✅ Dictation Done
                                  </button>
                                ) : (
                                  <span className="text-orange-600 font-semibold">⏳ Dictation</span>
                                )}
                              </div>

                              {/* Post-Visit */}
                              <div>
                                {apt.postVisitComplete ? (
                                  <span className="text-green-600 font-semibold">✅ Post-Visit</span>
                                ) : (
                                  <span className="text-orange-600 font-semibold">⏳ Post-Visit</span>
                                )}
                              </div>

                              {/* Summary Sent */}
                              <div>
                                {apt.summarySent ? (
                                  <span className="text-green-600 font-semibold">✅ Summary Sent</span>
                                ) : (
                                  <span className="text-gray-500 font-semibold">📧 Summary Pending</span>
                                )}
                              </div>
                            </div>

                            {/* Action: Start Dictation (if not done) */}
                            {!apt.dictationComplete && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Pass appointment ID to load pre-visit summary
                                  navigate(`/quick-note?appointmentId=${apt.id}`);
                                }}
                                className="w-full px-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded text-[10px] transition-colors"
                              >
                                🎤 Start Dictation
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function SchedulePageV2() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date('2025-01-07')); // Default to Jan 7, 2025 where we have appointment data
  const [providerGroups, setProviderGroups] = useState<ProviderGroup[]>([]);
  const [allProviders, setAllProviders] = useState<string[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [weeklyData, setWeeklyData] = useState<Record<string, ProviderGroup[]>>({});

  useEffect(() => {
    if (viewMode === 'daily') {
      loadSchedule();
    } else {
      loadWeeklySchedule();
    }
  }, [selectedDate, selectedProvider, viewMode]);

  const loadSchedule = async () => {
    setIsLoading(true);
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      console.log('Loading schedule for:', dateStr);

      // Query with JOIN to get patient IDs
      let query = supabase
        .from('provider_schedules')
        .select(`
          *,
          unified_patients!provider_schedules_unified_patient_id_fkey (
            patient_id,
            tshla_id,
            mrn,
            phone_primary,
            date_of_birth
          )
        `)
        .eq('scheduled_date', dateStr)
        .order('provider_id')
        .order('start_time');

      if (selectedProvider !== 'all') {
        query = query.eq('provider_id', selectedProvider);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Error loading schedule:', error);
        setProviderGroups([]);
        return;
      }

      console.log('📊 Query returned:', data?.length || 0, 'appointments');

      if (!data || data.length === 0) {
        console.warn('⚠️ No appointments found for date:', dateStr);
        setProviderGroups([]);
        setAllProviders([]);
        return;
      }

      // Get unique providers for dropdown
      const uniqueProviders = Array.from(
        new Set(data.map(apt => apt.provider_id).filter(Boolean))
      ) as string[];
      setAllProviders(uniqueProviders);

      // Get all patient IDs to check for prior dictations
      const patientIds = data
        .map(apt => apt.unified_patient_id)
        .filter(Boolean);

      // Query for prior dictations count for each patient
      const priorDictationsMap = new Map<string, number>();
      if (patientIds.length > 0) {
        const { data: dictationCounts } = await supabase
          .from('dictations')
          .select('patient_id')
          .in('patient_id', patientIds)
          .not('transcription_text', 'is', null);  // Only count dictations with actual content

        if (dictationCounts) {
          // Count dictations per patient
          dictationCounts.forEach(d => {
            const count = priorDictationsMap.get(d.patient_id) || 0;
            priorDictationsMap.set(d.patient_id, count + 1);
          });
        }
      }

      // Group appointments by provider
      const grouped = data.reduce((acc, apt) => {
        const providerId = apt.provider_id || 'Unknown';
        if (!acc[providerId]) {
          acc[providerId] = {
            providerId,
            providerName: apt.provider_name || providerId,
            appointments: []
          };
        }

        const patient = apt.unified_patients;
        const priorCount = apt.unified_patient_id ? priorDictationsMap.get(apt.unified_patient_id) || 0 : 0;

        acc[providerId].appointments.push({
          id: apt.id.toString(),
          time: apt.start_time,
          patient: apt.patient_name || 'Unknown',
          internalId: patient?.patient_id,
          tshId: patient?.tshla_id,
          mrn: patient?.mrn,
          phone: apt.patient_phone || patient?.phone_primary,
          dob: apt.patient_dob || patient?.date_of_birth,
          status: apt.status || 'scheduled',
          notes: apt.chief_diagnosis || apt.visit_reason,
          hasPriorDictation: priorCount > 0,
          priorDictationCount: priorCount
        });

        return acc;
      }, {} as Record<string, ProviderGroup>);

      setProviderGroups(Object.values(grouped));
      console.log('Loaded', Object.keys(grouped).length, 'providers with', data.length, 'appointments');
    } catch (error) {
      console.error('Failed to load schedule:', error);
      setProviderGroups([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadWeeklySchedule = async () => {
    setIsLoading(true);
    try {
      // Get the Monday of the week containing selectedDate
      const weekStart = new Date(selectedDate);
      const day = weekStart.getDay();
      const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
      weekStart.setDate(diff);

      console.log('Loading weekly schedule starting:', weekStart.toISOString().split('T')[0]);

      // Load data for Monday through Friday
      const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      const weekData: Record<string, ProviderGroup[]> = {};
      const allProvidersSet = new Set<string>();

      for (let i = 0; i < 5; i++) {
        const currentDate = new Date(weekStart);
        currentDate.setDate(weekStart.getDate() + i);
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayName = weekDays[i];

        let query = supabase
          .from('provider_schedules')
          .select(`
            *,
            unified_patients!provider_schedules_unified_patient_id_fkey (
              patient_id,
              tshla_id,
              mrn,
              phone_primary,
              date_of_birth
            )
          `)
          .eq('scheduled_date', dateStr)
          .order('provider_id')
          .order('start_time');

        if (selectedProvider !== 'all') {
          query = query.eq('provider_id', selectedProvider);
        }

        const { data, error } = await query;

        if (error) {
          console.error(`Error loading schedule for ${dayName}:`, error);
          weekData[dayName] = [];
          continue;
        }

        if (!data || data.length === 0) {
          weekData[dayName] = [];
          continue;
        }

        // Track all providers
        data.forEach(apt => {
          if (apt.provider_id) allProvidersSet.add(apt.provider_id);
        });

        // Get all patient IDs to check for prior dictations
        const patientIds = data
          .map(apt => apt.unified_patient_id)
          .filter(Boolean);

        // Query for prior dictations count for each patient
        const priorDictationsMap = new Map<string, number>();
        if (patientIds.length > 0) {
          const { data: dictationCounts } = await supabase
            .from('dictations')
            .select('patient_id')
            .in('patient_id', patientIds)
            .not('transcription_text', 'is', null);  // Only count dictations with actual content

          if (dictationCounts) {
            // Count dictations per patient
            dictationCounts.forEach(d => {
              const count = priorDictationsMap.get(d.patient_id) || 0;
              priorDictationsMap.set(d.patient_id, count + 1);
            });
          }
        }

        // Group by provider
        const grouped = data.reduce((acc, apt) => {
          const providerId = apt.provider_id || 'Unknown';
          if (!acc[providerId]) {
            acc[providerId] = {
              providerId,
              providerName: apt.provider_name || providerId,
              appointments: []
            };
          }

          const patient = apt.unified_patients;
          const priorCount = apt.unified_patient_id ? priorDictationsMap.get(apt.unified_patient_id) || 0 : 0;

          acc[providerId].appointments.push({
            id: apt.id.toString(),
            time: apt.start_time,
            patient: apt.patient_name || 'Unknown',
            internalId: patient?.patient_id,
            tshId: patient?.tshla_id,
            mrn: patient?.mrn,
            phone: apt.patient_phone || patient?.phone_primary,
            dob: apt.patient_dob || patient?.date_of_birth,
            status: apt.status || 'scheduled',
            notes: apt.chief_diagnosis || apt.visit_reason,
            hasPriorDictation: priorCount > 0,
            priorDictationCount: priorCount
          });

          return acc;
        }, {} as Record<string, ProviderGroup>);

        weekData[dayName] = Object.values(grouped);
      }

      setWeeklyData(weekData);
      setAllProviders(Array.from(allProvidersSet));
      console.log('Loaded weekly data for', Object.keys(weekData).length, 'days');
    } catch (error) {
      console.error('Failed to load weekly schedule:', error);
      setWeeklyData({});
    } finally {
      setIsLoading(false);
    }
  };

  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getWeekRange = (date: Date) => {
    const weekStart = new Date(date);
    const day = weekStart.getDay();
    const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
    weekStart.setDate(diff);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 4);

    return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'in-progress':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'cancelled':
        return 'bg-red-100 text-red-700 border-red-300';
      default:
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
    }
  };

  const totalAppointments = providerGroups.reduce((sum, p) => sum + p.appointments.length, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <button
                onClick={() => navigate('/doctor')}
                className="text-blue-100 hover:text-white mb-2"
              >
                ← Back to Dashboard
              </button>
              <h1 className="text-3xl font-bold">Provider Schedule</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Date Navigation Bar */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          {/* View Mode Toggle */}
          <div className="flex items-center justify-center mb-4">
            <div className="inline-flex rounded-lg border-2 border-gray-300 p-1 bg-gray-50">
              <button
                onClick={() => setViewMode('daily')}
                className={`px-6 py-2 rounded-md font-semibold transition-all ${
                  viewMode === 'daily'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                📅 Daily View
              </button>
              <button
                onClick={() => setViewMode('weekly')}
                className={`px-6 py-2 rounded-md font-semibold transition-all ${
                  viewMode === 'weekly'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                📆 Weekly View
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* Date Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => changeDate(viewMode === 'weekly' ? -7 : -1)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                ← {viewMode === 'weekly' ? 'Prev Week' : 'Prev'}
              </button>
              <input
                type="date"
                value={selectedDate.toISOString().split('T')[0]}
                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                className="px-4 py-2 border-2 border-gray-300 rounded-lg font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
              <button
                onClick={() => setSelectedDate(new Date('2025-01-07'))}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Jan 7, 2025
              </button>
              <button
                onClick={() => changeDate(viewMode === 'weekly' ? 7 : 1)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                {viewMode === 'weekly' ? 'Next Week' : 'Next'} →
              </button>
            </div>

            {/* Provider Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Provider:</label>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="px-4 py-2 border-2 border-gray-300 rounded-lg font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <option value="all">All Providers ({allProviders.length})</option>
                {allProviders.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date Display */}
          <div className="mt-4 text-center">
            <h2 className="text-2xl font-bold text-gray-900">
              {viewMode === 'weekly' ? `Week of ${getWeekRange(selectedDate)}` : formatDate(selectedDate)}
            </h2>
            {viewMode === 'daily' && (
              <p className="text-gray-600">
                {totalAppointments} appointment{totalAppointments !== 1 ? 's' : ''} •{' '}
                {providerGroups.length} provider{providerGroups.length !== 1 ? 's' : ''}
              </p>
            )}
            {viewMode === 'weekly' && (
              <p className="text-gray-600">
                {allProviders.length} provider{allProviders.length !== 1 ? 's' : ''} • Monday - Friday
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Schedule Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
            <p className="ml-4 text-xl text-gray-600">Loading schedule...</p>
          </div>
        ) : viewMode === 'weekly' ? (
          // WEEKLY VIEW
          <WeeklyView weeklyData={weeklyData} navigate={navigate} getStatusColor={getStatusColor} />
        ) : providerGroups.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No Appointments Found</h3>
            <p className="text-gray-600 mb-4">
              There are no appointments scheduled for {formatDate(selectedDate)}.
            </p>
            <button
              onClick={() => setSelectedDate(new Date('2025-01-07'))}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
            >
              View January 7, 2025 (Sample Data)
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {providerGroups.map((provider) => (
              <div key={provider.providerId} className="bg-white rounded-lg shadow-lg overflow-hidden">
                {/* Provider Header */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold">{formatProviderName(provider.providerName)}</h3>
                      <p className="text-blue-100 text-sm">Provider ID: {provider.providerId}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold">{provider.appointments.length}</div>
                      <div className="text-blue-100 text-sm">appointments</div>
                    </div>
                  </div>
                </div>

                {/* Appointments Grid */}
                <div className="p-6 bg-gray-50">
                  <div className="grid gap-4">
                    {provider.appointments.map((apt) => (
                      <div
                        key={apt.id}
                        className="bg-white rounded-lg border-2 border-gray-200 p-4 hover:border-blue-400 hover:shadow-md transition-all"
                      >
                        <div className="flex items-start justify-between gap-4">
                          {/* Left: Time & Patient Info */}
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="text-2xl font-bold text-blue-600">{apt.time}</div>
                              {/* Only show status if NOT scheduled */}
                              {apt.status !== 'scheduled' && (
                                <span
                                  className={`px-3 py-1 text-xs font-bold rounded-full border-2 ${getStatusColor(apt.status)}`}
                                >
                                  {apt.status.toUpperCase()}
                                </span>
                              )}
                            </div>

                            <div className="mb-2">
                              <p className="text-xl font-bold text-gray-900">{apt.patient}</p>
                            </div>

                            {/* Patient IDs - PROMINENT */}
                            {(apt.internalId || apt.tshId || apt.mrn) && (
                              <div className="flex flex-wrap items-center gap-2 mb-3">
                                {apt.mrn && (
                                  <span className="px-3 py-1.5 bg-green-50 border-2 border-green-400 text-green-700 text-sm font-mono font-bold rounded-lg">
                                    🏥 MRN: {apt.mrn}
                                  </span>
                                )}
                                {apt.internalId && (
                                  <span className="px-3 py-1.5 bg-blue-50 border-2 border-blue-300 text-blue-700 text-sm font-mono font-bold rounded-lg">
                                    🆔 Internal ID: {apt.internalId}
                                  </span>
                                )}
                                {apt.tshId && (
                                  <span className="px-3 py-1.5 bg-purple-50 border-2 border-purple-300 text-purple-700 text-sm font-mono font-bold rounded-lg">
                                    🎫 {apt.tshId}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Workflow Status Grid */}
                            <div className="grid grid-cols-2 gap-2 mb-3">
                              {/* Pre-Visit */}
                              <div>
                                {apt.preVisitComplete ? (
                                  <span className="px-3 py-1.5 bg-green-50 border-2 border-green-300 text-green-700 text-xs font-bold rounded-lg inline-block w-full text-center">
                                    ✅ Pre-Visit Ready
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => navigate(`/staff-previsit-prep?appointmentId=${apt.id}`)}
                                    className="px-3 py-1.5 bg-purple-50 border-2 border-purple-300 text-purple-700 text-xs font-bold rounded-lg w-full hover:bg-purple-100 transition-colors"
                                  >
                                    📋 Prep Pre-Visit
                                  </button>
                                )}
                              </div>

                              {/* Dictation */}
                              <div>
                                {apt.dictationComplete ? (
                                  <button
                                    onClick={() => navigate(`/quick-note?dictationId=${apt.dictationId}`)}
                                    className="px-3 py-1.5 bg-green-50 border-2 border-green-300 text-green-700 text-xs font-bold rounded-lg w-full hover:bg-green-100 transition-colors"
                                  >
                                    ✅ Dictation Done
                                  </button>
                                ) : (
                                  <span className="px-3 py-1.5 bg-orange-50 border-2 border-orange-300 text-orange-700 text-xs font-bold rounded-lg inline-block w-full text-center">
                                    ⏳ Dictation
                                  </span>
                                )}
                              </div>

                              {/* Post-Visit */}
                              <div>
                                {apt.postVisitComplete ? (
                                  <span className="px-3 py-1.5 bg-green-50 border-2 border-green-300 text-green-700 text-xs font-bold rounded-lg inline-block w-full text-center">
                                    ✅ Post-Visit
                                  </span>
                                ) : (
                                  <span className="px-3 py-1.5 bg-orange-50 border-2 border-orange-300 text-orange-700 text-xs font-bold rounded-lg inline-block w-full text-center">
                                    ⏳ Post-Visit
                                  </span>
                                )}
                              </div>

                              {/* Summary Sent */}
                              <div>
                                {apt.summarySent ? (
                                  <span className="px-3 py-1.5 bg-green-50 border-2 border-green-300 text-green-700 text-xs font-bold rounded-lg inline-block w-full text-center">
                                    ✅ Summary Sent
                                  </span>
                                ) : (
                                  <span className="px-3 py-1.5 bg-gray-50 border-2 border-gray-300 text-gray-600 text-xs font-bold rounded-lg inline-block w-full text-center">
                                    📧 Summary Pending
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Additional Info */}
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              {apt.dob && (
                                <span className="flex items-center gap-1">
                                  🎂 DOB: {new Date(apt.dob).toLocaleDateString()}
                                </span>
                              )}
                            </div>

                            {apt.notes && (
                              <div className="mt-2 text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded border border-gray-200">
                                <strong>Notes:</strong> {apt.notes}
                              </div>
                            )}
                          </div>

                          {/* Right: Action Buttons */}
                          <div className="flex flex-col gap-2">
                            {!apt.dictationComplete ? (
                              <button
                                onClick={() => navigate(`/quick-note?appointmentId=${apt.id}`)}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
                              >
                                🎤 Start Dictation
                              </button>
                            ) : (
                              <button
                                onClick={() => navigate(`/quick-note?dictationId=${apt.dictationId}`)}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
                              >
                                📝 View Dictation
                              </button>
                            )}
                            <button
                              onClick={() => navigate(`/patient-chart`)}
                              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
                            >
                              📋 View Chart
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
