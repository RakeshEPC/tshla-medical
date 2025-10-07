// Database client configuration
// MIGRATED TO SUPABASE - MySQL and PostgreSQL pools removed
const env = {
  NODE_ENV: import.meta.env.MODE || 'development',
};

import Database from 'better-sqlite3';
import crypto from 'crypto';
import { logError, logWarn, logInfo, logDebug } from '../../services/logger.service';
// Import Supabase client
import { supabase } from '../supabase';

// Database type: Now uses Supabase (PostgreSQL) by default, SQLite for local dev
const DB_TYPE = 'supabase'; // 'supabase' or 'sqlite'

// SQLite client for development
let sqliteDb: Database.Database | null = null;

if (DB_TYPE === 'sqlite') {
  const dbPath = env.SQLITE_PATH || './medical_dictation.db';
  sqliteDb = new Database(dbPath);

  // Enable foreign keys
  sqliteDb.pragma('foreign_keys = ON');

  // Initialize SQLite schema
  initializeSQLiteSchema();
}

// Initialize SQLite schema
function initializeSQLiteSchema() {
  if (!sqliteDb) return;

  // Create tables for SQLite (simplified version)
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS doctors (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      npi TEXT UNIQUE,
      dea TEXT,
      license_number TEXT,
      license_state TEXT,
      specialty TEXT,
      practice_name TEXT,
      practice_address TEXT,
      phone TEXT,
      role TEXT DEFAULT 'doctor',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME,
      settings TEXT DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS patient_charts (
      id TEXT PRIMARY KEY,
      doctor_id TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
      patient_id TEXT NOT NULL,
      patient_name TEXT,
      patient_dob DATE,
      encounter_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      chief_complaint TEXT,
      transcript TEXT,
      soap_note TEXT,
      diagnoses TEXT DEFAULT '[]',
      medications TEXT DEFAULT '[]',
      prior_auth_required INTEGER DEFAULT 0,
      prior_auth_data TEXT,
      template_used TEXT,
      is_finalized INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME DEFAULT (datetime('now', '+14 days')),
      deleted_at DATETIME,
      UNIQUE(doctor_id, patient_id, encounter_date)
    );

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      doctor_id TEXT REFERENCES doctors(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      specialty TEXT,
      template_type TEXT,
      is_shared INTEGER DEFAULT 0,
      is_system_template INTEGER DEFAULT 0,
      sections TEXT NOT NULL,
      macros TEXT DEFAULT '{}',
      quick_phrases TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      usage_count INTEGER DEFAULT 0,
      last_used DATETIME
    );

    CREATE TABLE IF NOT EXISTS prior_authorizations (
      id TEXT PRIMARY KEY,
      chart_id TEXT REFERENCES patient_charts(id) ON DELETE CASCADE,
      doctor_id TEXT NOT NULL REFERENCES doctors(id),
      patient_id TEXT NOT NULL,
      medication TEXT NOT NULL,
      diagnosis_codes TEXT DEFAULT '[]',
      insurance_info TEXT,
      clinical_data TEXT NOT NULL,
      questions_answered TEXT,
      covermymeds_id TEXT,
      status TEXT DEFAULT 'pending',
      submitted_at DATETIME,
      response_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME DEFAULT (datetime('now', '+30 days'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      doctor_id TEXT REFERENCES doctors(id),
      action TEXT NOT NULL,
      resource_type TEXT,
      resource_id TEXT,
      patient_id TEXT,
      ip_address TEXT,
      user_agent TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      doctor_id TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS doctor_access (
      id TEXT PRIMARY KEY,
      doctor_id TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
      shared_with_doctor_id TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
      access_level TEXT DEFAULT 'read',
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(doctor_id, shared_with_doctor_id)
    );
  `);

  // Create indexes
  sqliteDb.exec(`
    CREATE INDEX IF NOT EXISTS idx_patient_charts_doctor_id ON patient_charts(doctor_id);
    CREATE INDEX IF NOT EXISTS idx_patient_charts_patient_id ON patient_charts(patient_id);
    CREATE INDEX IF NOT EXISTS idx_patient_charts_expires_at ON patient_charts(expires_at);
    CREATE INDEX IF NOT EXISTS idx_templates_doctor_id ON templates(doctor_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
  `);
}

// Database interface
export interface DbClient {
  query: (sql: string, params?: any[]) => Promise<any>;
  queryOne: (sql: string, params?: any[]) => Promise<any>;
  execute: (sql: string, params?: any[]) => Promise<any>;
  transaction: (callback: (client: DbClient) => Promise<void>) => Promise<void>;
}

// Supabase implementation (PostgreSQL)
class SupabaseClient implements DbClient {
  /**
   * Execute a raw SQL query via Supabase RPC
   * Note: For security, raw SQL should be minimized. Use Supabase query builder when possible.
   */
  async query(sql: string, params?: any[]) {
    try {
      // Supabase doesn't support raw SQL from client for security reasons
      // Instead, use Supabase query builder or create RPC functions
      logWarn('SupabaseClient', 'Raw SQL not recommended. Use supabase.from() query builder.');

      // For backward compatibility, attempt to parse and convert simple queries
      // This is a limited implementation - complex queries should use RPC
      throw new Error('Raw SQL queries not supported. Use Supabase query builder or RPC functions.');
    } catch (error) {
      logError('SupabaseClient', 'Query failed', { error });
      throw error;
    }
  }

  async queryOne(sql: string, params?: any[]) {
    const results = await this.query(sql, params);
    return results?.[0];
  }

  async execute(sql: string, params?: any[]) {
    return await this.query(sql, params);
  }

  async transaction(callback: (client: DbClient) => Promise<void>) {
    try {
      // Supabase doesn't support client-side transactions
      // Execute callback without transaction wrapper
      // Note: For actual transactions, use Supabase RPC with PostgreSQL functions
      await callback(this);
      logWarn('SupabaseClient', 'Client-side transactions not supported. Use RPC for atomic operations.');
    } catch (error) {
      logError('SupabaseClient', 'Transaction callback failed', { error });
      throw error;
    }
  }
}

// SQLite implementation
class SQLiteClient implements DbClient {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  async query(sql: string, params?: any[]) {
    // Convert PostgreSQL placeholders ($1, $2) to SQLite (?, ?)
    const sqliteSql = sql.replace(/\$(\d+)/g, '?');
    return this.db.prepare(sqliteSql).all(...(params || []));
  }

  async queryOne(sql: string, params?: any[]) {
    const sqliteSql = sql.replace(/\$(\d+)/g, '?');
    return this.db.prepare(sqliteSql).get(...(params || []));
  }

  async execute(sql: string, params?: any[]) {
    const sqliteSql = sql.replace(/\$(\d+)/g, '?');
    const result = this.db.prepare(sqliteSql).run(...(params || []));
    return { rowCount: result.changes, lastInsertRowid: result.lastInsertRowid };
  }

  async transaction(callback: (client: DbClient) => Promise<void>) {
    const transaction = this.db.transaction(async () => {
      await callback(this);
    });
    transaction();
  }
}

// Get database client
export function getDb(): DbClient {
  if (DB_TYPE === 'supabase') {
    return new SupabaseClient();
  } else if (DB_TYPE === 'sqlite' && sqliteDb) {
    return new SQLiteClient(sqliteDb);
  }

  // Fallback to SQLite for local development if no database configured
  if (!sqliteDb) {
    sqliteDb = new Database(':memory:');
    initializeSQLiteSchema();
  }
  return new SQLiteClient(sqliteDb);
}

// Helper to generate UUID (for SQLite)
export function generateId(): string {
  return crypto.randomUUID();
}

// Helper to hash passwords using bcryptjs (works in serverless)
export async function hashPassword(password: string): Promise<string> {
  const bcryptjs = await import('bcryptjs');
  const saltRounds = 12; // HIPAA-compliant strength
  return bcryptjs.hash(password, saltRounds);
}

// Helper to verify passwords using bcryptjs
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const bcryptjs = await import('bcryptjs');
  return bcryptjs.compare(password, hash);
}

// Auto-delete expired charts (run daily)
export async function deleteExpiredCharts() {
  const db = getDb();
  const sql = `
    UPDATE patient_charts 
    SET deleted_at = CURRENT_TIMESTAMP 
    WHERE expires_at < CURRENT_TIMESTAMP 
    AND deleted_at IS NULL
  `;
  await db.execute(sql);
}

// Cleanup old audit logs (run weekly)
export async function cleanupAuditLogs() {
  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    if (DB_TYPE === 'supabase') {
      // Use Supabase to delete old logs
      const { error } = await supabase
        .from('audit_logs')
        .delete()
        .lt('created_at', ninetyDaysAgo.toISOString());

      if (error) throw error;
      logInfo('DbClient', 'Old audit logs cleaned up successfully');
    } else {
      // SQLite fallback
      const db = getDb();
      const sql = `DELETE FROM audit_logs WHERE created_at < datetime('now', '-90 days')`;
      await db.execute(sql);
    }
  } catch (error) {
    logError('DbClient', 'Failed to cleanup audit logs', { error });
  }
}

// Export Supabase client for direct usage (recommended for new code)
export { supabase };

export default getDb;
