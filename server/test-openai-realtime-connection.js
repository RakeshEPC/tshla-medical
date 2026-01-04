/**
 * Test OpenAI Realtime API connection
 * This script tests if we can connect to OpenAI Realtime API from this environment
 */
const WebSocket = require('ws');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('❌ Missing OPENAI_API_KEY');
  console.log('\nPlease set one of:');
  console.log('  - OPENAI_API_KEY');
  console.log('  - VITE_OPENAI_API_KEY');
  process.exit(1);
}

console.log('🔑 OPENAI_API_KEY found (length:', OPENAI_API_KEY.length, ')');
console.log('🔗 Attempting to connect to OpenAI Realtime API...\n');

const url = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17';

const ws = new WebSocket(url, {
  headers: {
    'Authorization': `Bearer ${OPENAI_API_KEY}`,
    'OpenAI-Beta': 'realtime=v1'
  }
});

ws.on('open', () => {
  console.log('✅ Connected to OpenAI Realtime API!');
  console.log('\n📊 Sending session configuration...');

  const sessionConfig = {
    type: 'session.update',
    session: {
      modalities: ['text', 'audio'],
      instructions: 'You are a helpful AI assistant testing the connection.',
      voice: 'alloy',
      input_audio_format: 'g711_ulaw',
      output_audio_format: 'g711_ulaw',
      turn_detection: {
        type: 'server_vad'
      }
    }
  };

  ws.send(JSON.stringify(sessionConfig));
});

ws.on('message', (message) => {
  try {
    const data = JSON.parse(message);
    console.log('📨 Received:', data.type);

    if (data.type === 'session.created') {
      console.log('   Session ID:', data.session.id);
    }

    if (data.type === 'session.updated') {
      console.log('✅ Session configured successfully!');
      console.log('\n🎉 OpenAI Realtime API is working correctly.');
      console.log('The issue is likely with:');
      console.log('  1. Twilio WebSocket connection');
      console.log('  2. Azure Container App networking');
      console.log('  3. Phone number not registered in database');
      console.log('\nClosing connection...');
      ws.close();
      process.exit(0);
    }

    if (data.type === 'error') {
      console.error('❌ OpenAI Error:', data.error);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Error parsing message:', err);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket Error:', error.message);
  console.log('\nPossible causes:');
  console.log('  1. Invalid OPENAI_API_KEY');
  console.log('  2. Network firewall blocking wss:// connections');
  console.log('  3. OpenAI API is down');
  process.exit(1);
});

ws.on('close', (code, reason) => {
  console.log('\n🔌 Connection closed');
  if (code !== 1000) {
    console.log('   Code:', code);
    console.log('   Reason:', reason.toString());
  }
});

// Timeout after 10 seconds
setTimeout(() => {
  console.error('\n❌ Timeout - no response from OpenAI');
  ws.close();
  process.exit(1);
}, 10000);
