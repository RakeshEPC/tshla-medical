/**
 * TSHLA Medical - Unified API Server
 * Combines all microservices into one Express application
 * Created: October 19, 2025
 * Updated: October 20, 2025 - Fixed Deepgram WebSocket proxy deployment
 *
 * Consolidates:
 * - Pump Report API (pump-report-api.js)
 * - Medical Auth API (medical-auth-api.js)
 * - Schedule/Notes API (enhanced-schedule-notes-api.js)
 * - Admin Account API (admin-account-api.js)
 * - Deepgram WebSocket Proxy (deepgram-proxy.js)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');

// Create main Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (important for Azure App Service)
app.set('trust proxy', 1);

// Enable CORS for all routes
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'https://www.tshla.ai',
    'https://tshla.ai',
    /\.tshla\.ai$/,
    /\.azurecontainerapps\.io$/
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Parse JSON request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

console.log('🚀 TSHLA Medical Unified API Server');
console.log('========================================');

// Define unified routes FIRST (before mounting other APIs)
// This ensures our unified routes take precedence over conflicting routes in sub-APIs

// Unified health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'tshla-unified-api',
    timestamp: new Date().toISOString(),
    services: {
      pump: 'ok',
      auth: 'ok',
      schedule: 'ok',
      admin: 'ok',
      websocket: 'ok'
    }
  });
});

// Unified API health endpoint (override individual API health checks)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'tshla-unified-api'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'TSHLA Medical Unified API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      pump_api: '/api/pump-*',
      auth_api: '/api/auth/* and /api/medical/*',
      schedule_api: '/api/schedule/*, /api/notes/*',
      admin_api: '/api/accounts/*',
      websocket: 'ws://[host]/ws/deepgram',
      previsit_twiml: '/api/twilio/previsit-twiml'
    }
  });
});

// Pre-Visit TwiML Endpoint for Twilio Integration
const https = require('https');
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || process.env.VITE_ELEVENLABS_API_KEY;
const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID;

function getElevenLabsSignedUrl() {
  return new Promise((resolve, reject) => {
    if (!ELEVENLABS_API_KEY || !ELEVENLABS_AGENT_ID) {
      reject(new Error('ElevenLabs not configured'));
      return;
    }

    const options = {
      hostname: 'api.elevenlabs.io',
      path: `/v1/convai/conversation/get_signed_url?agent_id=${ELEVENLABS_AGENT_ID}`,
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

app.post('/api/twilio/previsit-twiml', async (req, res) => {
  try {
    console.log('📞 Pre-Visit TwiML webhook called');

    const signedUrl = await getElevenLabsSignedUrl();
    console.log('✅ Got ElevenLabs signed URL');

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${signedUrl}" track="both_tracks" />
  </Connect>
</Response>`;

    res.type('application/xml');
    res.send(twiml);
  } catch (error) {
    console.error('❌ TwiML error:', error);

    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>We're sorry, our automated assistant is currently unavailable. Please call back later.</Say>
  <Hangup/>
</Response>`;
    res.type('application/xml');
    res.send(fallback);
  }
});

// Pre-Visit Conversations API
// Endpoints for fetching and displaying ElevenLabs conversation transcripts

// List all pre-visit conversations
app.get('/api/previsit/conversations', async (req, res) => {
  try {
    console.log('📋 Fetching pre-visit conversations...');

    if (!ELEVENLABS_API_KEY || !ELEVENLABS_AGENT_ID) {
      return res.status(500).json({ error: 'ElevenLabs not configured' });
    }

    const options = {
      hostname: 'api.elevenlabs.io',
      path: `/v1/convai/conversations?agent_id=${ELEVENLABS_AGENT_ID}`,
      method: 'GET',
      headers: { 'xi-api-key': ELEVENLABS_API_KEY }
    };

    const request = https.request(options, (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log(`✅ Retrieved ${parsed.conversations?.length || 0} conversations`);
          res.json(parsed);
        } catch (e) {
          console.error('❌ Parse error:', e);
          res.status(500).json({ error: 'Failed to parse response' });
        }
      });
    });

    request.on('error', (error) => {
      console.error('❌ Request error:', error);
      res.status(500).json({ error: error.message });
    });

    request.end();
  } catch (error) {
    console.error('❌ Error fetching conversations:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get detailed conversation by ID (includes full transcript)
app.get('/api/previsit/conversations/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    console.log(`📄 Fetching conversation details: ${conversationId}`);

    if (!ELEVENLABS_API_KEY) {
      return res.status(500).json({ error: 'ElevenLabs not configured' });
    }

    const options = {
      hostname: 'api.elevenlabs.io',
      path: `/v1/convai/conversations/${conversationId}`,
      method: 'GET',
      headers: { 'xi-api-key': ELEVENLABS_API_KEY }
    };

    const request = https.request(options, (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log(`✅ Retrieved conversation with ${parsed.transcript?.length || 0} messages`);
          res.json(parsed);
        } catch (e) {
          console.error('❌ Parse error:', e);
          res.status(500).json({ error: 'Failed to parse response' });
        }
      });
    });

    request.on('error', (error) => {
      console.error('❌ Request error:', error);
      res.status(500).json({ error: error.message });
    });

    request.end();
  } catch (error) {
    console.error('❌ Error fetching conversation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Make outbound pre-visit call
app.post('/api/previsit/call', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    console.log(`📞 Initiating pre-visit call to: ${phoneNumber}`);

    if (!ELEVENLABS_API_KEY || !ELEVENLABS_AGENT_ID) {
      return res.status(500).json({ error: 'ElevenLabs not configured' });
    }

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number required' });
    }

    // Get phone_number_id (we know it from earlier but let's fetch it dynamically)
    const listOptions = {
      hostname: 'api.elevenlabs.io',
      path: '/v1/convai/phone-numbers',
      method: 'GET',
      headers: { 'xi-api-key': ELEVENLABS_API_KEY }
    };

    const listRequest = https.request(listOptions, (listResponse) => {
      let listData = '';
      listResponse.on('data', (chunk) => { listData += chunk; });
      listResponse.on('end', () => {
        try {
          const phoneNumbers = JSON.parse(listData);
          const agentPhone = phoneNumbers.find(p => p.assigned_agent?.agent_id === ELEVENLABS_AGENT_ID);

          if (!agentPhone) {
            return res.status(500).json({ error: 'No phone number assigned to agent' });
          }

          // Make the outbound call
          const callData = JSON.stringify({
            agent_id: ELEVENLABS_AGENT_ID,
            agent_phone_number_id: agentPhone.phone_number_id,
            to_number: phoneNumber
          });

          const callOptions = {
            hostname: 'api.elevenlabs.io',
            path: '/v1/convai/twilio/outbound-call',
            method: 'POST',
            headers: {
              'xi-api-key': ELEVENLABS_API_KEY,
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(callData)
            }
          };

          const callRequest = https.request(callOptions, (callResponse) => {
            let callResponseData = '';
            callResponse.on('data', (chunk) => { callResponseData += chunk; });
            callResponse.on('end', () => {
              try {
                const result = JSON.parse(callResponseData);
                console.log(`✅ Call initiated: ${result.callSid || 'unknown'}`);
                res.json(result);
              } catch (e) {
                console.error('❌ Parse error:', e);
                res.status(500).json({ error: 'Failed to parse call response' });
              }
            });
          });

          callRequest.on('error', (error) => {
            console.error('❌ Call request error:', error);
            res.status(500).json({ error: error.message });
          });

          callRequest.write(callData);
          callRequest.end();

        } catch (e) {
          console.error('❌ Error processing phone numbers:', e);
          res.status(500).json({ error: 'Failed to get phone number' });
        }
      });
    });

    listRequest.on('error', (error) => {
      console.error('❌ List request error:', error);
      res.status(500).json({ error: error.message });
    });

    listRequest.end();

  } catch (error) {
    console.error('❌ Error initiating call:', error);
    res.status(500).json({ error: error.message });
  }
});

// ElevenLabs Post-Call Webhook
// This endpoint receives conversation data after each call ends
// and extracts structured clinical information
app.post('/api/previsit/webhook/post-call', async (req, res) => {
  try {
    console.log('📞 Post-call webhook received');

    const { conversation_id, agent_id, status } = req.body;

    // Acknowledge receipt immediately
    res.status(200).json({ received: true });

    // Process asynchronously (don't block the webhook response)
    if (status === 'done' && conversation_id) {
      processConversationData(conversation_id).catch(err => {
        console.error('❌ Error processing conversation:', err);
      });
    }
  } catch (error) {
    console.error('❌ Post-call webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Process conversation data asynchronously
async function processConversationData(conversationId) {
  try {
    console.log(`🔄 Processing conversation: ${conversationId}`);

    // Fetch full conversation details from ElevenLabs
    const options = {
      hostname: 'api.elevenlabs.io',
      path: `/v1/convai/conversations/${conversationId}`,
      method: 'GET',
      headers: { 'xi-api-key': ELEVENLABS_API_KEY }
    };

    const conversationData = await new Promise((resolve, reject) => {
      const request = https.request(options, (response) => {
        let data = '';
        response.on('data', (chunk) => { data += chunk; });
        response.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      });
      request.on('error', reject);
      request.end();
    });

    // Extract structured data using AI
    const structuredData = await extractStructuredData(conversationData);

    // Store in database (Supabase)
    // TODO: Implement database storage
    console.log('✅ Structured data extracted:', {
      conversation_id: conversationId,
      medications_count: structuredData.medications?.length || 0,
      concerns_count: structuredData.concerns?.length || 0,
      questions_count: structuredData.questions?.length || 0
    });

  } catch (error) {
    console.error('❌ Error processing conversation data:', error);
    throw error;
  }
}

// Extract structured clinical data from conversation using AI
async function extractStructuredData(conversationData) {
  // Even though transcript is redacted, we can still extract:
  // - Call metadata (duration, success status)
  // - Phone number (for linking to patient)
  // - AI-generated summary
  // - Message count and timing

  const phoneNumber = conversationData.metadata?.phone_call?.external_number;
  const summary = conversationData.analysis?.transcript_summary;
  const duration = conversationData.metadata?.call_duration_secs;
  const messageCount = conversationData.transcript?.length || 0;

  return {
    conversation_id: conversationData.conversation_id,
    phone_number: phoneNumber,
    call_duration_secs: duration,
    message_count: messageCount,
    call_successful: conversationData.analysis?.call_successful === 'success',
    ai_summary: summary,
    call_date: new Date(conversationData.metadata.start_time_unix_secs * 1000).toISOString(),

    // These would be extracted from transcript if not redacted
    // For now, we'll extract what we can from the summary
    medications: [], // TODO: Extract from summary or use audio transcription
    concerns: [],    // TODO: Extract from summary
    questions: [],   // TODO: Extract from summary
    urgency_level: 'low', // TODO: Determine from summary
    requires_callback: false
  };
}

// ============================================================================
// REAL-TIME DATA COLLECTION ENDPOINTS
// These endpoints are called by the ElevenLabs agent DURING the conversation
// to store structured data before ZRM redaction occurs
// ============================================================================

// In-memory storage for active conversations (replace with Supabase later)
const activeConversations = new Map();

// Initialize a new pre-visit conversation session
app.post('/api/previsit/session/start', async (req, res) => {
  try {
    const { conversation_id, phone_number } = req.body;
    console.log(`📞 Starting pre-visit session: ${conversation_id}`);

    activeConversations.set(conversation_id, {
      conversation_id,
      phone_number,
      started_at: new Date().toISOString(),
      medications: [],
      concerns: [],
      questions: [],
      urgency_flags: []
    });

    res.json({ success: true, message: 'Session initialized' });
  } catch (error) {
    console.error('❌ Error starting session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Store medications mentioned during the call
app.post('/api/previsit/data/medications', async (req, res) => {
  try {
    const { conversation_id, medications } = req.body;
    console.log(`💊 Storing medications for ${conversation_id}:`, medications);

    const session = activeConversations.get(conversation_id);
    if (session) {
      session.medications = Array.isArray(medications) ? medications : [medications];
    }

    res.json({ success: true, stored: medications });
  } catch (error) {
    console.error('❌ Error storing medications:', error);
    res.status(500).json({ error: error.message });
  }
});

// Store chief concerns mentioned during the call
app.post('/api/previsit/data/concerns', async (req, res) => {
  try {
    const { conversation_id, concerns } = req.body;
    console.log(`⚠️ Storing concerns for ${conversation_id}:`, concerns);

    const session = activeConversations.get(conversation_id);
    if (session) {
      session.concerns = Array.isArray(concerns) ? concerns : [concerns];
    }

    res.json({ success: true, stored: concerns });
  } catch (error) {
    console.error('❌ Error storing concerns:', error);
    res.status(500).json({ error: error.message });
  }
});

// Store questions for the provider
app.post('/api/previsit/data/questions', async (req, res) => {
  try {
    const { conversation_id, questions } = req.body;
    console.log(`❓ Storing questions for ${conversation_id}:`, questions);

    const session = activeConversations.get(conversation_id);
    if (session) {
      session.questions = Array.isArray(questions) ? questions : [questions];
    }

    res.json({ success: true, stored: questions });
  } catch (error) {
    console.error('❌ Error storing questions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Finalize and retrieve all collected data for a conversation
app.post('/api/previsit/session/complete', async (req, res) => {
  try {
    const { conversation_id } = req.body;
    console.log(`✅ Completing pre-visit session: ${conversation_id}`);

    const session = activeConversations.get(conversation_id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    session.completed_at = new Date().toISOString();
    console.log('📊 Final session data:', session);

    res.json({ success: true, data: session });
  } catch (error) {
    console.error('❌ Error completing session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Retrieve collected data for a conversation
app.get('/api/previsit/session/:conversation_id', async (req, res) => {
  try {
    const { conversation_id } = req.params;
    const session = activeConversations.get(conversation_id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(session);
  } catch (error) {
    console.error('❌ Error retrieving session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Deepgram proxy health endpoint
// Must be registered BEFORE sub-APIs to avoid being caught by their 404 handlers
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || process.env.VITE_DEEPGRAM_API_KEY;
if (DEEPGRAM_API_KEY) {
  app.get('/ws/deepgram/health', (req, res) => {
    // Manually set CORS headers to ensure they're present
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.json({
      status: 'healthy',
      service: 'deepgram-proxy',
      timestamp: new Date().toISOString()
    });
  });

  // Deepgram API key verification endpoint (for debugging)
  app.get('/api/deepgram/verify', async (req, res) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');

    try {
      console.log('🔑 Testing Deepgram API key...');

      // Test API key with Deepgram Projects API
      const response = await fetch('https://api.deepgram.com/v1/projects', {
        headers: {
          'Authorization': `Token ${DEEPGRAM_API_KEY}`
        }
      });

      const isValid = response.ok;
      const keyPreview = DEEPGRAM_API_KEY.substring(0, 8) + '...' + DEEPGRAM_API_KEY.substring(DEEPGRAM_API_KEY.length - 4);

      if (isValid) {
        console.log('✅ Deepgram API key is valid');
        const data = await response.json();
        res.json({
          status: 'valid',
          keyPreview,
          projects: data.projects?.length || 0,
          model: process.env.VITE_DEEPGRAM_MODEL || 'nova-2-medical',
          message: 'Deepgram API key is valid and working'
        });
      } else {
        console.error('❌ Deepgram API key is INVALID:', response.status);
        res.status(401).json({
          status: 'invalid',
          keyPreview,
          error: `API key validation failed: ${response.status} ${response.statusText}`,
          message: 'Please check your DEEPGRAM_API_KEY environment variable'
        });
      }
    } catch (error) {
      console.error('❌ Error verifying Deepgram key:', error);
      res.status(500).json({
        status: 'error',
        error: error.message,
        message: 'Failed to verify Deepgram API key'
      });
    }
  });
}

// Now mount the individual API apps
// Import individual API apps (they export Express app when required)
const pumpApi = require('./pump-report-api');
const authApi = require('./medical-auth-api');
const scheduleApi = require('./enhanced-schedule-notes-api');
const adminApi = require('./admin-account-api');

// Optional APIs - won't crash if they don't exist
let patientSummaryApi = null;
let echoAudioSummaryRoutes = null;
try {
  patientSummaryApi = require('./patient-summary-api');
  console.log('✅ Patient summary API loaded');
} catch (e) {
  console.log('⚠️  Patient summary API not available:', e.message);
}
try {
  echoAudioSummaryRoutes = require('./routes/echo-audio-summary');
  console.log('✅ Echo routes loaded');
} catch (e) {
  console.log('⚠️  Echo routes not available:', e.message);
}

// Mount each API (they already have their own route prefixes like /api/*)
// Since each API has its own namespace, we can mount them directly
// IMPORTANT: Echo routes must be mounted FIRST to avoid being caught by pump-report-api's catch-all route
if (echoAudioSummaryRoutes) {
  app.use('/api/echo', echoAudioSummaryRoutes); // Routes: /api/echo/* (Echo Audio Summary with Twilio)
  console.log('✅ Echo routes mounted at /api/echo');
}
app.use(pumpApi);    // Routes: /api/auth/*, /api/stripe/*, /api/provider/*, /api/pump-*
app.use(authApi);     // Routes: /api/medical/*
app.use(scheduleApi); // Routes: /api/providers/*, /api/appointments/*, /api/schedule/*, /api/notes/*
app.use(adminApi);    // Routes: /api/accounts/*
if (patientSummaryApi) {
  app.use(patientSummaryApi); // Routes: /api/patient-summaries/* (BETA)
}

// Create HTTP server (needed for WebSocket upgrade)
const server = http.createServer(app);

// ============================================
// DEEPGRAM WEBSOCKET PROXY
// ============================================
// Note: DEEPGRAM_API_KEY is already declared above (before sub-API mounting)

if (!DEEPGRAM_API_KEY) {
  console.warn('⚠️  Deepgram API key not found - WebSocket proxy will not be available');
} else {
  const keyPreview = DEEPGRAM_API_KEY.substring(0, 8) + '...' + DEEPGRAM_API_KEY.substring(DEEPGRAM_API_KEY.length - 4);
  console.log('✅ Deepgram WebSocket Proxy enabled');
  console.log(`   API Key: ${keyPreview}`);

  // Create WebSocket server on /ws path
  // Note: Health endpoint is registered earlier (before sub-APIs mount) to avoid 404 handler conflicts
  const wss = new WebSocket.Server({
    server,
    path: '/ws/deepgram'
  });

  // Create Deepgram client (reused for all connections)
  const deepgram = createClient(DEEPGRAM_API_KEY);

  wss.on('connection', (clientWs) => {
    console.log('📡 WebSocket client connected');

    let deepgramConnection = null;

    try {
      // FIXED: Use medical model with full parameters from client's query string
      // The client sends all parameters via query string - parse them here
      const url = new URL(clientWs.upgradeReq?.url || '/ws/deepgram', 'http://localhost');
      const params = url.searchParams;

      const deepgramConfig = {
        model: params.get('model') || process.env.VITE_DEEPGRAM_MODEL || 'nova-2-medical',
        language: params.get('language') || process.env.VITE_DEEPGRAM_LANGUAGE || 'en-US',
        encoding: params.get('encoding') || 'linear16',
        sample_rate: parseInt(params.get('sample_rate') || '48000'),
        channels: parseInt(params.get('channels') || '1'),
        smart_format: params.get('smart_format') !== 'false',
        interim_results: params.get('interim_results') !== 'false',
        vad_events: params.get('vad_events') !== 'false',
        endpointing: parseInt(params.get('endpointing') || '300'),
        punctuate: params.get('punctuate') !== 'false',
        utterances: params.get('utterances') !== 'false',
        diarize: params.get('diarize') === 'true'
      };

      // Add keywords if provided
      const keywords = params.getAll('keywords');
      if (keywords.length > 0) {
        deepgramConfig.keywords = keywords;
      }

      console.log('🎯 Deepgram config:', {
        model: deepgramConfig.model,
        sample_rate: deepgramConfig.sample_rate,
        keywords: keywords.length,
        encoding: deepgramConfig.encoding
      });

      // Create Deepgram live transcription connection with client parameters
      deepgramConnection = deepgram.listen.live(deepgramConfig);

      // Forward Deepgram events to client
      deepgramConnection.on(LiveTranscriptionEvents.Open, () => {
        console.log('✅ Deepgram connection opened with model:', deepgramConfig.model);
        clientWs.send(JSON.stringify({
          type: 'deepgram_ready',
          message: 'Connected to Deepgram',
          model: deepgramConfig.model
        }));
      });

      deepgramConnection.on(LiveTranscriptionEvents.Transcript, (data) => {
        // DIAGNOSTIC: Enhanced logging to debug "No Audio Captured"
        const transcript = data.channel?.alternatives?.[0]?.transcript || '';
        const hasTranscript = transcript && transcript.trim().length > 0;

        if (hasTranscript) {
          console.log('✅ TRANSCRIPT:', {
            text: transcript.substring(0, 100),
            length: transcript.length,
            isFinal: data.is_final,
            confidence: data.channel.alternatives[0].confidence
          });
        } else {
          console.log('⚠️ Empty transcript received from Deepgram:', {
            type: data.type,
            isFinal: data.is_final,
            dataKeys: Object.keys(data)
          });
        }

        // Forward transcript to client
        clientWs.send(JSON.stringify(data));
      });

      deepgramConnection.on(LiveTranscriptionEvents.Metadata, (data) => {
        // Forward metadata to client
        clientWs.send(JSON.stringify({
          type: 'metadata',
          data
        }));
      });

      deepgramConnection.on(LiveTranscriptionEvents.Error, (error) => {
        console.error('❌ Deepgram error:', error);
        clientWs.send(JSON.stringify({
          type: 'error',
          error: error.message
        }));
      });

      deepgramConnection.on(LiveTranscriptionEvents.Close, () => {
        console.log('🔌 Deepgram connection closed');
      });

      // Forward client audio to Deepgram with validation
      let audioChunksReceived = 0;
      clientWs.on('message', (message) => {
        if (deepgramConnection && deepgramConnection.getReadyState() === 1) {
          // DIAGNOSTIC: Log audio data reception
          audioChunksReceived++;

          if (audioChunksReceived === 1) {
            console.log('🎤 First audio chunk received:', {
              type: typeof message,
              size: message.length || message.byteLength || 'unknown',
              isBuffer: Buffer.isBuffer(message),
              isArrayBuffer: message instanceof ArrayBuffer
            });
          } else if (audioChunksReceived % 100 === 0) {
            console.log(`🎤 Audio chunks received: ${audioChunksReceived}`);
          }

          // Forward audio data to Deepgram
          deepgramConnection.send(message);
        } else {
          console.warn('⚠️ Cannot forward audio - Deepgram connection not ready:', deepgramConnection?.getReadyState());
        }
      });

      clientWs.on('close', () => {
        console.log('🔌 Client disconnected');
        if (deepgramConnection) {
          deepgramConnection.finish();
        }
      });

      clientWs.on('error', (error) => {
        console.error('❌ Client WebSocket error:', error);
        if (deepgramConnection) {
          deepgramConnection.finish();
        }
      });

    } catch (error) {
      console.error('❌ Error setting up Deepgram connection:', error);
      clientWs.send(JSON.stringify({
        type: 'error',
        error: 'Failed to connect to Deepgram'
      }));
      clientWs.close();
    }
  });

  console.log('✅ WebSocket server ready on /ws/deepgram');
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.originalUrl
  });
});

// Start the unified server
server.listen(PORT, '0.0.0.0', () => {
  console.log('========================================');
  console.log(`✅ Unified API Server running on port ${PORT}`);
  console.log('');
  console.log('📋 Available Services:');
  console.log(`   🏥 Pump API:      /api/pump-*, /api/auth/*`);
  console.log(`   🔐 Medical Auth:  /api/medical/*`);
  console.log(`   📅 Schedule API:  /api/schedule/*, /api/notes/*`);
  console.log(`   👤 Admin API:     /api/accounts/*`);
  console.log(`   🎤 WebSocket:     ws://localhost:${PORT}/ws/deepgram`);
  console.log('');
  console.log('🌐 Health Check:');
  console.log(`   http://localhost:${PORT}/health`);
  console.log('========================================');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

module.exports = server;
