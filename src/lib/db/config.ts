/**
 * Database configuration for HIPAA-compliant storage
 * MIGRATED TO SUPABASE - PostgreSQL pools removed
 * Uses Supabase with built-in encryption and audit logging
 */

import { logError, logWarn, logInfo, logDebug } from '../../services/logger.service';
import { supabase } from '../supabase';
import { encryptPHI, decryptPHI } from '../security/encryption';

// Supabase configuration
// Connection pooling is handled automatically by Supabase
// No need for manual pool management

/**
 * Database helper functions - Supabase Edition
 */
export const db = {
  /**
   * Execute a query with proper error handling
   * NOTE: For Supabase, use query builder methods instead of raw SQL
   */
  async query(text: string, params?: any[]) {
    logWarn('DbConfig', 'Direct SQL queries deprecated. Use Supabase query builder or RPC functions.');
    throw new Error('Direct SQL queries not supported with Supabase. Use query builder or RPC.');
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
    try {
      const encryptedData = encryptPHI(JSON.stringify(data));

      const insertData = {
        patient_id: patientId,
        encrypted_data: encryptedData,
        updated_at: new Date().toISOString(),
        ...additionalFields,
      };

      // Use Supabase upsert (insert or update)
      const { data: result, error } = await supabase
        .from(table)
        .upsert(insertData, {
          onConflict: 'patient_id',
        })
        .select('id')
        .single();

      if (error) {
        logError('DbConfig', 'Failed to store encrypted PHI', { error, table });
        throw error;
      }

      return result.id;
    } catch (error) {
      logError('DbConfig', 'Error storing encrypted PHI', { error });
      throw error;
    }
  },

  /**
   * Retrieve and decrypt PHI data
   */
  async retrieveDecryptedPHI(table: string, patientId: string) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('patient_id', patientId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null;
        }
        logError('DbConfig', 'Failed to retrieve PHI', { error, table });
        throw error;
      }

      if (!data) {
        return null;
      }

      if (data.encrypted_data) {
        const decrypted = decryptPHI(data.encrypted_data);
        return {
          ...data,
          data: JSON.parse(decrypted),
        };
      }

      return data;
    } catch (error) {
      logError('DbConfig', 'Error retrieving PHI', { error });
      throw error;
    }
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
    try {
      const { error } = await supabase.from('audit_logs').insert({
        user_id: auditData.userId,
        user_role: auditData.userRole,
        action: auditData.action,
        resource_type: auditData.resourceType,
        resource_id: auditData.resourceId || null,
        ip_address: auditData.ipAddress || null,
        user_agent: auditData.userAgent || null,
        details: auditData.details || null,
        success: auditData.success !== false,
        created_at: new Date().toISOString(),
      });

      if (error) {
        logError('DbConfig', 'Failed to log audit event', { error });
        throw error;
      }
    } catch (error) {
      logError('DbConfig', 'Error logging audit', { error });
      throw error;
    }
  },

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions() {
    try {
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('sessions')
        .delete()
        .lt('expires_at', now)
        .select('id');

      if (error) {
        logError('DbConfig', 'Failed to cleanup sessions', { error });
        throw error;
      }

      return data?.length || 0;
    } catch (error) {
      logError('DbConfig', 'Error cleaning up sessions', { error });
      return 0;
    }
  },

  /**
   * Apply data retention policies
   */
  async applyRetentionPolicies() {
    try {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      // Get retention policies
      const { data: policies, error: fetchError } = await supabase
        .from('data_retention')
        .select('*')
        .or(`last_cleanup.is.null,last_cleanup.lt.${oneDayAgo.toISOString()}`);

      if (fetchError) {
        logError('DbConfig', 'Failed to fetch retention policies', { error: fetchError });
        return;
      }

      if (!policies || policies.length === 0) {
        return;
      }

      for (const policy of policies) {
        try {
          const retentionDate = new Date();
          retentionDate.setDate(retentionDate.getDate() - policy.retention_days);

          // Delete old records
          const { error: deleteError } = await supabase
            .from(policy.table_name)
            .delete()
            .lt('created_at', retentionDate.toISOString());

          if (deleteError) {
            logError('DbConfig', `Failed to apply retention policy for ${policy.table_name}`, {
              error: deleteError,
            });
            continue;
          }

          // Update last cleanup time
          await supabase
            .from('data_retention')
            .update({ last_cleanup: new Date().toISOString() })
            .eq('id', policy.id);

          logDebug('DbConfig', `Retention policy applied for ${policy.table_name}`, {});
        } catch (error) {
          logError('DbConfig', `Error applying retention policy for ${policy.table_name}`, {
            error,
          });
        }
      }
    } catch (error) {
      logError('DbConfig', 'Error in retention policy process', { error });
    }
  },

  /**
   * Initialize database with required checks
   */
  async initialize() {
    try {
      // Check if Supabase is accessible
      const { error } = await supabase.from('audit_logs').select('id').limit(1);

      if (error && error.code !== 'PGRST116') {
        // PGRST116 means no rows, which is fine
        throw error;
      }

      logDebug('DbConfig', 'Supabase connection verified', {});

      // Run cleanup tasks
      await this.cleanupExpiredSessions();

      // Schedule retention policy application (run daily)
      setInterval(
        () => {
          this.applyRetentionPolicies().catch(err =>
            logError('DbConfig', 'Retention policy error', { error: err })
          );
        },
        24 * 60 * 60 * 1000
      );

      return true;
    } catch (error) {
      logError('DbConfig', 'Database initialization failed', { error });
      return false;
    }
  },

  /**
   * Close database connections
   * NOTE: Supabase handles connections automatically, no need to close
   */
  async close() {
    logInfo('DbConfig', 'Supabase connections are managed automatically. No action needed.');
    // No action needed for Supabase
  },
};

// Export types for TypeScript
export type Database = typeof db;

// Export Supabase client for direct usage
export { supabase };
