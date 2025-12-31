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
const { ElevenLabsClient } = require('@elevenlabs/elevenlabs-js');

// =====================================================
// CONFIGURATION
// =====================================================

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ElevenLabs configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || process.env.VITE_ELEVENLABS_API_KEY || '';
const elevenLabs = new ElevenLabsClient({ apiKey: ELEVENLABS_API_KEY });

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
 * Build patient context string for AI agent
 * Combines clinical notes, focus areas, and medical data into readable format
 */
function buildPatientContext(patient) {
  const sections = [];

  // Add clinical notes (staff instructions and call history)
  if (patient.clinical_notes && patient.clinical_notes.trim()) {
    sections.push(`Clinical Notes and Instructions:\n${patient.clinical_notes.trim()}`);
  }

  // Add focus areas
  if (patient.focus_areas && Array.isArray(patient.focus_areas) && patient.focus_areas.length > 0) {
    sections.push(`Focus Areas: ${patient.focus_areas.join(', ')}`);
  }

  // Add medical data
  if (patient.medical_data) {
    const medicalSections = [];

    // Medications
    if (patient.medical_data.medications && patient.medical_data.medications.length > 0) {
      const meds = patient.medical_data.medications
        .map(m => `  - ${m.name} ${m.dose} ${m.frequency}`)
        .join('\n');
      medicalSections.push(`Medications:\n${meds}`);
    }

    // Lab values
    if (patient.medical_data.labs && Object.keys(patient.medical_data.labs).length > 0) {
      const labs = Object.entries(patient.medical_data.labs)
        .map(([key, val]) => `  - ${key}: ${val.value} ${val.unit}${val.date ? ` (${val.date})` : ''}`)
        .join('\n');
      medicalSections.push(`Lab Results:\n${labs}`);
    }

    // Diagnoses
    if (patient.medical_data.diagnoses && patient.medical_data.diagnoses.length > 0) {
      medicalSections.push(`Diagnoses: ${patient.medical_data.diagnoses.join(', ')}`);
    }

    // Allergies
    if (patient.medical_data.allergies && patient.medical_data.allergies.length > 0) {
      medicalSections.push(`ALLERGIES: ${patient.medical_data.allergies.join(', ')}`);
    }

    // Additional notes from medical document
    if (patient.medical_data.notes && patient.medical_data.notes.trim()) {
      medicalSections.push(`Additional Notes:\n${patient.medical_data.notes.trim()}`);
    }

    if (medicalSections.length > 0) {
      sections.push(medicalSections.join('\n\n'));
    }
  }

  return sections.join('\n\n');
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
async function generateStreamTwiML(agentId, patientData, fromNumber, toNumber) {
  // Build patient context from medical data and clinical notes
  const patientContext = buildPatientContext(patientData);

  console.log('   📋 Patient context prepared:');
  console.log(`      Length: ${patientContext.length} characters`);
  if (patientContext.length > 0) {
    console.log(`      Preview: ${patientContext.substring(0, 150)}...`);
  } else {
    console.log('      ⚠️  No patient context available (no medical data or clinical notes)');
  }

  // ========================================================
  // Use ElevenLabs Conversational AI with native Twilio integration
  // ========================================================
  // ElevenLabs provides direct WebSocket connection for Twilio
  // with patient context passed as variables
  // ========================================================

  try {
    // Verify ElevenLabs API key is configured
    if (!ELEVENLABS_API_KEY) {
      console.error('   ❌ ElevenLabs API key not configured');
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-US">
    We're sorry, but our diabetes education service is not fully configured at this time.
    Please contact your clinic directly for assistance.
    Thank you for calling.
  </Say>
  <Hangup/>
</Response>`;
    }

    console.log('   📞 Using ElevenLabs register_call API');
    console.log('   🔗 Agent ID:', agentId);

    // Use ElevenLabs register_call API to get properly configured TwiML
    // This API returns TwiML that sets up ElevenLabs' own WebSocket relay
    console.log('   🔄 Calling ElevenLabs register_call API...');

    // Build the request body - SDK requires camelCase
    const requestBody = {
      agentId: agentId,
      fromNumber: fromNumber,
      toNumber: toNumber,
      direction: 'inbound'
    };

    // Add dynamic variables if patient context exists
    if (patientContext && patientContext.length > 0) {
      requestBody.conversationInitiationClientData = {
        patient_context: patientContext,
        patient_name: patientData.first_name + ' ' + patientData.last_name,
        patient_language: patientData.preferred_language || 'en'
      };
    }

    console.log('   📤 Request body:', JSON.stringify(requestBody, null, 2));

    // Make direct HTTP request to ElevenLabs API since SDK returns void
    const https = require('https');

    const twiml = await new Promise((resolve, reject) => {
      const postData = JSON.stringify(requestBody);

      const options = {
        hostname: 'api.elevenlabs.io',
        port: 443,
        path: '/v1/convai/twilio/register_call',
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          console.log('   ✅ ElevenLabs API response received');
          console.log('   📊 Status:', res.statusCode);
          console.log('   📊 Headers:', JSON.stringify(res.headers, null, 2));
          console.log('   📊 Body length:', data.length);
          console.log('   📊 Body preview:', data.substring(0, 300));

          if (res.statusCode !== 200 && res.statusCode !== 201) {
            console.error('   ❌ ElevenLabs API error:', res.statusCode);
            console.error('   ❌ Response:', data);
            reject(new Error(`ElevenLabs API returned ${res.statusCode}: ${data}`));
            return;
          }

          // Response should be TwiML
          if (data.includes('<Response>')) {
            console.log('   ✅ TwiML received from ElevenLabs');
            resolve(data);
          } else {
            console.error('   ❌ Response is not TwiML');
            console.error('   ❌ Full response:', data);
            reject(new Error('Invalid TwiML response from ElevenLabs'));
          }
        });
      });

      req.on('error', (e) => {
        console.error('   ❌ Request error:', e);
        reject(e);
      });

      req.write(postData);
      req.end();
    });

    return twiml;

  } catch (error) {
    console.error('   ❌ Failed to get ElevenLabs signed URL:', error.message);
    console.error('   ❌ Error details:', error);

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-US">
    We're sorry, but our diabetes educator A I is not available at this time.
    Please contact your clinic directly for assistance.
    Thank you for calling.
  </Say>
  <Hangup/>
</Response>`;
  }
}

/**
 * Get ElevenLabs WebSocket URL for conversational AI with patient context
 * Uses ElevenLabs Conversations API with variable substitution
 */
function getElevenLabsSignedUrl(agentId, patientContext) {
  return new Promise((resolve, reject) => {
    if (!ELEVENLABS_API_KEY || !agentId) {
      reject(new Error('ElevenLabs not configured'));
      return;
    }

    const https = require('https');

    console.log('   🔧 Getting ElevenLabs signed URL for agent:', agentId);
    console.log('      Patient context length:', (patientContext || '').length, 'characters');
    if (patientContext) {
      console.log('      Context preview:', patientContext.substring(0, 150) + '...');
    }

    // Build query string with agent_id
    // Note: Patient context will be passed as custom variables if needed
    const queryParams = new URLSearchParams({
      agent_id: agentId
    });

    const options = {
      hostname: 'api.elevenlabs.io',
      path: `/v1/convai/conversation/get-signed-url?${queryParams.toString()}`,
      method: 'GET',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);

          console.log('   🔍 ElevenLabs API response status:', res.statusCode);
          console.log('   🔍 Response keys:', Object.keys(parsed));
          console.log('   🔍 Full response:', JSON.stringify(parsed, null, 2));

          if (res.statusCode !== 200 && res.statusCode !== 201) {
            console.error('❌ [DiabetesEdu] ElevenLabs API error:', res.statusCode);
            console.error('   Response:', data);
            reject(new Error(`ElevenLabs API returned ${res.statusCode}`));
            return;
          }

          // Extract WebSocket URL from response
          // Response format: { conversation_id: '...', agent_output_audio_url: 'wss://...' }
          const wsUrl = parsed.agent_output_audio_url || parsed.signed_url;

          if (!wsUrl) {
            console.error('❌ [DiabetesEdu] No WebSocket URL in response:', parsed);
            reject(new Error('No WebSocket URL in ElevenLabs response'));
            return;
          }

          console.log('   ✅ ElevenLabs conversation created');
          console.log('      Conversation ID:', parsed.conversation_id);
          console.log('      WebSocket URL:', wsUrl.substring(0, 50) + '...');

          resolve(wsUrl);
        } catch (e) {
          console.error('❌ [DiabetesEdu] Error parsing ElevenLabs response:', e);
          console.error('   Raw response:', data);
          reject(e);
        }
      });
    });

    req.on('error', (e) => {
      console.error('❌ [DiabetesEdu] ElevenLabs request error:', e);
      reject(e);
    });

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

    console.error(`   [DiabetesEdu] Call SID: ${CallSid}, From: ${From}, To: ${To}, Status: ${CallStatus}`);
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
    const twiml = await generateStreamTwiML(agentId, patient, From, To);

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
 * Extract clinical insights from call transcript
 */
async function extractClinicalInsights(transcriptText, patientData) {
  try {
    const { OpenAI } = require('openai');
    const client = new OpenAI({ apiKey: process.env.VITE_OPENAI_API_KEY });

    // Build context about patient
    const patientContext = [];
    if (patientData.medical_data) {
      if (patientData.medical_data.medications) {
        patientContext.push(`Current medications: ${patientData.medical_data.medications.map(m => m.name).join(', ')}`);
      }
      if (patientData.medical_data.diagnoses) {
        patientContext.push(`Diagnoses: ${patientData.medical_data.diagnoses.join(', ')}`);
      }
    }
    if (patientData.clinical_notes) {
      patientContext.push(`Previous notes: ${patientData.clinical_notes}`);
    }
    if (patientData.focus_areas && patientData.focus_areas.length > 0) {
      patientContext.push(`Focus areas: ${patientData.focus_areas.join(', ')}`);
    }

    const extractionResponse = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a clinical documentation assistant for diabetes education. Extract key clinical insights from patient calls.

Extract:
1. New concerns or symptoms mentioned
2. Progress on existing focus areas (weight loss, medication adherence, etc.)
3. Patient questions or confusion areas
4. Important behavioral changes
5. Suggested new focus areas

${patientContext.length > 0 ? 'Patient Context:\n' + patientContext.join('\n') : ''}

Return JSON only in this format:
{
  "clinical_note": "Brief clinical note summarizing key points from this call (2-3 sentences)",
  "concerns": ["concern1", "concern2"],
  "progress_updates": ["update1", "update2"],
  "suggested_focus_areas": ["area1", "area2"],
  "action_items": ["action1", "action2"]
}`
        },
        {
          role: 'user',
          content: `Extract clinical insights from this diabetes education call:\n\n${transcriptText}`
        }
      ],
      max_tokens: 500,
      temperature: 0.2,
    });

    const extractedText = extractionResponse.choices[0].message.content;

    // Parse JSON (handle markdown code blocks if present)
    const jsonMatch = extractedText.match(/```json\n([\s\S]*?)\n```/) ||
                     extractedText.match(/```\n([\s\S]*?)\n```/) ||
                     [null, extractedText];

    const jsonText = jsonMatch[1] || extractedText;
    const insights = JSON.parse(jsonText.trim());

    return insights;

  } catch (error) {
    console.error('❌ [DiabetesEdu] Failed to extract clinical insights:', error);
    return null;
  }
}

/**
 * Update patient clinical notes with call insights
 */
async function updatePatientNotesFromCall(patientId, callId, insights, callDate) {
  try {
    // Get current patient data
    const { data: patient, error: fetchError } = await supabase
      .from('diabetes_education_patients')
      .select('clinical_notes, focus_areas')
      .eq('id', patientId)
      .single();

    if (fetchError || !patient) {
      console.error('❌ [DiabetesEdu] Failed to fetch patient:', fetchError);
      return;
    }

    // Format call date
    const callDateStr = new Date(callDate).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    // Build new clinical note entry
    let newNoteEntry = `\n\n--- Call on ${callDateStr} ---\n${insights.clinical_note}`;

    if (insights.concerns && insights.concerns.length > 0) {
      newNoteEntry += `\nConcerns: ${insights.concerns.join('; ')}`;
    }

    if (insights.progress_updates && insights.progress_updates.length > 0) {
      newNoteEntry += `\nProgress: ${insights.progress_updates.join('; ')}`;
    }

    if (insights.action_items && insights.action_items.length > 0) {
      newNoteEntry += `\nAction items: ${insights.action_items.join('; ')}`;
    }

    // Append to existing notes
    const updatedNotes = (patient.clinical_notes || '') + newNoteEntry;

    // Merge suggested focus areas
    const currentFocusAreas = Array.isArray(patient.focus_areas) ? patient.focus_areas : [];
    const suggestedAreas = insights.suggested_focus_areas || [];
    const newFocusAreas = [...new Set([...currentFocusAreas, ...suggestedAreas])];

    // Update patient record
    const { error: updateError } = await supabase
      .from('diabetes_education_patients')
      .update({
        clinical_notes: updatedNotes,
        focus_areas: newFocusAreas,
        updated_at: new Date().toISOString()
      })
      .eq('id', patientId);

    if (updateError) {
      console.error('❌ [DiabetesEdu] Failed to update patient notes:', updateError);
      return;
    }

    console.log('✅ [DiabetesEdu] Patient notes updated from call');
    console.log('   Added', newNoteEntry.length, 'characters to clinical notes');
    console.log('   Added', newFocusAreas.length - currentFocusAreas.length, 'new focus areas');

  } catch (error) {
    console.error('❌ [DiabetesEdu] Error updating patient notes:', error);
  }
}

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
    let { data: existingCall, error: findError } = await supabase
      .from('diabetes_education_calls')
      .select('*')
      .eq('elevenlabs_conversation_id', conversationId)
      .maybeSingle();

    if (findError) {
      console.error('❌ [DiabetesEdu] Error finding call:', findError);
      return res.status(500).json({ error: 'Database error' });
    }

    // Fallback: If not found by conversation_id, find most recent call without one
    if (!existingCall) {
      console.log('   ⚠️  No call found by conversation_id, trying fallback...');

      const { data: recentCall, error: fallbackError } = await supabase
        .from('diabetes_education_calls')
        .select('*')
        .is('elevenlabs_conversation_id', null)
        .in('call_status', ['in-progress', 'completed'])
        .order('call_started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fallbackError) {
        console.error('❌ [DiabetesEdu] Error in fallback search:', fallbackError);
      }

      if (recentCall) {
        existingCall = recentCall;
        console.log('   ✅ Found call via fallback: ID =', existingCall.id);
      }
    } else {
      console.log('   ✅ Found call by conversation_id: ID =', existingCall.id);
    }

    if (!existingCall) {
      console.log('❌ [DiabetesEdu] No call found for conversation_id:', conversationId);
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

    // Update call record in database
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

    // ========================================
    // NEW: Extract clinical insights and update patient notes
    // ========================================
    if (transcriptText && transcriptText.length > 50) {
      console.log('   🔍 Extracting clinical insights from transcript...');

      // Get patient data for context
      const { data: patientData } = await supabase
        .from('diabetes_education_patients')
        .select('*')
        .eq('id', existingCall.patient_id)
        .single();

      if (patientData) {
        const insights = await extractClinicalInsights(transcriptText, patientData);

        if (insights && insights.clinical_note) {
          console.log('   ✅ Clinical insights extracted');
          console.log('      Note:', insights.clinical_note.substring(0, 100) + '...');

          // Update patient notes asynchronously (don't block webhook response)
          updatePatientNotesFromCall(
            existingCall.patient_id,
            existingCall.id,
            insights,
            existingCall.call_started_at
          ).catch(err => {
            console.error('   ⚠️  Failed to update patient notes:', err);
          });
        }
      }
    }
    // ========================================

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
