import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';
/**
 * Schedule Storage Service
 * Provides persistent storage for doctor schedules
 */

interface ScheduleData {
  [date: string]: any[];
}

class ScheduleStorage {
  private storageKey = 'doctor_schedule_data';
  private backupKey = 'doctor_schedule_backup';

  /**
   * Save schedule data for a specific date
   */
  saveSchedule(date: string, slots: any[]): void {
    try {
      // Get all schedule data
      const allSchedules = this.getAllSchedules();

      // Update the specific date
      allSchedules[date] = slots;

      // Save to localStorage
      localStorage.setItem(this.storageKey, JSON.stringify(allSchedules));

      // Create backup
      localStorage.setItem(
        this.backupKey,
        JSON.stringify({
          data: allSchedules,
          lastSaved: new Date().toISOString(),
        })
      );

      // Also save to sessionStorage for immediate access
      sessionStorage.setItem(`schedule_${date}`, JSON.stringify(slots));
    } catch (error) {
      logError('App', 'Error message', {});
    }
  }

  /**
   * Load schedule data for a specific date
   */
  loadSchedule(date: string): any[] {
    try {
      // First check sessionStorage for recent data
      const sessionData = sessionStorage.getItem(`schedule_${date}`);
      if (sessionData) {
        return JSON.parse(sessionData);
      }

      // Then check main storage
      const allSchedules = this.getAllSchedules();
      return allSchedules[date] || [];
    } catch (error) {
      logError('App', 'Error message', {});

      // Try to restore from backup
      return this.restoreFromBackup(date);
    }
  }

  /**
   * Get all schedules
   */
  getAllSchedules(): ScheduleData {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      logError('App', 'Error message', {});
      return {};
    }
  }

  /**
   * Restore from backup
   */
  private restoreFromBackup(date: string): any[] {
    try {
      const backup = localStorage.getItem(this.backupKey);
      if (backup) {
        const { data } = JSON.parse(backup);
        return data[date] || [];
      }
    } catch (error) {
      logError('App', 'Error message', {});
    }
    return [];
  }

  /**
   * Export all schedule data as JSON
   */
  exportSchedules(): string {
    const schedules = this.getAllSchedules();
    return JSON.stringify(
      {
        version: '1.0',
        exportDate: new Date().toISOString(),
        schedules: schedules,
      },
      null,
      2
    );
  }

  /**
   * Import schedule data from JSON
   */
  importSchedules(jsonData: string): boolean {
    try {
      const imported = JSON.parse(jsonData);

      if (imported.schedules) {
        // Merge with existing data
        const existing = this.getAllSchedules();
        const merged = { ...existing, ...imported.schedules };

        localStorage.setItem(this.storageKey, JSON.stringify(merged));
        return true;
      }
    } catch (error) {
      logError('App', 'Error message', {});
    }
    return false;
  }

  /**
   * Clear all schedule data
   */
  clearAll(): void {
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.backupKey);

    // Clear sessionStorage
    const keys = Object.keys(sessionStorage);
    keys.forEach(key => {
      if (key.startsWith('schedule_')) {
        sessionStorage.removeItem(key);
      }
    });
  }

  /**
   * Initialize demo data
   */
  initializeDemoData(): void {
    const today = new Date();
    const dates = [];

    // Create sample data for past 7 days and next 7 days
    for (let i = -7; i <= 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      if (i < 0) {
        // Past appointments (completed)
        this.saveSchedule(dateStr, [
          {
            id: `demo_${dateStr}_1`,
            time: '09:00',
            initials: 'JD',
            name: 'John Doe',
            status: 'completed',
            notes: 'Routine checkup',
          },
          {
            id: `demo_${dateStr}_2`,
            time: '14:00',
            initials: 'JS',
            name: 'Jane Smith',
            status: 'completed',
            notes: 'Follow-up',
          },
        ]);
      } else if (i === 0) {
        // Today - some scheduled
        this.saveSchedule(dateStr, [
          {
            id: `demo_${dateStr}_1`,
            time: '10:00',
            initials: 'AB',
            name: 'Alice Brown',
            status: 'scheduled',
            notes: '',
          },
        ]);
      } else if (i <= 3) {
        // Next few days - some scheduled
        this.saveSchedule(dateStr, [
          {
            id: `demo_${dateStr}_1`,
            time: '11:00',
            initials: 'CD',
            name: 'Charlie Davis',
            status: 'scheduled',
            notes: '',
          },
        ]);
      }
    }
  }
}

// Export singleton instance
export const scheduleStorage = new ScheduleStorage();
