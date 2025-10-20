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
      websocket: 'ws://[host]/ws/deepgram'
    }
  });
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
}

// Now mount the individual API apps
// Import individual API apps (they export Express app when required)
const pumpApi = require('./pump-report-api');
const authApi = require('./medical-auth-api');
const scheduleApi = require('./enhanced-schedule-notes-api');
const adminApi = require('./admin-account-api');

// Mount each API (they already have their own route prefixes like /api/*)
// Since each API has its own namespace, we can mount them directly
app.use(pumpApi);    // Routes: /api/auth/*, /api/stripe/*, /api/provider/*, /api/pump-*
app.use(authApi);     // Routes: /api/medical/*
app.use(scheduleApi); // Routes: /api/providers/*, /api/appointments/*, /api/schedule/*, /api/notes/*
app.use(adminApi);    // Routes: /api/accounts/*

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
      // Create Deepgram live transcription connection
      deepgramConnection = deepgram.listen.live({
        model: process.env.VITE_DEEPGRAM_MODEL || 'nova-3-medical',
        language: process.env.VITE_DEEPGRAM_LANGUAGE || 'en-US',
        smart_format: true,
        interim_results: true,
        utterance_end_ms: 1000,
        vad_events: true,
        endpointing: 300,
      });

      // Forward Deepgram events to client
      deepgramConnection.on(LiveTranscriptionEvents.Open, () => {
        console.log('✅ Deepgram connection opened');
        clientWs.send(JSON.stringify({
          type: 'deepgram_ready',
          message: 'Connected to Deepgram'
        }));
      });

      deepgramConnection.on(LiveTranscriptionEvents.Transcript, (data) => {
        // Log transcript for debugging
        const transcript = data.channel?.alternatives?.[0]?.transcript || '';
        if (transcript) {
          console.log('📝 Transcript:', transcript.substring(0, 50), `(${transcript.length} chars, final: ${data.is_final})`);
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

      // Forward client audio to Deepgram
      clientWs.on('message', (message) => {
        if (deepgramConnection && deepgramConnection.getReadyState() === 1) {
          // Forward audio data to Deepgram
          deepgramConnection.send(message);
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
