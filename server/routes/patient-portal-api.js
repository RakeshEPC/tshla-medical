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

// Active sessions map (in-memory, for MVP - move to Redis for production)
// This tracks active patient portal sessions for validation
const activeSessions = new Map();

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

    // Store active session (expires in 2 hours)
    activeSessions.set(sessionId, {
      tshlaId: normalizedTshId,
      patientPhone: patient.phone_primary,
      patientName,
      createdAt: Date.now()
    });

    // Auto-expire sessions after 2 hours
    setTimeout(() => {
      activeSessions.delete(sessionId);
      logger.info('PatientPortal', 'Session expired', { sessionId, tshlaId: normalizedTshId });
    }, 2 * 60 * 60 * 1000);

    // 4. Create session record in database
    const { error: sessionError } = await supabase
      .from('patient_portal_sessions')
      .insert({
        id: sessionId, // Store the session ID for validation
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

            // Extract medications with detailed information
            // CCD medications are in substanceAdministration sections
            const medSectionMatches = xmlContent.match(/<substanceAdministration[\s\S]*?<\/substanceAdministration>/g);
            if (medSectionMatches) {
              medSectionMatches.forEach(medSection => {
                // Medication name
                const nameMatch = medSection.match(/<name>([^<]*)<\/name>/);

                // Dosage/strength - look for doseQuantity
                const doseMatch = medSection.match(/<doseQuantity[\s\S]*?value="([^"]*)"[\s\S]*?unit="([^"]*)"/);

                // Frequency - look for frequency text or period
                let frequency = '';
                const freqPeriodMatch = medSection.match(/<period[\s\S]*?value="([^"]*)"[\s\S]*?unit="([^"]*)"/);
                if (freqPeriodMatch) {
                  const value = freqPeriodMatch[1];
                  const unit = freqPeriodMatch[2];
                  if (value === '1' && unit === 'd') frequency = 'Daily';
                  else if (value === '12' && unit === 'h') frequency = 'BID (twice daily)';
                  else if (value === '8' && unit === 'h') frequency = 'TID (three times daily)';
                  else if (value === '6' && unit === 'h') frequency = 'QID (four times daily)';
                  else frequency = `Every ${value} ${unit}`;
                }

                // Route of administration
                const routeMatch = medSection.match(/<routeCode[\s\S]*?displayName="([^"]*)"/);

                // Sig/Instructions - look for text in instructions
                let sig = '';
                const sigMatch = medSection.match(/<text>([^<]*)<\/text>/);
                if (sigMatch && sigMatch[1] && !sigMatch[1].includes('xml')) {
                  sig = sigMatch[1].trim();
                }

                // Status - active or not
                const statusMatch = medSection.match(/<statusCode code="([^"]*)"/);
                const isActive = !statusMatch || statusMatch[1] === 'active' || statusMatch[1] === 'completed';

                if (nameMatch && nameMatch[1] && nameMatch[1] !== 'AthenaHealth') {
                  const medObj = {
                    name: nameMatch[1],
                    dosage: doseMatch ? `${doseMatch[1]} ${doseMatch[2]}` : '',
                    frequency: frequency,
                    route: routeMatch ? routeMatch[1] : '',
                    sig: sig,
                    status: isActive ? 'active' : 'inactive'
                  };

                  extractedData.medications.push(medObj);
                }
              });
            }

            // Fallback: if no substanceAdministration found, try simpler pattern
            if (extractedData.medications.length === 0) {
              const simpleMedMatches = xmlContent.match(/<manufacturedMaterial>[\s\S]*?<name>([^<]*)<\/name>/g);
              if (simpleMedMatches) {
                simpleMedMatches.forEach(match => {
                  const nameMatch = match.match(/<name>([^<]*)<\/name>/);
                  if (nameMatch && nameMatch[1] !== 'AthenaHealth') {
                    extractedData.medications.push({
                      name: nameMatch[1],
                      dosage: '',
                      frequency: '',
                      route: '',
                      sig: '',
                      status: 'active'
                    });
                  }
                });
              }
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

    // Aggregate all labs and medications from uploads
    const allLabs = [];
    const allMedications = [];
    const medicationNames = new Set(); // Track unique names
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

        // Collect medications (handle both old string format and new object format)
        if (e.medications && Array.isArray(e.medications)) {
          e.medications.forEach(med => {
            // Handle new object format {name, dosage, frequency, etc}
            if (typeof med === 'object' && med.name) {
              const medName = med.name.toLowerCase();
              if (!medicationNames.has(medName) && med.name !== 'AthenaHealth') {
                medicationNames.add(medName);
                allMedications.push({
                  name: med.name,
                  dosage: med.dosage || '',
                  frequency: med.frequency || '',
                  route: med.route || '',
                  sig: med.sig || '',
                  status: med.status || 'active'
                });
              }
            }
            // Handle old string format (for backwards compatibility)
            else if (typeof med === 'string') {
              const medName = med.toLowerCase();
              if (!medicationNames.has(medName) && med !== 'AthenaHealth') {
                medicationNames.add(medName);
                allMedications.push({
                  name: med,
                  dosage: '',
                  frequency: '',
                  route: '',
                  sig: '',
                  status: 'active'
                });
              }
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
      medications: allMedications, // Already an array
      allergies: Array.from(allAllergies),
      total_uploads: uploads.length,
      total_labs: allLabs.length,
      total_medications: allMedications.length
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
 * GET /api/patient-portal/medications/refill-queue
 * Get all medications that need refill processing (staff view)
 * Grouped by patient with their pharmacy information
 */
router.get('/medications/refill-queue', async (req, res) => {
  try {
    logger.info('PatientPortal', 'Loading medication refill queue for staff', {});

    // Get all medications flagged for refill or pharmacy send
    const { data: medications, error: medsError } = await supabase
      .from('patient_medications')
      .select(`
        id,
        patient_id,
        tshla_id,
        medication_name,
        dosage,
        frequency,
        route,
        sig,
        status,
        need_refill,
        refill_requested_at,
        send_to_pharmacy,
        sent_to_pharmacy_at,
        sent_to_pharmacy_by,
        pharmacy_name,
        created_at,
        updated_at
      `)
      .or('need_refill.eq.true,send_to_pharmacy.eq.true')
      .eq('status', 'active')
      .order('refill_requested_at', { ascending: true, nullsFirst: false });

    if (medsError) {
      // If columns don't exist yet (migration not run), return empty queue
      if (medsError.message && medsError.message.includes('column') && medsError.message.includes('does not exist')) {
        logger.warn('PatientPortal', 'Refill tracking columns not yet added - migration needed', {
          error: medsError.message
        });
        return res.json({
          success: true,
          queue: [],
          summary: {
            totalPatients: 0,
            totalMedications: 0,
            totalPending: 0,
            totalSent: 0
          },
          message: 'Database migration pending - pharmacy fields not yet available'
        });
      }
      throw medsError;
    }

    // Handle no medications case
    if (!medications || medications.length === 0) {
      return res.json({
        success: true,
        queue: [],
        summary: {
          totalPatients: 0,
          totalMedications: 0,
          totalPending: 0,
          totalSent: 0
        }
      });
    }

    // Get unique patient IDs
    const patientIds = [...new Set(medications.map(m => m.patient_id))];

    // Handle no patient IDs case
    if (patientIds.length === 0) {
      return res.json({
        success: true,
        queue: [],
        summary: {
          totalPatients: 0,
          totalMedications: 0,
          totalPending: 0,
          totalSent: 0
        }
      });
    }

    // Get patient information
    const { data: patients, error: patientsError } = await supabase
      .from('unified_patients')
      .select(`
        id,
        tshla_id,
        first_name,
        last_name,
        phone_primary,
        phone_display
      `)
      .in('id', patientIds);

    if (patientsError) {
      throw patientsError;
    }

    // Create patient lookup map
    const patientMap = new Map(patients.map(p => [p.id, p]));

    // Group medications by patient
    const patientGroups = {};

    medications.forEach(med => {
      const patient = patientMap.get(med.patient_id);
      if (!patient) return;

      const patientKey = patient.id;

      if (!patientGroups[patientKey]) {
        patientGroups[patientKey] = {
          patient: {
            id: patient.id,
            tshla_id: patient.tshla_id,
            name: `${patient.first_name || ''} ${patient.last_name || ''}`.trim(),
            phone: patient.phone_display || patient.phone_primary
          },
          medications: [],
          totalPending: 0,
          totalSent: 0
        };
      }

      patientGroups[patientKey].medications.push(med);

      // Count pending vs sent
      if (med.send_to_pharmacy && !med.sent_to_pharmacy_at) {
        patientGroups[patientKey].totalPending++;
      } else if (med.sent_to_pharmacy_at) {
        patientGroups[patientKey].totalSent++;
      }
    });

    // Convert to array and sort by most pending
    const refillQueue = Object.values(patientGroups).sort((a, b) => {
      return b.totalPending - a.totalPending;
    });

    logger.info('PatientPortal', 'Refill queue loaded', {
      totalPatients: refillQueue.length,
      totalMedications: medications.length
    });

    res.json({
      success: true,
      queue: refillQueue,
      summary: {
        totalPatients: refillQueue.length,
        totalMedications: medications.length,
        totalPending: refillQueue.reduce((sum, g) => sum + g.totalPending, 0),
        totalSent: refillQueue.reduce((sum, g) => sum + g.totalSent, 0)
      }
    });

  } catch (error) {
    logger.error('PatientPortal', 'Refill queue error', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: 'Failed to load refill queue'
    });
  }
});
/**
 * GET /api/patient-portal/medications/:tshlaId
 * Get medications for a patient with full management data
 */
router.get('/medications/:tshlaId', async (req, res) => {
  try {
    const { tshlaId } = req.params;
    const normalizedTshId = tshlaId.replace(/[\s-]/g, '').toUpperCase();

    logger.info('PatientPortal', 'Fetching medications', {
      tshlaId: normalizedTshId,
      originalParam: tshlaId
    });

    // Try both formats (TSH123001 and TSH 123-001)
    const formatted = normalizedTshId.replace(/^TSH(\d{3})(\d{3})$/, 'TSH $1-$2');

    logger.info('PatientPortal', 'Searching for medications with TSH IDs', {
      normalized: normalizedTshId,
      formatted: formatted
    });

    // Get medications from patient_medications table
    const { data: medications, error } = await supabase
      .from('patient_medications')
      .select('*')
      .or(`tshla_id.eq.${normalizedTshId},tshla_id.eq.${formatted}`)
      .order('status', { ascending: true }) // 'active' comes before 'prior'
      .order('medication_name', { ascending: true});

    if (error) {
      logger.error('PatientPortal', 'Get medications query error', {
        error: error.message,
        code: error.code
      });
      throw error;
    }

    logger.info('PatientPortal', 'Found medications', {
      count: medications?.length || 0
    });

    res.json({
      success: true,
      medications: medications || []
    });

  } catch (error) {
    logger.error('PatientPortal', 'Get medications error', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch medications'
    });
  }
});

/**
 * POST /api/patient-portal/medications/:tshlaId/update-status
 * Update medication status (active <-> prior)
 */
router.post('/medications/:tshlaId/update-status', async (req, res) => {
  try {
    const { tshlaId } = req.params;
    const { medicationId, newStatus, staffId, reason } = req.body;

    const normalizedTshId = tshlaId.replace(/[\s-]/g, '').toUpperCase();

    logger.info('PatientPortal', 'Updating medication status', {
      tshlaId: normalizedTshId,
      medicationId,
      newStatus
    });

    // Prepare update data
    const updateData = {
      status: newStatus,
      updated_at: new Date().toISOString()
    };

    // If discontinuing, add tracking
    if (newStatus === 'prior' || newStatus === 'discontinued') {
      updateData.discontinued_at = new Date().toISOString();
      if (staffId) updateData.discontinued_by = staffId;
      if (reason) updateData.discontinue_reason = reason;
    }

    // Update medication
    // Note: We only need to filter by medication ID since it's unique
    // No need to filter by tshla_id which can have format inconsistencies
    const { data, error } = await supabase
      .from('patient_medications')
      .update(updateData)
      .eq('id', medicationId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      medication: data
    });

  } catch (error) {
    logger.error('PatientPortal', 'Update medication status error', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: 'Failed to update medication status'
    });
  }
});

/**
 * POST /api/patient-portal/medications/:tshlaId/update-flags
 * Update medication flags (need_refill, send_to_pharmacy)
 */
router.post('/medications/:tshlaId/update-flags', async (req, res) => {
  try {
    const { tshlaId } = req.params;
    const { medicationId, needRefill, sendToPharmacy, staffId } = req.body;

    const normalizedTshId = tshlaId.replace(/[\s-]/g, '').toUpperCase();

    logger.info('PatientPortal', 'Updating medication flags', {
      tshlaId: normalizedTshId,
      medicationId,
      needRefill,
      sendToPharmacy
    });

    // Prepare update data
    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (typeof needRefill === 'boolean') {
      updateData.need_refill = needRefill;
      if (needRefill) {
        updateData.refill_requested_at = new Date().toISOString();
      }
    }

    if (typeof sendToPharmacy === 'boolean') {
      updateData.send_to_pharmacy = sendToPharmacy;
      if (sendToPharmacy) {
        updateData.sent_to_pharmacy_at = new Date().toISOString();
        if (staffId) updateData.sent_to_pharmacy_by = staffId;
      }
    }

    // Update medication
    // Note: We only need to filter by medication ID since it's unique
    // No need to filter by tshla_id which can have format inconsistencies
    const { data, error } = await supabase
      .from('patient_medications')
      .update(updateData)
      .eq('id', medicationId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      medication: data
    });

  } catch (error) {
    logger.error('PatientPortal', 'Update medication flags error', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: 'Failed to update medication flags'
    });
  }
});

/**
 * POST /api/patient-portal/medications/:tshlaId/import-from-uploads
 * Import medications from uploaded documents into patient_medications table
 */
router.post('/medications/:tshlaId/import-from-uploads', async (req, res) => {
  try {
    const { tshlaId } = req.params;
    const normalizedTshId = tshlaId.replace(/[\s-]/g, '').toUpperCase();
    const formatted = normalizedTshId.replace(/^TSH(\d{3})(\d{3})$/, 'TSH $1-$2');

    logger.info('PatientPortal', 'Importing medications from uploads', { tshlaId: normalizedTshId });

    // 1. Get patient ID (try both normalized and formatted versions)
    let patient, patientError;

    // Try normalized format first (TSH123001)
    const result1 = await supabase
      .from('unified_patients')
      .select('id, tshla_id')
      .eq('tshla_id', normalizedTshId)
      .maybeSingle();

    if (result1.data) {
      patient = result1.data;
    } else {
      // Try formatted version (TSH 123-001)
      const result2 = await supabase
        .from('unified_patients')
        .select('id, tshla_id')
        .eq('tshla_id', formatted)
        .maybeSingle();

      patient = result2.data;
      patientError = result2.error;
    }

    if (patientError || !patient) {
      throw new Error('Patient not found');
    }

    logger.info('PatientPortal', 'Found patient', {
      tshlaId: patient.tshla_id,
      patientId: patient.id
    });

    // 2. Get all uploaded medications (use actual TSH ID from database)
    // Don't filter by ai_processing_status - if medications are in extracted_data, use them
    // Search for both TSH ID formats since uploads might use normalized version
    const { data: uploads, error: uploadsError } = await supabase
      .from('patient_document_uploads')
      .select('id, extracted_data, uploaded_at, ai_processing_status, tshla_id')
      .or(`tshla_id.eq.${normalizedTshId},tshla_id.eq.${formatted}`);

    if (uploadsError) {
      throw uploadsError;
    }

    logger.info('PatientPortal', 'Found uploads', {
      count: uploads?.length || 0,
      searchedFor: [normalizedTshId, formatted],
      foundTshIds: uploads?.map(u => u.tshla_id)
    });

    // 3. Collect all unique medications
    const medicationsToImport = [];
    const seenMeds = new Set();

    for (const upload of uploads || []) {
      const meds = upload.extracted_data?.medications || [];

      for (const med of meds) {
        const medName = typeof med === 'string' ? med : med.name;
        const medKey = medName.toLowerCase();

        if (!seenMeds.has(medKey) && medName && medName !== 'AthenaHealth') {
          seenMeds.add(medKey);

          medicationsToImport.push({
            patient_id: patient.id,
            tshla_id: patient.tshla_id, // Use actual TSH ID from database
            medication_name: medName,
            dosage: typeof med === 'object' ? med.dosage || '' : '',
            frequency: typeof med === 'object' ? med.frequency || '' : '',
            route: typeof med === 'object' ? med.route || '' : '',
            sig: typeof med === 'object' ? med.sig || '' : '',
            status: typeof med === 'object' && med.status ? med.status : 'active',
            source: 'ccd_upload',
            source_upload_id: upload.id,
            need_refill: false,
            send_to_pharmacy: false
          });
        }
      }
    }

    // 4. Insert medications (upsert to avoid duplicates)
    let imported = 0;
    const errors = [];
    const skipped = [];

    logger.info('PatientPortal', 'Starting import of medications', {
      count: medicationsToImport.length,
      sampleMed: medicationsToImport[0]
    });

    for (const med of medicationsToImport) {
      // Check if medication already exists (check both TSH ID formats)
      const { data: existing, error: checkError } = await supabase
        .from('patient_medications')
        .select('id')
        .or(`tshla_id.eq.${normalizedTshId},tshla_id.eq.${formatted}`)
        .eq('medication_name', med.medication_name)
        .maybeSingle();

      if (checkError) {
        logger.error('PatientPortal', 'Check existing medication error', {
          med: med.medication_name,
          error: checkError.message,
          code: checkError.code
        });
        errors.push({
          medication: med.medication_name,
          error: checkError.message,
          step: 'check'
        });
        continue;
      }

      if (existing) {
        skipped.push(med.medication_name);
        continue;
      }

      // Insert medication
      const { data: inserted, error: insertError } = await supabase
        .from('patient_medications')
        .insert(med)
        .select();

      if (insertError) {
        logger.error('PatientPortal', 'Insert medication error', {
          med: med.medication_name,
          error: insertError.message,
          code: insertError.code,
          details: insertError.details,
          hint: insertError.hint
        });
        errors.push({
          medication: med.medication_name,
          error: insertError.message,
          code: insertError.code,
          details: insertError.details,
          step: 'insert'
        });
      } else {
        imported++;
        logger.info('PatientPortal', 'Medication inserted', {
          id: inserted[0]?.id,
          name: med.medication_name
        });
      }
    }

    logger.info('PatientPortal', 'Medications import complete', {
      tshlaId: normalizedTshId,
      total: medicationsToImport.length,
      imported,
      skipped: skipped.length,
      errors: errors.length
    });

    res.json({
      success: true,
      total: medicationsToImport.length,
      imported,
      skipped: skipped.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Imported ${imported} new medications from uploaded documents${skipped.length > 0 ? ` (${skipped.length} already existed)` : ''}${errors.length > 0 ? ` (${errors.length} errors)` : ''}`
    });

  } catch (error) {
    logger.error('PatientPortal', 'Import medications error', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: 'Failed to import medications'
    });
  }
});

/**
 * POST /api/patient-portal/medications/:tshlaId/import-from-hp
 * Import medications from H&P comprehensive chart into patient_medications table
 * This syncs AI-extracted medications from dictations to the patient portal
 */
router.post('/medications/:tshlaId/import-from-hp', async (req, res) => {
  const { tshlaId } = req.params;

  logger.info('PatientPortal', 'Import medications from H&P', {
    tshlaId,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  try {
    // 1. Get patient by TSH ID (normalize with/without space and dash)
    const normalizedId = tshlaId.replace(/[\s-]/g, '').toUpperCase();
    const formattedId = normalizedId.replace(/^TSH(\d{3})(\d{3})$/, 'TSH $1-$2');
    const { data: patient, error: patientError } = await supabase
      .from('unified_patients')
      .select('id, tshla_id, phone_primary, first_name, last_name')
      .or(`tshla_id.eq.${tshlaId},tshla_id.eq.${normalizedId},tshla_id.eq.${formattedId}`)
      .maybeSingle();

    if (patientError) {
      logger.error('PatientPortal', 'Patient lookup error', { error: patientError.message, tshlaId });
      return res.status(500).json({
        success: false,
        error: 'Failed to find patient'
      });
    }

    if (!patient) {
      logger.warn('PatientPortal', 'Patient not found for H&P import', { tshlaId });
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    // 2. Get H&P medications from comprehensive chart
    const { data: hpChart, error: hpError } = await supabase
      .from('patient_comprehensive_chart')
      .select('medications, last_updated, version')
      .eq('patient_phone', patient.phone_primary)
      .maybeSingle();

    if (hpError) {
      logger.error('PatientPortal', 'H&P chart lookup error', { error: hpError.message, patientPhone: patient.phone_primary });
      return res.status(500).json({
        success: false,
        error: 'Failed to load H&P chart'
      });
    }

    if (!hpChart || !hpChart.medications || hpChart.medications.length === 0) {
      logger.info('PatientPortal', 'No medications in H&P chart', { tshlaId, patientPhone: patient.phone_primary });
      return res.json({
        success: true,
        message: 'No medications found in H&P chart',
        imported: 0,
        skipped: 0
      });
    }

    // 3. Get existing medications in patient_medications table
    const { data: existingMeds, error: existingError } = await supabase
      .from('patient_medications')
      .select('medication_name, dosage, frequency')
      .eq('patient_id', patient.id);

    if (existingError) {
      logger.error('PatientPortal', 'Existing medications lookup error', { error: existingError.message });
      return res.status(500).json({
        success: false,
        error: 'Failed to load existing medications'
      });
    }

    // Create lookup set for duplicates
    const existingMedSet = new Set(
      (existingMeds || []).map(m =>
        `${m.medication_name?.toLowerCase()}-${m.dosage?.toLowerCase()}-${m.frequency?.toLowerCase()}`
      )
    );

    // 4. Transform H&P medications to patient_medications format
    const medsToImport = [];
    const skippedMeds = [];

    for (const hpMed of hpChart.medications) {
      // Create lookup key
      const lookupKey = `${hpMed.name?.toLowerCase() || ''}-${hpMed.dose?.toLowerCase() || ''}-${hpMed.frequency?.toLowerCase() || ''}`;

      // Skip if already exists
      if (existingMedSet.has(lookupKey)) {
        skippedMeds.push(hpMed.name);
        continue;
      }

      // Map H&P fields to patient_medications fields
      const medToInsert = {
        patient_id: patient.id,
        tshla_id: patient.tshla_id,
        medication_name: hpMed.name || '',
        dosage: hpMed.dose || '',
        frequency: hpMed.frequency || '',
        route: hpMed.route || null,
        sig: hpMed.indication || null,
        prescribed_by: hpMed.prescribedBy || null,
        status: (hpMed.active === false || hpMed.status === 'discontinued') ? 'prior' : 'active',
        source: 'hp_import',
        need_refill: false,
        send_to_pharmacy: false
      };

      medsToImport.push(medToInsert);
    }

    // 5. Insert new medications
    let importedCount = 0;
    if (medsToImport.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from('patient_medications')
        .insert(medsToImport)
        .select('id');

      if (insertError) {
        logger.error('PatientPortal', 'Medication insert error', {
          error: insertError.message,
          count: medsToImport.length
        });
        return res.status(500).json({
          success: false,
          error: 'Failed to import medications'
        });
      }

      importedCount = inserted?.length || 0;
    }

    logger.info('PatientPortal', 'H&P medications imported', {
      tshlaId,
      patientName: `${patient.first_name} ${patient.last_name}`,
      imported: importedCount,
      skipped: skippedMeds.length,
      hpVersion: hpChart.version
    });

    res.json({
      success: true,
      message: `Imported ${importedCount} medication(s) from H&P chart`,
      imported: importedCount,
      skipped: skippedMeds.length,
      skippedMedications: skippedMeds
    });

  } catch (error) {
    logger.error('PatientPortal', 'Import from H&P error', {
      error: error.message,
      stack: error.stack,
      tshlaId
    });
    res.status(500).json({
      success: false,
      error: 'Failed to import medications from H&P'
    });
  }
});


/**
 * POST /api/patient-portal/medications/:medicationId/process-refill
 * Mark medication as sent to pharmacy (staff action)
 */
router.post('/medications/:medicationId/process-refill', async (req, res) => {
  try {
    const { medicationId } = req.params;
    const {
      staffId,
      staffName,
      pharmacyName,
      refillDurationDays,
      refillQuantity,
      confirmationNumber,
      notes
    } = req.body;

    logger.info('PatientPortal', 'Processing medication refill', {
      medicationId,
      staffId,
      refillDurationDays
    });

    const now = new Date().toISOString();

    // Calculate next refill due date
    let nextRefillDueDate = null;
    if (refillDurationDays) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + refillDurationDays);
      nextRefillDueDate = dueDate.toISOString();
    }

    // Update medication record
    const { data, error } = await supabase
      .from('patient_medications')
      .update({
        send_to_pharmacy: true,
        sent_to_pharmacy_at: now,
        sent_to_pharmacy_by: staffId,
        pharmacy_name: pharmacyName,
        refill_duration_days: refillDurationDays,
        refill_quantity: refillQuantity,
        last_refill_date: now,
        next_refill_due_date: nextRefillDueDate,
        refill_count: supabase.sql`COALESCE(refill_count, 0) + 1`,
        refill_notes: notes,
        sent_to_pharmacy_confirmation: confirmationNumber,
        need_refill: false, // Clear the patient flag
        updated_at: now
      })
      .eq('id', medicationId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Log the action
    await supabase
      .from('access_logs')
      .insert({
        user_type: 'staff',
        user_id: staffId,
        action: 'process_medication_refill',
        resource_type: 'patient_medication',
        resource_id: medicationId,
        details: {
          medication_id: medicationId,
          pharmacy_name: pharmacyName,
          refill_duration_days: refillDurationDays,
          staff_name: staffName,
          confirmation: confirmationNumber
        }
      });

    logger.info('PatientPortal', 'Medication refill processed', {
      medicationId,
      pharmacyName,
      refillDurationDays
    });

    res.json({
      success: true,
      medication: data,
      message: 'Refill processed and sent to pharmacy successfully'
    });

  } catch (error) {
    logger.error('PatientPortal', 'Process refill error', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: 'Failed to process refill'
    });
  }
});

/**
 * POST /api/patient-portal/medications/:medicationId/clear-refill-flag
 * Remove medication from refill queue by clearing send_to_pharmacy flag
 */
router.post('/medications/:medicationId/clear-refill-flag', async (req, res) => {
  try {
    const { medicationId } = req.params;

    logger.info('PatientPortal', 'Clearing refill flag for medication', {
      medicationId
    });

    // Update medication record to clear flags
    const { data, error } = await supabase
      .from('patient_medications')
      .update({
        send_to_pharmacy: false,
        need_refill: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', medicationId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    logger.info('PatientPortal', 'Refill flag cleared', {
      medicationId
    });

    res.json({
      success: true,
      medication: data,
      message: 'Medication removed from refill queue'
    });

  } catch (error) {
    logger.error('PatientPortal', 'Clear refill flag error', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: 'Failed to remove medication from refill queue'
    });
  }
});

/**
 * POST /api/patient-portal/patients/:tshlaId/pharmacy
 * Update patient's preferred pharmacy information
 */
router.post('/patients/:tshlaId/pharmacy', async (req, res) => {
  try {
    const { tshlaId } = req.params;
    const { pharmacyName, pharmacyPhone, pharmacyAddress, pharmacyFax } = req.body;

    const normalizedTshId = tshlaId.replace(/[\s-]/g, '').toUpperCase();

    logger.info('PatientPortal', 'Updating pharmacy information', {
      tshlaId: normalizedTshId
    });

    // Update patient pharmacy info (try both TSH ID formats)
    const { data, error } = await supabase
      .from('unified_patients')
      .update({
        preferred_pharmacy_name: pharmacyName,
        preferred_pharmacy_phone: pharmacyPhone,
        preferred_pharmacy_address: pharmacyAddress,
        preferred_pharmacy_fax: pharmacyFax,
        updated_at: new Date().toISOString()
      })
      .or(`tshla_id.eq.${normalizedTshId},tshla_id.eq.${normalizedTshId.replace(/^TSH(\d{3})(\d{3})$/, 'TSH $1-$2')}`)
      .select()
      .single();

    if (error) {
      throw error;
    }

    logger.info('PatientPortal', 'Pharmacy information updated', {
      tshlaId: normalizedTshId,
      pharmacyName
    });

    res.json({
      success: true,
      patient: data,
      message: 'Pharmacy information updated successfully'
    });

  } catch (error) {
    logger.error('PatientPortal', 'Update pharmacy error', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: 'Failed to update pharmacy information'
    });
  }
});

/**
 * GET /api/patient-portal/dictations/:tshlaId
 * Get all dictations (with audio) for a patient
 */
router.get('/dictations/:tshlaId', async (req, res) => {
  try {
    const { tshlaId } = req.params;
    const sessionId = req.headers['x-session-id'];

    // Normalize TSH ID
    const normalizedTshId = tshlaId.replace(/[\s-]/g, '').toUpperCase();

    logger.info('PatientPortal', 'Load dictations request', {
      tshlaId: normalizedTshId,
      sessionId
    });

    // Verify session ownership
    // First check in-memory sessions (fast path)
    let session = activeSessions.get(sessionId);

    // If not in memory (server restart), validate against database
    if (!session) {
      logger.info('PatientPortal', 'Session not in memory, checking database', { sessionId });

      // Try to find by session ID first
      let dbSession = null;
      const { data: sessionById, error: byIdError } = await supabase
        .from('patient_portal_sessions')
        .select('tshla_id, patient_phone')
        .eq('id', sessionId)
        .gte('session_start', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
        .maybeSingle();

      if (sessionById) {
        dbSession = sessionById;
      } else {
        // Fallback: Check for any recent session for this TSH ID (for backward compatibility)
        logger.info('PatientPortal', 'Session ID not found, checking by TSH ID', { tshlaId: normalizedTshId });
        const formatted = normalizedTshId.replace(/^TSH(\d{3})(\d{3})$/, 'TSH $1-$2');
        const { data: sessionByTshId } = await supabase
          .from('patient_portal_sessions')
          .select('tshla_id, patient_phone')
          .or(`tshla_id.eq.${normalizedTshId},tshla_id.eq.${formatted}`)
          .gte('session_start', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
          .order('session_start', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (sessionByTshId) {
          dbSession = sessionByTshId;
          logger.info('PatientPortal', 'Session found by TSH ID', { tshlaId: sessionByTshId.tshla_id });
        }
      }

      if (dbSession) {
        session = { tshlaId: dbSession.tshla_id };
      }
    }

    // Normalize session TSH ID for comparison (handle both formats)
    const sessionTshIdNormalized = session?.tshlaId?.replace(/[\s-]/g, '').toUpperCase();

    if (!session || sessionTshIdNormalized !== normalizedTshId) {
      logger.warn('PatientPortal', 'Session validation failed', {
        hasSession: !!session,
        sessionTshId: session?.tshlaId,
        sessionTshIdNormalized,
        requestedTshId: normalizedTshId,
        sessionId
      });
      return res.status(403).json({
        success: false,
        error: 'Access denied - Session expired. Please log in again.'
      });
    }

    // Get patient to find phone number
    const { data: patient, error: patientError } = await supabase
      .from('unified_patients')
      .select('phone_primary, phone_display')
      .or(`tshla_id.eq.${normalizedTshId},tshla_id.eq.${normalizedTshId.replace(/^TSH(\d{3})(\d{3})$/, 'TSH $1-$2')}`)
      .maybeSingle();

    if (patientError || !patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    // Fetch all dictations for this patient by phone
    // Need to handle phone format variations: "8324492930" vs "(832) 449-2930" vs "+18324492930"
    const digitsOnly = patient.phone_primary?.replace(/\D/g, '');
    const phoneVariations = [
      patient.phone_primary, // Original format (e.g., "8324492930")
      patient.phone_display, // Display format (e.g., "(832) 449-2930")
      digitsOnly, // Digits only
      digitsOnly ? `(${digitsOnly.substring(0,3)}) ${digitsOnly.substring(3,6)}-${digitsOnly.substring(6)}` : null, // Formatted
      digitsOnly ? `+1${digitsOnly}` : null // E.164 format
    ].filter(Boolean);

    logger.info('PatientPortal', 'Searching for dictations with phone variations', {
      tshlaId: normalizedTshId,
      phoneVariations
    });

    // Query with IN operator for all phone variations (more reliable than OR with special chars)
    const { data: dictations, error: dictError } = await supabase
      .from('dictated_notes')
      .select('id, provider_name, patient_name, visit_date, raw_transcript, processed_note, ai_summary, audio_url, audio_deleted, audio_deleted_at, audio_generated_at, created_at, dictated_at')
      .in('patient_phone', phoneVariations)
      .order('created_at', { ascending: false });

    if (dictError) {
      throw dictError;
    }

    // Format dictations for frontend
    const formattedDictations = (dictations || []).map(d => ({
      id: d.id,
      provider_name: d.provider_name || 'Dr. Unknown',
      patient_name: d.patient_name,
      visit_date: d.visit_date || d.dictated_at || d.created_at,
      summary_text: d.ai_summary || d.processed_note || d.raw_transcript || '', // Patient-friendly summary first
      audio_url: d.audio_deleted ? null : d.audio_url, // Hide URL if deleted
      audio_deleted: d.audio_deleted || false,
      audio_deleted_at: d.audio_deleted_at,
      created_at: d.created_at,
      has_audio: !!(d.audio_url && !d.audio_deleted)
    }));

    logger.info('PatientPortal', 'Dictations loaded', {
      tshlaId: normalizedTshId,
      count: formattedDictations.length
    });

    res.json({
      success: true,
      dictations: formattedDictations,
      count: formattedDictations.length
    });

  } catch (error) {
    logger.error('PatientPortal', 'Load dictations error', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: 'Failed to load dictations'
    });
  }
});

/**
 * DELETE /api/patient-portal/dictations/:dictationId/audio
 * Patient-initiated audio file deletion (soft delete)
 */
router.delete('/dictations/:dictationId/audio', async (req, res) => {
  try {
    const { dictationId } = req.params;
    const sessionId = req.headers['x-session-id'];

    logger.info('PatientPortal', 'Delete dictation audio request', {
      dictationId,
      sessionId
    });

    // Verify session exists
    // First check in-memory sessions (fast path)
    let session = activeSessions.get(sessionId);

    // If not in memory (server restart), validate against database
    if (!session) {
      logger.info('PatientPortal', 'Session not in memory for delete, checking database', { sessionId });

      // Try to find by session ID first
      let dbSession = null;
      const { data: sessionById } = await supabase
        .from('patient_portal_sessions')
        .select('tshla_id, patient_phone')
        .eq('id', sessionId)
        .gte('session_start', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
        .maybeSingle();

      if (sessionById) {
        dbSession = sessionById;
      } else {
        // Fallback: Check for any recent session (for backward compatibility)
        logger.info('PatientPortal', 'Session ID not found for delete, checking recent sessions');
        const { data: recentSession } = await supabase
          .from('patient_portal_sessions')
          .select('tshla_id, patient_phone')
          .gte('session_start', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
          .order('session_start', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (recentSession) {
          dbSession = recentSession;
          logger.info('PatientPortal', 'Session found by recent activity', { tshlaId: recentSession.tshla_id });
        }
      }

      if (dbSession) {
        session = { tshlaId: dbSession.tshla_id };
      }
    }

    if (!session) {
      return res.status(403).json({
        success: false,
        error: 'Session expired. Please log in again.'
      });
    }

    // Get dictation to verify ownership
    const { data: dictation, error: fetchError } = await supabase
      .from('dictated_notes')
      .select('id, patient_phone, audio_url, audio_deleted')
      .eq('id', dictationId)
      .maybeSingle();

    if (fetchError || !dictation) {
      return res.status(404).json({
        success: false,
        error: 'Dictation not found'
      });
    }

    // Verify patient ownership via phone number
    const { data: patient } = await supabase
      .from('unified_patients')
      .select('phone_primary')
      .eq('tshla_id', session.tshlaId)
      .maybeSingle();

    if (!patient || patient.phone_primary !== dictation.patient_phone) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Already deleted?
    if (dictation.audio_deleted) {
      return res.json({
        success: true,
        message: 'Audio already deleted',
        already_deleted: true
      });
    }

    // Soft delete: Mark as deleted but keep URL for potential recovery
    const { error: updateError } = await supabase
      .from('dictated_notes')
      .update({
        audio_deleted: true,
        audio_deleted_at: new Date().toISOString()
      })
      .eq('id', dictationId);

    if (updateError) {
      throw updateError;
    }

    logger.info('PatientPortal', 'Dictation audio deleted', {
      dictationId,
      tshlaId: session.tshlaId
    });

    res.json({
      success: true,
      message: 'Audio deleted successfully',
      dictation_id: dictationId
    });

  } catch (error) {
    logger.error('PatientPortal', 'Delete dictation audio error', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: 'Failed to delete audio'
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
