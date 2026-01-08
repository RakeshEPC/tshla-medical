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
const MFAService = require('./services/mfa.service');
const logger = require('./logger');

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
      logger.error('MedicalAuth', 'JSON parse error', { error: e.message });
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

      logger.info('MedicalAuth', 'Unified database service connected successfully');
      return true;
    } catch (error) {
      logger.error('MedicalAuth', `Database connection attempt ${i + 1} failed`, { error: error.message });
      if (i === retries - 1) {
        logger.error('MedicalAuth', 'All database connection attempts failed');
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
    logger.error('MedicalAuth', 'Token verification failed', { error: error.message });
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

    // Initialize Supabase
    await unifiedDatabase.initialize();

    // Check if email already exists
    const { data: existingUsers, error: searchError } = await unifiedDatabase
      .from('medical_staff')
      .select('email')
      .eq('email', email.toLowerCase());

    if (searchError) {
      throw searchError;
    }

    if (existingUsers && existingUsers.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Create medical staff account
    const { data: newUser, error: insertError } = await unifiedDatabase
      .from('medical_staff')
      .insert({
        email: email.toLowerCase(),
        username,
        password_hash: passwordHash,
        first_name: firstName || null,
        last_name: lastName || null,
        role,
        practice: practice || null,
        specialty: specialty || null
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    const userId = newUser.id;

    logger.info('MedicalAuth', 'Medical staff registered successfully', {
      userId,
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
  } catch (error) {
    logger.error('MedicalAuth', 'Medical staff registration failed', { error: error.message });
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

    // Initialize Supabase
    await unifiedDatabase.initialize();

    // Get user by email
    const { data: users, error: searchError } = await unifiedDatabase
      .from('medical_staff')
      .select('id, email, username, password_hash, first_name, last_name, role, practice, specialty, is_active, mfa_enabled')
      .eq('email', email.toLowerCase());

    if (searchError) {
      throw searchError;
    }

    if (!users || users.length === 0) {
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

    // Phase 4: Check if MFA is enabled for medical staff
    if (user.mfa_enabled) {
      return res.json({
        success: true,
        mfaRequired: true,
        userId: user.id,
        accessType: 'medical',
        message: 'Please enter your 6-digit authentication code'
      });
    }

    // Update login tracking
    const { error: updateError } = await unifiedDatabase
      .from('medical_staff')
      .update({
        last_login: new Date().toISOString(),
        login_count: user.login_count ? user.login_count + 1 : 1
      })
      .eq('id', user.id);

    if (updateError) {
      logger.warn('MedicalAuth', 'Failed to update login tracking', { error: updateError.message });
      // Don't fail login if tracking update fails
    }

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
  } catch (error) {
    logger.error('MedicalAuth', 'Medical staff login failed', { error: error.message });
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
    // Initialize Supabase
    await unifiedDatabase.initialize();

    // Get user by ID
    const { data: users, error: searchError } = await unifiedDatabase
      .from('medical_staff')
      .select('id, email, username, first_name, last_name, role, practice, specialty, is_active')
      .eq('id', req.user.userId);

    if (searchError) {
      throw searchError;
    }

    if (!users || users.length === 0 || !users[0].is_active) {
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
  } catch (error) {
    logger.error('MedicalAuth', 'Medical staff token verification failed', { error: error.message });
    res.status(500).json({
      error: 'Token verification failed',
      message: error.message
    });
  }
});

// ====== MEDICAL STAFF MFA ENDPOINTS ======

/**
 * Setup MFA for medical staff
 * POST /api/medical/mfa/setup
 */
app.post('/api/medical/mfa/setup', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userEmail = req.user.email;

    // Generate MFA setup (QR code, secret, backup codes)
    const setup = await MFAService.generateMFASetup(userId, userEmail, 'medical_staff');

    res.json({
      success: true,
      qrCodeUrl: setup.qrCodeUrl,
      secret: setup.secret,
      backupCodes: setup.backupCodes,
      message: 'Scan the QR code with Google Authenticator or Authy'
    });
  } catch (error) {
    logger.error('MedicalAuth', 'MFA setup failed', { error: error.message });
    res.status(500).json({
      error: 'MFA setup failed',
      message: error.message
    });
  }
});

/**
 * Enable MFA for medical staff (after verification)
 * POST /api/medical/mfa/enable
 */
app.post('/api/medical/mfa/enable', verifyToken, async (req, res) => {
  try {
    const { secret, token, backupCodes } = req.body;
    const userId = req.user.userId;

    if (!secret || !token || !backupCodes) {
      return res.status(400).json({
        error: 'Secret, token, and backup codes are required'
      });
    }

    // Enable MFA (verifies token before enabling)
    const result = await MFAService.enableMFA(userId, secret, token, backupCodes, 'medical_staff');

    if (!result.success) {
      return res.status(400).json({
        error: result.error || 'Failed to enable MFA'
      });
    }

    res.json({
      success: true,
      message: 'MFA enabled successfully',
      backupCodesRemaining: backupCodes.length
    });
  } catch (error) {
    logger.error('MedicalAuth', 'MFA enable failed', { error: error.message });
    res.status(500).json({
      error: 'Failed to enable MFA',
      message: error.message
    });
  }
});

/**
 * Verify MFA code during login (medical staff)
 * POST /api/medical/mfa/verify
 */
app.post('/api/medical/mfa/verify', async (req, res) => {
  try {
    const { userId, token, useBackupCode } = req.body;

    if (!userId || !token) {
      return res.status(400).json({
        error: 'User ID and token are required'
      });
    }

    // Verify MFA code
    let isValid;
    if (useBackupCode) {
      isValid = await MFAService.verifyBackupCode(userId, token, 'medical_staff');
    } else {
      isValid = await MFAService.verifyTOTP(userId, token, 'medical_staff');
    }

    if (!isValid) {
      return res.status(401).json({
        error: 'Invalid authentication code'
      });
    }

    // Get user details
    await unifiedDatabase.initialize();
    const { data: users } = await unifiedDatabase
      .from('medical_staff')
      .select('id, email, username, first_name, last_name, role, practice, specialty')
      .eq('id', userId)
      .single();

    if (!users) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users;

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET || process.env.MEDICAL_JWT_SECRET || 'tshla-unified-jwt-secret-2025';
    const jwtToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        accessType: 'medical',
        mfaVerified: true
      },
      jwtSecret,
      { expiresIn: '8h' }
    );

    res.json({
      success: true,
      token: jwtToken,
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
  } catch (error) {
    logger.error('MedicalAuth', 'MFA verification failed', { error: error.message });
    res.status(500).json({
      error: 'MFA verification failed',
      message: error.message
    });
  }
});

/**
 * Disable MFA for medical staff
 * POST /api/medical/mfa/disable
 */
app.post('/api/medical/mfa/disable', verifyToken, async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.user.userId;

    if (!password) {
      return res.status(400).json({
        error: 'Password is required to disable MFA'
      });
    }

    // Verify password before disabling MFA
    await unifiedDatabase.initialize();
    const { data: users } = await unifiedDatabase
      .from('medical_staff')
      .select('password_hash')
      .eq('id', userId)
      .single();

    if (!users) {
      return res.status(404).json({ error: 'User not found' });
    }

    const passwordValid = await bcrypt.compare(password, users.password_hash);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Disable MFA
    const result = await MFAService.disableMFA(userId, password, 'medical_staff');

    if (!result.success) {
      return res.status(400).json({
        error: result.error || 'Failed to disable MFA'
      });
    }

    res.json({
      success: true,
      message: 'MFA disabled successfully'
    });
  } catch (error) {
    logger.error('MedicalAuth', 'MFA disable failed', { error: error.message });
    res.status(500).json({
      error: 'Failed to disable MFA',
      message: error.message
    });
  }
});

/**
 * Get MFA status for medical staff
 * GET /api/medical/mfa/status
 */
app.get('/api/medical/mfa/status', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const status = await MFAService.getMFAStatus(userId, 'medical_staff');

    res.json({
      success: true,
      mfaEnabled: status.mfaEnabled,
      backupCodesRemaining: status.backupCodesRemaining,
      mfaEnabledAt: status.mfaEnabledAt,
      lastUsedAt: status.lastUsedAt
    });
  } catch (error) {
    logger.error('MedicalAuth', 'Failed to get MFA status', { error: error.message });
    res.status(500).json({
      error: 'Failed to get MFA status',
      message: error.message
    });
  }
});

/**
 * Check if MFA is required for a medical staff email
 * POST /api/medical/mfa/check-required
 */
app.post('/api/medical/mfa/check-required', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Email is required'
      });
    }

    await unifiedDatabase.initialize();
    const { data: users } = await unifiedDatabase
      .from('medical_staff')
      .select('id, mfa_enabled')
      .eq('email', email.toLowerCase())
      .eq('is_active', true);

    if (!users || users.length === 0) {
      return res.json({
        success: true,
        mfaRequired: false,
        message: 'User not found'
      });
    }

    const user = users[0];

    res.json({
      success: true,
      mfaRequired: user.mfa_enabled === true,
      userId: user.mfa_enabled ? user.id : undefined
    });
  } catch (error) {
    logger.error('MedicalAuth', 'Failed to check MFA requirement', { error: error.message });
    res.status(500).json({
      error: 'Failed to check MFA requirement',
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
      const dbHealth = await unifiedDatabase.healthCheck();
      if (dbHealth.healthy) {
        health.services.database = {
          status: 'healthy',
          connected: true,
          service: 'supabase'
        };
      } else {
        throw new Error(dbHealth.error || 'Database health check failed');
      }
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
      mfa: [
        'POST /api/medical/mfa/setup',
        'POST /api/medical/mfa/enable',
        'POST /api/medical/mfa/verify',
        'POST /api/medical/mfa/disable',
        'GET /api/medical/mfa/status',
        'POST /api/medical/mfa/check-required',
      ],
      system: ['GET /api/medical/health', 'GET /api/medical/info'],
    },
  });
});

// Enhanced error handling middleware
app.use((error, req, res, next) => {
  logger.error('MedicalAuth', 'API Error', { error: error.message });

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

// NOTE: 404 handler commented out because this module is used in unified-api.js
// The catch-all '*' route interferes with other API modules mounted after this one
// 404 handler
// app.use('*', (req, res) => {
//   res.status(404).json({
//     error: 'Not found',
//     message: `Route ${req.method} ${req.originalUrl} not found`,
//     service: 'Medical Staff Authentication'
//   });
// });

// Initialize and start server
async function startServer() {
  logger.info('MedicalAuth', 'Starting server...');

  // Initialize database
  const dbConnected = await initializeDatabase();
  if (!dbConnected) {
    logger.error('MedicalAuth', 'Database connection failed - starting in degraded mode');
    app.locals.dbConnected = false;
  } else {
    app.locals.dbConnected = true;
  }

  // Start server
  app.listen(PORT, () => {
    logger.startup('Medical Auth API Server Started', {
      port: PORT,
      healthCheck: `http://localhost:${PORT}/api/medical/health`,
      registration: `http://localhost:${PORT}/api/medical/register`,
      login: `http://localhost:${PORT}/api/medical/login`
    });

    // Start database connection monitoring
    startDatabaseMonitoring();
  });
}

// Database connection monitoring and recovery
function startDatabaseMonitoring() {
  logger.info('MedicalAuth', 'Starting database connection monitoring...');

  // Check database connection every 30 seconds
  setInterval(async () => {
    try {
      if (unifiedDatabase) {
        const health = await unifiedDatabase.healthCheck();

        if (health.healthy) {
          // If we're here, database is healthy
          if (!app.locals.dbConnected) {
            logger.info('MedicalAuth', 'Database connection restored');
            app.locals.dbConnected = true;
          }
        } else {
          throw new Error(health.error || 'Health check failed');
        }
      }
    } catch (error) {
      if (app.locals.dbConnected) {
        logger.error('MedicalAuth', 'Database connection lost', { error: error.message });
        app.locals.dbConnected = false;
      }

      // Attempt to reconnect
      try {
        const reconnected = await initializeDatabase();
        if (reconnected) {
          logger.info('MedicalAuth', 'Database reconnection successful');
          app.locals.dbConnected = true;
        }
      } catch (reconnectError) {
        logger.error('MedicalAuth', 'Database reconnection failed', { error: reconnectError.message });
      }
    }
  }, 30000); // Check every 30 seconds
}

// Start the server
if (require.main === module) {
  startServer().catch(err => logger.error('MedicalAuth', 'Server startup failed', { error: err.message }));
}

module.exports = app;