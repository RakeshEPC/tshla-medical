/**
 * TSHLA Medical - Unified Supabase Service
 * Replaces unified-database.service.js (MySQL)
 * Single Supabase client for all APIs
 * Created: October 7, 2025
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

class UnifiedSupabaseService {
  constructor() {
    this.supabase = null;
    this.isInitialized = false;
  }

  /**
   * Get Supabase configuration from environment variables
   */
  getSupabaseConfig() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'Missing Supabase configuration. Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY)'
      );
    }

    return {
      url: supabaseUrl,
      key: supabaseKey,
    };
  }

  /**
   * Initialize the Supabase client
   */
  async initialize() {
    if (this.isInitialized) {
      return this.supabase;
    }

    try {
      const config = this.getSupabaseConfig();
      console.log('Unified Supabase Service: Initializing client...');
      console.log(`Connecting to: ${config.url}`);

      // Create Supabase client with service role key for server-side operations
      this.supabase = createClient(config.url, config.key, {
        auth: {
          autoRefreshToken: true,
          persistSession: false, // Server-side, no session persistence needed
        },
        db: {
          schema: 'public',
        },
      });

      // Test the connection
      await this.testConnection();

      this.isInitialized = true;
      console.log('Unified Supabase Service: Successfully initialized');
      return this.supabase;
    } catch (error) {
      console.error('Unified Supabase Service: Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Test Supabase connection
   */
  async testConnection() {
    try {
      // Try to select from a table to verify connection
      const { data, error } = await this.supabase.from('medical_staff').select('id').limit(1);

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows, which is fine
        throw error;
      }

      console.log('Unified Supabase Service: Connection test successful');
      return true;
    } catch (error) {
      console.error('Unified Supabase Service: Connection test failed:', error);
      throw error;
    }
  }

  /**
   * Get a table reference (replaces getConnection)
   * Usage: const table = await service.from('table_name');
   */
  from(tableName) {
    if (!this.isInitialized) {
      throw new Error('Supabase service not initialized. Call initialize() first.');
    }
    return this.supabase.from(tableName);
  }

  /**
   * Execute a query with automatic error handling
   * Replaces the old query() method
   */
  async query(tableName, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const {
      select = '*',
      where = {},
      orderBy = null,
      limit = null,
      single = false,
    } = options;

    try {
      let query = this.supabase.from(tableName).select(select);

      // Apply where conditions
      for (const [key, value] of Object.entries(where)) {
        if (value === null) {
          query = query.is(key, null);
        } else if (Array.isArray(value)) {
          query = query.in(key, value);
        } else if (typeof value === 'object' && value.operator) {
          // Advanced operator support
          switch (value.operator) {
            case 'gt':
              query = query.gt(key, value.value);
              break;
            case 'gte':
              query = query.gte(key, value.value);
              break;
            case 'lt':
              query = query.lt(key, value.value);
              break;
            case 'lte':
              query = query.lte(key, value.value);
              break;
            case 'like':
              query = query.like(key, value.value);
              break;
            case 'ilike':
              query = query.ilike(key, value.value);
              break;
            default:
              query = query.eq(key, value.value);
          }
        } else {
          query = query.eq(key, value);
        }
      }

      // Apply order by
      if (orderBy) {
        if (typeof orderBy === 'string') {
          query = query.order(orderBy);
        } else if (Array.isArray(orderBy)) {
          orderBy.forEach(({ column, ascending = true }) => {
            query = query.order(column, { ascending });
          });
        }
      }

      // Apply limit
      if (limit) {
        query = query.limit(limit);
      }

      // Execute query
      const { data, error } = single ? await query.single() : await query;

      if (error) {
        throw error;
      }

      return { rows: data, fields: null };
    } catch (error) {
      console.error(`Unified Supabase Service: Query failed for table ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Execute a query and return only the rows
   * Replaces the old execute() method
   */
  async execute(tableName, options = {}) {
    const result = await this.query(tableName, options);
    return result.rows;
  }

  /**
   * Insert data into a table
   */
  async insert(tableName, data) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const { data: result, error } = await this.supabase
        .from(tableName)
        .insert(data)
        .select();

      if (error) {
        throw error;
      }

      return { rows: result, insertId: result?.[0]?.id };
    } catch (error) {
      console.error(`Unified Supabase Service: Insert failed for table ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Update data in a table
   */
  async update(tableName, data, where = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      let query = this.supabase.from(tableName).update(data);

      // Apply where conditions
      for (const [key, value] of Object.entries(where)) {
        query = query.eq(key, value);
      }

      const { data: result, error } = await query.select();

      if (error) {
        throw error;
      }

      return { rows: result, affectedRows: result?.length || 0 };
    } catch (error) {
      console.error(`Unified Supabase Service: Update failed for table ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Delete data from a table
   */
  async delete(tableName, where = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      let query = this.supabase.from(tableName).delete();

      // Apply where conditions
      for (const [key, value] of Object.entries(where)) {
        query = query.eq(key, value);
      }

      const { data: result, error } = await query.select();

      if (error) {
        throw error;
      }

      return { rows: result, affectedRows: result?.length || 0 };
    } catch (error) {
      console.error(`Unified Supabase Service: Delete failed for table ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Execute RPC (Remote Procedure Call) for complex queries
   */
  async rpc(functionName, params = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const { data, error } = await this.supabase.rpc(functionName, params);

      if (error) {
        throw error;
      }

      return { rows: data };
    } catch (error) {
      console.error(`Unified Supabase Service: RPC failed for function ${functionName}:`, error);
      throw error;
    }
  }

  /**
   * Begin a transaction (simulated)
   * Note: Supabase doesn't support client-side transactions
   * For real transactions, use PostgreSQL functions via RPC
   */
  async beginTransaction() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    console.warn(
      'Unified Supabase Service: Client-side transactions not supported. Use PostgreSQL functions via RPC for atomic operations.'
    );

    // Return object with transaction-like methods
    return {
      supabase: this.supabase,
      async commit() {
        console.log('Transaction commit (no-op for Supabase)');
      },
      async rollback() {
        console.log('Transaction rollback (no-op for Supabase)');
      },
      async query(tableName, options) {
        return await unifiedSupabaseService.query(tableName, options);
      },
      async execute(tableName, options) {
        return await unifiedSupabaseService.execute(tableName, options);
      },
      async insert(tableName, data) {
        return await unifiedSupabaseService.insert(tableName, data);
      },
      async update(tableName, data, where) {
        return await unifiedSupabaseService.update(tableName, data, where);
      },
      async delete(tableName, where) {
        return await unifiedSupabaseService.delete(tableName, where);
      },
    };
  }

  /**
   * Get service status
   */
  getStatus() {
    if (!this.supabase) {
      return { status: 'not_initialized' };
    }

    return {
      status: 'active',
      connected: this.isInitialized,
      url: this.supabase.supabaseUrl,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      await this.testConnection();
      const status = this.getStatus();
      return {
        healthy: true,
        database: 'connected',
        service: status,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        healthy: false,
        database: 'disconnected',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Graceful shutdown
   * Note: Supabase handles cleanup automatically
   */
  async close() {
    console.log('Unified Supabase Service: Connections are managed automatically by Supabase.');
    this.isInitialized = false;
  }

  /**
   * Get direct Supabase client for advanced operations
   */
  getClient() {
    if (!this.isInitialized) {
      throw new Error('Supabase service not initialized. Call initialize() first.');
    }
    return this.supabase;
  }
}

// Create singleton instance
const unifiedSupabaseService = new UnifiedSupabaseService();

module.exports = unifiedSupabaseService;
