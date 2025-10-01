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
  providerId: string;
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
  providerId,
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
    if (!providerId) return;

    setIsLoading(true);
    setError(null);

    try {
      // Try to load from database first
      const dbAppointments = await scheduleDatabaseService.getScheduleForDate(
        providerId,
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
          time: dbAppt.appointmentTime,
          date: dateString,
          visitType: 'follow-up' as const,
          visitReason: '',
          status: dbAppt.status,
          notes: '',
          providerId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));

        setAppointments(unifiedAppointments);
      } else {
        // Fallback to unified appointment service (localStorage)
        const localAppointments = unifiedAppointmentService.getAppointmentsForDate(
          dateString,
          providerId
        );
        setAppointments(localAppointments);
      }
    } catch (err) {
      logError('App', 'Error message', {});
      setError(err instanceof Error ? err.message : 'Failed to load schedule');

      // Fallback to local data
      try {
        const localAppointments = unifiedAppointmentService.getAppointmentsForDate(
          dateString,
          providerId
        );
        setAppointments(localAppointments);
      } catch (localErr) {
        logError('App', 'Error message', {});
      }
    } finally {
      setIsLoading(false);
    }
  }, [providerId, dateString]);

  // Create new appointment
  const createAppointment = useCallback(
    async (appointmentData: Partial<UnifiedAppointment>): Promise<boolean> => {
      if (!providerId) return false;

      setIsLoading(true);
      try {
        // Create appointment in unified service first (immediate UI update)
        const newAppointment = await unifiedAppointmentService.createAppointment({
          providerId,
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
            providerId,
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
    [providerId, dateString]
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
  }, [providerId, dateString]); // Use the actual dependencies instead of refreshSchedule

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refreshSchedule();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, providerId, dateString]); // Remove refreshSchedule dependency

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
