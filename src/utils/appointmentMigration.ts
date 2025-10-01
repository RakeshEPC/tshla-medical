/**
 * Appointment Migration Utility
 * Consolidates appointments from different storage systems
 */

import { scheduleStorage } from '../lib/schedule-storage';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

interface SimpleAppointment {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone?: string;
  patientEmail?: string;
  chartId?: string;
  doctorId: string;
  doctorName: string;
  date: string;
  time: string;
  duration: number;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show';
  visitType: string;
  visitReason: string;
  notes?: string;
  createdAt: Date;
}

interface ScheduleSlot {
  id: string;
  time: string;
  initials: string;
  name?: string;
  status: 'scheduled' | 'completed' | 'in-progress';
  notes?: string;
}

export class AppointmentMigration {
  /**
   * Get all appointments from different storage systems
   */
  static getAllStoredAppointments() {
    const results = {
      simpleAppointments: [],
      scheduleSlots: {},
      sessionData: {},
    };

    try {
      // 1. Check SimpleAppointmentService storage
      const simpleAppts = localStorage.getItem('tshla_simple_appointments');
      if (simpleAppts) {
        results.simpleAppointments = JSON.parse(simpleAppts);
      }

      // 2. Check ScheduleStorage
      results.scheduleSlots = scheduleStorage.getAllSchedules();

      // 3. Check session storage for recent data
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('schedule_')) {
          const data = sessionStorage.getItem(key);
          if (data) {
            results.sessionData[key] = JSON.parse(data);
          }
        }
      });

      // 4. Check for current patient session
      const currentPatient = sessionStorage.getItem('current_patient');
      if (currentPatient) {
        results.sessionData['current_patient'] = JSON.parse(currentPatient);
      }
    } catch (error) {
      logError('App', 'Error message', {});
    }

    return results;
  }

  /**
   * Convert SimpleAppointments to ScheduleSlots format
   */
  static convertSimpleAppointmentsToSlots(appointments: SimpleAppointment[]): {
    [date: string]: ScheduleSlot[];
  } {
    const slotsByDate: { [date: string]: ScheduleSlot[] } = {};

    appointments.forEach(appt => {
      if (!slotsByDate[appt.date]) {
        slotsByDate[appt.date] = [];
      }

      const slot: ScheduleSlot = {
        id: appt.id,
        time: appt.time,
        initials: appt.patientName
          .split(' ')
          .map(n => n[0])
          .join('')
          .toUpperCase(),
        name: appt.patientName,
        status:
          appt.status === 'scheduled'
            ? 'scheduled'
            : appt.status === 'completed'
              ? 'completed'
              : 'scheduled',
        notes: appt.notes || `${appt.visitType}: ${appt.visitReason}`,
      };

      slotsByDate[appt.date].push(slot);
    });

    return slotsByDate;
  }

  /**
   * Migrate all appointments to unified storage
   */
  static migrateToUnifiedStorage() {
    logDebug('App', 'Debug message', {});

    const allData = this.getAllStoredAppointments();
    let migrationCount = 0;

    // Convert SimpleAppointments to slots format
    if (allData.simpleAppointments.length > 0) {
      logDebug('App', 'Debug message', {});
      const convertedSlots = this.convertSimpleAppointmentsToSlots(allData.simpleAppointments);

      Object.keys(convertedSlots).forEach(date => {
        const existingSlots = scheduleStorage.loadSchedule(date);
        const mergedSlots = [...existingSlots, ...convertedSlots[date]];

        // Remove duplicates based on patient name and time
        const uniqueSlots = mergedSlots.filter(
          (slot, index, arr) =>
            arr.findIndex(s => s.name === slot.name && s.time === slot.time) === index
        );

        scheduleStorage.saveSchedule(date, uniqueSlots);
        migrationCount += convertedSlots[date].length;
      });
    }

    // Merge session data
    Object.keys(allData.sessionData).forEach(key => {
      if (key.startsWith('schedule_')) {
        const date = key.replace('schedule_', '');
        const existingSlots = scheduleStorage.loadSchedule(date);
        const sessionSlots = allData.sessionData[key];

        if (Array.isArray(sessionSlots)) {
          const mergedSlots = [...existingSlots, ...sessionSlots];
          const uniqueSlots = mergedSlots.filter(
            (slot, index, arr) =>
              arr.findIndex(s => s.name === slot.name && s.time === slot.time) === index
          );

          scheduleStorage.saveSchedule(date, uniqueSlots);
        }
      }
    });

    logInfo('App', 'Info message', {});
    return migrationCount;
  }

  /**
   * Debug function to show all stored data
   */
  static debugShowAllData() {
    const allData = this.getAllStoredAppointments();
    logDebug('App', 'Debug message', {});

    logDebug('App', 'Debug message', {});
    logDebug('App', 'Debug message', {});
    logDebug('App', 'Debug message', {});
    logDebug('App', 'Debug message', {});

    return allData;
  }

  /**
   * Create a backup of all appointment data
   */
  static createBackup() {
    const allData = this.getAllStoredAppointments();
    const backup = {
      timestamp: new Date().toISOString(),
      data: allData,
    };

    const backupString = JSON.stringify(backup, null, 2);
    localStorage.setItem('appointment_backup_' + Date.now(), backupString);

    logDebug('App', 'Debug message', {});
    return backupString;
  }
}

// Auto-run migration when this module is imported
export function runAppointmentMigration() {
  try {
    logDebug('App', 'Debug message', {});

    // Create backup first
    AppointmentMigration.createBackup();

    // Show current data
    AppointmentMigration.debugShowAllData();

    // Run migration
    const migratedCount = AppointmentMigration.migrateToUnifiedStorage();

    if (migratedCount > 0) {
      logDebug('App', 'Debug message', {});
      logDebug('App', 'Debug message', {});
    } else {
      logDebug('App', 'Debug message', {});
    }

    return true;
  } catch (error) {
    logError('App', 'Error message', {});
    return false;
  }
}
