/**
 * Patient Chart API
 * Unified patient chart endpoints for comprehensive patient data view
 *
 * Features:
 * - Get complete patient chart by phone/ID
 * - Search patients
 * - Update patient demographics
 * - Patient portal authentication
 *
 * Created: 2025-01-16
 */

const express = require('express');
const router = express.Router();
const patientMatchingService = require('../services/patientMatching.service');
const { createClient } = require('@supabase/supabase-js');
const logger = require('../logger');

// Lazy-load Supabase client to ensure env vars are loaded
let supabase = null;
function getSupabase() {
  if (!supabase) {
    supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return supabase;
}

// ===============================
// ROUTE ORDER IMPORTANT!
// Specific routes MUST come before generic /:identifier route
// ===============================

// ===============================
// PATIENT PORTAL AUTHENTICATION (Must be before /:identifier)
// ===============================

/**
 * POST /api/patient-chart/portal/login
 * Patient portal login with phone + PIN
 *
 * Body: { phone, pin }
 */
router.post('/portal/login', async (req, res) => {
  try {
    const { phone, pin } = req.body;

    if (!phone || !pin) {
      return res.status(400).json({
        success: false,
        error: 'Phone number and PIN are required'
      });
    }

    // Verify PIN and get patient
    const patient = await patientMatchingService.findPatientByPhone(phone);

    if (!patient) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    if (!patient.portal_pin) {
      return res.status(401).json({
        success: false,
        error: 'Patient portal not activated'
      });
    }

    // Verify PIN
    const isValidPIN = await patientMatchingService.verifyPIN(pin, patient.portal_pin);

    if (!isValidPIN) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Get complete patient chart
    const chart = await patientMatchingService.getPatientChart(patient.patient_id);

    // Update last login
    const supabase = getSupabase();
    await supabase
      .from('unified_patients')
      .update({
        portal_last_login: new Date().toISOString(),
        portal_login_count: (patient.portal_login_count || 0) + 1
      })
      .eq('id', patient.id);

    // Format chart data for patient portal dashboard
    const formattedChart = {
      recentVisits: chart.dictations?.slice(0, 5) || [],
      upcomingAppointments: chart.appointments?.filter(a =>
        new Date(a.scheduled_date) >= new Date()
      ).slice(0, 5) || [],
      currentMedications: chart.patient?.current_medications || [],
      activeConditions: chart.patient?.active_conditions || [],
      stats: chart.stats || {
        totalVisits: 0,
        totalPrevisitCalls: 0,
        lastVisit: null
      }
    };

    res.json({
      success: true,
      patient: {
        id: patient.id,
        patient_id: patient.patient_id,
        full_name: patient.full_name,
        first_name: patient.first_name,
        phone_display: patient.phone_display,
        email: patient.email,
        date_of_birth: patient.date_of_birth,
        age: patient.age,
        gender: patient.gender,
        primary_provider_name: patient.primary_provider_name,
        pcm_enrolled: patient.pcm_enrolled || false,
        pcm_status: patient.pcm_status,
        pcm_start_date: patient.pcm_start_date,
        pcm_target_a1c: patient.pcm_target_a1c,
        pcm_current_a1c: patient.pcm_current_a1c,
        pcm_target_bp: patient.pcm_target_bp,
        pcm_current_bp: patient.pcm_current_bp,
        pcm_target_weight: patient.pcm_target_weight,
        pcm_current_weight: patient.pcm_current_weight
      },
      chart: formattedChart
    });

  } catch (error) {
    logger.error('PatientChart', 'Portal login failed', {
      phone: phone?.slice(-4), // Last 4 digits only
      error: error.message,
      errorCode: error.code
    });
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
});

/**
 * POST /api/patient-chart/portal/pcm-consent
 * Save PCM (Principal Care Management) consent form
 *
 * Body: { patientId, consentData }
 */
router.post('/portal/pcm-consent', async (req, res) => {
  try {
    const {
      patientId,
      signature,
      agreedToTerms,
      agreedToBilling,
      agreedToPrivacy,
      consentDate,
      initialA1C,
      initialBloodPressure,
      initialWeight,
      targetA1C,
      targetBloodPressure,
      targetWeight
    } = req.body;

    if (!patientId || !signature || !agreedToTerms || !agreedToBilling || !agreedToPrivacy) {
      return res.status(400).json({
        success: false,
        error: 'Missing required consent fields'
      });
    }

    const supabase = getSupabase();

    // Update patient record with PCM consent
    const { data: patient, error } = await supabase
      .from('unified_patients')
      .update({
        pcm_enrolled: true,
        pcm_consent_date: consentDate,
        pcm_consent_signature: signature,
        pcm_consent_version: '1.0',
        pcm_start_date: new Date().toISOString().split('T')[0],
        pcm_status: 'active',
        pcm_initial_a1c: initialA1C,
        pcm_target_a1c: targetA1C || 7.0,
        pcm_current_a1c: initialA1C,
        pcm_last_a1c_date: initialA1C ? new Date().toISOString().split('T')[0] : null,
        pcm_initial_bp: initialBloodPressure,
        pcm_target_bp: targetBloodPressure || '130/80',
        pcm_current_bp: initialBloodPressure,
        pcm_last_bp_date: initialBloodPressure ? new Date().toISOString().split('T')[0] : null,
        pcm_initial_weight: initialWeight,
        pcm_target_weight: targetWeight,
        pcm_current_weight: initialWeight,
        pcm_last_weight_date: initialWeight ? new Date().toISOString().split('T')[0] : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', patientId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'PCM consent saved successfully',
      patient: {
        id: patient.id,
        patient_id: patient.patient_id,
        pcm_enrolled: patient.pcm_enrolled,
        pcm_status: patient.pcm_status,
        pcm_start_date: patient.pcm_start_date
      }
    });

  } catch (error) {
    logger.error('PatientChart', 'Failed to save PCM consent', {
      error: error.message,
      errorCode: error.code
    });
    res.status(500).json({
      success: false,
      error: 'Failed to save PCM consent',
      details: error.message
    });
  }
});

/**
 * POST /api/patient-chart/portal/reset-pin
 * Reset patient PIN (admin/provider only)
 *
 * Body: { phone }
 */
router.post('/portal/reset-pin', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    const patient = await patientMatchingService.findPatientByPhone(phone);

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    // Generate new PIN
    const newPIN = patientMatchingService.generatePIN();
    const hashedPIN = await patientMatchingService.hashPIN(newPIN);

    // Update PIN in database
    const supabase = getSupabase();
    await supabase
      .from('unified_patients')
      .update({ portal_pin: hashedPIN })
      .eq('id', patient.id);

    res.json({
      success: true,
      message: 'PIN reset successful',
      newPin: newPIN
    });

  } catch (error) {
    logger.error('PatientChart', 'PIN reset failed', {
      error: error.message,
      errorCode: error.code
    });
    res.status(500).json({
      success: false,
      error: 'Failed to reset PIN'
    });
  }
});

// ===============================
// SEARCH & QUERY ROUTES (Must be before /:identifier)
// ===============================

/**
 * GET /api/patient-chart/search/query?q=searchterm
 * Or: /api/patient-chart/search/query?patientId=12345678&firstName=John&lastName=Smith
 *
 * Search patients by:
 * - Patient ID (8-digit)
 * - TSH ID (6-digit)
 * - Phone number
 * - MRN
 * - First name
 * - Last name
 * - Email
 * - Date of birth
 * - Generic text query (q parameter)
 */
router.get('/search/query', async (req, res) => {
  try {
    const { q, patientId, tshId, phone, mrn, firstName, lastName, email, dob } = req.query;

    // Validate that at least one search parameter is provided
    if (!q && !patientId && !tshId && !phone && !mrn && !firstName && !lastName && !email && !dob) {
      return res.status(400).json({
        success: false,
        error: 'At least one search parameter is required'
      });
    }

    // If generic query is provided and too short, reject
    if (q && q.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters'
      });
    }

    // Use patientMatching service for comprehensive search
    const patients = await patientMatchingService.searchPatients({
      patientId,
      tshId,
      phone,
      mrn,
      firstName,
      lastName,
      email,
      dob,
      query: q
    });

    res.json({
      success: true,
      patients: patients || [],
      count: patients?.length || 0
    });

  } catch (error) {
    logger.error('PatientChart', 'Patient search failed', {
      error: error.message,
      errorCode: error.code
    });
    res.status(500).json({
      success: false,
      error: 'Search failed',
      message: error.message
    });
  }
});

/**
 * GET /api/patient-chart/provider/:providerId/patients
 * Get all patients for a specific provider
 */
router.get('/provider/:providerId/patients', async (req, res) => {
  try {
    const { providerId } = req.params;

    const supabase = getSupabase();
    const { data: patients, error } = await supabase
      .from('unified_patients')
      .select('*')
      .eq('primary_provider_id', providerId)
      .eq('is_active', true)
      .order('last_visit_date', { ascending: false, nullsLast: true });

    if (error) throw error;

    res.json({
      success: true,
      patients: patients || []
    });

  } catch (error) {
    logger.error('PatientChart', 'Failed to fetch provider patients', {
      error: error.message,
      errorCode: error.code
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch provider patients'
    });
  }
});

/**
 * GET /api/patient-chart/stats/overview
 * Get overall patient statistics
 */
router.get('/stats/overview', async (req, res) => {
  try {
    const { data: stats, error } = await getSupabase().rpc('get_patient_stats_overview');

    if (error) {
      // If function doesn't exist, calculate manually
      const supabase = getSupabase();
      const { data: patients } = await supabase
        .from('unified_patients')
        .select('*', { count: 'exact' });

      return res.json({
        success: true,
        stats: {
          total_patients: patients?.length || 0,
          active_patients: patients?.filter(p => p.is_active).length || 0,
          portal_enabled: patients?.filter(p => p.has_portal_access).length || 0
        }
      });
    }

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    logger.error('PatientChart', 'Failed to fetch statistics', {
      error: error.message,
      errorCode: error.code
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

/**
 * GET /api/patient-chart/:patientId/appointments
 * Get upcoming appointments for a patient
 */
router.get('/:patientId/appointments', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { upcoming = 'true', limit = '10' } = req.query;

    const supabase = getSupabase();

    // First find the patient
    const { data: patient, error: patientError } = await supabase
      .from('unified_patients')
      .select('id')
      .or(`patient_id.eq.${patientId},phone_primary.eq.${patientId.replace(/\D/g, '')}`)
      .eq('is_active', true)
      .single();

    if (patientError || !patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    // Get appointments
    let query = supabase
      .from('provider_schedules')
      .select(`
        id,
        provider_id,
        provider_name,
        provider_email,
        unified_patient_id,
        patient_name,
        patient_phone,
        patient_email,
        appointment_date,
        start_time,
        end_time,
        appointment_type,
        status,
        chief_complaint,
        notes,
        created_at
      `)
      .eq('unified_patient_id', patient.id)
      .order('appointment_date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(parseInt(limit, 10));

    // Filter to upcoming if requested
    if (upcoming === 'true') {
      const today = new Date().toISOString().split('T')[0];
      query = query.gte('appointment_date', today);
    }

    const { data: appointments, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      appointments: appointments || [],
      count: appointments?.length || 0
    });

  } catch (error) {
    logger.error('PatientChart', 'Failed to fetch patient appointments', {
      error: error.message,
      errorCode: error.code
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch appointments'
    });
  }
});

/**
 * POST /api/patient-chart/:patientId/portal-invite
 * Send portal invitation to patient
 */
router.post('/:patientId/portal-invite', async (req, res) => {
  try {
    const { patientId } = req.params;

    const supabase = getSupabase();

    // Get patient with email
    const { data: patient, error: patientError } = await supabase
      .from('unified_patients')
      .select('id, patient_id, full_name, email, phone_primary, portal_registered_at')
      .or(`id.eq.${patientId},patient_id.eq.${patientId}`)
      .eq('is_active', true)
      .single();

    if (patientError || !patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    if (!patient.email) {
      return res.status(400).json({
        success: false,
        error: 'Patient does not have an email address'
      });
    }

    if (patient.portal_registered_at) {
      return res.status(400).json({
        success: false,
        error: 'Patient is already registered for the portal'
      });
    }

    // Generate invite token
    const crypto = require('crypto');
    const inviteToken = crypto.randomBytes(24).toString('hex');

    // Update patient with invite token
    const { error: updateError } = await supabase
      .from('unified_patients')
      .update({
        portal_invite_token: inviteToken,
        portal_invite_sent_at: new Date().toISOString()
      })
      .eq('id', patient.id);

    if (updateError) throw updateError;

    // In production, send email here via SendGrid/Resend/etc.
    // For now, log the invite details
    logger.info('PatientChart', 'Portal invite created', {
      patientId: patient.id,
      email: patient.email,
      inviteToken: inviteToken.slice(0, 8) + '...'
    });

    res.json({
      success: true,
      message: `Portal invitation sent to ${patient.email}`,
      inviteToken: inviteToken // In production, don't return this
    });

  } catch (error) {
    logger.error('PatientChart', 'Failed to send portal invite', {
      error: error.message,
      errorCode: error.code
    });
    res.status(500).json({
      success: false,
      error: 'Failed to send portal invitation'
    });
  }
});

/**
 * GET /api/patient-chart/:patientId/portal-status
 * Get portal invite status for a patient
 */
router.get('/:patientId/portal-status', async (req, res) => {
  try {
    const { patientId } = req.params;

    const supabase = getSupabase();

    const { data: patient, error } = await supabase
      .from('unified_patients')
      .select(`
        email,
        portal_invite_token,
        portal_invite_sent_at,
        portal_invite_clicked_at,
        portal_registered_at,
        portal_access_enabled
      `)
      .or(`id.eq.${patientId},patient_id.eq.${patientId}`)
      .single();

    if (error || !patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    res.json({
      success: true,
      status: {
        hasEmail: !!patient.email,
        inviteSent: !!patient.portal_invite_sent_at,
        inviteClicked: !!patient.portal_invite_clicked_at,
        isRegistered: !!patient.portal_registered_at || !!patient.portal_access_enabled,
        sentAt: patient.portal_invite_sent_at,
        clickedAt: patient.portal_invite_clicked_at,
        registeredAt: patient.portal_registered_at
      }
    });

  } catch (error) {
    logger.error('PatientChart', 'Failed to get portal status', {
      error: error.message,
      errorCode: error.code
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get portal status'
    });
  }
});

/**
 * GET /api/patient-chart/:patientId/timeline
 * Get patient timeline of all interactions
 */
router.get('/:patientId/timeline', async (req, res) => {
  try {
    const { patientId } = req.params;

    const patient = await patientMatchingService.findPatientByPhone(patientId) ||
                    await patientMatchingService.findPatientByMRN(patientId);

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    // Get all linked records
    const supabase = getSupabase();
    const [dictations, previsits, appointments] = await Promise.all([
      supabase.from('dictated_notes').select('*').eq('unified_patient_id', patient.id),
      supabase.from('previsit_responses').select('*').eq('unified_patient_id', patient.id),
      supabase.from('provider_schedules').select('*').eq('unified_patient_id', patient.id)
    ]);

    const timeline = [];

    dictations.data?.forEach(d => {
      timeline.push({
        type: 'dictation',
        date: d.visit_date || d.created_at,
        data: d
      });
    });

    previsits.data?.forEach(p => {
      timeline.push({
        type: 'previsit',
        date: p.scheduled_date || p.created_at,
        data: p
      });
    });

    appointments.data?.forEach(a => {
      timeline.push({
        type: 'appointment',
        date: a.appointment_date,
        data: a
      });
    });

    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
      success: true,
      timeline
    });

  } catch (error) {
    logger.error('PatientChart', 'Failed to fetch timeline', {
      error: error.message,
      errorCode: error.code
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch timeline'
    });
  }
});

// ===============================
// DISEASE DASHBOARDS
// ===============================

/**
 * GET /api/patient-chart/:patientId/dashboard
 * Get disease-specific dashboard data for a patient
 *
 * Query params:
 * - dashboardType: 'diabetes' | 'thyroid' | 'thyroid-cancer' | 'thyroid-nodule' | 'osteoporosis' | 'general'
 */
router.get('/:patientId/dashboard', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { dashboardType = 'general' } = req.query;

    const supabase = getSupabase();

    // Find patient by various identifiers
    const { data: patient, error: patientError } = await supabase
      .from('unified_patients')
      .select('id, tshla_id, patient_id, full_name, current_medications, active_conditions')
      .or(`id.eq.${patientId},patient_id.eq.${patientId},tshla_id.eq.${patientId}`)
      .eq('is_active', true)
      .single();

    if (patientError || !patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    // Get comprehensive chart data
    const { data: compChart } = await supabase
      .from('patient_comprehensive_chart')
      .select('*')
      .eq('tshla_id', patient.tshla_id)
      .single();

    // Get recent dictations for plan/memory
    const { data: dictations } = await supabase
      .from('dictated_notes')
      .select('id, visit_date, chief_complaint, processed_note, provider_name')
      .eq('unified_patient_id', patient.id)
      .order('visit_date', { ascending: false })
      .limit(5);

    // Get CGM data if available
    const { data: cgmReadings } = await supabase
      .from('cgm_readings')
      .select('glucose_value, trend_arrow, recorded_at')
      .eq('patient_phone', patient.patient_id?.replace(/\D/g, '') || '')
      .order('recorded_at', { ascending: false })
      .limit(288); // 24 hours of 5-min readings

    // Build dashboard-specific response
    const dashboardData = {
      patientId: patient.id,
      tshlaId: patient.tshla_id,
      patientName: patient.full_name,
      dashboardType,

      // Medications (grouped by class for diabetes dashboard)
      medications: compChart?.medications || patient.current_medications || [],

      // Labs with trends
      labs: compChart?.labs || {},

      // Vitals
      vitals: compChart?.vitals || {},

      // Diagnoses
      diagnoses: compChart?.diagnoses || [],

      // CGM Data (for diabetes)
      cgm: cgmReadings?.length > 0 ? {
        currentGlucose: cgmReadings[0],
        readings: cgmReadings,
        stats: calculateCGMStats(cgmReadings)
      } : null,

      // Last visit info for Zone C (Plan & Memory)
      lastVisit: dictations?.[0] ? {
        date: dictations[0].visit_date,
        chiefComplaint: dictations[0].chief_complaint,
        provider: dictations[0].provider_name,
        noteExcerpt: dictations[0].processed_note?.slice(0, 500)
      } : null,

      // Disease-specific data based on dashboard type
      diseaseSpecific: buildDiseaseSpecificData(dashboardType, compChart, cgmReadings)
    };

    res.json({
      success: true,
      dashboard: dashboardData
    });

  } catch (error) {
    logger.error('PatientChart', 'Failed to fetch dashboard data', {
      error: error.message,
      errorCode: error.code
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data'
    });
  }
});

/**
 * GET /api/patient-chart/:patientId/treatment-history
 * Get medication timeline with reasons for changes
 */
router.get('/:patientId/treatment-history', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { category } = req.query; // e.g., 'diabetes', 'thyroid', 'bone'

    const supabase = getSupabase();

    // Find patient
    const { data: patient } = await supabase
      .from('unified_patients')
      .select('id, tshla_id')
      .or(`id.eq.${patientId},patient_id.eq.${patientId},tshla_id.eq.${patientId}`)
      .single();

    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }

    // Get medication history from patient_medications
    let query = supabase
      .from('patient_medications')
      .select('*')
      .eq('unified_patient_id', patient.id)
      .order('start_date', { ascending: false });

    // Filter by category if provided
    if (category) {
      const categoryPatterns = {
        diabetes: ['metformin', 'insulin', 'glp-1', 'sglt2', 'sulfonylurea', 'dpp-4', 'ozempic', 'mounjaro', 'jardiance', 'farxiga'],
        thyroid: ['levothyroxine', 'synthroid', 'liothyronine', 'cytomel', 'armour', 'methimazole', 'ptu'],
        bone: ['alendronate', 'fosamax', 'risedronate', 'actonel', 'ibandronate', 'boniva', 'zoledronic', 'reclast', 'denosumab', 'prolia', 'teriparatide', 'forteo', 'romosozumab', 'evenity']
      };

      if (categoryPatterns[category]) {
        // This would need OR conditions for each pattern
        // For now, we'll filter in JavaScript
      }
    }

    const { data: medications, error } = await query;

    if (error) throw error;

    // Format as timeline
    const timeline = (medications || []).map(med => ({
      id: med.id,
      medication: med.medication_name,
      dosage: med.dosage,
      frequency: med.frequency,
      startDate: med.start_date,
      endDate: med.end_date,
      status: med.status || (med.end_date ? 'discontinued' : 'active'),
      stopReason: med.stop_reason,
      changeReason: med.change_reason,
      prescribedBy: med.prescribed_by,
      category: med.category,
      rxnormCode: med.rxnorm_code
    }));

    res.json({
      success: true,
      treatmentHistory: timeline
    });

  } catch (error) {
    logger.error('PatientChart', 'Failed to fetch treatment history', {
      error: error.message,
      errorCode: error.code
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch treatment history'
    });
  }
});

/**
 * GET /api/patient-chart/:patientId/plan-memory
 * Get last visit changes and next decision triggers (Zone C data)
 */
router.get('/:patientId/plan-memory', async (req, res) => {
  try {
    const { patientId } = req.params;

    const supabase = getSupabase();

    // Find patient
    const { data: patient } = await supabase
      .from('unified_patients')
      .select('id, tshla_id')
      .or(`id.eq.${patientId},patient_id.eq.${patientId},tshla_id.eq.${patientId}`)
      .single();

    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }

    // Get last 2 dictations to compare changes
    const { data: dictations } = await supabase
      .from('dictated_notes')
      .select('id, visit_date, chief_complaint, processed_note, provider_name, assessment_plan')
      .eq('unified_patient_id', patient.id)
      .order('visit_date', { ascending: false })
      .limit(2);

    // Get patient daily status if available
    const { data: dailyStatus } = await supabase
      .from('patient_daily_status')
      .select('*')
      .eq('unified_patient_id', patient.id)
      .order('computed_at', { ascending: false })
      .limit(1)
      .single();

    const lastVisit = dictations?.[0];
    const previousVisit = dictations?.[1];

    // Extract changes from notes (simplified - would use AI in production)
    const extractChanges = (note) => {
      if (!note) return [];
      const changes = [];

      // Look for medication changes
      const medPatterns = [
        /(?:started|began|initiated|added)\s+(\w+)/gi,
        /(?:increased|decreased|adjusted)\s+(\w+)\s+(?:to|by)/gi,
        /(?:stopped|discontinued|held)\s+(\w+)/gi
      ];

      for (const pattern of medPatterns) {
        let match;
        while ((match = pattern.exec(note)) !== null) {
          changes.push({
            action: match[0],
            details: null
          });
        }
      }

      return changes.slice(0, 5); // Limit to 5 changes
    };

    // Build watching list from assessment/plan
    const extractWatching = (note) => {
      if (!note) return [];
      const watching = [];

      const watchPatterns = [
        /(?:monitor|watch|follow|check)\s+([^.]+)/gi,
        /(?:recheck|repeat)\s+(\w+)\s+(?:in|at)/gi
      ];

      for (const pattern of watchPatterns) {
        let match;
        while ((match = pattern.exec(note)) !== null) {
          watching.push({
            item: match[1].trim(),
            status: 'watching'
          });
        }
      }

      return watching.slice(0, 5);
    };

    // Build triggers from assessment/plan
    const extractTriggers = (note) => {
      if (!note) return [];
      const triggers = [];

      const triggerPatterns = [
        /if\s+([^,]+),\s*(?:then\s+)?([^.]+)/gi,
        /(?:consider|start|add)\s+(\w+)\s+if\s+([^.]+)/gi
      ];

      for (const pattern of triggerPatterns) {
        let match;
        while ((match = pattern.exec(note)) !== null) {
          triggers.push({
            condition: match[1].trim(),
            action: match[2]?.trim() || match[1].trim()
          });
        }
      }

      return triggers.slice(0, 3);
    };

    const planMemory = {
      lastVisitDate: lastVisit?.visit_date,
      lastVisitProvider: lastVisit?.provider_name,

      // What we did last visit
      lastVisitChanges: extractChanges(lastVisit?.processed_note),

      // What we're watching
      watching: extractWatching(lastVisit?.processed_note || lastVisit?.assessment_plan),

      // Decision triggers
      nextTriggers: extractTriggers(lastVisit?.processed_note || lastVisit?.assessment_plan),

      // Last note excerpt
      lastNoteExcerpt: lastVisit?.processed_note?.slice(0, 300),

      // From daily status if available
      statusHeadline: dailyStatus?.status_headline,
      focusItem: dailyStatus?.focus_item
    };

    res.json({
      success: true,
      planMemory
    });

  } catch (error) {
    logger.error('PatientChart', 'Failed to fetch plan memory', {
      error: error.message,
      errorCode: error.code
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch plan memory'
    });
  }
});

// Helper function to calculate CGM stats
function calculateCGMStats(readings) {
  if (!readings || readings.length === 0) return null;

  const values = readings.map(r => r.glucose_value).filter(v => v > 0);
  if (values.length === 0) return null;

  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const inRange = values.filter(v => v >= 70 && v <= 180).length;
  const belowRange = values.filter(v => v < 70).length;
  const aboveRange = values.filter(v => v > 180).length;

  return {
    averageGlucose: Math.round(avg),
    timeInRangePercent: Math.round((inRange / values.length) * 100),
    timeBelowRangePercent: Math.round((belowRange / values.length) * 100),
    timeAboveRangePercent: Math.round((aboveRange / values.length) * 100),
    estimatedA1c: ((avg + 46.7) / 28.7).toFixed(1),
    readingCount: values.length
  };
}

// Helper function to build disease-specific data
function buildDiseaseSpecificData(dashboardType, compChart, cgmReadings) {
  const data = {};

  switch (dashboardType) {
    case 'diabetes':
      // Group medications by class
      const diabetesMeds = (compChart?.medications || []).filter(m => {
        const name = (m.medication_name || m.medication || '').toLowerCase();
        return name.includes('metformin') ||
               name.includes('insulin') ||
               name.includes('glp') ||
               name.includes('sglt2') ||
               name.includes('ozempic') ||
               name.includes('mounjaro') ||
               name.includes('jardiance') ||
               name.includes('trulicity');
      });

      data.medicationsByClass = {
        basal: diabetesMeds.filter(m => /insulin.*(glargine|detemir|degludec|nph)/i.test(m.medication_name || m.medication)),
        bolus: diabetesMeds.filter(m => /insulin.*(lispro|aspart|glulisine|regular)/i.test(m.medication_name || m.medication)),
        glp1: diabetesMeds.filter(m => /ozempic|mounjaro|trulicity|victoza|wegovy|zepbound/i.test(m.medication_name || m.medication)),
        sglt2: diabetesMeds.filter(m => /jardiance|farxiga|invokana/i.test(m.medication_name || m.medication)),
        oral: diabetesMeds.filter(m => /metformin|glipizide|glimepiride|pioglitazone/i.test(m.medication_name || m.medication))
      };

      // A1C trend
      const a1cLabs = compChart?.labs?.['Hemoglobin A1C'] || compChart?.labs?.['A1C'] || [];
      data.a1cTrend = a1cLabs.slice(-4);

      // Hypoglycemia events from CGM
      if (cgmReadings) {
        const lowEvents = cgmReadings.filter(r => r.glucose_value < 70);
        data.hypoglycemiaEvents = {
          count: lowEvents.length,
          percentOfReadings: cgmReadings.length > 0 ? ((lowEvents.length / cgmReadings.length) * 100).toFixed(1) : 0
        };
      }
      break;

    case 'thyroid':
      // TSH, FT4, FT3 trends
      data.tshTrend = compChart?.labs?.['TSH'] || [];
      data.ft4Trend = compChart?.labs?.['Free T4'] || compChart?.labs?.['FT4'] || [];
      data.ft3Trend = compChart?.labs?.['Free T3'] || compChart?.labs?.['FT3'] || [];

      // Thyroid medications
      data.thyroidMeds = (compChart?.medications || []).filter(m => {
        const name = (m.medication_name || m.medication || '').toLowerCase();
        return name.includes('levothyroxine') ||
               name.includes('synthroid') ||
               name.includes('liothyronine') ||
               name.includes('methimazole');
      });
      break;

    case 'thyroid-cancer':
      // Thyroglobulin trend
      data.tgTrend = compChart?.labs?.['Thyroglobulin'] || [];
      data.tgAbTrend = compChart?.labs?.['Thyroglobulin Antibody'] || [];
      data.tshTrend = compChart?.labs?.['TSH'] || [];

      // Cancer-specific diagnoses
      data.cancerInfo = (compChart?.diagnoses || []).find(d =>
        /thyroid.*cancer|papillary|follicular|medullary|anaplastic/i.test(d.diagnosis)
      );
      break;

    case 'thyroid-nodule':
      // Nodule tracking would typically come from imaging reports
      // For now, extract from diagnoses
      data.noduleInfo = (compChart?.diagnoses || []).filter(d =>
        /nodule|ti-rads/i.test(d.diagnosis)
      );
      break;

    case 'osteoporosis':
      // DEXA results would be in labs or special table
      data.dexaResults = compChart?.labs?.['DEXA'] || compChart?.labs?.['Bone Density'] || [];

      // Bone medications
      data.boneMeds = (compChart?.medications || []).filter(m => {
        const name = (m.medication_name || m.medication || '').toLowerCase();
        return name.includes('alendronate') ||
               name.includes('risedronate') ||
               name.includes('denosumab') ||
               name.includes('prolia') ||
               name.includes('teriparatide') ||
               name.includes('forteo');
      });

      // Vitamin D and Calcium
      data.vitaminD = compChart?.labs?.['Vitamin D'] || compChart?.labs?.['25-OH Vitamin D'] || [];
      data.calcium = compChart?.labs?.['Calcium'] || [];
      break;
  }

  return data;
}

// ===============================
// GET PATIENT CHART (Generic route - MUST BE LAST)
// ===============================

/**
 * GET /api/patient-chart/:identifier
 * Get complete patient chart by phone number or patient ID
 *
 * Examples:
 * - /api/patient-chart/5551234567
 * - /api/patient-chart/PT-2025-0001
 */
router.get('/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;

    if (!identifier) {
      return res.status(400).json({
        success: false,
        error: 'Patient identifier (phone or ID) is required'
      });
    }

    const chart = await patientMatchingService.getPatientChart(identifier);

    res.json({
      success: true,
      chart
    });
  } catch (error) {
    logger.error('PatientChart', 'Failed to fetch patient chart', {
      error: error.message,
      errorCode: error.code
    });

    if (error.message === 'Patient not found') {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to fetch patient chart',
      details: error.message
    });
  }
});

/**
 * POST /api/patient-chart/create
 * Create new patient using patientMatching.service.js
 * Handles TSHLA ID generation, duplicate prevention, phone normalization
 *
 * Body: { phone, patientData, source }
 */
router.post('/create', async (req, res) => {
  try {
    const { phone, patientData, source } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    if (!patientData || !patientData.first_name || !patientData.last_name) {
      return res.status(400).json({
        success: false,
        error: 'Patient first name and last name are required'
      });
    }

    // Use patientMatching service to create patient
    // This handles: TSHLA ID generation, duplicate checking, phone normalization, PIN generation
    const patient = await patientMatchingService.findOrCreatePatient(
      phone,
      patientData,
      source || 'dictation'
    );

    res.json({
      success: true,
      patient,
      message: 'Patient created successfully'
    });

  } catch (error) {
    logger.error('PatientChart', 'Failed to create patient', {
      error: error.message,
      errorCode: error.code
    });

    // Check if it's a duplicate phone error
    if (error.code === '23505' && error.message.includes('phone_primary')) {
      return res.status(409).json({
        success: false,
        error: 'A patient with this phone number already exists'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create patient',
      details: error.message
    });
  }
});

/**
 * POST /api/patient-chart/find-or-create
 * Find existing patient or create new one (idempotent)
 * Same as /create but emphasizes the find-first behavior
 *
 * Body: { phone, patientData, source }
 */
router.post('/find-or-create', async (req, res) => {
  try {
    const { phone, patientData, source } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    // Use patientMatching service - will find existing or create new
    const patient = await patientMatchingService.findOrCreatePatient(
      phone,
      patientData || {},
      source || 'unknown'
    );

    const wasCreated = !patient.last_data_merge_at; // New patient won't have merge timestamp

    res.json({
      success: true,
      patient,
      wasCreated,
      message: wasCreated ? 'Patient created successfully' : 'Found existing patient'
    });

  } catch (error) {
    logger.error('PatientChart', 'Failed to find or create patient', {
      error: error.message,
      errorCode: error.code
    });
    res.status(500).json({
      success: false,
      error: 'Failed to find or create patient',
      details: error.message
    });
  }
});


module.exports = router;
