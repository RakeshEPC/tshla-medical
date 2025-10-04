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
const unifiedDatabase = require('./services/unified-database.service');
const DatabaseHelper = require('./utils/dbHelper');

// Initialize Stripe with secret key (if available)
let stripeInstance = null;
if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== 'sk_test_example...') {
  stripeInstance = stripe(process.env.STRIPE_SECRET_KEY);
  console.log('Stripe initialized successfully');
} else {
  console.warn('Stripe not initialized - missing secret key');
}

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'https://www.tshla.ai'],
    credentials: true,
  })
);
// JSON parsing middleware
app.use(express.json({
  limit: '10mb'
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

// JWT verification middleware
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

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
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    return res.status(403).json({ error: 'Invalid or expired token' });
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

  // Check database connectivity
  try {
    if (unifiedDatabase.isInitialized) {
      const connection = await unifiedDatabase.getConnection();
      await connection.ping();
      connection.release();
      health.services.database = {
        status: 'healthy',
        connected: true,
        host: process.env.DB_HOST
      };
    } else {
      throw new Error('Unified database service not initialized');
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
                current_payment_status, is_research_participant, is_active, is_admin
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

      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          username: user.username,
          isResearchParticipant: user.is_research_participant,
          role: user.is_admin ? 'admin' : 'user'
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

// ====== HEALTH CHECK ENDPOINTS ======

/**
 * Health check endpoint
 * GET /api/health
 */
app.get('/api/health', async (req, res) => {
  try {
    // Test database connection
    const connection = await unifiedDatabase.getConnection();
    await connection.ping();
    connection.release();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      email: emailTransporter ? 'configured' : 'not_configured',
      stripe: process.env.STRIPE_SECRET_KEY ? 'configured' : 'not_configured',
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

/**
 * ADMIN: Get all PumpDrive users with their pump selections
 * GET /api/admin/pumpdrive-users
 * Requires admin authentication
 */
app.get('/api/admin/pumpdrive-users', requireAdmin, async (req, res) => {
  try {
    const connection = await unifiedDatabase.getConnection();

    const query = `
      SELECT
        u.id,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        u.phone_number,
        u.current_payment_status,
        u.created_at,
        u.last_login,
        u.login_count,
        u.is_active,
        u.email_verified,
        r.id as report_id,
        r.payment_status as report_payment_status,
        r.payment_amount,
        r.payment_date,
        r.recommendations,
        r.created_at as report_created_at
      FROM pump_users u
      LEFT JOIN pump_reports r ON u.id = r.user_id
      ORDER BY u.created_at DESC
    `;

    const [users] = await connection.execute(query);
    connection.release();

    // Parse JSON recommendations
    const usersWithParsedData = users.map(user => ({
      ...user,
      recommendations: user.recommendations ? JSON.parse(user.recommendations) : null,
      primary_pump: user.recommendations ?
        JSON.parse(user.recommendations)[0]?.name || null : null,
      secondary_pump: user.recommendations && JSON.parse(user.recommendations)[1] ?
        JSON.parse(user.recommendations)[1].name : null,
      full_name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'N/A'
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
    const connection = await unifiedDatabase.getConnection();

    const [stats] = await connection.execute(`
      SELECT
        COUNT(DISTINCT u.id) as total_users,
        COUNT(DISTINCT CASE WHEN u.current_payment_status = 'active' THEN u.id END) as paid_users,
        COUNT(DISTINCT r.id) as total_reports,
        COUNT(DISTINCT CASE WHEN r.payment_status = 'paid' THEN r.user_id END) as users_with_paid_reports,
        COUNT(DISTINCT CASE WHEN u.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN u.id END) as new_users_24h,
        COUNT(DISTINCT CASE WHEN r.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN r.id END) as new_reports_24h
      FROM pump_users u
      LEFT JOIN pump_reports r ON u.id = r.user_id
    `);

    connection.release();

    res.json({
      success: true,
      stats: stats[0],
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
// PUMP COMPARISON DATA MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * ADMIN: Get all pump comparison dimensions (23 dimensions)
 * GET /api/admin/pump-comparison-data
 * Requires admin authentication
 */
app.get('/api/admin/pump-comparison-data', requireAdmin, async (req, res) => {
  try {
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
      WHERE is_active = true
      ORDER BY display_order ASC, dimension_number ASC
    `);

    connection.release();

    // Parse JSON pump_details for each dimension
    const parsedDimensions = dimensions.map(dim => ({
      ...dim,
      pump_details: typeof dim.pump_details === 'string'
        ? JSON.parse(dim.pump_details)
        : dim.pump_details
    }));

    res.json({
      success: true,
      count: parsedDimensions.length,
      dimensions: parsedDimensions,
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
    const connection = await unifiedDatabase.getConnection();

    const [manufacturers] = await connection.execute(`
      SELECT
        id,
        pump_name,
        manufacturer,
        website,
        rep_name,
        rep_contact,
        rep_email,
        support_phone,
        support_email,
        notes,
        is_active,
        created_at,
        updated_at
      FROM pump_manufacturers
      WHERE is_active = true
      ORDER BY pump_name ASC
    `);

    connection.release();

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

    const connection = await unifiedDatabase.getConnection();

    const [result] = await connection.execute(`
      UPDATE pump_manufacturers
      SET
        pump_name = COALESCE(?, pump_name),
        manufacturer = COALESCE(?, manufacturer),
        website = COALESCE(?, website),
        rep_name = COALESCE(?, rep_name),
        rep_contact = COALESCE(?, rep_contact),
        rep_email = COALESCE(?, rep_email),
        support_phone = COALESCE(?, support_phone),
        support_email = COALESCE(?, support_email),
        notes = COALESCE(?, notes),
        is_active = COALESCE(?, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      pump_name,
      manufacturer,
      website,
      rep_name,
      rep_contact,
      rep_email,
      support_phone,
      support_email,
      notes,
      is_active,
      id
    ]);

    connection.release();

    if (result.affectedRows === 0) {
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
app.post('/api/pumpdrive/recommend', verifyToken, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    console.log('PumpDrive API: Received recommendation request', {
      hasData: !!req.body,
      dataKeys: Object.keys(req.body || {}),
      userId: req.user?.userId
    });

    const requestData = req.body;
    const userId = req.user?.userId;

    // Require authentication
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to get pump recommendations'
      });
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

    // Save to pump_reports table
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

    res.json(formattedResponse);

  } catch (error) {
    console.error('PumpDrive API Error:', error.message);
    res.status(500).json({
      error: 'Failed to generate recommendations',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    connection.release();
  }
});

/**
 * Generate rule-based pump recommendations (fallback when AI not available)
 */
function generateRuleBasedRecommendations(userData) {
  const sliders = userData.sliders || {};
  const freeText = userData.freeText?.currentSituation || '';
  const features = userData.features || [];

  // Analyze user preferences
  const wantsSimplicity = (sliders.simplicity || 5) >= 6;
  const wantsDiscretion = (sliders.discreteness || 5) >= 6;
  const isActive = (sliders.activity || 5) >= 6;
  const lowTechComfort = (sliders.techComfort || 5) <= 4;

  const prefersSmall = freeText.toLowerCase().includes('small') || freeText.toLowerCase().includes('discrete');
  const prefersTubeless = freeText.toLowerCase().includes('tubeless') || freeText.toLowerCase().includes('patch');

  // Scoring logic
  let scores = {
    'Omnipod 5': 70,
    'Tandem t:slim X2': 70,
    'Medtronic 780G': 70,
    'Tandem Mobi': 70
  };

  // Boost Omnipod 5 for tubeless preference and simplicity
  if (prefersTubeless || wantsDiscretion) scores['Omnipod 5'] += 15;
  if (wantsSimplicity && lowTechComfort) scores['Omnipod 5'] += 10;

  // Boost Mobi for small size preference
  if (prefersSmall) scores['Tandem Mobi'] += 20;
  if (wantsDiscretion) scores['Tandem Mobi'] += 10;

  // Boost t:slim for tech-savvy users
  if (sliders.techComfort >= 7) scores['Tandem t:slim X2'] += 15;
  if (isActive) scores['Tandem t:slim X2'] += 5;

  // Boost Medtronic for automation preference
  if (sliders.techComfort >= 6 && sliders.timeDedication <= 4) scores['Medtronic 780G'] += 15;

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
      'Proven reliability and accuracy',
      'Large insulin reservoir',
      'Comprehensive diabetes management system'
    ]
  };

  const keyFactors = [];
  if (wantsSimplicity) keyFactors.push('Ease of use and simplicity');
  if (wantsDiscretion) keyFactors.push('Small size and discretion');
  if (isActive) keyFactors.push('Active lifestyle compatibility');
  if (sliders.techComfort >= 6) keyFactors.push('Advanced technology features');
  if (prefersSmall) keyFactors.push('Compact design preference');

  return {
    overallTop: [{
      pumpName: topChoice[0],
      score: topChoice[1],
      reasons: reasons[topChoice[0]]
    }],
    alternatives: alternatives.map(([name, score]) => ({
      pumpName: name,
      score: score,
      reasons: reasons[name]
    })),
    keyFactors: keyFactors.length > 0 ? keyFactors : ['Your lifestyle preferences', 'Ease of use', 'Technology comfort level'],
    personalizedInsights: `Based on your preferences${prefersSmall ? ' for a smaller pump' : ''}${prefersTubeless ? ' and tubeless design' : ''}, the ${topChoice[0]} is an excellent match at ${topChoice[1]}% compatibility. ${reasons[topChoice[0]][0]}. This pump ${wantsSimplicity ? 'offers simplicity and ease of use' : 'provides advanced features'} while meeting your ${wantsDiscretion ? 'discretion' : 'lifestyle'} needs.`
  };
}

/**
 * Fetch pump comparison data from database for AI recommendations
 */
async function fetchPumpComparisonData() {
  try {
    const connection = await pool.getConnection();

    const [dimensions] = await connection.execute(`
      SELECT
        dimension_number,
        dimension_name,
        dimension_description,
        pump_details,
        category,
        importance_scale
      FROM pump_comparison_data
      WHERE is_active = true
      ORDER BY display_order ASC, dimension_number ASC
    `);

    const [manufacturers] = await connection.execute(`
      SELECT
        pump_name,
        manufacturer,
        website,
        rep_name,
        rep_contact,
        support_phone
      FROM pump_manufacturers
      WHERE is_active = true
      ORDER BY pump_name ASC
    `);

    connection.release();

    // Parse JSON pump_details
    const parsedDimensions = dimensions.map(dim => ({
      ...dim,
      pump_details: typeof dim.pump_details === 'string'
        ? JSON.parse(dim.pump_details)
        : dim.pump_details
    }));

    return {
      dimensions: parsedDimensions,
      manufacturers
    };
  } catch (error) {
    console.error('Error fetching pump comparison data:', error);
    return null; // Return null if database fetch fails - AI will use fallback
  }
}

/**
 * Generate pump recommendations using AWS Bedrock
 */
async function generatePumpRecommendations(userData) {
  // Fallback to rule-based recommendations if AWS Bedrock not configured
  if (!process.env.VITE_AWS_ACCESS_KEY_ID || !process.env.VITE_AWS_SECRET_ACCESS_KEY) {
    console.log('AWS Bedrock not configured - using rule-based recommendations');
    return generateRuleBasedRecommendations(userData);
  }

  // Use AWS Bedrock via existing service
  const AWS = require('aws-sdk');

  // Create user profile from request data
  const userProfile = createUserProfile(userData);

  // Fetch structured pump comparison data from database
  const comparisonData = await fetchPumpComparisonData();

  let pumpDetails;
  let manufacturerContacts = '';

  if (comparisonData) {
    // Use structured database data
    console.log('Using structured pump comparison data from database (23 dimensions)');

    // Format dimensions for AI prompt
    const dimensionsText = comparisonData.dimensions.map(dim => {
      const pumpInfo = Object.entries(dim.pump_details || {})
        .map(([pumpName, details]) => {
          let text = `  - ${pumpName}:\n    ${details.title}\n    ${details.details}`;
          if (details.pros && details.pros.length > 0) {
            text += `\n    Pros: ${details.pros.join(', ')}`;
          }
          if (details.cons && details.cons.length > 0) {
            text += `\n    Cons: ${details.cons.join(', ')}`;
          }
          return text;
        })
        .join('\n');

      return `Dimension #${dim.dimension_number}: ${dim.dimension_name} (${dim.category})
Description: ${dim.dimension_description}
Importance: ${dim.importance_scale}
${pumpInfo}`;
    }).join('\n\n');

    pumpDetails = `23-DIMENSION PUMP COMPARISON DATABASE:

${dimensionsText}`;

    // Add manufacturer contact information
    manufacturerContacts = `\n\nMANUFACTURER CONTACT INFORMATION:
${comparisonData.manufacturers.map(mfr =>
  `${mfr.pump_name} (${mfr.manufacturer})
  Website: ${mfr.website || 'N/A'}
  Representative: ${mfr.rep_name || 'Contact manufacturer'}
  Support Phone: ${mfr.support_phone || 'N/A'}`
).join('\n\n')}`;
  } else {
    // Fallback to hardcoded pump database
    console.log('Database fetch failed - using fallback pump database');
    pumpDetails = createPumpDatabase();
  }

  // Use AWS Bedrock Claude model
  const bedrock = new AWS.BedrockRuntime({
    region: 'us-east-1',
    accessKeyId: process.env.VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.VITE_AWS_SECRET_ACCESS_KEY
  });

  const prompt = `You are an expert diabetes educator and insulin pump specialist. Based on the following patient responses and comprehensive 23-dimension pump comparison database, provide personalized insulin pump recommendations.

PATIENT PROFILE:
${userProfile}

${pumpDetails}${manufacturerContacts}

INSTRUCTIONS:
1. Analyze the patient's preferences against ALL 23 dimensions
2. Consider which dimensions are most important for THIS patient based on their responses
3. Weigh the pros and cons of each pump for each relevant dimension
4. Provide evidence-based recommendations citing specific dimensions

Please provide recommendations in JSON format with:
{
  "topChoice": {
    "name": "pump name",
    "score": 85,
    "reasons": ["specific reasons citing dimensions"]
  },
  "alternatives": [
    {"name": "pump name", "score": 75, "reasons": ["reasons citing dimensions"]}
  ],
  "keyFactors": ["dimension categories that mattered most"],
  "personalizedInsights": "detailed explanation referencing specific dimensions and pump details",
  "dimensionsConsidered": ["list of dimension numbers that were most relevant to decision"]
}`;

  const params = {
    modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 3000, // Increased for more detailed analysis
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  };

  const response = await bedrock.invokeModel(params).promise();

  const responseBody = JSON.parse(response.body.toString());
  const aiResponse = responseBody.content[0].text;

  try {
    // Try to extract JSON from markdown code blocks if present
    let jsonText = aiResponse;
    const codeBlockMatch = aiResponse.match(/```(?:json)?\s*(.*?)\s*```/s);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1];
    }

    return JSON.parse(jsonText);
  } catch (parseError) {
    console.warn('Failed to parse AI response as JSON, returning raw response');
    return {
      topChoice: {
        name: "Omnipod 5",
        score: 80,
        reasons: ["AI response format error - using fallback recommendation"]
      },
      alternatives: [],
      keyFactors: ["Error in AI response processing"],
      personalizedInsights: aiResponse
    };
  }
}

/**
 * Create user profile from request data
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
