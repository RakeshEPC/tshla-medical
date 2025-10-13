// Test Deepgram SDK directly
require('dotenv').config();
const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');

const API_KEY = process.env.DEEPGRAM_API_KEY || process.env.VITE_DEEPGRAM_API_KEY;

console.log('🧪 Testing Deepgram SDK Connection');
console.log('   API Key:', API_KEY ? API_KEY.substring(0, 8) + '...' : 'MISSING');

if (!API_KEY) {
  console.error('❌ No API key found!');
  process.exit(1);
}

// Create client
const deepgram = createClient(API_KEY);
console.log('✅ Client created');

// Test configuration
const config = {
  model: 'nova-2-medical',
  language: 'en-US',
  encoding: 'linear16',
  sample_rate: 16000,
  channels: 1,
  punctuate: true,
  interim_results: true,
};

console.log('🔧 Config:', config);
console.log('🚀 Attempting to create live connection...');

try {
  const connection = deepgram.listen.live(config);
  console.log('✅ Connection object created');

  connection.on(LiveTranscriptionEvents.Open, () => {
    console.log('✅✅✅ Connection OPENED! Deepgram is working!');
    setTimeout(() => {
      connection.finish();
      process.exit(0);
    }, 1000);
  });

  connection.on(LiveTranscriptionEvents.Error, (error) => {
    console.error('❌ Connection ERROR:', error);
    console.error('   Error type:', typeof error);
    console.error('   Error message:', error?.message || error);
    console.error('   Status code:', error?.statusCode);
    console.error('   Request ID:', error?.requestId);
    console.error('   URL:', error?.url);
    console.error('   Ready state:', error?.readyState);
    process.exit(1);
  });

  connection.on(LiveTranscriptionEvents.Close, (event) => {
    console.log('⚠️ Connection CLOSED');
    console.log('   Code:', event?.code);
    console.log('   Reason:', event?.reason);
    process.exit(event?.code === 1000 ? 0 : 1);
  });

  console.log('⏳ Waiting for connection to open...');

  // Timeout after 10 seconds
  setTimeout(() => {
    console.error('❌ TIMEOUT: Connection did not open within 10 seconds');
    connection.finish();
    process.exit(1);
  }, 10000);

} catch (error) {
  console.error('❌ EXCEPTION creating connection:', error);
  process.exit(1);
}
