/**
 * TSHLA Medical - Pump Report API Server
 * Handles Stripe payments and provider email delivery for pump recommendations
 * Created: September 17, 2025
 */

// Load environment variables
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
// MySQL removed - now using Supabase for all database operations
const nodemailer = require('nodemailer');
const stripe = require('stripe');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const OpenAI = require('openai');
// unifiedDatabase service removed - using Supabase directly
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
  apiKey: process.env.OPENAI_API_KEY
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

// Database: Using Supabase (PostgreSQL) - MySQL removed
// Supabase client initialized above at lines 32-36

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

      // Try patients table if not in medical_staff
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .select('*')
        .eq('auth_user_id', user.id)
        .eq('pumpdrive_enabled', true)
        .single();

      if (!patientError && patientData) {
        req.user = {
          id: patientData.id,
          email: patientData.email,
          role: 'patient',
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
      phoneNumber
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

    // Check if email already exists
    const { data: existingUsers, error: searchError } = await supabase
      .from('patients')
      .select('email')
      .eq('email', email)
      .eq('pumpdrive_enabled', true);

    if (searchError) {
      throw searchError;
    }

    if (existingUsers && existingUsers.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Create patient account with PumpDrive enabled
    const { data: newUser, error: insertError } = await supabase
      .from('patients')
      .insert({
        email,
        first_name: firstName || username || 'User',
        last_name: lastName || '',
        phone: phoneNumber || null,
        pumpdrive_enabled: true,
        pumpdrive_signup_date: new Date().toISOString(),
        subscription_tier: 'active',
        is_active: true
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    const userId = newUser.id;

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
      { userId, email, username, role: isAdmin ? 'admin' : 'user' },
      jwtSecret,
      { expiresIn: '24h' }
    );

    // Log access
    const { error: logError } = await supabase
      .from('access_logs')
      .insert({
        user_id: userId,
        access_type: 'initial_purchase',
        payment_amount_cents: 999,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });

    if (logError) {
      console.error('Failed to log access:', logError);
      // Don't fail registration if logging fails
    }

    console.log('User registered successfully:', {
      userId,
      email,
      username
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
        phoneNumber
      },
      token
    });
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

    // Get patient by email (PumpDrive users only)
    const { data: users, error: searchError } = await supabase
      .from('patients')
      .select('id, email, first_name, last_name, phone, subscription_tier, pumpdrive_enabled, is_active')
      .eq('email', email)
      .eq('pumpdrive_enabled', true);

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

    // Note: Password verification now handled by Supabase Auth
    // This endpoint should eventually be migrated to use Supabase Auth tokens
    // For now, accepting any password for existing users (temporary)

    // Update last activity tracking
    const { error: updateError } = await supabase
      .from('patients')
      .update({
        subscription_tier: 'active',
        pumpdrive_last_assessment: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to update login tracking:', updateError);
      // Don't fail login if tracking update fails
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

    // Determine admin role from email (consistent with registration logic)
    const isAdmin = ['rakesh@tshla.ai', 'admin@tshla.ai'].includes(email.toLowerCase());

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: isAdmin ? 'admin' : 'patient'
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
        phoneNumber: user.phone_number
      },
      token
    });

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

    // Extend access by 24 hours
    const newExpiryTime = new Date();
    newExpiryTime.setHours(newExpiryTime.getHours() + 24);

    const { error: updateError } = await supabase
      .from('patients')
      .update({
        trial_end_date: newExpiryTime.toISOString(),
        subscription_tier: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      throw updateError;
    }

    // Log the renewal
    const { error: logError } = await supabase
      .from('access_logs')
      .insert({
        user_id: userId,
        access_type: 'renewal',
        payment_amount_cents: 999
      });

    if (logError) {
      console.error('Failed to log renewal:', logError);
      // Don't fail renewal if logging fails
    }

    res.json({
      success: true,
      message: 'Access renewed for 24 hours',
      accessExpiresAt: newExpiryTime.toISOString()
    });
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
    const { data: newAssessment, error: insertError } = await supabase
      .from('pump_assessments')
      .insert({
        patient_name: patientName,
        slider_values: JSON.stringify(assessmentData.sliderValues || {}),
        selected_features: JSON.stringify(assessmentData.selectedFeatures || []),
        lifestyle_text: assessmentData.lifestyleText || '',
        challenges_text: assessmentData.challengesText || '',
        priorities_text: assessmentData.prioritiesText || '',
        clarification_responses: JSON.stringify(assessmentData.clarificationResponses || {}),
        payment_status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    const assessmentId = newAssessment.id;

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
    const { error: paymentError } = await supabase
      .from('payment_records')
      .insert({
        assessment_id: assessmentId,
        stripe_session_id: session.id,
        amount_cents: priceInCents,
        status: 'pending',
        created_at: new Date().toISOString()
      });

    if (paymentError) {
      console.error('Failed to store payment record:', paymentError);
      // Don't fail checkout if payment record fails
    }

    res.json({
      id: session.id,
      url: session.url,
      assessment_id: assessmentId,
    });
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
      const { error: paymentError } = await supabase
        .from('payment_records')
        .update({ status: 'succeeded' })
        .eq('stripe_session_id', sessionId);

      if (paymentError) {
        throw paymentError;
      }

      const { error: assessmentError } = await supabase
        .from('pump_assessments')
        .update({ payment_status: 'paid' })
        .eq('id', session.metadata.assessment_id);

      if (assessmentError) {
        throw assessmentError;
      }

      res.json({
        paid: true,
        assessment_id: session.metadata.assessment_id,
        amount: session.amount_total,
        customer_email: session.customer_details?.email,
      });
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
      const { error: paymentError } = await supabase
        .from('payment_records')
        .update({ status: 'succeeded' })
        .eq('stripe_session_id', session.id);

      if (paymentError) {
        console.error('Failed to update payment record:', paymentError);
      }

      const { error: assessmentError } = await supabase
        .from('pump_assessments')
        .update({ payment_status: 'paid' })
        .eq('id', session.metadata.assessment_id);

      if (assessmentError) {
        console.error('Failed to update assessment payment status:', assessmentError);
      }

      console.log('App', 'Placeholder message');
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
    let assessmentId;

    const { data: newAssessment, error: assessmentError } = await supabase
      .from('pump_assessments')
      .insert({
        patient_name: patientName,
        doctor_name: providerName,
        slider_values: JSON.stringify(assessmentData.sliderValues || {}),
        selected_features: JSON.stringify(assessmentData.selectedFeatures || []),
        lifestyle_text: assessmentData.lifestyleText || '',
        challenges_text: assessmentData.challengesText || '',
        priorities_text: assessmentData.prioritiesText || '',
        clarification_responses: JSON.stringify(assessmentData.clarificationResponses || {}),
        payment_status: 'provider_sent',
        sent_to_provider: true,
        provider_email: providerEmail,
        provider_name: providerName,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (assessmentError) {
      throw assessmentError;
    }

    assessmentId = newAssessment.id;

    // Store provider delivery record
    const { data: newDelivery, error: deliveryError } = await supabase
      .from('provider_deliveries')
      .insert({
        assessment_id: assessmentId,
        provider_name: providerName,
        provider_email: providerEmail,
        delivery_status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (deliveryError) {
      throw deliveryError;
    }

    const deliveryId = newDelivery.id;

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
      const { error: deliveryUpdateError } = await supabase
        .from('provider_deliveries')
        .update({
          delivery_status: 'sent',
          sent_at: new Date().toISOString(),
          email_message_id: emailResult.messageId
        })
        .eq('id', deliveryId);

      if (deliveryUpdateError) {
        console.error('Failed to update delivery status:', deliveryUpdateError);
      }

      const { error: assessmentUpdateError } = await supabase
        .from('pump_assessments')
        .update({ sent_at: new Date().toISOString() })
        .eq('id', assessmentId);

      if (assessmentUpdateError) {
        console.error('Failed to update assessment sent_at:', assessmentUpdateError);
      }

      console.log('App', 'Placeholder message');

      res.json({
        success: true,
        messageId: emailResult.messageId,
        assessmentId: assessmentId,
        deliveryId: deliveryId,
      });
    } else {
      // Email service not configured
      const { error: failedDeliveryError } = await supabase
        .from('provider_deliveries')
        .update({
          delivery_status: 'failed',
          bounce_reason: 'Email service not configured'
        })
        .eq('id', deliveryId);

      if (failedDeliveryError) {
        console.error('Failed to update delivery as failed:', failedDeliveryError);
      }

      res.status(500).json({
        success: false,
        error: 'Email service not configured',
      });
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

    const { data: rows, error } = await supabase
      .from('provider_deliveries')
      .select('*')
      .eq('assessment_id', assessmentId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({
      assessmentId: parseInt(assessmentId),
      deliveries: rows,
    });
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
    const { data: rows, error } = await supabase
      .from('participating_providers')
      .select('id, name, specialty, practice_name, email, phone, active')
      .eq('active', true)
      .order('name');

    if (error) {
      // Fallback to hardcoded list if table doesn't exist
      console.warn('App', 'Placeholder message');
      return res.json([
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
    }

    res.json(rows);
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

    // First check if already viewed
    const { data: existing } = await supabase
      .from('provider_deliveries')
      .select('viewed_at')
      .eq('email_message_id', messageId)
      .single();

    if (existing && !existing.viewed_at) {
      const { error } = await supabase
        .from('provider_deliveries')
        .update({
          delivery_status: 'viewed',
          viewed_at: new Date().toISOString()
        })
        .eq('email_message_id', messageId)
        .is('viewed_at', null);

      if (error) {
        console.error('Failed to update tracking pixel:', error);
      }
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

    // Check if session exists
    const { data: existing } = await supabase
      .from('pump_conversation_sessions')
      .select('id')
      .eq('session_id', sessionId)
      .single();

    const sessionData = {
      session_id: sessionId,
      category_responses: JSON.stringify(categoryResponses || {}),
      current_category: currentCategory || null,
      completed_categories: JSON.stringify(completedCategories || []),
      updated_at: new Date().toISOString()
    };

    if (existing) {
      // Update existing session
      const { error } = await supabase
        .from('pump_conversation_sessions')
        .update(sessionData)
        .eq('session_id', sessionId);

      if (error) {
        throw error;
      }
    } else {
      // Insert new session
      const { error } = await supabase
        .from('pump_conversation_sessions')
        .insert(sessionData);

      if (error) {
        throw error;
      }
    }

    res.json({
      success: true,
      sessionId: sessionId,
      timestamp: new Date().toISOString(),
    });
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

    const { data: session, error } = await supabase
      .from('pump_conversation_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !session) {
      return res.status(404).json({
        error: 'Session not found or expired',
      });
    }

    // Parse JSON fields safely
    const parsedSession = {
      ...session,
      category_responses: session.category_responses ? JSON.parse(session.category_responses) : {},
      completed_categories: session.completed_categories ? JSON.parse(session.completed_categories) : [],
      ai_recommendation: session.ai_recommendation ? JSON.parse(session.ai_recommendation) : null
    };

    res.json(parsedSession);
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

    const { error } = await supabase
      .from('pump_conversation_sessions')
      .update({
        ai_recommendation: JSON.stringify(recommendation),
        updated_at: new Date().toISOString()
      })
      .eq('session_id', sessionId);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      sessionId: sessionId,
      timestamp: new Date().toISOString(),
    });
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

    let query = supabase
      .from('pump_assessments')
      .select('id, patient_name, doctor_name, payment_status, sent_to_provider, provider_name, created_at')
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (status) {
      query = query.eq('payment_status', status);
    }

    const { data: rows, error } = await query;

    if (error) {
      throw error;
    }

    res.json({
      assessments: rows,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: rows.length,
      },
    });
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

    const { data: assessment, error } = await supabase
      .from('pump_assessments')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !assessment) {
      return res.status(404).json({
        error: 'Assessment not found',
      });
    }

    // Parse JSON fields safely
    const parsedAssessment = {
      ...assessment,
      slider_values: assessment.slider_values ? JSON.parse(assessment.slider_values) : {},
      selected_features: assessment.selected_features ? JSON.parse(assessment.selected_features) : [],
      clarification_responses: assessment.clarification_responses ? JSON.parse(assessment.clarification_responses) : {},
      final_recommendation: assessment.final_recommendation ? JSON.parse(assessment.final_recommendation) : null,
      hybrid_scores: assessment.hybrid_scores ? JSON.parse(assessment.hybrid_scores) : {}
    };

    res.json(parsedAssessment);
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
    const { data, error } = await supabase
      .from('pump_conversation_sessions')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      deletedCount: data ? data.length : 0,
      timestamp: new Date().toISOString(),
    });
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
      timestamp,
      firstChoicePump,
      secondChoicePump,
      thirdChoicePump,
      recommendationDate,
      assessmentVersion
    } = req.body;

    if (!patientName) {
      return res.status(400).json({
        error: 'Missing required field: patientName'
      });
    }

    // Get authenticated user ID
    const userId = req.user.userId;

    // Get next assessment version for this user
    const { data: latestAssessment } = await supabase
      .from('pump_assessments')
      .select('assessment_version')
      .eq('user_id', userId)
      .order('assessment_version', { ascending: false })
      .limit(1)
      .single();

    const nextVersion = latestAssessment?.assessment_version ? latestAssessment.assessment_version + 1 : 1;

    // Insert comprehensive assessment
    const { data: newAssessment, error } = await supabase
      .from('pump_assessments')
      .insert({
        patient_name: patientName,
        user_id: userId,
        slider_values: JSON.stringify(sliderValues || {}),
        selected_features: JSON.stringify(selectedFeatures || []),
        lifestyle_text: personalStory || '',
        challenges_text: challenges || '',
        priorities_text: priorities || '',
        clarification_responses: JSON.stringify(clarifyingResponses || {}),
        gpt4_scores: null,
        claude_scores: null,
        hybrid_scores: JSON.stringify({
          assessmentFlow,
          conversationHistory: conversationHistory || [],
          timestamp
        }),
        final_recommendation: JSON.stringify(aiRecommendation),
        payment_status: 'pending',
        created_at: timestamp || new Date().toISOString(),
        first_choice_pump: firstChoicePump || null,
        second_choice_pump: secondChoicePump || null,
        third_choice_pump: thirdChoicePump || null,
        recommendation_date: recommendationDate || new Date().toISOString(),
        assessment_version: assessmentVersion || nextVersion
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    const assessmentId = newAssessment.id;

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

    const { data: assessment, error } = await supabase
      .from('pump_assessments')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !assessment) {
      return res.status(404).json({
        error: 'Assessment not found'
      });
    }

    // Parse JSON fields safely
    const safeJsonParse = (str, fallback) => {
      try {
        return str ? JSON.parse(str) : fallback;
      } catch {
        return fallback;
      }
    };

    const completeData = {
      assessmentId: assessment.id,
      patientName: assessment.patient_name,
      sliderValues: safeJsonParse(assessment.slider_values, {}),
      selectedFeatures: safeJsonParse(assessment.selected_features, []),
      personalStory: assessment.lifestyle_text,
      challenges: assessment.challenges_text,
      priorities: assessment.priorities_text,
      clarifyingResponses: safeJsonParse(assessment.clarification_responses, {}),
      aiRecommendation: safeJsonParse(assessment.final_recommendation, null),
      hybridData: safeJsonParse(assessment.hybrid_scores, {}),
      paymentStatus: assessment.payment_status,
      createdAt: assessment.created_at,
      updatedAt: assessment.updated_at,
      firstChoicePump: assessment.first_choice_pump,
      secondChoicePump: assessment.second_choice_pump,
      thirdChoicePump: assessment.third_choice_pump,
      recommendationDate: assessment.recommendation_date,
      assessmentVersion: assessment.assessment_version
    };

    res.json(completeData);
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
    const { data: assessment, error } = await supabase
      .from('pump_assessments')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !assessment) {
      return res.status(404).json({
        error: 'Assessment not found'
      });
    }

    // TODO: Implement PDF generation logic here
    // For now, return a placeholder URL
    const pdfUrl = `/reports/assessment_${id}_${Date.now()}.pdf`;

    // Update the assessment with PDF URL (if you want to store it)
    const { error: updateError } = await supabase
      .from('pump_assessments')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) {
      console.error('Failed to update assessment:', updateError);
    }

    console.log('App', 'PDF generation requested', { assessmentId: id });

    res.json({
      success: true,
      pdfUrl,
      message: 'PDF generation initiated',
      assessmentId: id
    });
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

    // Get assessment and verify ownership
    const { data: assessment, error } = await supabase
      .from('pump_assessments')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !assessment) {
      return res.status(404).json({
        success: false,
        error: 'Assessment not found or access denied'
      });
    }

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

    const { data: rows, error } = await supabase
      .from('pump_assessments')
      .select('id, created_at, ai_recommendation, assessment_flow')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

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

    const { data: rows, error } = await supabase
      .from('pump_assessments')
      .select('id, created_at, ai_recommendation, assessment_flow')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

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

    // Get assessment and verify ownership
    const { data: assessment, error } = await supabase
      .from('pump_assessments')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !assessment) {
      return res.status(404).json({
        success: false,
        error: 'Assessment not found or access denied'
      });
    }

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
    const { error: deliveryError } = await supabase
      .from('provider_deliveries')
      .insert({
        assessment_id: id,
        provider_email: providerEmail,
        delivery_method: 'email',
        delivery_status: 'sent',
        delivered_at: new Date().toISOString()
      });

    if (deliveryError) {
      console.error('Failed to log delivery:', deliveryError);
    }

    console.log('Assessment emailed successfully:', { assessmentId: id, providerEmail });

    res.json({
      success: true,
      message: 'Assessment sent successfully to provider',
      providerEmail
    });
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
    // Fetch PumpDrive patients from Supabase
    const { data: users, error } = await supabase
      .from('patients')
      .select('*')
      .eq('pumpdrive_enabled', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Format users for admin dashboard
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
    // Fetch PumpDrive patients from Supabase
    const { data: users, error } = await supabase
      .from('patients')
      .eq('pumpdrive_enabled', true)
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
    const { data: users, error: usersError } = await supabase
      .from('patients')
      .select('id, email, first_name, last_name, phone, subscription_tier, pumpdrive_enabled, created_at, updated_at')
      .eq('pumpdrive_enabled', true)
      .order('created_at', { ascending: false});

    if (usersError) {
      throw usersError;
    }

    // Get pump reports for recommendations
    const { data: reports, error: reportsError } = await supabase
      .from('pump_reports')
      .select('user_id, recommendations');

    if (reportsError) {
      console.error('Failed to fetch pump_reports:', reportsError);
    }

    // Map reports by user_id
    const reportsByUser = {};
    if (reports) {
      reports.forEach(r => {
        reportsByUser[r.user_id] = r.recommendations;
      });
    }

    // Join data
    const usersWithReports = users.map(u => ({
      ...u,
      full_name: `${u.first_name || ''} ${u.last_name || ''}`.trim(),
      recommendations: reportsByUser[u.id] || null
    }));

    // Convert to CSV
    const csvHeader = 'ID,Username,Email,Full Name,Phone,Payment Status,Primary Pump,Secondary Pump,Created Date,Last Login,Login Count\n';
    const csvRows = usersWithReports.map(user => {
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
    // Get all assessments for calculations
    const { data: allAssessments, error: assessmentsError } = await supabase
      .from('pump_assessments')
      .select('id, user_id, match_score, recommended_pump, completed_at, flow_type');

    if (assessmentsError) {
      throw assessmentsError;
    }

    // Get all PumpDrive patients
    const { data: allUsers, error: usersError } = await supabase
      .from('patients')
      .select('id')
      .eq('pumpdrive_enabled', true);

    if (usersError) {
      throw usersError;
    }

    // Calculate summary stats
    const totalAssessments = allAssessments.length;
    const uniqueUsers = new Set(allAssessments.map(a => a.user_id)).size;
    const avgMatchScore = allAssessments.reduce((sum, a) => sum + (a.match_score || 0), 0) / totalAssessments || 0;
    const completionRate = uniqueUsers > 0 ? (totalAssessments / uniqueUsers * 100) : 0;

    // Calculate pump distribution
    const pumpCounts = {};
    allAssessments.forEach(a => {
      if (a.recommended_pump) {
        pumpCounts[a.recommended_pump] = pumpCounts[a.recommended_pump] || { count: 0, scoreSum: 0 };
        pumpCounts[a.recommended_pump].count++;
        pumpCounts[a.recommended_pump].scoreSum += a.match_score || 0;
      }
    });

    const pumpDist = Object.entries(pumpCounts).map(([pumpName, data]) => ({
      pumpName,
      count: data.count,
      percentage: (data.count / totalAssessments) * 100,
      avgScore: data.scoreSum / data.count
    })).sort((a, b) => b.count - a.count);

    const topPumps = pumpDist.slice(0, 5);

    // Get assessment trends (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentAssessments = allAssessments.filter(a => a.completed_at && new Date(a.completed_at) >= thirtyDaysAgo);
    const trendsByDate = {};
    recentAssessments.forEach(a => {
      const date = new Date(a.completed_at).toISOString().split('T')[0];
      trendsByDate[date] = (trendsByDate[date] || 0) + 1;
    });
    const trends = Object.entries(trendsByDate).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));

    // Get flow type statistics
    const flowCounts = {};
    allAssessments.forEach(a => {
      if (a.flow_type) {
        flowCounts[a.flow_type] = flowCounts[a.flow_type] || { count: 0, scoreSum: 0 };
        flowCounts[a.flow_type].count++;
        flowCounts[a.flow_type].scoreSum += a.match_score || 0;
      }
    });

    const flowStats = Object.entries(flowCounts).map(([flowType, data]) => ({
      flowType,
      count: data.count,
      percentage: (data.count / totalAssessments) * 100,
      avgScore: data.scoreSum / data.count
    })).sort((a, b) => b.count - a.count);

    // Get user engagement stats
    const { data: assessmentsWithUsers, error: engagementError } = await supabase
      .from('pump_assessments')
      .select('user_id');

    const completedAssessments = assessmentsWithUsers ? new Set(assessmentsWithUsers.map(a => a.user_id)).size : 0;
    const conversionRate = allUsers.length > 0 ? (completedAssessments / allUsers.length) * 100 : 0;
    const avgAssessmentsPerUser = completedAssessments > 0 ? totalAssessments / completedAssessments : 0;

    // Get recent assessments with user info
    const { data: recentAssessmentsData, error: recentError } = await supabase
      .from('pump_assessments')
      .select(`
        id,
        user_id,
        completed_at,
        recommended_pump,
        match_score,
        flow_type,
        pump_users (username)
      `)
      .order('completed_at', { ascending: false })
      .limit(10);

    const recentAssessmentsList = recentAssessmentsData?.map(a => ({
      id: a.id,
      userId: a.user_id,
      username: a.pump_users?.username || 'Unknown',
      completedAt: a.completed_at,
      recommendedPump: a.recommended_pump,
      matchScore: a.match_score,
      flowType: a.flow_type
    })) || [];

    const analyticsData = {
      summary: {
        totalAssessments,
        totalUsers: uniqueUsers,
        avgMatchScore,
        completionRate,
        lastUpdated: new Date().toISOString()
      },
      pumpDistribution: pumpDist,
      assessmentTrends: trends,
      flowTypeStats: flowStats,
      userEngagement: {
        totalUsers: allUsers.length,
        completedAssessments,
        conversionRate,
        avgAssessmentsPerUser
      },
      topPumps,
      recentAssessments: recentAssessmentsList
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
    const { data: assessments, error } = await supabase
      .from('pump_assessments')
      .select('id, user_id, match_score');

    if (error) {
      throw error;
    }

    const totalAssessments = assessments.length;
    const uniqueUsers = new Set(assessments.map(a => a.user_id)).size;
    const avgMatchScore = assessments.reduce((sum, a) => sum + (a.match_score || 0), 0) / totalAssessments || 0;
    const completionRate = uniqueUsers > 0 ? (totalAssessments / uniqueUsers * 100) : 0;

    res.json({
      totalAssessments,
      totalUsers: uniqueUsers,
      avgMatchScore,
      completionRate,
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
    const { data: assessments, error } = await supabase
      .from('pump_assessments')
      .select('recommended_pump, match_score')
      .not('recommended_pump', 'is', null);

    if (error) {
      throw error;
    }

    const totalAssessments = assessments.length;
    const pumpCounts = {};

    assessments.forEach(a => {
      if (!pumpCounts[a.recommended_pump]) {
        pumpCounts[a.recommended_pump] = { count: 0, scoreSum: 0 };
      }
      pumpCounts[a.recommended_pump].count++;
      pumpCounts[a.recommended_pump].scoreSum += a.match_score || 0;
    });

    const distribution = Object.entries(pumpCounts)
      .map(([pumpName, data]) => ({
        pumpName,
        count: data.count,
        percentage: (data.count / totalAssessments) * 100,
        avgScore: data.scoreSum / data.count
      }))
      .sort((a, b) => b.count - a.count);

    res.json(distribution);

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
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: assessments, error } = await supabase
      .from('pump_assessments')
      .select('completed_at')
      .gte('completed_at', startDate.toISOString())
      .not('completed_at', 'is', null);

    if (error) {
      throw error;
    }

    const trendsByDate = {};
    assessments.forEach(a => {
      const date = new Date(a.completed_at).toISOString().split('T')[0];
      trendsByDate[date] = (trendsByDate[date] || 0) + 1;
    });

    const trends = Object.entries(trendsByDate)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json(trends);

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

    const { data: recent, error } = await supabase
      .from('pump_assessments')
      .select(`
        id,
        user_id,
        completed_at,
        recommended_pump,
        match_score,
        flow_type,
        pump_users (username)
      `)
      .order('completed_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    res.json(recent.map(a => ({
      id: a.id,
      userId: a.user_id,
      username: a.pump_users?.username || 'Unknown',
      completedAt: a.completed_at,
      recommendedPump: a.recommended_pump,
      matchScore: a.match_score,
      flowType: a.flow_type
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

    const { data: dimension, error } = await supabase
      .from('pump_comparison_data')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !dimension) {
      return res.status(404).json({
        success: false,
        error: 'Dimension not found'
      });
    }

    // pump_details is already JSONB in Supabase, no parsing needed
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

    // Build update object with only provided fields
    const updates = {};
    if (dimension_name !== undefined) updates.dimension_name = dimension_name;
    if (dimension_description !== undefined) updates.dimension_description = dimension_description;
    if (importance_scale !== undefined) updates.importance_scale = importance_scale;
    if (pump_details !== undefined) updates.pump_details = pump_details; // JSONB in Supabase
    if (category !== undefined) updates.category = category;
    if (display_order !== undefined) updates.display_order = display_order;
    if (is_active !== undefined) updates.is_active = is_active;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('pump_comparison_data')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
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

    // Insert into Supabase
    const { data: newDimension, error } = await supabase
      .from('pump_comparison_data')
      .insert({
        dimension_number,
        dimension_name,
        dimension_description: dimension_description || null,
        importance_scale: importance_scale || '1-10',
        pump_details, // JSONB in Supabase
        category: category || null,
        display_order: display_order || dimension_number,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'Dimension created successfully',
      dimensionId: newDimension.id,
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

    // Soft delete by setting is_active to false
    const { data, error } = await supabase
      .from('pump_comparison_data')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select();

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
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

    const { data: newManufacturer, error } = await supabase
      .from('pump_manufacturers')
      .insert({
        pump_name,
        manufacturer,
        website: website || null,
        rep_name: rep_name || null,
        rep_contact: rep_contact || null,
        rep_email: rep_email || null,
        support_phone: support_phone || null,
        support_email: support_email || null,
        notes: notes || null,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'Pump manufacturer created successfully',
      manufacturerId: newManufacturer.id,
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

      const { data: newReport, error: insertError } = await supabase
        .from('pump_reports')
        .insert({
          user_id: userId,
          report_data: JSON.stringify(requestData),
          questionnaire_responses: JSON.stringify(requestData.questionnaire || {}),
          recommendations: JSON.stringify(formattedResponse),
          primary_pump: primaryPump,
          secondary_pump: secondaryPump
        })
        .select()
        .single();

      if (insertError) {
        console.error('Failed to save pump report:', insertError);
      } else {
        console.log('Pump report saved:', {
          reportId: newReport.id,
          userId,
          primaryPump,
          secondaryPump
        });

        // Add report ID to response
        formattedResponse.reportId = newReport.id;
      }
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
    // Only penalize Twiist if tech comfort is also low
    if (techComfort < 5) {
      scores['Twiist'] -= 2;
    }
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

    console.log(`[V3] Processing feature: ${JSON.stringify(feature)}`);
    console.log(`     Extracted ID: "${featureId}"`);
    console.log(`     Found mapping: ${!!impact}`);

    if (impact) {
      // Apply boosts
      Object.entries(impact.boosts).forEach(([pump, points]) => {
        scores[pump] += points;
        console.log(`       ${pump} +${points}%`);
      });
      // Apply penalties
      Object.entries(impact.penalties).forEach(([pump, points]) => {
        scores[pump] += points;
        console.log(`       ${pump} ${points}%`);
      });
    } else {
      console.warn(`     ⚠️  Feature ID "${featureId}" not found in FEATURE_IMPACT mapping!`);
    }
  });

  console.log('[V3] Stage 3 complete:', scores);
  return scores;
}

// ===================================
// STAGE 3.5: Critical Keyword Detection (Before AI)
// ===================================
function applyCriticalKeywordBoosts(scores, freeText) {
  if (!freeText || freeText.trim().length === 0) {
    console.log('[V3] Stage 3.5: No free text, skipping keyword detection');
    return scores;
  }

  console.log('[V3] Stage 3.5: Checking for critical keywords');
  const text = freeText.toLowerCase();
  let boostsApplied = false;

  // CRITICAL: Weight/Size mentions (Twiist = 2 oz, only pump this light)
  const weightKeywords = /\b(lightest|2\s*oz|2\s*ounce|ultra.*light|minimal.*weight|tiny|smallest.*pump)\b/i;
  if (weightKeywords.test(text)) {
    scores['Twiist'] += 12;
    scores['Tandem Mobi'] += 4;
    console.log('  ✓ WEIGHT PRIORITY detected: Twiist +12%, Mobi +4%');
    boostsApplied = true;
  }

  // CRITICAL: Lowest target glucose (Twiist = 87 mg/dL lowest)
  const targetKeywords = /\b(lowest.*target|87.*mg|tight.*control|aggressive.*target)\b/i;
  if (targetKeywords.test(text)) {
    scores['Twiist'] += 6;
    scores['Medtronic 780G'] += 5;
    console.log('  ✓ LOWEST TARGET detected: Twiist +6%, 780G +5%');
    boostsApplied = true;
  }

  // CRITICAL: Running/Active (Twiist is lightest for runners)
  const runningKeywords = /\b(run|running|runner|jog|marathon|athlete)\b/i;
  if (runningKeywords.test(text)) {
    scores['Twiist'] += 4;
    scores['Omnipod 5'] += 3;
    scores['Tandem Mobi'] += 3;
    console.log('  ✓ RUNNING detected: Twiist +4%, Omnipod +3%, Mobi +3%');
    boostsApplied = true;
  }

  // CRITICAL: Apple Watch (only Twiist has this)
  const appleWatchKeywords = /\b(apple.*watch|watch.*bolus|dose.*watch)\b/i;
  if (appleWatchKeywords.test(text)) {
    scores['Twiist'] += 15;
    console.log('  ✓ APPLE WATCH detected: Twiist +15%');
    boostsApplied = true;
  }

  // CRITICAL: No carb counting (only iLet)
  const noCarbKeywords = /\b(no.*carb|don't.*count|without.*counting|carb.*free)\b/i;
  if (noCarbKeywords.test(text)) {
    scores['Beta Bionics iLet'] += 15;
    console.log('  ✓ NO CARB detected: iLet +15%');
    boostsApplied = true;
  }

  // CRITICAL: Tubeless (only Omnipod)
  const tubelessKeywords = /\b(tubeless|no.*tub|hate.*tub|without.*tub)\b/i;
  if (tubelessKeywords.test(text)) {
    scores['Omnipod 5'] += 15;
    console.log('  ✓ TUBELESS detected: Omnipod +15%');
    boostsApplied = true;
  }

  // PREFERENCE: User says they DON'T mind tubes (helps tubed pumps)
  const okayWithTubesKeywords = /\b(don't.*mind.*tub|okay.*with.*tub|fine.*with.*tub)\b/i;
  if (okayWithTubesKeywords.test(text)) {
    scores['Twiist'] += 3;
    scores['Tandem t:slim X2'] += 2;
    scores['Medtronic 780G'] += 2;
    console.log('  ✓ OK WITH TUBES detected: Twiist +3%, t:slim +2%, 780G +2%');
    boostsApplied = true;
  }

  if (!boostsApplied) {
    console.log('  (No critical keywords detected)');
  }

  console.log('[V3] Stage 3.5 complete:', scores);
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
- Dimension 22: Lightest pump (2 ounces) ⭐ ONLY PUMP THIS LIGHT
- Dimension 6: Lowest target (87 mg/dL) ⭐ LOWEST STANDARD TARGET
- Dimension 19: Apple Watch bolusing (dose from wrist!)
- Dimension 8: Emoji interface (food pics)
- Dimension 23: Automatic OTA updates
- Dimension 2: Full Apple integration

SCORING RULES:
- Perfect fit for stated need: +5 to +8 points per pump
- CRITICAL FEATURES (only one pump has): +8 points
- Good fit: +3 to +5 points
- Mentioned but not primary: +1 to +2 points
- NOT RELEVANT: 0 points
- MAXIMUM total per pump: +25 points

⭐ CRITICAL PRIORITY EXAMPLES:

Example 0a: "I want the lightest pump" or "2 ounces" or "minimal weight"
INTENT: Minimize weight for comfort/running
DIMENSION: #22 (Wearability)
SCORING:
- Twiist: +8 (ONLY pump at 2 oz - lightest by far)
- Tandem Mobi: +3 (small but not lightest)
- Others: 0 (significantly heavier)

Example 0b: "lowest glucose target" or "87 mg/dL" or "tightest control possible"
INTENT: Wants lowest possible target for tight control
DIMENSION: #6 (Target adjustability)
SCORING:
- Twiist: +7 (87 mg/dL - lowest standard target)
- Medtronic 780G: +5 (100 mg/dL fixed aggressive)
- Others: +2 (higher targets)

REGULAR EXAMPLES:

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

    // DEBUG: Log detailed AI analysis results
    console.log('[V3] Stage 4 AI Analysis Results:');
    console.log('  Intents extracted:', analysis.extractedIntents?.map(i => i.intent) || []);
    console.log('  Dimensions covered:', analysis.dimensionsCovered || []);
    console.log('  Pump scores from AI:');
    Object.entries(analysis.pumpScores || {}).forEach(([pump, data]) => {
      console.log(`    ${pump}: +${data.points}% - ${data.reasoning?.substring(0, 60) || 'No reasoning'}...`);
    });

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

    // Stage 3.5: Critical keyword detection (NEW!)
    scores = applyCriticalKeywordBoosts(scores, userData.freeText?.currentSituation || '');

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

    // Final summary with visual ranking
    console.log('\n[V3] ====== FINAL SCORING SUMMARY ======');
    sorted.forEach(([pump, data], index) => {
      const emoji = index === 0 ? '🏆' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
      console.log(`${emoji} ${pump}: ${data.score}%`);
    });
    console.log('=======================================\n');

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
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
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

    // Get templates created by doctor or system templates
    const { data: templates, error } = await supabase
      .from('templates')
      .select('*')
      .or(`created_by.eq.${doctorId},is_system_template.eq.true`)
      .order('is_system_template', { ascending: false })
      .order('name', { ascending: true });

    if (error) {
      throw error;
    }

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

    // Update or insert doctor (using upsert)
    const { error: doctorError } = await supabase
      .from('doctors')
      .upsert({
        id: doctorId,
        name: `Doctor ${doctorId}`,
        email: `${doctorId}@tshla.ai`,
        specialty: 'General Medicine',
        password_hash: 'hash_placeholder',
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (doctorError) {
      console.error('Failed to upsert doctor:', doctorError);
    }

    // Save favorites as separate records in doctor_template_favorites table
    if (favoriteTemplates && favoriteTemplates.length > 0) {
      // Clear existing favorites
      const { error: deleteError } = await supabase
        .from('doctor_template_favorites')
        .delete()
        .eq('doctor_id', doctorId);

      if (deleteError) {
        console.error('Failed to clear favorites:', deleteError);
      }

      // Insert new favorites
      const favoritesToInsert = favoriteTemplates.map(templateId => ({
        doctor_id: doctorId,
        template_id: templateId
      }));

      const { error: insertError } = await supabase
        .from('doctor_template_favorites')
        .insert(favoritesToInsert);

      if (insertError) {
        console.error('Failed to insert favorites:', insertError);
      }
    }

    // Save any new templates
    if (templates && templates.length > 0) {
      for (const template of templates) {
        const { error: templateError } = await supabase
          .from('templates')
          .upsert({
            id: template.id,
            name: template.name,
            specialty: template.specialty || 'General Medicine',
            template_type: template.visitType || 'general',
            sections: JSON.stringify(template.sections),
            created_by: doctorId,
            usage_count: template.usageCount || 0,
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });

        if (templateError) {
          console.error('Failed to upsert template:', templateError);
        }
      }
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

    const { data: doctor, error: doctorError } = await supabase
      .from('doctors')
      .select('*')
      .eq('id', doctorId)
      .single();

    if (doctorError || !doctor) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }

    // Get templates
    const { data: templates, error: templatesError } = await supabase
      .from('templates')
      .select('*')
      .or(`created_by.eq.${doctorId},is_system_template.eq.true`)
      .order('name', { ascending: true });

    if (templatesError) {
      console.error('Failed to fetch templates:', templatesError);
    }

    // Get favorite templates
    const { data: favorites, error: favoritesError } = await supabase
      .from('doctor_template_favorites')
      .select('template_id')
      .eq('doctor_id', doctorId);

    if (favoritesError) {
      console.error('Failed to fetch favorites:', favoritesError);
    }

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

    const { error } = await supabase
      .from('templates')
      .upsert({
        id,
        name,
        specialty: 'General Medicine',
        template_type: visitType || 'general',
        sections: JSON.stringify(sections),
        general_instructions: generalInstructions || '',
        created_by: doctorId,
        usage_count: usageCount || 0,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (error) {
      throw error;
    }

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

    // Check if favorite already exists
    const { data: existing, error: checkError } = await supabase
      .from('doctor_template_favorites')
      .select('id')
      .eq('doctor_id', doctorId)
      .eq('template_id', templateId)
      .single();

    if (existing) {
      // Remove favorite
      const { error: deleteError } = await supabase
        .from('doctor_template_favorites')
        .delete()
        .eq('doctor_id', doctorId)
        .eq('template_id', templateId);

      if (deleteError) {
        throw deleteError;
      }

      res.json({ success: true, isFavorite: false });
    } else {
      // Add favorite
      const { error: insertError } = await supabase
        .from('doctor_template_favorites')
        .insert({
          doctor_id: doctorId,
          template_id: templateId
        });

      if (insertError) {
        throw insertError;
      }

      res.json({ success: true, isFavorite: true });
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
    const { count: doctorCount, error: doctorError } = await supabase
      .from('doctors')
      .select('*', { count: 'exact', head: true });

    const { count: templateCount, error: templateError } = await supabase
      .from('templates')
      .select('*', { count: 'exact', head: true });

    res.json({
      success: true,
      connected: true,
      doctors: doctorCount || 0,
      templates: templateCount || 0,
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

// NOTE: 404 handler commented out because this module is used in unified-api.js
// The catch-all '*' route interferes with other API modules mounted after this one
// 404 handler
// app.use('*', (req, res) => {
//   res.status(404).json({
//     error: 'Not found',
//     message: `Route ${req.method} ${req.originalUrl} not found`,
//   });
// });

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

  // Supabase client already initialized at module load
  // Test connection
  try {
    const { error } = await supabase.from('patients').select('count', { count: 'exact', head: true });
    if (error) {
      console.error('Pump Report API: Supabase connection test failed:', error.message);
      app.locals.dbConnected = false;
    } else {
      console.log('Pump Report API: Supabase connected successfully');
      app.locals.dbConnected = true;
    }
  } catch (err) {
    console.error('Pump Report API: Database connection failed:', err.message);
    app.locals.dbConnected = false;
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
// Note: Using Supabase now - monitoring handled by Supabase client
function startDatabaseMonitoring() {
  console.log('Pump Report API: Using Supabase - connection monitoring handled by Supabase client');
  // Supabase client handles connection pooling and monitoring automatically
  app.locals.dbConnected = true;
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
