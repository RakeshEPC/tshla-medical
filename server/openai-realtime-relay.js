/**
 * Azure OpenAI Realtime API WebSocket Relay Server
 *
 * Purpose: Bridge between Twilio Media Streams and Azure OpenAI Realtime API
 * for diabetes education voice AI with dynamic patient context injection
 *
 * HIPAA COMPLIANCE: Uses Azure OpenAI with Microsoft BAA for PHI processing
 *
 * Flow:
 * 1. Twilio calls webhook → connects to this WebSocket endpoint
 * 2. Fetch patient data by caller phone number
 * 3. Build patient context (clinical notes + medical data)
 * 4. Connect to Azure OpenAI Realtime API with context in system instructions
 * 5. Relay audio bidirectionally: Twilio ↔ Azure OpenAI
 * 6. Log transcripts and events
 *
 * Created: 2025-12-29
 * Migrated to Azure: 2026-01-08
 */

const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
const logger = require('./logger');

// Environment variables - Azure OpenAI Configuration
const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_KEY = process.env.AZURE_OPENAI_KEY;
const AZURE_OPENAI_REALTIME_DEPLOYMENT = process.env.AZURE_OPENAI_REALTIME_DEPLOYMENT || 'gpt-4o-realtime-preview';
const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2024-10-01-preview';
const VOICE = process.env.AZURE_OPENAI_REALTIME_VOICE || 'alloy'; // Options: alloy, echo, fable, onyx, nova, shimmer

// Supabase for patient data
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate required environment variables (warnings only, don't crash)
if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_KEY) {
  logger.warn('Realtime', 'Missing Azure OpenAI environment variables', {
    required: 'AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY'
  });
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  logger.warn('Realtime', 'Missing Supabase environment variables');
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
    logger.info('Realtime', 'Fetching patient data');

    // Query diabetes education patients table
    const supabase = getSupabase();
    if (!supabase) {
      logger.error('Realtime', 'Supabase not initialized');
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
      logger.warn('Realtime', 'No patient found');
      return {
        found: false,
        patientId: null,
        context: 'No patient record found for this phone number.'
      };
    }

    logger.info('Realtime', 'Found patient', { patientId: patient.id });

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

    logger.info('Realtime', 'Patient context prepared', { contextLength: contextString.length });

    return {
      found: true,
      patientId: patient.id,
      patientName: `${patient.first_name} ${patient.last_name}`,
      context: contextString
    };

  } catch (error) {
    logger.error('Realtime', 'Error fetching patient context', { error: error.message });
    return {
      found: false,
      patientId: null,
      context: 'Error retrieving patient information.'
    };
  }
}

/**
 * Connect to Azure OpenAI Realtime API with patient context
 * HIPAA COMPLIANT - Uses Azure OpenAI with Microsoft BAA
 */
async function connectToAzureOpenAI(patientContext) {
  // Build Azure OpenAI Realtime WebSocket URL
  // Format: wss://{resource}.openai.azure.com/openai/realtime?api-version={version}&deployment={deployment}
  const hostname = AZURE_OPENAI_ENDPOINT.replace('https://', '').replace('http://', '');
  const url = `wss://${hostname}/openai/realtime?api-version=${AZURE_OPENAI_API_VERSION}&deployment=${AZURE_OPENAI_REALTIME_DEPLOYMENT}`;

  logger.info('Realtime', 'Connecting to Azure OpenAI Realtime API', {
    endpoint: AZURE_OPENAI_ENDPOINT,
    deployment: AZURE_OPENAI_REALTIME_DEPLOYMENT,
    apiVersion: AZURE_OPENAI_API_VERSION,
    hasApiKey: !!AZURE_OPENAI_KEY
  });

  if (!AZURE_OPENAI_KEY || !AZURE_OPENAI_ENDPOINT) {
    throw new Error('Azure OpenAI credentials not configured - cannot connect to Realtime API');
  }

  const ws = new WebSocket(url, {
    headers: {
      'api-key': AZURE_OPENAI_KEY
    }
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      logger.error('Realtime', 'Timeout waiting for Azure OpenAI connection (10s)');
      ws.close();
      reject(new Error('Azure OpenAI connection timeout after 10 seconds'));
    }, 10000); // 10 second timeout

    ws.on('open', () => {
      clearTimeout(timeout);
      logger.info('Realtime', 'Connected to Azure OpenAI Realtime API');

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

      logger.info('Realtime', 'Sending session configuration');
      ws.send(JSON.stringify(sessionConfig));

      resolve(ws);
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      logger.error('Realtime', 'Azure OpenAI connection error', {
        error: error.message,
        code: error.code,
        type: error.type
      });

      // Provide helpful diagnostics for Azure OpenAI
      if (error.message && error.message.includes('401')) {
        logger.error('Realtime', 'Azure OpenAI API Key is INVALID or EXPIRED');
      } else if (error.message && error.message.includes('403')) {
        logger.error('Realtime', 'Access denied - check deployment name and permissions');
      } else if (error.message && error.message.includes('404')) {
        logger.error('Realtime', 'Deployment not found - verify AZURE_OPENAI_REALTIME_DEPLOYMENT');
      } else if (error.message && error.message.includes('429')) {
        logger.error('Realtime', 'Rate limit exceeded on Azure OpenAI');
      }

      reject(error);
    });

    ws.on('close', (code, reason) => {
      logger.info('Realtime', 'Azure OpenAI connection closed', {
        code,
        reason: reason ? reason.toString() : undefined
      });
    });
  });
}

/**
 * Handle function calls from Azure OpenAI
 * Fetch patient data from database and return to AI
 */
async function handleFunctionCall(functionCallData, callLog, azureOpenAIWs) {
  const { call_id, name, arguments: argsString } = functionCallData;

  logger.info('Realtime', 'Executing function', { function: name });

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

    logger.debug('Realtime', 'Function result', { function: name, resultLength: JSON.stringify(result).length });

    // Send function result back to Azure OpenAI
    const functionResponse = {
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: call_id,
        output: JSON.stringify(result)
      }
    };

    azureOpenAIWs.send(JSON.stringify(functionResponse));

    // Tell Azure OpenAI to generate a response using the function result
    azureOpenAIWs.send(JSON.stringify({ type: 'response.create' }));

  } catch (error) {
    logger.error('Realtime', 'Error in function call', { function: name, error: error.message });

    // Send error back to Azure OpenAI
    const errorResponse = {
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: call_id,
        output: JSON.stringify({ error: error.message })
      }
    };

    azureOpenAIWs.send(JSON.stringify(errorResponse));
  }
}

/**
 * Handle messages from Azure OpenAI Realtime API
 */
function handleAzureOpenAIMessage(message, twilioWs, streamSid, callLog, azureOpenAIWs) {
  try {
    const data = JSON.parse(message);

    // Log all events for debugging (can be filtered later)
    if (process.env.NODE_ENV !== 'production') {
      logger.debug('Realtime', 'Azure OpenAI event', { type: data.type });
    }

    switch (data.type) {
      case 'session.created':
        logger.info('Realtime', 'Session created', { sessionId: data.session.id });
        callLog.sessionId = data.session.id;
        break;

      case 'session.updated':
        logger.info('Realtime', 'Session configured');
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
        logger.debug('Realtime', 'Audio response complete');
        break;

      case 'conversation.item.input_audio_transcription.completed':
        // User's speech transcribed
        const userText = data.transcript;
        logger.info('Realtime', 'User speech transcribed', { length: userText.length });
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
        logger.info('Realtime', 'AI response transcribed', { length: aiText.length });
        callLog.aiMessages.push({
          timestamp: new Date().toISOString(),
          text: aiText
        });
        callLog.currentAIResponse = '';
        break;

      case 'response.done':
        logger.debug('Realtime', 'Response complete');
        break;

      case 'error':
        logger.error('Realtime', 'Azure OpenAI error', { error: data.error });
        callLog.errors.push({
          timestamp: new Date().toISOString(),
          error: data.error
        });
        break;

      case 'input_audio_buffer.speech_started':
        logger.debug('Realtime', 'User started speaking');
        break;

      case 'input_audio_buffer.speech_stopped':
        logger.debug('Realtime', 'User stopped speaking');
        break;

      case 'response.function_call_arguments.done':
        // AI wants to call a function - handle it and send response
        logger.info('Realtime', 'Function call requested', { function: data.name });
        handleFunctionCall(data, callLog, azureOpenAIWs).catch(err => {
          logger.error('Realtime', 'Function call error', { error: err.message });
        });
        break;

      default:
        // Ignore other event types for now
        break;
    }
  } catch (error) {
    logger.error('Realtime', 'Error handling Azure OpenAI message', { error: error.message });
  }
}

/**
 * Save call log to database
 */
async function saveCallLog(callLog) {
  try {
    if (!callLog.patientId) {
      logger.warn('Realtime', 'Cannot save call log - no patient ID');
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
      logger.error('Realtime', 'Cannot save call log - Supabase not initialized');
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
      logger.error('Realtime', 'Error saving call log', { error: error.message });
    } else {
      logger.logOperation('Realtime', 'save', 'call-log', true);
    }

  } catch (error) {
    logger.error('Realtime', 'Error in saveCallLog', { error: error.message });
  }
}

/**
 * Setup WebSocket endpoint for Twilio Media Streams
 * Returns a WebSocket.Server instance (like Deepgram proxy)
 * This function is called by the main server to set up the route
 */
function setupRealtimeRelay(server) {
  logger.info('Realtime', 'Setting up WebSocket endpoint at /media-stream');

  // Create WebSocket server with origin validation for Twilio
  // Twilio Media Streams requires specific handling
  const wss = new WebSocket.Server({
    server,
    path: '/media-stream',
    perMessageDeflate: false, // Twilio doesn't support compression
    clientTracking: true,
    verifyClient: (info, callback) => {
      // Log all WebSocket upgrade attempts
      logger.debug('Realtime', 'WebSocket upgrade request received', {
        origin: info.origin || 'not provided',
        url: info.req.url,
        hasTwilioSignature: !!info.req.headers['x-twilio-signature']
      });

      // Accept all connections for now (Twilio doesn't send standard CORS origin)
      // In production, you should validate X-Twilio-Signature header
      logger.debug('Realtime', 'WebSocket upgrade accepted');
      callback(true);
    }
  });

  wss.on('connection', async (ws, req) => {
    logger.info('Realtime', 'New Twilio connection', {
      url: req.url,
      userAgent: req.headers['user-agent']
    });

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
        logger.debug('Realtime', 'Message received from Twilio', { length: message.length });
        const data = JSON.parse(message);
        logger.debug('Realtime', 'Parsed Twilio event', { event: data.event });

        switch (data.event) {
          case 'connected':
            logger.info('Realtime', 'Twilio Media Stream connected', {
              protocol: data.protocol,
              version: data.version
            });
            // Twilio sends this first - no action needed, just log
            break;

          case 'start':
            streamSid = data.start.streamSid;
            callSid = data.start.callSid;

            // Get patient data from TwiML parameters (passed from inbound webhook)
            const customParams = data.start.customParameters || {};
            logger.info('Realtime', 'Call started', { callSid, streamSid });

            // NEW: Use token-based lookup (for fast TwiML response)
            const patientToken = customParams.patientToken;
            const language = customParams.language || 'en';

            callLog.streamSid = streamSid;
            callLog.callSid = callSid;
            callLog.language = language;

            // Retrieve patient ID from token
            let patientId = null;
            let patientName = null;

            if (patientToken) {
              try {
                const { getPatientFromToken } = require('./api/twilio/diabetes-education-inbound-v2');
                const tokenData = getPatientFromToken(patientToken);
                if (tokenData) {
                  patientId = tokenData.patientId;
                  patientName = `${tokenData.firstName} ${tokenData.lastName}`;
                  logger.info('Realtime', 'Token valid', { patientId });
                  callLog.patientId = patientId;
                } else {
                  logger.error('Realtime', 'Invalid or expired token');
                }
              } catch (err) {
                logger.error('Realtime', 'Token lookup error', { error: err.message });
              }
            }

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

                  logger.info('Realtime', 'Patient context loaded', { contextLength: patientData.context.length });
                } else {
                  logger.warn('Realtime', 'Patient not found in database');
                  patientData = {
                    found: false,
                    patientId: null,
                    context: 'No patient information available.'
                  };
                }
              } else {
                logger.warn('Realtime', 'Supabase not initialized');
                patientData = {
                  found: false,
                  patientId: null,
                  context: 'No patient information available.'
                };
              }
            } else {
              logger.warn('Realtime', 'No patient ID provided');
              patientData = {
                found: false,
                patientId: null,
                context: 'No patient information available.'
              };
            }

            logger.debug('Realtime', 'Patient context preview', { previewLength: 200 });

            // Connect to Azure OpenAI with patient context
            try {
              openAiWs = await connectToAzureOpenAI(patientData.context);

              // Forward Azure OpenAI messages to Twilio
              openAiWs.on('message', (openAiMessage) => {
                handleAzureOpenAIMessage(openAiMessage, ws, streamSid, callLog, openAiWs);
              });

              openAiWs.on('error', (error) => {
                logger.error('Realtime', 'Azure OpenAI WebSocket error', { error: error.message });
                callLog.errors.push({
                  timestamp: new Date().toISOString(),
                  error: error.message
                });
              });

              openAiWs.on('close', () => {
                logger.info('Realtime', 'Azure OpenAI WebSocket closed');
              });

            } catch (error) {
              logger.error('Realtime', 'Failed to connect to Azure OpenAI', { error: error.message });

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
            // Forward Twilio audio to Azure OpenAI
            if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
              openAiWs.send(JSON.stringify({
                type: 'input_audio_buffer.append',
                audio: data.media.payload // base64 μ-law 8kHz from Twilio
              }));
            }
            break;

          case 'stop':
            logger.info('Realtime', 'Call ended');
            callLog.endTime = new Date().toISOString();

            // Save call log to database
            await saveCallLog(callLog);

            // Close Azure OpenAI connection
            if (openAiWs) {
              openAiWs.close();
            }
            break;

          default:
            // Ignore other Twilio events
            break;
        }
      } catch (error) {
        logger.error('Realtime', 'Error handling Twilio message', {
          error: logger.redactPHI(error.message),
          stack: error.stack
        });
      }
    });

    // Handle Twilio disconnection
    ws.on('close', async (code, reason) => {
      logger.info('Realtime', 'Twilio disconnected', {
        code,
        reason: reason ? reason.toString() : 'no reason provided'
      });

      if (!callLog.endTime) {
        callLog.endTime = new Date().toISOString();
        await saveCallLog(callLog);
      }

      if (openAiWs) {
        openAiWs.close();
      }
    });

    ws.on('error', (error) => {
      logger.error('Realtime', 'Twilio WebSocket error', { error: error.message });
    });
  });

  logger.info('Realtime', 'WebSocket relay ready');
}

module.exports = { setupRealtimeRelay };
