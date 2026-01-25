/**
 * Patient Portal API Routes
 * Handles unified portal authentication, dashboard data, and session management
 *
 * Created: 2026-01-23
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const logger = require('../logger');

// Configure multer for handling file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

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
 * POST /api/patient-portal/upload-document
 * Upload medical documents (files, text, or audio) and extract information with AI
 */
router.post('/upload-document', upload.any(), async (req, res) => {
  try {
    const { tshlaId, patientId, sessionId, uploadMethod, textContent } = req.body;

    if (!tshlaId || !sessionId || !uploadMethod) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const normalizedTshId = tshlaId.replace(/[\s-]/g, '').toUpperCase();

    logger.info('PatientPortal', 'Document upload started', {
      tshlaId: normalizedTshId,
      method: uploadMethod
    });

    // Verify patient exists (try both normalized and formatted versions)
    let patient = null;

    // Try normalized format first (TSH123001)
    const result1 = await supabase
      .from('unified_patients')
      .select('id, phone_primary, first_name, last_name')
      .eq('tshla_id', normalizedTshId)
      .maybeSingle();

    if (result1.data) {
      patient = result1.data;
    } else {
      // Try formatted version (TSH 123-001)
      const formatted = normalizedTshId.replace(/^TSH(\d{3})(\d{3})$/, 'TSH $1-$2');
      const result2 = await supabase
        .from('unified_patients')
        .select('id, phone_primary, first_name, last_name')
        .eq('tshla_id', formatted)
        .maybeSingle();

      patient = result2.data;
    }

    if (!patient) {
      logger.warn('PatientPortal', 'Patient not found for upload', {
        tshlaId: normalizedTshId
      });
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    let extractedData = {
      diagnoses: [],
      medications: [],
      allergies: [],
      labs: [],
      procedures: [],
      vitals: {},
      raw_content: ''
    };

    // Process based on upload method
    if (uploadMethod === 'text') {
      // Process text content with AI
      extractedData.raw_content = textContent;

      // TODO: Integrate with OpenAI/Azure AI to extract medical information
      // For now, store the raw text
      logger.info('PatientPortal', 'Processing text upload', {
        tshlaId: normalizedTshId,
        length: textContent?.length
      });

    } else if (uploadMethod === 'file') {
      // Process file uploads
      logger.info('PatientPortal', 'Processing file upload', {
        tshlaId: normalizedTshId,
        fileCount: req.files?.length
      });

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No files uploaded'
        });
      }

      // Process each uploaded file
      for (const file of req.files) {
        const fileName = file.originalname;
        const fileType = file.mimetype;
        const fileSize = file.size;

        logger.info('PatientPortal', 'Processing file', {
          fileName,
          fileType,
          fileSize
        });

        // Convert buffer to string for XML/CCD files
        if (fileName.toLowerCase().endsWith('.xml') ||
            fileName.toLowerCase().endsWith('.ccd') ||
            fileType === 'text/xml' ||
            fileType === 'application/xml') {

          const xmlContent = file.buffer.toString('utf-8');
          extractedData.raw_content = xmlContent;

          // Basic CCD parsing - extract key sections
          // This is a simplified parser - CCD/C-CDA files are complex
          try {
            // Extract diagnoses/problems
            const problemMatches = xmlContent.match(/<code code="([^"]*)" displayName="([^"]*)"/g);
            if (problemMatches) {
              problemMatches.forEach(match => {
                const displayMatch = match.match(/displayName="([^"]*)"/);
                if (displayMatch) {
                  extractedData.diagnoses.push(displayMatch[1]);
                }
              });
            }

            // Extract medications
            const medMatches = xmlContent.match(/<manufacturedMaterial>[\s\S]*?<name>([^<]*)<\/name>/g);
            if (medMatches) {
              medMatches.forEach(match => {
                const nameMatch = match.match(/<name>([^<]*)<\/name>/);
                if (nameMatch) {
                  extractedData.medications.push(nameMatch[1]);
                }
              });
            }

            // Extract allergies
            const allergyMatches = xmlContent.match(/<participant typeCode="CSM">[\s\S]*?<name>([^<]*)<\/name>/g);
            if (allergyMatches) {
              allergyMatches.forEach(match => {
                const nameMatch = match.match(/<name>([^<]*)<\/name>/);
                if (nameMatch) {
                  extractedData.allergies.push(nameMatch[1]);
                }
              });
            }

            // Extract lab results from observations
            const observationMatches = xmlContent.match(/<observation[\s\S]*?<\/observation>/g);
            if (observationMatches) {
              observationMatches.forEach(obs => {
                // Look for result observations with numeric values (PQ = Physical Quantity)
                const codeMatch = obs.match(/<code[\s\S]*?displayName="([^"]*)"/);

                // Match both formats: unit="x" value="y" OR value="y" unit="x"
                const valueMatch1 = obs.match(/<value[\s\S]*?value="([^"]*)"[\s\S]*?unit="([^"]*)"/);
                const valueMatch2 = obs.match(/<value[\s\S]*?unit="([^"]*)"[\s\S]*?value="([^"]*)"/);
                const valueMatch = valueMatch1 || valueMatch2;

                if (codeMatch && valueMatch) {
                  const labName = codeMatch[1];
                  // Handle both match orders
                  const labValue = valueMatch1 ? valueMatch[1] : valueMatch[2];
                  const labUnit = valueMatch1 ? valueMatch[2] : valueMatch[1];

                  // Filter out non-lab observations and ensure we have valid data
                  if (labName && labValue && !labName.includes('Instruction') &&
                      !labName.includes('Order') && !labName.includes('Sex') &&
                      !labName.includes('Birth')) {
                    extractedData.labs.push({
                      name: labName,
                      value: labValue,
                      unit: labUnit
                    });
                  }
                }
              });
            }

            // Extract vitals
            const vitalMatches = xmlContent.match(/<vital-sign[\s\S]*?<\/vital-sign>|<organizer[\s\S]*?templateId root="2\.16\.840\.1\.113883\.10\.20\.22\.4\.26"[\s\S]*?<\/organizer>/g);
            if (vitalMatches) {
              vitalMatches.forEach(vital => {
                const codeMatch = vital.match(/<code[\s\S]*?displayName="([^"]*)"/);
                const valueMatch = vital.match(/<value[\s\S]*?value="([^"]*)"[\s\S]*?unit="([^"]*)"/);

                if (codeMatch && valueMatch) {
                  const vitalName = codeMatch[1];
                  extractedData.vitals[vitalName] = {
                    value: valueMatch[1],
                    unit: valueMatch[2]
                  };
                }
              });
            }

            logger.info('PatientPortal', 'Extracted CCD data', {
              diagnoses: extractedData.diagnoses.length,
              medications: extractedData.medications.length,
              allergies: extractedData.allergies.length,
              labs: extractedData.labs.length,
              vitals: Object.keys(extractedData.vitals).length
            });

          } catch (parseError) {
            logger.error('PatientPortal', 'CCD parsing error', {
              error: parseError.message
            });
          }

        } else if (fileName.toLowerCase().endsWith('.pdf')) {
          // TODO: Parse PDF files
          extractedData.raw_content = `[PDF file: ${fileName}]`;

        } else if (fileName.toLowerCase().match(/\.(jpg|jpeg|png|gif)$/)) {
          // TODO: OCR image files
          extractedData.raw_content = `[Image file: ${fileName}]`;

        } else {
          // For other file types, just store the text content if possible
          try {
            extractedData.raw_content = file.buffer.toString('utf-8');
          } catch (e) {
            extractedData.raw_content = `[Binary file: ${fileName}]`;
          }
        }
      }

    } else if (uploadMethod === 'voice') {
      // TODO: Process audio recording
      // - Transcribe with Deepgram/Azure Speech
      // - Extract medical information with AI
      logger.info('PatientPortal', 'Processing voice upload', {
        tshlaId: normalizedTshId
      });

      return res.status(501).json({
        success: false,
        error: 'Voice upload processing coming soon. Please use text input for now.'
      });
    }

    // Store upload record
    const { data: uploadRecord, error: uploadError } = await supabase
      .from('patient_document_uploads')
      .insert({
        patient_id: patient.id,
        tshla_id: normalizedTshId,
        upload_method: uploadMethod,
        raw_content: extractedData.raw_content,
        extracted_data: extractedData,
        uploaded_at: new Date().toISOString(),
        session_id: sessionId
      })
      .select()
      .single();

    if (uploadError) {
      logger.error('PatientPortal', 'Failed to store upload', {
        error: uploadError.message
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to save upload'
      });
    }

    // Log access for HIPAA compliance
    await supabase
      .from('access_logs')
      .insert({
        user_type: 'patient',
        user_id: patient.id,
        action: 'document_upload',
        resource_type: 'patient_document',
        resource_id: uploadRecord.id,
        ip_address: req.ip || req.connection.remoteAddress,
        user_agent: req.headers['user-agent'],
        details: { upload_method: uploadMethod, tshla_id: normalizedTshId }
      });

    logger.info('PatientPortal', 'Document upload completed', {
      tshlaId: normalizedTshId,
      uploadId: uploadRecord.id
    });

    res.json({
      success: true,
      uploadId: uploadRecord.id,
      message: 'Document uploaded successfully. Our team will review and add information to your chart.'
    });

  } catch (error) {
    logger.error('PatientPortal', 'Upload error', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: 'Failed to process upload. Please try again.'
    });
  }
});

/**
 * GET /api/patient-portal/medical-records
 * Get patient's uploaded documents and extracted lab data
 */
router.get('/medical-records', async (req, res) => {
  try {
    const { tshlaId, sessionId } = req.query;

    if (!tshlaId || !sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    const normalizedTshId = tshlaId.replace(/[\s-]/g, '').toUpperCase();

    logger.info('PatientPortal', 'Fetching medical records', {
      tshlaId: normalizedTshId
    });

    // Verify patient exists (try both formats)
    let patient = null;
    const result1 = await supabase
      .from('unified_patients')
      .select('id, first_name, last_name, tshla_id')
      .eq('tshla_id', normalizedTshId)
      .maybeSingle();

    if (result1.data) {
      patient = result1.data;
    } else {
      const formatted = normalizedTshId.replace(/^TSH(\d{3})(\d{3})$/, 'TSH $1-$2');
      const result2 = await supabase
        .from('unified_patients')
        .select('id, first_name, last_name, tshla_id')
        .eq('tshla_id', formatted)
        .maybeSingle();
      patient = result2.data;
    }

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    // Get all uploaded documents for this patient
    const { data: uploads, error: uploadsError } = await supabase
      .from('patient_document_uploads')
      .select('*')
      .eq('patient_id', patient.id)
      .order('uploaded_at', { ascending: false });

    if (uploadsError) {
      logger.error('PatientPortal', 'Error fetching uploads', {
        error: uploadsError.message
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch medical records'
      });
    }

    // Aggregate all labs from uploads
    const allLabs = [];
    const allMedications = new Set();
    const allAllergies = new Set();

    uploads.forEach(upload => {
      if (upload.extracted_data) {
        const e = upload.extracted_data;

        // Collect labs
        if (e.labs && Array.isArray(e.labs)) {
          e.labs.forEach(lab => {
            allLabs.push({
              ...lab,
              upload_date: upload.uploaded_at,
              upload_id: upload.id
            });
          });
        }

        // Collect medications
        if (e.medications && Array.isArray(e.medications)) {
          e.medications.forEach(med => {
            if (med !== 'AthenaHealth') {
              allMedications.add(med);
            }
          });
        }

        // Collect allergies
        if (e.allergies && Array.isArray(e.allergies)) {
          e.allergies.forEach(allergy => allAllergies.add(allergy));
        }
      }
    });

    // Organize labs by name and deduplicate by date+value
    const labsByName = {};
    allLabs.forEach(lab => {
      if (!labsByName[lab.name]) {
        labsByName[lab.name] = [];
      }

      // Check if this exact lab (same date and value) already exists
      const dateStr = new Date(lab.upload_date).toISOString().split('T')[0]; // Just the date part
      const isDuplicate = labsByName[lab.name].some(existing => {
        const existingDateStr = new Date(existing.date).toISOString().split('T')[0];
        return existingDateStr === dateStr &&
               existing.value === lab.value &&
               existing.unit === lab.unit;
      });

      // Only add if not a duplicate
      if (!isDuplicate) {
        labsByName[lab.name].push({
          value: lab.value,
          unit: lab.unit,
          date: lab.upload_date
        });
      }
    });

    // Log access
    await supabase
      .from('access_logs')
      .insert({
        user_type: 'patient',
        user_id: patient.id,
        action: 'view_medical_records',
        resource_type: 'patient_documents',
        ip_address: req.ip || req.connection.remoteAddress,
        user_agent: req.headers['user-agent'],
        details: { tshla_id: normalizedTshId, upload_count: uploads.length }
      });

    res.json({
      success: true,
      patient: {
        name: `${patient.first_name} ${patient.last_name}`,
        tshla_id: patient.tshla_id
      },
      uploads: uploads.map(u => ({
        id: u.id,
        upload_method: u.upload_method,
        uploaded_at: u.uploaded_at,
        lab_count: u.extracted_data?.labs?.length || 0,
        medication_count: u.extracted_data?.medications?.length || 0,
        allergy_count: u.extracted_data?.allergies?.length || 0
      })),
      labs: labsByName,
      medications: Array.from(allMedications),
      allergies: Array.from(allAllergies),
      total_uploads: uploads.length,
      total_labs: allLabs.length
    });

  } catch (error) {
    logger.error('PatientPortal', 'Medical records error', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch medical records'
    });
  }
});

/**
 * POST /api/patient-portal/admin/clear-rate-limit
 * Clear rate limiting for a specific TSH ID or IP (admin only)
 */
router.post('/admin/clear-rate-limit', async (req, res) => {
  try {
    const { tshlaId, clearAll } = req.body;

    if (clearAll === true) {
      // Clear all rate limits
      loginAttempts.clear();
      logger.info('PatientPortal', 'Cleared all rate limits');
      return res.json({
        success: true,
        message: 'All rate limits cleared'
      });
    }

    if (tshlaId) {
      // Clear rate limits for specific TSH ID
      const normalizedTshId = tshlaId.replace(/[\s-]/g, '').toUpperCase();
      let cleared = 0;

      // Remove all entries that contain this TSH ID
      for (const [key, value] of loginAttempts.entries()) {
        if (key.includes(normalizedTshId)) {
          loginAttempts.delete(key);
          cleared++;
        }
      }

      logger.info('PatientPortal', 'Cleared rate limits', { tshlaId: normalizedTshId, count: cleared });
      return res.json({
        success: true,
        message: `Cleared ${cleared} rate limit(s) for TSH ID ${normalizedTshId}`
      });
    }

    return res.status(400).json({
      success: false,
      error: 'Must provide tshlaId or clearAll=true'
    });

  } catch (error) {
    logger.error('PatientPortal', 'Clear rate limit error', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: 'Failed to clear rate limit'
    });
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
