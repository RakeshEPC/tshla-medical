/**
 * TSHLA Medical Staff Authentication API
 * Handles registration and login for medical professionals only
 * Completely separate from PumpDrive authentication
 * Created: September 21, 2025
 */

// Load environment variables
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const unifiedDatabase = require('./services/unified-supabase.service');

const app = express();
const PORT = process.env.PORT || process.env.MEDICAL_AUTH_PORT || 3003;

// Middleware
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'https://www.tshla.ai', 'https://mango-sky-0ba265c0f.1.azurestaticapps.net'],
    credentials: true,
  })
);
// JSON parsing middleware with better error handling
app.use(express.json({
  limit: '10mb',
  strict: false,
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      console.log('JSON Parse Error:', e.message, 'Body:', buf.toString());
      throw e;
    }
  }
}));

// Using unified database service (no local configuration needed)

// Initialize database connection using unified service
async function initializeDatabase(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      // Initialize unified database service
      await unifiedDatabase.initialize();

      // Test the connection
      const health = await unifiedDatabase.healthCheck();
      if (!health.healthy) {
        throw new Error(`Database health check failed: ${health.error}`);
      }

      console.log('Medical Auth API: Unified database service connected successfully');
      return true;
    } catch (error) {
      console.error(`Medical Auth API: Database connection attempt ${i + 1} failed:`, error.message);
      if (i === retries - 1) {
        console.error('Medical Auth API: All database connection attempts failed');
        return false;
      }
      // Simple 3 second delay before retry
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  return false;
}

// JWT verification middleware
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || process.env.MEDICAL_JWT_SECRET || 'tshla-unified-jwt-secret-2025');
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Medical Auth: Token verification failed:', error);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Database status checking middleware
const checkDatabaseStatus = (req, res, next) => {
  if (!req.app.locals.dbConnected) {
    return res.status(503).json({
      error: 'Database service unavailable',
      message: 'Medical database is currently unavailable. Please try again in a few moments.',
      status: 'degraded'
    });
  }
  next();
};

// ====== MEDICAL STAFF REGISTRATION ENDPOINT ======

/**
 * Register new medical staff account
 * POST /api/medical/register
 */
app.post('/api/medical/register', checkDatabaseStatus, async (req, res) => {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      role = 'doctor',
      practice,
      specialty
    } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format'
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters long'
      });
    }

    if (!/[A-Z]/.test(password)) {
      return res.status(400).json({
        error: 'Password must contain at least 1 uppercase letter'
      });
    }

    if (!/[a-z]/.test(password)) {
      return res.status(400).json({
        error: 'Password must contain at least 1 lowercase letter'
      });
    }

    if (!/[0-9]/.test(password)) {
      return res.status(400).json({
        error: 'Password must contain at least 1 number'
      });
    }

    // Validate role
    const validRoles = ['doctor', 'nurse', 'staff', 'medical_assistant', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        error: 'Invalid role. Must be one of: doctor, nurse, staff, medical_assistant, admin'
      });
    }

    // Generate username if not provided
    const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9._]/g, '');

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const connection = await unifiedDatabase.getConnection();
    try {
      // Check if email already exists
      const [existingUsers] = await connection.execute(
        'SELECT email FROM medical_staff WHERE email = ?',
        [email.toLowerCase()]
      );

      if (existingUsers.length > 0) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      // Create medical staff account
      const [userResult] = await connection.execute(
        `INSERT INTO medical_staff (
          email, username, password_hash, first_name, last_name,
          role, practice, specialty
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [email.toLowerCase(), username, passwordHash, firstName || null, lastName || null, role, practice || null, specialty || null]
      );

      const userId = userResult.insertId;

      console.log('Medical staff registered successfully:', {
        userId,
        email: email.toLowerCase(),
        role
      });

      res.json({
        success: true,
        message: 'Medical staff account created successfully',
        user: {
          id: userId,
          email: email.toLowerCase(),
          username,
          firstName,
          lastName,
          role,
          practice,
          specialty
        }
      });

    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Medical staff registration failed:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: error.message
    });
  }
});

// ====== MEDICAL STAFF LOGIN ENDPOINT ======

/**
 * Medical staff login
 * POST /api/medical/login
 */
app.post('/api/medical/login', checkDatabaseStatus, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    const connection = await unifiedDatabase.getConnection();
    try {
      const [users] = await connection.execute(
        `SELECT id, email, username, password_hash, first_name, last_name,
                role, practice, specialty, is_active
         FROM medical_staff WHERE email = ?`,
        [email.toLowerCase()]
      );

      if (users.length === 0) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const user = users[0];

      if (!user.is_active) {
        return res.status(401).json({ error: 'Account is deactivated' });
      }

      // Verify password
      const passwordValid = await bcrypt.compare(password, user.password_hash);
      if (!passwordValid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Update login tracking
      await connection.execute(
        'UPDATE medical_staff SET last_login = NOW(), login_count = login_count + 1 WHERE id = ?',
        [user.id]
      );

      // Generate JWT token (separate from PumpDrive)
      const jwtSecret = process.env.JWT_SECRET || process.env.MEDICAL_JWT_SECRET || 'tshla-unified-jwt-secret-2025';
      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          accessType: 'medical'
        },
        jwtSecret,
        { expiresIn: '8h' } // 8 hour sessions for medical staff
      );

      res.json({
        success: true,
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          practice: user.practice,
          specialty: user.specialty,
          accessType: 'medical'
        },
        token
      });

    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Medical staff login failed:', error);
    res.status(500).json({
      error: 'Login failed',
      message: error.message
    });
  }
});

// ====== TOKEN VERIFICATION ENDPOINT ======

/**
 * Verify medical staff token
 * GET /api/medical/verify
 */
app.get('/api/medical/verify', verifyToken, async (req, res) => {
  try {
    const connection = await unifiedDatabase.getConnection();
    try {
      const [users] = await connection.execute(
        `SELECT id, email, username, first_name, last_name,
                role, practice, specialty, is_active
         FROM medical_staff WHERE id = ?`,
        [req.user.userId]
      );

      if (users.length === 0 || !users[0].is_active) {
        return res.status(401).json({ error: 'User not found or inactive' });
      }

      const user = users[0];

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          practice: user.practice,
          specialty: user.specialty,
          accessType: 'medical'
        }
      });

    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Medical staff token verification failed:', error);
    res.status(500).json({
      error: 'Token verification failed',
      message: error.message
    });
  }
});

// ====== HEALTH CHECK ENDPOINT ======

/**
 * Health check endpoint
 * GET /api/medical/health
 */
app.get('/api/medical/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'medical-auth-api',
    version: '1.0.0',
    uptime: process.uptime(),
    services: {},
    environment: {
      dbConnected: req.app.locals.dbConnected || false
    }
  };

  let overallStatus = 'ok';

  // Check database connectivity
  try {
    if (unifiedDatabase && req.app.locals.dbConnected) {
      const connection = await unifiedDatabase.getConnection();
      await connection.ping();
      connection.release();
      health.services.database = {
        status: 'healthy',
        connected: true,
        host: process.env.DB_HOST
      };
    } else {
      throw new Error('Database not connected or unified service not initialized');
    }
  } catch (error) {
    overallStatus = 'degraded';
    health.services.database = {
      status: 'unhealthy',
      connected: false,
      error: error.message,
      host: process.env.DB_HOST
    };
  }

  // Check JWT configuration
  const jwtSecret = process.env.JWT_SECRET || process.env.MEDICAL_JWT_SECRET;
  const crypto = require('crypto');
  if (jwtSecret && jwtSecret.length >= 32) {
    // Create hash of JWT secret for verification (first 16 chars)
    const secretHash = crypto.createHash('sha256').update(jwtSecret).digest('hex').substring(0, 16);
    health.services.jwt = {
      status: 'configured',
      configured: true,
      secretHash: secretHash // For cross-API verification
    };
  } else {
    overallStatus = 'degraded';
    health.services.jwt = {
      status: 'misconfigured',
      configured: false,
      error: 'JWT secret missing or too short'
    };
  }

  health.status = overallStatus;
  const statusCode = overallStatus === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

// ====== API INFO ENDPOINT ======

/**
 * API info endpoint
 * GET /api/medical/info
 */
app.get('/api/medical/info', (req, res) => {
  res.json({
    name: 'TSHLA Medical Staff Authentication API',
    version: '1.0.0',
    description: 'Authentication service for medical professionals - separate from PumpDrive',
    endpoints: {
      auth: [
        'POST /api/medical/register',
        'POST /api/medical/login',
        'GET /api/medical/verify',
      ],
      system: ['GET /api/medical/health', 'GET /api/medical/info'],
    },
  });
});

// Enhanced error handling middleware
app.use((error, req, res, next) => {
  console.error('Medical Auth API Error:', error.message);

  // Handle JSON parsing errors
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Invalid JSON format',
      message: 'Request body contains invalid JSON. Please check your request format.',
      service: 'Medical Staff Authentication'
    });
  }

  // Handle database connection errors
  if (error.code === 'ECONNREFUSED' || error.code === 'PROTOCOL_CONNECTION_LOST' || error.code === 'ER_ACCESS_DENIED_ERROR') {
    return res.status(503).json({
      error: 'Database service unavailable',
      message: 'Medical database is temporarily unavailable. Please try again in a few moments.',
      service: 'Medical Staff Authentication'
    });
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Authentication failed',
      message: 'Invalid or expired token. Please log in again.',
      service: 'Medical Staff Authentication'
    });
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      message: error.message,
      service: 'Medical Staff Authentication'
    });
  }

  // Default error response
  res.status(500).json({
    error: 'Internal server error',
    message: 'An unexpected error occurred. Please try again.',
    service: 'Medical Staff Authentication'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    service: 'Medical Staff Authentication'
  });
});

// Initialize and start server
async function startServer() {
  console.log('Medical Auth API: Starting server...');

  // Initialize database
  const dbConnected = await initializeDatabase();
  if (!dbConnected) {
    console.error('Medical Auth API: Database connection failed - starting in degraded mode');
    app.locals.dbConnected = false;
  } else {
    app.locals.dbConnected = true;
  }

  // Start server
  app.listen(PORT, () => {
    console.log(`Medical Auth API: Server running on port ${PORT}`);
    console.log(`Medical Auth API: Health check at http://localhost:${PORT}/api/medical/health`);
    console.log(`Medical Auth API: Registration at http://localhost:${PORT}/api/medical/register`);
    console.log(`Medical Auth API: Login at http://localhost:${PORT}/api/medical/login`);

    // Start database connection monitoring
    startDatabaseMonitoring();
  });
}

// Database connection monitoring and recovery
function startDatabaseMonitoring() {
  console.log('Medical Auth API: Starting database connection monitoring...');

  // Check database connection every 30 seconds
  setInterval(async () => {
    try {
      if (unifiedDatabase) {
        const connection = await unifiedDatabase.getConnection();
        await connection.ping();
        connection.release();

        // If we're here, database is healthy
        if (!app.locals.dbConnected) {
          console.log('Medical Auth API: Database connection restored');
          app.locals.dbConnected = true;
        }
      }
    } catch (error) {
      if (app.locals.dbConnected) {
        console.error('Medical Auth API: Database connection lost:', error.message);
        app.locals.dbConnected = false;
      }

      // Attempt to reconnect
      try {
        const reconnected = await initializeDatabase();
        if (reconnected) {
          console.log('Medical Auth API: Database reconnection successful');
          app.locals.dbConnected = true;
        }
      } catch (reconnectError) {
        console.error('Medical Auth API: Database reconnection failed:', reconnectError.message);
      }
    }
  }, 30000); // Check every 30 seconds
}

// Start the server
if (require.main === module) {
  startServer().catch(console.error);
}

module.exports = app;