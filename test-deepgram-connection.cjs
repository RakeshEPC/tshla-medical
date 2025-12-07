#!/usr/bin/env node

/**
 * Test Deepgram SDK Connection
 * Tests if we can successfully connect to Deepgram API
 */

const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');

const DEEPGRAM_API_KEY = '5eaf3770008de5791602514854572c8f311132d7';

console.log('🔍 Testing Deepgram SDK Connection...\n');
console.log('API Key:', DEEPGRAM_API_KEY.substring(0, 10) + '...');

// Create Deepgram client
const deepgram = createClient(DEEPGRAM_API_KEY);
console.log('✅ Deepgram client created\n');

// Test configuration
const config = {
  model: 'nova-2-medical',
  language: 'en-US',
  encoding: 'linear16',
  sample_rate: 16000,
  channels: 1,
  smart_format: true,
  interim_results: true
};

console.log('Configuration:', JSON.stringify(config, null, 2));
console.log('\n🔄 Creating live transcription connection...\n');

try {
  const connection = deepgram.listen.live(config);

  console.log('✅ Connection object created');
  console.log('   Type:', typeof connection);
  console.log('   Has getReadyState:', typeof connection.getReadyState === 'function');
  console.log('   Initial state:', connection.getReadyState?.());

  // Set up event handlers
  connection.on(LiveTranscriptionEvents.Open, () => {
    console.log('\n🎉 SUCCESS! Deepgram connection opened!');
    console.log('   Connection is working correctly.');
    connection.finish();
    process.exit(0);
  });

  connection.on(LiveTranscriptionEvents.Error, (error) => {
    console.error('\n❌ Deepgram Error Event:', {
      error: error,
      message: error?.message,
      type: error?.type,
      code: error?.code,
      stack: error?.stack
    });
  });

  connection.on(LiveTranscriptionEvents.Close, (event) => {
    console.log('\n🔌 Connection closed:', {
      code: event?.code,
      reason: event?.reason,
      wasClean: event?.wasClean
    });

    if (!event?.wasClean) {
      console.error('\n❌ FAILED: Connection closed abnormally (code 1006)');
      console.error('   This indicates an authentication or configuration problem.');
      process.exit(1);
    }
  });

  // Wait for connection
  console.log('\n⏳ Waiting for connection to open (timeout: 10s)...');

  setTimeout(() => {
    console.error('\n❌ TIMEOUT: Connection did not open within 10 seconds');
    console.error('   Current state:', connection.getReadyState?.());
    process.exit(1);
  }, 10000);

} catch (error) {
  console.error('\n❌ EXCEPTION while creating connection:');
  console.error('   Error:', error.message);
  console.error('   Stack:', error.stack);
  process.exit(1);
}
