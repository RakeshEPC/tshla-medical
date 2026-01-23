/**
 * Echo Audio Summary API - Azure Communication Services Version
 * HIPAA-compliant patient audio summary generation and phone calls
 * Uses Azure Communication Services (HIPAA compliant with Microsoft BAA)
 * Endpoint: POST /api/echo/send-audio-summary
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const router = express.Router();
const { CallAutomationClient } = require('@azure/communication-call-automation');
const { BlobServiceClient } = require('@azure/storage-blob');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require("../services/logger.service");

// Middleware to parse JSON bodies
router.use(express.json());

// Azure Communication Services configuration
const ACS_CONNECTION_STRING = process.env.AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING;
const ACS_PHONE_NUMBER = process.env.AZURE_COMMUNICATION_SERVICES_PHONE_NUMBER;
const ACS_CALLBACK_URL = process.env.AZURE_COMMUNICATION_SERVICES_CALLBACK_URL || 'https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/echo/acs-callback';

// Azure Blob Storage configuration (for hosting audio files)
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const AUDIO_CONTAINER_NAME = 'echo-audio';

// Azure OpenAI configuration for AI summary generation (HIPAA compliant)
const AZURE_OPENAI_KEY = process.env.AZURE_OPENAI_KEY;
const AZURE_OPENAI_ENDPOINT = process.env.VITE_AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_DEPLOYMENT = process.env.VITE_AZURE_OPENAI_DEPLOYMENT || 'gpt-4';
const AZURE_API_VERSION = process.env.VITE_AZURE_OPENAI_API_VERSION || '2024-02-01';

// ElevenLabs configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// Clinic phone number for call transfers
const CLINIC_PHONE_NUMBER = process.env.CLINIC_PHONE_NUMBER || '+18325938100';

// Initialize Azure clients
let callAutomationClient = null;
let blobServiceClient = null;

// In-memory storage for call audio URLs (use Redis/database in production)
const callAudioMap = new Map();

if (ACS_CONNECTION_STRING) {
  try {
    callAutomationClient = new CallAutomationClient(ACS_CONNECTION_STRING);
    logger.info('EchoAudio', '✅ Azure Communication Services client initialized');
  } catch (error) {
    logger.error('EchoAudio', '❌ Failed to initialize Azure Communication Services:', error.message);
  }
}

if (AZURE_STORAGE_CONNECTION_STRING) {
  try {
    blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
    logger.info('EchoAudio', '✅ Azure Blob Storage client initialized');
  } catch (error) {
    logger.error('EchoAudio', '❌ Failed to initialize Azure Blob Storage:', error.message);
  }
}

/**
 * Generate patient-friendly conversational summary from SOAP note
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
 * Generate audio from text using ElevenLabs
 * @param {string} text - Text to convert to speech
 * @param {string} voiceId - ElevenLabs voice ID
 */
async function generateAudio(text, voiceId) {
  logger.info('EchoAudio', `🔊 Generating audio with ElevenLabs voice ID: ${voiceId}`);

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
 * Upload audio to Azure Blob Storage and return public URL
 * Audio files are set to expire after 24 hours
 */
async function uploadAudioToAzure(audioBuffer, voiceId) {
  if (!blobServiceClient) {
    throw new Error('Azure Blob Storage not configured');
  }

  const containerClient = blobServiceClient.getContainerClient(AUDIO_CONTAINER_NAME);

  // Create container if it doesn't exist
  await containerClient.createIfNotExists({
    access: 'blob' // Public read access for audio files
  });

  const blobName = `echo-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.mp3`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  // Upload audio with metadata
  await blockBlobClient.uploadData(audioBuffer, {
    blobHTTPHeaders: {
      blobContentType: 'audio/mpeg'
    },
    metadata: {
      voiceId: voiceId,
      createdAt: new Date().toISOString()
    }
  });

  const audioUrl = blockBlobClient.url;
  logger.info('EchoAudio', `✅ Audio uploaded to Azure Blob Storage: ${audioUrl}`);

  // Schedule cleanup after 24 hours
  setTimeout(async () => {
    try {
      await blockBlobClient.delete();
      logger.info('EchoAudio', `🗑️ Cleaned up audio file: ${blobName}`);
    } catch (err) {
      logger.error('EchoAudio', `Failed to delete audio file ${blobName}:`, err.message);
    }
  }, 24 * 60 * 60 * 1000); // 24 hours

  return audioUrl;
}

/**
 * Make phone call using Azure Communication Services
 * Plays ElevenLabs audio and handles DTMF input
 */
async function makePhoneCall(phoneNumber, audioUrl, scriptText) {
  if (!callAutomationClient) {
    throw new Error('Azure Communication Services not configured');
  }

  logger.info('EchoAudio', `📞 Initiating call to ${phoneNumber} with audio: ${audioUrl}`);

  // Format phone numbers for Azure Communication Services
  // The SDK expects PhoneNumberIdentifier objects
  const { PhoneNumberIdentifier } = require('@azure/communication-common');

  const source = new PhoneNumberIdentifier(ACS_PHONE_NUMBER);
  const target = new PhoneNumberIdentifier(phoneNumber);

  // Create call with proper identifier types
  const result = await callAutomationClient.createCall(
    target,
    ACS_CALLBACK_URL,
    {
      sourceCallerId: source,
      operationContext: 'echo-audio-summary'
    }
  );

  logger.info('EchoAudio', `✅ Call initiated successfully`);
  logger.info('EchoAudio', `   Call Connection ID: ${result.callConnectionId}`);

  // Store the audio URL and phone number for the callback to use
  callAudioMap.set(result.callConnectionId, {
    audioUrl: audioUrl,
    phoneNumber: phoneNumber,
    timestamp: Date.now()
  });
  logger.info('EchoAudio', `📝 Audio URL stored for callback: ${audioUrl}`);

  // Clean up old entries after 1 hour
  setTimeout(() => {
    callAudioMap.delete(result.callConnectionId);
  }, 60 * 60 * 1000);

  return {
    callId: result.callConnectionId,
    status: 'initiated',
    usingElevenLabs: true,
    audioUrl: audioUrl,
    message: 'Call initiated. Audio will play when call connects.'
  };
}

/**
 * POST /api/echo/generate-preview
 * Generate AI script preview without calling patient
 */
router.post('/generate-preview', async (req, res) => {
  try {
    const { soapNote } = req.body;

    if (!soapNote) {
      logger.warn('EchoAudio', '⚠️ [Echo Preview] Missing SOAP note in request');
      return res.status(400).json({
        success: false,
        error: 'Missing required field: soapNote'
      });
    }

    logger.info('EchoAudio', '🎙️ [Echo Preview] Generating AI summary preview...');
    logger.info('EchoAudio', '   SOAP note length:', soapNote.length, 'characters');

    const summary = await generatePatientSummary(soapNote);

    logger.info('EchoAudio', '✅ [Echo Preview] Summary generated successfully');
    logger.info('EchoAudio', '   Word count:', summary.wordCount);
    logger.info('EchoAudio', '   Estimated duration:', summary.estimatedSeconds, 'seconds');

    res.json({
      success: true,
      script: summary.script,
      wordCount: summary.wordCount,
      estimatedSeconds: summary.estimatedSeconds
    });

  } catch (error) {
    logger.error('EchoAudio', '❌ [Echo Preview] Error:', error.message);

    let userMessage = error.message;
    if (error.message.includes('Azure OpenAI API error: 401')) {
      userMessage = 'Azure OpenAI API key is invalid or expired. Please check VITE_AZURE_OPENAI_KEY in your environment variables.';
    } else if (error.message.includes('Azure OpenAI')) {
      userMessage = 'Azure OpenAI API error: ' + error.message;
    }

    res.status(500).json({
      success: false,
      error: userMessage
    });
  }
});

/**
 * POST /api/echo/send-audio-summary
 * Generate AI summary, create ElevenLabs audio, and call patient via Azure Communication Services
 */
router.post('/send-audio-summary', async (req, res) => {
  try {
    const { soapNote, phoneNumber, patientName, providerId, voiceId } = req.body;

    // Validation
    if (!soapNote || !phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: soapNote and phoneNumber'
      });
    }

    if (!voiceId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: voiceId (ElevenLabs voice)'
      });
    }

    logger.info('EchoAudio', '🎙️ [Echo Audio Summary - Azure] Starting process...');
    logger.info('EchoAudio', `   Patient: ${patientName || 'Unknown'}`);
    logger.info('EchoAudio', `   Phone: ${phoneNumber}`);
    logger.info('EchoAudio', `   Voice ID: ${voiceId}`);
    logger.info('EchoAudio', `   SOAP length: ${soapNote.length} chars`);

    // Step 1: Generate AI summary
    logger.info('EchoAudio', '📝 Generating AI summary...');
    const summary = await generatePatientSummary(soapNote, patientName);
    logger.info('EchoAudio', `✅ Summary generated: ${summary.wordCount} words, ~${summary.estimatedSeconds}s`);

    // Step 2: Generate audio with selected ElevenLabs voice
    logger.info('EchoAudio', `🔊 Generating audio with ElevenLabs voice: ${voiceId}...`);
    const audioBuffer = await generateAudio(summary.script, voiceId);
    logger.info('EchoAudio', `✅ Audio generated: ${(audioBuffer.length / 1024).toFixed(1)} KB`);

    // Step 3: Upload audio to Azure Blob Storage
    logger.info('EchoAudio', '☁️ Uploading audio to Azure Blob Storage...');
    const audioUrl = await uploadAudioToAzure(audioBuffer, voiceId);
    logger.info('EchoAudio', `✅ Audio available at: ${audioUrl}`);

    // Step 4: Make call via Azure Communication Services
    logger.info('EchoAudio', `📞 Calling patient via Azure Communication Services...`);
    const callResult = await makePhoneCall(phoneNumber, audioUrl, summary.script);
    logger.info('EchoAudio', `✅ Call initiated: ${callResult.callId}`);

    // Return success response
    res.json({
      success: true,
      data: {
        script: summary.script,
        wordCount: summary.wordCount,
        estimatedSeconds: summary.estimatedSeconds,
        callId: callResult.callId,
        callStatus: callResult.status,
        audioUrl: audioUrl,
        phoneNumber: phoneNumber,
        voiceUsed: voiceId,
        usingElevenLabs: true
      }
    });

  } catch (error) {
    logger.error('EchoAudio', '❌ [Echo Audio Summary - Azure] Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/echo/send-sms-summary
 * Generate AI summary and send via SMS text message
 * (SMS sending not yet implemented for Azure Communication Services)
 */
router.post('/send-sms-summary', async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'SMS functionality not yet implemented with Azure Communication Services. Use phone call instead.'
  });
});

/**
 * POST /api/echo/acs-callback
 * Handle Azure Communication Services callbacks (call events, DTMF, etc.)
 */
router.post('/acs-callback', async (req, res) => {
  try {
    const event = req.body;
    logger.info('EchoAudio', '📞 [ACS Callback] Event received:', JSON.stringify(event, null, 2));

    // Azure sends events as an array
    const events = Array.isArray(event) ? event : [event];

    for (const evt of events) {
      const eventType = evt.eventType || evt.type;

      // Handle different event types
      switch (eventType) {
        case 'Microsoft.Communication.CallConnected':
          {
            const callId = evt.data?.callConnectionId || evt.callConnectionId;
            logger.info('EchoAudio', '✅ Call connected:', callId);

            // Retrieve audio URL from our map
            const callData = callAudioMap.get(callId);
            if (callData && callAutomationClient) {
              logger.info('EchoAudio', '🔊 Playing audio:', callData.audioUrl);
              try {
                const callConnection = callAutomationClient.getCallConnection(callId);
                const callMedia = callConnection.getCallMedia();

                // Play the audio file using the correct Azure SDK format
                // Reference: https://learn.microsoft.com/en-us/javascript/api/@azure/communication-call-automation
                const playSource = {
                  kind: "fileSource",
                  fileSource: {
                    uri: callData.audioUrl  // Changed from 'url' to 'uri'
                  }
                };

                await callMedia.playToAll([playSource], {
                  operationContext: 'echo-playback'
                });

                logger.info('EchoAudio', '✅ Audio playback started successfully');
              } catch (playError) {
                logger.error('EchoAudio', '❌ Failed to play audio:', playError.message);
                logger.error('EchoAudio', '   Error stack:', playError.stack);

                // If playback fails, try to get more details
                if (playError.statusCode) {
                  logger.error('EchoAudio', '   Status code:', playError.statusCode);
                }
                if (playError.code) {
                  logger.error('EchoAudio', '   Error code:', playError.code);
                }
              }
            } else {
              logger.warn('EchoAudio', '⚠️ No audio URL found for call:', callId);
            }
          }
          break;

        case 'Microsoft.Communication.CallDisconnected':
          {
            const callId = evt.data?.callConnectionId || evt.callConnectionId;
            logger.info('EchoAudio', '📴 Call disconnected:', callId);

            // Clean up the audio URL mapping
            if (callAudioMap.has(callId)) {
              callAudioMap.delete(callId);
              logger.info('EchoAudio', '🗑️ Cleaned up audio URL mapping for call:', callId);
            }
          }
          break;

        case 'Microsoft.Communication.PlayCompleted':
          {
            logger.info('EchoAudio', '🔊 Audio playback completed');

            // Hang up the call after audio completes
            const callId = evt.data?.callConnectionId || evt.callConnectionId;
            if (callId && callAutomationClient) {
              try {
                const callConnection = callAutomationClient.getCallConnection(callId);
                await callConnection.hangUp(true); // true = hang up for all participants
                logger.info('EchoAudio', '📴 Call ended after audio playback');
              } catch (hangupError) {
                logger.error('EchoAudio', 'Failed to hang up call:', hangupError.message);
              }
            }
          }
          break;

        case 'Microsoft.Communication.PlayFailed':
          logger.error('EchoAudio', '❌ Audio playback failed:', evt.data);
          break;

        default:
          logger.info('EchoAudio', 'ℹ️ Unhandled event type:', eventType);
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    logger.error('EchoAudio', '❌ [ACS Callback] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/echo/call-status/:callId
 * Check status of an Azure Communication Services call
 */
router.get('/call-status/:callId', async (req, res) => {
  try {
    const { callId } = req.params;

    if (!callAutomationClient) {
      return res.status(503).json({
        success: false,
        error: 'Azure Communication Services not configured'
      });
    }

    const callConnection = callAutomationClient.getCallConnection(callId);
    const properties = await callConnection.getCallProperties();

    res.json({
      success: true,
      callId: callId,
      status: properties.callConnectionState,
      source: properties.sourceIdentity,
      target: properties.targetIdentity
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
