/**
 * TSHLA Medical - Unified Database Service
 * Single connection pool service for all APIs
 * Replaces duplicate database connections across multiple API servers
 * Created: September 24, 2025
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

class UnifiedDatabaseService {
  constructor() {
    this.pool = null;
    this.isInitialized = false;
  }

  /**
   * Get database configuration from environment variables
   * Uses standard DB_* environment variables
   */
  getDbConfig() {
    return {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_DATABASE || 'tshla_medical_local',
      ssl: process.env.DB_SSL === 'true' ? {
        rejectUnauthorized: false,
        require: true,
      } : false,
      timezone: 'Z',
      connectTimeout: 60000,
      acquireTimeout: 60000,
      timeout: 60000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      // Optimized connection pool settings
      connectionLimit: 20, // Increased for multiple API servers
      queueLimit: 0,
      waitForConnections: true,
      idleTimeout: 300000, // 5 minutes
      maxIdle: 10,
      // Additional MySQL settings
      charset: 'utf8mb4',
      supportBigNumbers: true,
      bigNumberStrings: true,
      dateStrings: false,
      debug: false,
      reconnect: true
    };
  }

  /**
   * Initialize the database connection pool
   */
  async initialize() {
    if (this.isInitialized) {
      return this.pool;
    }

    try {
      const config = this.getDbConfig();
      console.log('Unified Database Service: Initializing connection pool...');
      console.log(`Connecting to: ${config.host}:${config.port}/${config.database}`);
      console.log(`SSL enabled: ${config.ssl ? 'Yes' : 'No'}`);

      this.pool = mysql.createPool(config);

      // Add comprehensive error handling
      this.pool.on('error', (err) => {
        console.error('Unified Database Service: Pool error:', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
          console.log('Unified Database Service: Connection lost, pool will reconnect automatically');
        } else if (err.code === 'ER_CON_COUNT_ERROR') {
          console.error('Unified Database Service: Too many connections');
        } else if (err.code === 'ECONNREFUSED') {
          console.error('Unified Database Service: Database connection refused');
        }
      });

      this.pool.on('connection', (connection) => {
        console.log(`Unified Database Service: New connection established as id ${connection.threadId}`);
      });

      this.pool.on('acquire', (connection) => {
        console.log(`Unified Database Service: Connection ${connection.threadId} acquired`);
      });

      this.pool.on('release', (connection) => {
        console.log(`Unified Database Service: Connection ${connection.threadId} released`);
      });

      // Test the connection
      await this.testConnection();

      this.isInitialized = true;
      console.log('Unified Database Service: Successfully initialized');
      return this.pool;

    } catch (error) {
      console.error('Unified Database Service: Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Test database connection
   */
  async testConnection() {
    try {
      const connection = await this.pool.getConnection();
      const [rows] = await connection.execute('SELECT 1 as test');
      connection.release();
      console.log('Unified Database Service: Database connection test successful');
      return true;
    } catch (error) {
      console.error('Unified Database Service: Connection test failed:', error);
      throw error;
    }
  }

  /**
   * Get a connection from the pool
   */
  async getConnection() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return await this.pool.getConnection();
  }

  /**
   * Execute a query with automatic connection management
   */
  async query(sql, params = []) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const connection = await this.pool.getConnection();
    try {
      const [rows, fields] = await connection.execute(sql, params);
      return { rows, fields };
    } finally {
      connection.release();
    }
  }

  /**
   * Execute a query and return only the rows
   */
  async execute(sql, params = []) {
    const result = await this.query(sql, params);
    return result.rows;
  }

  /**
   * Begin a transaction
   */
  async beginTransaction() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const connection = await this.pool.getConnection();
    await connection.beginTransaction();

    // Return connection with transaction methods
    return {
      connection,
      async commit() {
        await connection.commit();
        connection.release();
      },
      async rollback() {
        await connection.rollback();
        connection.release();
      },
      async query(sql, params = []) {
        const [rows, fields] = await connection.execute(sql, params);
        return { rows, fields };
      },
      async execute(sql, params = []) {
        const [rows] = await connection.execute(sql, params);
        return rows;
      }
    };
  }

  /**
   * Get pool status
   */
  getPoolStatus() {
    if (!this.pool) {
      return { status: 'not_initialized' };
    }

    try {
      return {
        status: 'active',
        totalConnections: this.pool.pool._allConnections ? this.pool.pool._allConnections.length : 0,
        freeConnections: this.pool.pool._freeConnections ? this.pool.pool._freeConnections.length : 0,
        queuedRequests: this.pool.pool._connectionQueue ? this.pool.pool._connectionQueue.length : 0,
        acquiredConnections: this.pool.pool._acquiredConnections ? this.pool.pool._acquiredConnections.length : 0
      };
    } catch (error) {
      return {
        status: 'active',
        message: 'Pool status not available',
        error: error.message
      };
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      await this.testConnection();
      const status = this.getPoolStatus();
      return {
        healthy: true,
        database: 'connected',
        pool: status,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        healthy: false,
        database: 'disconnected',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Graceful shutdown
   */
  async close() {
    if (this.pool) {
      console.log('Unified Database Service: Closing connection pool...');
      await this.pool.end();
      this.isInitialized = false;
      console.log('Unified Database Service: Connection pool closed');
    }
  }
}

// Create singleton instance
const unifiedDatabaseService = new UnifiedDatabaseService();

module.exports = unifiedDatabaseService;