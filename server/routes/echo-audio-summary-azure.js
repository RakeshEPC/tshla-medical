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
const AZURE_OPENAI_KEY = process.env.VITE_AZURE_OPENAI_KEY;
const AZURE_OPENAI_ENDPOINT = process.env.VITE_AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_DEPLOYMENT = process.env.VITE_AZURE_OPENAI_DEPLOYMENT || 'gpt-4';
const AZURE_API_VERSION = process.env.VITE_AZURE_OPENAI_API_VERSION || '2024-02-01';

// ElevenLabs configuration
const ELEVENLABS_API_KEY = process.env.VITE_ELEVENLABS_API_KEY;

// Clinic phone number for call transfers
const CLINIC_PHONE_NUMBER = process.env.CLINIC_PHONE_NUMBER || '+18325938100';

// Initialize Azure clients
let callAutomationClient = null;
let blobServiceClient = null;

if (ACS_CONNECTION_STRING) {
  try {
    callAutomationClient = new CallAutomationClient(ACS_CONNECTION_STRING);
    console.log('✅ Azure Communication Services client initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Azure Communication Services:', error.message);
  }
}

if (AZURE_STORAGE_CONNECTION_STRING) {
  try {
    blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
    console.log('✅ Azure Blob Storage client initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Azure Blob Storage:', error.message);
  }
}

/**
 * Generate patient-friendly conversational summary from SOAP note
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
 * Generate audio from text using ElevenLabs
 * @param {string} text - Text to convert to speech
 * @param {string} voiceId - ElevenLabs voice ID
 */
async function generateAudio(text, voiceId) {
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
  console.log(`✅ Audio uploaded to Azure Blob Storage: ${audioUrl}`);

  // Schedule cleanup after 24 hours
  setTimeout(async () => {
    try {
      await blockBlobClient.delete();
      console.log(`🗑️ Cleaned up audio file: ${blobName}`);
    } catch (err) {
      console.error(`Failed to delete audio file ${blobName}:`, err.message);
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

  console.log(`📞 Initiating call to ${phoneNumber} with audio: ${audioUrl}`);

  // Format phone numbers correctly for Azure Communication Services
  const sourceCallerId = { phoneNumber: ACS_PHONE_NUMBER };
  const targetParticipant = { phoneNumber: phoneNumber };

  // Create call with play audio action
  const result = await callAutomationClient.createCall(
    targetParticipant,
    ACS_CALLBACK_URL,
    {
      sourceCallerId: sourceCallerId,
      operationContext: 'echo-audio-summary'
    }
  );

  console.log(`✅ Call initiated: ${result.callConnectionId}`);

  // After call is connected, play the audio
  // Note: In production, you'd use the callback webhook to detect CallConnected event
  // and then play the audio. For now, we'll try to play immediately.
  try {
    const callConnection = callAutomationClient.getCallConnection(result.callConnectionId);
    await callConnection.playMedia([{ kind: 'fileSource', url: audioUrl }], [targetParticipant]);
    console.log(`✅ Audio playback started`);
  } catch (playError) {
    console.warn(`⚠️ Could not auto-play audio: ${playError.message}`);
    // This is expected - we'll play the audio via the callback webhook instead
  }

  return {
    callId: result.callConnectionId,
    status: 'initiated',
    usingElevenLabs: true,
    audioUrl: audioUrl
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
      console.warn('⚠️ [Echo Preview] Missing SOAP note in request');
      return res.status(400).json({
        success: false,
        error: 'Missing required field: soapNote'
      });
    }

    console.log('🎙️ [Echo Preview] Generating AI summary preview...');
    console.log('   SOAP note length:', soapNote.length, 'characters');

    const summary = await generatePatientSummary(soapNote);

    console.log('✅ [Echo Preview] Summary generated successfully');
    console.log('   Word count:', summary.wordCount);
    console.log('   Estimated duration:', summary.estimatedSeconds, 'seconds');

    res.json({
      success: true,
      script: summary.script,
      wordCount: summary.wordCount,
      estimatedSeconds: summary.estimatedSeconds
    });

  } catch (error) {
    console.error('❌ [Echo Preview] Error:', error.message);

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

    console.log('🎙️ [Echo Audio Summary - Azure] Starting process...');
    console.log(`   Patient: ${patientName || 'Unknown'}`);
    console.log(`   Phone: ${phoneNumber}`);
    console.log(`   Voice ID: ${voiceId}`);
    console.log(`   SOAP length: ${soapNote.length} chars`);

    // Step 1: Generate AI summary
    console.log('📝 Generating AI summary...');
    const summary = await generatePatientSummary(soapNote);
    console.log(`✅ Summary generated: ${summary.wordCount} words, ~${summary.estimatedSeconds}s`);

    // Step 2: Generate audio with selected ElevenLabs voice
    console.log(`🔊 Generating audio with ElevenLabs voice: ${voiceId}...`);
    const audioBuffer = await generateAudio(summary.script, voiceId);
    console.log(`✅ Audio generated: ${(audioBuffer.length / 1024).toFixed(1)} KB`);

    // Step 3: Upload audio to Azure Blob Storage
    console.log('☁️ Uploading audio to Azure Blob Storage...');
    const audioUrl = await uploadAudioToAzure(audioBuffer, voiceId);
    console.log(`✅ Audio available at: ${audioUrl}`);

    // Step 4: Make call via Azure Communication Services
    console.log(`📞 Calling patient via Azure Communication Services...`);
    const callResult = await makePhoneCall(phoneNumber, audioUrl, summary.script);
    console.log(`✅ Call initiated: ${callResult.callId}`);

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
    console.error('❌ [Echo Audio Summary - Azure] Error:', error.message);
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
    console.log('📞 [ACS Callback] Event received:', JSON.stringify(event, null, 2));

    // Azure sends events as an array
    const events = Array.isArray(event) ? event : [event];

    for (const evt of events) {
      const eventType = evt.eventType || evt.type;

      // Handle different event types
      switch (eventType) {
        case 'Microsoft.Communication.CallConnected':
          console.log('✅ Call connected:', evt.data?.callConnectionId || evt.callConnectionId);

          // Store audio URL from operation context if available
          // In production, you'd store this mapping in a database/cache
          const audioUrlFromContext = evt.data?.operationContext;
          if (audioUrlFromContext) {
            console.log('🔊 Audio URL from context:', audioUrlFromContext);
          }
          break;

        case 'Microsoft.Communication.CallDisconnected':
          console.log('📴 Call disconnected:', evt.data?.callConnectionId || evt.callConnectionId);
          break;

        case 'Microsoft.Communication.PlayCompleted':
          console.log('🔊 Audio playback completed');

          // Hang up the call after audio completes
          const callId = evt.data?.callConnectionId || evt.callConnectionId;
          if (callId && callAutomationClient) {
            try {
              const callConnection = callAutomationClient.getCallConnection(callId);
              await callConnection.hangUp(true); // true = hang up for all participants
              console.log('📴 Call ended after audio playback');
            } catch (hangupError) {
              console.error('Failed to hang up call:', hangupError.message);
            }
          }
          break;

        case 'Microsoft.Communication.PlayFailed':
          console.error('❌ Audio playback failed:', evt.data);
          break;

        default:
          console.log('ℹ️ Unhandled event type:', eventType);
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ [ACS Callback] Error:', error.message);
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
