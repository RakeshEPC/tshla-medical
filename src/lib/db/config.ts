/**
import { env } from "../config/environment";
import { logError, logWarn, logInfo, logDebug } from '../../services/logger.service';
 * Database configuration for HIPAA-compliant storage
 * Uses PostgreSQL with encryption and audit logging
 */

import { Pool, PoolConfig } from 'pg';
import { encryptPHI, decryptPHI } from '../security/encryption';

// Database connection configuration
const dbConfig: PoolConfig = {
  host: env.DB_HOST || 'localhost',
  port: parseInt(env.DB_PORT || '5432'),
  database: env.DB_NAME || 'hipaa_medical',
  user: env.DB_USER || 'hipaa_user',
  password: env.DB_PASSWORD || '',
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl:
    env.NODE_ENV === 'production'
      ? {
          rejectUnauthorized: true,
          ca: env.DB_SSL_CA,
        }
      : false,
};

// Create connection pool
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool(dbConfig);

    // Handle pool errors
    pool.on('error', err => {
      logError('App', 'Error message', {});
    });
  }

  return pool;
}

/**
 * Database helper functions
 */
export const db = {
  /**
   * Execute a query with proper error handling
   */
  async query(text: string, params?: any[]) {
    const pool = getPool();
    const start = Date.now();

    try {
      const result = await pool.query(text, params);
      const duration = Date.now() - start;

      // Log slow queries in development
      if (env.NODE_ENV === 'development' && duration > 1000) {
        logDebug('App', 'Debug message', {});
      }

      return result;
    } catch (error) {
      logError('App', 'Error message', {});
      throw error;
    }
  },

  /**
   * Store encrypted PHI data
   */
  async storeEncryptedPHI(
    table: string,
    patientId: string,
    data: any,
    additionalFields?: Record<string, any>
  ) {
    const encryptedData = encryptPHI(JSON.stringify(data));

    const fields = ['patient_id', 'encrypted_data', ...Object.keys(additionalFields || {})];
    const values = [patientId, encryptedData, ...Object.values(additionalFields || {})];
    const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');

    const query = `
      INSERT INTO ${table} (${fields.join(', ')})
      VALUES (${placeholders})
      ON CONFLICT (patient_id) 
      DO UPDATE SET 
        encrypted_data = EXCLUDED.encrypted_data,
        updated_at = NOW()
      RETURNING id
    `;

    const result = await this.query(query, values);
    return result.rows[0].id;
  },

  /**
   * Retrieve and decrypt PHI data
   */
  async retrieveDecryptedPHI(table: string, patientId: string) {
    const query = `
      SELECT * FROM ${table}
      WHERE patient_id = $1
    `;

    const result = await this.query(query, [patientId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    if (row.encrypted_data) {
      const decrypted = decryptPHI(row.encrypted_data);
      return {
        ...row,
        data: JSON.parse(decrypted),
      };
    }

    return row;
  },

  /**
   * Log audit event
   */
  async logAudit(auditData: {
    userId: string;
    userRole: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    ipAddress?: string;
    userAgent?: string;
    details?: any;
    success?: boolean;
  }) {
    const query = `
      INSERT INTO audit_logs (
        user_id, user_role, action, resource_type, resource_id,
        ip_address, user_agent, details, success
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    await this.query(query, [
      auditData.userId,
      auditData.userRole,
      auditData.action,
      auditData.resourceType,
      auditData.resourceId || null,
      auditData.ipAddress || null,
      auditData.userAgent || null,
      auditData.details ? JSON.stringify(auditData.details) : null,
      auditData.success !== false,
    ]);
  },

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions() {
    const query = `
      DELETE FROM sessions
      WHERE expires_at < NOW()
    `;

    const result = await this.query(query);
    return result.rowCount;
  },

  /**
   * Apply data retention policies
   */
  async applyRetentionPolicies() {
    const policiesQuery = `
      SELECT * FROM data_retention
      WHERE last_cleanup IS NULL 
      OR last_cleanup < NOW() - INTERVAL '1 day'
    `;

    const policies = await this.query(policiesQuery);

    for (const policy of policies.rows) {
      const deleteQuery = `
        DELETE FROM ${policy.table_name}
        WHERE created_at < NOW() - INTERVAL '${policy.retention_days} days'
      `;

      try {
        const result = await this.query(deleteQuery);

        // Update last cleanup time
        await this.query('UPDATE data_retention SET last_cleanup = NOW() WHERE id = $1', [
          policy.id,
        ]);

        logDebug('App', 'Debug message', {});
      } catch (error) {
        logError('App', 'Error message', {});
      }
    }
  },

  /**
   * Initialize database with required tables
   */
  async initialize() {
    try {
      // Check if database is accessible
      await this.query('SELECT NOW()');
      logDebug('App', 'Debug message', {});

      // Run cleanup tasks
      await this.cleanupExpiredSessions();

      // Schedule retention policy application (run daily)
      setInterval(
        () => {
          this.applyRetentionPolicies().catch(console.error);
        },
        24 * 60 * 60 * 1000
      );

      return true;
    } catch (error) {
      logError('App', 'Error message', {});
      return false;
    }
  },

  /**
   * Close database connections
   */
  async close() {
    if (pool) {
      await pool.end();
      pool = null;
    }
  },
};

// Export types for TypeScript
export type Database = typeof db;
