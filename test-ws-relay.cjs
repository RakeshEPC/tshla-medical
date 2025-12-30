const WebSocket = require('ws');

console.log('Testing WebSocket Relay at /media-stream\n');

const ws = new WebSocket('wss://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/media-stream');

ws.on('open', () => {
  console.log('✅ WebSocket opened');

  const twilioStart = {
    event: 'start',
    streamSid: 'TEST123',
    start: {
      streamSid: 'TEST123',
      accountSid: 'TEST',
      callSid: 'TEST_CALL',
      tracks: ['inbound', 'outbound'],
      customParameters: {
        From: '+17138552377'
      }
    }
  };

  ws.send(JSON.stringify(twilioStart));
  console.log('📤 Sent start message');
});

ws.on('message', (data) => {
  console.log('📨 Received:', data.toString());
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', (code) => {
  console.log('🔌 WebSocket closed:', code);
});

setTimeout(() => {
  console.log('\n⏱️  Timeout');
  ws.close();
  process.exit(0);
}, 10000);
