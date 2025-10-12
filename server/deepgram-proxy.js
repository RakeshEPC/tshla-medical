/**
 * Deepgram WebSocket Proxy Server
 *
 * Purpose: Solve browser WebSocket authentication limitation
 * Problem: Browsers cannot send Authorization headers on WebSocket connections
 * Solution: Proxy adds the Authorization header that Deepgram requires
 *
 * Architecture:
 *   Browser (no auth) → Proxy (adds auth) → Deepgram API
 *   Browser ← Proxy ← Deepgram API
 */

// Load environment variables from .env file
require('dotenv').config();

const WebSocket = require('ws');
const http = require('http');
const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');

// Configuration
const PORT = process.env.PORT || 8080;
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || process.env.VITE_DEEPGRAM_API_KEY;

if (!DEEPGRAM_API_KEY) {
  console.error('❌ FATAL: DEEPGRAM_API_KEY environment variable is required');
  process.exit(1);
}

// Mask API key for logging
const keyPreview = DEEPGRAM_API_KEY.substring(0, 8) + '...' + DEEPGRAM_API_KEY.substring(DEEPGRAM_API_KEY.length - 4);
console.log('✅ Deepgram Proxy Server');
console.log(`   API Key: ${keyPreview}`);
console.log(`   Port: ${PORT}`);

// Create HTTP server for WebSocket upgrade
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      service: 'deepgram-proxy',
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Deepgram WebSocket Proxy Server\nConnect via WebSocket to /');
  }
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

console.log(`🚀 WebSocket server ready on port ${PORT}`);

// Track active connections
let activeConnections = 0;

wss.on('connection', async (clientWs, req) => {
  activeConnections++;
  const clientId = `client-${Date.now()}`;

  console.log(`\n📱 [${clientId}] New client connected (Total: ${activeConnections})`);
  console.log(`   IP: ${req.socket.remoteAddress}`);
  console.log(`   URL: ${req.url}`);

  let deepgramConnection = null;
  let deepgram = null;

  try {
    // Parse query parameters from client connection
    const url = new URL(req.url, `http://${req.headers.host}`);
    const params = url.searchParams;

    // Extract Deepgram configuration from client
    const model = params.get('model') || 'nova-2-medical';
    const language = params.get('language') || 'en-US';
    const encoding = params.get('encoding') || 'linear16';
    const sampleRate = parseInt(params.get('sample_rate') || '16000');
    const channels = parseInt(params.get('channels') || '1');
    const tier = params.get('tier') || 'enhanced';

    console.log(`🔧 [${clientId}] Configuration:`, {
      model,
      language,
      encoding,
      sampleRate,
      channels,
      tier
    });

    // Initialize Deepgram client
    deepgram = createClient(DEEPGRAM_API_KEY);

    // Create configuration for Deepgram
    const deepgramConfig = {
      model,
      language,
      encoding,
      sample_rate: sampleRate,
      channels,
      tier,
      punctuate: params.get('punctuate') === 'true',
      profanity_filter: params.get('profanity_filter') === 'true',
      redact: params.get('redact') === 'true',
      diarize: params.get('diarize') === 'true',
      smart_format: params.get('smart_format') === 'true',
      utterances: params.get('utterances') === 'true',
      interim_results: params.get('interim_results') === 'true',
      vad_events: params.get('vad_events') === 'true',
      endpointing: parseInt(params.get('endpointing') || '300')
    };

    // Add keywords if provided
    const keywords = params.getAll('keywords');
    if (keywords.length > 0) {
      deepgramConfig.keywords = keywords;
    }

    console.log(`🎙️ [${clientId}] Connecting to Deepgram with config:`, deepgramConfig);

    // Create Deepgram live transcription connection
    deepgramConnection = deepgram.listen.live(deepgramConfig);

    // Set up Deepgram event handlers
    deepgramConnection.on(LiveTranscriptionEvents.Open, () => {
      console.log(`✅ [${clientId}] Deepgram connection established`);

      // Notify client that connection is ready
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          type: 'open',
          message: 'Deepgram connection established'
        }));
      }
    });

    deepgramConnection.on(LiveTranscriptionEvents.Transcript, (data) => {
      // Forward transcription data to client
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(data));

        // Log transcript for debugging
        const transcript = data.channel?.alternatives?.[0]?.transcript;
        if (transcript && transcript.trim()) {
          console.log(`📝 [${clientId}] Transcript: "${transcript}" (final: ${data.is_final})`);
        }
      }
    });

    deepgramConnection.on(LiveTranscriptionEvents.Error, (error) => {
      console.error(`❌ [${clientId}] Deepgram error:`, error);

      // Forward error to client
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          type: 'error',
          error: error.message || String(error)
        }));
      }
    });

    deepgramConnection.on(LiveTranscriptionEvents.Close, (closeEvent) => {
      console.log(`⚠️ [${clientId}] Deepgram connection closed:`, {
        code: closeEvent?.code,
        reason: closeEvent?.reason
      });

      // Notify client
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          type: 'close',
          code: closeEvent?.code,
          reason: closeEvent?.reason
        }));
      }
    });

    deepgramConnection.on(LiveTranscriptionEvents.Metadata, (metadata) => {
      console.log(`ℹ️ [${clientId}] Metadata:`, metadata);

      // Forward metadata to client
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          type: 'metadata',
          metadata
        }));
      }
    });

    // Handle incoming audio data from client
    clientWs.on('message', (data) => {
      try {
        // Check if it's a control message (JSON) or audio data (binary)
        if (data instanceof Buffer || data instanceof ArrayBuffer) {
          // Binary audio data - forward to Deepgram
          if (deepgramConnection && deepgramConnection.getReadyState() === 1) {
            deepgramConnection.send(data);
          } else {
            console.warn(`⚠️ [${clientId}] Cannot send audio - Deepgram not ready (state: ${deepgramConnection?.getReadyState()})`);
          }
        } else {
          // Text/JSON message - parse and handle
          try {
            const message = JSON.parse(data.toString());

            if (message.type === 'KeepAlive' || message.type === 'keepalive') {
              // Keepalive message - just acknowledge
              console.log(`💓 [${clientId}] Keepalive received`);
            } else if (message.type === 'CloseStream') {
              // Client requesting to close stream
              console.log(`🛑 [${clientId}] Client requested stream close`);
              if (deepgramConnection) {
                deepgramConnection.finish();
              }
            } else {
              console.log(`📩 [${clientId}] Received message:`, message.type || 'unknown');
            }
          } catch (parseError) {
            console.warn(`⚠️ [${clientId}] Failed to parse message as JSON, treating as audio data`);
            // If it's not valid JSON, treat it as audio data
            if (deepgramConnection && deepgramConnection.getReadyState() === 1) {
              deepgramConnection.send(data);
            }
          }
        }
      } catch (error) {
        console.error(`❌ [${clientId}] Error processing message:`, error);
      }
    });

    // Handle client disconnection
    clientWs.on('close', (code, reason) => {
      activeConnections--;
      console.log(`👋 [${clientId}] Client disconnected (code: ${code}, reason: ${reason || 'none'})`);
      console.log(`   Active connections: ${activeConnections}`);

      // Clean up Deepgram connection
      if (deepgramConnection) {
        try {
          deepgramConnection.finish();
        } catch (error) {
          console.error(`⚠️ [${clientId}] Error closing Deepgram connection:`, error);
        }
      }
    });

    // Handle client errors
    clientWs.on('error', (error) => {
      console.error(`❌ [${clientId}] Client WebSocket error:`, error);
    });

  } catch (error) {
    console.error(`❌ [${clientId}] Fatal error during connection setup:`, error);

    // Send error to client
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({
        type: 'error',
        error: `Proxy setup failed: ${error.message}`
      }));
      clientWs.close(1011, 'Internal server error');
    }

    activeConnections--;
  }
});

// Error handling for WebSocket server
wss.on('error', (error) => {
  console.error('❌ WebSocket server error:', error);
});

// Start HTTP server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ Deepgram WebSocket Proxy Server running`);
  console.log(`   HTTP: http://localhost:${PORT}`);
  console.log(`   WebSocket: ws://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`\n📊 Ready to accept connections...`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n⚠️ SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n⚠️ SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
