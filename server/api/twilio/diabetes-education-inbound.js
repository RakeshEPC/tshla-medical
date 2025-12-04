/**
 * Twilio Inbound Call Handler - Diabetes Education
 * Handles incoming calls to the diabetes education line
 * - Authenticates caller by phone number
 * - Routes to appropriate language-specific ElevenLabs agent
 * - Passes patient medical data as context
 * - Enforces 10-minute call limit
 * Created: 2025-12-03
 */

const { createClient } = require('@supabase/supabase-js');

// =====================================================
// CONFIGURATION
// =====================================================

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ElevenLabs configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || process.env.VITE_ELEVENLABS_API_KEY || '';

// ElevenLabs Agent IDs by language
const AGENT_IDS = {
  'en': process.env.ELEVENLABS_DIABETES_AGENT_EN || '',
  'es': process.env.ELEVENLABS_DIABETES_AGENT_ES || '',
  'fr': process.env.ELEVENLABS_DIABETES_AGENT_FR || '',
};

// Twilio configuration
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const API_BASE_URL = process.env.API_BASE_URL || process.env.VITE_API_BASE_URL || 'http://localhost:3000';

// Call duration limit: 10 minutes = 600 seconds
const MAX_CALL_DURATION_SECONDS = 600;

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Format phone number to E.164 for database lookup
 */
function formatPhoneNumber(phone) {
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  return phone.startsWith('+') ? phone : `+${digits}`;
}

/**
 * Generate TwiML for unauthenticated caller
 */
function generateRejectionTwiML() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-US">
    Sorry, your phone number is not registered in our diabetes education system.
    Please contact your clinic to enroll in this service.
    Thank you for calling.
  </Say>
  <Hangup/>
</Response>`;
}

/**
 * Generate TwiML for authenticated caller with WebSocket stream to ElevenLabs bridge
 */
function generateStreamTwiML(agentId, patientData) {
  // Bridge URL with agent ID as query parameter
  const bridgeUrl = `${API_BASE_URL.replace('http', 'ws')}/ws/elevenlabs-diabetes?agentId=${agentId}&patientName=${encodeURIComponent(patientData.first_name)}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="${patientData.preferred_language === 'es' ? 'es-MX' : 'en-US'}">
    Connecting you to your diabetes educator. Please wait.
  </Say>
  <Connect>
    <Stream url="${bridgeUrl}"/>
  </Connect>
  <Say voice="alice">
    Thank you for calling. Goodbye.
  </Say>
</Response>`;
}

// =====================================================
// MAIN HANDLER
// =====================================================

/**
 * Handle inbound Twilio call
 * POST /api/twilio/diabetes-education-inbound
 */
async function handler(req, res) {
  console.log('\n📞 [DiabetesEdu] Incoming call received');

  try {
    // Extract caller information from Twilio webhook
    const {
      CallSid,
      From,
      To,
      CallStatus,
    } = req.body;

    console.log(`   Call SID: ${CallSid}`);
    console.log(`   From: ${From}`);
    console.log(`   To: ${To}`);
    console.log(`   Status: ${CallStatus}`);

    if (!From) {
      console.error('❌ [DiabetesEdu] Missing caller phone number');
      res.type('text/xml');
      return res.send(generateRejectionTwiML());
    }

    // Format phone number for database lookup
    const formattedPhone = formatPhoneNumber(From);
    console.log(`   Formatted phone: ${formattedPhone}`);

    // Lookup patient by phone number
    const { data: patient, error: lookupError } = await supabase
      .from('diabetes_education_patients')
      .select('*')
      .eq('phone_number', formattedPhone)
      .eq('is_active', true)
      .single();

    if (lookupError || !patient) {
      console.log('❌ [DiabetesEdu] Patient not found or inactive');
      console.log('   Phone number not registered:', formattedPhone);

      res.type('text/xml');
      return res.send(generateRejectionTwiML());
    }

    console.log('✅ [DiabetesEdu] Patient authenticated');
    console.log(`   Patient: ${patient.first_name} ${patient.last_name}`);
    console.log(`   Language: ${patient.preferred_language}`);
    console.log(`   Has medical data: ${patient.medical_data ? 'Yes' : 'No'}`);

    // Check if agent exists for patient's language
    const agentId = AGENT_IDS[patient.preferred_language] || AGENT_IDS['en'];
    if (!agentId) {
      console.error('❌ [DiabetesEdu] No ElevenLabs agent configured!');
      const errorTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">
    We're sorry, but the diabetes education service is not configured.
    Please contact your clinic for assistance.
  </Say>
  <Hangup/>
</Response>`;
      res.type('text/xml');
      return res.send(errorTwiML);
    }

    console.log(`   Using ElevenLabs agent: ${agentId}`);

    // Log call start in database
    try {
      const { data: callLog, error: logError } = await supabase
        .from('diabetes_education_calls')
        .insert({
          patient_id: patient.id,
          twilio_call_sid: CallSid,
          language: patient.preferred_language,
          caller_phone_number: From,
          call_status: 'in-progress',
        })
        .select()
        .single();

      if (logError) {
        console.error('❌ [DiabetesEdu] Failed to log call:', logError);
      } else {
        console.log('✅ [DiabetesEdu] Call logged with ID:', callLog.id);
      }
    } catch (logError) {
      console.error('❌ [DiabetesEdu] Error logging call:', logError);
    }

    // Generate TwiML to connect call to ElevenLabs agent via bridge
    const twiml = generateStreamTwiML(agentId, patient);

    console.log('✅ [DiabetesEdu] Connecting call to AI agent');
    console.log(`   Max duration: ${MAX_CALL_DURATION_SECONDS} seconds (10 minutes)`);

    res.type('text/xml');
    return res.send(twiml);

  } catch (error) {
    console.error('❌ [DiabetesEdu] Error handling inbound call:', error);

    // Return error TwiML
    const errorTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">
    We're sorry, but we're experiencing technical difficulties.
    Please try again later or contact your clinic directly.
  </Say>
  <Hangup/>
</Response>`;

    res.type('text/xml');
    return res.send(errorTwiML);
  }
}

// =====================================================
// CALL STATUS WEBHOOK
// =====================================================

/**
 * Handle call status updates from Twilio
 * POST /api/twilio/diabetes-education-status
 */
async function handleCallStatus(req, res) {
  console.log('\n📊 [DiabetesEdu] Call status update received');

  try {
    const {
      CallSid,
      CallStatus,
      CallDuration,
      RecordingUrl,
    } = req.body;

    console.log(`   Call SID: ${CallSid}`);
    console.log(`   Status: ${CallStatus}`);
    console.log(`   Duration: ${CallDuration} seconds`);

    // Update call record in database
    if (CallStatus === 'completed' || CallStatus === 'failed' || CallStatus === 'no-answer' || CallStatus === 'busy') {
      const updates = {
        call_ended_at: new Date().toISOString(),
        call_status: CallStatus,
      };

      if (CallDuration) {
        updates.duration_seconds = parseInt(CallDuration, 10);

        // Determine disconnect reason
        const duration = parseInt(CallDuration, 10);
        if (duration >= MAX_CALL_DURATION_SECONDS - 5) {
          updates.disconnect_reason = 'timeout-10min';
        } else if (CallStatus === 'completed') {
          updates.disconnect_reason = 'caller-hangup';
        } else {
          updates.disconnect_reason = CallStatus;
        }
      }

      const { error: updateError } = await supabase
        .from('diabetes_education_calls')
        .update(updates)
        .eq('twilio_call_sid', CallSid);

      if (updateError) {
        console.error('❌ [DiabetesEdu] Failed to update call:', updateError);
      } else {
        console.log('✅ [DiabetesEdu] Call record updated');
      }
    }

    res.sendStatus(200);

  } catch (error) {
    console.error('❌ [DiabetesEdu] Error handling call status:', error);
    res.sendStatus(500);
  }
}

// =====================================================
// CALL END WEBHOOK (FOR TRANSCRIPT)
// =====================================================

/**
 * Handle call end - receive transcript from ElevenLabs
 * POST /api/twilio/diabetes-education-complete
 */
async function handleCallComplete(req, res) {
  console.log('\n🎬 [DiabetesEdu] Call completed - processing transcript');

  try {
    const {
      callSid,
      transcript,
      conversationId,
      topics,
    } = req.body;

    if (!callSid) {
      return res.status(400).json({ error: 'Missing callSid' });
    }

    const updates = {
      transcript: transcript || null,
      elevenlabs_conversation_id: conversationId || null,
    };

    if (topics && Array.isArray(topics)) {
      updates.topics_discussed = topics;
    }

    // Generate AI summary of conversation if transcript exists
    if (transcript && transcript.length > 50) {
      try {
        // Use OpenAI to summarize the call
        const { OpenAI } = require('openai');
        const client = new OpenAI({ apiKey: process.env.VITE_OPENAI_API_KEY });

        const summaryResponse = await client.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a medical AI assistant. Summarize this diabetes education call in 2-3 sentences. Focus on key topics discussed and patient concerns.'
            },
            {
              role: 'user',
              content: `Summarize this call transcript:\n\n${transcript}`
            }
          ],
          max_tokens: 150,
          temperature: 0.3,
        });

        const summary = summaryResponse.choices[0].message.content;
        updates.summary = summary;

        console.log('✅ [DiabetesEdu] Generated call summary');

      } catch (summaryError) {
        console.error('❌ [DiabetesEdu] Failed to generate summary:', summaryError);
      }
    }

    // Update database
    const { error: updateError } = await supabase
      .from('diabetes_education_calls')
      .update(updates)
      .eq('twilio_call_sid', callSid);

    if (updateError) {
      console.error('❌ [DiabetesEdu] Failed to update call with transcript:', updateError);
      return res.status(500).json({ error: 'Failed to update call' });
    }

    console.log('✅ [DiabetesEdu] Call completed and logged successfully');

    res.json({ success: true });

  } catch (error) {
    console.error('❌ [DiabetesEdu] Error handling call completion:', error);
    res.status(500).json({ error: 'Failed to process call completion' });
  }
}

module.exports = {
  default: handler,
  handleCallStatus,
  handleCallComplete
};
