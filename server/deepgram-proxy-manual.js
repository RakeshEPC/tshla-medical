/**
 * Deepgram WebSocket Proxy Server (Manual Implementation)
 *
 * This version manually creates WebSocket connections to Deepgram
 * instead of using the Deepgram SDK, giving us more control.
 */

require('dotenv').config();

const WebSocket = require('ws');
const http = require('http');

// Configuration
const PORT = process.env.PORT || 8080;
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || process.env.VITE_DEEPGRAM_API_KEY;

if (!DEEPGRAM_API_KEY) {
  console.error('❌ FATAL: Deepgram API key not found');
  process.exit(1);
}

const keyPreview = DEEPGRAM_API_KEY.substring(0, 8) + '...' + DEEPGRAM_API_KEY.substring(DEEPGRAM_API_KEY.length - 4);
console.log('✅ Deepgram Proxy Server (Manual WebSocket)');
console.log(`   API Key: ${keyPreview}`);
console.log(`   Port: ${PORT}`);

// Create HTTP server for WebSocket upgrade
const server = http.createServer((req, res) => {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      service: 'deepgram-proxy-manual',
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Deepgram WebSocket Proxy Server (Manual)\nConnect via WebSocket to /');
  }
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

console.log(`🚀 WebSocket server ready on port ${PORT}`);

// Track active connections
let activeConnections = 0;

wss.on('connection', (clientWs, req) => {
  activeConnections++;
  const clientId = `client-${Date.now()}`;

  console.log(`\n📱 [${clientId}] New client connected (Total: ${activeConnections})`);
  console.log(`   IP: ${req.socket.remoteAddress}`);
  console.log(`   URL: ${req.url}`);

  let deepgramWs = null;

  try {
    // Parse query parameters
    const url = new URL(req.url, `http://${req.headers.host}`);
    const params = url.searchParams;

    // Build Deepgram WebSocket URL by forwarding ALL client parameters
    // This ensures all configuration (sample_rate, tier, diarize, etc.) is passed through
    const deepgramParams = new URLSearchParams();

    // Forward all parameters from client to Deepgram
    for (const [key, value] of params.entries()) {
      deepgramParams.append(key, value);
    }

    const deepgramUrl = `wss://api.deepgram.com/v1/listen?${deepgramParams.toString()}`;
    console.log(`🔗 [${clientId}] Connecting to Deepgram...`);
    console.log(`   Full URL: ${deepgramUrl}`);
    console.log(`   Authorization: Token ${keyPreview}`);
    console.log(`   API Key length: ${DEEPGRAM_API_KEY.length} chars`);

    // Create WebSocket connection to Deepgram with Authorization header
    deepgramWs = new WebSocket(deepgramUrl, {
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`
      }
    });

    // Set up Deepgram WebSocket handlers
    deepgramWs.on('open', () => {
      console.log(`✅✅✅ [${clientId}] Deepgram connection OPENED!`);

      // Notify client
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          type: 'open',
          message: 'Deepgram connection established'
        }));
      }
    });

    deepgramWs.on('message', (data) => {
      // Forward all messages from Deepgram to client
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data);

        // Log transcripts
        try {
          const msg = JSON.parse(data);
          const transcript = msg.channel?.alternatives?.[0]?.transcript;
          if (transcript && transcript.trim()) {
            console.log(`📝 [${clientId}] Transcript: "${transcript}" (final: ${msg.is_final})`);
          }
        } catch (e) {
          // Not JSON or doesn't have transcript, ignore
        }
      }
    });

    deepgramWs.on('error', (error) => {
      console.error(`❌ [${clientId}] Deepgram error:`, error.message);

      // Forward error to client
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          type: 'error',
          error: error.message
        }));
      }
    });

    deepgramWs.on('close', (code, reason) => {
      console.log(`⚠️ [${clientId}] Deepgram closed: code=${code}, reason=${reason || 'none'}`);

      // Forward close to client
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          type: 'close',
          code,
          reason: reason.toString()
        }));
      }
    });

    // Track audio data for debugging
    let audioChunksReceived = 0;
    let totalAudioBytes = 0;

    // Handle messages from client -> Deepgram
    clientWs.on('message', (data) => {
      if (deepgramWs && deepgramWs.readyState === WebSocket.OPEN) {
        // Check if it's a control message
        try {
          const msg = JSON.parse(data);
          if (msg.type === 'KeepAlive' || msg.type === 'keepalive') {
            console.log(`💓 [${clientId}] Keepalive`);
            return;
          }
          if (msg.type === 'CloseStream') {
            console.log(`🛑 [${clientId}] Close requested`);
            console.log(`   Audio stats: ${audioChunksReceived} chunks, ${totalAudioBytes} bytes total`);
            deepgramWs.close();
            return;
          }
        } catch (e) {
          // Not JSON, treat as audio data
          audioChunksReceived++;
          totalAudioBytes += data.length || data.byteLength || 0;

          if (audioChunksReceived === 1) {
            console.log(`🎤 [${clientId}] First audio chunk received! Size: ${data.length || data.byteLength} bytes`);
          } else if (audioChunksReceived % 10 === 0) {
            console.log(`🎤 [${clientId}] Received ${audioChunksReceived} audio chunks (${totalAudioBytes} bytes total)`);
          }
        }

        // Forward audio data to Deepgram
        deepgramWs.send(data);
      }
    });

    // Handle client disconnection
    clientWs.on('close', (code, reason) => {
      activeConnections--;
      console.log(`👋 [${clientId}] Client disconnected (code: ${code})`);
      console.log(`   Active connections: ${activeConnections}`);

      // Close Deepgram connection
      if (deepgramWs) {
        deepgramWs.close();
      }
    });

    clientWs.on('error', (error) => {
      console.error(`❌ [${clientId}] Client error:`, error.message);
    });

  } catch (error) {
    console.error(`❌ [${clientId}] Fatal error:`, error);
    activeConnections--;

    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({
        type: 'error',
        error: `Proxy setup failed: ${error.message}`
      }));
      clientWs.close();
    }
  }
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ Deepgram WebSocket Proxy Server running`);
  console.log(`   HTTP: http://localhost:${PORT}`);
  console.log(`   WebSocket: ws://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`\n📊 Ready to accept connections...`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n⚠️ SIGTERM received, shutting down...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n⚠️ SIGINT received, shutting down...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
