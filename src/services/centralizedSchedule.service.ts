import { logError, logWarn, logInfo, logDebug } from './logger.service';
/**
 * Centralized Schedule Service
 * Single source of truth for all TSHLA Medical appointments
 *
 * Features:
 * - Role-based access (Doctor/Staff/Admin)
 * - Real-time sync across all users
 * - Live updates when appointments are added/modified
 * - File upload processing for admin users
 */

interface UserRole {
  role: 'doctor' | 'staff' | 'admin';
  permissions: {
    canViewAllSchedules: boolean;
    canEditAllAppointments: boolean;
    canDeleteAppointments: boolean;
    canUploadSchedules: boolean;
    canManageProviders: boolean;
  };
  assignedProvider?: {
    id: string;
    name: string;
  };
}

interface Appointment {
  id: string;
  provider_id: string;
  patient_id?: string;
  appointment_date: string;
  start_time: string;
  end_time?: string;
  appointment_type: 'routine' | 'followup' | 'consultation' | 'procedure' | 'emergency' | 'blocked';
  status:
    | 'scheduled'
    | 'confirmed'
    | 'checked_in'
    | 'in_progress'
    | 'completed'
    | 'cancelled'
    | 'no_show';
  chief_complaint?: string;
  notes?: string;
  patient_first_name?: string;
  patient_last_name?: string;
  patient_email?: string;
  patient_phone?: string;
  provider_name?: string;
  provider_email?: string;
  created_by?: string;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
}

interface ScheduleChange {
  id: string;
  table_name: 'appointments' | 'patients' | 'providers';
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_values?: any;
  new_values?: any;
  changed_by: string;
  changed_at: string;
  provider_name?: string;
}

class CentralizedScheduleService {
  private mcpServerUrl = process.env.NEXT_PUBLIC_MCP_SCHEDULE_SERVER || 'http://localhost:3001';
  private lastSyncTime: string = '1970-01-01T00:00:00Z';
  private syncInterval: NodeJS.Timeout | null = null;
  private eventListeners: Map<string, Function[]> = new Map();
  private userEmail: string = '';
  private userRole: UserRole | null = null;

  constructor() {
    // Get user email from authentication service
    this.userEmail = this.getCurrentUserEmail();
    this.initializeRealTimeSync();
  }

  // ============================================================================
  // AUTHENTICATION & PERMISSIONS
  // ============================================================================

  private getCurrentUserEmail(): string {
    // Get from localStorage or authentication service
    return localStorage.getItem('user_email') || 'unknown@tshla.ai';
  }

  async checkUserPermissions(): Promise<UserRole> {
    if (this.userRole) return this.userRole;

    try {
      const response = await this.callMCPTool('check_user_permissions', {
        user_email: this.userEmail,
      });

      if (response.hasPermission) {
        this.userRole = {
          role: response.role,
          permissions: response.permissions,
          assignedProvider: response.assignedProvider,
        };
        return this.userRole;
      } else {
        throw new Error('User does not have schedule access permissions');
      }
    } catch (error) {
      logError('centralizedSchedule', 'Error message', {});
      throw error;
    }
  }

  // ============================================================================
  // SCHEDULE RETRIEVAL (Role-based)
  // ============================================================================

  async getScheduleForDate(date: string, providerId?: string): Promise<Appointment[]> {
    try {
      const response = await this.callMCPTool('get_user_schedule', {
        user_email: this.userEmail,
        date: date,
        provider_id: providerId,
      });

      if (response.success) {
        this.emitEvent('scheduleLoaded', {
          date,
          providerId,
          appointments: response.appointments,
          userRole: response.userRole,
        });

        return response.appointments;
      } else {
        throw new Error('Failed to load schedule');
      }
    } catch (error) {
      logError('centralizedSchedule', 'Error message', {});
      throw error;
    }
  }

  async getMySchedule(date: string): Promise<Appointment[]> {
    const permissions = await this.checkUserPermissions();

    if (permissions.role === 'doctor' && permissions.assignedProvider) {
      return this.getScheduleForDate(date, permissions.assignedProvider.id);
    } else {
      return this.getScheduleForDate(date);
    }
  }

  async getAllSchedules(date: string): Promise<Appointment[]> {
    const permissions = await this.checkUserPermissions();

    if (!permissions.permissions.canViewAllSchedules) {
      throw new Error('User does not have permission to view all schedules');
    }

    return this.getScheduleForDate(date);
  }

  // ============================================================================
  // APPOINTMENT MANAGEMENT
  // ============================================================================

  async addAppointment(appointmentData: {
    provider_id: string;
    patient_data?: {
      first_name: string;
      last_name: string;
      email?: string;
      phone?: string;
      date_of_birth?: string;
      external_id?: string;
    };
    appointment_data: {
      date: string;
      start_time: string;
      end_time?: string;
      type?: string;
      status?: string;
      chief_complaint?: string;
      notes?: string;
      patient_email?: string;
      patient_phone?: string;
    };
  }): Promise<{ appointmentId: string; patientId?: string }> {
    try {
      const response = await this.callMCPTool('add_appointment', {
        provider_id: appointmentData.provider_id,
        patient_data: appointmentData.patient_data,
        appointment_data: appointmentData.appointment_data,
        created_by: this.userEmail,
      });

      if (response.success) {
        this.emitEvent('appointmentAdded', {
          appointmentId: response.appointmentId,
          patientId: response.patientId,
          appointmentData,
        });

        // Trigger sync to update all connected clients
        this.triggerSync();

        return {
          appointmentId: response.appointmentId,
          patientId: response.patientId,
        };
      } else {
        throw new Error('Failed to add appointment');
      }
    } catch (error) {
      logError('centralizedSchedule', 'Error message', {});
      throw error;
    }
  }

  async updateAppointment(appointmentId: string, updates: Partial<Appointment>): Promise<void> {
    try {
      const response = await this.callMCPTool('update_appointment', {
        appointment_id: appointmentId,
        updates: updates,
        updated_by: this.userEmail,
      });

      if (response.success) {
        this.emitEvent('appointmentUpdated', {
          appointmentId,
          updates,
          updatedFields: response.updatedFields,
        });

        // Trigger sync to update all connected clients
        this.triggerSync();
      } else {
        throw new Error('Failed to update appointment');
      }
    } catch (error) {
      logError('centralizedSchedule', 'Error message', {});
      throw error;
    }
  }

  async deleteAppointment(appointmentId: string, reason?: string): Promise<void> {
    try {
      const response = await this.callMCPTool('delete_appointment', {
        appointment_id: appointmentId,
        deleted_by: this.userEmail,
        reason: reason || 'No reason provided',
      });

      if (response.success) {
        this.emitEvent('appointmentDeleted', {
          appointmentId,
          reason: response.reason,
        });

        // Trigger sync to update all connected clients
        this.triggerSync();
      } else {
        throw new Error('Failed to delete appointment');
      }
    } catch (error) {
      logError('centralizedSchedule', 'Error message', {});
      throw error;
    }
  }

  // ============================================================================
  // FILE UPLOAD (Admin Only)
  // ============================================================================

  async uploadScheduleFile(file: File): Promise<{
    importId: string;
    summary: {
      totalRows: number;
      successful: number;
      failed: number;
      duplicates: number;
    };
  }> {
    const permissions = await this.checkUserPermissions();

    if (!permissions.permissions.canUploadSchedules) {
      throw new Error('Only admin users can upload schedule files');
    }

    try {
      // Read file content
      const fileContent = await this.readFileAsText(file);

      const response = await this.callMCPTool('import_schedule_file', {
        file_data: fileContent,
        filename: file.name,
        imported_by: this.userEmail,
        options: {
          overwrite_duplicates: false,
          validate_providers: true,
        },
      });

      if (response.success) {
        this.emitEvent('scheduleFileImported', {
          importId: response.importId,
          filename: file.name,
          summary: response.summary,
        });

        // Trigger sync to update all connected clients with new appointments
        this.triggerSync();

        return {
          importId: response.importId,
          summary: response.summary,
        };
      } else {
        throw new Error('File import failed');
      }
    } catch (error) {
      logError('centralizedSchedule', 'Error message', {});
      throw error;
    }
  }

  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  // ============================================================================
  // REAL-TIME SYNC SYSTEM
  // ============================================================================

  private initializeRealTimeSync(): void {
    // Start polling for changes every 10 seconds
    this.syncInterval = setInterval(() => {
      this.syncChanges();
    }, 10000);

    // Also sync when page becomes visible
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.syncChanges();
      }
    });
  }

  private async syncChanges(): Promise<void> {
    try {
      const response = await this.callMCPTool('get_schedule_changes', {
        since: this.lastSyncTime,
        user_email: this.userEmail,
      });

      if (response.success && response.changes.length > 0) {
        this.lastSyncTime = response.lastSync;

        // Process changes and emit events
        for (const change of response.changes) {
          this.processScheduleChange(change);
        }

        this.emitEvent('scheduleSynced', {
          changesCount: response.changes.length,
          lastSync: this.lastSyncTime,
          userRole: response.userRole,
        });
      }
    } catch (error) {
      logError('centralizedSchedule', 'Error message', {});
      // Don't throw - sync should be resilient
    }
  }

  private processScheduleChange(change: ScheduleChange): void {
    switch (change.action) {
      case 'INSERT':
        if (change.table_name === 'appointments') {
          this.emitEvent('appointmentAddedRemotely', {
            appointmentId: change.record_id,
            appointmentData: change.new_values,
            changedBy: change.changed_by,
            providerName: change.provider_name,
          });
        }
        break;

      case 'UPDATE':
        if (change.table_name === 'appointments') {
          this.emitEvent('appointmentUpdatedRemotely', {
            appointmentId: change.record_id,
            oldValues: change.old_values,
            newValues: change.new_values,
            changedBy: change.changed_by,
            providerName: change.provider_name,
          });
        }
        break;

      case 'DELETE':
        if (change.table_name === 'appointments') {
          this.emitEvent('appointmentDeletedRemotely', {
            appointmentId: change.record_id,
            appointmentData: change.old_values,
            changedBy: change.changed_by,
            providerName: change.provider_name,
          });
        }
        break;
    }
  }

  private triggerSync(): void {
    // Trigger immediate sync after making changes
    setTimeout(() => this.syncChanges(), 1000);
  }

  public stopSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // ============================================================================
  // EVENT SYSTEM FOR UI UPDATES
  // ============================================================================

  addEventListener(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  removeEventListener(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emitEvent(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          logError('centralizedSchedule', 'Error message', {});
        }
      });
    }
  }

  // ============================================================================
  // MCP COMMUNICATION
  // ============================================================================

  private async callMCPTool(toolName: string, args: any): Promise<any> {
    // In a real implementation, this would communicate with the MCP server
    // For now, we'll simulate the API calls

    logDebug('centralizedSchedule', 'Debug message', {});

    // This would be replaced with actual MCP server communication
    // For example, using WebSocket or HTTP API
    const response = await fetch(`${this.mcpServerUrl}/tools/${toolName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      throw new Error(`MCP server error: ${response.statusText}`);
    }

    return response.json();
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  async getAvailableProviders(): Promise<
    Array<{ id: string; name: string; email: string; specialty?: string }>
  > {
    try {
      const permissions = await this.checkUserPermissions();

      if (permissions.role === 'doctor' && permissions.assignedProvider) {
        // Doctors only see their own provider info
        return [permissions.assignedProvider];
      } else {
        // Staff and admin see all providers
        // This would be fetched from the database via MCP
        return [
          {
            id: 'doc_rakesh_patel',
            name: 'Dr. Rakesh Patel',
            email: 'rakesh.patel@tshla.ai',
            specialty: 'Internal Medicine',
          },
          {
            id: 'doc_neha',
            name: 'Dr. Neha Patel',
            email: 'neha@tshla.ai',
            specialty: 'Endocrinology',
          },
          {
            id: 'doc_tess',
            name: 'Dr. Tess Chamakkala',
            email: 'tess@tshla.ai',
            specialty: 'Endocrinology',
          },
          // ... other providers
        ];
      }
    } catch (error) {
      logError('centralizedSchedule', 'Error message', {});
      return [];
    }
  }

  formatAppointmentTime(appointment: Appointment): string {
    const startTime = appointment.start_time;
    const endTime = appointment.end_time;

    if (endTime) {
      return `${startTime} - ${endTime}`;
    }
    return startTime;
  }

  getAppointmentStatusColor(status: string): string {
    const colors = {
      scheduled: '#3B82F6', // Blue
      confirmed: '#10B981', // Green
      checked_in: '#F59E0B', // Yellow
      in_progress: '#EF4444', // Red
      completed: '#6B7280', // Gray
      cancelled: '#9CA3AF', // Light Gray
      no_show: '#DC2626', // Dark Red
    };

    return colors[status as keyof typeof colors] || '#6B7280';
  }
}

// Export singleton instance
export const centralizedScheduleService = new CentralizedScheduleService();

// Export types for use in components
export type { UserRole, Appointment, ScheduleChange };
