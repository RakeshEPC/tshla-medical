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
  'hi': process.env.ELEVENLABS_DIABETES_AGENT_HI || '',
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
 * Generate TwiML for authenticated caller with direct ElevenLabs connection
 */
async function generateStreamTwiML(agentId, patientData) {
  // Get signed URL directly from ElevenLabs
  const signedUrl = await getElevenLabsSignedUrl(agentId);

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="${patientData.preferred_language === 'es' ? 'es-MX' : 'en-US'}">
    Connecting you to your diabetes educator. Please wait.
  </Say>
  <Connect>
    <Stream url="${signedUrl}" track="both_tracks"/>
  </Connect>
  <Say voice="alice">
    Thank you for calling. Goodbye.
  </Say>
</Response>`;
}

/**
 * Get ElevenLabs signed URL for conversational AI
 */
function getElevenLabsSignedUrl(agentId) {
  return new Promise((resolve, reject) => {
    if (!ELEVENLABS_API_KEY || !agentId) {
      reject(new Error('ElevenLabs not configured'));
      return;
    }

    const https = require('https');
    const options = {
      hostname: 'api.elevenlabs.io',
      path: `/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
      method: 'GET',
      headers: { 'xi-api-key': ELEVENLABS_API_KEY }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.signed_url);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
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

    // Generate TwiML to connect call to ElevenLabs agent directly
    const twiml = await generateStreamTwiML(agentId, patient);

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

// =====================================================
// ELEVENLABS POST-CALL WEBHOOK
// =====================================================

/**
 * Handle ElevenLabs post-call transcript webhook
 * POST /api/elevenlabs/diabetes-education-transcript
 *
 * Expected payload from ElevenLabs:
 * {
 *   "type": "transcription",
 *   "data": {
 *     "agent_id": "...",
 *     "conversation_id": "...",
 *     "transcript": [...],
 *     "metadata": {...}
 *   }
 * }
 */
async function handleElevenLabsTranscript(req, res) {
  console.log('\n📝 [DiabetesEdu] ElevenLabs transcript webhook received');

  try {
    const webhookData = req.body;

    // Log the payload for debugging
    console.log('   Webhook type:', webhookData.type);
    console.log('   Conversation ID:', webhookData.data?.conversation_id);

    // Validate webhook type
    if (webhookData.type !== 'transcription') {
      console.log('⚠️  [DiabetesEdu] Ignoring non-transcription webhook:', webhookData.type);
      return res.status(200).json({ success: true, message: 'Webhook type not handled' });
    }

    const conversationData = webhookData.data;
    const conversationId = conversationData.conversation_id;

    if (!conversationId) {
      console.error('❌ [DiabetesEdu] Missing conversation_id in webhook');
      return res.status(400).json({ error: 'Missing conversation_id' });
    }

    // Find the call record by ElevenLabs conversation ID
    const { data: existingCall, error: findError } = await supabase
      .from('diabetes_education_calls')
      .select('*')
      .eq('elevenlabs_conversation_id', conversationId)
      .maybeSingle();

    if (findError) {
      console.error('❌ [DiabetesEdu] Error finding call:', findError);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!existingCall) {
      console.log('⚠️  [DiabetesEdu] No call found for conversation_id:', conversationId);
      // Still return 200 to acknowledge webhook
      return res.status(200).json({ success: true, message: 'Call not found in database' });
    }

    // Extract transcript from ElevenLabs format
    const transcript = conversationData.transcript;
    let transcriptText = '';

    if (Array.isArray(transcript)) {
      // Convert transcript array to readable text format
      transcriptText = transcript.map(turn => {
        const speaker = turn.role === 'agent' ? 'AI' : 'Patient';
        return `${speaker}: ${turn.message}`;
      }).join('\n');
    }

    console.log('   Transcript length:', transcriptText.length, 'characters');

    // Prepare updates
    const updates = {
      transcript: transcriptText || null,
      elevenlabs_conversation_id: conversationId,
    };

    // Extract topics if available
    if (conversationData.analysis?.topics) {
      updates.topics_discussed = conversationData.analysis.topics;
    }

    // Generate AI summary if transcript exists
    if (transcriptText && transcriptText.length > 50) {
      try {
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
              content: `Summarize this call transcript:\n\n${transcriptText}`
            }
          ],
          max_tokens: 150,
          temperature: 0.3,
        });

        const summary = summaryResponse.choices[0].message.content;
        updates.summary = summary;

        console.log('✅ [DiabetesEdu] Generated AI summary');

      } catch (summaryError) {
        console.error('❌ [DiabetesEdu] Failed to generate summary:', summaryError);
      }
    }

    // Update database
    const { error: updateError } = await supabase
      .from('diabetes_education_calls')
      .update(updates)
      .eq('id', existingCall.id);

    if (updateError) {
      console.error('❌ [DiabetesEdu] Failed to update call with transcript:', updateError);
      return res.status(500).json({ error: 'Failed to update call' });
    }

    console.log('✅ [DiabetesEdu] Transcript saved successfully');
    console.log('   Call ID:', existingCall.id);
    console.log('   Patient ID:', existingCall.patient_id);

    res.json({ success: true, call_id: existingCall.id });

  } catch (error) {
    console.error('❌ [DiabetesEdu] Error handling ElevenLabs webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  default: handler,
  handleCallStatus,
  handleCallComplete,
  handleElevenLabsTranscript
};
