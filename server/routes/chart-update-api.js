/**
 * Chart Update API Routes
 *
 * Endpoints for voice-powered chart updates:
 * - Process transcript → extract structured data
 * - Preview merge decisions → show user what will change
 * - Apply updates → commit changes to patient chart
 * - Fill missing field → update incomplete records
 */

const express = require('express');
const router = express.Router();
const logger = require('../logger');

// Import services (TypeScript compiled to JS)
let chartUpdateExtractionService;
let chartMergeService;
let rxnormLookupService;
let loincLookupService;

// Dynamic imports for TypeScript services
async function loadServices() {
  try {
    const extraction = await import('../services/chartUpdateExtraction.service.js');
    chartUpdateExtractionService = extraction.chartUpdateExtractionService;

    const merge = await import('../services/chartMerge.service.js');
    chartMergeService = merge.chartMergeService;

    const rxnorm = await import('../services/rxnormLookup.service.js');
    rxnormLookupService = rxnorm.rxnormLookupService;

    const loinc = await import('../services/loincLookup.service.js');
    loincLookupService = loinc.loincLookupService;

    logger.info('ChartUpdate', 'Chart update services loaded successfully');
  } catch (error) {
    logger.warn('ChartUpdate', 'Could not load TypeScript services, using fallback', { error: error.message });
  }
}

// Initialize services on module load
loadServices();

/**
 * Initialize services with Supabase client
 */
function initializeServices(supabase) {
  if (chartMergeService) {
    chartMergeService.initialize(supabase);
  }
  if (loincLookupService) {
    loincLookupService.initialize(supabase);
  }
}

/**
 * POST /api/chart-update/process
 * Process voice transcript and extract structured clinical data
 *
 * Body: { transcript: string, patientId?: string }
 * Returns: ChartUpdateResult with medications, labs, vitals, etc.
 */
router.post('/process', async (req, res) => {
  try {
    const { transcript, patientId, currentDate } = req.body;

    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({
        error: 'Missing transcript',
        message: 'Transcript is required for processing'
      });
    }

    if (!chartUpdateExtractionService) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Chart update extraction service not initialized'
      });
    }

    logger.info('ChartUpdate', 'Processing chart update transcript', { charCount: transcript.length });
    const startTime = Date.now();

    // Extract structured data from transcript
    const extractedData = await chartUpdateExtractionService.extractFromTranscript(
      transcript,
      currentDate ? new Date(currentDate) : new Date()
    );

    logger.info('ChartUpdate', 'Extraction complete', {
      durationMs: Date.now() - startTime,
      medications: extractedData.medications.length,
      labs: extractedData.labs.length,
      vitals: extractedData.vitals.length,
      overallCompleteness: extractedData.overallCompleteness
    });

    res.json({
      success: true,
      data: extractedData
    });

  } catch (error) {
    logger.error('ChartUpdate', 'Chart update processing failed', { error: error.message });
    res.status(500).json({
      error: 'Processing failed',
      message: error.message
    });
  }
});

/**
 * POST /api/chart-update/preview
 * Preview what changes would be made to patient chart
 *
 * Body: { extractedData: ChartUpdateResult, patientId: string }
 * Returns: ChartMergeResult with merge decisions
 */
router.post('/preview', async (req, res) => {
  try {
    const { extractedData, patientId, tshlaId } = req.body;

    if (!extractedData) {
      return res.status(400).json({
        error: 'Missing data',
        message: 'Extracted data is required for preview'
      });
    }

    const id = patientId || tshlaId;
    if (!id) {
      return res.status(400).json({
        error: 'Missing patient identifier',
        message: 'Either patientId or tshlaId is required'
      });
    }

    if (!chartMergeService) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Chart merge service not initialized'
      });
    }

    logger.info('ChartUpdate', 'Previewing merge for patient', { patientId: id });
    const startTime = Date.now();

    // Process and get merge decisions
    const mergeResult = await chartMergeService.processExtractedData(extractedData, id);

    logger.info('ChartUpdate', 'Preview complete', { durationMs: Date.now() - startTime, summary: mergeResult.summary });

    res.json({
      success: true,
      data: mergeResult
    });

  } catch (error) {
    logger.error('ChartUpdate', 'Chart update preview failed', { error: error.message });
    res.status(500).json({
      error: 'Preview failed',
      message: error.message
    });
  }
});

/**
 * POST /api/chart-update/apply
 * Apply approved changes to patient chart
 *
 * Body: { mergeResult: ChartMergeResult, patientId: string }
 * Returns: { success: boolean, applied: number, errors: string[] }
 */
router.post('/apply', async (req, res) => {
  try {
    const { mergeResult, patientId, tshlaId, userId } = req.body;

    if (!mergeResult) {
      return res.status(400).json({
        error: 'Missing data',
        message: 'Merge result is required to apply changes'
      });
    }

    const id = patientId || tshlaId;
    if (!id) {
      return res.status(400).json({
        error: 'Missing patient identifier',
        message: 'Either patientId or tshlaId is required'
      });
    }

    if (!chartMergeService) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Chart merge service not initialized'
      });
    }

    logger.info('ChartUpdate', 'Applying chart updates for patient', { patientId: id });
    const startTime = Date.now();

    // Apply the approved changes
    const applyResult = await chartMergeService.applyMergeResults(
      mergeResult,
      id,
      userId || 'system'
    );

    logger.info('ChartUpdate', 'Apply complete', {
      durationMs: Date.now() - startTime,
      applied: applyResult.applied,
      errorCount: applyResult.errors.length
    });

    res.json({
      success: applyResult.success,
      applied: applyResult.applied,
      errors: applyResult.errors
    });

  } catch (error) {
    logger.error('ChartUpdate', 'Chart update apply failed', { error: error.message });
    res.status(500).json({
      error: 'Apply failed',
      message: error.message
    });
  }
});

/**
 * POST /api/chart-update/fill-field
 * Fill in a missing field for an existing record
 *
 * Body: { recordType: 'medication'|'lab', recordId: string, fieldName: string, fieldValue: string }
 * Returns: { success: boolean }
 */
router.post('/fill-field', async (req, res) => {
  try {
    const { recordType, recordId, fieldName, fieldValue, userId } = req.body;

    if (!recordType || !recordId || !fieldName || !fieldValue) {
      return res.status(400).json({
        error: 'Missing fields',
        message: 'recordType, recordId, fieldName, and fieldValue are all required'
      });
    }

    if (!['medication', 'lab'].includes(recordType)) {
      return res.status(400).json({
        error: 'Invalid record type',
        message: 'recordType must be "medication" or "lab"'
      });
    }

    if (!chartMergeService) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Chart merge service not initialized'
      });
    }

    logger.info('ChartUpdate', 'Filling field', { fieldName, recordType, recordId });

    const result = await chartMergeService.fillMissingField(
      recordType,
      recordId,
      fieldName,
      fieldValue,
      userId || 'system'
    );

    if (result.success) {
      res.json({ success: true });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    logger.error('ChartUpdate', 'Fill field failed', { error: error.message });
    res.status(500).json({
      error: 'Fill field failed',
      message: error.message
    });
  }
});

/**
 * GET /api/chart-update/lookup/medication/:name
 * Look up RxNorm code for a medication
 */
router.get('/lookup/medication/:name', async (req, res) => {
  try {
    const { name } = req.params;

    if (!rxnormLookupService) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'RxNorm lookup service not initialized'
      });
    }

    const result = await rxnormLookupService.lookupMedication(name);
    res.json(result);

  } catch (error) {
    logger.error('ChartUpdate', 'Medication lookup failed', { error: error.message });
    res.status(500).json({
      error: 'Lookup failed',
      message: error.message
    });
  }
});

/**
 * GET /api/chart-update/lookup/lab/:name
 * Look up LOINC code for a lab test
 */
router.get('/lookup/lab/:name', async (req, res) => {
  try {
    const { name } = req.params;

    if (!loincLookupService) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'LOINC lookup service not initialized'
      });
    }

    const result = await loincLookupService.lookupLabTest(name);
    res.json(result);

  } catch (error) {
    logger.error('ChartUpdate', 'Lab lookup failed', { error: error.message });
    res.status(500).json({
      error: 'Lookup failed',
      message: error.message
    });
  }
});

/**
 * GET /api/chart-update/pending/:patientId
 * Get incomplete records (missing fields) for a patient
 */
router.get('/pending/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const supabase = req.app.locals.supabase;

    if (!supabase) {
      return res.status(503).json({
        error: 'Database unavailable',
        message: 'Supabase client not initialized'
      });
    }

    // Get medications with missing fields
    const { data: meds, error: medsError } = await supabase
      .from('patient_medications')
      .select('id, medication_name, dosage, frequency, route, completeness_score, missing_fields')
      .or(`unified_patient_id.eq.${patientId},tshla_id.eq.${patientId}`)
      .eq('status', 'active')
      .lt('completeness_score', 100);

    if (medsError) {
      logger.warn('ChartUpdate', 'Error fetching pending medications', { error: medsError?.message });
    }

    // Get labs from chart with incomplete data
    const { data: chartData, error: chartError } = await supabase
      .from('patient_comprehensive_chart')
      .select('pending_completions, lab_completeness, medication_completeness')
      .or(`unified_patient_id.eq.${patientId},tshla_id.eq.${patientId}`)
      .single();

    if (chartError) {
      logger.warn('ChartUpdate', 'Error fetching chart pending data', { error: chartError?.message });
    }

    const pendingMeds = (meds || []).map(m => ({
      type: 'medication',
      id: m.id,
      name: m.medication_name,
      completeness: m.completeness_score,
      missingFields: m.missing_fields || []
    }));

    const pendingFromChart = chartData?.pending_completions || [];

    res.json({
      success: true,
      data: {
        medications: pendingMeds,
        other: pendingFromChart,
        totalPending: pendingMeds.length + pendingFromChart.length
      }
    });

  } catch (error) {
    logger.error('ChartUpdate', 'Get pending failed', { error: error.message });
    res.status(500).json({
      error: 'Get pending failed',
      message: error.message
    });
  }
});

/**
 * POST /api/chart-update/process-and-preview
 * Combined endpoint: process transcript and preview merge in one call
 *
 * Body: { transcript: string, patientId: string }
 * Returns: { extracted: ChartUpdateResult, merge: ChartMergeResult }
 */
router.post('/process-and-preview', async (req, res) => {
  try {
    const { transcript, patientId, tshlaId, currentDate } = req.body;

    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({
        error: 'Missing transcript',
        message: 'Transcript is required for processing'
      });
    }

    const id = patientId || tshlaId;
    if (!id) {
      return res.status(400).json({
        error: 'Missing patient identifier',
        message: 'Either patientId or tshlaId is required'
      });
    }

    if (!chartUpdateExtractionService || !chartMergeService) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Chart update services not initialized'
      });
    }

    logger.info('ChartUpdate', 'Processing and previewing chart update', { patientId: id });
    const startTime = Date.now();

    // Step 1: Extract structured data
    const extractedData = await chartUpdateExtractionService.extractFromTranscript(
      transcript,
      currentDate ? new Date(currentDate) : new Date()
    );

    // Step 2: Preview merge decisions
    const mergeResult = await chartMergeService.processExtractedData(extractedData, id);

    logger.info('ChartUpdate', 'Process and preview complete', {
      durationMs: Date.now() - startTime,
      extracted: {
        medications: extractedData.medications.length,
        labs: extractedData.labs.length,
        vitals: extractedData.vitals.length
      },
      merge: mergeResult.summary
    });

    res.json({
      success: true,
      data: {
        extracted: extractedData,
        merge: mergeResult
      }
    });

  } catch (error) {
    logger.error('ChartUpdate', 'Process and preview failed', { error: error.message });
    res.status(500).json({
      error: 'Processing failed',
      message: error.message
    });
  }
});

// Export router and initialization function
module.exports = router;
module.exports.initializeServices = initializeServices;
