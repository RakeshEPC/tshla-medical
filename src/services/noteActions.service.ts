/**
 * Note Actions Service
 * Manages extraction and storage of action items from doctor's dictation
 * Provides interface for staff to view and process pending actions
 */

import { actionExtractionService } from './actionExtraction.service';
import { auditService } from './audit.service';
import { simpleAppointmentService } from './simpleAppointment.service';
import { chartService } from './chart.service';
import type { ActionItem, MedicationAction, LabAction } from '../types/clinic.types';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

interface StoredAction extends ActionItem {
  doctorName: string;
  doctorId: string;
  patientName: string;
  dateExtracted: Date;
  noteId?: string;
  processed: boolean;
  processedBy?: string;
  processedDate?: Date;
}

class NoteActionsService {
  private pendingActions: StoredAction[] = [];

  constructor() {
    // Load saved actions from localStorage
    this.loadActions();

    // Add some sample data for demonstration
    this.initializeSampleData();
  }

  /**
   * Extract and save actions from a doctor's note
   */
  async extractAndSaveActions(
    noteText: string,
    patientId: string,
    patientName: string,
    doctorId: string,
    doctorName: string,
    noteId?: string
  ) {
    // Extract actions using the existing service
    const extracted = await actionExtractionService.extractActions(noteText);

    // Convert to stored actions
    const timestamp = new Date();

    // Process medications
    extracted.meds.forEach(med => {
      const action: StoredAction = {
        id: `med-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        patientId,
        patientName,
        doctorId,
        doctorName,
        noteId,
        itemType: 'medication',
        action: this.formatMedicationAction(med),
        details: med,
        status: 'pending',
        createdAt: timestamp,
        dateExtracted: timestamp,
        processed: false,
      };
      this.pendingActions.push(action);
    });

    // Process labs
    extracted.labs.forEach(lab => {
      const action: StoredAction = {
        id: `lab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        patientId,
        patientName,
        doctorId,
        doctorName,
        noteId,
        itemType: 'lab',
        action: `Order ${lab.test}`,
        details: lab,
        status: 'pending',
        createdAt: timestamp,
        dateExtracted: timestamp,
        processed: false,
      };
      this.pendingActions.push(action);
    });

    // Save to localStorage
    this.saveActions();

    // Log the extraction
    auditService.log('create', 'action_items', undefined, {
      patientId,
      doctorId,
      medicationCount: extracted.meds.length,
      labCount: extracted.labs.length,
    });

    return this.pendingActions.filter(a => a.noteId === noteId);
  }

  /**
   * Format medication action for display
   */
  private formatMedicationAction(med: MedicationAction): string {
    let action = `${med.action.charAt(0).toUpperCase() + med.action.slice(1)} ${med.drug}`;
    if (med.dose) action += ` ${med.dose}`;
    if (med.frequency) action += ` ${med.frequency}`;
    return action;
  }

  /**
   * Get pending actions for staff dashboard
   */
  getPendingActions(filters?: {
    doctorId?: string;
    patientId?: string;
    itemType?: 'medication' | 'lab';
  }): StoredAction[] {
    let actions = this.pendingActions.filter(a => !a.processed);

    if (filters?.doctorId && filters.doctorId !== 'all') {
      actions = actions.filter(a => a.doctorId === filters.doctorId);
    }

    if (filters?.patientId) {
      actions = actions.filter(a => a.patientId === filters.patientId);
    }

    if (filters?.itemType) {
      actions = actions.filter(a => a.itemType === filters.itemType);
    }

    // Sort by date, newest first
    return actions.sort((a, b) => b.dateExtracted.getTime() - a.dateExtracted.getTime());
  }

  /**
   * Mark an action as processed
   */
  processAction(actionId: string, processedBy: string): boolean {
    const action = this.pendingActions.find(a => a.id === actionId);
    if (action) {
      action.processed = true;
      action.processedBy = processedBy;
      action.processedDate = new Date();
      action.status = 'completed';
      this.saveActions();

      // Log the processing
      auditService.log('update', 'action_item', actionId, {
        processed: true,
        processedBy,
      });

      return true;
    }
    return false;
  }

  /**
   * Get count of pending actions
   */
  getPendingCount(itemType?: 'medication' | 'lab'): number {
    const pending = this.pendingActions.filter(a => !a.processed);
    if (itemType) {
      return pending.filter(a => a.itemType === itemType).length;
    }
    return pending.length;
  }

  /**
   * Load actions from localStorage
   */
  private loadActions() {
    try {
      const saved = localStorage.getItem('tshla_pending_actions');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Convert date strings back to Date objects
        this.pendingActions = parsed.map((a: any) => ({
          ...a,
          createdAt: new Date(a.createdAt),
          dateExtracted: new Date(a.dateExtracted),
          processedDate: a.processedDate ? new Date(a.processedDate) : undefined,
        }));
      }
    } catch (error) {
      logError('noteActions', 'Error message', {});
    }
  }

  /**
   * Save actions to localStorage
   */
  private saveActions() {
    try {
      localStorage.setItem('tshla_pending_actions', JSON.stringify(this.pendingActions));
    } catch (error) {
      logError('noteActions', 'Error message', {});
    }
  }

  /**
   * Initialize with sample data from real appointments
   */
  private async initializeSampleData() {
    if (this.pendingActions.length === 0) {
      // Get real appointments from this week
      const appointments = simpleAppointmentService.getAppointments({ weekOf: new Date() });

      // Sample dictation notes for different appointments with real medical scenarios
      const sampleDictations = [
        {
          appointmentId: appointments[0]?.id,
          patientId: appointments[0]?.patientId,
          patientName: appointments[0]?.patientName,
          doctorId: appointments[0]?.doctorId,
          doctorName: appointments[0]?.doctorName,
          note: 'Patient here for diabetes follow-up. A1C is 8.2, up from 7.8. Will start metformin 500mg BID. Also order A1C in 3 months and comprehensive metabolic panel. Patient education on diet provided.',
        },
        {
          appointmentId: appointments[1]?.id,
          patientId: appointments[1]?.patientId,
          patientName: appointments[1]?.patientName,
          doctorId: appointments[1]?.doctorId,
          doctorName: appointments[1]?.doctorName,
          note: 'New patient with hypertension. BP 150/95. Starting lisinopril 10mg daily. Order CBC, CMP, and lipid panel. Follow up in 2 weeks.',
        },
        {
          appointmentId: appointments[2]?.id,
          patientId: appointments[2]?.patientId,
          patientName: appointments[2]?.patientName,
          doctorId: appointments[2]?.doctorId,
          doctorName: appointments[2]?.doctorName,
          note: 'Blood pressure check. Current meds working well. Continue amlodipine 5mg daily. Refill all medications. Order TSH and basic metabolic panel.',
        },
        {
          appointmentId: appointments[3]?.id,
          patientId: appointments[3]?.patientId,
          patientName: appointments[3]?.patientName,
          doctorId: appointments[3]?.doctorId,
          doctorName: appointments[3]?.doctorName,
          note: 'Thyroid follow-up. TSH elevated at 8.5. Increase levothyroxine to 100mcg daily. Will recheck TSH in 6 weeks.',
        },
        {
          appointmentId: appointments[4]?.id,
          patientId: appointments[4]?.patientId,
          patientName: appointments[4]?.patientName,
          doctorId: appointments[4]?.doctorId,
          doctorName: appointments[4]?.doctorName,
          note: 'Cholesterol management. LDL 165. Start atorvastatin 20mg at bedtime. Order lipid panel in 6 weeks. Discussed lifestyle modifications.',
        },
        {
          appointmentId: appointments[5]?.id,
          patientId: appointments[5]?.patientId,
          patientName: appointments[5]?.patientName,
          doctorId: appointments[5]?.doctorId,
          doctorName: appointments[5]?.doctorName,
          note: 'Annual physical exam. All vitals stable. Order CBC with differential, CMP, lipid panel, A1C, and urinalysis. Continue current medications.',
        },
        {
          appointmentId: appointments[6]?.id,
          patientId: appointments[6]?.patientId,
          patientName: appointments[6]?.patientName,
          doctorId: appointments[6]?.doctorId,
          doctorName: appointments[6]?.doctorName,
          note: 'Weight management consultation. BMI 32. Start phentermine 37.5mg daily for 3 months. Check thyroid function - order TSH and free T4.',
        },
        {
          appointmentId: appointments[7]?.id,
          patientId: appointments[7]?.patientId,
          patientName: appointments[7]?.patientName,
          doctorId: appointments[7]?.doctorId,
          doctorName: appointments[7]?.doctorName,
          note: 'Migraine management. Frequent headaches. Start sumatriptan 100mg as needed for migraines. Begin propranolol 20mg BID for prophylaxis.',
        },
        {
          appointmentId: appointments[8]?.id,
          patientId: appointments[8]?.patientId,
          patientName: appointments[8]?.patientName,
          doctorId: appointments[8]?.doctorId,
          doctorName: appointments[8]?.doctorName,
          note: 'Asthma control visit. Still using rescue inhaler frequently. Increase fluticasone to 220mcg BID. Continue albuterol as needed. Order pulmonary function tests.',
        },
        {
          appointmentId: appointments[9]?.id,
          patientId: appointments[9]?.patientId,
          patientName: appointments[9]?.patientName,
          doctorId: appointments[9]?.doctorId,
          doctorName: appointments[9]?.doctorName,
          note: 'Anxiety medication review. Current dose helping but not adequate. Increase sertraline to 100mg daily. Continue alprazolam 0.5mg as needed.',
        },
      ];

      // Extract actions from each dictation note
      for (const dictation of sampleDictations) {
        if (dictation.patientId && dictation.doctorId) {
          await this.extractAndSaveActions(
            dictation.note,
            dictation.patientId,
            dictation.patientName || 'Unknown Patient',
            dictation.doctorId,
            dictation.doctorName || 'Unknown Doctor',
            dictation.appointmentId
          );
        }
      }

      // Add a few more direct actions for variety
      if (appointments[10]) {
        await this.extractAndSaveActions(
          'Post-surgery follow-up looks good. Stop tramadol. Switch to ibuprofen 600mg TID as needed for pain.',
          appointments[10].patientId,
          appointments[10].patientName,
          appointments[10].doctorId,
          appointments[10].doctorName,
          appointments[10].id
        );
      }

      if (appointments[11]) {
        await this.extractAndSaveActions(
          'Lab review shows A1C improved to 6.8. Continue metformin 1000mg BID. Order repeat A1C in 3 months.',
          appointments[11].patientId,
          appointments[11].patientName,
          appointments[11].doctorId,
          appointments[11].doctorName,
          appointments[11].id
        );
      }

      if (appointments[12]) {
        await this.extractAndSaveActions(
          'Sleep apnea evaluation. Order sleep study. Start melatonin 5mg at bedtime while waiting for study results.',
          appointments[12].patientId,
          appointments[12].patientName,
          appointments[12].doctorId,
          appointments[12].doctorName,
          appointments[12].id
        );
      }
    }
  }

  /**
   * Clear all actions (for testing)
   */
  clearAllActions() {
    this.pendingActions = [];
    this.saveActions();
  }

  /**
   * Regenerate actions with real appointment data
   */
  async regenerateWithRealData() {
    this.pendingActions = [];
    this.saveActions();
    await this.initializeSampleData();
    return this.pendingActions;
  }
}

export const noteActionsService = new NoteActionsService();
