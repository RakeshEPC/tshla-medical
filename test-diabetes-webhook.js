#!/usr/bin/env node
/**
 * Test diabetes education webhook with different phone numbers
 */

const phoneNumbers = [
  '+18324003930',  // The hotline itself
  '+17138552377',  // Simrab Patel (registered)
  '+18326073630',  // Raman Patel (registered)
];

console.log('🧪 Testing Diabetes Education Webhook\n');
console.log('Testing against: https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/twilio/diabetes-education-inbound\n');

async function testPhoneNumber(phoneNumber) {
  console.log(`\n📞 Testing with caller: ${phoneNumber}`);
  console.log('─'.repeat(50));

  try {
    const response = await fetch(
      'https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/twilio/diabetes-education-inbound',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          CallSid: `TEST_${Date.now()}`,
          From: phoneNumber,
          To: '+18324003930',
          CallStatus: 'ringing'
        }).toString()
      }
    );

    const twiml = await response.text();

    // Parse the response
    if (twiml.includes('not registered')) {
      console.log('❌ RESULT: Phone number NOT REGISTERED');
    } else if (twiml.includes('Connecting to your diabetes educator')) {
      console.log('✅ RESULT: Phone number REGISTERED - Would connect to AI');

      // Check what type of connection
      if (twiml.includes('<Stream')) {
        console.log('   Connection type: WebSocket Stream');
        const match = twiml.match(/url="([^"]+)"/);
        if (match) {
          console.log('   WebSocket URL:', match[1]);
        }
      }
    } else if (twiml.includes('not configured')) {
      console.log('⚠️  RESULT: System configuration error (OpenAI API key missing)');
    } else if (twiml.includes('technical difficulties')) {
      console.log('⚠️  RESULT: Technical difficulties message');
    } else {
      console.log('❓ RESULT: Unknown response');
    }

    console.log('\nFull TwiML Response:');
    console.log(twiml);

  } catch (error) {
    console.error('❌ ERROR:', error.message);
  }
}

async function runTests() {
  for (const phone of phoneNumbers) {
    await testPhoneNumber(phone);
  }

  console.log('\n\n' + '='.repeat(50));
  console.log('SUMMARY');
  console.log('='.repeat(50));
  console.log('Registered numbers should show "Connecting to your diabetes educator"');
  console.log('Unregistered numbers should show "not registered"');
  console.log('\nIf you\'re getting "technical difficulties", it means:');
  console.log('1. Your phone IS registered, but');
  console.log('2. The WebSocket connection to OpenAI is failing');
}

runTests();
