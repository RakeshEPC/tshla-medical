/**
 * Patient Audio Summaries API
 * Web-based patient visit summaries with shareable links
 * Replaces Twilio phone calls with portal-based audio playback
 *
 * Created: 2026-01-13
 * HIPAA Compliant: Azure OpenAI + Azure Blob Storage
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { BlobServiceClient } = require('@azure/storage-blob');
const crypto = require('crypto');

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
    console.log('✅ Azure Blob Storage client initialized for patient summaries');
  } catch (error) {
    console.error('❌ Failed to initialize Azure Blob Storage:', error.message);
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
 */
async function generatePatientSummary(soapNote) {
  const prompt = `You are converting a medical SOAP note into a patient-friendly phone call script.

CRITICAL RULES:
1. START with exactly: "This is a beta project from your doctor's office."
2. Use warm, conversational, natural language (avoid clinical jargon)
3. Say "You came in for [reason]" NOT "Chief complaint was"
4. Include in this order:
   a) Why they came in (conversational)
   b) Key findings (blood sugar, vitals, important results - plain English)
   c) Medication changes (what's new, doses clearly stated)
   d) Tests ordered (labs, imaging - explain what and why simply)
   e) Follow-up plan (when to come back)
   f) What patient should do (take meds, diet, exercise)
5. END with exactly: "If you notice any errors in this summary, please let us know. We are still testing this feature."
6. LENGTH: 100-150 words total (15-30 seconds when spoken)
7. NUMBERS: Say "9 point 5" not "nine point five"
8. MEDICATIONS: Say full name and dose clearly: "Metformin 1500 milligrams twice daily"
9. TONE: Warm but professional

SOAP NOTE:
${soapNote}

Generate ONLY the conversational phone script:`;

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
      console.error('Azure OpenAI API error for follow-up extraction:', response.status);
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
        console.warn('Invalid date format from AI:', extracted.date);
        return null;
      }
    }

    console.log(`📅 Follow-up extracted: ${extracted.date ? extracted.date : 'None'} ${extracted.notes ? '(' + extracted.notes + ')' : ''}`);
    return extracted.date ? extracted : null;

  } catch (error) {
    console.error('Error extracting follow-up date:', error.message);
    return null; // Fail gracefully - don't block summary creation
  }
}

/**
 * Generate audio from text using ElevenLabs
 */
async function generateAudio(text, voiceId = DEFAULT_VOICE_ID) {
  console.log(`🔊 Generating audio with ElevenLabs voice ID: ${voiceId}`);

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
  console.log(`✅ Audio uploaded to Azure Blob Storage: ${audioUrl}`);

  // Schedule cleanup after 7 days (updated from 24 hours)
  setTimeout(async () => {
    try {
      await blockBlobClient.delete();
      console.log(`🗑️ Cleaned up audio file: ${blobName}`);
    } catch (err) {
      console.error(`Failed to delete audio file ${blobName}:`, err.message);
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
      console.error('Failed to log access:', error.message);
    }
  } catch (err) {
    console.error('Failed to log access:', err.message);
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
    console.error('Rate limit check failed:', error.message);
    return false; // Allow on error (fail open)
  }

  const attemptCount = data ? data.length : 0;
  console.log(`🔒 Rate limit check: ${attemptCount}/20 failed attempts for IP ${ipAddress} (TESTING MODE)`);

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

    console.log('📝 [Patient Summary] Creating new summary...');
    console.log(`   Patient: ${patientName || 'Unknown'}`);
    console.log(`   Phone: ${patientPhone}`);
    console.log(`   Provider: ${providerName || providerId || 'Unknown'}`);

    // Step 1: Generate AI summary
    console.log('🤖 Generating patient-friendly summary with Azure OpenAI...');
    const summary = await generatePatientSummary(soapNote);
    console.log(`✅ Summary generated: ${summary.wordCount} words, ~${summary.estimatedSeconds}s`);

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
      console.error('❌ Failed to create summary:', error.message);
      throw new Error(`Database error: ${error.message}`);
    }

    const shareLinkUrl = `${process.env.VITE_APP_URL || 'https://www.tshla.ai'}/patient-summary/${data.share_link_id}`;

    console.log('✅ Patient summary created successfully!');
    console.log(`   Summary ID: ${data.id}`);
    console.log(`   Share Link: ${shareLinkUrl}`);
    console.log(`   Expires: ${data.expires_at}`);

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
    console.error('❌ [Patient Summary Create] Error:', error.message);
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

    console.log('📋 [Staff Dashboard] Fetching patient summaries...');

    let query = supabase
      .from('patient_audio_summaries')
      .select('*')
      .order('created_at', { ascending: false });

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
        // Look up TSHLA ID by phone
        const { data: patientData } = await supabase
          .from('unified_patients')
          .select('tshla_id, patient_id')
          .eq('phone_primary', summary.patient_phone.replace(/\D/g, ''))
          .single();

        return {
          ...summary,
          tshla_id: patientData?.tshla_id || 'N/A',
          patient_id: patientData?.patient_id || 'N/A',
          share_link_url: `${process.env.VITE_APP_URL || 'https://www.tshla.ai'}/patient-summary/${summary.share_link_id}`
        };
      })
    );

    console.log(`✅ Found ${enrichedData.length} summaries`);

    res.json({
      success: true,
      data: enrichedData,
      count: enrichedData.length
    });

  } catch (error) {
    console.error('❌ [Staff Dashboard] Error:', error.message);
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

    console.log(`✅ Summary ${id} marked as sent`);

    res.json({
      success: true,
      data: data
    });

  } catch (error) {
    console.error('❌ [Mark Sent] Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
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

    console.log(`🔍 [Patient Summary] Looking up link: ${linkId}`);

    const { data, error } = await supabase
      .from('patient_audio_summaries')
      .select('*')
      .eq('share_link_id', linkId)
      .single();

    if (error || !data) {
      console.warn(`⚠️ Summary not found for link: ${linkId}`);
      return res.status(404).json({
        success: false,
        error: 'Summary not found or link invalid'
      });
    }

    // Check if expired
    if (new Date(data.expires_at) < new Date()) {
      console.warn(`⚠️ Summary expired: ${linkId}`);
      return res.status(410).json({
        success: false,
        error: 'This summary link has expired. Please contact your doctor\'s office.'
      });
    }

    console.log(`✅ Summary found: ${data.patient_name}`);

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
    console.error('❌ [Patient Summary Lookup] Error:', error.message);
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

    console.log(`🔐 [TSHLA Verification] Link: ${linkId}, TSHLA ID: ${tshlaId}`);

    // Check rate limiting
    const isRateLimited = await checkRateLimit(ipAddress);
    if (isRateLimited) {
      console.warn(`⚠️ Rate limit exceeded for IP: ${ipAddress}`);
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
      console.warn(`❌ TSHLA ID mismatch: Expected ${patient.tshla_id} (normalized: ${normalizedDbTshlaId}), Got ${tshlaId} (normalized: ${normalizedInputTshlaId})`);
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

    console.log(`✅ TSHLA ID verified successfully for ${patient.full_name}`);

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
    console.error('❌ [TSHLA Verification] Error:', error.message);
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

    console.log(`🔊 [Audio Request] Link: ${linkId}`);

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
      console.warn(`⚠️ Unauthorized audio request (no recent TSHLA verification)`);
      return res.status(403).json({
        success: false,
        error: 'Please verify your TSHLA ID first'
      });
    }

    // Check if audio already exists
    if (summary.audio_blob_url) {
      console.log(`✅ Audio already exists: ${summary.audio_blob_url}`);
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
    console.log('🎙️ Generating audio for first time...');
    const audioBuffer = await generateAudio(summary.summary_script, summary.voice_id);
    console.log(`✅ Audio generated: ${(audioBuffer.length / 1024).toFixed(1)} KB`);

    // Upload to Azure Blob Storage
    console.log('☁️ Uploading to Azure Blob Storage...');
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

    console.log(`✅ Audio generated and saved successfully`);

    res.json({
      success: true,
      data: {
        audioUrl: audioUrl,
        cached: false
      }
    });

  } catch (error) {
    console.error('❌ [Audio Generation] Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
