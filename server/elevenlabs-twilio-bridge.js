/**
 * ElevenLabs + Twilio WebSocket Bridge
 *
 * This server acts as a middleware between Twilio Media Streams and ElevenLabs Conversational AI.
 * - Receives audio from Twilio (caller's voice)
 * - Forwards to ElevenLabs AI Agent
 * - Receives AI responses from ElevenLabs
 * - Sends AI audio back to Twilio (caller hears AI)
 */

const WebSocket = require('ws');
const https = require('https');

const PORT = process.env.BRIDGE_PORT || 3100;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || process.env.VITE_ELEVENLABS_API_KEY;
const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID;

// Create WebSocket server for Twilio to connect to
const wss = new WebSocket.Server({ port: PORT });

console.log(`🌉 ElevenLabs-Twilio Bridge listening on port ${PORT}`);
console.log(`📞 Agent ID: ${ELEVENLABS_AGENT_ID}`);

// Get signed URL from ElevenLabs
function getElevenLabsSignedUrl() {
  return new Promise((resolve, reject) => {
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

// Handle each incoming Twilio connection
wss.on('connection', async (twilioWs) => {
  console.log('📞 Twilio connected');

  let elevenLabsWs = null;
  let streamSid = null;

  try {
    // Get signed URL and connect to ElevenLabs
    const signedUrl = await getElevenLabsSignedUrl();
    console.log('✅ Got ElevenLabs signed URL');

    elevenLabsWs = new WebSocket(signedUrl);

    elevenLabsWs.on('open', () => {
      console.log('🤖 Connected to ElevenLabs AI');
    });

    // Forward audio from Twilio to ElevenLabs
    twilioWs.on('message', (message) => {
      try {
        const msg = JSON.parse(message);

        if (msg.event === 'start') {
          streamSid = msg.start.streamSid;
          console.log(`📞 Stream started: ${streamSid}`);
          console.log(`📞 Call SID: ${msg.start.callSid}`);

          // Send connected event back to Twilio to acknowledge the stream
          const connectedMessage = {
            event: 'connected',
            protocol: 'Call',
            version: '1.0.0'
          };
          twilioWs.send(JSON.stringify(connectedMessage));
          console.log('✅ Sent connected event to Twilio');
        }
        else if (msg.event === 'media') {
          // Forward caller audio to ElevenLabs
          // Twilio sends base64 encoded μ-law audio in msg.media.payload
          if (elevenLabsWs && elevenLabsWs.readyState === WebSocket.OPEN) {
            const audioData = {
              user_audio_chunk: Buffer.from(msg.media.payload, 'base64').toString('base64')
            };
            elevenLabsWs.send(JSON.stringify(audioData));
          }
        }
        else if (msg.event === 'stop') {
          console.log('📞 Stream stopped');
          if (elevenLabsWs) elevenLabsWs.close();
        }
      } catch (error) {
        console.error('❌ Error processing Twilio message:', error);
      }
    });

    // Forward AI responses from ElevenLabs back to Twilio
    elevenLabsWs.on('message', (message) => {
      try {
        const msg = JSON.parse(message);

        // ElevenLabs Conversational AI sends audio in audio_event
        if (msg.type === 'audio' && msg.audio_event && twilioWs.readyState === WebSocket.OPEN) {
          const audioData = msg.audio_event.audio_base_64;

          if (audioData) {
            // Send audio back to caller
            const mediaMessage = {
              event: 'media',
              streamSid: streamSid,
              media: {
                payload: audioData  // Base64 μ-law audio from ElevenLabs
              }
            };
            twilioWs.send(JSON.stringify(mediaMessage));
            console.log('🔊 Sent audio chunk to caller');
          }
        }

        // Log other message types for debugging
        if (msg.type && msg.type !== 'ping') {
          console.log(`🤖 Message type: ${msg.type}`);
        }
      } catch (error) {
        console.error('❌ Error processing ElevenLabs message:', error);
      }
    });

    elevenLabsWs.on('error', (error) => {
      console.error('❌ ElevenLabs WebSocket error:', error);
    });

    elevenLabsWs.on('close', () => {
      console.log('🤖 ElevenLabs disconnected');
      if (twilioWs) twilioWs.close();
    });

  } catch (error) {
    console.error('❌ Failed to connect to ElevenLabs:', error);
    twilioWs.close();
  }

  twilioWs.on('error', (error) => {
    console.error('❌ Twilio WebSocket error:', error);
  });

  twilioWs.on('close', () => {
    console.log('📞 Twilio disconnected');
    if (elevenLabsWs) elevenLabsWs.close();
  });
});

wss.on('error', (error) => {
  console.error('❌ WebSocket Server error:', error);
});
