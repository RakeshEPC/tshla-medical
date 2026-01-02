/**
 * OpenAI Realtime API WebSocket Relay Server
 *
 * Purpose: Bridge between Twilio Media Streams and OpenAI Realtime API
 * for diabetes education voice AI with dynamic patient context injection
 *
 * Flow:
 * 1. Twilio calls webhook → connects to this WebSocket endpoint
 * 2. Fetch patient data by caller phone number
 * 3. Build patient context (clinical notes + medical data)
 * 4. Connect to OpenAI Realtime API with context in system instructions
 * 5. Relay audio bidirectionally: Twilio ↔ OpenAI
 * 6. Log transcripts and events
 *
 * Created: 2025-12-29
 */

const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');

// Environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VOICE = process.env.OPENAI_REALTIME_VOICE || 'alloy'; // Options: alloy, echo, fable, onyx, nova, shimmer

// Validate required environment variables (warnings only, don't crash)
if (!OPENAI_API_KEY) {
  console.warn('⚠️  [Realtime] Missing OPENAI_API_KEY environment variable');
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.warn('⚠️  [Realtime] Missing Supabase environment variables');
}

// Initialize Supabase client lazily (only if credentials exist)
let supabase = null;
function getSupabase() {
  if (!supabase && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  }
  return supabase;
}

/**
 * Fetch patient context by phone number
 * Reuses the same logic as diabetes-education-inbound.js
 */
async function fetchPatientContext(phoneNumber) {
  try {
    console.log(`[Realtime] Fetching patient data for: ${phoneNumber}`);

    // Query diabetes education patients table
    const supabase = getSupabase();
    if (!supabase) {
      console.error('[Realtime] Supabase not initialized');
      return {
        found: false,
        patientId: null,
        context: 'Database not available.'
      };
    }

    const { data: patient, error } = await supabase
      .from('diabetes_education_patients')
      .select('*')
      .eq('phone_number', phoneNumber)
      .eq('is_active', true)
      .single();

    if (error || !patient) {
      console.warn(`[Realtime] No patient found for ${phoneNumber}`);
      return {
        found: false,
        patientId: null,
        context: 'No patient record found for this phone number.'
      };
    }

    console.log(`[Realtime] Found patient: ${patient.first_name} ${patient.last_name} (ID: ${patient.id})`);

    // Build context string
    const sections = [];

    if (patient.clinical_notes && patient.clinical_notes.trim()) {
      sections.push(`Clinical Notes:\n${patient.clinical_notes.trim()}`);
    }

    if (patient.focus_areas && Array.isArray(patient.focus_areas) && patient.focus_areas.length > 0) {
      sections.push(`Focus Areas: ${patient.focus_areas.join(', ')}`);
    }

    if (patient.medical_data) {
      const medDataSections = [];

      // Labs
      if (patient.medical_data.labs) {
        const labStrings = [];
        const labs = patient.medical_data.labs;

        if (labs.a1c) {
          labStrings.push(`A1C: ${labs.a1c.value}${labs.a1c.unit || '%'} (${labs.a1c.date || 'recent'})`);
        }
        if (labs.glucose_fasting) {
          labStrings.push(`Fasting Glucose: ${labs.glucose_fasting.value}${labs.glucose_fasting.unit || 'mg/dL'} (${labs.glucose_fasting.date || 'recent'})`);
        }
        if (labs.creatinine) {
          labStrings.push(`Creatinine: ${labs.creatinine.value}${labs.creatinine.unit || 'mg/dL'} (${labs.creatinine.date || 'recent'})`);
        }

        if (labStrings.length > 0) {
          medDataSections.push('Lab Results:\n- ' + labStrings.join('\n- '));
        }
      }

      // Medications
      if (patient.medical_data.medications && patient.medical_data.medications.length > 0) {
        const medStrings = patient.medical_data.medications.map(med =>
          `${med.name} ${med.dose || ''} ${med.frequency || ''}`.trim()
        );
        medDataSections.push('Current Medications:\n- ' + medStrings.join('\n- '));
      }

      // Diagnoses
      if (patient.medical_data.diagnoses && patient.medical_data.diagnoses.length > 0) {
        medDataSections.push('Diagnoses:\n- ' + patient.medical_data.diagnoses.join('\n- '));
      }

      // Allergies
      if (patient.medical_data.allergies && patient.medical_data.allergies.length > 0) {
        medDataSections.push('Allergies:\n- ' + patient.medical_data.allergies.join('\n- '));
      }

      if (medDataSections.length > 0) {
        sections.push('Medical Data:\n' + medDataSections.join('\n\n'));
      }
    }

    const contextString = sections.length > 0
      ? sections.join('\n\n')
      : 'No detailed patient information available in records.';

    console.log(`[Realtime] Patient context prepared (${contextString.length} chars)`);

    return {
      found: true,
      patientId: patient.id,
      patientName: `${patient.first_name} ${patient.last_name}`,
      context: contextString
    };

  } catch (error) {
    console.error('[Realtime] Error fetching patient context:', error);
    return {
      found: false,
      patientId: null,
      context: 'Error retrieving patient information.'
    };
  }
}

/**
 * Connect to OpenAI Realtime API with patient context
 */
async function connectToOpenAI(patientContext) {
  const url = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17';

  console.log('[Realtime] Connecting to OpenAI Realtime API...');
  console.log(`[Realtime] API Key configured: ${OPENAI_API_KEY ? 'YES (length: ' + OPENAI_API_KEY.length + ')' : 'NO'}`);

  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured - cannot connect to OpenAI Realtime API');
  }

  const ws = new WebSocket(url, {
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'OpenAI-Beta': 'realtime=v1'
    }
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      console.error('[Realtime] ❌ Timeout waiting for OpenAI connection (10s)');
      ws.close();
      reject(new Error('OpenAI connection timeout after 10 seconds'));
    }, 10000); // 10 second timeout

    ws.on('open', () => {
      clearTimeout(timeout);
      console.log('[Realtime] ✅ Connected to OpenAI');

      // Build system instructions with patient context
      const systemInstructions = `You are a certified diabetes educator (CDE) providing personalized phone-based support to a patient calling the TSHLA Medical diabetes education hotline.

PATIENT INFORMATION:
${patientContext}

YOUR ROLE AND GUIDELINES:
- You are a warm, empathetic certified diabetes educator
- Speak naturally and conversationally, as if talking to a friend
- Reference specific values from the patient's record (A1C, medications, weight changes, etc.)
- Focus on the patient's stated focus areas from their record
- Keep responses concise and clear (this is a phone conversation)
- Ask open-ended questions about their daily routines, challenges, and goals
- Provide actionable, evidence-based advice
- Use motivational interviewing techniques
- Celebrate small victories and progress
- If asked about values you don't have in the record, acknowledge you don't see that information

IMPORTANT RULES:
- ALWAYS use the actual patient data provided above
- NEVER make up medical values or information
- If the patient's record shows concerning values (e.g., high A1C), address them with empathy
- Encourage the patient to follow up with their primary care provider for medical decisions
- You provide education and support, not medical diagnosis or prescriptions

CONVERSATION STYLE:
- Start by warmly greeting the patient and asking how they're doing
- Listen actively and respond to their specific concerns
- Use simple language, avoid medical jargon when possible
- Show empathy: "I understand that can be challenging..."
- Be encouraging: "That's a great question..." or "I'm glad you're thinking about this..."

Remember: You're here to support, educate, and empower the patient in managing their diabetes.`;

      // Define functions the AI can call to fetch patient data dynamically
      const tools = [
        {
          type: 'function',
          name: 'get_patient_labs',
          description: 'Get the patient\'s lab results including A1C, glucose, and other test values',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        {
          type: 'function',
          name: 'get_patient_medications',
          description: 'Get the patient\'s current medications with dosages and frequencies',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        {
          type: 'function',
          name: 'get_patient_diagnoses',
          description: 'Get the patient\'s diabetes-related diagnoses',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        {
          type: 'function',
          name: 'get_clinical_notes',
          description: 'Get recent clinical notes from the patient\'s care team',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      ];

      // Configure the session
      const sessionConfig = {
        type: 'session.update',
        session: {
          modalities: ['text', 'audio'],
          instructions: systemInstructions,
          voice: VOICE,
          input_audio_format: 'g711_ulaw', // Match Twilio format (no conversion needed)
          output_audio_format: 'g711_ulaw',
          input_audio_transcription: {
            model: 'whisper-1'
          },
          turn_detection: {
            type: 'server_vad', // Server-side voice activity detection
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500
          },
          temperature: 0.8, // Slightly more natural/varied responses
          max_response_output_tokens: 4096,
          tools: tools,  // Register functions
          tool_choice: 'auto'  // AI decides when to call functions
        }
      };

      console.log('[Realtime] Sending session configuration...');
      ws.send(JSON.stringify(sessionConfig));

      resolve(ws);
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      console.error('[Realtime] ❌ OpenAI connection error:', error);
      console.error('[Realtime] Error details:', {
        message: error.message,
        code: error.code,
        type: error.type
      });

      // Provide helpful diagnostics
      if (error.message && error.message.includes('401')) {
        console.error('[Realtime] 🔑 API Key is INVALID or EXPIRED!');
        console.error('[Realtime] 💡 Get a new key from https://platform.openai.com/api-keys');
      } else if (error.message && error.message.includes('403')) {
        console.error('[Realtime] 🚫 API Key does not have access to Realtime API');
      } else if (error.message && error.message.includes('429')) {
        console.error('[Realtime] ⏱️  Rate limit exceeded');
      }

      reject(error);
    });

    ws.on('close', (code, reason) => {
      console.log('[Realtime] OpenAI connection closed');
      if (code !== 1000) {
        console.log(`[Realtime] Close code: ${code}, Reason: ${reason}`);
      }
    });
  });
}

/**
 * Handle function calls from OpenAI
 * Fetch patient data from database and return to AI
 */
async function handleFunctionCall(functionCallData, callLog, openAIWs) {
  const { call_id, name, arguments: argsString } = functionCallData;

  console.log(`[Realtime] Executing function: ${name}`);

  try {
    const supabase = getSupabase();
    if (!supabase || !callLog.patientId) {
      throw new Error('Cannot fetch patient data - missing database or patient ID');
    }

    // Fetch patient record
    const { data: patient, error } = await supabase
      .from('diabetes_education_patients')
      .select('*')
      .eq('id', callLog.patientId)
      .single();

    if (error || !patient) {
      throw new Error('Patient not found');
    }

    let result;

    switch (name) {
      case 'get_patient_labs':
        if (patient.medical_data && patient.medical_data.labs) {
          const labs = patient.medical_data.labs;
          const labResults = [];
          for (const [key, val] of Object.entries(labs)) {
            labResults.push({
              test: key,
              value: val.value,
              unit: val.unit,
              date: val.date || 'recent'
            });
          }
          result = { labs: labResults };
        } else {
          result = { labs: [], message: 'No lab results on file' };
        }
        break;

      case 'get_patient_medications':
        if (patient.medical_data && patient.medical_data.medications) {
          result = { medications: patient.medical_data.medications };
        } else {
          result = { medications: [], message: 'No medications on file' };
        }
        break;

      case 'get_patient_diagnoses':
        if (patient.medical_data && patient.medical_data.diagnoses) {
          result = { diagnoses: patient.medical_data.diagnoses };
        } else {
          result = { diagnoses: [], message: 'No diagnoses on file' };
        }
        break;

      case 'get_clinical_notes':
        result = {
          clinical_notes: patient.clinical_notes || 'No clinical notes available',
          focus_areas: patient.focus_areas || []
        };
        break;

      default:
        result = { error: `Unknown function: ${name}` };
    }

    console.log(`[Realtime] Function result:`, JSON.stringify(result).substring(0, 200));

    // Send function result back to OpenAI
    const functionResponse = {
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: call_id,
        output: JSON.stringify(result)
      }
    };

    openAIWs.send(JSON.stringify(functionResponse));

    // Tell OpenAI to generate a response using the function result
    openAIWs.send(JSON.stringify({ type: 'response.create' }));

  } catch (error) {
    console.error(`[Realtime] Error in function ${name}:`, error);

    // Send error back to OpenAI
    const errorResponse = {
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: call_id,
        output: JSON.stringify({ error: error.message })
      }
    };

    openAIWs.send(JSON.stringify(errorResponse));
  }
}

/**
 * Handle messages from OpenAI Realtime API
 */
function handleOpenAIMessage(message, twilioWs, streamSid, callLog, openAIWs) {
  try {
    const data = JSON.parse(message);

    // Log all events for debugging (can be filtered later)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Realtime] OpenAI event: ${data.type}`);
    }

    switch (data.type) {
      case 'session.created':
        console.log('[Realtime] ✅ Session created:', data.session.id);
        callLog.sessionId = data.session.id;
        break;

      case 'session.updated':
        console.log('[Realtime] ✅ Session configured');
        break;

      case 'response.audio.delta':
        // Forward audio chunks to Twilio in real-time
        if (twilioWs.readyState === WebSocket.OPEN) {
          twilioWs.send(JSON.stringify({
            event: 'media',
            streamSid: streamSid,
            media: {
              payload: data.delta // base64 μ-law audio
            }
          }));
        }
        break;

      case 'response.audio.done':
        console.log('[Realtime] Audio response complete');
        break;

      case 'conversation.item.input_audio_transcription.completed':
        // User's speech transcribed
        const userText = data.transcript;
        console.log('[Realtime] 👤 User said:', userText);
        callLog.userMessages.push({
          timestamp: new Date().toISOString(),
          text: userText
        });
        break;

      case 'response.audio_transcript.delta':
        // AI's speech being generated (partial)
        callLog.currentAIResponse = (callLog.currentAIResponse || '') + data.delta;
        break;

      case 'response.audio_transcript.done':
        // AI's complete response
        const aiText = data.transcript;
        console.log('[Realtime] 🤖 AI said:', aiText);
        callLog.aiMessages.push({
          timestamp: new Date().toISOString(),
          text: aiText
        });
        callLog.currentAIResponse = '';
        break;

      case 'response.done':
        console.log('[Realtime] Response complete');
        break;

      case 'error':
        console.error('[Realtime] ❌ OpenAI error:', data.error);
        callLog.errors.push({
          timestamp: new Date().toISOString(),
          error: data.error
        });
        break;

      case 'input_audio_buffer.speech_started':
        console.log('[Realtime] 🎤 User started speaking');
        break;

      case 'input_audio_buffer.speech_stopped':
        console.log('[Realtime] 🎤 User stopped speaking');
        break;

      case 'response.function_call_arguments.done':
        // AI wants to call a function - handle it and send response
        console.log(`[Realtime] 🔧 Function call: ${data.name}`);
        handleFunctionCall(data, callLog, openAIWs).catch(err => {
          console.error('[Realtime] Function call error:', err);
        });
        break;

      default:
        // Ignore other event types for now
        break;
    }
  } catch (error) {
    console.error('[Realtime] Error handling OpenAI message:', error);
  }
}

/**
 * Save call log to database
 */
async function saveCallLog(callLog) {
  try {
    if (!callLog.patientId) {
      console.warn('[Realtime] Cannot save call log - no patient ID');
      return;
    }

    // Combine user and AI messages into full transcript
    const allMessages = [];

    // Interleave messages by timestamp
    const combined = [
      ...callLog.userMessages.map(m => ({ ...m, speaker: 'User' })),
      ...callLog.aiMessages.map(m => ({ ...m, speaker: 'AI' }))
    ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const transcript = combined
      .map(m => `[${m.timestamp}] ${m.speaker}: ${m.text}`)
      .join('\n');

    // Calculate duration
    const duration = callLog.endTime && callLog.startTime
      ? Math.round((new Date(callLog.endTime) - new Date(callLog.startTime)) / 1000)
      : null;

    // Insert call record
    const supabase = getSupabase();
    if (!supabase) {
      console.error('[Realtime] Cannot save call log - Supabase not initialized');
      return;
    }

    const { error } = await supabase
      .from('diabetes_education_calls')
      .insert({
        patient_id: callLog.patientId,
        twilio_call_sid: callLog.callSid,
        caller_phone_number: callLog.callerNumber,
        language: callLog.language || 'en',
        call_started_at: callLog.startTime,
        call_ended_at: callLog.endTime,
        duration_seconds: duration,
        transcript: transcript,
        call_status: 'completed',
        elevenlabs_conversation_id: callLog.sessionId // Reuse this field for OpenAI session ID
      });

    if (error) {
      console.error('[Realtime] ❌ Error saving call log:', error);
    } else {
      console.log('[Realtime] ✅ Call log saved to database');
    }

  } catch (error) {
    console.error('[Realtime] Error in saveCallLog:', error);
  }
}

/**
 * Setup WebSocket endpoint for Twilio Media Streams
 * Returns a WebSocket.Server instance (like Deepgram proxy)
 * This function is called by the main server to set up the route
 */
function setupRealtimeRelay(server) {
  console.log('[Realtime] Setting up WebSocket endpoint at /media-stream');

  // Create WebSocket server with origin validation for Twilio
  // Twilio Media Streams requires specific handling
  const wss = new WebSocket.Server({
    server,
    path: '/media-stream',
    perMessageDeflate: false, // Twilio doesn't support compression
    clientTracking: true,
    verifyClient: (info, callback) => {
      // Log all WebSocket upgrade attempts
      console.log('[Realtime] 🔍 WebSocket upgrade request received');
      console.log('[Realtime]    Origin:', info.origin || 'not provided');
      console.log('[Realtime]    URL:', info.req.url);
      console.log('[Realtime]    Headers:', JSON.stringify({
        'user-agent': info.req.headers['user-agent'],
        'sec-websocket-key': info.req.headers['sec-websocket-key'],
        'sec-websocket-version': info.req.headers['sec-websocket-version'],
        'x-twilio-signature': info.req.headers['x-twilio-signature'] ? 'present' : 'absent'
      }, null, 2));

      // Accept all connections for now (Twilio doesn't send standard CORS origin)
      // In production, you should validate X-Twilio-Signature header
      console.log('[Realtime] ✅ WebSocket upgrade accepted');
      callback(true);
    }
  });

  wss.on('connection', async (ws, req) => {
    console.log('[Realtime] 📞 New Twilio connection');
    console.log('[Realtime] Connection URL:', req.url);
    console.log('[Realtime] Connection headers:', JSON.stringify(req.headers, null, 2));

    let streamSid = null;
    let callSid = null;
    let openAiWs = null;
    let callerNumber = null;
    let patientData = null;

    // Call log object for database storage
    const callLog = {
      callSid: null,
      streamSid: null,
      callerNumber: null,
      patientId: null,
      sessionId: null,
      startTime: new Date().toISOString(),
      endTime: null,
      userMessages: [],
      aiMessages: [],
      currentAIResponse: '',
      errors: [],
      language: 'en'
    };

    // Handle messages from Twilio
    ws.on('message', async (message) => {
      try {
        console.log('[Realtime] 📨 Raw message received, length:', message.length);
        console.log('[Realtime] Message type:', typeof message);
        const data = JSON.parse(message);
        console.log(`[Realtime] ✅ Parsed event: ${data.event}`);
        if (data.event === 'start') {
          console.log('[Realtime] Start event data:', JSON.stringify(data, null, 2));
        }

        switch (data.event) {
          case 'connected':
            console.log('[Realtime] ✅ Twilio Media Stream connected event received');
            console.log('[Realtime] Protocol:', data.protocol, 'Version:', data.version);
            // Twilio sends this first - no action needed, just log
            break;

          case 'start':
            streamSid = data.start.streamSid;
            callSid = data.start.callSid;

            // Get patient data from TwiML parameters (passed from inbound webhook)
            const customParams = data.start.customParameters || {};
            const patientId = customParams.patientId;
            const patientName = customParams.patientName;
            const language = customParams.language || 'en';

            callLog.streamSid = streamSid;
            callLog.callSid = callSid;
            callLog.patientId = patientId;
            callLog.language = language;

            console.log(`[Realtime] 📞 Call started`);
            console.log(`   Call SID: ${callSid}`);
            console.log(`   Stream SID: ${streamSid}`);
            console.log(`   Patient ID: ${patientId}`);
            console.log(`   Patient Name: ${patientName}`);
            console.log(`   Language: ${language}`);

            // Fetch full patient context from database using patient ID
            if (patientId) {
              const supabase = getSupabase();
              if (supabase) {
                const { data: patient } = await supabase
                  .from('diabetes_education_patients')
                  .select('*')
                  .eq('id', patientId)
                  .single();

                if (patient) {
                  const sections = [];

                  if (patient.clinical_notes && patient.clinical_notes.trim()) {
                    sections.push(`Clinical Notes:\n${patient.clinical_notes.trim()}`);
                  }

                  if (patient.focus_areas && Array.isArray(patient.focus_areas) && patient.focus_areas.length > 0) {
                    sections.push(`Focus Areas: ${patient.focus_areas.join(', ')}`);
                  }

                  if (patient.medical_data) {
                    const medDataSections = [];

                    if (patient.medical_data.labs) {
                      const labStrings = [];
                      const labs = patient.medical_data.labs;

                      if (labs.a1c) {
                        labStrings.push(`A1C: ${labs.a1c.value}${labs.a1c.unit || '%'} (${labs.a1c.date || 'recent'})`);
                      }
                      if (labs.glucose_fasting) {
                        labStrings.push(`Fasting Glucose: ${labs.glucose_fasting.value}${labs.glucose_fasting.unit || 'mg/dL'} (${labs.glucose_fasting.date || 'recent'})`);
                      }
                      if (labs.creatinine) {
                        labStrings.push(`Creatinine: ${labs.creatinine.value}${labs.creatinine.unit || 'mg/dL'} (${labs.creatinine.date || 'recent'})`);
                      }

                      if (labStrings.length > 0) {
                        medDataSections.push('Lab Results:\n- ' + labStrings.join('\n- '));
                      }
                    }

                    if (patient.medical_data.medications && patient.medical_data.medications.length > 0) {
                      const medStrings = patient.medical_data.medications.map(med =>
                        `${med.name} ${med.dose || ''} ${med.frequency || ''}`.trim()
                      );
                      medDataSections.push('Current Medications:\n- ' + medStrings.join('\n- '));
                    }

                    if (patient.medical_data.diagnoses && patient.medical_data.diagnoses.length > 0) {
                      medDataSections.push('Diagnoses:\n- ' + patient.medical_data.diagnoses.join('\n- '));
                    }

                    if (patient.medical_data.allergies && patient.medical_data.allergies.length > 0) {
                      medDataSections.push('Allergies:\n- ' + patient.medical_data.allergies.join('\n- '));
                    }

                    if (medDataSections.length > 0) {
                      sections.push('Medical Data:\n' + medDataSections.join('\n\n'));
                    }
                  }

                  patientData = {
                    found: true,
                    patientId: patient.id,
                    patientName: `${patient.first_name} ${patient.last_name}`,
                    context: sections.length > 0 ? sections.join('\n\n') : 'No detailed patient information available in records.'
                  };

                  console.log(`[Realtime] ✅ Patient context loaded (${patientData.context.length} chars)`);
                } else {
                  console.warn(`[Realtime] ⚠️  Patient not found in database`);
                  patientData = {
                    found: false,
                    patientId: null,
                    context: 'No patient information available.'
                  };
                }
              } else {
                console.warn(`[Realtime] ⚠️  Supabase not initialized`);
                patientData = {
                  found: false,
                  patientId: null,
                  context: 'No patient information available.'
                };
              }
            } else {
              console.warn(`[Realtime] ⚠️  No patient ID provided in stream parameters`);
              patientData = {
                found: false,
                patientId: null,
                context: 'No patient information available.'
              };
            }

            console.log('[Realtime] Patient context preview:');
            console.log(patientData.context.substring(0, 200) + '...');

            // Connect to OpenAI with patient context
            try {
              openAiWs = await connectToOpenAI(patientData.context);

              // Forward OpenAI messages to Twilio
              openAiWs.on('message', (openAiMessage) => {
                handleOpenAIMessage(openAiMessage, ws, streamSid, callLog, openAiWs);
              });

              openAiWs.on('error', (error) => {
                console.error('[Realtime] ❌ OpenAI WebSocket error:', error);
                callLog.errors.push({
                  timestamp: new Date().toISOString(),
                  error: error.message
                });
              });

              openAiWs.on('close', () => {
                console.log('[Realtime] OpenAI WebSocket closed');
              });

            } catch (error) {
              console.error('[Realtime] ❌ Failed to connect to OpenAI:', error);

              // Send error message to caller
              ws.send(JSON.stringify({
                event: 'media',
                streamSid: streamSid,
                media: {
                  payload: '' // Could send error audio here
                }
              }));
            }
            break;

          case 'media':
            // Forward Twilio audio to OpenAI
            if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
              openAiWs.send(JSON.stringify({
                type: 'input_audio_buffer.append',
                audio: data.media.payload // base64 μ-law 8kHz from Twilio
              }));
            }
            break;

          case 'stop':
            console.log('[Realtime] 📞 Call ended');
            callLog.endTime = new Date().toISOString();

            // Save call log to database
            await saveCallLog(callLog);

            // Close OpenAI connection
            if (openAiWs) {
              openAiWs.close();
            }
            break;

          default:
            // Ignore other Twilio events
            break;
        }
      } catch (error) {
        console.error('[Realtime] ❌ Error handling Twilio message:', error);
        console.error('[Realtime] Error stack:', error.stack);
        console.error('[Realtime] Raw message that caused error:', message.toString());
      }
    });

    // Handle Twilio disconnection
    ws.on('close', async (code, reason) => {
      console.log('[Realtime] 📞 Twilio disconnected');
      console.log('[Realtime] Close code:', code);
      console.log('[Realtime] Close reason:', reason.toString() || 'no reason provided');

      if (!callLog.endTime) {
        callLog.endTime = new Date().toISOString();
        await saveCallLog(callLog);
      }

      if (openAiWs) {
        openAiWs.close();
      }
    });

    ws.on('error', (error) => {
      console.error('[Realtime] ❌ Twilio WebSocket error:', error);
    });
  });

  console.log('[Realtime] ✅ WebSocket relay ready');
}

module.exports = { setupRealtimeRelay };
