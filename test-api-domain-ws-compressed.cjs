const WebSocket = require('ws');

console.log('Testing WebSocket at wss://api.tshla.ai/media-stream WITH COMPRESSION\n');

const ws = new WebSocket('wss://api.tshla.ai/media-stream', {
  perMessageDeflate: true  // Enable compression like Twilio uses
});

let messageCount = 0;

ws.on('open', () => {
  console.log('Connected successfully!');

  const twilioStart = {
    event: 'start',
    streamSid: 'COMPRESSION_TEST',
    start: {
      streamSid: 'COMPRESSION_TEST',
      accountSid: 'TEST',
      callSid: 'TEST',
      tracks: ['inbound'],
      customParameters: {
        From: '+17138552377'
      }
    }
  };

  ws.send(JSON.stringify(twilioStart));
  console.log('Sent start event\n');
});

ws.on('message', (data) => {
  messageCount++;
  try {
    const message = JSON.parse(data.toString());
    console.log('Message', messageCount, ':', JSON.stringify(message, null, 2));
  } catch (e) {
    console.log('Message', messageCount, '(raw):', data.toString().substring(0, 200));
  }
});

ws.on('error', (error) => {
  console.error('\nERROR:', error.message);
});

ws.on('close', (code, reason) => {
  console.log('\nClosed - Code:', code, 'Messages received:', messageCount);
});

setTimeout(() => {
  console.log('\nTest complete - closing');
  ws.close();
  setTimeout(() => process.exit(0), 1000);
}, 10000);
