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
    <Stream url="${signedUrl}" />
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
const patientSummaryApi = require('./patient-summary-api');
const echoAudioSummaryRoutes = require('./routes/echo-audio-summary');
console.log('✅ Echo routes loaded:', echoAudioSummaryRoutes ? 'SUCCESS' : 'FAILED');

// Mount each API (they already have their own route prefixes like /api/*)
// Since each API has its own namespace, we can mount them directly
// IMPORTANT: Echo routes must be mounted FIRST to avoid being caught by pump-report-api's catch-all route
app.use('/api/echo', echoAudioSummaryRoutes); // Routes: /api/echo/* (Echo Audio Summary with Twilio)
console.log('✅ Echo routes mounted at /api/echo');
app.use(pumpApi);    // Routes: /api/auth/*, /api/stripe/*, /api/provider/*, /api/pump-*
app.use(authApi);     // Routes: /api/medical/*
app.use(scheduleApi); // Routes: /api/providers/*, /api/appointments/*, /api/schedule/*, /api/notes/*
app.use(adminApi);    // Routes: /api/accounts/*
app.use(patientSummaryApi); // Routes: /api/patient-summaries/* (BETA)

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
