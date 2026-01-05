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
    console.error('Login error:', error);
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
    console.error('Error saving PCM consent:', error);
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
    console.error('PIN reset error:', error);
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
    console.error('Search error:', error);
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
    console.error('Provider patients error:', error);
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
    console.error('Stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
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
    console.error('Timeline error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch timeline'
    });
  }
});

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
    console.error('Error fetching patient chart:', error);

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
    console.error('Create patient error:', error);

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
    console.error('Find or create patient error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to find or create patient',
      details: error.message
    });
  }
});


module.exports = router;
