/**
 * Test Azure OpenAI Realtime API connection
 * This script tests if we can connect to Azure OpenAI Realtime API from this environment
 *
 * HIPAA COMPLIANT - Uses Azure OpenAI with Microsoft BAA
 */
const WebSocket = require('ws');

const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_KEY = process.env.AZURE_OPENAI_KEY;
const AZURE_OPENAI_REALTIME_DEPLOYMENT = process.env.AZURE_OPENAI_REALTIME_DEPLOYMENT || 'gpt-4o-realtime-preview';
const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2024-10-01-preview';

if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_KEY) {
  console.error('❌ Missing Azure OpenAI credentials');
  console.error('\nRequired environment variables:');
  console.error('  - AZURE_OPENAI_ENDPOINT (e.g., https://tshla-openai-prod.openai.azure.com)');
  console.error('  - AZURE_OPENAI_KEY (your Azure OpenAI API key)');
  console.error('\nOptional:');
  console.error('  - AZURE_OPENAI_REALTIME_DEPLOYMENT (default: gpt-4o-realtime-preview)');
  console.error('  - AZURE_OPENAI_API_VERSION (default: 2024-10-01-preview)');
  process.exit(1);
}

console.log('🔑 Azure OpenAI credentials found');
console.log('   Endpoint:', AZURE_OPENAI_ENDPOINT);
console.log('   Deployment:', AZURE_OPENAI_REALTIME_DEPLOYMENT);
console.log('   API Version:', AZURE_OPENAI_API_VERSION);
console.log('   API Key length:', AZURE_OPENAI_KEY.length);
console.log('\n🔗 Attempting to connect to Azure OpenAI Realtime API...\n');

// Build Azure OpenAI Realtime WebSocket URL
const hostname = AZURE_OPENAI_ENDPOINT.replace('https://', '').replace('http://', '');
const url = `wss://${hostname}/openai/realtime?api-version=${AZURE_OPENAI_API_VERSION}&deployment=${AZURE_OPENAI_REALTIME_DEPLOYMENT}`;

console.log('   WebSocket URL:', url);
console.log('');

const ws = new WebSocket(url, {
  headers: {
    'api-key': AZURE_OPENAI_KEY
  }
});

ws.on('open', () => {
  console.log('✅ Connected to Azure OpenAI Realtime API!');
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
      console.log('\n🎉 Azure OpenAI Realtime API is working correctly.');
      console.log('The issue is likely with:');
      console.log('  1. Twilio WebSocket connection');
      console.log('  2. Azure Container App networking');
      console.log('  3. Phone number not registered in database');
      console.log('\nClosing connection...');
      ws.close();
      process.exit(0);
    }

    if (data.type === 'error') {
      console.error('❌ Azure OpenAI Error:', data.error);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Error parsing message:', err);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket Error:', error.message);
  console.log('\nPossible causes:');
  console.log('  1. Invalid AZURE_OPENAI_KEY');
  console.log('  2. Incorrect AZURE_OPENAI_ENDPOINT');
  console.log('  3. Deployment name not found (check AZURE_OPENAI_REALTIME_DEPLOYMENT)');
  console.log('  4. Network firewall blocking wss:// connections');
  console.log('  5. Azure OpenAI region does not support Realtime API');
  console.log('\nVerify your Azure OpenAI resource in Azure Portal:');
  console.log('  - Keys and Endpoint tab for correct credentials');
  console.log('  - Deployments tab to confirm realtime deployment exists');
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
  console.error('\n❌ Timeout - no response from Azure OpenAI');
  ws.close();
  process.exit(1);
}, 10000);
