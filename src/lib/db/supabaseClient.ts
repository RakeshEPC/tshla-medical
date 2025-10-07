/**
 * Supabase Database Client Wrapper
 * Provides a unified interface similar to the old MySQL client
 * Makes migration easier by maintaining backward compatibility
 */

import { supabase } from '../supabase';
import { logError, logWarn, logInfo, logDebug } from '../../services/logger.service';
import crypto from 'crypto';

// Database interface (backward compatible with old MySQL client)
export interface DbClient {
  query: (sql: string, params?: any[]) => Promise<any>;
  queryOne: (sql: string, params?: any[]) => Promise<any>;
  execute: (sql: string, params?: any[]) => Promise<any>;
  transaction: (callback: (client: DbClient) => Promise<void>) => Promise<void>;
}

/**
 * Supabase Client Implementation
 * Wraps Supabase queries to match the old MySQL interface
 */
class SupabaseDbClient implements DbClient {
  /**
   * Execute a query and return all rows
   * For backward compatibility with MySQL queries
   */
  async query(sql: string, params?: any[]): Promise<any> {
    try {
      // Note: Supabase doesn't support raw SQL from client
      // This is a placeholder for legacy compatibility
      // Real implementation should use Supabase query builder
      logWarn('SupabaseClient', 'Raw SQL queries not supported. Use Supabase query builder instead.', { sql });
      throw new Error('Raw SQL queries not supported in Supabase client. Use supabase.from() instead.');
    } catch (error) {
      logError('SupabaseClient', 'Query failed', { error, sql });
      throw error;
    }
  }

  /**
   * Execute a query and return first row
   */
  async queryOne(sql: string, params?: any[]): Promise<any> {
    const results = await this.query(sql, params);
    return results?.[0];
  }

  /**
   * Execute a statement (INSERT, UPDATE, DELETE)
   */
  async execute(sql: string, params?: any[]): Promise<any> {
    return await this.query(sql, params);
  }

  /**
   * Execute multiple queries in a transaction
   * Note: Supabase doesn't support client-side transactions
   * This is a best-effort implementation
   */
  async transaction(callback: (client: DbClient) => Promise<void>): Promise<void> {
    try {
      // Execute callback with this client
      // Note: No actual transaction support on client-side
      await callback(this);
    } catch (error) {
      logError('SupabaseClient', 'Transaction failed', { error });
      throw error;
    }
  }
}

/**
 * Helper: Direct Supabase table access (recommended approach)
 */
export const db = {
  /**
   * Get table reference for query building
   */
  from: (table: string) => supabase.from(table),

  /**
   * Insert data into a table
   */
  async insert(table: string, data: any | any[]) {
    const { data: result, error } = await supabase
      .from(table)
      .insert(data)
      .select();

    if (error) {
      logError('SupabaseClient', `Insert failed for table ${table}`, { error });
      throw error;
    }

    return result;
  },

  /**
   * Update data in a table
   */
  async update(table: string, data: any, where: Record<string, any>) {
    let query = supabase.from(table).update(data);

    // Apply where conditions
    for (const [key, value] of Object.entries(where)) {
      query = query.eq(key, value);
    }

    const { data: result, error } = await query.select();

    if (error) {
      logError('SupabaseClient', `Update failed for table ${table}`, { error });
      throw error;
    }

    return result;
  },

  /**
   * Delete data from a table
   */
  async delete(table: string, where: Record<string, any>) {
    let query = supabase.from(table).delete();

    // Apply where conditions
    for (const [key, value] of Object.entries(where)) {
      query = query.eq(key, value);
    }

    const { data: result, error } = await query;

    if (error) {
      logError('SupabaseClient', `Delete failed for table ${table}`, { error });
      throw error;
    }

    return result;
  },

  /**
   * Select data from a table
   */
  async select(table: string, columns: string = '*', where?: Record<string, any>) {
    let query = supabase.from(table).select(columns);

    // Apply where conditions if provided
    if (where) {
      for (const [key, value] of Object.entries(where)) {
        query = query.eq(key, value);
      }
    }

    const { data, error } = await query;

    if (error) {
      logError('SupabaseClient', `Select failed for table ${table}`, { error });
      throw error;
    }

    return data;
  },

  /**
   * Select single row from a table
   */
  async selectOne(table: string, columns: string = '*', where?: Record<string, any>) {
    let query = supabase.from(table).select(columns);

    // Apply where conditions if provided
    if (where) {
      for (const [key, value] of Object.entries(where)) {
        query = query.eq(key, value);
      }
    }

    const { data, error } = await query.single();

    if (error) {
      logError('SupabaseClient', `SelectOne failed for table ${table}`, { error });
      throw error;
    }

    return data;
  },

  /**
   * Execute RPC (Remote Procedure Call) - for complex queries
   */
  async rpc(functionName: string, params?: Record<string, any>) {
    const { data, error } = await supabase.rpc(functionName, params);

    if (error) {
      logError('SupabaseClient', `RPC failed for function ${functionName}`, { error });
      throw error;
    }

    return data;
  },

  /**
   * Count rows in a table
   */
  async count(table: string, where?: Record<string, any>) {
    let query = supabase.from(table).select('*', { count: 'exact', head: true });

    // Apply where conditions if provided
    if (where) {
      for (const [key, value] of Object.entries(where)) {
        query = query.eq(key, value);
      }
    }

    const { count, error } = await query;

    if (error) {
      logError('SupabaseClient', `Count failed for table ${table}`, { error });
      throw error;
    }

    return count || 0;
  },
};

// Export the old interface for backward compatibility (limited functionality)
export function getDb(): DbClient {
  return new SupabaseDbClient();
}

// Helper to generate UUID (for compatibility)
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

// Auto-delete expired charts (run daily) - using Supabase
export async function deleteExpiredCharts() {
  try {
    const { error } = await supabase
      .from('patient_charts')
      .update({ deleted_at: new Date().toISOString() })
      .is('deleted_at', null)
      .lt('expires_at', new Date().toISOString());

    if (error) throw error;

    logInfo('SupabaseClient', 'Expired charts deleted successfully');
  } catch (error) {
    logError('SupabaseClient', 'Failed to delete expired charts', { error });
  }
}

// Cleanup old audit logs (run weekly) - using Supabase
export async function cleanupAuditLogs() {
  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { error } = await supabase
      .from('audit_logs')
      .delete()
      .lt('created_at', ninetyDaysAgo.toISOString());

    if (error) throw error;

    logInfo('SupabaseClient', 'Old audit logs cleaned up successfully');
  } catch (error) {
    logError('SupabaseClient', 'Failed to cleanup audit logs', { error });
  }
}

export default db;
