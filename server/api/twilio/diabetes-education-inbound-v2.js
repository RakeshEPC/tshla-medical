/**
 * Twilio Inbound Call Handler - Diabetes Education (OpenAI Realtime)
 * VERSION: 2.0.0 - FORCE REBUILD
 *
 * CRITICAL REQUIREMENTS (Twilio Media Streams):
 * 1. TwiML must be valid XML with Content-Type: text/xml
 * 2. Webhook MUST respond < 500ms (no slow DB lookups before TwiML)
 * 3. Stream URL must NOT have query parameters (use <Parameter> tags only)
 * 4. Stream URL must be wss:// (TLS required)
 * 5. Add statusCallback to debug stream lifecycle
 *
 * SAFE MODES (controlled by environment variables):
 * - SAFE_MODE=A: Return TwiML only, no DB lookup
 * - SAFE_MODE=B: Accept WS, log Twilio messages, don't connect OpenAI
 * - SAFE_MODE=C: Connect OpenAI, disable function calls
 * - SAFE_MODE=D: Enable function calls (default)
 *
 * Twilio Debugger: Check https://console.twilio.com/monitor/debugger for error 11200
 * HIPAA COMPLIANT: Uses safe logger with PHI sanitization
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const logger = require('../../logger');

// =====================================================
// CONFIGURATION
// =====================================================

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = supabaseUrl ? createClient(supabaseUrl, supabaseServiceKey) : null;

const API_BASE_URL = process.env.API_BASE_URL || 'https://api.tshla.ai';
const SAFE_MODE = process.env.SAFE_MODE || 'D'; // A, B, C, D

// In-memory token store (for demo; use Redis in production)
const tokenStore = new Map();

// =====================================================
// GOLDEN TWIML GENERATOR
// =====================================================

/**
 * Generate TwiML for Twilio Media Streams
 * @param {string} patientToken - Opaque token for patient lookup after WS connect
 * @param {string} language - Patient language (en, es, hi)
 * @returns {string} Valid TwiML XML
 */
function generateGoldenTwiML(patientToken, language = 'en') {
  // CRITICAL: No query parameters in Stream URL
  // CRITICAL: Use statusCallback to debug stream lifecycle
  const streamUrl = 'wss://api.tshla.ai/media-stream';
  const statusCallbackUrl = `${API_BASE_URL}/api/twilio/stream-status`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${streamUrl}" statusCallback="${statusCallbackUrl}">
      <Parameter name="patientToken" value="${patientToken}"/>
      <Parameter name="language" value="${language}"/>
    </Stream>
  </Connect>
</Response>`;
}

/**
 * Generate fast-fail TwiML (when patient not found or errors)
 */
function generateErrorTwiML(message = 'We are sorry, but our diabetes educator is not available at this time.') {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-US">${message} Thank you for calling.</Say>
  <Hangup/>
</Response>`;
}

// =====================================================
// TOKEN MANAGEMENT
// =====================================================

/**
 * Create opaque token for patient (so we can return TwiML fast)
 * @param {object} patientData - Patient record from DB
 * @returns {string} Opaque token
 */
function createPatientToken(patientData) {
  const token = crypto.randomBytes(16).toString('hex');
  tokenStore.set(token, {
    patientId: patientData.id,
    firstName: patientData.first_name,
    lastName: patientData.last_name,
    language: patientData.preferred_language || 'en',
    createdAt: Date.now(),
    ttl: 300000 // 5 minutes
  });

  // Clean up expired tokens
  setTimeout(() => tokenStore.delete(token), 300000);

  return token;
}

/**
 * Retrieve patient data from token
 * @param {string} token - Opaque token
 * @returns {object|null} Patient data or null if expired/invalid
 */
function getPatientFromToken(token) {
  const data = tokenStore.get(token);
  if (!data) return null;
  if (Date.now() - data.createdAt > data.ttl) {
    tokenStore.delete(token);
    return null;
  }
  return data;
}

// =====================================================
// MAIN WEBHOOK HANDLER
// =====================================================

/**
 * Handle inbound Twilio call
 * POST /api/twilio/diabetes-education-inbound
 *
 * CRITICAL: Must respond < 500ms
 * CRITICAL: Must return Content-Type: text/xml
 */
async function handler(req, res) {
  const startTime = Date.now();

  logger.info('DiabetesEdu', 'Incoming call', { safeMode: SAFE_MODE });

  try {
    // Extract Twilio parameters
    const { CallSid, From, To, CallStatus } = req.body;

    logger.debug('DiabetesEdu', 'Call details', { CallSid, CallStatus });

    // SAFE MODE A: Return minimal TwiML immediately (no DB lookup)
    if (SAFE_MODE === 'A') {
      logger.info('DiabetesEdu', 'SAFE MODE A - Returning test TwiML');
      const twiml = generateGoldenTwiML('test-token-safe-mode-a', 'en');
      res.type('text/xml');
      const elapsed = Date.now() - startTime;
      logger.info('DiabetesEdu', 'TwiML returned', { elapsedMs: elapsed });
      return res.send(twiml);
    }

    // Validate caller phone number
    if (!From) {
      logger.error('DiabetesEdu', 'Missing caller phone number');
      res.type('text/xml');
      return res.send(generateErrorTwiML('Sorry, your phone number could not be identified.'));
    }

    // Format phone for DB lookup
    const formattedPhone = From.startsWith('+') ? From : `+${From}`;
    logger.debug('DiabetesEdu', 'Phone formatted');

    // FAST DB lookup (with timeout to ensure we respond quickly)
    let patient = null;
    if (supabase) {
      try {
        const lookupPromise = supabase
          .from('diabetes_education_patients')
          .select('id, first_name, last_name, preferred_language')
          .eq('phone_number', formattedPhone)
          .eq('is_active', true)
          .single();

        // Timeout after 300ms to ensure we respond fast
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('DB lookup timeout')), 300)
        );

        const { data, error } = await Promise.race([lookupPromise, timeoutPromise]);

        if (!error && data) {
          patient = data;
          logger.info('DiabetesEdu', 'Patient found', { patientId: patient.id });
        } else {
          logger.warn('DiabetesEdu', 'Patient not found');
        }
      } catch (err) {
        logger.error('DiabetesEdu', 'DB lookup error', { error: err.message });
      }
    }

    // If patient not found, return error TwiML
    if (!patient) {
      res.type('text/xml');
      const elapsed = Date.now() - startTime;
      logger.info('DiabetesEdu', 'Call rejected - patient not registered', { elapsedMs: elapsed });
      return res.send(generateErrorTwiML('Sorry, your phone number is not registered.'));
    }

    // Create opaque token (so WS handler can lookup patient later)
    const patientToken = createPatientToken(patient);
    logger.debug('DiabetesEdu', 'Token created');

    // Generate golden TwiML
    const twiml = generateGoldenTwiML(patientToken, patient.preferred_language || 'en');

    // CRITICAL: Set Content-Type to text/xml
    res.type('text/xml');

    const elapsed = Date.now() - startTime;
    logger.info('DiabetesEdu', 'TwiML returned', { elapsedMs: elapsed });

    if (elapsed > 500) {
      logger.warn('DiabetesEdu', 'WARNING: Response slow (should be < 500ms)', { elapsedMs: elapsed });
    }

    return res.send(twiml);

  } catch (error) {
    logger.error('DiabetesEdu', 'Handler error', {
      error: logger.redactPHI(error.message),
      stack: error.stack
    });

    // Always return valid TwiML, even on error
    res.type('text/xml');
    return res.send(generateErrorTwiML());
  }
}

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  default: handler,
  generateGoldenTwiML,
  generateErrorTwiML,
  createPatientToken,
  getPatientFromToken,
  tokenStore
};
