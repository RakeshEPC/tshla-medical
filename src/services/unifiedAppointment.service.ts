import { logError, logWarn, logInfo, logDebug } from './logger.service';
/**
 * UNIFIED APPOINTMENT SERVICE
 * =========================
 *
 * This is the ONLY service that should be used for appointment management.
 * All other appointment services are deprecated and should not be used.
 *
 * Storage Strategy:
 * 1. Primary: localStorage with backup
 * 2. Fallback: sessionStorage
 * 3. Future: Database sync when available
 *
 * CRITICAL: Do NOT create any other appointment storage services!
 */

export interface UnifiedAppointment {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone?: string;
  patientEmail?: string;
  doctorId: string;
  doctorName: string;
  date: string; // YYYY-MM-DD format
  time: string; // "9:00 AM" format
  duration: number; // minutes
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show' | 'in-progress';
  visitType: 'new-patient' | 'follow-up' | 'urgent' | 'procedure' | 'lab-review' | 'telemedicine';
  visitReason: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

class UnifiedAppointmentService {
  // SINGLE SOURCE OF TRUTH - Do not change this key!
  private readonly STORAGE_KEY = 'tshla_unified_appointments';
  private readonly BACKUP_KEY = 'tshla_unified_appointments_backup';
  private readonly SYNC_STATUS_KEY = 'tshla_appointment_sync_status';

  private appointments: Map<string, UnifiedAppointment> = new Map();
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the service and load appointments
   * This runs automatic migration from old systems
   */
  private initialize(): void {
    if (this.isInitialized) return;

    logDebug('unifiedAppointment', 'Debug message', {});

    try {
      // Load existing unified appointments
      this.loadFromStorage();

      // Run one-time migration from legacy systems
      this.runLegacyMigration();

      // Set up auto-save
      this.setupAutoSave();

      this.isInitialized = true;
      logInfo('unifiedAppointment', 'Info message', {});
      logDebug('unifiedAppointment', 'Debug message', {});
    } catch (error) {
      logError('unifiedAppointment', 'Error message', {});
      // Continue with empty state
      this.isInitialized = true;
    }
  }

  /**
   * Load appointments from primary storage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const appointments: UnifiedAppointment[] = JSON.parse(stored);
        this.appointments.clear();

        appointments.forEach(apt => {
          // Ensure dates are properly parsed
          apt.createdAt = new Date(apt.createdAt);
          apt.updatedAt = new Date(apt.updatedAt);
          this.appointments.set(apt.id, apt);
        });
      }
    } catch (error) {
      logWarn('unifiedAppointment', 'Warning message', {});
      this.loadFromBackup();
    }
  }

  /**
   * Load from backup storage
   */
  private loadFromBackup(): void {
    try {
      const backup = localStorage.getItem(this.BACKUP_KEY);
      if (backup) {
        const backupData = JSON.parse(backup);
        if (backupData.appointments && Array.isArray(backupData.appointments)) {
          this.appointments.clear();
          backupData.appointments.forEach((apt: UnifiedAppointment) => {
            apt.createdAt = new Date(apt.createdAt);
            apt.updatedAt = new Date(apt.updatedAt);
            this.appointments.set(apt.id, apt);
          });
          logDebug('unifiedAppointment', 'Debug message', {});
        }
      }
    } catch (error) {
      logWarn('unifiedAppointment', 'Warning message', {});
    }
  }

  /**
   * ONE-TIME MIGRATION: Consolidate all legacy appointment systems
   */
  private runLegacyMigration(): void {
    let migrationCount = 0;

    try {
      // Migration from SimpleAppointmentService
      const simpleAppointments = localStorage.getItem('tshla_simple_appointments');
      if (simpleAppointments) {
        const appointments = JSON.parse(simpleAppointments);
        if (Array.isArray(appointments)) {
          appointments.forEach(apt => {
            const unified = this.convertSimpleAppointment(apt);
            if (!this.appointments.has(unified.id)) {
              this.appointments.set(unified.id, unified);
              migrationCount++;
            }
          });
        }
      }

      // Migration from ScheduleStorage
      const scheduleData = localStorage.getItem('doctor_schedule_data');
      if (scheduleData) {
        const schedules = JSON.parse(scheduleData);
        Object.keys(schedules).forEach(date => {
          if (Array.isArray(schedules[date])) {
            schedules[date].forEach((slot: any) => {
              const unified = this.convertScheduleSlot(slot, date);
              if (!this.appointments.has(unified.id)) {
                this.appointments.set(unified.id, unified);
                migrationCount++;
              }
            });
          }
        });
      }

      // Migration from session storage
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('schedule_')) {
          try {
            const date = key.replace('schedule_', '');
            const slots = JSON.parse(sessionStorage.getItem(key) || '[]');
            if (Array.isArray(slots)) {
              slots.forEach((slot: any) => {
                const unified = this.convertScheduleSlot(slot, date);
                if (!this.appointments.has(unified.id)) {
                  this.appointments.set(unified.id, unified);
                  migrationCount++;
                }
              });
            }
          } catch (e) {
            logWarn('unifiedAppointment', 'Warning message', {});
          }
        }
      });

      if (migrationCount > 0) {
        logDebug('unifiedAppointment', 'Debug message', {});
        this.saveToStorage();

        // Mark legacy systems as migrated
        localStorage.setItem('tshla_legacy_migration_completed', new Date().toISOString());
      }
    } catch (error) {
      logError('unifiedAppointment', 'Error message', {});
    }
  }

  /**
   * Convert SimpleAppointment to UnifiedAppointment
   */
  private convertSimpleAppointment(simple: any): UnifiedAppointment {
    return {
      id: simple.id || this.generateId(),
      patientId: simple.patientId || this.generatePatientId(simple.patientName),
      patientName: simple.patientName,
      patientPhone: simple.patientPhone,
      patientEmail: simple.patientEmail,
      doctorId: simple.doctorId || 'doctor-default',
      doctorName: simple.doctorName || 'Dr. Unknown',
      date: simple.date,
      time: simple.time,
      duration: simple.duration || 30,
      status: simple.status || 'scheduled',
      visitType: simple.visitType || 'follow-up',
      visitReason: simple.visitReason || 'General consultation',
      notes: simple.notes,
      createdAt: simple.createdAt ? new Date(simple.createdAt) : new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Convert ScheduleSlot to UnifiedAppointment
   */
  private convertScheduleSlot(slot: any, date: string): UnifiedAppointment {
    return {
      id: slot.id || this.generateId(),
      patientId: this.generatePatientId(slot.name || slot.initials),
      patientName: slot.name || slot.initials || 'Unknown Patient',
      patientPhone: undefined,
      patientEmail: undefined,
      doctorId: 'doctor-default',
      doctorName: 'Dr. Unknown',
      date: date,
      time: slot.time,
      duration: 30,
      status: slot.status || 'scheduled',
      visitType: 'follow-up',
      visitReason: slot.notes || 'General consultation',
      notes: slot.notes,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Generate unique appointment ID
   */
  private generateId(): string {
    return `apt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate patient ID from name
   */
  private generatePatientId(name: string): string {
    const cleanName = name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return `pat-${cleanName}-${Date.now().toString().slice(-6)}`;
  }

  /**
   * Save appointments to storage with backup
   */
  private saveToStorage(): void {
    try {
      const appointments = Array.from(this.appointments.values());

      // Save to primary storage
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(appointments));

      // Create backup
      const backup = {
        timestamp: new Date().toISOString(),
        version: '1.0',
        appointments: appointments,
      };
      localStorage.setItem(this.BACKUP_KEY, JSON.stringify(backup));

      // Update sync status
      localStorage.setItem(
        this.SYNC_STATUS_KEY,
        JSON.stringify({
          lastSaved: new Date().toISOString(),
          appointmentCount: appointments.length,
        })
      );
    } catch (error) {
      logError('unifiedAppointment', 'Error message', {});
      throw error;
    }
  }

  /**
   * Set up automatic saving every 5 seconds
   */
  private setupAutoSave(): void {
    setInterval(() => {
      if (this.appointments.size > 0) {
        this.saveToStorage();
      }
    }, 5000);
  }

  // ================================
  // PUBLIC API METHODS
  // ================================

  /**
   * Create a new appointment
   */
  async createAppointment(
    appointmentData: Omit<UnifiedAppointment, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<UnifiedAppointment> {
    const appointment: UnifiedAppointment = {
      ...appointmentData,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.appointments.set(appointment.id, appointment);
    this.saveToStorage();

    logInfo('unifiedAppointment', 'Info message', {});
    return appointment;
  }

  /**
   * Get appointments by filters
   */
  getAppointments(filters?: {
    doctorId?: string;
    date?: string;
    dateRange?: { start: string; end: string };
    status?: UnifiedAppointment['status'];
  }): UnifiedAppointment[] {
    let appointments = Array.from(this.appointments.values());

    if (filters) {
      if (filters.doctorId && filters.doctorId !== 'all') {
        appointments = appointments.filter(apt => apt.doctorId === filters.doctorId);
      }

      if (filters.date) {
        appointments = appointments.filter(apt => apt.date === filters.date);
      }

      if (filters.dateRange) {
        appointments = appointments.filter(
          apt => apt.date >= filters.dateRange!.start && apt.date <= filters.dateRange!.end
        );
      }

      if (filters.status) {
        appointments = appointments.filter(apt => apt.status === filters.status);
      }
    }

    // Sort by date and time
    return appointments.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return this.timeToMinutes(a.time) - this.timeToMinutes(b.time);
    });
  }

  /**
   * Get appointment by ID
   */
  getAppointment(id: string): UnifiedAppointment | null {
    return this.appointments.get(id) || null;
  }

  /**
   * Update an appointment
   */
  async updateAppointment(
    id: string,
    updates: Partial<UnifiedAppointment>
  ): Promise<UnifiedAppointment | null> {
    const appointment = this.appointments.get(id);
    if (!appointment) {
      throw new Error(`Appointment ${id} not found`);
    }

    const updated = {
      ...appointment,
      ...updates,
      id: appointment.id, // Prevent ID changes
      updatedAt: new Date(),
    };

    this.appointments.set(id, updated);
    this.saveToStorage();

    logInfo('unifiedAppointment', 'Info message', {});
    return updated;
  }

  /**
   * Delete an appointment
   */
  async deleteAppointment(id: string): Promise<boolean> {
    const appointment = this.appointments.get(id);
    if (!appointment) {
      return false;
    }

    this.appointments.delete(id);
    this.saveToStorage();

    logDebug('unifiedAppointment', 'Debug message', {});
    return true;
  }

  /**
   * Get appointments for a specific date
   */
  getAppointmentsForDate(date: string, doctorId?: string): UnifiedAppointment[] {
    return this.getAppointments({ date, doctorId });
  }

  /**
   * Get statistics
   */
  getStats(): {
    total: number;
    scheduled: number;
    completed: number;
    cancelled: number;
    inProgress: number;
  } {
    const appointments = Array.from(this.appointments.values());

    return {
      total: appointments.length,
      scheduled: appointments.filter(apt => apt.status === 'scheduled').length,
      completed: appointments.filter(apt => apt.status === 'completed').length,
      cancelled: appointments.filter(apt => apt.status === 'cancelled').length,
      inProgress: appointments.filter(apt => apt.status === 'in-progress').length,
    };
  }

  /**
   * Export all appointments
   */
  exportAppointments(): string {
    const data = {
      exportDate: new Date().toISOString(),
      version: '1.0',
      appointments: Array.from(this.appointments.values()),
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * Clear all appointments (emergency use only)
   */
  clearAllAppointments(): void {
    logWarn('unifiedAppointment', 'Warning message', {});
    this.appointments.clear();
    this.saveToStorage();
  }

  /**
   * Helper: Convert time to minutes for sorting
   */
  private timeToMinutes(time: string): number {
    const [timePart, period] = time.split(' ');
    let [hours, minutes] = timePart.split(':').map(Number);

    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    return hours * 60 + minutes;
  }
}

// Export singleton instance - ONLY use this!
export const unifiedAppointmentService = new UnifiedAppointmentService();

// Export type for components
export type { UnifiedAppointment };
