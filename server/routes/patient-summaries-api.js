/**
 * Patient Audio Summaries API
 * Web-based patient visit summaries with shareable links
 * Replaces Twilio phone calls with portal-based audio playback
 *
 * Created: 2026-01-13
 * HIPAA Compliant: Azure OpenAI + Azure Blob Storage + Safe Logging
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { BlobServiceClient } = require('@azure/storage-blob');
const crypto = require('crypto');
const logger = require('../logger');

// =====================================================
// CONFIGURATION
// =====================================================

// Supabase configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Azure OpenAI configuration (HIPAA compliant)
const AZURE_OPENAI_KEY = process.env.AZURE_OPENAI_KEY;
const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
const AZURE_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2024-10-01-preview';

// ElevenLabs configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Bella - professional female

// Azure Blob Storage configuration
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const AUDIO_CONTAINER_NAME = 'echo-audio';

// Initialize Azure Blob Storage client
let blobServiceClient = null;
if (AZURE_STORAGE_CONNECTION_STRING) {
  try {
    blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
    logger.info('Azure', 'Blob Storage client initialized for patient summaries');
  } catch (error) {
    logger.error('Azure', 'Failed to initialize Blob Storage', { error: error.message });
  }
}

// Middleware
router.use(express.json());

// =====================================================
// HELPER FUNCTIONS (Reuse from echo-audio-summary-azure.js)
// =====================================================

/**
 * Generate patient-friendly conversational summary from SOAP note
 * Reuses logic from echo-audio-summary-azure.js
 * @param {string} soapNote - The SOAP note text
 * @param {string} patientName - Patient's full name for personalized greeting
 * @param {string} providerName - Provider's name for introduction
 */
async function generatePatientSummary(soapNote, patientName = null, providerName = null) {
  // Extract first name only if full name provided
  const firstName = patientName ? patientName.split(' ')[0] : null;

  // Extract doctor's last name if provider name provided
  const doctorLastName = providerName ? providerName.split(' ').pop() : null;

  const prompt = `You are converting a medical SOAP note into a patient-friendly phone call script.

PATIENT INFORMATION:
- Patient's first name: ${firstName || 'Unknown'}
- Doctor's last name: ${doctorLastName || 'your doctor'}

CRITICAL RULES:
1. START with exactly: "Hi ${firstName || 'there'}, this is a beta project from Dr. ${doctorLastName || 'your doctor'}'s office."
2. DO NOT use placeholders like [Patient Name] or [Doctor Name] - use the ACTUAL names provided above
3. Use warm, conversational, natural language (avoid clinical jargon)
4. Say "You came in for [reason]" NOT "Chief complaint was"
5. Include in this order:
   a) Why they came in (conversational)
   b) Key findings (blood sugar, vitals, important results - plain English)
   c) Medication changes (what's new, doses clearly stated)
   d) Tests ordered (labs, imaging - explain what and why simply)
   e) Follow-up plan (when to come back)
   f) What patient should do (take meds, diet, exercise)
6. END with exactly: "If you notice any errors in this summary, please let us know. We are still testing this feature."
7. LENGTH: 100-150 words total (15-30 seconds when spoken)
8. NUMBERS: Say "9 point 5" not "nine point five"
9. MEDICATIONS: Say full name and dose clearly: "Metformin 1500 milligrams twice daily"
10. TONE: Warm but professional

SOAP NOTE:
${soapNote}

IMPORTANT: Your response should be ONLY the words that will be spoken to the patient. Do not include any labels, headers, explanations, or meta-commentary. Start immediately with "Hi ${firstName || 'there'}, this is a beta project from Dr. ${doctorLastName || 'your doctor'}'s office..."`;

  const response = await fetch(
    `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${AZURE_API_VERSION}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': AZURE_OPENAI_KEY
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: 'You are a medical communication specialist creating patient-friendly phone call scripts. Be conversational, warm, and clear.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 300
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Azure OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const script = data.choices[0]?.message?.content || '';

  if (!script.trim()) {
    throw new Error('Azure OpenAI returned empty response');
  }

  const wordCount = script.split(/\s+/).length;
  const estimatedSeconds = Math.ceil((wordCount / 150) * 60);

  return {
    script: script.trim(),
    wordCount,
    estimatedSeconds
  };
}

/**
 * Extract follow-up date from SOAP note using AI
 * Returns: { date: '2026-03-15', notes: 'Repeat labs' } or null
 */
async function extractFollowUpDate(soapNote) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

  const prompt = `You are analyzing a medical SOAP note to extract follow-up appointment information.

TODAY'S DATE: ${today}

TASK: Extract when the patient should return for follow-up. Look for phrases like:
- "Follow up in 2 weeks"
- "RTC 3 months"
- "Return to clinic in 6 weeks"
- "Next appointment in 1 month"
- "Repeat labs in 2 months"
- Specific dates mentioned

IMPORTANT RULES:
1. Calculate the exact date based on TODAY'S DATE
2. Return JSON format ONLY
3. If NO follow-up mentioned, return: {"date": null, "notes": null}
4. Include context in "notes" (e.g., "Repeat TSH labs", "Post-op check")

SOAP NOTE:
${soapNote}

Return JSON only (no explanation):`;

  try {
    const response = await fetch(
      `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${AZURE_API_VERSION}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': AZURE_OPENAI_KEY
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are a medical data extraction specialist. You extract structured information from clinical notes and return valid JSON only.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3, // Lower temperature for more consistent extraction
          max_tokens: 150,
          response_format: { type: "json_object" } // Force JSON response
        })
      }
    );

    if (!response.ok) {
      logger.error('PatientSummary', 'Azure OpenAI API error for follow-up extraction', {
        status: response.status
      });
      return null;
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '{}';
    const extracted = JSON.parse(content);

    // Validate the extracted data
    if (extracted.date) {
      // Verify date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(extracted.date)) {
        logger.warn('PatientSummary', 'Invalid date format extracted', {
          date: extracted.date
        });
        return null;
      }
    }

    logger.info('PatientSummary', 'Follow-up date extracted', {
      date: extracted.date || 'None',
      notes: extracted.notes || null
    });
    return extracted.date ? extracted : null;

  } catch (error) {
    logger.error('PatientSummary', 'Follow-up extraction error', {
      error: error.message
    });
    return null; // Fail gracefully - don't block summary creation
  }
}

/**
 * Generate audio from text using ElevenLabs
 */
async function generateAudio(text, voiceId = DEFAULT_VOICE_ID) {
  logger.info('PatientSummary', 'Generating audio', { voiceId });

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true
        }
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
  }

  const audioBuffer = await response.arrayBuffer();
  return Buffer.from(audioBuffer);
}

/**
 * Upload audio to Azure Blob Storage
 * Updated to 7-day expiration (from 24 hours)
 */
async function uploadAudioToAzure(audioBuffer, voiceId, summaryId) {
  if (!blobServiceClient) {
    throw new Error('Azure Blob Storage not configured');
  }

  const containerClient = blobServiceClient.getContainerClient(AUDIO_CONTAINER_NAME);

  // Create container if it doesn't exist
  await containerClient.createIfNotExists({
    access: 'blob' // Public read access for audio files
  });

  const blobName = `patient-summary-${summaryId}-${Date.now()}.mp3`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  // Upload audio with metadata
  await blockBlobClient.uploadData(audioBuffer, {
    blobHTTPHeaders: {
      blobContentType: 'audio/mpeg'
    },
    metadata: {
      voiceId: voiceId,
      summaryId: summaryId,
      createdAt: new Date().toISOString()
    }
  });

  const audioUrl = blockBlobClient.url;
  logger.info('PatientSummary', 'Audio uploaded to Azure Blob', {
    audioUrl: audioUrl.split('?')[0] // Remove SAS token from logs
  });

  // Schedule cleanup after 7 days (updated from 24 hours)
  setTimeout(async () => {
    try {
      await blockBlobClient.delete();
      logger.info('PatientSummary', 'Audio file cleanup', { blobName });
    } catch (err) {
      logger.error('PatientSummary', 'Audio cleanup failed', {
        blobName,
        error: err.message
      });
    }
  }, 7 * 24 * 60 * 60 * 1000); // 7 days

  return audioUrl;
}

/**
 * Log access attempt for HIPAA audit trail
 */
async function logAccess(summaryId, accessType, ipAddress, userAgent, tshlaIdAttempted, success) {
  try {
    const { error } = await supabase
      .from('patient_summary_access_log')
      .insert({
        summary_id: summaryId,
        access_type: accessType,
        ip_address: ipAddress,
        user_agent: userAgent,
        tshla_id_attempted: tshlaIdAttempted,
        success: success
      });

    if (error) {
      logger.error('PatientSummary', 'Access log failed', {
        error: error.message
      });
    }
  } catch (err) {
    logger.error('PatientSummary', 'Access log exception', {
      error: err.message
    });
  }
}

/**
 * Check rate limiting for TSHLA ID verification
 * Max 20 attempts per IP per hour (TEMPORARY FOR TESTING - restore to 5 for production)
 */
async function checkRateLimit(ipAddress) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('patient_summary_access_log')
    .select('id')
    .eq('ip_address', ipAddress)
    .eq('success', false)
    .eq('access_type', 'failed_tshla_verification')
    .gte('accessed_at', oneHourAgo);

  if (error) {
    logger.error('PatientSummary', 'Rate limit check failed', {
      error: error.message
    });
    return false; // Allow on error (fail open)
  }

  const attemptCount = data ? data.length : 0;
  logger.info('PatientSummary', 'Rate limit check', {
    attemptCount,
    limit: 20,
    ip: ipAddress.slice(-7) // Last 7 chars only
  });

  return attemptCount >= 20; // TEMPORARY: Increased for testing (TODO: Change back to 5 for production)
}

// =====================================================
// API ROUTES
// =====================================================

/**
 * POST /api/patient-summaries/create
 * Create a new patient summary with shareable link
 * Called automatically after doctor completes dictation
 */
router.post('/patient-summaries/create', async (req, res) => {
  try {
    const {
      dictationId,
      patientPhone,
      patientName,
      patientMrn,
      soapNote,
      providerId,
      providerName,
      voiceId
    } = req.body;

    // Validation
    if (!patientPhone || !soapNote) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: patientPhone and soapNote'
      });
    }

    logger.info('PatientSummary', 'Creating new summary', {
      patientInitial: patientName ? patientName[0] : 'U', // First initial only
      phone: patientPhone.slice(-4), // Last 4 digits only
      provider: providerName || providerId || 'Unknown'
    });

    // Step 1: Generate AI summary
    logger.info('PatientSummary', 'Generating AI summary');
    const summary = await generatePatientSummary(soapNote, patientName, providerName);
    logger.info('PatientSummary', 'Summary generated', {
      wordCount: summary.wordCount,
      estimatedSeconds: summary.estimatedSeconds
    });

    // Step 2: Extract follow-up date from SOAP note
    const followUpInfo = await extractFollowUpDate(soapNote);

    // Step 3: Create database record (audio generated on-demand later)
    const { data, error } = await supabase
      .from('patient_audio_summaries')
      .insert({
        dictation_id: dictationId,
        patient_phone: patientPhone,
        patient_name: patientName,
        patient_mrn: patientMrn,
        soap_note_text: soapNote,
        summary_script: summary.script,
        provider_id: providerId,
        provider_name: providerName,
        voice_id: voiceId || DEFAULT_VOICE_ID,
        status: 'pending',
        followup_date: followUpInfo?.date || null,
        followup_notes: followUpInfo?.notes || null
      })
      .select()
      .single();

    if (error) {
      logger.error('PatientSummary', 'Database insert failed', {
        error: error.message
      });
      throw new Error(`Database error: ${error.message}`);
    }

    const shareLinkUrl = `${process.env.VITE_APP_URL || 'https://www.tshla.ai'}/patient-summary/${data.share_link_id}`;

    logger.info('PatientSummary', 'Summary created successfully', {
      summaryId: data.id,
      shareLinkId: data.share_link_id,
      expiresAt: data.expires_at
    });

    res.json({
      success: true,
      data: {
        summaryId: data.id,
        shareLinkId: data.share_link_id,
        shareLinkUrl: shareLinkUrl,
        expiresAt: data.expires_at,
        summaryScript: summary.script,
        wordCount: summary.wordCount,
        estimatedSeconds: summary.estimatedSeconds
      }
    });

  } catch (error) {
    logger.error('PatientSummary', 'Summary creation failed', {
      error: error.message
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/staff/pending-summaries
 * Get all patient summaries for staff dashboard
 * Supports filtering by date, provider, status
 */
router.get('/staff/pending-summaries', async (req, res) => {
  try {
    const { startDate, endDate, providerId, status } = req.query;

    logger.info('PatientSummary', 'Fetching staff dashboard summaries', {
      hasDateFilter: !!startDate,
      hasProviderFilter: !!providerId
    });

    let query = supabase
      .from('patient_audio_summaries')
      .select('*')
      .is('deleted_at', null)  // CRITICAL: Exclude soft-deleted summaries
      .order('created_at', { ascending: false});

    // Apply filters
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }
    if (providerId) {
      query = query.eq('provider_id', providerId);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    // Enrich with TSHLA ID from unified_patients
    const enrichedData = await Promise.all(
      data.map(async (summary) => {
        // Look up TSHLA ID and MRN by phone
        const { data: patientData } = await supabase
          .from('unified_patients')
          .select('tshla_id, patient_id, mrn')
          .eq('phone_primary', summary.patient_phone.replace(/\D/g, ''))
          .single();

        return {
          ...summary,
          tshla_id: patientData?.tshla_id || 'N/A',
          patient_id: patientData?.patient_id || 'N/A',
          athena_mrn: patientData?.mrn || summary.patient_mrn || 'N/A',  // Prefer unified_patients.mrn (Athena ID)
          share_link_url: `${process.env.VITE_APP_URL || 'https://www.tshla.ai'}/patient-summary/${summary.share_link_id}`
        };
      })
    );

    logger.info('PatientSummary', 'Staff dashboard results', {
      count: enrichedData.length
    });

    res.json({
      success: true,
      data: enrichedData,
      count: enrichedData.length
    });

  } catch (error) {
    logger.error('PatientSummary', 'Staff dashboard error', {
      error: error.message
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/staff/summaries/:id/mark-sent
 * Mark summary as sent to patient
 */
router.post('/staff/summaries/:id/mark-sent', async (req, res) => {
  try {
    const { id } = req.params;
    const { staffId } = req.body;

    const { data, error } = await supabase
      .from('patient_audio_summaries')
      .update({
        staff_sent_at: new Date().toISOString(),
        staff_sent_by: staffId,
        status: 'sent'
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    logger.info('PatientSummary', 'Summary marked as sent', { summaryId: id });

    res.json({
      success: true,
      data: data
    });

  } catch (error) {
    logger.error('PatientSummary', 'Mark sent failed', {
      error: error.message
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PATCH /api/patient-summaries/:id/appointment-made
 * Toggle appointment made status for follow-up tracking
 */
router.patch('/patient-summaries/:id/appointment-made', async (req, res) => {
  try {
    const { id } = req.params;
    const { appointmentMade, staffId } = req.body;

    logger.info('PatientSummary', 'Appointment toggle', {
      summaryId: id,
      appointmentMade
    });

    const updateData = {
      appointment_made: appointmentMade,
      appointment_made_at: appointmentMade ? new Date().toISOString() : null,
      appointment_made_by: appointmentMade ? staffId : null
    };

    const { data, error } = await supabase
      .from('patient_audio_summaries')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    logger.info('PatientSummary', 'Appointment status updated', {
      summaryId: id
    });

    res.json({
      success: true,
      data: data
    });

  } catch (error) {
    logger.error('PatientSummary', 'Appointment toggle failed', {
      error: error.message
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/staff/patient-summaries/:id/delete
 * Soft delete a patient audio summary (wrong chart, duplicate, etc.)
 * HIPAA Audit Trail: Records who deleted, when, and why
 */
router.delete('/staff/patient-summaries/:id/delete', async (req, res) => {
  try {
    const { id } = req.params;
    const { providerId, reason } = req.body;

    logger.info('PatientSummary', 'Deleting summary', {
      summaryId: id,
      reason
    });

    // Validate reason
    const validReasons = ['wrong_chart', 'duplicate', 'test', 'other'];
    if (!validReasons.includes(reason)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid deletion reason'
      });
    }

    // Check if summary exists and is not already deleted
    const { data: existing, error: fetchError } = await supabase
      .from('patient_audio_summaries')
      .select('id, patient_name, deleted_at')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({
        success: false,
        error: 'Patient summary not found'
      });
    }

    if (existing.deleted_at) {
      return res.status(400).json({
        success: false,
        error: 'Summary is already deleted'
      });
    }

    // Perform soft delete
    const { data, error } = await supabase
      .from('patient_audio_summaries')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by_provider_id: providerId,
        deletion_reason: reason
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    logger.info('PatientSummary', 'Summary soft deleted', {
      summaryId: id,
      providerId,
      reason
    });

    res.json({
      success: true,
      message: 'Patient summary deleted successfully',
      data: {
        id: data.id,
        deleted_at: data.deleted_at,
        deleted_by: providerId,
        reason: reason
      }
    });

  } catch (error) {
    logger.error('PatientSummary', 'Delete summary failed', {
      error: error.message
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/patient-summaries/test-connection
 * Test Supabase connection and table access
 * DEBUG ENDPOINT
 */
router.get('/patient-summaries/test-connection', async (req, res) => {
  try {
    const envCheck = {
      supabaseUrl: SUPABASE_URL || 'NOT SET',
      supabaseKeySet: SUPABASE_SERVICE_KEY ? 'YES' : 'NO'
    };

    const { data, error, count } = await supabase
      .from('patient_audio_summaries')
      .select('id', { count: 'exact', head: true });

    return res.json({
      success: !error,
      env: envCheck,
      test: {
        error: error ? { message: error.message, code: error.code, details: error.details } : null,
        count: count
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/patient-summaries/patient/:patientPhone
 * Get all summaries for a patient by phone number
 * Used by patient portal to list all visit summaries
 * Requires session validation via x-session-id header
 */
router.get('/patient-summaries/patient/:patientPhone', async (req, res) => {
  try {
    const { patientPhone } = req.params;
    const sessionId = req.headers['x-session-id'];

    logger.info('PatientSummary', 'Loading summaries for patient via patient/:phone endpoint', {
      phone: patientPhone.slice(-4), // Log last 4 digits only for HIPAA
      endpoint: '/patient-summaries/patient/:patientPhone'
    });

    // Optional: Validate session (if using session-based auth)
    // For now, we'll allow any request with a session ID

    const { data, error } = await supabase
      .from('patient_audio_summaries')
      .select('id, patient_phone, provider_name, summary_script, audio_blob_url, created_at, expires_at, access_count')
      .eq('patient_phone', patientPhone)
      .order('created_at', { ascending: false });

    // Map column names to match frontend expectations
    const mappedData = data ? data.map(item => ({
      ...item,
      summary_text: item.summary_script,
      audio_url: item.audio_blob_url
    })) : [];

    if (error) {
      logger.error('PatientSummary', 'Database error loading summaries', {
        error: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        supabaseUrl: SUPABASE_URL ? 'set' : 'NOT SET',
        supabaseKey: SUPABASE_SERVICE_KEY ? 'set' : 'NOT SET'
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to load summaries',
        debug: process.env.NODE_ENV !== 'production' ? error.message : undefined
      });
    }

    logger.info('PatientSummary', 'Summaries loaded successfully', {
      count: mappedData.length
    });

    return res.json({
      success: true,
      summaries: mappedData
    });
  } catch (error) {
    logger.error('PatientSummary', 'Error loading patient summaries', { error: error.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/patient-summaries/:linkId
 * Get summary info by share link ID
 * Public endpoint - no auth required
 */
router.get('/patient-summaries/:linkId', async (req, res) => {
  try {
    const { linkId } = req.params;

    logger.info('PatientSummary', 'Looking up share link', {
      linkId: linkId.slice(0, 8) // First 8 chars only
    });

    const { data, error } = await supabase
      .from('patient_audio_summaries')
      .select('*')
      .eq('share_link_id', linkId)
      .single();

    if (error || !data) {
      logger.warn('PatientSummary', 'Summary not found', {
        linkId: linkId.slice(0, 8)
      });
      return res.status(404).json({
        success: false,
        error: 'Summary not found or link invalid'
      });
    }

    // Check if expired
    if (new Date(data.expires_at) < new Date()) {
      logger.warn('PatientSummary', 'Summary expired', {
        linkId: linkId.slice(0, 8)
      });
      return res.status(410).json({
        success: false,
        error: 'This summary link has expired. Please contact your doctor\'s office.'
      });
    }

    logger.info('PatientSummary', 'Summary found', {
      patientInitial: data.patient_name ? data.patient_name[0] : 'U'
    });

    // Return summary info (without sensitive details)
    res.json({
      success: true,
      data: {
        summaryId: data.id,
        patientName: data.patient_name,
        providerName: data.provider_name,
        createdAt: data.created_at,
        expiresAt: data.expires_at,
        accessCount: data.access_count
      }
    });

  } catch (error) {
    logger.error('PatientSummary', 'Summary lookup failed', {
      error: error.message
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/patient-summaries/:linkId/verify-tshla
 * Verify TSHLA ID and return summary content
 * Rate-limited to prevent brute force attacks
 */
router.post('/patient-summaries/:linkId/verify-tshla', async (req, res) => {
  try {
    const { linkId } = req.params;
    const { tshlaId } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    logger.info('PatientSummary', 'TSHLA verification attempt', {
      linkId: linkId.slice(0, 8),
      tshlaId: tshlaId.slice(0, 4) + '***' // First 4 chars only
    });

    // Check rate limiting
    const isRateLimited = await checkRateLimit(ipAddress);
    if (isRateLimited) {
      logger.warn('PatientSummary', 'Rate limit exceeded', {
        ip: ipAddress.slice(-7)
      });
      return res.status(429).json({
        success: false,
        error: 'Too many failed attempts. Please try again in 1 hour or contact the office.'
      });
    }

    // Get summary
    const { data: summary, error: summaryError } = await supabase
      .from('patient_audio_summaries')
      .select('*')
      .eq('share_link_id', linkId)
      .single();

    if (summaryError || !summary) {
      await logAccess(null, 'failed_tshla_verification', ipAddress, userAgent, tshlaId, false);
      return res.status(404).json({
        success: false,
        error: 'Invalid link or summary not found'
      });
    }

    // Verify TSHLA ID matches patient
    const { data: patient, error: patientError } = await supabase
      .from('unified_patients')
      .select('tshla_id, patient_id, full_name')
      .eq('phone_primary', summary.patient_phone.replace(/\D/g, ''))
      .single();

    if (patientError || !patient) {
      await logAccess(summary.id, 'failed_tshla_verification', ipAddress, userAgent, tshlaId, false);
      return res.status(403).json({
        success: false,
        error: 'Patient not found in system'
      });
    }

    // Compare TSHLA IDs (case-insensitive, ignore spaces/dashes)
    // Normalize both IDs by removing all non-alphanumeric characters
    const normalizedDbTshlaId = patient.tshla_id.replace(/[^A-Z0-9]/gi, '').toLowerCase();
    const normalizedInputTshlaId = tshlaId.replace(/[^A-Z0-9]/gi, '').toLowerCase();

    if (normalizedDbTshlaId !== normalizedInputTshlaId) {
      logger.warn('PatientSummary', 'TSHLA ID mismatch', {
        expected: patient.tshla_id.slice(0, 4) + '***',
        received: tshlaId.slice(0, 4) + '***'
      });
      await logAccess(summary.id, 'failed_tshla_verification', ipAddress, userAgent, tshlaId, false);
      return res.status(403).json({
        success: false,
        error: 'TSHLA ID does not match. Please check your ID and try again.'
      });
    }

    // Success! Log access and increment counter
    await logAccess(summary.id, 'view_summary', ipAddress, userAgent, tshlaId, true);

    await supabase
      .from('patient_audio_summaries')
      .update({
        access_count: summary.access_count + 1,
        last_accessed_at: new Date().toISOString()
      })
      .eq('id', summary.id);

    logger.info('PatientSummary', 'TSHLA verification successful', {
      patientInitial: patient.full_name ? patient.full_name[0] : 'U'
    });

    res.json({
      success: true,
      data: {
        summaryId: summary.id,
        patientName: summary.patient_name,
        summaryText: summary.summary_script,
        providerName: summary.provider_name,
        createdAt: summary.created_at,
        expiresAt: summary.expires_at,
        accessCount: summary.access_count + 1,
        hasAudio: !!summary.audio_blob_url
      }
    });

  } catch (error) {
    logger.error('PatientSummary', 'TSHLA verification error', {
      error: error.message
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/patient-summaries/:linkId/audio
 * Generate audio on-demand (first access only) and return URL
 * Requires prior TSHLA verification (checks access log)
 */
router.get('/patient-summaries/:linkId/audio', async (req, res) => {
  try {
    const { linkId } = req.params;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    logger.info('PatientSummary', 'Audio request', {
      linkId: linkId.slice(0, 8)
    });

    // Get summary
    const { data: summary, error: summaryError } = await supabase
      .from('patient_audio_summaries')
      .select('*')
      .eq('share_link_id', linkId)
      .single();

    if (summaryError || !summary) {
      return res.status(404).json({
        success: false,
        error: 'Summary not found'
      });
    }

    // Verify patient has successfully verified TSHLA ID recently (within last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentAccess } = await supabase
      .from('patient_summary_access_log')
      .select('id')
      .eq('summary_id', summary.id)
      .eq('ip_address', ipAddress)
      .eq('success', true)
      .eq('access_type', 'view_summary')
      .gte('accessed_at', oneHourAgo)
      .limit(1);

    if (!recentAccess || recentAccess.length === 0) {
      logger.warn('PatientSummary', 'Unauthorized audio request');
      return res.status(403).json({
        success: false,
        error: 'Please verify your TSHLA ID first'
      });
    }

    // Check if audio already exists
    if (summary.audio_blob_url) {
      logger.info('PatientSummary', 'Audio cache hit');
      await logAccess(summary.id, 'play_audio', ipAddress, userAgent, null, true);

      return res.json({
        success: true,
        data: {
          audioUrl: summary.audio_blob_url,
          cached: true
        }
      });
    }

    // Generate audio on-demand
    logger.info('PatientSummary', 'Generating audio on-demand');
    const audioBuffer = await generateAudio(summary.summary_script, summary.voice_id);
    logger.info('PatientSummary', 'Audio generated', {
      sizeKB: (audioBuffer.length / 1024).toFixed(1)
    });

    // Upload to Azure Blob Storage
    logger.info('PatientSummary', 'Uploading to Azure Blob');
    const audioUrl = await uploadAudioToAzure(audioBuffer, summary.voice_id, summary.id);

    // Save URL to database
    await supabase
      .from('patient_audio_summaries')
      .update({
        audio_blob_url: audioUrl,
        audio_generated_at: new Date().toISOString(),
        audio_file_size_kb: Math.round(audioBuffer.length / 1024)
      })
      .eq('id', summary.id);

    await logAccess(summary.id, 'play_audio', ipAddress, userAgent, null, true);

    logger.info('PatientSummary', 'Audio saved successfully');

    res.json({
      success: true,
      data: {
        audioUrl: audioUrl,
        cached: false
      }
    });

  } catch (error) {
    logger.error('PatientSummary', 'Audio generation failed', {
      error: error.message
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/patient-summaries/portal-audio/:dictationId
 * Generate or retrieve audio for a dictation (called from patient portal)
 * Generates audio on-demand via ElevenLabs if not yet generated
 */
router.get('/portal-audio/:dictationId', async (req, res) => {
  try {
    const { dictationId } = req.params;

    // Look up the patient_audio_summaries record by dictation_id
    const { data: summary, error } = await supabase
      .from('patient_audio_summaries')
      .select('id, summary_script, voice_id, audio_blob_url')
      .eq('dictation_id', parseInt(dictationId))
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !summary) {
      return res.status(404).json({
        success: false,
        error: 'No audio summary found for this dictation'
      });
    }

    // If audio already generated, return cached URL
    if (summary.audio_blob_url) {
      logger.info('PatientSummary', 'Portal audio cache hit', { dictationId });
      return res.json({
        success: true,
        audioUrl: summary.audio_blob_url,
        cached: true
      });
    }

    // Generate audio on-demand
    logger.info('PatientSummary', 'Generating portal audio on-demand', { dictationId });
    const audioBuffer = await generateAudio(summary.summary_script, summary.voice_id);

    // Upload to Azure Blob Storage
    const audioUrl = await uploadAudioToAzure(audioBuffer, summary.voice_id, summary.id);

    // Save URL to database
    await supabase
      .from('patient_audio_summaries')
      .update({
        audio_blob_url: audioUrl,
        audio_generated_at: new Date().toISOString(),
        audio_file_size_kb: Math.round(audioBuffer.length / 1024)
      })
      .eq('id', summary.id);

    logger.info('PatientSummary', 'Portal audio generated and saved', { dictationId });

    res.json({
      success: true,
      audioUrl: audioUrl,
      cached: false
    });

  } catch (error) {
    logger.error('PatientSummary', 'Portal audio generation failed', {
      error: error.message,
      dictationId: req.params.dictationId
    });
    res.status(500).json({
      success: false,
      error: 'Failed to generate audio. Please try again.'
    });
  }
});

module.exports = router;
