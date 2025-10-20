const WebSocket = require('ws');

const wsUrl = 'wss://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/ws/deepgram?model=nova-2-medical&language=en-US&encoding=linear16&sample_rate=48000';

console.log('Connecting to:', wsUrl);

const ws = new WebSocket(wsUrl);

ws.on('open', () => {
  console.log('✅ WebSocket connection opened');
  
  setTimeout(() => {
    console.log('Sending test message...');
    ws.send(JSON.stringify({ type: 'test' }));
  }, 1000);
  
  setTimeout(() => {
    console.log('Closing connection...');
    ws.close();
  }, 3000);
});

ws.on('message', (data) => {
  console.log('📨 Received message:', data.toString());
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', (code, reason) => {
  console.log('🔌 WebSocket closed: code=' + code);
  process.exit(0);
});

setTimeout(() => {
  console.log('❌ Connection timeout');
  ws.close();
  process.exit(1);
}, 10000);
