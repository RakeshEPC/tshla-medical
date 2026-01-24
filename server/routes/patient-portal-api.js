/**
 * Patient Portal API Routes
 * Handles unified portal authentication, dashboard data, and session management
 *
 * Created: 2026-01-23
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const logger = require('../logger');

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Rate limiting map (in-memory, for MVP - move to Redis for production)
const loginAttempts = new Map();

/**
 * POST /api/patient-portal/login
 * Authenticate with TSH ID + last 4 digits of phone
 */
router.post('/login', async (req, res) => {
  try {
    const { tshlaId, phoneLast4 } = req.body;

    // Normalize TSH ID (remove spaces, dashes)
    const normalizedTshId = tshlaId.replace(/[\s-]/g, '').toUpperCase();

    logger.info('PatientPortal', 'Login attempt', { tshlaId: normalizedTshId });

    // Rate limiting check
    const clientIp = req.ip || req.connection.remoteAddress;
    const attemptKey = `${clientIp}-${normalizedTshId}`;
    const attempts = loginAttempts.get(attemptKey) || { count: 0, firstAttempt: Date.now() };

    // Reset after 1 hour
    if (Date.now() - attempts.firstAttempt > 60 * 60 * 1000) {
      loginAttempts.delete(attemptKey);
      attempts.count = 0;
      attempts.firstAttempt = Date.now();
    }

    // Check if locked out (5 attempts)
    if (attempts.count >= 5) {
      logger.warn('PatientPortal', 'Too many login attempts', { tshlaId: normalizedTshId, ip: clientIp });
      return res.status(429).json({
        success: false,
        error: 'Too many failed attempts. Please try again in 1 hour or contact our office.'
      });
    }

    // 1. Find patient by TSH ID
    // Try exact match first, then try with space format (TSH XXX-XXX)
    let patient, findError;

    // Try normalized format (TSH123001)
    const result1 = await supabase
      .from('unified_patients')
      .select('id, phone_primary, phone_display, first_name, last_name, tshla_id, is_active')
      .eq('tshla_id', normalizedTshId)
      .maybeSingle();

    if (result1.data) {
      patient = result1.data;
    } else {
      // Try formatted version (TSH 123-001)
      const formatted = normalizedTshId.replace(/^TSH(\d{3})(\d{3})$/, 'TSH $1-$2');
      const result2 = await supabase
        .from('unified_patients')
        .select('id, phone_primary, phone_display, first_name, last_name, tshla_id, is_active')
        .eq('tshla_id', formatted)
        .maybeSingle();

      patient = result2.data;
      findError = result2.error;
    }

    if (findError || !patient) {
      // Increment failed attempts
      attempts.count++;
      loginAttempts.set(attemptKey, attempts);

      logger.warn('PatientPortal', 'TSH ID not found', { tshlaId: normalizedTshId });
      return res.status(404).json({
        success: false,
        error: 'TSH ID not found. Please check your ID or contact our office.'
      });
    }

    // Check if account is active
    if (!patient.is_active) {
      logger.warn('PatientPortal', 'Inactive account', { tshlaId: normalizedTshId });
      return res.status(403).json({
        success: false,
        error: 'Account is inactive. Please contact our office.'
      });
    }

    // 2. Verify last 4 digits of phone
    const fullPhone = patient.phone_primary.replace(/\D/g, '');
    const last4 = fullPhone.slice(-4);

    if (phoneLast4 !== last4) {
      // Increment failed attempts
      attempts.count++;
      loginAttempts.set(attemptKey, attempts);

      logger.warn('PatientPortal', 'Phone verification failed', {
        tshlaId: normalizedTshId,
        attempts: attempts.count
      });
      return res.status(403).json({
        success: false,
        error: 'Phone verification failed. Please check the last 4 digits.'
      });
    }

    // 3. Success! Create session
    const sessionId = uuidv4();
    const patientName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim();

    // Clear failed attempts
    loginAttempts.delete(attemptKey);

    // 4. Create session record in database
    const { error: sessionError } = await supabase
      .from('patient_portal_sessions')
      .insert({
        patient_phone: patient.phone_primary,
        tshla_id: normalizedTshId,
        session_start: new Date().toISOString(),
        device_type: getDeviceType(req.headers['user-agent']),
        ip_address: clientIp,
        user_agent: req.headers['user-agent'],
        sections_viewed: [],
        actions_performed: {}
      });

    if (sessionError) {
      logger.error('PatientPortal', 'Failed to create session', { error: sessionError.message });
      // Non-critical, continue
    }

    // 5. Log access for HIPAA compliance
    await supabase
      .from('access_logs')
      .insert({
        user_type: 'patient',
        user_id: patient.id,
        action: 'portal_login',
        resource_type: 'patient_portal',
        ip_address: clientIp,
        user_agent: req.headers['user-agent'],
        details: { tshla_id: normalizedTshId }
      });

    logger.info('PatientPortal', 'Login successful', {
      tshlaId: normalizedTshId,
      patientName
    });

    res.json({
      success: true,
      sessionId,
      patientPhone: patient.phone_primary,
      tshlaId: normalizedTshId,
      patientName
    });

  } catch (error) {
    logger.error('PatientPortal', 'Login error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Server error during login. Please try again.'
    });
  }
});

/**
 * GET /api/patient-portal/dashboard
 * Get dashboard statistics for patient
 */
router.get('/dashboard', async (req, res) => {
  try {
    const { tshlaId } = req.query;
    const sessionId = req.headers['x-session-id'];

    if (!tshlaId) {
      return res.status(400).json({ success: false, error: 'TSH ID required' });
    }

    const normalizedTshId = tshlaId.replace(/[\s-]/g, '').toUpperCase();

    logger.info('PatientPortal', 'Loading dashboard', { tshlaId: normalizedTshId });

    // Get patient (try both normalized and formatted versions)
    let patient = null;

    // Try normalized format first (TSH123001)
    const result1 = await supabase
      .from('unified_patients')
      .select('id, phone_primary, tshla_id')
      .eq('tshla_id', normalizedTshId)
      .maybeSingle();

    if (result1.data) {
      patient = result1.data;
    } else {
      // Try formatted version (TSH 123-001)
      const formatted = normalizedTshId.replace(/^TSH(\d{3})(\d{3})$/, 'TSH $1-$2');
      const result2 = await supabase
        .from('unified_patients')
        .select('id, phone_primary, tshla_id')
        .eq('tshla_id', formatted)
        .maybeSingle();

      patient = result2.data;
    }

    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }

    // 1. Get payment statistics
    const { data: payments, error: paymentError } = await supabase
      .from('payment_requests')
      .select('amount_cents, payment_status, due_date')
      .eq('tshla_id', normalizedTshId)
      .eq('payment_status', 'pending');

    const pendingPayments = payments || [];
    const pendingPaymentAmount = pendingPayments.reduce((sum, p) => sum + p.amount_cents, 0);
    const nextPaymentDue = pendingPayments.length > 0
      ? pendingPayments.sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0].due_date
      : null;

    // 2. Get audio summary statistics
    const { data: audioSummaries, error: audioError } = await supabase
      .from('patient_audio_summaries')
      .select('created_at, expires_at')
      .eq('patient_phone', patient.phone_primary)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    const audioSummariesCount = audioSummaries?.length || 0;
    const latestAudioDate = audioSummaries && audioSummaries.length > 0
      ? audioSummaries[0].created_at
      : null;

    // 3. Get AI chat statistics (today)
    const today = new Date().toISOString().split('T')[0];
    const { data: aiStats, error: aiError } = await supabase
      .from('patient_ai_analytics')
      .select('total_questions')
      .eq('patient_phone', patient.phone_primary)
      .eq('date', today)
      .single();

    const aiQuestionsToday = aiStats?.total_questions || 0;
    const aiQuestionsRemaining = Math.max(0, 20 - aiQuestionsToday);

    // Return dashboard stats
    res.json({
      success: true,
      stats: {
        pendingPayments: pendingPayments.length,
        pendingPaymentAmount,
        nextPaymentDue,
        audioSummaries: audioSummariesCount,
        latestAudioDate,
        aiQuestionsToday,
        aiQuestionsRemaining
      }
    });

  } catch (error) {
    logger.error('PatientPortal', 'Dashboard error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to load dashboard'
    });
  }
});

/**
 * POST /api/patient-portal/track-login
 * Track portal login for analytics
 */
router.post('/track-login', async (req, res) => {
  try {
    const { patientPhone, tshlaId, sessionId, deviceType, userAgent } = req.body;

    // This endpoint is for analytics only, don't fail if it errors
    await supabase
      .from('patient_portal_sessions')
      .update({
        device_type: deviceType,
        user_agent: userAgent
      })
      .eq('tshla_id', tshlaId)
      .eq('session_start', new Date().toISOString());

    res.json({ success: true });
  } catch (error) {
    // Non-critical, just log
    logger.error('PatientPortal', 'Track login error', { error: error.message });
    res.json({ success: false });
  }
});

/**
 * POST /api/patient-portal/track-view
 * Track section view for analytics
 */
router.post('/track-view', async (req, res) => {
  try {
    const { sessionId, section } = req.body;

    // Update session with viewed section
    const { data: session } = await supabase
      .from('patient_portal_sessions')
      .select('sections_viewed')
      .eq('id', sessionId)
      .single();

    if (session) {
      const sectionsViewed = session.sections_viewed || [];
      if (!sectionsViewed.includes(section)) {
        sectionsViewed.push(section);

        await supabase
          .from('patient_portal_sessions')
          .update({ sections_viewed: sectionsViewed })
          .eq('id', sessionId);
      }
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('PatientPortal', 'Track view error', { error: error.message });
    res.json({ success: false });
  }
});

/**
 * Helper: Get device type from user agent
 */
function getDeviceType(userAgent) {
  if (!userAgent) return 'unknown';

  const ua = userAgent.toLowerCase();

  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet';
  }
  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
}

module.exports = router;
