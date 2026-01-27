/**
 * Echo Audio Summary API
 * Handles patient audio summary generation and Twilio phone calls
 * Endpoint: POST /api/echo/send-audio-summary
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const logger = require('../services/logger.service');

// Middleware to parse JSON bodies
router.use(express.json());

// Twilio configuration
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

// Azure OpenAI configuration for AI summary generation (HIPAA compliant)
const AZURE_OPENAI_KEY = process.env.AZURE_OPENAI_KEY;
const AZURE_OPENAI_ENDPOINT = process.env.VITE_AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_DEPLOYMENT = process.env.VITE_AZURE_OPENAI_DEPLOYMENT || 'gpt-4';
const AZURE_API_VERSION = process.env.VITE_AZURE_OPENAI_API_VERSION || '2024-02-01';

// ElevenLabs configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.VITE_ELEVENLABS_DEFAULT_VOICE_ID || 'f6qhiUOSRVGsfwvD4oSU'; // Custom voice for patient portal

// Clinic phone number for call transfers
const CLINIC_PHONE_NUMBER = process.env.CLINIC_PHONE_NUMBER || '+18325938100';

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
 * @param {string} voiceId - Optional voice ID (defaults to configured voice)
 */
async function generateAudio(text, voiceId = null) {
  const selectedVoiceId = voiceId || ELEVENLABS_VOICE_ID;

  logger.info('EchoAudio', `🔊 Generating audio with voice ID: ${selectedVoiceId}`);

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}`,
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

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Store audio files temporarily
const AUDIO_DIR = path.join(__dirname, '..', 'temp-audio');
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

// Map to store audio file paths for call replay
const audioFileMap = new Map();

/**
 * Save audio buffer to temporary file and return public URL
 * Audio files are automatically cleaned up after 1 hour
 */
function saveAudioTemporarily(audioBuffer) {
  const filename = `echo-${crypto.randomBytes(16).toString('hex')}.mp3`;
  const filepath = path.join(AUDIO_DIR, filename);

  // Write audio to file
  fs.writeFileSync(filepath, audioBuffer);

  // Schedule cleanup after 1 hour
  setTimeout(() => {
    try {
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        logger.info('EchoAudio', `🗑️ Cleaned up audio file: ${filename}`);
      }
    } catch (err) {
      logger.error('EchoAudio', `Failed to delete audio file ${filename}:`, err.message);
    }
  }, 60 * 60 * 1000); // 1 hour

  // Return public URL (assumes server is accessible)
  const baseUrl = process.env.API_BASE_URL || 'https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io';
  const publicUrl = `${baseUrl}/api/echo/audio/${filename}`;

  logger.info('EchoAudio', `💾 Saved audio file: ${filename}`);
  logger.info('EchoAudio', `🔗 Public URL: ${publicUrl}`);

  // Store mapping for replay functionality
  audioFileMap.set(filename, { filepath, scriptText: '' });

  return { publicUrl, filename, filepath };
}

/**
 * Make Twilio phone call with ElevenLabs audio
 * Falls back to text-to-speech if audio upload fails
 */
async function makePhoneCall(phoneNumber, audioBuffer, scriptText, audioUrl = null) {
  // Generate TwiML based on whether we have audio URL
  let twiml;

  if (audioUrl) {
    // Use ElevenLabs audio with <Play>
    logger.info('EchoAudio', `📞 Using ElevenLabs audio from: ${audioUrl}`);
    twiml = `
      <Response>
        <Play>${audioUrl}</Play>
        <Gather numDigits="1" action="/api/echo/handle-call-input">
          <Say>Press 1 to hear this message again, or press 2 to speak with someone at the office.</Say>
        </Gather>
        <Hangup/>
      </Response>
    `;
  } else {
    // Fallback to Twilio TTS
    logger.info('EchoAudio', '⚠️ No audio URL available, falling back to Twilio TTS');
    twiml = `
      <Response>
        <Say voice="Polly.Joanna">${scriptText}</Say>
        <Gather numDigits="1" action="/api/echo/handle-call-input">
          <Say>Press 1 to hear this message again, or press 2 to speak with someone at the office.</Say>
        </Gather>
        <Hangup/>
      </Response>
    `;
  }

  const call = await twilioClient.calls.create({
    from: TWILIO_PHONE_NUMBER,
    to: phoneNumber,
    twiml: twiml
  });

  return {
    callSid: call.sid,
    status: call.status,
    usingElevenLabs: !!audioUrl
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
    logger.info('EchoAudio', '   Azure OpenAI endpoint:', AZURE_OPENAI_ENDPOINT);
    logger.info('EchoAudio', '   Azure OpenAI deployment:', AZURE_OPENAI_DEPLOYMENT);
    logger.info('EchoAudio', '   Azure OpenAI API key configured:', !!AZURE_OPENAI_KEY);

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
    logger.error('EchoAudio', '   Stack trace:', error.stack);

    // Provide helpful error messages
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
 * Generate AI summary, create audio, and call patient
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

    logger.info('EchoAudio', '🎙️ [Echo Audio Summary] Starting process...');
    logger.info('EchoAudio', `   Patient: ${patientName || 'Unknown'}`);
    logger.info('EchoAudio', `   Phone: ${phoneNumber}`);
    logger.info('EchoAudio', `   SOAP length: ${soapNote.length} chars`);

    // Step 1: Generate AI summary
    logger.info('EchoAudio', '📝 Generating AI summary...');
    const summary = await generatePatientSummary(soapNote, patientName);
    logger.info('EchoAudio', `✅ Summary generated: ${summary.wordCount} words, ~${summary.estimatedSeconds}s`);

    // Step 2: Generate audio (ElevenLabs)
    logger.info('EchoAudio', '🔊 Generating audio with ElevenLabs...');
    const audioBuffer = await generateAudio(summary.script, voiceId);
    logger.info('EchoAudio', `✅ Audio generated: ${(audioBuffer.length / 1024).toFixed(1)} KB`);

    // Step 3: Make Twilio call
    logger.info('EchoAudio', `📞 Calling patient at ${phoneNumber}...`);
    const callResult = await makePhoneCall(phoneNumber, audioBuffer, summary.script);
    logger.info('EchoAudio', `✅ Call initiated: ${callResult.callSid}`);

    // Return success response
    res.json({
      success: true,
      data: {
        script: summary.script,
        wordCount: summary.wordCount,
        estimatedSeconds: summary.estimatedSeconds,
        callSid: callResult.callSid,
        callStatus: callResult.status,
        phoneNumber: phoneNumber
      }
    });

  } catch (error) {
    logger.error('EchoAudio', '❌ [Echo Audio Summary] Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/echo/send-sms-summary
 * Generate AI summary and send via SMS text message
 */
router.post('/send-sms-summary', async (req, res) => {
  try {
    const { soapNote, phoneNumber, patientName } = req.body;

    // Validation
    if (!soapNote || !phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: soapNote and phoneNumber'
      });
    }

    logger.info('EchoAudio', '📱 [Echo SMS Summary] Starting process...');
    logger.info('EchoAudio', `   Patient: ${patientName || 'Unknown'}`);
    logger.info('EchoAudio', `   Phone: ${phoneNumber}`);

    // Step 1: Generate AI summary
    logger.info('EchoAudio', '📝 Generating AI summary...');
    const summary = await generatePatientSummary(soapNote, patientName);
    logger.info('EchoAudio', `✅ Summary generated: ${summary.wordCount} words`);

    // Step 2: Format for SMS (keep under 1600 chars for multi-part SMS)
    let smsText = summary.script;

    // If too long, truncate intelligently
    if (smsText.length > 1500) {
      const sentences = smsText.split('. ');
      smsText = '';
      for (const sentence of sentences) {
        if ((smsText + sentence + '. ').length > 1500) break;
        smsText += sentence + '. ';
      }
      smsText += '\n\n(Full summary available in patient portal)';
    }

    logger.info('EchoAudio', `📱 SMS length: ${smsText.length} characters`);

    // Step 3: Send SMS via Twilio
    logger.info('EchoAudio', `📤 Sending SMS to ${phoneNumber}...`);
    const message = await twilioClient.messages.create({
      from: TWILIO_PHONE_NUMBER,
      to: phoneNumber,
      body: smsText
    });

    logger.info('EchoAudio', `✅ SMS sent: ${message.sid}`);

    // Return success response
    res.json({
      success: true,
      data: {
        messageSid: message.sid,
        status: message.status,
        smsText: smsText,
        characterCount: smsText.length,
        phoneNumber: phoneNumber
      }
    });

  } catch (error) {
    logger.error('EchoAudio', '❌ [Echo SMS Summary] Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/echo/handle-call-input
 * Handle DTMF input during call (1 = replay, 2 = speak to someone)
 */
router.post('/handle-call-input', (req, res) => {
  const { Digits } = req.body;

  let twiml = '<Response>';

  if (Digits === '1') {
    // Replay the message
    twiml += '<Say>Let me replay that for you.</Say>';
    twiml += '<Redirect>/api/echo/send-audio-summary</Redirect>';
  } else if (Digits === '2') {
    // Transfer to clinic
    logger.info('EchoAudio', `📞 Patient pressed 2 - transferring to clinic at ${CLINIC_PHONE_NUMBER}`);
    twiml += '<Say>Connecting you to the clinic now. Please hold.</Say>';
    twiml += `<Dial timeout="30" callerId="${TWILIO_PHONE_NUMBER}">`;
    twiml += `<Number>${CLINIC_PHONE_NUMBER}</Number>`;
    twiml += '</Dial>';
    twiml += '<Say>Sorry, the clinic is not available right now. Please call back during business hours. Goodbye.</Say>';
    twiml += '<Hangup/>';
  } else {
    twiml += '<Say>Sorry, I didn\'t understand that. Goodbye.</Say>';
    twiml += '<Hangup/>';
  }

  twiml += '</Response>';

  res.type('text/xml');
  res.send(twiml);
});

/**
 * GET /api/echo/call-status/:callSid
 * Check status of a Twilio call
 */
router.get('/call-status/:callSid', async (req, res) => {
  try {
    const { callSid } = req.params;
    const call = await twilioClient.calls(callSid).fetch();

    res.json({
      success: true,
      status: call.status,
      duration: call.duration,
      direction: call.direction,
      from: call.from,
      to: call.to
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
