/**
 * ElevenLabs-Twilio WebSocket Relay Proxy
 *
 * Purpose: Bridge Twilio Media Streams to ElevenLabs Conversational AI
 *
 * Problem: Twilio's <Stream> doesn't support query parameters in WebSocket URLs,
 * but ElevenLabs' signed URLs require authentication query parameters.
 *
 * Solution: This proxy accepts Twilio connections (no query params),
 * then connects to ElevenLabs signed URL (with query params) and relays bidirectionally.
 */

const WebSocket = require('ws');
const http = require('http');

// Configuration
const PORT = process.env.ELEVENLABS_RELAY_PORT || 3001;

// Create HTTP server
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', service: 'elevenlabs-twilio-relay' }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// Create WebSocket server for Twilio connections
const wss = new WebSocket.Server({
  server,
  path: '/relay'
});

console.log('🔄 ElevenLabs-Twilio Relay Proxy starting...');

wss.on('connection', (twilioWs, req) => {
  console.log('\n📞 [Relay] New Twilio connection');

  // Extract ElevenLabs signed URL from custom parameters
  // Twilio sends this in the 'start' message
  let elevenLabsWs = null;
  let elevenLabsUrl = null;
  let isConnected = false;

  twilioWs.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      // Handle Twilio's start message
      if (data.event === 'start') {
        console.log('   📨 Twilio start event received');

        // Extract ElevenLabs URL from custom parameters
        const customParams = data.start?.customParameters || {};
        elevenLabsUrl = customParams.elevenlabs_url;

        if (!elevenLabsUrl) {
          console.error('   ❌ No ElevenLabs URL in custom parameters');
          twilioWs.close();
          return;
        }

        console.log('   🔗 Connecting to ElevenLabs:', elevenLabsUrl.substring(0, 60) + '...');

        // Connect to ElevenLabs
        elevenLabsWs = new WebSocket(elevenLabsUrl);

        elevenLabsWs.on('open', () => {
          console.log('   ✅ Connected to ElevenLabs');
          isConnected = true;
        });

        elevenLabsWs.on('message', (elevenLabsData) => {
          // Relay messages from ElevenLabs to Twilio
          if (twilioWs.readyState === WebSocket.OPEN) {
            twilioWs.send(elevenLabsData);
          }
        });

        elevenLabsWs.on('close', (code, reason) => {
          console.log('   📞 ElevenLabs disconnected:', code, reason.toString());
          if (twilioWs.readyState === WebSocket.OPEN) {
            twilioWs.close();
          }
        });

        elevenLabsWs.on('error', (error) => {
          console.error('   ❌ ElevenLabs WebSocket error:', error.message);
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
        console.log('   📞 Twilio stop event');
        if (elevenLabsWs && elevenLabsWs.readyState === WebSocket.OPEN) {
          elevenLabsWs.close();
        }
      }
    } catch (error) {
      console.error('   ❌ Error processing Twilio message:', error.message);
    }
  });

  twilioWs.on('close', (code, reason) => {
    console.log('   📞 Twilio disconnected:', code);
    if (elevenLabsWs && elevenLabsWs.readyState === WebSocket.OPEN) {
      elevenLabsWs.close();
    }
  });

  twilioWs.on('error', (error) => {
    console.error('   ❌ Twilio WebSocket error:', error.message);
    if (elevenLabsWs && elevenLabsWs.readyState === WebSocket.OPEN) {
      elevenLabsWs.close();
    }
  });
});

server.listen(PORT, () => {
  console.log(`✅ ElevenLabs-Twilio Relay listening on port ${PORT}`);
  console.log(`   WebSocket endpoint: ws://localhost:${PORT}/relay`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, closing server...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
