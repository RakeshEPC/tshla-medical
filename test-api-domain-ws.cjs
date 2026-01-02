const WebSocket = require('ws');

console.log('Testing WebSocket at wss://api.tshla.ai/media-stream\n');
console.log('This test simulates a Twilio Media Stream connection\n');

const ws = new WebSocket('wss://api.tshla.ai/media-stream', {
  perMessageDeflate: false
});

let messageCount = 0;
let startMessageSent = false;

ws.on('open', () => {
  console.log('Connected successfully!');
  console.log('Connection to custom domain established.\n');

  const twilioStart = {
    event: 'start',
    streamSid: 'CUSTOM_DOMAIN_TEST',
    start: {
      streamSid: 'CUSTOM_DOMAIN_TEST',
      accountSid: 'TEST_ACCOUNT',
      callSid: 'TEST_CALL_123',
      tracks: ['inbound', 'outbound'],
      customParameters: {
        From: '+17138552377',
        patientId: 'e4f74c10-17cb-46ab-8a6e-fc2b68215a81',
        patientName: 'Simrab Patel',
        language: 'en'
      }
    }
  };

  ws.send(JSON.stringify(twilioStart));
  console.log('Sent Twilio start event');
  startMessageSent = true;
});

ws.on('message', (data) => {
  messageCount++;
  try {
    const message = JSON.parse(data.toString());
    console.log('Message', messageCount, ':', message.event || message.type || 'unknown');

    if (message.error) {
      console.error('   Error:', message.error);
    }
  } catch (e) {
    console.log('Message', messageCount, ':', data.toString().substring(0, 100));
  }
});

ws.on('error', (error) => {
  console.error('\nWebSocket ERROR:', error.message);
  if (!startMessageSent) {
    console.log('   Connection failed before start message could be sent');
  }
});

ws.on('close', (code, reason) => {
  console.log('\nWebSocket CLOSED');
  console.log('   Code:', code);
  console.log('   Reason:', reason || 'No reason provided');
  console.log('   Messages received:', messageCount);

  if (code === 1006) {
    console.log('\nCode 1006 = Abnormal closure (connection lost)');
    if (messageCount > 0) {
      console.log('   BUT we received messages, so connection was working!');
    } else {
      console.log('   No messages received - connection issue');
    }
  } else if (code === 1000) {
    console.log('\nNormal closure - connection was successful!');
  }
});

setTimeout(() => {
  console.log('\n10 second test complete');
  console.log('Final message count:', messageCount);
  ws.close(1000, 'Test complete');
  setTimeout(() => process.exit(0), 1000);
}, 10000);
