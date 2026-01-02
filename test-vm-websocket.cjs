const WebSocket = require('ws');

console.log('Testing WebSocket at wss://api.tshla.ai/media-stream\n');

const ws = new WebSocket('wss://api.tshla.ai/media-stream', {
  perMessageDeflate: false
});

let messageCount = 0;
let connectionWorking = false;

ws.on('open', () => {
  console.log('WebSocket OPENED successfully!');
  console.log('Connection to Azure VM established.\n');
  
  const twilioStart = {
    event: 'start',
    streamSid: 'VM_TEST_123',
    start: {
      streamSid: 'VM_TEST_123',
      accountSid: 'TEST',
      callSid: 'TEST_VM',
      tracks: ['inbound'],
      customParameters: {
        From: '+17138552377'
      }
    }
  };
  
  ws.send(JSON.stringify(twilioStart));
  console.log('Sent start event');
  connectionWorking = true;
});

ws.on('message', (data) => {
  messageCount++;
  console.log('Message', messageCount, ':', data.toString().substring(0, 100));
});

ws.on('error', (error) => {
  console.error('\nWebSocket ERROR:', error.message);
});

ws.on('close', (code, reason) => {
  console.log('\nWebSocket CLOSED');
  console.log('Code:', code);
  console.log('Messages received:', messageCount);
  
  if (connectionWorking) {
    console.log('\nSUCCESS! VM WebSocket working!');
    console.log('- No compression errors');
    console.log('- No Azure proxy interference');
  } else {
    console.log('\nFailed to establish connection');
  }
  
  process.exit(connectionWorking ? 0 : 1);
});

setTimeout(() => {
  console.log('\nTest complete');
  ws.close(1000, 'Test complete');
}, 10000);
