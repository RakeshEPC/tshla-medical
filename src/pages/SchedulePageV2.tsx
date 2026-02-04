import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import AppointmentFormModal from '../components/AppointmentFormModal';
import AppointmentCancelDialog from '../components/AppointmentCancelDialog';
import { formatDOB } from '../utils/date';

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
  appointmentType?: string;  // New: appointment type (new-patient, follow-up, telehealth, etc.)
  isTelehealth?: boolean;    // New: telehealth flag
  duration?: number;         // New: appointment duration in minutes
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
                            {(apt.internalId || apt.tshId || apt.mrn || apt.phone) && (
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
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenPatientPortal(apt.tshId!);
                                    }}
                                    title="Open Patient Portal as this patient"
                                    className="px-1.5 py-0.5 bg-purple-50 border border-purple-300 text-purple-700 font-mono font-bold rounded text-[10px] hover:bg-purple-200 hover:border-purple-500 cursor-pointer transition-colors"
                                  >
                                    {apt.tshId} ↗
                                  </button>
                                )}
                                {apt.phone && (
                                  <div className="px-1.5 py-0.5 bg-orange-50 border border-orange-400 text-orange-700 font-mono font-bold rounded text-[10px]" title="Patient phone (for portal login)">
                                    📞 {apt.phone}
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
                                        const url = `/staff-previsit-prep?appointmentId=${apt.id}`;
                                        console.log('🔗 Opening pre-visit prep in new tab:', url);
                                        const newWindow = window.open(url, '_blank');
                                        if (!newWindow) {
                                          console.error('❌ Popup blocked! Falling back to same-tab navigation');
                                          alert('Popup was blocked by browser. Please allow popups for this site, or we will open in the same tab.');
                                          navigate(url);
                                        } else {
                                          console.log('✅ New tab opened successfully');
                                        }
                                      }}
                                      className="text-purple-600 hover:underline text-[9px]"
                                      title="Open pre-visit prep in new tab"
                                    >
                                      Add More
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const url = `/staff-previsit-prep?appointmentId=${apt.id}`;
                                      console.log('🔗 Opening pre-visit prep in new tab:', url);
                                      const newWindow = window.open(url, '_blank');
                                      if (!newWindow) {
                                        console.error('❌ Popup blocked! Falling back to same-tab navigation');
                                        alert('Popup was blocked by browser. Please allow popups for this site, or we will open in the same tab.');
                                        navigate(url);
                                      } else {
                                        console.log('✅ New tab opened successfully');
                                      }
                                    }}
                                    className="text-purple-600 font-semibold hover:underline cursor-pointer"
                                    title="Open pre-visit prep in new tab"
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
  // VERSION CHECK - Jan 16, 2026 - New Tab Pre-Visit Prep (ALL BUTTONS) + LocalStorage Fixes
  console.log('🔄 SchedulePageV2 loaded - Version: NEW-TAB-ALL-BUTTONS-2026-01-16');

  const navigate = useNavigate();
  const { user } = useAuth();

  // Default states
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });

  const [providerGroups, setProviderGroups] = useState<ProviderGroup[]>([]);
  const [allProviders, setAllProviders] = useState<string[]>([]);
  const [providerNameMap, setProviderNameMap] = useState<Record<string, string>>({});
  const [selectedProvider, setSelectedProvider] = useState<string>('all');

  // Track if we've loaded preferences yet to prevent double-loading
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  // Load saved preferences when user is available (runs ONCE)
  useEffect(() => {
    if (user && !preferencesLoaded) {
      const userId = user.email || user.id || 'default';

      // Restore saved date
      try {
        const savedDate = localStorage.getItem(`schedule_${userId}_selectedDate`);
        if (savedDate) {
          // Parse date carefully to avoid timezone issues
          // savedDate format: "2026-01-20"
          const [year, month, day] = savedDate.split('-').map(Number);
          const date = new Date(year, month - 1, day); // month is 0-indexed
          date.setHours(0, 0, 0, 0);
          setSelectedDate(date);
          console.log('📅 Restored saved date for user:', userId, savedDate, '→', date);
        }
      } catch (error) {
        console.error('Error loading saved date:', error);
      }

      // Restore saved provider
      try {
        const savedProvider = localStorage.getItem(`schedule_${userId}_selectedProvider`);
        if (savedProvider) {
          setSelectedProvider(savedProvider);
          console.log('👤 Restored saved provider for user:', userId, savedProvider);
        }
      } catch (error) {
        console.error('Error loading saved provider:', error);
      }

      setPreferencesLoaded(true);
    }
  }, [user, preferencesLoaded]);

  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [weeklyData, setWeeklyData] = useState<Record<string, ProviderGroup[]>>({});

  // REMOVED: Validation effect that was causing filter to reset when changing dates
  // The provider filter should persist even if the provider has no appointments on the selected date
  // This allows users to see an empty schedule for their selected provider

  // Save selections to localStorage whenever they change
  useEffect(() => {
    if (user) {
      const userId = user.email || user.id || 'default';
      try {
        const dateStr = selectedDate.toISOString().split('T')[0];
        localStorage.setItem(`schedule_${userId}_selectedDate`, dateStr);
        console.log('💾 Saved date to localStorage for user:', userId, dateStr);
      } catch (error) {
        console.error('Error saving date:', error);
      }
    }
  }, [selectedDate, user]);

  useEffect(() => {
    if (user && preferencesLoaded) {
      // Only save after initial preferences are loaded to avoid overwriting with defaults
      const userId = user.email || user.id || 'default';
      try {
        localStorage.setItem(`schedule_${userId}_selectedProvider`, selectedProvider);
        console.log('💾 Saved provider to localStorage for user:', userId, selectedProvider);
      } catch (error) {
        console.error('Error saving provider:', error);
      }
    }
  }, [selectedProvider, user, preferencesLoaded]);

  // CRUD Modal States
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any | null>(null);
  const [editAppointmentId, setEditAppointmentId] = useState<number | undefined>();

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

      // QUERY 1: Get ALL providers for this date (for dropdown - NO FILTER)
      // This ensures dropdown always shows all available providers, not just filtered ones
      const { data: allProvidersData } = await supabase
        .from('provider_schedules')
        .select('provider_id, provider_name')
        .eq('scheduled_date', dateStr)
        .neq('status', 'cancelled');

      const nameMap: Record<string, string> = {};
      allProvidersData?.forEach(apt => {
        if (apt.provider_id) {
          nameMap[apt.provider_id] = apt.provider_name || apt.provider_id;
        }
      });
      const uniqueProviders = Object.keys(nameMap);
      setAllProviders(uniqueProviders);
      setProviderNameMap(nameMap);

      console.log('📋 Found', uniqueProviders.length, 'unique providers for date:', dateStr);
      console.log('📋 Unique provider IDs:', uniqueProviders);
      console.log('🎯 Selected provider state:', selectedProvider);
      if (selectedProvider !== 'all') {
        console.log('🔍 Filtering for provider:', selectedProvider);
        console.log('🔍 Does selected provider exist in list?', uniqueProviders.includes(selectedProvider));
      }

      // QUERY 2: Get appointments (WITH FILTER if specific provider selected)
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
        .neq('status', 'cancelled')  // Filter out cancelled appointments
        .order('provider_id')
        .order('start_time');

      // Apply provider filter to appointments query (NOT to allProviders query)
      if (selectedProvider !== 'all') {
        console.log('✅ APPLYING FILTER: provider_id = ', selectedProvider);
        query = query.eq('provider_id', selectedProvider);
      } else {
        console.log('ℹ️  NO FILTER: Showing all providers');
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Error loading schedule:', error);
        setProviderGroups([]);
        return;
      }

      console.log('📊 Query returned:', data?.length || 0, 'appointments (after filtering cancelled)');
      if (data && data.length > 0) {
        console.log('🔍 First appointment data:', {
          appointment: data[0],
          patient: data[0].unified_patients,
          mrn: data[0].unified_patients?.mrn,
          status: data[0].status
        });

        // Check if any have cancelled status (should be 0)
        const cancelledCount = data.filter(apt => apt.status === 'cancelled').length;
        if (cancelledCount > 0) {
          console.warn('⚠️ WARNING: Found', cancelledCount, 'cancelled appointments in results (should be 0!)');
        }
      }

      if (!data || data.length === 0) {
        console.warn('⚠️ No appointments found for date:', dateStr);
        setProviderGroups([]);
        // Don't reset allProviders here - keep dropdown populated
        return;
      }

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

        // ========================================
        // PATIENT IDENTIFIERS - CRITICAL!
        // ========================================
        // ⚠️ DO NOT CONFUSE patient_id with tshla_id!
        //
        // patient.patient_id  = 8-digit (e.g., "99364924") → NEVER show as TSH ID!
        // patient.tshla_id    = Formatted (e.g., "TSH 972-918") → USE for tshId!
        //
        // See: src/types/unified-patient.types.ts
        // See: TSH_ID_FORMAT_FIX.md
        // ========================================

        const appointmentData = {
          id: apt.id.toString(),
          time: apt.start_time,
          patient: apt.patient_name || 'Unknown',
          internalId: patient?.patient_id,      // 8-digit (not displayed)
          tshId: patient?.tshla_id,             // Formatted "TSH XXX-XXX" (purple)
          mrn: apt.patient_mrn || patient?.mrn, // MRN (blue)
          phone: apt.patient_phone || patient?.phone_primary,
          dob: apt.patient_dob || patient?.date_of_birth,
          status: apt.status || 'scheduled',
          notes: apt.chief_diagnosis || apt.visit_reason,
          appointmentType: apt.appointment_type,
          isTelehealth: apt.is_telehealth || false,
          duration: apt.duration_minutes,
          hasPriorDictation: priorCount > 0,
          priorDictationCount: priorCount
        };

        // Debug log for first appointment
        if (Object.keys(acc).length === 0 || Object.values(acc)[0].appointments.length === 0) {
          console.log('🔍 Mapped appointment data:', {
            patientName: apt.patient_name,
            rawPatient: patient,
            mappedMRN: appointmentData.mrn,
            mappedInternalId: appointmentData.internalId,
            mappedTshId: appointmentData.tshId
          });
        }

        acc[providerId].appointments.push(appointmentData);

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

      // QUERY 1: Get ALL providers for the entire week (for dropdown - NO FILTER)
      const allProvidersSet = new Set<string>();
      const weekNameMap: Record<string, string> = {};
      for (let i = 0; i < 5; i++) {
        const currentDate = new Date(weekStart);
        currentDate.setDate(weekStart.getDate() + i);
        const dateStr = currentDate.toISOString().split('T')[0];

        const { data: providersData } = await supabase
          .from('provider_schedules')
          .select('provider_id, provider_name')
          .eq('scheduled_date', dateStr)
          .neq('status', 'cancelled');

        providersData?.forEach(apt => {
          if (apt.provider_id) {
            allProvidersSet.add(apt.provider_id);
            weekNameMap[apt.provider_id] = apt.provider_name || apt.provider_id;
          }
        });
      }

      setAllProviders(Array.from(allProvidersSet));
      setProviderNameMap(weekNameMap);
      console.log('📋 Found', allProvidersSet.size, 'unique providers for the week');

      // QUERY 2: Load appointments for each day (WITH FILTER if specific provider selected)
      const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      const weekData: Record<string, ProviderGroup[]> = {};

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
          .neq('status', 'cancelled')  // Filter out cancelled appointments
          .order('provider_id')
          .order('start_time');

        // Apply provider filter to appointments query (NOT to allProviders query)
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

          // ⚠️ CRITICAL: Use tshla_id (formatted), NOT patient_id (8-digit)!
          // See: src/types/unified-patient.types.ts, TSH_ID_FORMAT_FIX.md

          acc[providerId].appointments.push({
            id: apt.id.toString(),
            time: apt.start_time,
            patient: apt.patient_name || 'Unknown',
            internalId: patient?.patient_id,      // 8-digit (not displayed)
            tshId: patient?.tshla_id,             // Formatted "TSH XXX-XXX" (purple)
            mrn: apt.patient_mrn || patient?.mrn, // MRN (blue)
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
      case 'checked-in':
        return 'bg-orange-100 text-orange-700 border-orange-300';
      default:
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
    }
  };

  const getAppointmentTypeColor = (type: string): string => {
    switch (type?.toLowerCase()) {
      case 'new-patient':
        return 'bg-purple-100 text-purple-700 border border-purple-300';
      case 'follow-up':
        return 'bg-blue-100 text-blue-700 border border-blue-300';
      case 'telehealth':
        return 'bg-green-100 text-green-700 border border-green-300';
      case 'consultation':
        return 'bg-orange-100 text-orange-700 border border-orange-300';
      case 'block-time':
        return 'bg-gray-200 text-gray-600 border border-gray-400';
      default:
        return 'bg-gray-100 text-gray-600 border border-gray-300';
    }
  };

  const getAppointmentTypeLabel = (type: string): string => {
    switch (type?.toLowerCase()) {
      case 'new-patient':
        return 'NEW PATIENT';
      case 'follow-up':
        return 'ESTABLISHED';
      case 'telehealth':
        return 'TELEHEALTH';
      case 'consultation':
        return 'CONSULT';
      case 'block-time':
        return 'BLOCKED';
      default:
        return type?.toUpperCase() || 'OFFICE VISIT';
    }
  };

  // CRUD Handlers
  const handleNewAppointment = () => {
    setEditAppointmentId(undefined);
    setSelectedAppointment(null);
    setShowAppointmentModal(true);
  };

  const handleEditAppointment = (apt: AppointmentData) => {
    setEditAppointmentId(Number(apt.id));
    setSelectedAppointment(apt);
    setShowAppointmentModal(true);
  };

  const handleCancelClick = (apt: AppointmentData) => {
    setSelectedAppointment({
      id: Number(apt.id),
      patient_name: apt.patient,
      provider_name: providerGroups.find(pg =>
        pg.appointments.some(a => a.id === apt.id)
      )?.providerName || 'Unknown',
      scheduled_date: selectedDate.toISOString().split('T')[0],
      start_time: apt.time,
      appointment_type: apt.notes || ''
    });
    setShowCancelDialog(true);
  };

  const handleAppointmentSuccess = () => {
    // Refresh the schedule after create/update/cancel
    if (viewMode === 'daily') {
      loadSchedule();
    } else {
      loadWeeklySchedule();
    }
  };

  // Open patient portal as a patient (staff access via one-time token)
  const handleOpenPatientPortal = async (tshId: string) => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const res = await fetch(`${API_BASE_URL}/api/patient-portal/staff-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tshlaId: tshId }),
      });
      const data = await res.json();
      if (data.success && data.token) {
        window.open(`/patient-portal-unified?staffToken=${data.token}`, '_blank');
      }
    } catch {
      // Silent fail — staff can still use normal login
    }
  };

  const totalAppointments = providerGroups.reduce((sum, p) => sum + p.appointments.length, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-blue-100 hover:text-white text-sm"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-xl font-bold">Provider Schedule</h1>
          </div>
        </div>
      </div>

      {/* Date Navigation Bar */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Left: View Toggle & Date Controls */}
            <div className="flex items-center gap-2">
              {/* View Mode Toggle */}
              <div className="inline-flex rounded border border-gray-300 bg-gray-50">
                <button
                  onClick={() => setViewMode('daily')}
                  className={`px-3 py-1 text-xs font-semibold transition-all ${
                    viewMode === 'daily'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  📅 Daily
                </button>
                <button
                  onClick={() => setViewMode('weekly')}
                  className={`px-3 py-1 text-xs font-semibold transition-all ${
                    viewMode === 'weekly'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  📆 Weekly
                </button>
              </div>

              {/* Date Controls */}
              <button
                onClick={() => changeDate(viewMode === 'weekly' ? -7 : -1)}
                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs font-medium"
              >
                ←
              </button>
              <input
                type="date"
                value={selectedDate.toISOString().split('T')[0]}
                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                className="px-2 py-1 border border-gray-300 rounded text-xs font-medium focus:border-blue-500"
              />
              <button
                onClick={() => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  setSelectedDate(today);
                }}
                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium"
              >
                Today
              </button>
              <button
                onClick={() => changeDate(viewMode === 'weekly' ? 7 : 1)}
                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs font-medium"
              >
                →
              </button>
            </div>

            {/* Center: Date & Stats */}
            <div className="text-center">
              <h2 className="text-sm font-bold text-gray-900">
                {viewMode === 'weekly' ? getWeekRange(selectedDate) : formatDate(selectedDate)}
              </h2>
              {viewMode === 'daily' && (
                <p className="text-xs text-gray-600">
                  {totalAppointments} appts • {providerGroups.length} providers
                </p>
              )}
            </div>

            {/* Right: Provider Filter & New Appointment */}
            <div className="flex items-center gap-2">
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-xs font-medium focus:border-blue-500"
              >
                <option value="all">All Providers ({allProviders.length})</option>
                {allProviders.map((providerId) => (
                  <option key={providerId} value={providerId}>
                    {formatProviderName(providerNameMap[providerId] || providerId)}
                  </option>
                ))}
              </select>
              <button
                onClick={handleNewAppointment}
                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-semibold"
              >
                ➕ New
              </button>
              <button
                onClick={() => setSelectedDate(new Date('2025-01-07'))}
                className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs"
                title="View sample data"
              >
                📊
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Content */}
      <div className="max-w-7xl mx-auto px-4 py-3">
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
          <div className="space-y-3">
            {providerGroups.map((provider) => (
              <div key={provider.providerId} className="bg-white rounded-lg shadow-lg overflow-hidden">
                {/* Provider Header */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold">{formatProviderName(provider.providerName)}</h3>
                      <p className="text-blue-100 text-xs">ID: {provider.providerId}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold">{provider.appointments.length}</div>
                      <div className="text-blue-100 text-xs">appts</div>
                    </div>
                  </div>
                </div>

                {/* Appointments Grid */}
                <div className="p-3 bg-gray-50">
                  <div className="grid gap-2">
                    {provider.appointments.map((apt, index) => {
                      // DEBUG: Log first appointment data at render time
                      if (index === 0) {
                        console.log('🎨 RENDERING first appointment:', {
                          patient: apt.patient,
                          mrn: apt.mrn,
                          internalId: apt.internalId,
                          tshId: apt.tshId,
                          fullApt: apt
                        });
                      }
                      return (
                      <div
                        key={apt.id}
                        className="bg-white rounded border border-gray-200 p-2 hover:border-blue-400 hover:shadow transition-all"
                      >
                        <div className="flex items-start justify-between gap-2">
                          {/* Left: Time & Patient Info */}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="text-base font-bold text-blue-600">{apt.time}</div>
                              {/* Duration indicator (if not 30 min) */}
                              {apt.duration && apt.duration !== 30 && (
                                <span className="text-xs text-gray-500 font-medium">
                                  ({apt.duration}m)
                                </span>
                              )}
                              {/* Only show status if NOT scheduled */}
                              {apt.status !== 'scheduled' && (
                                <span
                                  className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${getStatusColor(apt.status)}`}
                                >
                                  {apt.status.toUpperCase()}
                                </span>
                              )}
                            </div>

                            <div className="mb-1">
                              <div className="flex items-center gap-1 flex-wrap">
                                <p className="text-sm font-bold text-gray-900">{apt.patient}</p>

                                {/* Appointment Type Badge */}
                                {apt.appointmentType && (
                                  <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${getAppointmentTypeColor(apt.appointmentType)}`}>
                                    {getAppointmentTypeLabel(apt.appointmentType)}
                                  </span>
                                )}

                                {/* Telehealth Indicator */}
                                {apt.isTelehealth && (
                                  <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded border border-green-300">
                                    💻 VIRTUAL
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Patient IDs - COMPACT */}
                            {(apt.internalId || apt.tshId || apt.mrn || apt.phone) && (
                              <div className="flex flex-wrap items-center gap-1 mb-2">
                                {apt.mrn && (
                                  <span className="px-1.5 py-0.5 bg-green-50 border border-green-400 text-green-700 text-[10px] font-mono font-bold rounded">
                                    MRN: {apt.mrn}
                                  </span>
                                )}
                                {apt.internalId && (
                                  <span className="px-1.5 py-0.5 bg-blue-50 border border-blue-300 text-blue-700 text-[10px] font-mono font-bold rounded">
                                    ID: {apt.internalId}
                                  </span>
                                )}
                                {apt.tshId && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenPatientPortal(apt.tshId!);
                                    }}
                                    title="Open Patient Portal as this patient"
                                    className="px-1.5 py-0.5 bg-purple-50 border border-purple-300 text-purple-700 text-[10px] font-mono font-bold rounded hover:bg-purple-200 hover:border-purple-500 cursor-pointer transition-colors"
                                  >
                                    {apt.tshId} ↗
                                  </button>
                                )}
                                {apt.phone && (
                                  <span className="px-1.5 py-0.5 bg-orange-50 border border-orange-400 text-orange-700 text-[10px] font-mono font-bold rounded" title="Patient phone (for portal login)">
                                    📞 {apt.phone}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Workflow Status Grid */}
                            <div className="grid grid-cols-4 gap-1 mb-2">
                              {/* Pre-Visit */}
                              <div>
                                {apt.preVisitComplete ? (
                                  <span className="px-1 py-0.5 bg-green-50 border border-green-300 text-green-700 text-[9px] font-bold rounded inline-block w-full text-center">
                                    ✅ Pre
                                  </span>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const url = `/staff-previsit-prep?appointmentId=${apt.id}`;
                                      console.log('🔗 [Compact Button] Opening pre-visit prep in new tab:', url);
                                      const newWindow = window.open(url, '_blank');
                                      if (!newWindow) {
                                        console.error('❌ [Compact Button] Popup blocked! Falling back to same-tab navigation');
                                        alert('Popup was blocked by browser. Please allow popups for this site, or we will open in the same tab.');
                                        navigate(url);
                                      } else {
                                        console.log('✅ [Compact Button] New tab opened successfully');
                                      }
                                    }}
                                    className="px-1 py-0.5 bg-purple-50 border border-purple-300 text-purple-700 text-[9px] font-bold rounded w-full hover:bg-purple-100"
                                    title="Open pre-visit prep in new tab"
                                  >
                                    📋 Pre
                                  </button>
                                )}
                              </div>

                              {/* Dictation */}
                              <div>
                                {apt.dictationComplete ? (
                                  <button
                                    onClick={() => navigate(`/quick-note?dictationId=${apt.dictationId}`)}
                                    className="px-1 py-0.5 bg-green-50 border border-green-300 text-green-700 text-[9px] font-bold rounded w-full hover:bg-green-100"
                                  >
                                    ✅ Dict
                                  </button>
                                ) : (
                                  <span className="px-1 py-0.5 bg-orange-50 border border-orange-300 text-orange-700 text-[9px] font-bold rounded inline-block w-full text-center">
                                    ⏳ Dict
                                  </span>
                                )}
                              </div>

                              {/* Post-Visit */}
                              <div>
                                {apt.postVisitComplete ? (
                                  <span className="px-1 py-0.5 bg-green-50 border border-green-300 text-green-700 text-[9px] font-bold rounded inline-block w-full text-center">
                                    ✅ Post
                                  </span>
                                ) : (
                                  <span className="px-1 py-0.5 bg-orange-50 border border-orange-300 text-orange-700 text-[9px] font-bold rounded inline-block w-full text-center">
                                    ⏳ Post
                                  </span>
                                )}
                              </div>

                              {/* Summary Sent */}
                              <div>
                                {apt.summarySent ? (
                                  <span className="px-1 py-0.5 bg-green-50 border border-green-300 text-green-700 text-[9px] font-bold rounded inline-block w-full text-center">
                                    ✅ Sent
                                  </span>
                                ) : (
                                  <span className="px-1 py-0.5 bg-gray-50 border border-gray-300 text-gray-600 text-[9px] font-bold rounded inline-block w-full text-center">
                                    📧 Pend
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Additional Info - DOB & Notes */}
                            {apt.dob && (
                              <div className="text-[10px] text-gray-600 mb-1">
                                DOB: {formatDOB(apt.dob)}
                              </div>
                            )}

                            {apt.notes && (
                              <div className="mt-1 text-[10px] text-gray-700 bg-gray-50 px-2 py-1 rounded border border-gray-200">
                                {apt.notes}
                              </div>
                            )}
                          </div>

                          {/* Right: Action Buttons */}
                          <div className="flex flex-col gap-1">
                            {!apt.dictationComplete ? (
                              <button
                                onClick={() => navigate(`/quick-note?appointmentId=${apt.id}`)}
                                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-semibold rounded whitespace-nowrap"
                              >
                                🎤 Dictate
                              </button>
                            ) : (
                              <button
                                onClick={() => navigate(`/quick-note?dictationId=${apt.dictationId}`)}
                                className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-[10px] font-semibold rounded whitespace-nowrap"
                              >
                                📝 View
                              </button>
                            )}
                            <button
                              onClick={() => navigate(`/patient-chart`)}
                              className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-semibold rounded whitespace-nowrap"
                            >
                              📋 Chart
                            </button>

                            {/* CRUD Actions */}
                            <div className="border-t border-gray-300 pt-1 mt-1 space-y-1">
                              <button
                                onClick={() => handleEditAppointment(apt)}
                                className="w-full px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[9px] font-semibold rounded border border-blue-300"
                              >
                                ✏️ Edit
                              </button>
                              <button
                                onClick={() => handleCancelClick(apt)}
                                className="w-full px-2 py-1 bg-orange-50 hover:bg-orange-100 text-orange-700 text-[9px] font-semibold rounded border border-orange-300"
                              >
                                ❌ Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CRUD Modals */}
      <AppointmentFormModal
        isOpen={showAppointmentModal}
        onClose={() => {
          setShowAppointmentModal(false);
          setEditAppointmentId(undefined);
          setSelectedAppointment(null);
        }}
        onSuccess={handleAppointmentSuccess}
        appointmentId={editAppointmentId}
      />

      <AppointmentCancelDialog
        isOpen={showCancelDialog}
        onClose={() => {
          setShowCancelDialog(false);
          setSelectedAppointment(null);
        }}
        onSuccess={handleAppointmentSuccess}
        appointment={selectedAppointment}
      />
    </div>
  );
}
