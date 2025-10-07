/**
 * TSHLA Medical - Pump Report API Server
 * Handles Stripe payments and provider email delivery for pump recommendations
 * Created: September 17, 2025
 */

// Load environment variables
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const nodemailer = require('nodemailer');
const stripe = require('stripe');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const OpenAI = require('openai');
const unifiedDatabase = require('./services/unified-database.service');
const DatabaseHelper = require('./utils/dbHelper');
const pumpEngine = require('./pump-recommendation-engine-ai');

// Initialize Stripe with secret key (if available)
let stripeInstance = null;
if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== 'sk_test_example...') {
  stripeInstance = stripe(process.env.STRIPE_SECRET_KEY);
  console.log('Stripe initialized successfully');
} else {
  console.warn('Stripe not initialized - missing secret key');
}

// Initialize Supabase client for token verification
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.VITE_OPENAI_API_KEY
});

// Model configuration
const OPENAI_MODELS = {
  freeText: process.env.VITE_OPENAI_MODEL_STAGE4 || 'gpt-4o-mini',
  context7: process.env.VITE_OPENAI_MODEL_STAGE5 || 'gpt-4o',
  finalAnalysis: process.env.VITE_OPENAI_MODEL_STAGE6 || 'gpt-4o'
};

console.log('OpenAI initialized with models:', OPENAI_MODELS);

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware - CORS with flexible localhost support
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin) return callback(null, true);

      // Allow all localhost origins (any port)
      if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
        return callback(null, true);
      }

      // Allow specific production domains
      const allowedOrigins = [
        'https://www.tshla.ai',
        'https://mango-sky-0ba265c0f.1.azurestaticapps.net'
      ];

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Log rejected origins for debugging
      console.log('CORS: Rejected origin:', origin);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);
// JSON parsing middleware with strict: false to handle escaped characters
app.use(express.json({
  limit: '10mb',
  strict: false,  // Allow escaped characters in JSON
  verify: (req, res, buf, encoding) => {
    // Store raw body for debugging
    req.rawBody = buf.toString(encoding || 'utf8');
  }
}));

// Database configuration - Local MySQL
const dbConfig = {
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
  connectTimeout: 120000, // Increased to 120 seconds
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000, // Keep connection alive
};

// Validate required environment variables
function validateDatabaseConfig() {
  const required = ['host', 'user', 'database'];
  const missing = required.filter(key => !dbConfig[key]);

  if (missing.length > 0) {
    console.error('Pump Report API: Missing required database configuration:', missing);
    console.error('Please set the following environment variables:');
    missing.forEach(key => {
      const envVar = key === 'host' ? 'DB_HOST'
                   : key === 'user' ? 'DB_USER'
                   : 'DB_DATABASE';
      console.error(`  ${envVar}`);
    });
    return false;
  }
  // Password is optional (can be empty for local development)
  return true;
}

let pool;

// Initialize database connection with improved retry logic
async function initializeDatabase(maxRetries = 10) {
  console.log('Pump Report API: Initializing database connection...');

  // Validate configuration first
  if (!validateDatabaseConfig()) {
    return false;
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      pool = mysql.createPool({
        ...dbConfig,
        connectionLimit: 5, // Reduced further for stability
        queueLimit: 10, // Reduced queue size
        waitForConnections: true,
        idleTimeout: 60000, // Close idle connections after 60 seconds
        maxIdle: 5, // Maximum idle connections
        enableKeepAlive: true,
        keepAliveInitialDelay: 0
      });

      // Add connection pool error handling
      pool.on('error', (err) => {
        console.error('Pump Report API: Database pool error:', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
          console.log('Pump Report API: Attempting to reconnect...');
          app.locals.dbConnected = false;
        }
      });

      pool.on('connection', () => {
        console.log('Pump Report API: New database connection established');
        app.locals.dbConnected = true;
      });

      console.log(`Pump Report API: Unified database service connected successfully on attempt ${attempt}`);
      app.locals.dbConnected = true;
      return true;
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      console.error(`Pump Report API: Database connection attempt ${attempt}/${maxRetries} failed:`, error.message);

      if (isLastAttempt) {
        console.error('Pump Report API: All database connection attempts failed');
        return false;
      }

      // Simple 3 second delay between retries
      console.log(`Pump Report API: Waiting 3 seconds before retry...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  return false;
}

// Email transporter configuration (SendGrid)
let emailTransporter;

function initializeEmailService() {
  if (!process.env.SMTP_PASSWORD) {
    console.warn('App', 'Placeholder message');
    return;
  }

  emailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER || 'apikey',
      pass: process.env.SMTP_PASSWORD,
    },
  });

  console.log('App', 'Placeholder message');
}

// JWT verification middleware - Supports both Supabase and legacy JWT tokens
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    // Try Supabase token verification first
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (!error && user) {
      // Supabase token is valid - get user details from medical_staff table
      const { data: staffData, error: staffError } = await supabase
        .from('medical_staff')
        .select('*')
        .eq('auth_user_id', user.id)
        .single();

      if (!staffError && staffData) {
        req.user = {
          id: staffData.id,
          email: staffData.email,
          role: staffData.role,
          auth_user_id: user.id
        };
        return next();
      }

      // Try pump_users table if not in medical_staff
      const { data: pumpData, error: pumpError } = await supabase
        .from('pump_users')
        .select('*')
        .eq('auth_user_id', user.id)
        .single();

      if (!pumpError && pumpData) {
        req.user = {
          id: pumpData.id,
          email: pumpData.email,
          role: 'pump_user',
          auth_user_id: user.id
        };
        return next();
      }
    }

    // Fallback to legacy JWT verification for backward compatibility
    const jwtSecret = process.env.JWT_SECRET;
    if (jwtSecret) {
      const decoded = jwt.verify(token, jwtSecret);
      req.user = decoded;
      return next();
    }

    return res.status(403).json({ error: 'Invalid or expired token' });
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Optional auth middleware - doesn't block if no token
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    // No token provided - continue without user
    req.user = null;
    return next();
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error('JWT_SECRET environment variable not set');
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    next();
  } catch (error) {
    console.log('Optional auth: Invalid token, continuing without auth');
    req.user = null;
    next();
  }
};

// Admin role verification middleware
const requireAdmin = (req, res, next) => {
  // First verify the token
  verifyToken(req, res, () => {
    // Check if user has admin role
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Admin access required',
        message: 'You do not have permission to access this resource'
      });
    }
    next();
  });
};

// Database status checking middleware
const checkDatabaseStatus = (req, res, next) => {
  if (!req.app.locals.dbConnected) {
    return res.status(503).json({
      error: 'Database service unavailable',
      message: 'Database connection is currently unavailable. Please try again in a few moments.',
      status: 'degraded'
    });
  }
  next();
};

// Configuration status checking middleware
const checkConfigStatus = (req, res, next) => {
  if (!req.app.locals.configValid) {
    return res.status(503).json({
      error: 'Service configuration invalid',
      message: 'Server configuration is invalid. Some features may not work correctly.',
      errors: req.app.locals.configErrors,
      status: 'degraded'
    });
  }
  next();
};

// ====== ROOT & HEALTH CHECK ENDPOINTS ======

/**
 * Root endpoint
 * GET /
 */
app.get('/', (req, res) => {
  res.json({
    service: 'TSHLA Pump Report API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        checkAccess: 'GET /api/auth/check-access'
      },
      pump: {
        assessments: 'GET /api/pump-assessments/list',
        recommend: 'POST /api/pumpdrive/recommend'
      }
    }
  });
});

/**
 * Health check endpoint
 * GET /api/health
 */
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'pump-report-api',
    version: '1.0.0',
    uptime: process.uptime(),
    services: {},
    environment: {
      configValid: req.app.locals.configValid || false,
      configErrors: req.app.locals.configErrors || null
    }
  };

  let overallStatus = 'ok';

  // Check Supabase connectivity
  try {
    const { data, error } = await supabase
      .from('pump_comparison_data')
      .select('id')
      .limit(1);

    if (error) throw error;

    health.services.database = {
      status: 'healthy',
      connected: true,
      type: 'supabase',
      url: process.env.VITE_SUPABASE_URL
    };
  } catch (error) {
    overallStatus = 'degraded';
    health.services.database = {
      status: 'unhealthy',
      connected: false,
      type: 'supabase',
      error: error.message
    };
  }

  // Check Stripe configuration
  if (stripeInstance) {
    health.services.stripe = {
      status: 'configured',
      configured: true
    };
  } else {
    health.services.stripe = {
      status: 'not_configured',
      configured: false
    };
  }

  // Check JWT configuration
  const crypto = require('crypto');
  const jwtSecret = process.env.JWT_SECRET;
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

  // Check environment configuration
  if (!req.app.locals.configValid) {
    overallStatus = 'degraded';
  }

  health.status = overallStatus;
  const statusCode = overallStatus === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

// ====== AUTHENTICATION & USER MANAGEMENT ENDPOINTS ======

/**
 * Register new user with optional research participation
 * POST /api/auth/register
 */
app.post('/api/auth/register', checkDatabaseStatus, async (req, res) => {
  try {
    const {
      email,
      username: providedUsername,
      password,
      firstName,
      lastName,
      phoneNumber,
      isResearchParticipant = false,
      researchData,
      questionnaireData
    } = req.body;

    // Validation
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        error: 'Missing required fields: email, password, firstName, lastName'
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

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return res.status(400).json({
        error: 'Password must contain at least 1 special character (!@#$%^&*)'
      });
    }

    // Auto-generate username if not provided
    const username = providedUsername || (email.split('@')[0] + '_' + Date.now().toString().slice(-4));

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    if (!pool) {
      console.error('Database connection not available for user registration');
      return res.status(503).json({
        error: 'Service temporarily unavailable',
        message: 'We are experiencing technical difficulties. Please try again in a few moments. If the problem persists, please contact support.',
        code: 'DATABASE_UNAVAILABLE'
      });
    }

    const connection = await unifiedDatabase.getConnection();
    try {
      // Check if email already exists
      const [existingUsers] = await connection.execute(
        'SELECT email FROM pump_users WHERE email = ?',
        [email]
      );

      if (existingUsers.length > 0) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      // Create user account with unlimited access (no expiry)
      const [userResult] = await connection.execute(
        `INSERT INTO pump_users (
          email, username, password_hash, first_name, last_name, phone_number,
          current_payment_status, is_research_participant
        ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`,
        [email, username, passwordHash, firstName || null, lastName || null, phoneNumber || null, isResearchParticipant]
      );

      const userId = userResult.insertId;

      // If research participant, create research record
      let researchParticipantId = null;
      if (isResearchParticipant && researchData) {
        const [researchResult] = await connection.execute(
          `INSERT INTO research_participants (
            user_id, full_name, date_of_birth,
            pcp_name, pcp_phone, pcp_email, pcp_address,
            endocrinologist_name, endocrinologist_phone,
            endocrinologist_email, endocrinologist_address,
            mailing_address, pre_treatment_survey_completed
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            researchData.fullName,
            researchData.dateOfBirth,
            researchData.pcpName,
            researchData.pcpPhone,
            researchData.pcpEmail,
            researchData.pcpAddress,
            researchData.endocrinologistName,
            researchData.endocrinologistPhone,
            researchData.endocrinologistEmail,
            researchData.endocrinologistAddress,
            researchData.mailingAddress,
            true
          ]
        );

        researchParticipantId = researchResult.insertId;

        // Save pre-treatment questionnaire
        if (questionnaireData) {
          await connection.execute(
            `INSERT INTO research_questionnaires (
              user_id, questionnaire_type,
              overall_satisfaction, high_blood_sugar_frequency, low_blood_sugar_frequency,
              convenience_satisfaction, flexibility_satisfaction, understanding_satisfaction,
              continuation_likelihood, recommendation_likelihood, additional_comments
            ) VALUES (?, 'pre_treatment', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              userId,
              questionnaireData.overallSatisfaction,
              questionnaireData.highBloodSugarFrequency,
              questionnaireData.lowBloodSugarFrequency,
              questionnaireData.convenienceSatisfaction,
              questionnaireData.flexibilitySatisfaction,
              questionnaireData.understandingSatisfaction,
              questionnaireData.continuationLikelihood,
              questionnaireData.recommendationLikelihood,
              questionnaireData.additionalComments
            ]
          );
        }
      }

      // Generate JWT token
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        console.error('JWT_SECRET environment variable not set');
        return res.status(500).json({
          error: 'Server configuration error',
          message: 'Authentication service is not properly configured'
        });
      }

      //Determine if user should be admin (for specific emails only)
      const isAdmin = ['rakesh@tshla.ai', 'admin@tshla.ai'].includes(email.toLowerCase());

      const token = jwt.sign(
        { userId, email, username, isResearchParticipant, role: isAdmin ? 'admin' : 'user' },
        jwtSecret,
        { expiresIn: '24h' }
      );

      // Log access
      await connection.execute(
        `INSERT INTO access_logs (
          user_id, access_type, payment_amount_cents, ip_address, user_agent
        ) VALUES (?, ?, 999, ?, ?)`,
        [
          userId,
          isResearchParticipant ? 'research_access' : 'initial_purchase',
          req.ip,
          req.get('User-Agent')
        ]
      );

      console.log('User registered successfully:', {
        userId,
        email,
        username,
        isResearchParticipant,
        researchParticipantId
      });

      res.json({
        success: true,
        message: 'User registered successfully',
        user: {
          id: userId,
          email,
          username,
          firstName,
          lastName,
          phoneNumber,
          isResearchParticipant
        },
        token,
        researchParticipantId
      });

    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('User registration failed:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: error.message
    });
  }
});

/**
 * User login
 * POST /api/auth/login
 */
app.post('/api/auth/login', async (req, res) => {
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
        `SELECT id, email, username, password_hash, first_name, last_name, phone_number,
                current_payment_status, is_research_participant, is_active
         FROM pump_users WHERE email = ?`,
        [email]
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

      // No access expiry check - users have unlimited access
      // Update login tracking and set payment status to active
      await connection.execute(
        'UPDATE pump_users SET current_payment_status = ?, last_login = NOW(), login_count = login_count + 1 WHERE id = ?',
        ['active', user.id]
      );

      // Generate JWT token
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        console.error('JWT_SECRET environment variable not set');
        return res.status(500).json({
          error: 'Server configuration error',
          message: 'Authentication service is not properly configured'
        });
      }

      // Determine admin role from email (consistent with registration logic)
      const isAdmin = ['rakesh@tshla.ai', 'admin@tshla.ai'].includes(email.toLowerCase());

      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          username: user.username,
          isResearchParticipant: user.is_research_participant,
          role: isAdmin ? 'admin' : 'user'
        },
        jwtSecret,
        { expiresIn: '24h' }
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
          phoneNumber: user.phone_number,
          isResearchParticipant: user.is_research_participant
        },
        token
      });

    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Login failed:', error);
    res.status(500).json({
      error: 'Login failed',
      message: error.message
    });
  }
});

/**
 * Check user access status
 * GET /api/auth/check-access
 */
app.get('/api/auth/check-access', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      console.error('JWT_SECRET environment variable not set');
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'Authentication service is not properly configured'
      });
    }

    try {
      const decoded = jwt.verify(token, jwtSecret);

      // Always return valid access - no expiry check
      res.json({
        success: true,
        accessStatus: 'valid',
        accessExpiresAt: null,
        hoursRemaining: null
      });

    } catch (jwtError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    console.error('Access check failed:', error);
    res.status(500).json({
      error: 'Access check failed',
      message: error.message
    });
  }
});

/**
 * Renew 24-hour access (after payment)
 * POST /api/auth/renew-access
 */
app.post('/api/auth/renew-access', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const connection = await unifiedDatabase.getConnection();
    try {
      // Extend access by 24 hours
      const newExpiryTime = new Date();
      newExpiryTime.setHours(newExpiryTime.getHours() + 24);

      await connection.execute(
        `UPDATE pump_users SET
           access_expires_at = ?,
           current_payment_status = 'active',
           updated_at = NOW()
         WHERE id = ?`,
        [newExpiryTime, userId]
      );

      // Log the renewal
      await connection.execute(
        `INSERT INTO access_logs (
          user_id, access_type, payment_amount_cents
        ) VALUES (?, 'renewal', 999)`,
        [userId]
      );

      res.json({
        success: true,
        message: 'Access renewed for 24 hours',
        accessExpiresAt: newExpiryTime.toISOString()
      });

    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Access renewal failed:', error);
    res.status(500).json({
      error: 'Access renewal failed',
      message: error.message
    });
  }
});

// ====== STRIPE PAYMENT ENDPOINTS ======

/**
 * Create Stripe checkout session for pump report
 * POST /api/stripe/create-pump-report-session
 */
app.post('/api/stripe/create-pump-report-session', async (req, res) => {
  try {
    if (!stripeInstance) {
      return res.status(503).json({
        error: 'Payment service not configured',
        message: 'Stripe API key not available',
      });
    }

    const { patientName, assessmentData, successUrl, cancelUrl, priceInCents = 999 } = req.body;

    if (!patientName || !assessmentData) {
      return res.status(400).json({
        error: 'Missing required fields: patientName, assessmentData',
      });
    }

    // Store assessment data in database first
    const connection = await unifiedDatabase.getConnection();
    try {
      const [result] = await connection.execute(
        `INSERT INTO pump_assessments (
          patient_name,
          slider_values,
          selected_features,
          lifestyle_text,
          challenges_text,
          priorities_text,
          clarification_responses,
          payment_status,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
        [
          patientName,
          JSON.stringify(assessmentData.sliderValues || {}),
          JSON.stringify(assessmentData.selectedFeatures || []),
          assessmentData.lifestyleText || '',
          assessmentData.challengesText || '',
          assessmentData.prioritiesText || '',
          JSON.stringify(assessmentData.clarificationResponses || {}),
        ]
      );

      const assessmentId = result.insertId;

      // Create Stripe checkout session
      const session = await stripeInstance.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'Insulin Pump Recommendation Report',
                description: `Personalized pump analysis for ${patientName}`,
                images: ['https://www.tshla.ai/assets/pump-report-image.jpg'],
              },
              unit_amount: priceInCents,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${successUrl}&session_id={CHECKOUT_SESSION_ID}&assessment_id=${assessmentId}`,
        cancel_url: cancelUrl,
        metadata: {
          assessment_id: assessmentId.toString(),
          patient_name: patientName,
          type: 'pump_report',
        },
        customer_email: req.body.customerEmail || undefined,
      });

      // Store payment record
      await connection.execute(
        `INSERT INTO payment_records (
          assessment_id,
          stripe_session_id,
          amount_cents,
          status,
          created_at
        ) VALUES (?, ?, ?, 'pending', NOW())`,
        [assessmentId, session.id, priceInCents]
      );

      res.json({
        id: session.id,
        url: session.url,
        assessment_id: assessmentId,
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('App', 'Placeholder message');
    res.status(500).json({
      error: 'Payment setup failed',
      message: error.message,
    });
  }
});

/**
 * Verify Stripe payment completion
 * GET /api/stripe/verify-payment/:sessionId
 */
app.get('/api/stripe/verify-payment/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Retrieve session from Stripe
    const session = await stripeInstance.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid') {
      // Update payment status in database
      const connection = await unifiedDatabase.getConnection();
      try {
        await connection.execute(
          `UPDATE payment_records
           SET status = 'succeeded'
           WHERE stripe_session_id = ?`,
          [sessionId]
        );

        await connection.execute(
          `UPDATE pump_assessments
           SET payment_status = 'paid'
           WHERE id = ?`,
          [session.metadata.assessment_id]
        );

        res.json({
          paid: true,
          assessment_id: session.metadata.assessment_id,
          amount: session.amount_total,
          customer_email: session.customer_details?.email,
        });
      } finally {
        connection.release();
      }
    } else {
      res.json({
        paid: false,
        status: session.payment_status,
      });
    }
  } catch (error) {
    console.error('App', 'Placeholder message');
    res.status(500).json({
      error: 'Payment verification failed',
      message: error.message,
    });
  }
});

/**
 * Stripe webhook endpoint for payment events
 * POST /api/stripe/webhook
 */
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripeInstance) {
    return res.status(503).json({ error: 'Stripe not configured' });
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  try {
    const event = stripeInstance.webhooks.constructEvent(req.body, sig, webhookSecret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      // Update payment status
      const connection = await unifiedDatabase.getConnection();
      try {
        await connection.execute(
          `UPDATE payment_records
           SET status = 'succeeded'
           WHERE stripe_session_id = ?`,
          [session.id]
        );

        await connection.execute(
          `UPDATE pump_assessments
           SET payment_status = 'paid'
           WHERE id = ?`,
          [session.metadata.assessment_id]
        );

        console.log('App', 'Placeholder message');
      } finally {
        connection.release();
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('App', 'Placeholder message');
    res.status(400).json({ error: 'Webhook verification failed' });
  }
});

// ====== PROVIDER EMAIL DELIVERY ENDPOINTS ======

/**
 * Send pump report to healthcare provider
 * POST /api/provider/send-report
 */
app.post('/api/provider/send-report', async (req, res) => {
  try {
    const { patientName, providerEmail, providerName, assessmentData } = req.body;

    if (!patientName || !providerEmail || !providerName || !assessmentData) {
      return res.status(400).json({
        error: 'Missing required fields: patientName, providerEmail, providerName, assessmentData',
      });
    }

    // Store assessment data in database
    const connection = await unifiedDatabase.getConnection();
    let assessmentId;

    try {
      const [result] = await connection.execute(
        `INSERT INTO pump_assessments (
          patient_name,
          doctor_name,
          slider_values,
          selected_features,
          lifestyle_text,
          challenges_text,
          priorities_text,
          clarification_responses,
          payment_status,
          sent_to_provider,
          provider_email,
          provider_name,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'provider_sent', true, ?, ?, NOW())`,
        [
          patientName,
          providerName,
          JSON.stringify(assessmentData.sliderValues || {}),
          JSON.stringify(assessmentData.selectedFeatures || []),
          assessmentData.lifestyleText || '',
          assessmentData.challengesText || '',
          assessmentData.prioritiesText || '',
          JSON.stringify(assessmentData.clarificationResponses || {}),
          providerEmail,
          providerName,
        ]
      );

      assessmentId = result.insertId;

      // Store provider delivery record
      const [deliveryResult] = await connection.execute(
        `INSERT INTO provider_deliveries (
          assessment_id,
          provider_name,
          provider_email,
          delivery_status,
          created_at
        ) VALUES (?, ?, ?, 'pending', NOW())`,
        [assessmentId, providerName, providerEmail]
      );

      const deliveryId = deliveryResult.insertId;

      // Send email to provider
      if (emailTransporter) {
        const reportUrl = `${process.env.VITE_REPORT_BASE_URL}/pumpdrive/provider-report/${assessmentId}`;

        const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Insulin Pump Assessment Report</h2>

          <p>Dear ${providerName},</p>

          <p>Your patient <strong>${patientName}</strong> has completed a comprehensive insulin pump assessment through TSHLA Medical's AI-powered recommendation system.</p>

          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1e40af;">Assessment Summary:</h3>
            <ul>
              <li><strong>Patient:</strong> ${patientName}</li>
              <li><strong>Assessment Date:</strong> ${new Date().toLocaleDateString()}</li>
              <li><strong>Delivery Method:</strong> Provider Email</li>
            </ul>
          </div>

          <p><strong>What's Included:</strong></p>
          <ul>
            <li>AI-powered analysis across 23 pump dimensions</li>
            <li>Patient's prioritized preferences and lifestyle factors</li>
            <li>Personalized pump recommendations with reasoning</li>
            <li>Insurance information and next steps</li>
          </ul>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${reportUrl}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Patient Report
            </a>
          </div>

          <p style="font-size: 14px; color: #6b7280;">
            <strong>Security Notice:</strong> This report contains protected health information (PHI) and is intended only for the named recipient. The report link is secure and will expire in 30 days.
          </p>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">

          <p style="font-size: 12px; color: #9ca3af;">
            TSHLA Medical - AI-Powered Healthcare Solutions<br>
            Email: support@tshla.ai | Phone: (832) 402-7671<br>
            This is an automated message. Please do not reply to this email.
          </p>
        </div>
        `;

        const mailOptions = {
          from: process.env.FROM_EMAIL || 'noreply@tshla.ai',
          to: providerEmail,
          cc: 'reports@tshla.ai', // For audit trail
          subject: `Insulin Pump Assessment Report - ${patientName}`,
          html: emailBody,
        };

        const emailResult = await emailTransporter.sendMail(mailOptions);

        // Update delivery status
        await connection.execute(
          `UPDATE provider_deliveries
           SET delivery_status = 'sent', sent_at = NOW(), email_message_id = ?
           WHERE id = ?`,
          [emailResult.messageId, deliveryId]
        );

        await connection.execute(
          `UPDATE pump_assessments
           SET sent_at = NOW()
           WHERE id = ?`,
          [assessmentId]
        );

        console.log('App', 'Placeholder message');

        res.json({
          success: true,
          messageId: emailResult.messageId,
          assessmentId: assessmentId,
          deliveryId: deliveryId,
        });
      } else {
        // Email service not configured
        await connection.execute(
          `UPDATE provider_deliveries
           SET delivery_status = 'failed', bounce_reason = 'Email service not configured'
           WHERE id = ?`,
          [deliveryId]
        );

        res.status(500).json({
          success: false,
          error: 'Email service not configured',
        });
      }
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('App', 'Placeholder message');
    res.status(500).json({
      success: false,
      error: 'Failed to send report to provider',
      message: error.message,
    });
  }
});

/**
 * Get delivery status for an assessment
 * GET /api/provider/delivery-status/:assessmentId
 */
app.get('/api/provider/delivery-status/:assessmentId', async (req, res) => {
  try {
    const { assessmentId } = req.params;

    const connection = await unifiedDatabase.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT * FROM provider_deliveries
         WHERE assessment_id = ?
         ORDER BY created_at DESC`,
        [assessmentId]
      );

      res.json({
        assessmentId: parseInt(assessmentId),
        deliveries: rows,
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('App', 'Placeholder message');
    res.status(500).json({
      error: 'Failed to get delivery status',
      message: error.message,
    });
  }
});

/**
 * Get list of participating providers
 * GET /api/provider/participating
 */
app.get('/api/provider/participating', async (req, res) => {
  try {
    const connection = await unifiedDatabase.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT id, name, specialty, practice_name, email, phone, active
         FROM participating_providers
         WHERE active = true
         ORDER BY name`
      );

      res.json(rows);
    } catch (error) {
      // Fallback to hardcoded list if table doesn't exist
      console.warn('App', 'Placeholder message');
      res.json([
        { id: 1, name: 'Dr. Rakesh Patel', email: 'rpatel@tshla.ai', specialty: 'Endocrinologist' },
        {
          id: 2,
          name: 'Dr. Veena Watwe',
          email: 'vwatwe@tshla.ai',
          specialty: 'Internal Medicine',
        },
        {
          id: 3,
          name: 'Dr. Tess Chamakkala',
          email: 'tchamakkala@tshla.ai',
          specialty: 'Endocrinologist',
        },
        { id: 4, name: 'Dr. Elinia Shakya', email: 'eshakya@tshla.ai', specialty: 'Primary Care' },
        { id: 5, name: 'Dr. Preeya Raghu', email: 'praghu@tshla.ai', specialty: 'Endocrinologist' },
        {
          id: 6,
          name: 'Shannon Gregorek, NP',
          email: 'sgregorek@tshla.ai',
          specialty: 'Diabetes Specialist',
        },
        { id: 7, name: 'Kruti Patel, NP', email: 'kpatel@tshla.ai', specialty: 'Primary Care' },
        { id: 8, name: 'Nadia Younus, PA', email: 'nyounus@tshla.ai', specialty: 'Endocrinology' },
        {
          id: 9,
          name: 'Radha Bernander, PA',
          email: 'rbernander@tshla.ai',
          specialty: 'Diabetes Care',
        },
      ]);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('App', 'Placeholder message');
    res.status(500).json({
      error: 'Failed to get participating providers',
      message: error.message,
    });
  }
});

/**
 * Track email open (1x1 pixel tracking)
 * GET /api/provider/track-pixel/:messageId
 */
app.get('/api/provider/track-pixel/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;

    const connection = await unifiedDatabase.getConnection();
    try {
      await connection.execute(
        `UPDATE provider_deliveries
         SET delivery_status = 'viewed', viewed_at = NOW()
         WHERE email_message_id = ? AND viewed_at IS NULL`,
        [messageId]
      );
    } finally {
      connection.release();
    }

    // Return 1x1 transparent PNG
    const pixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      'base64'
    );
    res.set('Content-Type', 'image/png');
    res.set('Content-Length', pixel.length);
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(pixel);
  } catch (error) {
    console.error('App', 'Placeholder message');
    // Still return pixel even if tracking fails
    const pixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      'base64'
    );
    res.set('Content-Type', 'image/png');
    res.send(pixel);
  }
});

// ====== PUMP CONVERSATION DATA ENDPOINTS ======

/**
 * Save pump conversation session data
 * POST /api/pump-conversation/save-session
 */
app.post('/api/pump-conversation/save-session', async (req, res) => {
  try {
    const { sessionId, categoryResponses, currentCategory, completedCategories } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        error: 'Missing required field: sessionId',
      });
    }

    const connection = await unifiedDatabase.getConnection();
    try {
      // Safely prepare data for storage
      const preparedData = DatabaseHelper.prepareForSave(
        { categoryResponses, completedCategories },
        ['categoryResponses', 'completedCategories']
      );

      // Insert or update conversation session
      await connection.execute(
        `INSERT INTO pump_conversation_sessions (
          session_id,
          category_responses,
          current_category,
          completed_categories,
          updated_at
        ) VALUES (?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          category_responses = VALUES(category_responses),
          current_category = VALUES(current_category),
          completed_categories = VALUES(completed_categories),
          updated_at = NOW()`,
        [
          sessionId,
          preparedData.categoryResponses,
          currentCategory || null,
          preparedData.completedCategories,
        ]
      );

      res.json({
        success: true,
        sessionId: sessionId,
        timestamp: new Date().toISOString(),
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('App', 'Placeholder message');
    res.status(500).json({
      error: 'Failed to save conversation session',
      message: error.message,
    });
  }
});

/**
 * Get pump conversation session data
 * GET /api/pump-conversation/get-session/:sessionId
 */
app.get('/api/pump-conversation/get-session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const connection = await unifiedDatabase.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT * FROM pump_conversation_sessions
         WHERE session_id = ? AND expires_at > NOW()`,
        [sessionId]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          error: 'Session not found or expired',
        });
      }

      const session = rows[0];

      // Use safe parsing to prevent JSON errors
      const parsedSession = DatabaseHelper.parseSessionData(session);
      res.json(parsedSession);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('App', 'Placeholder message');
    res.status(500).json({
      error: 'Failed to get conversation session',
      message: error.message,
    });
  }
});

/**
 * Save AI recommendation to session
 * POST /api/pump-conversation/save-recommendation
 */
app.post('/api/pump-conversation/save-recommendation', async (req, res) => {
  try {
    const { sessionId, recommendation } = req.body;

    if (!sessionId || !recommendation) {
      return res.status(400).json({
        error: 'Missing required fields: sessionId, recommendation',
      });
    }

    const connection = await unifiedDatabase.getConnection();
    try {
      await connection.execute(
        `UPDATE pump_conversation_sessions
         SET ai_recommendation = ?, updated_at = NOW()
         WHERE session_id = ?`,
        [JSON.stringify(recommendation), sessionId]
      );

      res.json({
        success: true,
        sessionId: sessionId,
        timestamp: new Date().toISOString(),
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('App', 'Placeholder message');
    res.status(500).json({
      error: 'Failed to save recommendation',
      message: error.message,
    });
  }
});

/**
 * Get all pump assessments (admin endpoint)
 * GET /api/pump-assessments/list
 */
app.get('/api/pump-assessments/list', async (req, res) => {
  try {
    const { limit = 50, offset = 0, status } = req.query;

    const connection = await unifiedDatabase.getConnection();
    try {
      let query = `
        SELECT
          id, patient_name, doctor_name, payment_status,
          sent_to_provider, provider_name, created_at
        FROM pump_assessments
      `;
      let params = [];

      if (status) {
        query += ' WHERE payment_status = ?';
        params.push(status);
      }

      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset));

      const [rows] = await connection.execute(query, params);

      res.json({
        assessments: rows,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: rows.length,
        },
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('App', 'Placeholder message');
    res.status(500).json({
      error: 'Failed to list assessments',
      message: error.message,
    });
  }
});

/**
 * Get detailed pump assessment
 * GET /api/pump-assessments/:id
 */
app.get('/api/pump-assessments/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const connection = await unifiedDatabase.getConnection();
    try {
      const [rows] = await connection.execute(`SELECT * FROM pump_assessments WHERE id = ?`, [id]);

      if (rows.length === 0) {
        return res.status(404).json({
          error: 'Assessment not found',
        });
      }

      const assessment = rows[0];

      // Use safe parsing to prevent JSON errors
      const parsedAssessment = DatabaseHelper.parseAssessmentData(assessment);

      res.json(parsedAssessment);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('App', 'Placeholder message');
    res.status(500).json({
      error: 'Failed to get assessment',
      message: error.message,
    });
  }
});

/**
 * Clean up expired conversation sessions
 * DELETE /api/pump-conversation/cleanup-expired
 */
app.delete('/api/pump-conversation/cleanup-expired', async (req, res) => {
  try {
    const connection = await unifiedDatabase.getConnection();
    try {
      const [result] = await connection.execute(
        `DELETE FROM pump_conversation_sessions WHERE expires_at < NOW()`
      );

      res.json({
        success: true,
        deletedCount: result.affectedRows,
        timestamp: new Date().toISOString(),
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('App', 'Placeholder message');
    res.status(500).json({
      error: 'Failed to cleanup expired sessions',
      message: error.message,
    });
  }
});

// ====== COMPREHENSIVE PUMP ASSESSMENT ENDPOINTS ======

/**
 * Save complete pump assessment with all data
 * POST /api/pump-assessments/save-complete
 */
app.post('/api/pump-assessments/save-complete', verifyToken, async (req, res) => {
  try {
    const {
      patientName,
      sliderValues,
      selectedFeatures,
      personalStory,
      challenges,
      priorities,
      clarifyingResponses,
      aiRecommendation,
      conversationHistory,
      assessmentFlow,
      timestamp
    } = req.body;

    if (!patientName) {
      return res.status(400).json({
        error: 'Missing required field: patientName'
      });
    }

    const connection = await unifiedDatabase.getConnection();
    try {
      // Get authenticated user ID
      const userId = req.user.userId;

      // Insert comprehensive assessment
      const [result] = await connection.execute(
        `INSERT INTO pump_assessments (
          patient_name,
          user_id,
          slider_values,
          selected_features,
          lifestyle_text,
          challenges_text,
          priorities_text,
          clarification_responses,
          gpt4_scores,
          claude_scores,
          hybrid_scores,
          final_recommendation,
          payment_status,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [
          patientName,
          userId,
          JSON.stringify(sliderValues || {}),
          JSON.stringify(selectedFeatures || []),
          personalStory || '',
          challenges || '',
          priorities || '',
          JSON.stringify(clarifyingResponses || {}),
          null, // gpt4_scores - can be populated later
          null, // claude_scores - can be populated later
          JSON.stringify({
            assessmentFlow,
            conversationHistory: conversationHistory || [],
            timestamp
          }),
          JSON.stringify(aiRecommendation),
          timestamp || new Date().toISOString().slice(0, 19).replace('T', ' ')
        ]
      );

      const assessmentId = result.insertId;

      console.log('App', 'Assessment saved successfully', {
        assessmentId,
        patientName,
        flow: assessmentFlow
      });

      res.json({
        success: true,
        assessmentId,
        message: 'Assessment saved successfully',
        timestamp: new Date().toISOString()
      });

    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('App', 'Failed to save complete assessment', { error });
    res.status(500).json({
      error: 'Failed to save assessment',
      message: error.message
    });
  }
});

/**
 * Get complete assessment data by ID
 * GET /api/pump-assessments/:id/complete
 */
app.get('/api/pump-assessments/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;

    const connection = await unifiedDatabase.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT * FROM pump_assessments WHERE id = ?`,
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          error: 'Assessment not found'
        });
      }

      const assessment = rows[0];

      // Parse JSON fields safely using DatabaseHelper
      const completeData = {
        assessmentId: assessment.id,
        patientName: assessment.patient_name,
        sliderValues: DatabaseHelper.safeJsonParse(assessment.slider_values, {}),
        selectedFeatures: DatabaseHelper.safeJsonParse(assessment.selected_features, []),
        personalStory: assessment.lifestyle_text,
        challenges: assessment.challenges_text,
        priorities: assessment.priorities_text,
        clarifyingResponses: DatabaseHelper.safeJsonParse(assessment.clarification_responses, {}),
        aiRecommendation: DatabaseHelper.safeJsonParse(assessment.final_recommendation, null),
        hybridData: DatabaseHelper.safeJsonParse(assessment.hybrid_scores, {}),
        paymentStatus: assessment.payment_status,
        createdAt: assessment.created_at,
        updatedAt: assessment.updated_at
      };

      res.json(completeData);

    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('App', 'Failed to retrieve complete assessment', { error, assessmentId: req.params.id });
    res.status(500).json({
      error: 'Failed to retrieve assessment',
      message: error.message
    });
  }
});

/**
 * Generate PDF report for assessment
 * POST /api/pump-assessments/:id/generate-pdf
 */
app.post('/api/pump-assessments/:id/generate-pdf', async (req, res) => {
  try {
    const { id } = req.params;

    // First, get the assessment data
    const connection = await unifiedDatabase.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT * FROM pump_assessments WHERE id = ?`,
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          error: 'Assessment not found'
        });
      }

      const assessment = rows[0];

      // TODO: Implement PDF generation logic here
      // For now, return a placeholder URL
      const pdfUrl = `/reports/assessment_${id}_${Date.now()}.pdf`;

      // Update the assessment with PDF URL (if you want to store it)
      await connection.execute(
        `UPDATE pump_assessments SET updated_at = NOW() WHERE id = ?`,
        [id]
      );

      console.log('App', 'PDF generation requested', { assessmentId: id });

      res.json({
        success: true,
        pdfUrl,
        message: 'PDF generation initiated',
        assessmentId: id
      });

    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('App', 'Failed to generate PDF', { error, assessmentId: req.params.id });
    res.status(500).json({
      error: 'Failed to generate PDF',
      message: error.message
    });
  }
});

// ====== NEW ASSESSMENT HISTORY ENDPOINTS ======

/**
 * Get assessment by ID (with authentication)
 * GET /api/pumpdrive/assessments/:id
 */
app.get('/api/pumpdrive/assessments/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const connection = await unifiedDatabase.getConnection();
    try {
      // Get assessment and verify ownership
      const [rows] = await connection.execute(
        `SELECT * FROM pump_assessments WHERE id = ? AND user_id = ?`,
        [id, userId]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Assessment not found or access denied'
        });
      }

      const assessment = rows[0];

      res.json({
        success: true,
        assessment: {
          id: assessment.id,
          user_id: assessment.user_id,
          patient_name: assessment.patient_name,
          slider_values: assessment.slider_values,
          selected_features: assessment.selected_features,
          personal_story: assessment.personal_story,
          challenges: assessment.challenges,
          priorities: assessment.priorities,
          clarifying_responses: assessment.clarifying_responses,
          ai_recommendation: assessment.ai_recommendation,
          conversation_history: assessment.conversation_history,
          assessment_flow: assessment.assessment_flow,
          created_at: assessment.created_at,
          updated_at: assessment.updated_at
        }
      });

    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching assessment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch assessment',
      message: error.message
    });
  }
});

/**
 * Get all assessments for a specific user
 * GET /api/pumpdrive/assessments/user/:userId
 */
app.get('/api/pumpdrive/assessments/user/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user.userId;

    // Only allow users to get their own assessments (or admin can get any)
    if (parseInt(userId) !== requestingUserId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const connection = await unifiedDatabase.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT
          id,
          created_at,
          ai_recommendation,
          assessment_flow
        FROM pump_assessments
        WHERE user_id = ?
        ORDER BY created_at DESC`,
        [userId]
      );

      // Parse and transform the data
      const assessments = rows.map(row => {
        let aiRec = null;
        try {
          aiRec = typeof row.ai_recommendation === 'string'
            ? JSON.parse(row.ai_recommendation)
            : row.ai_recommendation;
        } catch (e) {
          console.error('Failed to parse ai_recommendation:', e);
        }

        return {
          id: row.id,
          created_at: row.created_at,
          recommended_pump: aiRec?.topChoice?.name || 'Unknown',
          score: aiRec?.topChoice?.score || 0,
          assessment_flow: row.assessment_flow,
          ai_recommendation: aiRec
        };
      });

      res.json({
        success: true,
        assessments
      });

    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching user assessments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user assessments',
      message: error.message
    });
  }
});

/**
 * Get current authenticated user's assessments
 * GET /api/pumpdrive/assessments/current-user
 */
app.get('/api/pumpdrive/assessments/current-user', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const connection = await unifiedDatabase.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT
          id,
          created_at,
          ai_recommendation,
          assessment_flow
        FROM pump_assessments
        WHERE user_id = ?
        ORDER BY created_at DESC`,
        [userId]
      );

      // Parse and transform the data
      const assessments = rows.map(row => {
        let aiRec = null;
        try {
          aiRec = typeof row.ai_recommendation === 'string'
            ? JSON.parse(row.ai_recommendation)
            : row.ai_recommendation;
        } catch (e) {
          console.error('Failed to parse ai_recommendation:', e);
        }

        return {
          id: row.id,
          created_at: row.created_at,
          recommended_pump: aiRec?.topChoice?.name || 'Unknown',
          score: aiRec?.topChoice?.score || 0,
          assessment_flow: row.assessment_flow,
          ai_recommendation: aiRec
        };
      });

      res.json({
        success: true,
        assessments
      });

    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching current user assessments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch assessments',
      message: error.message
    });
  }
});

/**
 * Email assessment to healthcare provider
 * POST /api/pumpdrive/assessments/:id/email
 */
app.post('/api/pumpdrive/assessments/:id/email', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { providerEmail, patientMessage } = req.body;
    const userId = req.user.userId;

    if (!providerEmail) {
      return res.status(400).json({
        success: false,
        error: 'Provider email is required'
      });
    }

    const connection = await unifiedDatabase.getConnection();
    try {
      // Get assessment and verify ownership
      const [rows] = await connection.execute(
        `SELECT * FROM pump_assessments WHERE id = ? AND user_id = ?`,
        [id, userId]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Assessment not found or access denied'
        });
      }

      const assessment = rows[0];

      // Parse AI recommendation
      let aiRec = null;
      try {
        aiRec = typeof assessment.ai_recommendation === 'string'
          ? JSON.parse(assessment.ai_recommendation)
          : assessment.ai_recommendation;
      } catch (e) {
        console.error('Failed to parse ai_recommendation:', e);
      }

      // Check if email service is configured
      if (!emailTransporter) {
        console.warn('Email service not configured, logging email request');
        return res.status(503).json({
          success: false,
          error: 'Email service not configured',
          message: 'Please configure SMTP settings to enable email delivery'
        });
      }

      // Create email content
      const recommendedPump = aiRec?.topChoice?.name || 'Unknown';
      const score = aiRec?.topChoice?.score || 0;
      const patientName = assessment.patient_name || 'Patient';

      const emailHtml = `
        <h2>Insulin Pump Assessment Results</h2>
        <p><strong>Patient:</strong> ${patientName}</p>
        <p><strong>Assessment Date:</strong> ${new Date(assessment.created_at).toLocaleDateString()}</p>
        <hr/>
        <h3>Recommended Pump</h3>
        <p><strong>${recommendedPump}</strong> (${score}% match)</p>
        ${aiRec?.topChoice?.reasons ? `
          <h4>Reasons:</h4>
          <ul>
            ${aiRec.topChoice.reasons.map(r => `<li>${r}</li>`).join('')}
          </ul>
        ` : ''}
        ${patientMessage ? `
          <hr/>
          <h4>Message from Patient:</h4>
          <p>${patientMessage}</p>
        ` : ''}
        <hr/>
        <p><em>This assessment was generated by TSHLA Medical's AI-powered pump recommendation system.</em></p>
        <p><a href="${process.env.VITE_REPORT_BASE_URL || 'https://www.tshla.ai'}/pumpdrive/assessment/${id}">View Full Assessment</a></p>
      `;

      // Send email
      await emailTransporter.sendMail({
        from: process.env.FROM_EMAIL || 'noreply@tshla.ai',
        to: providerEmail,
        subject: `Pump Assessment Results for ${patientName}`,
        html: emailHtml
      });

      // Log the delivery
      await connection.execute(
        `INSERT INTO provider_deliveries
         (assessment_id, provider_email, delivery_method, delivery_status, delivered_at)
         VALUES (?, ?, 'email', 'sent', NOW())`,
        [id, providerEmail]
      );

      console.log('Assessment emailed successfully:', { assessmentId: id, providerEmail });

      res.json({
        success: true,
        message: 'Assessment sent successfully to provider',
        providerEmail
      });

    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error emailing assessment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to email assessment',
      message: error.message
    });
  }
});

// ====== HEALTH CHECK ENDPOINTS ======

/**
 * Health check endpoint
 * GET /api/health
 */
// Duplicate health endpoint removed - see line 374

/**
 * ADMIN: Get all PumpDrive users with their pump selections
 * GET /api/admin/pumpdrive-users
 * Requires admin authentication
 */
app.get('/api/admin/pumpdrive-users', requireAdmin, async (req, res) => {
  try {
    // Fetch pump users from Supabase
    const { data: users, error } = await supabase
      .from('pump_users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Format users for admin dashboard (pump_reports table migration pending)
    const usersWithParsedData = users.map(user => ({
      ...user,
      full_name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'N/A',
      report_id: null,
      report_payment_status: null,
      payment_amount: null,
      payment_date: null,
      recommendations: null,
      primary_pump: null,
      secondary_pump: null
    }));

    res.json({
      success: true,
      count: usersWithParsedData.length,
      users: usersWithParsedData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Admin API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users',
      message: error.message
    });
  }
});

/**
 * ADMIN: Get user statistics
 * GET /api/admin/pumpdrive-stats
 * Requires admin authentication
 */
app.get('/api/admin/pumpdrive-stats', requireAdmin, async (req, res) => {
  try {
    // Fetch pump users from Supabase
    const { data: users, error } = await supabase
      .from('pump_users')
      .select('*');

    if (error) throw error;

    // Calculate stats (pump_reports table migration pending)
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const stats = {
      total_users: users.length,
      paid_users: users.filter(u => u.current_payment_status === 'active').length,
      total_reports: 0, // pump_reports table not migrated yet
      users_with_paid_reports: 0,
      new_users_24h: users.filter(u => new Date(u.created_at) >= yesterday).length,
      new_reports_24h: 0
    };

    res.json({
      success: true,
      stats: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Admin Stats Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stats',
      message: error.message
    });
  }
});

/**
 * ADMIN: Export users to CSV
 * GET /api/admin/pumpdrive-users/export
 * Requires admin authentication
 */
app.get('/api/admin/pumpdrive-users/export', requireAdmin, async (req, res) => {
  try {
    const connection = await unifiedDatabase.getConnection();

    const [users] = await connection.execute(`
      SELECT
        u.id,
        u.username,
        u.email,
        CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as full_name,
        u.phone_number,
        u.current_payment_status,
        u.created_at,
        u.last_login,
        u.login_count,
        r.recommendations
      FROM pump_users u
      LEFT JOIN pump_reports r ON u.id = r.user_id
      ORDER BY u.created_at DESC
    `);

    connection.release();

    // Convert to CSV
    const csvHeader = 'ID,Username,Email,Full Name,Phone,Payment Status,Primary Pump,Secondary Pump,Created Date,Last Login,Login Count\n';
    const csvRows = users.map(user => {
      const recommendations = user.recommendations ? JSON.parse(user.recommendations) : [];
      const primaryPump = recommendations[0]?.name || 'None';
      const secondaryPump = recommendations[1]?.name || 'None';
      const createdDate = user.created_at ? new Date(user.created_at).toISOString().split('T')[0] : 'N/A';
      const lastLogin = user.last_login ? new Date(user.last_login).toISOString().split('T')[0] : 'Never';

      return [
        user.id,
        `"${user.username || ''}"`,
        `"${user.email || ''}"`,
        `"${user.full_name || ''}"`,
        `"${user.phone_number || ''}"`,
        user.current_payment_status || 'pending',
        `"${primaryPump}"`,
        `"${secondaryPump}"`,
        createdDate,
        lastLogin,
        user.login_count || 0
      ].join(',');
    }).join('\n');

    const csv = csvHeader + csvRows;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=pumpdrive-users-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);

  } catch (error) {
    console.error('CSV Export Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export CSV',
      message: error.message
    });
  }
});

// ============================================================================
// PUMPDRIVE ANALYTICS ENDPOINTS (Admin Only)
// ============================================================================

/**
 * ADMIN: Get comprehensive analytics for PumpDrive assessments
 * GET /api/admin/pumpdrive/analytics
 * Requires admin authentication
 */
app.get('/api/admin/pumpdrive/analytics', requireAdmin, async (req, res) => {
  try {
    const connection = await unifiedDatabase.getConnection();

    // Get summary stats
    const [summaryStats] = await connection.execute(`
      SELECT
        COUNT(*) as totalAssessments,
        COUNT(DISTINCT user_id) as totalUsers,
        AVG(match_score) as avgMatchScore,
        (COUNT(*) / NULLIF(COUNT(DISTINCT user_id), 0) * 100) as completionRate
      FROM pump_assessments
    `);

    // Get pump distribution
    const [pumpDist] = await connection.execute(`
      SELECT
        recommended_pump as pumpName,
        COUNT(*) as count,
        (COUNT(*) * 100.0 / (SELECT COUNT(*) FROM pump_assessments)) as percentage,
        AVG(match_score) as avgScore
      FROM pump_assessments
      WHERE recommended_pump IS NOT NULL
      GROUP BY recommended_pump
      ORDER BY count DESC
    `);

    // Get top 5 pumps
    const topPumps = pumpDist.slice(0, 5);

    // Get assessment trends (last 30 days)
    const [trends] = await connection.execute(`
      SELECT
        DATE(completed_at) as date,
        COUNT(*) as count
      FROM pump_assessments
      WHERE completed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(completed_at)
      ORDER BY date ASC
    `);

    // Get flow type statistics
    const [flowStats] = await connection.execute(`
      SELECT
        flow_type as flowType,
        COUNT(*) as count,
        (COUNT(*) * 100.0 / (SELECT COUNT(*) FROM pump_assessments)) as percentage,
        AVG(match_score) as avgScore
      FROM pump_assessments
      WHERE flow_type IS NOT NULL
      GROUP BY flow_type
      ORDER BY count DESC
    `);

    // Get user engagement stats
    const [engagement] = await connection.execute(`
      SELECT
        COUNT(DISTINCT u.id) as totalUsers,
        COUNT(DISTINCT pa.user_id) as completedAssessments,
        (COUNT(DISTINCT pa.user_id) * 100.0 / NULLIF(COUNT(DISTINCT u.id), 0)) as conversionRate,
        (COUNT(pa.id) / NULLIF(COUNT(DISTINCT pa.user_id), 0)) as avgAssessmentsPerUser
      FROM pump_users u
      LEFT JOIN pump_assessments pa ON u.id = pa.user_id
    `);

    // Get recent assessments
    const [recentAssessments] = await connection.execute(`
      SELECT
        pa.id,
        pa.user_id as userId,
        pu.username,
        pa.completed_at as completedAt,
        pa.recommended_pump as recommendedPump,
        pa.match_score as matchScore,
        pa.flow_type as flowType
      FROM pump_assessments pa
      JOIN pump_users pu ON pa.user_id = pu.id
      ORDER BY pa.completed_at DESC
      LIMIT 10
    `);

    connection.release();

    const analyticsData = {
      summary: {
        totalAssessments: summaryStats[0].totalAssessments,
        totalUsers: summaryStats[0].totalUsers,
        avgMatchScore: parseFloat(summaryStats[0].avgMatchScore) || 0,
        completionRate: parseFloat(summaryStats[0].completionRate) || 0,
        lastUpdated: new Date().toISOString()
      },
      pumpDistribution: pumpDist.map(p => ({
        pumpName: p.pumpName,
        count: p.count,
        percentage: parseFloat(p.percentage),
        avgScore: parseFloat(p.avgScore)
      })),
      assessmentTrends: trends.map(t => ({
        date: t.date,
        count: t.count
      })),
      flowTypeStats: flowStats.map(f => ({
        flowType: f.flowType,
        count: f.count,
        percentage: parseFloat(f.percentage),
        avgScore: parseFloat(f.avgScore)
      })),
      userEngagement: {
        totalUsers: engagement[0].totalUsers,
        completedAssessments: engagement[0].completedAssessments,
        conversionRate: parseFloat(engagement[0].conversionRate) || 0,
        avgAssessmentsPerUser: parseFloat(engagement[0].avgAssessmentsPerUser) || 0
      },
      topPumps: topPumps.map(p => ({
        pumpName: p.pumpName,
        count: p.count,
        percentage: parseFloat(p.percentage),
        avgScore: parseFloat(p.avgScore)
      })),
      recentAssessments: recentAssessments.map(a => ({
        id: a.id,
        userId: a.userId,
        username: a.username,
        completedAt: a.completedAt,
        recommendedPump: a.recommendedPump,
        matchScore: parseFloat(a.matchScore),
        flowType: a.flowType
      }))
    };

    res.json(analyticsData);

  } catch (error) {
    console.error('Analytics API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics',
      message: error.message
    });
  }
});

/**
 * ADMIN: Get analytics summary
 * GET /api/admin/pumpdrive/analytics/summary
 * Requires admin authentication
 */
app.get('/api/admin/pumpdrive/analytics/summary', requireAdmin, async (req, res) => {
  try {
    const connection = await unifiedDatabase.getConnection();

    const [stats] = await connection.execute(`
      SELECT
        COUNT(*) as totalAssessments,
        COUNT(DISTINCT user_id) as totalUsers,
        AVG(match_score) as avgMatchScore,
        (COUNT(*) / NULLIF(COUNT(DISTINCT user_id), 0) * 100) as completionRate
      FROM pump_assessments
    `);

    connection.release();

    res.json({
      totalAssessments: stats[0].totalAssessments,
      totalUsers: stats[0].totalUsers,
      avgMatchScore: parseFloat(stats[0].avgMatchScore) || 0,
      completionRate: parseFloat(stats[0].completionRate) || 0,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Summary API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch summary',
      message: error.message
    });
  }
});

/**
 * ADMIN: Get pump distribution
 * GET /api/admin/pumpdrive/analytics/pump-distribution
 * Requires admin authentication
 */
app.get('/api/admin/pumpdrive/analytics/pump-distribution', requireAdmin, async (req, res) => {
  try {
    const connection = await unifiedDatabase.getConnection();

    const [distribution] = await connection.execute(`
      SELECT
        recommended_pump as pumpName,
        COUNT(*) as count,
        (COUNT(*) * 100.0 / (SELECT COUNT(*) FROM pump_assessments)) as percentage,
        AVG(match_score) as avgScore
      FROM pump_assessments
      WHERE recommended_pump IS NOT NULL
      GROUP BY recommended_pump
      ORDER BY count DESC
    `);

    connection.release();

    res.json(distribution.map(d => ({
      pumpName: d.pumpName,
      count: d.count,
      percentage: parseFloat(d.percentage),
      avgScore: parseFloat(d.avgScore)
    })));

  } catch (error) {
    console.error('Distribution API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch distribution',
      message: error.message
    });
  }
});

/**
 * ADMIN: Get assessment trends over time
 * GET /api/admin/pumpdrive/analytics/trends?days=30
 * Requires admin authentication
 */
app.get('/api/admin/pumpdrive/analytics/trends', requireAdmin, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const connection = await unifiedDatabase.getConnection();

    const [trends] = await connection.execute(`
      SELECT
        DATE(completed_at) as date,
        COUNT(*) as count
      FROM pump_assessments
      WHERE completed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(completed_at)
      ORDER BY date ASC
    `, [days]);

    connection.release();

    res.json(trends.map(t => ({
      date: t.date,
      count: t.count
    })));

  } catch (error) {
    console.error('Trends API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trends',
      message: error.message
    });
  }
});

/**
 * ADMIN: Get recent assessments
 * GET /api/admin/pumpdrive/analytics/recent?limit=10
 * Requires admin authentication
 */
app.get('/api/admin/pumpdrive/analytics/recent', requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const connection = await unifiedDatabase.getConnection();

    const [recent] = await connection.execute(`
      SELECT
        pa.id,
        pa.user_id as userId,
        pu.username,
        pa.completed_at as completedAt,
        pa.recommended_pump as recommendedPump,
        pa.match_score as matchScore,
        pa.flow_type as flowType
      FROM pump_assessments pa
      JOIN pump_users pu ON pa.user_id = pu.id
      ORDER BY pa.completed_at DESC
      LIMIT ?
    `, [limit]);

    connection.release();

    res.json(recent.map(a => ({
      id: a.id,
      userId: a.userId,
      username: a.username,
      completedAt: a.completedAt,
      recommendedPump: a.recommendedPump,
      matchScore: parseFloat(a.matchScore),
      flowType: a.flowType
    })));

  } catch (error) {
    console.error('Recent Assessments API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent assessments',
      message: error.message
    });
  }
});

// ============================================================================
// PUMP COMPARISON DATA MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * ADMIN: Get all pump comparison dimensions (23 dimensions)
 * GET /api/admin/pump-comparison-data
 * Requires admin authentication
 */
app.get('/api/admin/pump-comparison-data', requireAdmin, async (req, res) => {
  try {
    // Fetch from Supabase instead of MySQL
    const { data: dimensions, error } = await supabase
      .from('pump_comparison_data')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('dimension_number', { ascending: true });

    if (error) {
      throw error;
    }

    // pump_details is already JSONB in Supabase, no parsing needed
    res.json({
      success: true,
      count: dimensions.length,
      dimensions: dimensions,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching pump comparison data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pump comparison data',
      message: error.message
    });
  }
});

/**
 * ADMIN: Get a single pump comparison dimension by ID
 * GET /api/admin/pump-comparison-data/:id
 * Requires admin authentication
 */
app.get('/api/admin/pump-comparison-data/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await unifiedDatabase.getConnection();

    const [dimensions] = await connection.execute(`
      SELECT
        id,
        dimension_number,
        dimension_name,
        dimension_description,
        importance_scale,
        pump_details,
        category,
        display_order,
        is_active,
        created_at,
        updated_at
      FROM pump_comparison_data
      WHERE id = ?
    `, [id]);

    connection.release();

    if (dimensions.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Dimension not found'
      });
    }

    const dimension = {
      ...dimensions[0],
      pump_details: typeof dimensions[0].pump_details === 'string'
        ? JSON.parse(dimensions[0].pump_details)
        : dimensions[0].pump_details
    };

    res.json({
      success: true,
      dimension,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching pump comparison dimension:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dimension',
      message: error.message
    });
  }
});

/**
 * ADMIN: Update a pump comparison dimension
 * PUT /api/admin/pump-comparison-data/:id
 * Requires admin authentication
 */
app.put('/api/admin/pump-comparison-data/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      dimension_name,
      dimension_description,
      importance_scale,
      pump_details,
      category,
      display_order,
      is_active
    } = req.body;

    const connection = await unifiedDatabase.getConnection();

    // Convert pump_details to JSON string if it's an object
    const pumpDetailsJson = typeof pump_details === 'object'
      ? JSON.stringify(pump_details)
      : pump_details;

    const [result] = await connection.execute(`
      UPDATE pump_comparison_data
      SET
        dimension_name = COALESCE(?, dimension_name),
        dimension_description = COALESCE(?, dimension_description),
        importance_scale = COALESCE(?, importance_scale),
        pump_details = COALESCE(?, pump_details),
        category = COALESCE(?, category),
        display_order = COALESCE(?, display_order),
        is_active = COALESCE(?, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      dimension_name,
      dimension_description,
      importance_scale,
      pumpDetailsJson,
      category,
      display_order,
      is_active,
      id
    ]);

    connection.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Dimension not found'
      });
    }

    res.json({
      success: true,
      message: 'Dimension updated successfully',
      dimensionId: id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error updating pump comparison dimension:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update dimension',
      message: error.message
    });
  }
});

/**
 * ADMIN: Create a new pump comparison dimension
 * POST /api/admin/pump-comparison-data
 * Requires admin authentication
 */
app.post('/api/admin/pump-comparison-data', requireAdmin, async (req, res) => {
  try {
    const {
      dimension_number,
      dimension_name,
      dimension_description,
      importance_scale,
      pump_details,
      category,
      display_order
    } = req.body;

    if (!dimension_number || !dimension_name || !pump_details) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: dimension_number, dimension_name, pump_details'
      });
    }

    const connection = await unifiedDatabase.getConnection();

    // Convert pump_details to JSON string if it's an object
    const pumpDetailsJson = typeof pump_details === 'object'
      ? JSON.stringify(pump_details)
      : pump_details;

    const [result] = await connection.execute(`
      INSERT INTO pump_comparison_data (
        dimension_number,
        dimension_name,
        dimension_description,
        importance_scale,
        pump_details,
        category,
        display_order,
        is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, true)
    `, [
      dimension_number,
      dimension_name,
      dimension_description || null,
      importance_scale || '1-10',
      pumpDetailsJson,
      category || null,
      display_order || dimension_number
    ]);

    connection.release();

    res.json({
      success: true,
      message: 'Dimension created successfully',
      dimensionId: result.insertId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error creating pump comparison dimension:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create dimension',
      message: error.message
    });
  }
});

/**
 * ADMIN: Delete a pump comparison dimension (soft delete)
 * DELETE /api/admin/pump-comparison-data/:id
 * Requires admin authentication
 */
app.delete('/api/admin/pump-comparison-data/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await unifiedDatabase.getConnection();

    // Soft delete by setting is_active to false
    const [result] = await connection.execute(`
      UPDATE pump_comparison_data
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [id]);

    connection.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Dimension not found'
      });
    }

    res.json({
      success: true,
      message: 'Dimension deleted successfully',
      dimensionId: id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error deleting pump comparison dimension:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete dimension',
      message: error.message
    });
  }
});

/**
 * ADMIN: Get all pump manufacturers with contact info
 * GET /api/admin/pump-manufacturers
 * Requires admin authentication
 */
app.get('/api/admin/pump-manufacturers', requireAdmin, async (req, res) => {
  try {
    // Fetch from Supabase instead of MySQL
    const { data: manufacturers, error } = await supabase
      .from('pump_manufacturers')
      .select('*')
      .eq('is_active', true)
      .order('pump_name', { ascending: true });

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      count: manufacturers.length,
      manufacturers,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching pump manufacturers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pump manufacturers',
      message: error.message
    });
  }
});

/**
 * ADMIN: Update pump manufacturer/contact info
 * PUT /api/admin/pump-manufacturers/:id
 * Requires admin authentication
 */
app.put('/api/admin/pump-manufacturers/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      pump_name,
      manufacturer,
      website,
      rep_name,
      rep_contact,
      rep_email,
      support_phone,
      support_email,
      notes,
      is_active
    } = req.body;

    // Build update object with only provided fields
    const updates = {};
    if (pump_name !== undefined) updates.pump_name = pump_name;
    if (manufacturer !== undefined) updates.manufacturer = manufacturer;
    if (website !== undefined) updates.website = website;
    if (rep_name !== undefined) updates.rep_name = rep_name;
    if (rep_contact !== undefined) updates.rep_contact = rep_contact;
    if (rep_email !== undefined) updates.rep_email = rep_email;
    if (support_phone !== undefined) updates.support_phone = support_phone;
    if (support_email !== undefined) updates.support_email = support_email;
    if (notes !== undefined) updates.notes = notes;
    if (is_active !== undefined) updates.is_active = is_active;
    updates.updated_at = new Date().toISOString();

    // Update in Supabase
    const { data, error } = await supabase
      .from('pump_manufacturers')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Pump manufacturer not found'
      });
    }

    res.json({
      success: true,
      message: 'Pump manufacturer updated successfully',
      manufacturerId: id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error updating pump manufacturer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update pump manufacturer',
      message: error.message
    });
  }
});

/**
 * ADMIN: Create new pump manufacturer
 * POST /api/admin/pump-manufacturers
 * Requires admin authentication
 */
app.post('/api/admin/pump-manufacturers', requireAdmin, async (req, res) => {
  try {
    const {
      pump_name,
      manufacturer,
      website,
      rep_name,
      rep_contact,
      rep_email,
      support_phone,
      support_email,
      notes
    } = req.body;

    if (!pump_name || !manufacturer) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: pump_name, manufacturer'
      });
    }

    const connection = await unifiedDatabase.getConnection();

    const [result] = await connection.execute(`
      INSERT INTO pump_manufacturers (
        pump_name,
        manufacturer,
        website,
        rep_name,
        rep_contact,
        rep_email,
        support_phone,
        support_email,
        notes,
        is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, true)
    `, [
      pump_name,
      manufacturer,
      website || null,
      rep_name || null,
      rep_contact || null,
      rep_email || null,
      support_phone || null,
      support_email || null,
      notes || null
    ]);

    connection.release();

    res.json({
      success: true,
      message: 'Pump manufacturer created successfully',
      manufacturerId: result.insertId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error creating pump manufacturer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create pump manufacturer',
      message: error.message
    });
  }
});

/**
 * API info endpoint
 * GET /api/info
 */
app.get('/api/info', (req, res) => {
  res.json({
    name: 'TSHLA Medical - Pump Report API',
    version: '1.0.0',
    description: 'API for pump recommendation reports with Stripe payments and provider delivery',
    endpoints: {
      admin: [
        'GET /api/admin/pumpdrive-users',
        'GET /api/admin/pumpdrive-stats',
        'GET /api/admin/pumpdrive-users/export',
        'GET /api/admin/pump-comparison-data',
        'GET /api/admin/pump-comparison-data/:id',
        'POST /api/admin/pump-comparison-data',
        'PUT /api/admin/pump-comparison-data/:id',
        'DELETE /api/admin/pump-comparison-data/:id',
        'GET /api/admin/pump-manufacturers',
        'POST /api/admin/pump-manufacturers',
        'PUT /api/admin/pump-manufacturers/:id',
      ],
      stripe: [
        'POST /api/stripe/create-pump-report-session',
        'GET /api/stripe/verify-payment/:sessionId',
        'POST /api/stripe/webhook',
      ],
      provider: [
        'POST /api/provider/send-report',
        'GET /api/provider/delivery-status/:assessmentId',
        'GET /api/provider/participating',
        'GET /api/provider/track-pixel/:messageId',
      ],
      conversation: [
        'POST /api/pump-conversation/save-session',
        'GET /api/pump-conversation/get-session/:sessionId',
        'POST /api/pump-conversation/save-recommendation',
        'DELETE /api/pump-conversation/cleanup-expired',
      ],
      assessments: ['GET /api/pump-assessments/list', 'GET /api/pump-assessments/:id'],
      system: ['GET /api/health', 'GET /api/info'],
    },
  });
});

// ====== PUMP DRIVE AI RECOMMENDATION ENDPOINT ======

/**
 * Process pump recommendations using AWS Bedrock
 * POST /api/pumpdrive/recommend
 */
app.post('/api/pumpdrive/recommend', optionalAuth, async (req, res) => {
  let connection = null;

  try {
    console.log('PumpDrive API: Received recommendation request', {
      hasData: !!req.body,
      dataKeys: Object.keys(req.body || {}),
      userId: req.user?.userId
    });

    const requestData = req.body;
    const userId = req.user?.userId;

    // Authentication is optional - log warning if not authenticated
    if (!userId) {
      console.log('PumpDrive API: ⚠️ Unauthenticated request - will not save to database');
    } else {
      // Only get DB connection if user is authenticated
      connection = await pool.getConnection();
    }

    // Basic validation
    if (!requestData || typeof requestData !== 'object') {
      return res.status(400).json({
        error: 'Invalid request data',
        message: 'Request body must be a valid object'
      });
    }

    // Generate pump recommendations using AWS Bedrock
    const recommendations = await generatePumpRecommendations(requestData);

    // Handle both formats (topChoice from AI, overallTop from rule-based)
    let formattedResponse;
    if (recommendations.overallTop) {
      // Rule-based format - already correct
      formattedResponse = recommendations;
    } else if (recommendations.topChoice) {
      // AI format - convert to expected format
      formattedResponse = {
        overallTop: [
          {
            pumpId: convertPumpNameToId(recommendations.topChoice.name),
            pumpName: recommendations.topChoice.name,
            score: recommendations.topChoice.score,
            reasons: recommendations.topChoice.reasons
          }
        ],
        alternatives: recommendations.alternatives.map(alt => ({
          pumpId: convertPumpNameToId(alt.name),
          pumpName: alt.name,
          score: alt.score,
          reasons: alt.reasons
        })),
        keyFactors: recommendations.keyFactors,
        personalizedInsights: recommendations.personalizedInsights,
        success: true,
        timestamp: new Date().toISOString()
      };
    }

    // Save to pump_reports table (only if authenticated)
    if (userId) {
      const primaryPump = formattedResponse.overallTop?.[0]?.pumpName ||
                          formattedResponse.topRecommendation?.name ||
                          'Unknown';
      const secondaryPump = formattedResponse.alternatives?.[0]?.pumpName ||
                           formattedResponse.alternatives?.[0]?.name ||
                           null;

      const [insertResult] = await connection.execute(
        `INSERT INTO pump_reports
         (user_id, report_data, questionnaire_responses, recommendations, primary_pump, secondary_pump)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          JSON.stringify(requestData),
          JSON.stringify(requestData.questionnaire || {}),
          JSON.stringify(formattedResponse),
          primaryPump,
          secondaryPump
        ]
      );

      console.log('Pump report saved:', {
        reportId: insertResult.insertId,
        userId,
        primaryPump,
        secondaryPump
      });

      // Add report ID to response
      formattedResponse.reportId = insertResult.insertId;
    } else {
      console.log('Pump report NOT saved (no authentication)');
    }

    res.json(formattedResponse);

  } catch (error) {
    console.error('PumpDrive API Error:', error.message);
    res.status(500).json({
      error: 'Failed to generate recommendations',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

/**
 * Generate rule-based pump recommendations (fallback when AI not available)
 */
/**
 * PUMPDRIVE V3.0 SCORING SYSTEM
 * New AI-powered semantic scoring with 6 stages
 * See: PUMPDRIVE_AI_SCORING_SYSTEM_V3.md for complete documentation
 */

// ===================================
// STAGE 1: Initialize Base Scores (30%)
// ===================================
function initializeScores() {
  console.log('[V3] Stage 1: Initializing base scores at 30%');
  return {
    'Medtronic 780G': 30,
    'Tandem t:slim X2': 30,
    'Tandem Mobi': 30,
    'Omnipod 5': 30,
    'Beta Bionics iLet': 30,
    'Twiist': 30
  };
}

// ===================================
// STAGE 2: Apply Slider Adjustments (±12%)
// ===================================
function applySliderAdjustments(scores, sliders) {
  console.log('[V3] Stage 2: Applying slider adjustments');
  const activity = sliders.activity || 5;
  const techComfort = sliders.techComfort || 5;
  const simplicity = sliders.simplicity || 5;
  const discreteness = sliders.discreteness || 5;
  const timeDedication = sliders.timeDedication || 5;

  // Activity Level (1-10)
  if (activity >= 8) {
    scores['Tandem t:slim X2'] += 6;
    scores['Twiist'] += 5;
    scores['Omnipod 5'] += 4;
    scores['Tandem Mobi'] += 4;
    scores['Medtronic 780G'] -= 3;
    scores['Beta Bionics iLet'] -= 2;
  } else if (activity >= 5) {
    scores['Tandem t:slim X2'] += 3;
    scores['Omnipod 5'] += 2;
    scores['Twiist'] += 2;
  } else {
    scores['Beta Bionics iLet'] += 2;
    scores['Medtronic 780G'] += 2;
    scores['Omnipod 5'] += 1;
  }

  // Tech Comfort (1-10)
  if (techComfort <= 3) {
    scores['Beta Bionics iLet'] += 10;
    scores['Omnipod 5'] += 8;
    scores['Tandem t:slim X2'] -= 5;
    scores['Tandem Mobi'] -= 4;
    scores['Medtronic 780G'] -= 3;
    scores['Twiist'] -= 4;
  } else if (techComfort <= 6) {
    scores['Medtronic 780G'] += 3;
    scores['Omnipod 5'] += 2;
    scores['Beta Bionics iLet'] += 2;
  } else {
    scores['Tandem t:slim X2'] += 8;
    scores['Tandem Mobi'] += 7;
    scores['Twiist'] += 6;
    scores['Medtronic 780G'] += 3;
    scores['Beta Bionics iLet'] -= 4;
    scores['Omnipod 5'] -= 2;
  }

  // Simplicity Preference (1-10)
  if (simplicity >= 7) {
    scores['Beta Bionics iLet'] += 12;
    scores['Omnipod 5'] += 8;
    scores['Tandem Mobi'] -= 3;
    scores['Tandem t:slim X2'] -= 4;
    scores['Medtronic 780G'] -= 2;
    scores['Twiist'] -= 2;
  } else if (simplicity >= 4) {
    scores['Omnipod 5'] += 2;
    scores['Medtronic 780G'] += 2;
  } else {
    scores['Tandem t:slim X2'] += 5;
    scores['Twiist'] += 4;
    scores['Tandem Mobi'] += 3;
    scores['Beta Bionics iLet'] -= 3;
  }

  // Discreteness (1-10)
  if (discreteness >= 7) {
    scores['Tandem Mobi'] += 12;
    scores['Omnipod 5'] += 8;
    scores['Twiist'] += 7;
    scores['Medtronic 780G'] -= 6;
    scores['Beta Bionics iLet'] -= 3;
    scores['Tandem t:slim X2'] -= 2;
  } else if (discreteness >= 4) {
    scores['Tandem Mobi'] += 3;
    scores['Omnipod 5'] += 2;
  } else {
    scores['Medtronic 780G'] += 2;
  }

  // Time Dedication (1-10)
  if (timeDedication <= 4) {
    scores['Beta Bionics iLet'] += 10;
    scores['Omnipod 5'] += 5;
    scores['Medtronic 780G'] += 3;
    scores['Tandem t:slim X2'] -= 2;
    scores['Tandem Mobi'] -= 1;
    scores['Twiist'] -= 1;
  } else if (timeDedication >= 8) {
    scores['Tandem t:slim X2'] += 4;
    scores['Twiist'] += 3;
    scores['Tandem Mobi'] += 3;
    scores['Medtronic 780G'] += 2;
    scores['Beta Bionics iLet'] -= 5;
    scores['Omnipod 5'] -= 2;
  }

  console.log('[V3] Stage 2 complete:', scores);
  return scores;
}

// ===================================
// STAGE 3: Apply Feature Adjustments (±8%)
// ===================================
function applyFeatureAdjustments(scores, features) {
  console.log('[V3] Stage 3: Applying feature adjustments');

  const FEATURE_IMPACT = {
    'aa-battery-power': {
      boosts: { 'Medtronic 780G': 8 },
      penalties: { 'Tandem Mobi': -2, 'Beta Bionics iLet': -2 }
    },
    'wireless-charging': {
      boosts: { 'Tandem Mobi': 6, 'Beta Bionics iLet': 6 },
      penalties: { 'Medtronic 780G': -1 }
    },
    'no-charging-needed': {
      boosts: { 'Omnipod 5': 10 },
      penalties: {
        'Medtronic 780G': -1, 'Tandem t:slim X2': -2,
        'Tandem Mobi': -2, 'Beta Bionics iLet': -2, 'Twiist': -2
      }
    },
    'ultra-small-size': {
      boosts: { 'Tandem Mobi': 15 },
      penalties: { 'Medtronic 780G': -4, 'Beta Bionics iLet': -3 }
    },
    'completely-tubeless': {
      boosts: { 'Omnipod 5': 12 },
      penalties: {
        'Medtronic 780G': -1, 'Tandem t:slim X2': -1,
        'Tandem Mobi': -1, 'Beta Bionics iLet': -1, 'Twiist': -1
      }
    },
    'ultra-lightweight': {
      boosts: { 'Twiist': 10, 'Tandem Mobi': 4 },
      penalties: { 'Medtronic 780G': -2 }
    },
    'apple-watch-bolusing': {
      boosts: { 'Twiist': 15 },
      penalties: { 'Medtronic 780G': -3, 'Beta Bionics iLet': -3 }
    },
    'touchscreen-control': {
      boosts: { 'Tandem t:slim X2': 10, 'Beta Bionics iLet': 2 },
      penalties: { 'Medtronic 780G': -3, 'Omnipod 5': -1 }
    },
    'iphone-only-control': {
      boosts: { 'Tandem Mobi': 12, 'Twiist': 8 },
      penalties: { 'Medtronic 780G': -2, 'Beta Bionics iLet': -2 }
    },
    'aggressive-control': {
      boosts: { 'Medtronic 780G': 12, 'Twiist': 6 },
      penalties: { 'Beta Bionics iLet': -2 }
    },
    'no-carb-counting': {
      boosts: { 'Beta Bionics iLet': 15 },
      penalties: {
        'Medtronic 780G': -1, 'Tandem t:slim X2': -1,
        'Tandem Mobi': -1, 'Omnipod 5': -1, 'Twiist': -1
      }
    },
    'fully-submersible': {
      boosts: { 'Medtronic 780G': 10, 'Beta Bionics iLet': 6 },
      penalties: { 'Tandem t:slim X2': -3, 'Twiist': -3 }
    },
    'waterproof-pod': {
      boosts: { 'Omnipod 5': 8, 'Tandem Mobi': 6 },
      penalties: { 'Tandem t:slim X2': -2, 'Twiist': -2 }
    },
    'multiple-cgm-options': {
      boosts: { 'Tandem t:slim X2': 8, 'Omnipod 5': 6 },
      penalties: { 'Tandem Mobi': -2 }
    },
    'phone-bolusing': {
      boosts: { 'Tandem Mobi': 8, 'Tandem t:slim X2': 6, 'Twiist': 8 },
      penalties: { 'Medtronic 780G': -3 }
    },
    'dual-control-options': {
      boosts: { 'Omnipod 5': 8 },
      penalties: { 'Tandem Mobi': -1 }
    },
    'simple-meal-announcements': {
      boosts: { 'Beta Bionics iLet': 10 },
      penalties: { 'Tandem t:slim X2': -2, 'Twiist': -2 }
    },
    'emoji-bolusing': {
      boosts: { 'Twiist': 12 },
      penalties: { 'Medtronic 780G': -2 }
    },
    'inductive-charging': {
      boosts: { 'Beta Bionics iLet': 6 },
      penalties: {}
    }
  };

  features.forEach(feature => {
    const featureId = feature.id || feature;
    const impact = FEATURE_IMPACT[featureId];

    if (impact) {
      // Apply boosts
      Object.entries(impact.boosts).forEach(([pump, points]) => {
        scores[pump] += points;
      });
      // Apply penalties
      Object.entries(impact.penalties).forEach(([pump, points]) => {
        scores[pump] += points;
      });
    }
  });

  console.log('[V3] Stage 3 complete:', scores);
  return scores;
}

// ===================================
// STAGE 4: AI-Powered Free Text Analysis (0-25%)
// ===================================
async function analyzeFreeTextWithAI(freeText) {
  if (!freeText || freeText.trim().length === 0) {
    console.log('[V3] Stage 4: No free text provided, skipping');
    return {
      extractedIntents: [],
      pumpScores: {
        'Medtronic 780G': { points: 0, reasoning: 'No free text analysis' },
        'Tandem t:slim X2': { points: 0, reasoning: 'No free text analysis' },
        'Tandem Mobi': { points: 0, reasoning: 'No free text analysis' },
        'Omnipod 5': { points: 0, reasoning: 'No free text analysis' },
        'Beta Bionics iLet': { points: 0, reasoning: 'No free text analysis' },
        'Twiist': { points: 0, reasoning: 'No free text analysis' }
      },
      dimensionsCovered: [],
      dimensionsMissing: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23]
    };
  }

  console.log('[V3] Stage 4: Analyzing free text with AI semantic understanding');

  const prompt = `You are an expert at understanding patient needs for insulin pumps.
Extract TRUE INTENTIONS from patient free text, not just keywords.

PATIENT'S FREE TEXT:
"${freeText}"

YOUR TASK:
1. Extract all relevant needs/desires/pain points (ignore keywords, focus on INTENT)
2. Map each need to specific pump dimensions (1-23)
3. Score each pump (0-25 points) based on how well it addresses ALL extracted needs
4. Provide clear reasoning citing dimensions

23 PUMP DIMENSIONS:
1. Battery life & power
2. Phone control & app features
3. Tubing preference & wear style
4. Automation behavior & algorithm
5. CGM compatibility
6. Target adjustability
7. Exercise modes & activity support
8. Manual bolus workflow
9. Reservoir/pod capacity
10. Adhesive & site tolerance
11. Water resistance & swimming
12. Alerts & alarms customization
13. User interface design
14. Data sharing & connectivity
15. Clinic support & availability
16. Travel & airport logistics
17. Pediatric & caregiver features
18. Visual discretion & size
19. Ecosystem & accessories
20. Reliability & occlusion handling
21. Cost & insurance coverage
22. On-body comfort & wearability
23. Support apps & software updates

PUMP STRENGTHS (use this to score):

MEDTRONIC 780G:
- Dimension 1: AA batteries (swap anywhere)
- Dimension 4: Most aggressive (100% corrections)
- Dimension 11: Best submersible (12 feet × 24 hours)
- Dimension 9: 300 units, 7-day wear
- Dimension 16: Easy travel (batteries anywhere)

TANDEM T:SLIM X2:
- Dimension 13: Touchscreen (smartphone-like)
- Dimension 5: Multiple CGMs (Dexcom, Libre 2+, Libre 3+)
- Dimension 7: Dedicated exercise mode
- Dimension 2: Phone bolusing + pump touchscreen
- Dimension 17: Remote bolus (Tandem Source for caregivers)

TANDEM MOBI:
- Dimension 18: SMALLEST pump ever made
- Dimension 2: iPhone-only full app control
- Dimension 1: Wireless charging
- Dimension 22: Forget wearing it, ultra-light

OMNIPOD 5:
- Dimension 3: COMPLETELY TUBELESS
- Dimension 1: Never charge (integrated battery)
- Dimension 11: Swim without disconnect
- Dimension 2: Phone OR controller (iOS/Android)
- Dimension 10: Multiple wear sites

BETA BIONICS ILET:
- Dimension 8: NO CARB COUNTING (meal announcements)
- Dimension 4: Hands-off automation
- Dimension 12: Minimal alerts (only 4)
- Dimension 17: Simple for kids
- Dimension 8: Meal sizes (small/medium/large)

TWIIST:
- Dimension 19: Apple Watch bolusing (dose from wrist!)
- Dimension 22: Lightest pump (2 ounces)
- Dimension 8: Emoji interface (food pics)
- Dimension 23: Automatic OTA updates
- Dimension 2: Full Apple integration

SCORING RULES:
- Perfect fit for stated need: +5 to +8 points per pump
- Good fit: +3 to +5 points
- Mentioned but not primary: +1 to +2 points
- Not relevant: 0 points
- MAXIMUM total per pump: +25 points

EXAMPLES:

Example 1: "I love to swim and I'm in the pool every day"
INTENT: Needs excellent water resistance for daily swimming
DIMENSION: #11 (Water resistance)
SCORING:
- Medtronic 780G: +8 (12 feet submersible, best rating)
- Omnipod 5: +7 (8 feet, no tubes in water)
- Tandem Mobi: +5 (8 feet, can swim)
- Beta Bionics iLet: +4 (12 feet but 30 mins only)
- Tandem t:slim X2: +0 (must disconnect)
- Twiist: +0 (not submersible)

Example 2: "Carb counting is exhausting"
INTENT: Burnout on carbs, wants simplified bolusing
DIMENSION: #8 (Bolus workflow)
SCORING:
- Beta Bionics iLet: +8 (NO carb counting)
- Twiist: +3 (emoji interface simplifies)
- Omnipod 5: +2 (food library helps)
- Others: +1 (still require carbs)

Example 3: "I need something for my teenager"
INTENT: Pediatric use, caregiver needs
DIMENSIONS: #17 (Pediatric), #2 (Phone control)
SCORING:
- Tandem t:slim X2: +8 (remote bolus for parents)
- Beta Bionics iLet: +7 (simple for kids)
- Tandem Mobi: +7 (phone control)
- Omnipod 5: +6 (popular with kids, View app)
- Medtronic 780G: +4 (caregiver app, no remote bolus)
- Twiist: +3 (caregiver app coming)

OUTPUT FORMAT (JSON):
{
  "extractedIntents": [
    {
      "intent": "string describing what patient truly needs",
      "dimensions": [array of dimension numbers 1-23],
      "confidence": "high|medium|low",
      "keywords_detected": ["actual phrases from text"]
    }
  ],
  "pumpScores": {
    "Medtronic 780G": {
      "points": 0-25,
      "reasoning": "string explaining score citing dimensions"
    },
    "Tandem t:slim X2": { "points": 0-25, "reasoning": "string" },
    "Tandem Mobi": { "points": 0-25, "reasoning": "string" },
    "Omnipod 5": { "points": 0-25, "reasoning": "string" },
    "Beta Bionics iLet": { "points": 0-25, "reasoning": "string" },
    "Twiist": { "points": 0-25, "reasoning": "string" }
  },
  "dimensionsCovered": [array of dimension numbers that were addressed],
  "dimensionsMissing": [array of dimension numbers NOT addressed - important for Context 7]
}

NOW ANALYZE THE PATIENT'S TEXT AND RETURN JSON.`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.VITE_OPENAI_MODEL_STAGE4 || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Extract patient intent, not keywords. Return valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    const analysis = JSON.parse(response.choices[0].message.content);
    console.log('[V3] Stage 4 complete:', analysis);
    return analysis;
  } catch (error) {
    console.error('[V3] Stage 4 error:', error);
    // Return zero scores on error
    return {
      extractedIntents: [{ intent: 'Error analyzing text', dimensions: [], confidence: 'low', keywords_detected: [] }],
      pumpScores: {
        'Medtronic 780G': { points: 0, reasoning: 'AI error' },
        'Tandem t:slim X2': { points: 0, reasoning: 'AI error' },
        'Tandem Mobi': { points: 0, reasoning: 'AI error' },
        'Omnipod 5': { points: 0, reasoning: 'AI error' },
        'Beta Bionics iLet': { points: 0, reasoning: 'AI error' },
        'Twiist': { points: 0, reasoning: 'AI error' }
      },
      dimensionsCovered: [],
      dimensionsMissing: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23]
    };
  }
}

// ===================================
// STAGE 5: Context 7 Follow-up Question (±5%)
// ===================================
async function generateContext7Question(scores, freeTextAnalysis, userData) {
  console.log('[V3] Stage 5: Checking if Context 7 question needed');

  // Check for close competitors (within 10%)
  const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const topScore = sortedScores[0][1];
  const closeCompetitors = sortedScores.filter(([_, s]) => topScore - s <= 10);

  if (closeCompetitors.length <= 1) {
    console.log('[V3] Stage 5: Clear winner, no question needed');
    return null; // Clear winner
  }

  console.log('[V3] Stage 5: Close scores detected, generating clarifying question');

  const prompt = `Generate ONE clarifying question to differentiate these pumps.

CLOSE SCORES:
${closeCompetitors.map(([name, score]) => `${name}: ${score}%`).join('\n')}

DIMENSIONS NOT ADDRESSED:
${freeTextAnalysis.dimensionsMissing.join(', ')}

PATIENT DATA:
Sliders: ${JSON.stringify(userData.sliders)}
Features: ${userData.features?.map(f => f.title || f.id).join(', ')}
Free Text Intents: ${freeTextAnalysis.extractedIntents.map(i => i.intent).join('; ')}

Generate a multiple-choice question with 3 options that will help decide between these pumps.
Include boost/penalty values for each option.

OUTPUT (JSON):
{
  "question": "Which matters more to you?",
  "context": "Explanation of why this question helps",
  "dimension": dimension_number,
  "options": [
    {
      "text": "Option 1 text",
      "boosts": { "Pump A": 5, "Pump B": -2 }
    },
    {
      "text": "Option 2 text",
      "boosts": { "Pump B": 5, "Pump A": -2 }
    },
    {
      "text": "Both are important",
      "boosts": { "Pump A": 2, "Pump B": 2 }
    }
  ]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.VITE_OPENAI_MODEL_STAGE5 || 'gpt-4o',
      messages: [
        { role: 'system', content: 'Generate smart clarifying questions. Return valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.4,
      max_tokens: 500,
      response_format: { type: 'json_object' }
    });

    const question = JSON.parse(response.choices[0].message.content);
    console.log('[V3] Stage 5 complete:', question);
    return question;
  } catch (error) {
    console.error('[V3] Stage 5 error:', error);
    return null;
  }
}

function applyContext7Boosts(scores, context7Answer, context7Question) {
  if (!context7Answer || !context7Question) return scores;

  console.log('[V3] Stage 5: Applying Context 7 boosts');

  const selectedOption = context7Question.options[context7Answer];
  if (selectedOption && selectedOption.boosts) {
    Object.entries(selectedOption.boosts).forEach(([pump, points]) => {
      scores[pump] += points;
    });
  }

  console.log('[V3] Stage 5 boosts applied:', scores);
  return scores;
}

// ===================================
// STAGE 6: Final AI Analysis with 23 Dimensions (0-20%)
// ===================================
async function performFinalAIAnalysis(currentScores, userData, freeTextAnalysis, dimensions) {
  console.log('[V3] Stage 6: Final AI analysis with 23 dimensions');

  // Format dimensions for prompt
  const formatDimensions = (dims) => {
    return dims.map(dim => {
      const pumpDetails = typeof dim.pump_details === 'string'
        ? JSON.parse(dim.pump_details)
        : dim.pump_details;

      return `${dim.dimension_number}. ${dim.dimension_name}: ${dim.dimension_description}
${Object.entries(pumpDetails).map(([pump, detail]) => `  - ${pump}: ${detail}`).join('\n')}`;
    }).join('\n\n');
  };

  const prompt = `Final scoring review with comprehensive 23-dimension analysis.

CURRENT SCORES (after 5 stages):
${Object.entries(currentScores).map(([name, score]) => `${name}: ${Math.round(score)}%`).join('\n')}

PATIENT PROFILE:
Sliders: ${JSON.stringify(userData.sliders)}
Features: ${userData.features?.map(f => f.title || f.id).join(', ')}
Free Text: "${userData.freeText?.currentSituation || 'Not provided'}"
Extracted Intents: ${freeTextAnalysis.extractedIntents.map(i => i.intent).join('; ')}

23-DIMENSION DATABASE:
${formatDimensions(dimensions.dimensions || [])}

YOUR TASK:
1. Identify the MOST critical dimensions for THIS patient
2. Assess each pump's alignment across those dimensions
3. Award 0-20 bonus points per pump based on comprehensive fit
4. Cite specific dimensions in all reasoning
5. Explain why top pump is best match

CRITICAL: Base your analysis on:
- Which dimensions matter most to THIS patient
- How well each pump excels in those specific dimensions
- Any dimension gaps the patient hasn't considered but should

OUTPUT (JSON):
{
  "finalScores": {
    "Medtronic 780G": {
      "score": current_score_plus_bonus,
      "dimensionBonus": 0-20,
      "keyDimensions": [numbers],
      "reasoning": "string citing dimensions"
    },
    "Tandem t:slim X2": { ... },
    "Tandem Mobi": { ... },
    "Omnipod 5": { ... },
    "Beta Bionics iLet": { ... },
    "Twiist": { ... }
  },
  "topChoice": {
    "name": "Pump Name",
    "finalScore": number,
    "primaryReasons": [
      "Dimension X: Specific strength",
      "Dimension Y: Specific strength",
      "Dimension Z: Specific strength"
    ]
  },
  "dimensionBreakdown": {
    "mostRelevant": [
      { "number": X, "name": "Dimension name", "winner": "Pump" }
    ]
  }
}`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.VITE_OPENAI_MODEL_STAGE6 || 'gpt-4o',
      messages: [
        { role: 'system', content: 'Expert diabetes educator analyzing 23 pump dimensions. Return valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    });

    const analysis = JSON.parse(response.choices[0].message.content);
    console.log('[V3] Stage 6 complete:', analysis);
    return analysis;
  } catch (error) {
    console.error('[V3] Stage 6 error:', error);
    // Return current scores without bonus
    return {
      finalScores: Object.fromEntries(
        Object.entries(currentScores).map(([pump, score]) => [
          pump,
          { score, dimensionBonus: 0, keyDimensions: [], reasoning: 'AI analysis unavailable' }
        ])
      ),
      topChoice: {
        name: Object.entries(currentScores).sort((a, b) => b[1] - a[1])[0][0],
        finalScore: Math.round(Object.entries(currentScores).sort((a, b) => b[1] - a[1])[0][1]),
        primaryReasons: ['Based on slider and feature preferences']
      },
      dimensionBreakdown: { mostRelevant: [] }
    };
  }
}

// ===================================
// MAIN: V3 Orchestrator Function (All 6 Stages)
// ===================================
async function generatePumpRecommendationsV3(userData) {
  console.log('[V3] ====== Starting PumpDrive V3.0 Recommendation Engine ======');

  try {
    // Stage 1: Initialize base scores (30%)
    let scores = initializeScores();

    // Stage 2: Apply slider adjustments (±12%)
    scores = applySliderAdjustments(scores, userData.sliders || {});

    // Stage 3: Apply feature adjustments (±8%)
    scores = applyFeatureAdjustments(scores, userData.features || []);

    // Stage 4: AI-powered free text analysis (0-25%)
    const freeTextAnalysis = await analyzeFreeTextWithAI(userData.freeText?.currentSituation || '');

    // Apply free text scores
    Object.entries(freeTextAnalysis.pumpScores).forEach(([pump, data]) => {
      scores[pump] += data.points;
    });
    console.log('[V3] After Stage 4 (free text):', scores);

    // Stage 5: Context 7 question (±5%)
    let context7Question = null;
    if (!userData.context7Answer) {
      // Generate question if not already answered
      context7Question = await generateContext7Question(scores, freeTextAnalysis, userData);

      if (context7Question) {
        // Return question to frontend for user to answer
        return {
          needsContext7: true,
          context7Question: context7Question,
          currentScores: scores,
          freeTextAnalysis: freeTextAnalysis
        };
      }
    } else {
      // Apply user's answer
      scores = applyContext7Boosts(scores, userData.context7Answer, userData.context7QuestionData);
    }

    // Stage 6: Final AI analysis with 23 dimensions (0-20%)
    const dimensions = await fetchPumpComparisonData();
    const finalAnalysis = await performFinalAIAnalysis(scores, userData, freeTextAnalysis, dimensions);

    // Cap all scores at 100
    const cappedScores = Object.fromEntries(
      Object.entries(finalAnalysis.finalScores).map(([pump, data]) => [
        pump,
        { ...data, score: Math.min(100, Math.round(data.score)) }
      ])
    );

    // Sort and format final result
    const sorted = Object.entries(cappedScores).sort((a, b) => b[1].score - a[1].score);

    console.log('[V3] ====== V3.0 Recommendation Complete ======');
    console.log('[V3] Final scores:', sorted.map(([name, data]) => `${name}: ${data.score}%`).join(', '));

    return {
      overallTop: [{
        pumpName: sorted[0][0],
        score: sorted[0][1].score,
        reasons: finalAnalysis.topChoice.primaryReasons,
        keyDimensions: sorted[0][1].keyDimensions,
        reasoning: sorted[0][1].reasoning
      }],
      alternatives: sorted.slice(1, 3).map(([name, data]) => ({
        pumpName: name,
        score: data.score,
        reasons: data.reasoning.split('. ').slice(0, 3),
        keyDimensions: data.keyDimensions
      })),
      allPumps: sorted.map(([name, data]) => ({
        pumpName: name,
        score: data.score,
        keyDimensions: data.keyDimensions,
        reasoning: data.reasoning
      })),
      keyFactors: finalAnalysis.dimensionBreakdown.mostRelevant.map(d => d.name),
      personalizedInsights: `Based on comprehensive analysis across 23 dimensions, we recommend the ${sorted[0][0]}. ${finalAnalysis.topChoice.primaryReasons[0]}. This pump scores ${sorted[0][1].score}% compatibility with your needs.`,
      scoringVersion: 'V3.0-full',
      stagesCompleted: ['base', 'sliders', 'features', 'freetext-ai', context7Question ? 'context7' : null, 'final-ai'].filter(Boolean),
      freeTextAnalysis: freeTextAnalysis,
      dimensionBreakdown: finalAnalysis.dimensionBreakdown
    };

  } catch (error) {
    console.error('[V3] Error in V3 recommendation engine:', error);
    // Fallback to rule-based
    console.log('[V3] Falling back to rule-based recommendations');
    return generateRuleBasedRecommendations(userData);
  }
}

// ===================================
// WRAPPER: Fallback function (Stages 1-3 only)
// ===================================
function generateRuleBasedRecommendations(userData) {
  console.log('[V3] Running fallback mode (Stages 1-3 only)');
  const sliders = userData.sliders || {};
  const features = userData.features || [];

  // Stage 1: Base scores
  let scores = initializeScores();

  // Stage 2: Slider adjustments
  scores = applySliderAdjustments(scores, sliders);

  // Stage 3: Feature adjustments
  scores = applyFeatureAdjustments(scores, features);

  // Sort by score
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const topChoice = sorted[0];
  const alternatives = sorted.slice(1, 3);

  // Generate reasons based on scores
  const reasons = {
    'Omnipod 5': [
      'Tubeless design offers maximum discretion',
      'Simple pod system - no tubing to manage',
      'Automated insulin delivery with Dexcom G6/G7',
      'Waterproof and swim-friendly'
    ],
    'Tandem Mobi': [
      'Smallest pump available - ultra-discreet',
      'Fits in small pockets easily',
      'Control IQ technology for automated delivery',
      'Bluetooth connectivity to smartphone'
    ],
    'Tandem t:slim X2': [
      'Advanced Control IQ technology',
      'Color touchscreen for easy navigation',
      'Rechargeable battery - no disposables',
      'Excellent for active lifestyles'
    ],
    'Medtronic 780G': [
      'SmartGuard auto mode with advanced automation',
      'Most waterproof pump - submersible to 12 feet',
      'Large insulin reservoir (300 units)',
      'Proven reliability and accuracy'
    ],
    'Beta Bionics iLet': [
      'No carb counting required - life-changing simplicity',
      'Announces meals with simple buttons (breakfast/lunch/dinner)',
      'Hands-off automation - minimal user interaction',
      'Only 4 alerts total - quietest pump available'
    ],
    'Twiist': [
      'Lightest pump available at only 2 ounces',
      'Apple Watch control for discreet bolusing',
      'Circular design - ultra-compact and modern',
      'Innovative emoji-based interface'
    ]
  };

  return {
    overallTop: [{
      pumpName: topChoice[0],
      score: Math.round(topChoice[1]),
      reasons: reasons[topChoice[0]]
    }],
    alternatives: alternatives.map(([name, score]) => ({
      pumpName: name,
      score: Math.round(score),
      reasons: reasons[name]
    })),
    keyFactors: [
      sliders.simplicity >= 7 ? 'Ease of use and simplicity' : null,
      sliders.discreteness >= 7 ? 'Small size and discretion' : null,
      sliders.activity >= 6 ? 'Active lifestyle compatibility' : null,
      sliders.techComfort >= 6 ? 'Advanced technology features' : null
    ].filter(Boolean),
    personalizedInsights: `Based on your preferences, we recommend the ${topChoice[0]}. ${reasons[topChoice[0]][0]}. This pump scores ${Math.round(topChoice[1])}% compatibility with your needs.`,
    scoringVersion: 'V3.0-fallback',
    stagesCompleted: ['base', 'sliders', 'features']
  };
}

/**
 * Fetch pump comparison data from database for AI recommendations
 */
async function fetchPumpComparisonData() {
  try {
    // Fetch from Supabase instead of MySQL
    const { data: dimensions, error: dimError } = await supabase
      .from('pump_comparison_data')
      .select('dimension_number, dimension_name, dimension_description, pump_details, category, importance_scale')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('dimension_number', { ascending: true });

    if (dimError) {
      throw dimError;
    }

    const { data: manufacturers, error: mfgError } = await supabase
      .from('pump_manufacturers')
      .select('pump_name, manufacturer, website, rep_name, rep_contact, support_phone')
      .eq('is_active', true)
      .order('pump_name', { ascending: true });

    if (mfgError) {
      throw mfgError;
    }

    // pump_details is already JSONB in Supabase, no parsing needed
    return {
      dimensions: dimensions,
      manufacturers: manufacturers
    };
  } catch (error) {
    console.error('Error fetching pump comparison data:', error);
    return null; // Return null if database fetch fails - AI will use fallback
  }
}

/**
 * Generate pump recommendations using OpenAI
 */
async function generatePumpRecommendations(userData) {
  // Check if OpenAI is configured
  if (!process.env.VITE_OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY === 'your_openai_api_key_here') {
    console.log('OpenAI not configured - using rule-based recommendations (V3 fallback)');
    return generateRuleBasedRecommendations(userData);
  }

  try {
    console.log('=== Using PumpDrive V3.0 Recommendation Engine ===');
    return await generatePumpRecommendationsV3(userData);
  } catch (error) {
    console.error('Error in V3 recommendation engine:', error);
    console.log('Falling back to rule-based recommendations');
    return generateRuleBasedRecommendations(userData);
  }
}

/**
 * Create user profile from request data (LEGACY - used for rule-based fallback only)
 */
function createUserProfile(userData) {
  let profile = 'PATIENT ASSESSMENT DATA:\n';

  // Handle different input formats
  if (userData.signals && userData.sectionWeights) {
    // Category-based format
    profile += 'Assessment Type: Category-based responses\n';
    profile += `Sections completed: ${Object.keys(userData.signals).length}\n`;

    Object.entries(userData.signals).forEach(([section, data]) => {
      profile += `\n${section.toUpperCase()}:\n`;
      if (data.transcripts && data.transcripts.length > 0) {
        profile += `User said: "${data.transcripts.join(' ')}"`;
      }
      if (data.answers && Object.keys(data.answers).length > 0) {
        profile += `Answers: ${JSON.stringify(data.answers)}`;
      }
    });
  } else if (userData.answers) {
    // Direct answers format
    profile += 'Assessment Type: Direct answers\n';
    Object.entries(userData.answers).forEach(([key, value]) => {
      profile += `${key}: ${JSON.stringify(value)}\n`;
    });
  } else {
    // Raw user data
    profile += 'Assessment Type: Raw user responses\n';
    profile += JSON.stringify(userData, null, 2);
  }

  return profile;
}

/**
 * Create simplified pump database for AI analysis
 */
function createPumpDatabase() {
  return `
1. Omnipod 5 (Insulet)
   - Tubeless patch pump
   - Automated insulin delivery with SmartAdjust
   - Works with Dexcom G6/G7
   - Waterproof, 3-day wear
   - Phone app control
   - Best for: Active lifestyle, swimming, discretion

2. Tandem t:slim X2 (Tandem Diabetes)
   - Tubed pump with touchscreen
   - Control-IQ algorithm
   - Dexcom G6/G7 integration
   - Rechargeable battery
   - Small, modern design
   - Best for: Tech-savvy users, tight control

3. Tandem Mobi (Tandem Diabetes)
   - Smallest tubed pump
   - Control-IQ algorithm
   - iPhone control (no Android yet)
   - 200-unit capacity
   - Ultra-discreet
   - Best for: Maximum discretion, iPhone users

4. Medtronic MiniMed 780G (Medtronic)
   - Tubed pump with color screen
   - SmartGuard algorithm
   - Guardian 4 CGM integration
   - Auto-correction boluses
   - Comprehensive data
   - Best for: Clinical support, data analysis

5. Beta Bionics iLet (Beta Bionics)
   - Bionic pancreas system
   - Dual hormone capability (insulin + glucagon)
   - Adaptive algorithm
   - Minimal user input required
   - Best for: Simplified management, breakthrough technology

6. Twiist (Zealand Pharma)
   - Ultra-lightweight (2 oz)
   - Apple Watch bolusing support
   - Replaceable batteries
   - Advanced connectivity features
   - Best for: Apple ecosystem users, minimal weight
`;
}

/**
 * Convert pump name to ID for frontend compatibility
 */
function convertPumpNameToId(pumpName) {
  const nameToIdMap = {
    'Omnipod 5': 'omnipod5',
    'Tandem t:slim X2': 'tandem-x2',
    'Tandem Mobi': 'tandem-mobi',
    'Medtronic MiniMed 780G': 'medtronic-780g',
    'MiniMed 780G': 'medtronic-780g',
    'Beta Bionics iLet': 'beta-bionics-ilet',
    'iLet': 'beta-bionics-ilet',
    'Twiist': 'twiist'
  };

  return nameToIdMap[pumpName] || pumpName.toLowerCase().replace(/\s+/g, '-');
}

// ===== TEMPLATE API ENDPOINTS =====

/**
 * Get all templates for a doctor
 */
app.get('/api/templates', async (req, res) => {
  try {
    const { doctorId } = req.query;

    if (!doctorId) {
      return res.status(400).json({ error: 'doctorId is required' });
    }

    const connection = await unifiedDatabase.getConnection();

    // Get templates created by doctor or system templates
    const [templates] = await connection.execute(
      `
      SELECT * FROM templates
      WHERE created_by = ? OR is_system_template = 1
      ORDER BY is_system_template DESC, name ASC
    `,
      [doctorId]
    );

    connection.release();

    // Transform database format to frontend format
    const formattedTemplates = templates.map(template => ({
      id: template.id,
      name: template.name,
      description: template.description || '',
      visitType: template.template_type || 'general',
      isDefault: false, // Will be set by profile service
      sections:
        typeof template.sections === 'string' ? JSON.parse(template.sections) : template.sections,
      generalInstructions: template.general_instructions || '',
      createdAt: template.created_at,
      updatedAt: template.updated_at,
      usageCount: template.usage_count || 0,
    }));

    res.json(formattedTemplates);
  } catch (error) {
    console.error('Template API Error:', error.message);
    res.status(500).json({ error: 'Failed to get templates' });
  }
});

/**
 * Save doctor profile (settings, favorites, recents)
 */
app.post('/api/doctor-profiles', async (req, res) => {
  try {
    const { doctorId, settings, templates, recentTemplates, favoriteTemplates } = req.body;

    if (!doctorId) {
      return res.status(400).json({ error: 'doctorId is required' });
    }

    const connection = await unifiedDatabase.getConnection();

    try {
      // Update or insert doctor (matching existing table structure)
      await connection.execute(
        `
        INSERT INTO doctors (id, name, email, specialty, password_hash)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          updated_at = CURRENT_TIMESTAMP
      `,
        [
          doctorId,
          `Doctor ${doctorId}`, // Default name
          `${doctorId}@tshla.ai`, // Default email
          'General Medicine', // Default specialty
          'hash_placeholder', // Default password hash
        ]
      );

      // Save favorites as separate records in doctor_template_favorites table
      if (favoriteTemplates && favoriteTemplates.length > 0) {
        // Clear existing favorites
        await connection.execute(
          `
          DELETE FROM doctor_template_favorites WHERE doctor_id = ?
        `,
          [doctorId]
        );

        // Insert new favorites
        for (const templateId of favoriteTemplates) {
          await connection.execute(
            `
            INSERT INTO doctor_template_favorites (doctor_id, template_id)
            VALUES (?, ?)
          `,
            [doctorId, templateId]
          );
        }
      }

      // Save any new templates
      if (templates && templates.length > 0) {
        for (const template of templates) {
          await connection.execute(
            `
            INSERT INTO templates (id, name, specialty, template_type, sections, created_by, usage_count)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              name = VALUES(name),
              sections = VALUES(sections),
              usage_count = VALUES(usage_count),
              updated_at = CURRENT_TIMESTAMP
          `,
            [
              template.id,
              template.name,
              template.specialty || 'General Medicine',
              template.visitType || 'general',
              JSON.stringify(template.sections),
              doctorId,
              template.usageCount || 0,
            ]
          );
        }
      }
    } finally {
      connection.release();
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Template API Error:', error.message);
    res.status(500).json({ error: 'Failed to save profile' });
  }
});

/**
 * Load doctor profile
 */
app.get('/api/doctor-profiles/:doctorId', async (req, res) => {
  try {
    const { doctorId } = req.params;

    const connection = await unifiedDatabase.getConnection();

    const [doctors] = await connection.execute(
      `
      SELECT * FROM doctors WHERE id = ?
    `,
      [doctorId]
    );

    if (doctors.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Doctor profile not found' });
    }

    const doctor = doctors[0];

    // Get templates
    const [templates] = await connection.execute(
      `
      SELECT * FROM templates
      WHERE created_by = ? OR is_system_template = 1
      ORDER BY name ASC
    `,
      [doctorId]
    );

    // Get favorite templates
    const [favorites] = await connection.execute(
      `
      SELECT template_id FROM doctor_template_favorites WHERE doctor_id = ?
    `,
      [doctorId]
    );

    connection.release();

    const profile = {
      doctorId: doctor.id,
      settings: {
        aiStyle: 'formal',
        autoProcessAfterRecording: true,
        displayPreferences: {
          showInterimTranscript: true,
          highlightMedicalTerms: true,
          autoSaveInterval: 30,
        },
        recordingPreferences: {
          mode: 'dictation',
          autoStopAfterSilence: 3,
          showVideoPreview: false,
        },
      },
      templates: templates.map(template => ({
        id: template.id,
        name: template.name,
        description: template.description || '',
        visitType: template.template_type || 'general',
        sections:
          typeof template.sections === 'string' ? JSON.parse(template.sections) : template.sections,
        generalInstructions: template.general_instructions || '',
        createdAt: template.created_at,
        updatedAt: template.updated_at,
        usageCount: template.usage_count || 0,
      })),
      recentTemplates: [], // TODO: Implement recent templates tracking
      favoriteTemplates: favorites.map(fav => fav.template_id),
    };

    res.json(profile);
  } catch (error) {
    console.error('Template API Error:', error.message);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

/**
 * Save individual template
 */
app.post('/api/templates', async (req, res) => {
  try {
    const {
      id,
      doctorId,
      name,
      description,
      visitType,
      sections,
      generalInstructions,
      usageCount,
    } = req.body;

    if (!id || !doctorId || !name || !sections) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const connection = await unifiedDatabase.getConnection();

    await connection.execute(
      `
      INSERT INTO templates (
        id, name, specialty, template_type, sections,
        general_instructions, created_by, usage_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        sections = VALUES(sections),
        general_instructions = VALUES(general_instructions),
        usage_count = VALUES(usage_count),
        updated_at = CURRENT_TIMESTAMP
    `,
      [
        id,
        name,
        'General Medicine',
        visitType || 'general',
        JSON.stringify(sections),
        generalInstructions || '',
        doctorId,
        usageCount || 0,
      ]
    );

    connection.release();

    res.json({ success: true });
  } catch (error) {
    console.error('Template API Error:', error.message);
    res.status(500).json({ error: 'Failed to save template' });
  }
});

/**
 * Toggle favorite template
 */
app.post('/api/templates/:templateId/toggle-favorite', async (req, res) => {
  try {
    const { templateId } = req.params;
    const { doctorId } = req.body;

    if (!doctorId) {
      return res.status(400).json({ error: 'doctorId is required' });
    }

    const connection = await unifiedDatabase.getConnection();

    try {
      // Check if favorite already exists
      const [existing] = await connection.execute(
        `
        SELECT id FROM doctor_template_favorites
        WHERE doctor_id = ? AND template_id = ?
      `,
        [doctorId, templateId]
      );

      if (existing.length > 0) {
        // Remove favorite
        await connection.execute(
          `
          DELETE FROM doctor_template_favorites
          WHERE doctor_id = ? AND template_id = ?
        `,
          [doctorId, templateId]
        );
        res.json({ success: true, isFavorite: false });
      } else {
        // Add favorite
        await connection.execute(
          `
          INSERT INTO doctor_template_favorites (doctor_id, template_id)
          VALUES (?, ?)
        `,
          [doctorId, templateId]
        );
        res.json({ success: true, isFavorite: true });
      }
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Template API Error:', error.message);
    res.status(500).json({ error: 'Failed to toggle favorite' });
  }
});

/**
 * Test database connection and show template count
 */
app.get('/api/database/test', async (req, res) => {
  try {
    const connection = await unifiedDatabase.getConnection();

    const [doctors] = await connection.execute('SELECT COUNT(*) as count FROM doctors');
    const [templates] = await connection.execute('SELECT COUNT(*) as count FROM templates');

    connection.release();

    res.json({
      success: true,
      connected: true,
      doctors: doctors[0].count,
      templates: templates[0].count,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      connected: false,
      error: error.message,
    });
  }
});

// Enhanced error handling middleware
app.use((error, req, res, next) => {
  console.error('Server Error:', error.message);
  console.error('Stack:', error.stack);

  // Handle JSON parsing errors
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Invalid request format',
      message: 'Please check your input data - there may be special characters causing parsing issues',
      suggestion: 'Try avoiding special characters like ! in passwords during API calls'
    });
  }

  // Handle database connection errors
  if (error.code === 'PROTOCOL_CONNECTION_LOST' || error.code === 'ECONNRESET') {
    return res.status(503).json({
      error: 'Database connection error',
      message: 'Temporary database connectivity issue. Please try again in a moment.',
      retryAfter: 5
    });
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Authentication failed',
      message: 'Invalid or expired token. Please log in again.'
    });
  }

  // Default error response
  res.status(500).json({
    error: 'Internal server error',
    message: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// Initialize and start server
async function startServer() {
  console.log('Pump Report API: Starting server...');

  // Validate environment configuration
  console.log('Pump Report API: Validating environment configuration...');

  const envValidation = validateEnvironmentConfig();
  if (!envValidation.isValid) {
    console.error('Pump Report API: Environment validation failed!');
    envValidation.errors.forEach(error => console.error(`  - ${error}`));
    console.error('Pump Report API: Starting in degraded mode with invalid configuration');
    app.locals.configValid = false;
    app.locals.configErrors = envValidation.errors;
  } else {
    app.locals.configValid = true;
  }

  console.log('Pump Report API: Environment configuration valid');

  // Initialize database
  const dbConnected = await initializeDatabase();
  if (!dbConnected) {
    console.error('Pump Report API: Database connection failed - running in degraded mode');
    console.error('Pump Report API: Authentication services will return errors until database is available');
    app.locals.dbConnected = false;
  } else {
    app.locals.dbConnected = true;
  }

  // Initialize email service
  initializeEmailService();

  // Start server
  app.listen(PORT, () => {
    console.log(`Pump Report API: Server running on port ${PORT}`);
    console.log(`Pump Report API: Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('Pump Report API: All systems operational');
    console.log('Pump Report API: ✅ Authentication system ready');
    console.log('Pump Report API: ✅ Database connected');

    // Start database connection monitoring
    startDatabaseMonitoring();
  });
}

// Database connection monitoring and recovery
function startDatabaseMonitoring() {
  console.log('Pump Report API: Starting database connection monitoring...');

  // Check database connection every 30 seconds
  setInterval(async () => {
    try {
      if (unifiedDatabase.isInitialized) {
        const connection = await unifiedDatabase.getConnection();
        await connection.ping();
        connection.release();

        // If we're here, database is healthy
        if (!app.locals.dbConnected) {
          console.log('Pump Report API: Database connection restored');
          app.locals.dbConnected = true;
        }
      }
    } catch (error) {
      if (app.locals.dbConnected) {
        console.error('Pump Report API: Database connection lost:', error.message);
        app.locals.dbConnected = false;
      }

      // Attempt to reconnect
      try {
        await initializeDatabase();
        if (app.locals.dbConnected) {
          console.log('Pump Report API: Database reconnection successful');
        }
      } catch (reconnectError) {
        console.error('Pump Report API: Database reconnection failed:', reconnectError.message);
      }
    }
  }, 30000); // Check every 30 seconds
}

// Validate environment configuration
function validateEnvironmentConfig() {
  const errors = [];

  // Check required environment variables
  const required = [
    'JWT_SECRET',
    'DB_HOST',
    'DB_USER',
    'DB_PASSWORD',
    'DB_DATABASE'
  ];

  required.forEach(key => {
    if (!process.env[key]) {
      errors.push(`Missing required environment variable: ${key}`);
    }
  });

  // Validate JWT secret strength
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters long');
  }

  // Check for insecure defaults
  if (process.env.JWT_SECRET === 'fallback-secret-key') {
    errors.push('JWT_SECRET is using insecure default value');
  }

  if (process.env.DB_PASSWORD === 'your_password_here' || process.env.DB_PASSWORD === '') {
    console.warn('Pump Report API: Warning - Using default/empty database password');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// Start the server
if (require.main === module) {
  startServer().catch(console.error);
}

module.exports = app;
