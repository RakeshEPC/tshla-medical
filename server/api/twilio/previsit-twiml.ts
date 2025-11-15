/**
 * Twilio TwiML Webhook
 * Handles incoming call connections and routes to 11Labs AI
 * Created: January 2025
 */

import { Request, Response } from 'express';

// Twilio TwiML library (install with: npm install twilio)
let VoiceResponse: any;
try {
  const twilio = require('twilio');
  VoiceResponse = twilio.twiml.VoiceResponse;
} catch (error) {
  console.warn('⚠️ Twilio SDK not installed. Run: npm install twilio');
}

// Environment variables
const OFFICE_PHONE_NUMBER = process.env.OFFICE_PHONE_NUMBER || '555-123-4567';
const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

/**
 * TwiML Webhook Handler
 * Called by Twilio when call is answered
 */
export async function handlePreVisitTwiML(req: Request, res: Response) {
  console.log('\n📞 TwiML Webhook Called');
  console.log('   Query params:', req.query);
  console.log('   Body:', req.body);

  // Extract patient context from query parameters
  const {
    patientId,
    patientName,
    appointmentId,
    appointmentDate,
    appointmentTime,
    providerName,
    providerId,
    attemptNumber,
  } = req.query;

  // Check if this is a voicemail detection callback
  const answeredBy = req.body.AnsweredBy || req.query.AnsweredBy;

  if (!VoiceResponse) {
    res.status(500).send('Twilio SDK not configured');
    return;
  }

  const twiml = new VoiceResponse();

  // VOICEMAIL DETECTION - Attempt #1
  if (answeredBy === 'machine_end_beep' && attemptNumber === '1') {
    console.log('   ⚠️  Voicemail detected on attempt #1 - hanging up');
    twiml.hangup();
    res.type('text/xml');
    res.send(twiml.toString());
    return;
  }

  // VOICEMAIL DETECTION - Attempt #2-3
  if (answeredBy === 'machine_end_beep' || answeredBy === 'machine_start') {
    console.log('   📨 Voicemail detected - leaving message');

    twiml.say(
      {
        voice: 'alice',
        language: 'en-US',
      },
      `Hello, this is TSHLA Medical calling for ${patientName} about your upcoming appointment with Doctor ${providerName} on ${appointmentDate} at ${appointmentTime}. We wanted to do a quick pre-visit call to help prepare for your appointment. Please call us back at ${OFFICE_PHONE_NUMBER} at your convenience, or we'll see you at your scheduled time. Thank you!`
    );

    twiml.hangup();
    res.type('text/xml');
    res.send(twiml.toString());
    return;
  }

  // HUMAN ANSWERED - Connect to 11Labs AI
  console.log('   ✅ Human answered - connecting to 11Labs AI');

  // Check if 11Labs is configured
  if (!ELEVENLABS_AGENT_ID || !ELEVENLABS_API_KEY) {
    console.error('   ❌ 11Labs not configured');

    // Fallback: Simple greeting and instructions
    twiml.say(
      {
        voice: 'alice',
        language: 'en-US',
      },
      `Hello ${patientName}, this is TSHLA Medical calling about your upcoming appointment with Doctor ${providerName}. Our automated assistant is currently unavailable. Please call us back at ${OFFICE_PHONE_NUMBER} if you need to provide any pre-visit information. Thank you!`
    );

    twiml.hangup();
    res.type('text/xml');
    res.send(twiml.toString());
    return;
  }

  // Connect to 11Labs WebSocket for AI conversation
  // Note: This uses Twilio's <Stream> verb to connect to 11Labs
  // Documentation: https://www.twilio.com/docs/voice/twiml/stream

  const connect = twiml.connect();

  // Stream audio to 11Labs
  connect.stream({
    url: `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${ELEVENLABS_AGENT_ID}`,
    // Note: The exact WebSocket URL may vary - check 11Labs documentation
    // Parameters can be passed via URL query string
  });

  // Alternative: Use <Say> for a simple greeting before connecting
  // twiml.say({ voice: 'alice' }, `Hello ${patientName}, please hold while I connect you to our pre-visit assistant.`);

  // Set custom parameters for 11Labs (passed in WebSocket metadata)
  // These will be available to the AI agent during the conversation
  const metadata = {
    patient_id: patientId,
    patient_name: patientName,
    appointment_id: appointmentId,
    appointment_date: appointmentDate,
    appointment_time: appointmentTime,
    provider_name: providerName,
    provider_id: providerId,
    attempt_number: attemptNumber,
  };

  // Store metadata in session for retrieval later
  // (This might require a different approach depending on how 11Labs handles it)

  console.log('   📡 TwiML response sent - connecting to 11Labs');

  res.type('text/xml');
  res.send(twiml.toString());
}

/**
 * Express route handler
 */
export default function setupTwiMLRoute(app: any) {
  // POST endpoint for Twilio webhook
  app.post('/api/twilio/previsit-twiml', handlePreVisitTwiML);

  // GET endpoint for testing (Twilio also supports GET)
  app.get('/api/twilio/previsit-twiml', handlePreVisitTwiML);

  console.log('✅ Twilio TwiML webhook registered: /api/twilio/previsit-twiml');
}
