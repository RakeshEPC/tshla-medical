/**
 * PCM Data Migration Script
 * Migrates PCM data from localStorage to Supabase
 * Run this ONE TIME during deployment to migrate existing data
 *
 * Usage:
 *   npx tsx src/scripts/migrate-pcm-data.ts
 *
 * Created: 2025-01-26
 */

import { supabase } from '../lib/supabase';
import { pcmDatabaseService } from '../services/pcmDatabase.service';
import type {
  PCMEnrollment,
  PCMContact,
  PCMVital,
  PCMTask,
  PCMTimeEntry
} from '../types/pcm.database.types';

interface MigrationResult {
  success: boolean;
  summary: {
    enrollments: { attempted: number; successful: number; failed: number };
    vitals: { attempted: number; successful: number; failed: number };
    tasks: { attempted: number; successful: number; failed: number };
    timeEntries: { attempted: number; successful: number; failed: number };
    contacts: { attempted: number; successful: number; failed: number };
  };
  errors: Array<{ type: string; message: string; data?: any }>;
  backupKey: string | null;
}

class PCMDataMigration {
  private errors: Array<{ type: string; message: string; data?: any }> = [];
  private readonly STORAGE_PREFIX = 'pcm_';
  private readonly BACKUP_PREFIX = 'pcm_backup_';

  /**
   * Main migration entry point
   */
  async migrate(): Promise<MigrationResult> {
    console.log('🚀 Starting PCM data migration from localStorage to Supabase...\n');

    const result: MigrationResult = {
      success: false,
      summary: {
        enrollments: { attempted: 0, successful: 0, failed: 0 },
        vitals: { attempted: 0, successful: 0, failed: 0 },
        tasks: { attempted: 0, successful: 0, failed: 0 },
        timeEntries: { attempted: 0, successful: 0, failed: 0 },
        contacts: { attempted: 0, successful: 0, failed: 0 }
      },
      errors: [],
      backupKey: null
    };

    try {
      // Step 1: Backup existing localStorage data
      console.log('📦 Step 1: Backing up localStorage data...');
      const backupKey = this.backupLocalStorageData();
      result.backupKey = backupKey;
      console.log(`✅ Backup created: ${backupKey}\n`);

      // Step 2: Extract data from localStorage
      console.log('📊 Step 2: Extracting data from localStorage...');
      const extractedData = this.extractLocalStorageData();
      console.log(`   Found ${extractedData.patients.length} patients`);
      console.log(`   Found ${extractedData.vitals.length} vital readings`);
      console.log(`   Found ${extractedData.tasks.length} tasks`);
      console.log(`   Found ${extractedData.timeEntries.length} time entries\n`);

      // Step 3: Verify Supabase connection
      console.log('🔗 Step 3: Verifying Supabase connection...');
      const isConnected = await this.verifySupabaseConnection();
      if (!isConnected) {
        throw new Error('Failed to connect to Supabase. Check your environment variables.');
      }
      console.log('✅ Supabase connection verified\n');

      // Step 4: Migrate enrollments
      console.log('👥 Step 4: Migrating patient enrollments...');
      const enrollmentResult = await this.migrateEnrollments(extractedData.patients);
      result.summary.enrollments = enrollmentResult;
      console.log(`   ✅ ${enrollmentResult.successful}/${enrollmentResult.attempted} enrollments migrated\n`);

      // Step 5: Migrate vitals
      console.log('💓 Step 5: Migrating vital signs...');
      const vitalsResult = await this.migrateVitals(extractedData.vitals);
      result.summary.vitals = vitalsResult;
      console.log(`   ✅ ${vitalsResult.successful}/${vitalsResult.attempted} vitals migrated\n`);

      // Step 6: Migrate tasks
      console.log('📋 Step 6: Migrating tasks...');
      const tasksResult = await this.migrateTasks(extractedData.tasks);
      result.summary.tasks = tasksResult;
      console.log(`   ✅ ${tasksResult.successful}/${tasksResult.attempted} tasks migrated\n`);

      // Step 7: Migrate time entries
      console.log('⏱️  Step 7: Migrating time entries...');
      const timeResult = await this.migrateTimeEntries(extractedData.timeEntries);
      result.summary.timeEntries = timeResult;
      console.log(`   ✅ ${timeResult.successful}/${timeResult.attempted} time entries migrated\n`);

      // Step 8: Verification
      console.log('🔍 Step 8: Verifying migration...');
      const verification = await this.verifyMigration(extractedData);
      console.log(`   Database enrollments: ${verification.dbEnrollments}`);
      console.log(`   Database vitals: ${verification.dbVitals}`);
      console.log(`   Database tasks: ${verification.dbTasks}`);
      console.log(`   Database time entries: ${verification.dbTimeEntries}\n`);

      result.success = true;
      result.errors = this.errors;

      // Final summary
      console.log('✨ Migration Complete!\n');
      console.log('📊 Summary:');
      console.log(`   Total errors: ${this.errors.length}`);
      console.log(`   Backup location: ${backupKey}`);
      console.log('\n⚠️  IMPORTANT: Do NOT clear localStorage until you verify the migration!');
      console.log('   Run verification queries in Supabase dashboard first.\n');

      return result;

    } catch (error) {
      console.error('❌ Migration failed:', error);
      result.success = false;
      result.errors = this.errors;
      this.errors.push({
        type: 'FATAL',
        message: error instanceof Error ? error.message : 'Unknown error',
        data: error
      });
      return result;
    }
  }

  /**
   * Backup all PCM data from localStorage
   */
  private backupLocalStorageData(): string {
    const backupKey = `${this.BACKUP_PREFIX}${Date.now()}`;
    const backupData: Record<string, any> = {};

    // Extract all PCM-related keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.STORAGE_PREFIX)) {
        const value = localStorage.getItem(key);
        if (value) {
          backupData[key] = value;
        }
      }
    }

    // Save backup
    localStorage.setItem(backupKey, JSON.stringify(backupData));
    return backupKey;
  }

  /**
   * Extract and parse all PCM data from localStorage
   */
  private extractLocalStorageData() {
    const data = {
      patients: [] as any[],
      vitals: [] as any[],
      tasks: [] as any[],
      timeEntries: [] as any[]
    };

    try {
      // Extract patient enrollments
      const patientsData = localStorage.getItem(`${this.STORAGE_PREFIX}patients`);
      if (patientsData) {
        data.patients = JSON.parse(patientsData);
      }

      // Extract vitals (stored per patient)
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`${this.STORAGE_PREFIX}vitals_`)) {
          const vitalsData = localStorage.getItem(key);
          if (vitalsData) {
            const vitals = JSON.parse(vitalsData);
            data.vitals.push(...vitals);
          }
        }
      }

      // Extract tasks (stored per patient)
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`${this.STORAGE_PREFIX}tasks_`)) {
          const tasksData = localStorage.getItem(key);
          if (tasksData) {
            const tasks = JSON.parse(tasksData);
            data.tasks.push(...tasks);
          }
        }
      }

      // Extract time entries (stored per patient per month)
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`${this.STORAGE_PREFIX}time_`)) {
          const timeData = localStorage.getItem(key);
          if (timeData) {
            const entries = JSON.parse(timeData);
            data.timeEntries.push(...entries);
          }
        }
      }

    } catch (error) {
      console.error('Error extracting localStorage data:', error);
      this.errors.push({
        type: 'EXTRACTION_ERROR',
        message: 'Failed to extract data from localStorage',
        data: error
      });
    }

    return data;
  }

  /**
   * Verify Supabase connection
   */
  private async verifySupabaseConnection(): Promise<boolean> {
    try {
      const { data, error } = await supabase.from('pcm_enrollments').select('id').limit(1);
      return !error;
    } catch (error) {
      return false;
    }
  }

  /**
   * Migrate patient enrollments
   */
  private async migrateEnrollments(patients: any[]) {
    const result = { attempted: 0, successful: 0, failed: 0 };

    for (const patient of patients) {
      result.attempted++;
      try {
        // Find or create patient in patients table
        const patientId = await this.ensurePatientExists(patient);

        // Transform localStorage format to database format
        const enrollmentData = {
          patient_id: patientId,
          enrolled_date: new Date().toISOString(),
          risk_level: (patient.riskLevel || 'medium') as 'high' | 'medium' | 'low',
          current_a1c: patient.currentA1C || null,
          target_a1c: patient.targetA1C || 7.0,
          current_bp: patient.currentBP || null,
          target_bp: patient.targetBP || '130/80',
          current_weight: patient.currentWeight || null,
          target_weight: patient.targetWeight || null,
          medication_adherence_pct: patient.medicationAdherence || 0,
          missed_appointments: patient.missedAppointments || 0,
          phone: patient.phone || null,
          email: patient.email || null,
          last_contact_date: patient.lastContact ? new Date(patient.lastContact).toISOString() : null,
          next_contact_due: patient.nextContactDue ? new Date(patient.nextContactDue).toISOString().split('T')[0] : null,
          is_active: true
        };

        const { data, error } = await supabase
          .from('pcm_enrollments')
          .insert(enrollmentData)
          .select()
          .single();

        if (error) throw error;
        result.successful++;

      } catch (error) {
        result.failed++;
        this.errors.push({
          type: 'ENROLLMENT_MIGRATION_ERROR',
          message: `Failed to migrate patient ${patient.id || patient.name}`,
          data: error
        });
      }
    }

    return result;
  }

  /**
   * Migrate vital signs
   */
  private async migrateVitals(vitals: any[]) {
    const result = { attempted: 0, successful: 0, failed: 0 };

    // Batch insert for better performance
    const batchSize = 50;
    for (let i = 0; i < vitals.length; i += batchSize) {
      const batch = vitals.slice(i, i + batchSize);
      result.attempted += batch.length;

      try {
        const transformedVitals = await Promise.all(
          batch.map(async (vital) => {
            const patientId = await this.getPatientIdByOldId(vital.patientId);
            const enrollmentId = await this.getEnrollmentIdByPatientId(patientId);

            return {
              patient_id: patientId,
              enrollment_id: enrollmentId,
              reading_date: new Date(vital.readingDate).toISOString(),
              recorded_by: vital.recordedBy || 'patient',
              blood_sugar: vital.bloodSugar || null,
              blood_pressure_systolic: vital.systolic || null,
              blood_pressure_diastolic: vital.diastolic || null,
              weight: vital.weight || null,
              patient_notes: vital.notes || null
            };
          })
        );

        const { data, error } = await supabase
          .from('pcm_vitals')
          .insert(transformedVitals)
          .select();

        if (error) throw error;
        result.successful += transformedVitals.length;

      } catch (error) {
        result.failed += batch.length;
        this.errors.push({
          type: 'VITALS_MIGRATION_ERROR',
          message: `Failed to migrate vitals batch ${i}-${i + batchSize}`,
          data: error
        });
      }
    }

    return result;
  }

  /**
   * Migrate tasks
   */
  private async migrateTasks(tasks: any[]) {
    const result = { attempted: 0, successful: 0, failed: 0 };

    for (const task of tasks) {
      result.attempted++;
      try {
        const patientId = await this.getPatientIdByOldId(task.patientId);
        const enrollmentId = await this.getEnrollmentIdByPatientId(patientId);

        const taskData = {
          patient_id: patientId,
          enrollment_id: enrollmentId,
          title: task.title,
          description: task.description || null,
          category: task.category || 'other',
          frequency: task.frequency || 'daily',
          is_completed: task.completed || false,
          completed_date: task.completedDate ? new Date(task.completedDate).toISOString() : null,
          priority: 'medium' as const
        };

        const { data, error } = await supabase
          .from('pcm_tasks')
          .insert(taskData)
          .select()
          .single();

        if (error) throw error;
        result.successful++;

      } catch (error) {
        result.failed++;
        this.errors.push({
          type: 'TASK_MIGRATION_ERROR',
          message: `Failed to migrate task ${task.id}`,
          data: error
        });
      }
    }

    return result;
  }

  /**
   * Migrate time entries
   */
  private async migrateTimeEntries(entries: any[]) {
    const result = { attempted: 0, successful: 0, failed: 0 };

    for (const entry of entries) {
      result.attempted++;
      try {
        const patientId = await this.getPatientIdByOldId(entry.patientId);
        const enrollmentId = await this.getEnrollmentIdByPatientId(patientId);

        const timeData = {
          patient_id: patientId,
          enrollment_id: enrollmentId,
          staff_id: entry.staffId || null,
          staff_name: entry.staffName || 'Unknown',
          activity_type: entry.activityType || 'other',
          start_time: new Date(entry.startTime).toISOString(),
          end_time: new Date(entry.endTime).toISOString(),
          duration_minutes: entry.durationMinutes,
          billing_month: entry.month,
          notes: entry.notes || null
        };

        const { data, error } = await supabase
          .from('pcm_time_entries')
          .insert(timeData)
          .select()
          .single();

        if (error) throw error;
        result.successful++;

      } catch (error) {
        result.failed++;
        this.errors.push({
          type: 'TIME_ENTRY_MIGRATION_ERROR',
          message: `Failed to migrate time entry ${entry.id}`,
          data: error
        });
      }
    }

    return result;
  }

  /**
   * Verify migration results
   */
  private async verifyMigration(extractedData: any) {
    try {
      const { data: enrollments } = await supabase
        .from('pcm_enrollments')
        .select('id');

      const { data: vitals } = await supabase
        .from('pcm_vitals')
        .select('id');

      const { data: tasks } = await supabase
        .from('pcm_tasks')
        .select('id');

      const { data: timeEntries } = await supabase
        .from('pcm_time_entries')
        .select('id');

      return {
        dbEnrollments: enrollments?.length || 0,
        dbVitals: vitals?.length || 0,
        dbTasks: tasks?.length || 0,
        dbTimeEntries: timeEntries?.length || 0
      };
    } catch (error) {
      console.error('Verification error:', error);
      return {
        dbEnrollments: 0,
        dbVitals: 0,
        dbTasks: 0,
        dbTimeEntries: 0
      };
    }
  }

  /**
   * Helper: Ensure patient exists in patients table
   */
  private async ensurePatientExists(oldPatient: any): Promise<string> {
    // Try to find existing patient by name or old ID
    const { data: existing } = await supabase
      .from('patients')
      .select('id')
      .or(`first_name.eq.${oldPatient.name?.split(' ')[0]},patient_id.eq.${oldPatient.id}`)
      .limit(1)
      .single();

    if (existing) {
      return existing.id;
    }

    // Create new patient record
    const names = (oldPatient.name || 'Unknown Patient').split(' ');
    const { data: newPatient, error } = await supabase
      .from('patients')
      .insert({
        first_name: names[0],
        last_name: names.slice(1).join(' ') || names[0],
        patient_id: oldPatient.id || `migrated-${Date.now()}`,
        phone: oldPatient.phone,
        email: oldPatient.email,
        date_of_birth: oldPatient.dob || null
      })
      .select('id')
      .single();

    if (error) throw error;
    return newPatient.id;
  }

  /**
   * Helper: Get new patient ID from old localStorage ID
   */
  private async getPatientIdByOldId(oldId: string): Promise<string> {
    const { data } = await supabase
      .from('patients')
      .select('id')
      .eq('patient_id', oldId)
      .single();

    if (data) return data.id;

    // Fallback: try to find by migrated ID
    const { data: migrated } = await supabase
      .from('patients')
      .select('id')
      .like('patient_id', `%${oldId}%`)
      .limit(1)
      .single();

    if (migrated) return migrated.id;

    throw new Error(`Patient not found for old ID: ${oldId}`);
  }

  /**
   * Helper: Get enrollment ID by patient ID
   */
  private async getEnrollmentIdByPatientId(patientId: string): Promise<string> {
    const { data, error } = await supabase
      .from('pcm_enrollments')
      .select('id')
      .eq('patient_id', patientId)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      throw new Error(`No active enrollment found for patient: ${patientId}`);
    }

    return data.id;
  }
}

/**
 * CLI Interface
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         PCM Data Migration: localStorage → Supabase       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const migration = new PCMDataMigration();
  const result = await migration.migrate();

  if (result.success) {
    console.log('✅ Migration completed successfully!\n');

    // Print summary table
    console.log('┌────────────────┬──────────┬────────────┬────────┐');
    console.log('│ Data Type      │ Attempted│ Successful │ Failed │');
    console.log('├────────────────┼──────────┼────────────┼────────┤');
    console.log(`│ Enrollments    │ ${result.summary.enrollments.attempted.toString().padEnd(8)} │ ${result.summary.enrollments.successful.toString().padEnd(10)} │ ${result.summary.enrollments.failed.toString().padEnd(6)} │`);
    console.log(`│ Vitals         │ ${result.summary.vitals.attempted.toString().padEnd(8)} │ ${result.summary.vitals.successful.toString().padEnd(10)} │ ${result.summary.vitals.failed.toString().padEnd(6)} │`);
    console.log(`│ Tasks          │ ${result.summary.tasks.attempted.toString().padEnd(8)} │ ${result.summary.tasks.successful.toString().padEnd(10)} │ ${result.summary.tasks.failed.toString().padEnd(6)} │`);
    console.log(`│ Time Entries   │ ${result.summary.timeEntries.attempted.toString().padEnd(8)} │ ${result.summary.timeEntries.successful.toString().padEnd(10)} │ ${result.summary.timeEntries.failed.toString().padEnd(6)} │`);
    console.log('└────────────────┴──────────┴────────────┴────────┘\n');

    if (result.errors.length > 0) {
      console.log(`⚠️  ${result.errors.length} errors occurred during migration:`);
      result.errors.forEach((err, idx) => {
        console.log(`   ${idx + 1}. [${err.type}] ${err.message}`);
      });
      console.log('');
    }

    console.log('📝 Next Steps:');
    console.log('   1. Verify data in Supabase dashboard');
    console.log('   2. Test the application with new database service');
    console.log('   3. Once verified, you can clear localStorage:');
    console.log(`      localStorage.removeItem('pcm_patients')`);
    console.log(`      localStorage.removeItem('pcm_vitals_*')`);
    console.log('   4. Keep the backup: ' + result.backupKey);
    console.log('');

    process.exit(0);
  } else {
    console.error('❌ Migration failed. Check errors above.');
    console.log(`\n💾 Data backup available at: ${result.backupKey}`);
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { PCMDataMigration, type MigrationResult };
