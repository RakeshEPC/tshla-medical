/**
 * useSchedule Hook
 * React hook for managing schedule data with database integration
 * Created: September 16, 2025
 */

import { useState, useEffect, useCallback } from 'react';
import { scheduleDatabaseService } from '../services/scheduleDatabase.service';
import {
  unifiedAppointmentService,
  type UnifiedAppointment,
} from '../services/unifiedAppointment.service';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

interface UseScheduleProps {
  selectedProviders: string[];
  date: Date;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseScheduleReturn {
  appointments: UnifiedAppointment[];
  isLoading: boolean;
  error: string | null;
  refreshSchedule: () => Promise<void>;
  createAppointment: (appointment: Partial<UnifiedAppointment>) => Promise<boolean>;
  updateAppointment: (id: string, updates: Partial<UnifiedAppointment>) => Promise<boolean>;
  deleteAppointment: (id: string) => Promise<boolean>;
  updateAppointmentStatus: (id: string, status: UnifiedAppointment['status']) => Promise<boolean>;
}

export function useSchedule({
  selectedProviders,
  date,
  autoRefresh = true,
  refreshInterval = 30000, // 30 seconds
}: UseScheduleProps): UseScheduleReturn {
  const [appointments, setAppointments] = useState<UnifiedAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateString = date.toISOString().split('T')[0];

  // Fetch schedule data
  const refreshSchedule = useCallback(async () => {
    console.log('🔍 [useSchedule] refreshSchedule called', {
      selectedProviders,
      dateString,
      hasProviders: selectedProviders && selectedProviders.length > 0
    });

    if (!selectedProviders || selectedProviders.length === 0) {
      console.warn('⚠️ [useSchedule] No providers selected, returning empty');
      setAppointments([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // First, try to load imported schedules from provider_schedules table (Athena data)
      const { supabase } = await import('../lib/supabase');

      let query = supabase
        .from('provider_schedules')
        .select('*')
        .eq('scheduled_date', dateString);

      // Apply provider filtering if not "ALL"
      if (!selectedProviders.includes('ALL')) {
        console.log('🔍 [useSchedule] Filtering by specific providers:', selectedProviders);
        query = query.in('provider_id', selectedProviders);
      } else {
        console.log('✅ [useSchedule] Querying ALL providers');
      }

      console.log('🔍 [useSchedule] Executing Supabase query for date:', dateString);
      const { data: importedSchedules, error: supabaseError } = await query
        .order('provider_name', { ascending: true })
        .order('start_time', { ascending: true });

      console.log('📊 [useSchedule] Query result:', {
        error: supabaseError,
        count: importedSchedules?.length || 0,
        hasData: importedSchedules && importedSchedules.length > 0
      });

      if (supabaseError) {
        console.error('❌ [useSchedule] Supabase error:', supabaseError);
      }

      if (!supabaseError && importedSchedules && importedSchedules.length > 0) {
        console.log('✅ [useSchedule] Found appointments:', importedSchedules.length);
        // Convert imported schedules to UnifiedAppointment format
        const unifiedAppointments: UnifiedAppointment[] = importedSchedules.map((apt: any) => ({
          id: apt.id.toString(),
          patientId: apt.patient_mrn || apt.id.toString(),
          patientName: apt.patient_name,
          patientPhone: apt.patient_phone || '',
          patientEmail: apt.patient_email || '',
          doctorId: apt.provider_id || 'unknown',
          doctorName: apt.provider_name || 'Dr. Unknown',
          time: apt.start_time,
          date: dateString,
          duration: apt.duration_minutes || 30,
          visitType: (apt.appointment_type || 'follow-up') as any,
          visitReason: apt.chief_diagnosis || apt.visit_reason || '',
          status: (apt.status || 'scheduled') as any,
          notes: apt.notes || apt.chief_diagnosis || '',
          createdAt: new Date(apt.created_at || Date.now()),
          updatedAt: new Date(apt.updated_at || Date.now()),
        }));

        setAppointments(unifiedAppointments);
        return;
      }

      // If no imported schedules found, set empty appointments
      console.warn('⚠️ [useSchedule] No appointments found for date:', dateString);
      setAppointments([]);

      /* Fallback logic disabled - only using provider_schedules table
      const dbAppointments = await scheduleDatabaseService.getScheduleForDate(
        selectedProviders[0] || 'unknown',
        dateString
      );

      if (dbAppointments.length > 0) {
        // Convert database format to UnifiedAppointment format
        const unifiedAppointments: UnifiedAppointment[] = dbAppointments.map(dbAppt => ({
          id: dbAppt.id,
          patientId: dbAppt.id,
          patientName: dbAppt.name,
          patientPhone: dbAppt.phone,
          patientEmail: '', // Not available in current format
          doctorId: 'unknown',
          doctorName: 'Dr. Unknown',
          time: dbAppt.appointmentTime,
          date: dateString,
          duration: 30,
          visitType: 'follow-up' as const,
          visitReason: '',
          status: dbAppt.status,
          notes: '',
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

        setAppointments(unifiedAppointments);
      } else {
        // Final fallback to unified appointment service (localStorage)
        const localAppointments = unifiedAppointmentService.getAppointmentsForDate(
          dateString,
          selectedProviders[0] || 'unknown'
        );
        setAppointments(localAppointments);
      }
      */
    } catch (err) {
      logError('App', 'Error message', {});
      setError(err instanceof Error ? err.message : 'Failed to load schedule');
      setAppointments([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedProviders, dateString]);

  // Create new appointment
  const createAppointment = useCallback(
    async (appointmentData: Partial<UnifiedAppointment>): Promise<boolean> => {
      // Use the doctor ID from appointmentData, or first selected provider, or 'unknown'
      const doctorId = appointmentData.doctorId ||
        (selectedProviders.includes('ALL') ? 'unknown' : selectedProviders[0] || 'unknown');

      if (!doctorId) return false;

      setIsLoading(true);
      try {
        // Create appointment in unified service first (immediate UI update)
        const newAppointment = await unifiedAppointmentService.createAppointment({
          providerId: doctorId,
          patientName: appointmentData.patientName || 'New Patient',
          patientPhone: appointmentData.patientPhone,
          patientEmail: appointmentData.patientEmail,
          time: appointmentData.time || '9:00 AM',
          date: dateString,
          visitType: appointmentData.visitType || 'follow-up',
          visitReason: appointmentData.visitReason || '',
          status: appointmentData.status || 'scheduled',
          notes: appointmentData.notes || '',
        });

        // Try to save to database
        try {
          const dbPatient = {
            id: newAppointment.id,
            name: newAppointment.patientName,
            mrn: newAppointment.patientId,
            appointmentTime: newAppointment.time,
            status: newAppointment.status,
            phone: newAppointment.patientPhone,
            isPlaceholder: false,
          };

          await scheduleDatabaseService.saveAppointment(
            doctorId,
            'Doctor', // TODO: Get actual provider name
            dbPatient,
            dateString
          );
        } catch (dbError) {
          logWarn('App', 'Warning message', {});
        }

        // No need to manually refresh - data will update automatically
        return true;
      } catch (err) {
        logError('App', 'Error message', {});
        setError(err instanceof Error ? err.message : 'Failed to create appointment');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [selectedProviders, dateString]
  );

  // Update existing appointment
  const updateAppointment = useCallback(
    async (id: string, updates: Partial<UnifiedAppointment>): Promise<boolean> => {
      setIsLoading(true);
      try {
        // Update in unified service
        await unifiedAppointmentService.updateAppointment(id, updates);

        // Try to update in database
        try {
          // Find the appointment to get current data
          const currentAppointment = appointments.find(apt => apt.id === id);
          if (currentAppointment) {
            const updatedPatient = {
              id: currentAppointment.patientId,
              name: updates.patientName || currentAppointment.patientName,
              mrn: currentAppointment.patientId,
              appointmentTime: updates.time || currentAppointment.time,
              status: updates.status || currentAppointment.status,
              phone: updates.patientPhone || currentAppointment.patientPhone,
              isPlaceholder: false,
            };

            await scheduleDatabaseService.updateAppointment(id, updatedPatient);
          }
        } catch (dbError) {
          logWarn('App', 'Warning message', {});
        }

        // Refresh the schedule
        // No manual refresh needed
        return true;
      } catch (err) {
        logError('App', 'Error message', {});
        setError(err instanceof Error ? err.message : 'Failed to update appointment');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [appointments]
  );

  // Delete appointment
  const deleteAppointment = useCallback(async (id: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      // Delete from unified service
      await unifiedAppointmentService.deleteAppointment(id);

      // Try to delete from database
      try {
        await scheduleDatabaseService.deleteAppointment(id);
      } catch (dbError) {
        logWarn('App', 'Warning message', {});
      }

      // Refresh the schedule
      // No manual refresh needed
      return true;
    } catch (err) {
      logError('App', 'Error message', {});
      setError(err instanceof Error ? err.message : 'Failed to delete appointment');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Quick status update
  const updateAppointmentStatus = useCallback(
    async (id: string, status: UnifiedAppointment['status']): Promise<boolean> => {
      return updateAppointment(id, { status });
    },
    [updateAppointment]
  );

  // Initial load
  useEffect(() => {
    refreshSchedule();
  }, [selectedProviders, dateString]); // Use the actual dependencies instead of refreshSchedule

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refreshSchedule();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, selectedProviders, dateString]); // Remove refreshSchedule dependency

  return {
    appointments,
    isLoading,
    error,
    refreshSchedule,
    createAppointment,
    updateAppointment,
    deleteAppointment,
    updateAppointmentStatus,
  };
}
