/**
 * TSHLA Medical - Unified API Server
 * Combines all microservices into one Express application
 * Created: October 19, 2025
 * Updated: December 29, 2025 - Added OpenAI Realtime API WebSocket relay
 * Version: 2.1.0
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
const expressWs = require('express-ws');
const cors = require('cors');
const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
const unifiedDatabase = require('./services/unified-supabase.service');
const patientMatchingService = require('./services/patientMatching.service');

// Create main Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (important for Azure App Service)
app.set('trust proxy', 1);

// Enable CORS for HTTP routes only (skip WebSocket paths)
// WebSocket upgrades are handled separately by the WebSocket servers
app.use((req, res, next) => {
  // Skip CORS for WebSocket upgrade requests
  if (req.headers.upgrade === 'websocket') {
    console.log('[CORS] Skipping CORS for WebSocket upgrade:', req.path);
    return next();
  }

  // Skip CORS for WebSocket paths entirely
  if (req.path.startsWith('/media-stream') || req.path.startsWith('/ws/')) {
    console.log('[CORS] Skipping CORS for WebSocket path:', req.path);
    return next();
  }

  // Apply CORS for regular HTTP requests
  return cors({
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
  })(req, res, next);
});

// Parse JSON request bodies (increased limit for CCD XML files)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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

// Azure OpenAI Realtime API health check
app.get('/api/health/openai-realtime', async (req, res) => {
  try {
    const WebSocket = require('ws');
    const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
    const AZURE_OPENAI_KEY = process.env.AZURE_OPENAI_KEY;
    const AZURE_OPENAI_REALTIME_DEPLOYMENT = process.env.AZURE_OPENAI_REALTIME_DEPLOYMENT || 'gpt-4o-realtime-preview';
    const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2024-10-01-preview';

    if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_KEY) {
      return res.status(503).json({
        status: 'error',
        service: 'azure-openai-realtime-api',
        error: 'Azure OpenAI credentials not configured',
        details: 'Required: AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_KEY',
        timestamp: new Date().toISOString()
      });
    }

    // Build Azure OpenAI Realtime WebSocket URL
    const hostname = AZURE_OPENAI_ENDPOINT.replace('https://', '').replace('http://', '');
    const url = `wss://${hostname}/openai/realtime?api-version=${AZURE_OPENAI_API_VERSION}&deployment=${AZURE_OPENAI_REALTIME_DEPLOYMENT}`;

    const ws = new WebSocket(url, {
      headers: {
        'api-key': AZURE_OPENAI_KEY
      }
    });

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Connection timeout after 5 seconds'));
      }, 5000);

      ws.on('open', () => {
        clearTimeout(timeout);
        ws.close();
        resolve();
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    res.json({
      status: 'ok',
      service: 'azure-openai-realtime-api',
      message: 'Successfully connected to Azure OpenAI Realtime API',
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      deployment: AZURE_OPENAI_REALTIME_DEPLOYMENT,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const statusCode = error.message && error.message.includes('401') ? 401 :
                      error.message && error.message.includes('403') ? 403 :
                      error.message && error.message.includes('404') ? 404 :
                      error.message && error.message.includes('429') ? 429 : 503;

    res.status(statusCode).json({
      status: 'error',
      service: 'azure-openai-realtime-api',
      error: error.message,
      details: error.message && error.message.includes('401') ? 'Azure OpenAI API key is invalid or expired. Check your key in Azure Portal' :
               error.message && error.message.includes('404') ? 'Deployment not found. Verify AZURE_OPENAI_REALTIME_DEPLOYMENT' :
               error.message && error.message.includes('403') ? 'API key does not have access to Realtime API' :
               error.message && error.message.includes('429') ? 'Rate limit exceeded' : 'Connection failed',
      timestamp: new Date().toISOString()
    });
  }
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
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY;
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

// DISABLED: Twilio phone numbers cancelled - 2026-01-03
// app.post('/api/twilio/previsit-twiml', async (req, res) => {
//   try {
//     console.log('📞 Pre-Visit TwiML webhook called');
//     const signedUrl = await getElevenLabsSignedUrl();
//     console.log('✅ Got ElevenLabs signed URL');
//     const twiml = `<?xml version="1.0" encoding="UTF-8"?>
// <Response>
//   <Connect>
//     <Stream url="${signedUrl}" track="both_tracks" />
//   </Connect>
// </Response>`;
//     res.type('application/xml');
//     res.send(twiml);
//   } catch (error) {
//     console.error('❌ TwiML error:', error);
//     const fallback = `<?xml version="1.0" encoding="UTF-8"?>
// <Response>
//   <Say>We're sorry, our automated assistant is currently unavailable. Please call back later.</Say>
//   <Hangup/>
// </Response>`;
//     res.type('application/xml');
//     res.send(fallback);
//   }
// });
console.log('⚠️  Twilio previsit-twiml endpoint DISABLED (phone numbers cancelled)');

// ==========================================================================
// API PROXY ENDPOINTS - Secure server-side API key handling
// ==========================================================================
// These endpoints proxy API calls to third-party services (OpenAI, Azure OpenAI, ElevenLabs)
// to keep API keys secure on the server side and prevent client-side exposure

/**
 * Azure OpenAI Chat Proxy
 * Proxies chat completion requests to Azure OpenAI
 * Keeps AZURE_OPENAI_KEY secure on server-side
 */
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { messages, model, temperature, max_tokens } = req.body;

    const AZURE_ENDPOINT = process.env.VITE_AZURE_OPENAI_ENDPOINT;
    const AZURE_KEY = process.env.AZURE_OPENAI_KEY;
    const DEPLOYMENT = process.env.VITE_AZURE_OPENAI_DEPLOYMENT;
    const API_VERSION = process.env.VITE_AZURE_OPENAI_API_VERSION;

    if (!AZURE_KEY || !AZURE_ENDPOINT) {
      return res.status(500).json({
        error: 'Azure OpenAI not configured on server',
        details: 'AZURE_OPENAI_KEY or VITE_AZURE_OPENAI_ENDPOINT missing'
      });
    }

    const url = `${AZURE_ENDPOINT}/openai/deployments/${DEPLOYMENT}/chat/completions?api-version=${API_VERSION}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': AZURE_KEY // Server-side only!
      },
      body: JSON.stringify({
        messages,
        model: model || DEPLOYMENT,
        temperature: temperature || 0.7,
        max_tokens: max_tokens || 2000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Azure OpenAI error:', response.status, errorText);
      return res.status(response.status).json({
        error: 'Azure OpenAI request failed',
        status: response.status,
        details: errorText
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('❌ Azure OpenAI proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * OpenAI Chat Proxy (Standard API)
 * Proxies chat completion requests to OpenAI
 * Keeps OPENAI_API_KEY secure on server-side
 */
app.post('/api/ai/summary', async (req, res) => {
  try {
    const { text, instructions, model, temperature, max_tokens } = req.body;

    const OPENAI_KEY = process.env.OPENAI_API_KEY;

    if (!OPENAI_KEY) {
      return res.status(500).json({
        error: 'OpenAI not configured on server',
        details: 'OPENAI_API_KEY missing'
      });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}` // Server-side only!
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: instructions ? `${instructions}\n\n${text}` : text
        }],
        temperature: temperature || 0.7,
        max_tokens: max_tokens || 2000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI error:', response.status, errorText);
      return res.status(response.status).json({
        error: 'OpenAI request failed',
        status: response.status,
        details: errorText
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('❌ OpenAI proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Pre-Visit AI Summary Routes
 * Separate router for staff pre-visit workflow
 */
const previsitRoutes = require('./routes/previsit');
app.use('/api/ai', previsitRoutes);

/**
 * ElevenLabs Text-to-Speech Proxy
 * Proxies TTS requests to ElevenLabs
 * Keeps ELEVENLABS_API_KEY secure on server-side
 */
app.post('/api/tts/elevenlabs', async (req, res) => {
  try {
    const { text, voice_id, model_id } = req.body;

    const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY;
    const DEFAULT_VOICE = process.env.VITE_ELEVENLABS_DEFAULT_VOICE_ID || 'cgSgspJ2msm6clMCkdW9';

    if (!ELEVENLABS_KEY) {
      return res.status(500).json({
        error: 'ElevenLabs not configured on server',
        details: 'ELEVENLABS_API_KEY missing'
      });
    }

    const voiceId = voice_id || DEFAULT_VOICE;
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_KEY // Server-side only!
      },
      body: JSON.stringify({
        text,
        model_id: model_id || 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ ElevenLabs error:', response.status, errorText);
      return res.status(response.status).json({
        error: 'ElevenLabs request failed',
        status: response.status,
        details: errorText
      });
    }

    // Forward the audio stream
    res.setHeader('Content-Type', 'audio/mpeg');
    response.body.pipe(res);
  } catch (error) {
    console.error('❌ ElevenLabs proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});

console.log('✅ API Proxy endpoints configured:');
console.log('   - POST /api/ai/chat (Azure OpenAI)');
console.log('   - POST /api/ai/summary (OpenAI)');
console.log('   - POST /api/tts/elevenlabs (ElevenLabs TTS)');

// ==========================================================================
// DIABETES EDUCATION - DISABLED (Twilio phone numbers cancelled - 2026-01-03)
// ==========================================================================
// DISABLED: V2 uses OpenAI Realtime with safe modes and proper Twilio Media Streams
// try {
//   const diabetesEducationV2 = require('./api/twilio/diabetes-education-inbound-v2');
//   const streamStatus = require('./api/twilio/stream-status');
//   const diagnostics = require('./api/diagnostic-endpoints');
//   app.post('/api/twilio/diabetes-education-inbound', diabetesEducationV2.default);
//   app.post('/api/twilio/stream-status', streamStatus);
//   app.get('/healthz', diagnostics.healthz);
//   app.get('/ws-test', diagnostics.wsTest);
//   app.get('/twiml-test', diagnostics.twimlTest);
//   app.get('/twiml-test-json', diagnostics.twimlTestJson);
//   console.log('✅ Diabetes Education V2 (OpenAI Realtime) webhooks registered');
//   console.log(`   Safe Mode: ${process.env.SAFE_MODE || 'D (full)'}`);
//   console.log('   Diagnostic endpoints: /healthz, /ws-test, /twiml-test');
// } catch (e) {
//   console.error('❌ Failed to load Diabetes Education V2:', e.message);
//   console.error(e.stack);
// }
console.log('⚠️  Diabetes Education phone system DISABLED (Twilio cancelled)');

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

// ===== PATIENT PROFILE IMPORT API (PDF Upload) =====
const multer = require('multer');
const pdfParser = require('./services/pdfParser.service');
const conditionExtractor = require('./services/conditionExtractor.service');

// Configure multer for memory storage (PDF in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Upload and parse PDF progress note
app.post('/api/patient-profile/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No PDF file uploaded'
      });
    }

    console.log(`📄 Processing PDF upload: ${req.file.originalname} (${req.file.size} bytes)`);

    // Step 1: Parse PDF to extract text
    const parseResult = await pdfParser.parsePDF(req.file.buffer);

    if (!parseResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to parse PDF',
        details: parseResult.error
      });
    }

    console.log(`✅ PDF parsed: ${parseResult.numPages} pages, ${parseResult.text.length} characters`);

    // Step 2: Clean and extract text
    const cleanedText = pdfParser.cleanText(parseResult.text);

    // Step 3: Use AI to extract structured patient data
    const extractResult = await conditionExtractor.extractPatientData(cleanedText);

    if (!extractResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to extract patient data',
        details: extractResult.error
      });
    }

    const patientData = extractResult.data;
    console.log(`🧠 AI extracted patient data for: ${patientData.patient_name}`);

    // Step 4: Save to Supabase patient_profiles table
    const supabase = await unifiedDatabase.getClient();

    const { data: savedProfile, error: saveError } = await supabase
      .from('patient_profiles')
      .upsert({
        patient_name: patientData.patient_name,
        patient_dob: patientData.patient_dob,
        patient_phone: patientData.patient_phone,
        patient_mrn: patientData.patient_mrn,
        patient_email: patientData.patient_email,
        conditions: patientData.conditions,
        medications: patientData.medications,
        allergies: patientData.allergies,
        last_note_date: new Date().toISOString().split('T')[0],
        last_note_provider: patientData.provider_name,
        pdf_source_filename: req.file.originalname,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'patient_phone', // Upsert based on phone number
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (saveError) {
      console.error('❌ Supabase save error:', saveError);
      return res.status(500).json({
        success: false,
        error: 'Failed to save patient profile',
        details: saveError.message
      });
    }

    console.log(`✅ Patient profile saved: ${savedProfile.id}`);

    // ========================================
    // NEW: Auto-create/link unified patient
    // ========================================
    let unifiedPatient = null;
    if (patientData.patient_phone) {
      try {
        console.log('🔍 Finding or creating unified patient from PDF...');

        unifiedPatient = await patientMatchingService.findOrCreatePatient(
          patientData.patient_phone,
          {
            name: patientData.patient_name,
            mrn: patientData.patient_mrn,
            dob: patientData.patient_dob,
            email: patientData.patient_email,
            conditions: patientData.conditions || [],
            medications: patientData.medications || [],
            allergies: patientData.allergies || [],
            provider_name: patientData.provider_name
          },
          'pdf'
        );

        console.log(`✅ Created/updated unified patient: ${unifiedPatient.patient_id}`);
      } catch (patientError) {
        console.warn('⚠️  Failed to create/link unified patient (non-critical):', patientError.message);
      }
    }
    // ========================================

    // Step 5: Auto-link to appointments
    let linkingResult = null;
    try {
      console.log(`🔗 Attempting to auto-link profile to appointments...`);
      linkingResult = await profileLinking.linkProfileToAppointments(savedProfile.id, 30);

      if (linkingResult.success && linkingResult.linkedAppointments > 0) {
        console.log(`✅ Auto-linked to ${linkingResult.linkedAppointments} appointment(s)`);
      } else {
        console.log(`ℹ️  No matching appointments found (this is normal if no appointments exist yet)`);
      }
    } catch (linkError) {
      console.warn('⚠️  Auto-linking failed (non-critical):', linkError.message);
      // Don't fail the whole upload if linking fails
    }

    res.json({
      success: true,
      message: 'Patient profile created successfully',
      data: patientData,
      profile_id: savedProfile.id,
      linking: linkingResult ? {
        linked_appointments: linkingResult.linkedAppointments || 0,
        details: linkingResult.details || []
      } : null
    });

  } catch (error) {
    console.error('❌ PDF upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get all patient profiles
app.get('/api/patient-profiles', async (req, res) => {
  try {
    const supabase = await unifiedDatabase.getClient();

    const { data, error } = await supabase
      .from('patient_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      success: true,
      profiles: data
    });
  } catch (error) {
    console.error('❌ Error fetching patient profiles:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get patient profile by phone number
app.get('/api/patient-profile/by-phone/:phone', async (req, res) => {
  try {
    const { phone } = req.params;

    const supabase = await unifiedDatabase.getClient();

    const { data, error } = await supabase
      .from('patient_profiles')
      .select('*')
      .eq('patient_phone', phone)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return res.json({
          success: true,
          profile: null,
          message: 'No profile found for this phone number'
        });
      }
      throw new Error(error.message);
    }

    res.json({
      success: true,
      profile: data
    });
  } catch (error) {
    console.error('❌ Error fetching patient profile:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===== PRE-VISIT CALL DATA API =====

const questionGenerator = require('./services/questionGenerator.service');

// Caller ID Matching - Identify patient when they call
app.get('/api/previsit/match-caller/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    console.log(`📞 Matching caller: ${phone}`);

    // Normalize phone number (remove formatting)
    const normalizedPhone = phone.replace(/\D/g, '');
    const searchPatterns = [
      `+1${normalizedPhone}`,
      `+${normalizedPhone}`,
      normalizedPhone.slice(-10) // Last 10 digits
    ];

    const supabase = await unifiedDatabase.getClient();

    // Find patient profile by phone
    let profile = null;
    for (const pattern of searchPatterns) {
      const { data, error } = await supabase
        .from('patient_profiles')
        .select('*')
        .ilike('patient_phone', `%${pattern}%`)
        .limit(1)
        .single();

      if (data && !error) {
        profile = data;
        break;
      }
    }

    if (!profile) {
      console.log(`❌ No profile found for phone: ${phone}`);
      return res.json({
        success: true,
        matched: false,
        message: 'No patient profile found for this phone number'
      });
    }

    console.log(`✅ Matched patient: ${profile.patient_name}`);

    // TODO: In the future, also fetch upcoming appointment
    // For now, just return profile data

    // Generate custom question script for this patient
    const firstPrompt = questionGenerator.generateFirstPrompt(profile);
    const estimatedDuration = questionGenerator.estimateCallDuration(profile.conditions);

    res.json({
      success: true,
      matched: true,
      patient: {
        id: profile.id,
        name: profile.patient_name,
        dob: profile.patient_dob,
        phone: profile.patient_phone,
        mrn: profile.patient_mrn,
        conditions: profile.conditions,
        medications: profile.medications
      },
      call_config: {
        first_prompt: firstPrompt,
        estimated_duration_minutes: estimatedDuration,
        conditions_to_address: profile.conditions
      }
    });

  } catch (error) {
    console.error('❌ Error matching caller:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Preview what questions will be asked for a patient
app.get('/api/previsit/preview-questions/:patient_id', async (req, res) => {
  try {
    const { patient_id } = req.params;

    const supabase = await unifiedDatabase.getClient();

    const { data: profile, error } = await supabase
      .from('patient_profiles')
      .select('*')
      .eq('id', patient_id)
      .single();

    if (error || !profile) {
      return res.status(404).json({
        success: false,
        error: 'Patient profile not found'
      });
    }

    const summary = questionGenerator.generateQuestionSummary(profile.conditions);
    const estimatedDuration = questionGenerator.estimateCallDuration(profile.conditions);

    res.json({
      success: true,
      patient_name: profile.patient_name,
      conditions: profile.conditions,
      question_summary: summary,
      estimated_duration_minutes: estimatedDuration
    });

  } catch (error) {
    console.error('❌ Error previewing questions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===== PROFILE LINKING API =====

const profileLinking = require('./services/profileLinking.service');

// Auto-link a patient profile to matching appointments
app.post('/api/linking/auto-link/:profile_id', async (req, res) => {
  try {
    const { profile_id } = req.params;
    const { search_days_ahead = 30 } = req.body;

    console.log(`🔗 Auto-linking profile ${profile_id}...`);

    const result = await profileLinking.linkProfileToAppointments(
      profile_id,
      search_days_ahead
    );

    res.json(result);
  } catch (error) {
    console.error('❌ Error in auto-link:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Bulk auto-link all patient profiles
app.post('/api/linking/link-all', async (req, res) => {
  try {
    const { search_days_ahead = 30 } = req.body;

    console.log(`🔗 Bulk linking all profiles...`);

    const result = await profileLinking.linkAllProfiles(search_days_ahead);

    res.json(result);
  } catch (error) {
    console.error('❌ Error in bulk link:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Manual link: Connect specific profile to specific appointment
app.post('/api/linking/manual-link', async (req, res) => {
  try {
    const { profile_id, appointment_id, user_id } = req.body;

    if (!profile_id || !appointment_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing profile_id or appointment_id'
      });
    }

    console.log(`🔗 Manual linking profile ${profile_id} to appointment ${appointment_id}...`);

    const result = await profileLinking.manualLink(
      profile_id,
      appointment_id,
      user_id
    );

    res.json(result);
  } catch (error) {
    console.error('❌ Error in manual link:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Unlink profile from appointment
app.delete('/api/linking/unlink/:appointment_id', async (req, res) => {
  try {
    const { appointment_id } = req.params;
    const { user_id, reason } = req.body;

    console.log(`🔓 Unlinking appointment ${appointment_id}...`);

    const result = await profileLinking.unlinkAppointment(
      appointment_id,
      user_id,
      reason
    );

    res.json(result);
  } catch (error) {
    console.error('❌ Error in unlink:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get unlinked patient profiles
app.get('/api/linking/unlinked-profiles', async (req, res) => {
  try {
    const result = await profileLinking.getUnlinkedProfiles();
    res.json(result);
  } catch (error) {
    console.error('❌ Error fetching unlinked profiles:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Search for appointments that match a profile
app.post('/api/linking/search-appointments', async (req, res) => {
  try {
    const searchCriteria = req.body;

    const result = await profileLinking.searchMatchingAppointments(searchCriteria);
    res.json(result);
  } catch (error) {
    console.error('❌ Error searching appointments:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get linking statistics
app.get('/api/linking/stats', async (req, res) => {
  try {
    const result = await profileLinking.getLinkingStats();
    res.json(result);
  } catch (error) {
    console.error('❌ Error fetching linking stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

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

    const medsArray = Array.isArray(medications) ? medications : [medications];

    // Upsert to Supabase
    const supabase = await unifiedDatabase.getClient();
    const { data, error } = await supabase
      .from('previsit_call_data')
      .upsert({
        conversation_id: conversation_id || 'unknown',
        medications: medsArray
      }, {
        onConflict: 'conversation_id',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      console.error('❌ Supabase error:', error);
    } else {
      console.log('✅ Saved to Supabase:', data);
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

    const concernsArray = Array.isArray(concerns) ? concerns : [concerns];

    // Upsert to Supabase
    const supabase = await unifiedDatabase.getClient();
    const { data, error } = await supabase
      .from('previsit_call_data')
      .upsert({
        conversation_id: conversation_id || 'unknown',
        concerns: concernsArray
      }, {
        onConflict: 'conversation_id',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      console.error('❌ Supabase error:', error);
    } else {
      console.log('✅ Saved to Supabase:', data);
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

    const questionsArray = Array.isArray(questions) ? questions : [questions];

    // Upsert to Supabase
    const supabase = await unifiedDatabase.getClient();
    const { data, error } = await supabase
      .from('previsit_call_data')
      .upsert({
        conversation_id: conversation_id || 'unknown',
        questions: questionsArray
      }, {
        onConflict: 'conversation_id',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      console.error('❌ Supabase error:', error);
    } else {
      console.log('✅ Saved to Supabase:', data);
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

// Debug endpoint - List all captured sessions from Supabase
app.get('/api/previsit/sessions/all', async (req, res) => {
  try {
    const supabase = await unifiedDatabase.getClient();
    const { data, error } = await supabase
      .from('previsit_call_data')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({
      count: data.length,
      sessions: data
    });
  } catch (error) {
    console.error('❌ Error listing sessions:', error);
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

  // Test Deepgram SDK WebSocket connectivity from Azure
  app.get('/api/deepgram/test-websocket', async (req, res) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');

    console.log('🧪 Testing Deepgram SDK WebSocket connectivity...');

    try {
      const testClient = createClient(DEEPGRAM_API_KEY);
      console.log('✅ Deepgram client created');

      const testConnection = testClient.listen.live({
        model: 'nova-3-medical',
        language: 'en-US',
        smart_format: true,
        interim_results: true
      });

      console.log('✅ Deepgram connection object created');

      let connectionOpened = false;
      let connectionError = null;
      let connectionClosed = false;

      testConnection.on(LiveTranscriptionEvents.Open, () => {
        console.log('✅ Test connection OPENED successfully!');
        connectionOpened = true;
      });

      testConnection.on(LiveTranscriptionEvents.Error, (error) => {
        console.error('❌ Test connection ERROR:', error);
        connectionError = error;
      });

      testConnection.on(LiveTranscriptionEvents.Close, () => {
        console.log('🔌 Test connection closed');
        connectionClosed = true;
      });

      // Wait 5 seconds to see if connection opens
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Clean up
      if (testConnection) {
        testConnection.finish();
      }

      res.json({
        success: connectionOpened && !connectionError,
        connectionOpened,
        connectionError: connectionError ? String(connectionError) : null,
        connectionClosed,
        timestamp: new Date().toISOString(),
        message: connectionOpened ? 'WebSocket SDK connection works!' : 'WebSocket SDK connection failed'
      });

    } catch (error) {
      console.error('❌ Test failed with exception:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    }
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

let diabetesEducationApi = null;
try {
  const path = require('path');
  diabetesEducationApi = require(path.join(__dirname, 'diabetes-education-api'));
  console.log('✅ Diabetes Education API loaded');
} catch (e) {
  console.error('❌ Failed to load Diabetes Education API:', e.message);
  console.error(e.stack);
}

let patientChartApi = null;
try {
  patientChartApi = require('./api/patient-chart-api');
  console.log('✅ Patient Chart API loaded');
} catch (e) {
  console.error('❌ Failed to load Patient Chart API:', e.message);
  console.error(e.stack);
}

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
  // Use Azure Communication Services instead of Twilio (HIPAA compliant)
  echoAudioSummaryRoutes = require('./routes/echo-audio-summary-azure');
  console.log('✅ Echo routes loaded (Azure Communication Services)');
} catch (e) {
  console.log('⚠️  Echo routes not available:', e.message);
  // Fallback to old Twilio version if Azure not configured
  try {
    echoAudioSummaryRoutes = require('./routes/echo-audio-summary');
    console.log('⚠️  Using legacy Twilio Echo routes (consider migrating to Azure)');
  } catch (e2) {
    console.log('❌ No Echo routes available');
  }
}

// Mount each API (they already have their own route prefixes like /api/*)
// Since each API has its own namespace, we can mount them directly
// IMPORTANT: Echo routes must be mounted FIRST to avoid being caught by pump-report-api's catch-all route
if (echoAudioSummaryRoutes) {
  app.use('/api/echo', echoAudioSummaryRoutes); // Routes: /api/echo/* (Echo Audio Summary with Azure Communication Services)
  console.log('✅ Echo routes mounted at /api/echo');
}
app.use(pumpApi);    // Routes: /api/auth/*, /api/stripe/*, /api/provider/*, /api/pump-*
app.use(authApi);     // Routes: /api/medical/*
app.use(scheduleApi); // Routes: /api/providers/*, /api/appointments/*, /api/schedule/*, /api/notes/*
app.use(adminApi);    // Routes: /api/accounts/*
if (diabetesEducationApi) {
  app.use('/api/diabetes-education', diabetesEducationApi); // Routes: /api/diabetes-education/* (Diabetes Education Phone System)
  console.log('✅ Diabetes Education API mounted at /api/diabetes-education');
} else {
  console.error('❌ Diabetes Education API not mounted - module failed to load');
}
if (patientChartApi) {
  app.use('/api/patient-chart', patientChartApi); // Routes: /api/patient-chart/* (Unified Patient Charts)
  console.log('✅ Patient Chart API mounted at /api/patient-chart');
}
if (patientSummaryApi) {
  app.use(patientSummaryApi); // Routes: /api/patient-summaries/* (BETA)
}

// CCD Summary API - HIPAA-Compliant CCD file upload and summary generation
let ccdSummaryApi = null;
try {
  ccdSummaryApi = require('./api/ccd-summary-api');
  app.use(ccdSummaryApi); // Routes: /api/ccd/* (CCD Summary Generator)
  console.log('✅ CCD Summary API mounted at /api/ccd');
} catch (error) {
  console.error('❌ CCD Summary API not mounted - module failed to load:', error.message);
}

// Add HTTP GET endpoint for /media-stream (for health checks)
// Twilio might check this before attempting WebSocket upgrade
app.get('/media-stream', (req, res) => {
  console.log('[HTTP] GET /media-stream - Responding with WebSocket ready status');
  res.status(200).json({
    status: 'WebSocket endpoint ready',
    protocol: 'wss',
    path: '/media-stream',
    message: 'Use WebSocket protocol to connect'
  });
});

// Create HTTP server (needed for WebSocket upgrade)
const server = http.createServer(app);

// ============================================
// OPENAI REALTIME API WEBSOCKET RELAY
// ============================================
// Uses native WebSocket.Server (like Deepgram proxy)
try {
  const { setupRealtimeRelay } = require('./openai-realtime-relay');
  setupRealtimeRelay(server);
  console.log('✅ OpenAI Realtime WebSocket relay registered at /media-stream');
} catch (e) {
  console.error('❌ Failed to load OpenAI Realtime relay:', e.message);
}

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

  // Create WebSocket server with path-based routing (like OpenAI Realtime relay)
  // Azure Container Apps DOES support path-based WebSocket routing when using the ws library's built-in path filtering
  const wss = new WebSocket.Server({
    server,
    path: '/ws/deepgram',
    perMessageDeflate: false,
    clientTracking: true,
    verifyClient: (info, callback) => {
      console.log('[Deepgram Proxy] 🔍 WebSocket upgrade request received');
      console.log('[Deepgram Proxy]    Origin:', info.origin || 'not provided');
      console.log('[Deepgram Proxy]    URL:', info.req.url);
      console.log('[Deepgram Proxy] ✅ WebSocket upgrade accepted');
      callback(true); // Accept all connections
    }
  });

  // Create Deepgram client (reused for all connections)
  const deepgram = createClient(DEEPGRAM_API_KEY);

  // Add error handler for WebSocket server
  wss.on('error', (error) => {
    console.error('❌ [Deepgram Proxy] WebSocket Server error:', {
      error: error.message,
      code: error.code,
      stack: error.stack
    });
  });

  // Add headers event for debugging
  wss.on('headers', (headers, request) => {
    console.log('[Deepgram Proxy] 📋 Response headers being sent:', headers);
  });

  wss.on('connection', (clientWs, request) => {
    console.log('📡 [Deepgram Proxy] WebSocket client CONNECTED successfully!');
    console.log('   URL:', request.url);
    console.log('   Origin:', request.headers.origin);
    console.log('   Client ready state:', clientWs.readyState);
    console.log('   Deepgram SDK available:', !!deepgram);

    let deepgramConnection = null;

    // Add close/error handlers IMMEDIATELY to track if connection closes right away
    clientWs.on('close', (code, reason) => {
      console.log('🔌 [Deepgram Proxy] Client disconnected:', {
        code,
        reason: reason?.toString() || 'no reason provided',
        timestamp: new Date().toISOString()
      });
      if (deepgramConnection) {
        deepgramConnection.finish();
      }
    });

    clientWs.on('error', (error) => {
      console.error('❌ [Deepgram Proxy] Client WebSocket error:', {
        error: error?.message || error,
        code: error?.code,
        timestamp: new Date().toISOString()
      });
      if (deepgramConnection) {
        deepgramConnection.finish();
      }
    });

    // Send immediate acknowledgment to client to keep connection alive
    try {
      clientWs.send(JSON.stringify({
        type: 'proxy_connected',
        message: 'Proxy ready, connecting to Deepgram...'
      }));
      console.log('✅ Sent proxy_connected acknowledgment to client');
    } catch (ackError) {
      console.error('❌ Failed to send acknowledgment:', ackError);
    }

    try {
      console.log('🔄 Creating Deepgram connection...');

      // Create Deepgram live transcription connection with simple, proven configuration
      deepgramConnection = deepgram.listen.live({
        model: process.env.VITE_DEEPGRAM_MODEL || 'nova-3-medical',
        language: process.env.VITE_DEEPGRAM_LANGUAGE || 'en-US',
        smart_format: true,
        interim_results: true,
        utterance_end_ms: 1000,
        vad_events: true,
        endpointing: 300,
      });

      console.log('✅ Deepgram connection object created');
      console.log('   Initial ready state:', deepgramConnection?.getReadyState?.());
      console.log('   Client WebSocket still open?', clientWs.readyState === 1);

      // Forward Deepgram events to client
      deepgramConnection.on(LiveTranscriptionEvents.Open, () => {
        console.log('✅ Deepgram connection opened');
        clientWs.send(JSON.stringify({
          type: 'open',
          message: 'Connected to Deepgram'
        }));
      });

      deepgramConnection.on(LiveTranscriptionEvents.Transcript, (data) => {
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

      // Forward client audio to Deepgram
      clientWs.on('message', (message) => {
        if (deepgramConnection && deepgramConnection.getReadyState() === 1) {
          // Forward audio data to Deepgram
          deepgramConnection.send(message);
        }
      });

    } catch (error) {
      console.error('❌ CRITICAL: Error setting up Deepgram connection:', {
        error: error?.message || error,
        stack: error?.stack,
        timestamp: new Date().toISOString()
      });

      try {
        clientWs.send(JSON.stringify({
          type: 'error',
          error: 'Failed to connect to Deepgram'
        }));
      } catch (sendError) {
        console.error('❌ Failed to send error message to client:', sendError);
      }

      clientWs.close();
    }
  });

  console.log('✅ WebSocket server ready on /ws/deepgram');
}

// ============================================
// ELEVENLABS DIABETES EDUCATION BRIDGE
// ============================================

const ELEVENLABS_DIABETES_AGENTS = {
  'en': process.env.ELEVENLABS_DIABETES_AGENT_EN,
  'es': process.env.ELEVENLABS_DIABETES_AGENT_ES,
  'fr': process.env.ELEVENLABS_DIABETES_AGENT_FR,
};

const hasAnyDiabetesAgent = Object.values(ELEVENLABS_DIABETES_AGENTS).some(id => id);

// DISABLED: Twilio phone numbers cancelled - 2026-01-03
// if (!ELEVENLABS_API_KEY || !hasAnyDiabetesAgent) {
//   console.warn('⚠️  ElevenLabs API key or diabetes agents not configured - bridge will not be available');
// } else {
//   console.log('✅ ElevenLabs Diabetes Education Bridge enabled');
//   const elevenLabsBridge = new WebSocket.Server({
//     server,
//     path: '/ws/elevenlabs-diabetes'
//   });
console.warn('⚠️  ElevenLabs Diabetes Education Bridge DISABLED (Twilio cancelled)');
if (false) {
  const elevenLabsBridge = {};

  elevenLabsBridge.on('connection', async (twilioWs, req) => {
    console.log('\n🌉 [ElevenLabs Bridge] Twilio connected');

    // Get agent ID from query parameters
    const params = new URL(req.url, 'ws://localhost').searchParams;
    const agentId = params.get('agentId');
    const patientName = params.get('patientName') || 'Patient';

    if (!agentId) {
      console.error('❌ [ElevenLabs Bridge] No agent ID provided');
      twilioWs.close();
      return;
    }

    console.log(`   Agent ID: ${agentId}`);
    console.log(`   Patient: ${patientName}`);

    let elevenLabsWs = null;
    let streamSid = null;

    try {
      // Get signed URL from ElevenLabs
      const signedUrl = await new Promise((resolve, reject) => {
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
              if (parsed.signed_url) {
                resolve(parsed.signed_url);
              } else {
                reject(new Error('No signed_url in response'));
              }
            } catch (e) {
              reject(e);
            }
          });
        });

        req.on('error', reject);
        req.end();
      });

      console.log('✅ [ElevenLabs Bridge] Got signed URL from ElevenLabs');

      // Connect to ElevenLabs
      elevenLabsWs = new WebSocket(signedUrl);

      elevenLabsWs.on('open', () => {
        console.log('🤖 [ElevenLabs Bridge] Connected to AI agent');
      });

      elevenLabsWs.on('error', (error) => {
        console.error('❌ [ElevenLabs Bridge] ElevenLabs error:', error.message);
      });

      elevenLabsWs.on('close', () => {
        console.log('🤖 [ElevenLabs Bridge] ElevenLabs disconnected');
        if (twilioWs.readyState === WebSocket.OPEN) {
          twilioWs.close();
        }
      });

      // Handle messages from ElevenLabs (AI responses)
      elevenLabsWs.on('message', (data) => {
        try {
          const msg = JSON.parse(data);

          // ElevenLabs sends audio in `audio` field
          if (msg.audio && msg.audio.chunk) {
            // Send audio back to Twilio
            if (twilioWs.readyState === WebSocket.OPEN && streamSid) {
              const mediaMessage = {
                event: 'media',
                streamSid: streamSid,
                media: {
                  payload: msg.audio.chunk
                }
              };
              twilioWs.send(JSON.stringify(mediaMessage));
            }
          }

          // Log other events for debugging
          if (msg.type) {
            console.log(`🤖 [ElevenLabs] Event: ${msg.type}`);
          }
        } catch (e) {
          console.error('❌ [ElevenLabs Bridge] Error parsing ElevenLabs message:', e.message);
        }
      });

      // Handle messages from Twilio (caller audio)
      twilioWs.on('message', (message) => {
        try {
          const msg = JSON.parse(message);

          if (msg.event === 'start') {
            streamSid = msg.start.streamSid;
            console.log(`📞 [Twilio] Stream started: ${streamSid}`);
            console.log(`📞 [Twilio] Call SID: ${msg.start.callSid}`);

            // Send connected event back to Twilio
            const connectedMessage = {
              event: 'connected',
              protocol: 'Call',
              version: '1.0.0'
            };
            twilioWs.send(JSON.stringify(connectedMessage));
          }
          else if (msg.event === 'media' && msg.media.payload) {
            // Forward audio to ElevenLabs
            if (elevenLabsWs && elevenLabsWs.readyState === WebSocket.OPEN) {
              const audioMessage = {
                user_audio_chunk: Buffer.from(msg.media.payload, 'base64').toString('base64')
              };
              elevenLabsWs.send(JSON.stringify(audioMessage));
            }
          }
          else if (msg.event === 'stop') {
            console.log('📞 [Twilio] Stream stopped');
            if (elevenLabsWs) {
              elevenLabsWs.close();
            }
          }
        } catch (e) {
          console.error('❌ [ElevenLabs Bridge] Error processing Twilio message:', e.message);
        }
      });

      twilioWs.on('close', () => {
        console.log('📞 [Twilio] Disconnected');
        if (elevenLabsWs) {
          elevenLabsWs.close();
        }
      });

      twilioWs.on('error', (error) => {
        console.error('❌ [ElevenLabs Bridge] Twilio error:', error.message);
      });

    } catch (error) {
      console.error('❌ [ElevenLabs Bridge] Setup error:', error.message);
      twilioWs.close();
    }
  });

  // console.log('✅ WebSocket server ready on /ws/elevenlabs-diabetes');
}

// ============================================
// ELEVENLABS RELAY - DISABLED (Twilio cancelled - 2026-01-03)
// ============================================
// DISABLED: This relay proxy bridges Twilio Media Streams to ElevenLabs
// Twilio doesn't support query params in WebSocket URLs, but ElevenLabs needs them
// So we accept Twilio connections and relay to ElevenLabs signed URLs

// const elevenLabsRelay = new WebSocket.Server({
//   server,
//   path: '/elevenlabs-relay'
// });
console.warn('⚠️  ElevenLabs Relay DISABLED (Twilio cancelled)');
if (false) {
const elevenLabsRelay = {};

elevenLabsRelay.on('connection', (twilioWs, req) => {
  console.log('\n🔄 [ElevenLabs Relay] New Twilio connection');

  let elevenLabsWs = null;
  let elevenLabsUrl = null;
  let isConnected = false;

  twilioWs.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      // Handle Twilio's start message
      if (data.event === 'start') {
        console.log('   📨 [Relay] Twilio start event received');

        // Extract ElevenLabs URL from custom parameters
        const customParams = data.start?.customParameters || {};
        elevenLabsUrl = customParams.elevenlabs_url;

        if (!elevenLabsUrl) {
          console.error('   ❌ [Relay] No ElevenLabs URL in custom parameters');
          console.error('   ❌ [Relay] Custom params:', JSON.stringify(customParams));
          twilioWs.close();
          return;
        }

        console.log('   🔗 [Relay] Connecting to ElevenLabs:', elevenLabsUrl.substring(0, 80) + '...');

        // Connect to ElevenLabs
        elevenLabsWs = new WebSocket(elevenLabsUrl);

        elevenLabsWs.on('open', () => {
          console.log('   ✅ [Relay] Connected to ElevenLabs');
          isConnected = true;
        });

        elevenLabsWs.on('message', (elevenLabsData) => {
          // Relay messages from ElevenLabs to Twilio
          if (twilioWs.readyState === WebSocket.OPEN) {
            twilioWs.send(elevenLabsData);
          }
        });

        elevenLabsWs.on('close', (code, reason) => {
          console.log('   📞 [Relay] ElevenLabs disconnected:', code, reason.toString());
          if (twilioWs.readyState === WebSocket.OPEN) {
            twilioWs.close();
          }
        });

        elevenLabsWs.on('error', (error) => {
          console.error('   ❌ [Relay] ElevenLabs WebSocket error:', error.message);
          if (twilioWs.readyState === WebSocket.OPEN) {
            twilioWs.close();
          }
        });
      }
      // Handle media messages from Twilio
      else if (data.event === 'media' && elevenLabsWs && isConnected) {
        // Forward audio from Twilio to ElevenLabs
        if (elevenLabsWs.readyState === WebSocket.OPEN) {
          elevenLabsWs.send(message);
        }
      }
      // Handle stop event
      else if (data.event === 'stop') {
        console.log('   📞 [Relay] Twilio stop event');
        if (elevenLabsWs && elevenLabsWs.readyState === WebSocket.OPEN) {
          elevenLabsWs.close();
        }
      }
    } catch (error) {
      console.error('   ❌ [Relay] Error processing Twilio message:', error.message);
    }
  });

  twilioWs.on('close', (code, reason) => {
    console.log('   📞 [Relay] Twilio disconnected:', code);
    if (elevenLabsWs && elevenLabsWs.readyState === WebSocket.OPEN) {
      elevenLabsWs.close();
    }
  });

  twilioWs.on('error', (error) => {
    console.error('   ❌ [Relay] Twilio WebSocket error:', error.message);
    if (elevenLabsWs && elevenLabsWs.readyState === WebSocket.OPEN) {
      elevenLabsWs.close();
    }
  });
});
}
// console.log('✅ ElevenLabs Relay WebSocket server ready on /elevenlabs-relay');

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.message
  });
});

// 404 handler (but skip WebSocket paths entirely)
app.use('*', (req, res, next) => {
  // Skip 404 for WebSocket paths - they're handled by WebSocket.Server at HTTP server level
  if (req.path.startsWith('/ws/') || req.path.startsWith('/media-stream') || req.path.startsWith('/elevenlabs-relay')) {
    // Don't handle this in Express - skip to next (which is nothing, so request hangs until WS handles it)
    return next();
  }

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
