// Database client configuration
const env = {
  DATABASE_TYPE: import.meta.env.VITE_DATABASE_TYPE || 'sqlite',
  DATABASE_URL: import.meta.env.VITE_DATABASE_URL || '',
  NODE_ENV: import.meta.env.MODE || 'development',
};
// Supports PostgreSQL, MySQL (Azure), and SQLite (development/testing)

import { Pool } from 'pg';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import { logError, logWarn, logInfo, logDebug } from '../../services/logger.service';

// Database type based on environment
const DB_TYPE = env.DATABASE_TYPE || 'sqlite'; // 'postgres', 'mysql', or 'sqlite'

// PostgreSQL client
let pgPool: Pool | null = null;

if (DB_TYPE === 'postgres' && env.DATABASE_URL) {
  pgPool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
}

// MySQL client for Azure
let mysqlPool: any = null;

if (DB_TYPE === 'mysql' && env.DATABASE_URL) {
  // Dynamic import for mysql2
  import('mysql2/promise')
    .then(mysql => {
      mysqlPool = mysql.createPool({
        uri: env.DATABASE_URL,
        waitForConnections: true,
        connectionLimit: 10,
        maxIdle: 10,
        idleTimeout: 60000,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
        ssl: {
          rejectUnauthorized: true,
        },
      });
    })
    .catch(err => {
      logError('App', 'Error message', {});
    });
}

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

// PostgreSQL implementation
class PostgresClient implements DbClient {
  private client: Pool;

  constructor(client: Pool) {
    this.client = client;
  }

  async query(sql: string, params?: any[]) {
    const result = await this.client.query(sql, params);
    return result.rows;
  }

  async queryOne(sql: string, params?: any[]) {
    const result = await this.client.query(sql, params);
    return result.rows[0];
  }

  async execute(sql: string, params?: any[]) {
    const result = await this.client.query(sql, params);
    return { rowCount: result.rowCount, rows: result.rows };
  }

  async transaction(callback: (client: DbClient) => Promise<void>) {
    const client = await this.client.connect();
    try {
      await client.query('BEGIN');
      await callback(new PostgresClient(client as any));
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

// MySQL implementation for Azure
class MySQLClient implements DbClient {
  private pool: any;

  constructor(pool: any) {
    this.pool = pool;
  }

  async query(sql: string, params?: any[]) {
    // Convert PostgreSQL placeholders ($1, $2) to MySQL (?, ?)
    const mysqlSql = sql.replace(/\$(\d+)/g, '?');
    const [rows] = await this.pool.execute(mysqlSql, params || []);
    return rows;
  }

  async queryOne(sql: string, params?: any[]) {
    const mysqlSql = sql.replace(/\$(\d+)/g, '?');
    const [rows] = await this.pool.execute(mysqlSql, params || []);
    return rows[0];
  }

  async execute(sql: string, params?: any[]) {
    const mysqlSql = sql.replace(/\$(\d+)/g, '?');
    const [result] = await this.pool.execute(mysqlSql, params || []);
    return {
      rowCount: result.affectedRows,
      insertId: result.insertId,
      changedRows: result.changedRows,
    };
  }

  async transaction(callback: (client: DbClient) => Promise<void>) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const client = new MySQLClient(connection);
      await callback(client);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
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
  if (DB_TYPE === 'postgres' && pgPool) {
    return new PostgresClient(pgPool);
  } else if (DB_TYPE === 'mysql' && mysqlPool) {
    return new MySQLClient(mysqlPool);
  } else if (DB_TYPE === 'sqlite' && sqliteDb) {
    return new SQLiteClient(sqliteDb);
  }

  // Fallback to SQLite if no database configured
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
  const db = getDb();
  const sql =
    DB_TYPE === 'postgres'
      ? `DELETE FROM audit_logs WHERE created_at < (CURRENT_TIMESTAMP - INTERVAL '90 days')`
      : `DELETE FROM audit_logs WHERE created_at < datetime('now', '-90 days')`;
  await db.execute(sql);
}

export default getDb;
