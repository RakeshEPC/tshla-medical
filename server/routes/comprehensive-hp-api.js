/**
 * Comprehensive H&P API Routes
 * Endpoints for patient chart (H&P) generation, retrieval, and updates
 *
 * Created: 2026-01-23
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const comprehensiveHPGenerator = require('../services/comprehensiveHPGenerator.service');
const logger = require('../services/logger.service');

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/hp/generate
 * Generate or update H&P from dictation
 * (Called automatically after dictation is saved)
 */
router.post('/generate', async (req, res) => {
  try {
    const { patientPhone, dictationId, tshlaId } = req.body;

    logger.info('HP-API', 'Generating H&P', { patientPhone, dictationId });

    if (!patientPhone) {
      return res.status(400).json({
        success: false,
        error: 'Patient phone required'
      });
    }

    // Generate/update H&P
    const hp = await comprehensiveHPGenerator.generateOrUpdateHP(patientPhone, {
      newDictationId: dictationId
    });

    // Update TSH ID if provided and not set
    if (tshlaId && !hp.tshla_id) {
      hp.tshla_id = tshlaId;
      await supabase
        .from('patient_comprehensive_chart')
        .update({ tshla_id: tshlaId })
        .eq('patient_phone', patientPhone);
    }

    logger.info('HP-API', 'H&P generation complete', {
      patientPhone,
      version: hp.version
    });

    res.json({
      success: true,
      hp: {
        version: hp.version,
        last_updated: hp.last_updated,
        sections: {
          medications: hp.medications?.length || 0,
          diagnoses: hp.diagnoses?.length || 0,
          labs: Object.keys(hp.labs || {}).length,
          vitals: Object.keys(hp.vitals || {}).length
        }
      }
    });

  } catch (error) {
    logger.error('HP-API', 'H&P generation failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to generate H&P'
    });
  }
});

/**
 * GET /api/hp/patient/:tshlaId
 * Get patient's comprehensive H&P
 */
router.get('/patient/:tshlaId', async (req, res) => {
  try {
    const { tshlaId } = req.params;
    const normalizedTshId = tshlaId.replace(/[\s-]/g, '').toUpperCase();

    logger.info('HP-API', 'Fetching H&P', { tshlaId: normalizedTshId });

    // Get patient phone from TSH ID
    const { data: patient, error: patientError } = await supabase
      .from('unified_patients')
      .select('phone_primary, first_name, last_name')
      .eq('tshla_id', normalizedTshId)
      .single();

    if (patientError || !patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    // Get H&P
    const hp = await comprehensiveHPGenerator.getPatientHP(patient.phone_primary);

    // Format response (don't send full narrative to frontend, only structured data)
    res.json({
      success: true,
      hp: {
        demographics: hp.demographics || {},
        medications: hp.medications || [],
        diagnoses: hp.diagnoses || [],
        allergies: hp.allergies || [],
        family_history: hp.family_history || [],
        social_history: hp.social_history || {},
        labs: hp.labs || {},
        vitals: hp.vitals || {},
        current_goals: hp.current_goals || [],
        external_documents: hp.external_documents || [],
        last_updated: hp.last_updated,
        version: hp.version
      },
      patientName: `${patient.first_name || ''} ${patient.last_name || ''}`.trim()
    });

  } catch (error) {
    logger.error('HP-API', 'Fetch H&P failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch H&P'
    });
  }
});

/**
 * POST /api/hp/patient/:tshlaId/edit
 * Patient edits their H&P (allergies, family history, goals)
 */
router.post('/patient/:tshlaId/edit', async (req, res) => {
  try {
    const { tshlaId } = req.params;
    const { section, data } = req.body;
    const normalizedTshId = tshlaId.replace(/[\s-]/g, '').toUpperCase();

    logger.info('HP-API', 'Patient editing H&P', {
      tshlaId: normalizedTshId,
      section
    });

    // Validate editable sections
    const editableSections = ['allergies', 'family_history', 'social_history', 'current_goals'];
    if (!editableSections.includes(section)) {
      return res.status(403).json({
        success: false,
        error: 'This section cannot be edited by patients'
      });
    }

    // Get patient
    const { data: patient, error: patientError } = await supabase
      .from('unified_patients')
      .select('phone_primary, first_name, last_name')
      .eq('tshla_id', normalizedTshId)
      .single();

    if (patientError || !patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    // Get current H&P
    const hp = await comprehensiveHPGenerator.getPatientHP(patient.phone_primary);

    // Update section
    const oldValue = hp[section];
    let newValue;

    if (Array.isArray(hp[section])) {
      // Array sections (allergies, family_history, current_goals)
      newValue = [...hp[section], data];
    } else {
      // Object sections (social_history)
      newValue = { ...hp[section], ...data };
    }

    // Save to database
    await supabase
      .from('patient_comprehensive_chart')
      .update({
        [section]: newValue,
        pending_staff_review: true
      })
      .eq('patient_phone', patient.phone_primary);

    // Log change to audit trail
    await supabase
      .from('patient_chart_history')
      .insert({
        patient_phone: patient.phone_primary,
        section_name: section,
        change_type: 'add',
        old_value: oldValue,
        new_value: data,
        changed_by: 'patient-manual',
        staff_reviewed: false
      });

    // Add to staff review queue
    await supabase
      .from('staff_review_queue')
      .insert({
        patient_phone: patient.phone_primary,
        tshla_id: normalizedTshId,
        patient_name: `${patient.first_name || ''} ${patient.last_name || ''}`.trim(),
        edit_type: `${section}_added`,
        section_name: section,
        edit_data: data,
        status: 'pending',
        priority: 'normal'
      });

    logger.info('HP-API', 'Patient edit saved', {
      tshlaId: normalizedTshId,
      section
    });

    res.json({
      success: true,
      message: 'Update saved. Your doctor will review this change.'
    });

  } catch (error) {
    logger.error('HP-API', 'Patient edit failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to save update'
    });
  }
});

/**
 * POST /api/hp/regenerate
 * Trigger on-demand H&P regeneration
 * (Staff only - can be called when patient uploads document or after manual changes)
 */
router.post('/regenerate', async (req, res) => {
  try {
    const { patientPhone, tshlaId } = req.body;

    logger.info('HP-API', 'On-demand H&P regeneration', { patientPhone, tshlaId });

    if (!patientPhone && !tshlaId) {
      return res.status(400).json({
        success: false,
        error: 'Patient phone or TSH ID required'
      });
    }

    // If TSH ID provided, get phone
    let phone = patientPhone;
    if (!phone && tshlaId) {
      const normalizedTshId = tshlaId.replace(/[\s-]/g, '').toUpperCase();
      const { data: patient } = await supabase
        .from('unified_patients')
        .select('phone_primary')
        .eq('tshla_id', normalizedTshId)
        .single();

      if (patient) {
        phone = patient.phone_primary;
      }
    }

    if (!phone) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    // Regenerate H&P
    const hp = await comprehensiveHPGenerator.triggerHPRegeneration(phone);

    res.json({
      success: true,
      message: 'H&P regenerated successfully',
      version: hp.version
    });

  } catch (error) {
    logger.error('HP-API', 'H&P regeneration failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to regenerate H&P'
    });
  }
});

/**
 * GET /api/hp/staff/review-queue
 * Get pending patient edits for staff review
 */
router.get('/staff/review-queue', async (req, res) => {
  try {
    const { status = 'pending' } = req.query;

    logger.info('HP-API', 'Fetching review queue', { status });

    const { data: queue, error } = await supabase
      .from('staff_review_queue')
      .select('*')
      .eq('status', status)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      queue: queue || [],
      count: queue?.length || 0
    });

  } catch (error) {
    logger.error('HP-API', 'Fetch review queue failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch review queue'
    });
  }
});

/**
 * POST /api/hp/staff/review/:reviewId
 * Staff reviews and approves/rejects patient edit
 */
router.post('/staff/review/:reviewId', async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { action, staffId, notes } = req.body; // action: 'approve' | 'reject' | 'edit'

    logger.info('HP-API', 'Staff reviewing edit', { reviewId, action });

    // Update review queue
    const { error } = await supabase
      .from('staff_review_queue')
      .update({
        status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'edited',
        reviewed_by: staffId,
        reviewed_at: new Date().toISOString(),
        resolution_notes: notes
      })
      .eq('id', reviewId);

    if (error) {
      throw error;
    }

    // If approved, update chart history
    if (action === 'approve') {
      await supabase
        .from('patient_chart_history')
        .update({
          staff_reviewed: true,
          staff_reviewer_id: staffId
        })
        .eq('id', reviewId);
    }

    res.json({
      success: true,
      message: `Edit ${action}d successfully`
    });

  } catch (error) {
    logger.error('HP-API', 'Staff review failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to process review'
    });
  }
});

/**
 * POST /api/hp/patient/:tshlaId/apply-edit
 * Apply approved patient edit to their H&P
 * (Called after staff approves an edit in review queue)
 */
router.post('/patient/:tshlaId/apply-edit', async (req, res) => {
  try {
    const { tshlaId } = req.params;
    const { editId, section, newValue, reviewedBy } = req.body;
    const normalizedTshId = tshlaId.replace(/[\s-]/g, '').toUpperCase();

    logger.info('HP-API', 'Applying approved edit', {
      tshlaId: normalizedTshId,
      section,
      editId
    });

    // Get patient
    const { data: patient, error: patientError } = await supabase
      .from('unified_patients')
      .select('phone_primary, first_name, last_name')
      .eq('tshla_id', normalizedTshId)
      .single();

    if (patientError || !patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    // Update the H&P with new value
    const { error: updateError } = await supabase
      .from('patient_comprehensive_chart')
      .update({
        [section]: newValue,
        last_updated: new Date().toISOString()
      })
      .eq('patient_phone', patient.phone_primary);

    if (updateError) {
      throw updateError;
    }

    // Log to audit trail
    await supabase
      .from('patient_chart_history')
      .insert({
        patient_phone: patient.phone_primary,
        section_name: section,
        change_type: 'patient_edit_approved',
        new_value: newValue,
        changed_by: 'patient-approved',
        staff_reviewed: true,
        staff_reviewer_id: reviewedBy
      });

    logger.info('HP-API', 'Edit applied successfully', {
      tshlaId: normalizedTshId,
      section
    });

    res.json({
      success: true,
      message: 'Changes applied to patient H&P'
    });

  } catch (error) {
    logger.error('HP-API', 'Apply edit failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to apply changes'
    });
  }
});

/**
 * GET /api/hp/patient/:tshlaId/narrative
 * Get AI-generated narrative H&P (for AI chat context)
 * Internal use only - not exposed to patient UI
 */
router.get('/patient/:tshlaId/narrative', async (req, res) => {
  try {
    const { tshlaId } = req.params;
    const normalizedTshId = tshlaId.replace(/[\s-]/g, '').toUpperCase();

    // Get patient
    const { data: patient } = await supabase
      .from('unified_patients')
      .select('phone_primary')
      .eq('tshla_id', normalizedTshId)
      .single();

    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }

    // Get H&P with narrative
    const { data: hp } = await supabase
      .from('patient_comprehensive_chart')
      .select('full_hp_narrative, last_ai_generated')
      .eq('patient_phone', patient.phone_primary)
      .single();

    res.json({
      success: true,
      narrative: hp?.full_hp_narrative || '',
      last_generated: hp?.last_ai_generated
    });

  } catch (error) {
    logger.error('HP-API', 'Fetch narrative failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch narrative'
    });
  }
});

module.exports = router;
