/**
 * Database Initialization
 * This runs automatically when the app starts to ensure tables exist
 */

import { getDb } from './client';
import { logError, logWarn, logInfo, logDebug } from '../../services/logger.service';

export async function initializeAppointmentsTable() {
  const db = getDb();

  try {
    // Create appointments table if it doesn't exist
    await db.execute(`
      CREATE TABLE IF NOT EXISTS appointments (
        id TEXT PRIMARY KEY,
        doctor_id TEXT NOT NULL,
        patient_id TEXT NOT NULL,
        patient_name TEXT NOT NULL,
        patient_mrn TEXT NOT NULL,
        patient_phone TEXT,
        patient_email TEXT,
        patient_dob DATE,
        appointment_date DATE NOT NULL,
        appointment_time TEXT NOT NULL,
        appointment_slot TEXT NOT NULL,
        duration_minutes INTEGER DEFAULT 30,
        status TEXT DEFAULT 'scheduled',
        visit_type TEXT DEFAULT 'follow-up',
        chief_complaint TEXT,
        notes TEXT,
        practice_id TEXT,
        location TEXT,
        room_number TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT NOT NULL,
        updated_by TEXT,
        is_deleted INTEGER DEFAULT 0,
        deleted_at DATETIME,
        deleted_by TEXT,
        UNIQUE(doctor_id, appointment_slot)
      )
    `);

    // Create indexes
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date 
      ON appointments(doctor_id, appointment_date)
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_appointments_patient 
      ON appointments(patient_id)
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_appointments_date 
      ON appointments(appointment_date)
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_appointments_status 
      ON appointments(status)
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_appointments_slot 
      ON appointments(appointment_slot)
    `);

    logInfo('App', 'Info message', {});
  } catch (error) {
    logError('App', 'Error message', {});
    // Don't throw - app can still work without appointments
  }
}

// Initialize on import
initializeAppointmentsTable().catch(console.error);
