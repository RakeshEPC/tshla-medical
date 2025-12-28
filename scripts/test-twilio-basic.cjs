/**
 * Basic Twilio Test Call Script
 * Makes a simple test call that plays a message - no AI dependencies
 * Usage: node scripts/test-twilio-basic.js --phone="+15555555555"
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const twilio = require('twilio');

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name) => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg?.split('=')[1];
};

const testPhone = getArg('phone');

console.log('╔═══════════════════════════════════════════════════════════════════╗');
console.log('║           BASIC TWILIO TEST CALL                                  ║');
console.log('╚═══════════════════════════════════════════════════════════════════╝');
console.log('');

// Validate inputs
if (!testPhone) {
  console.log('❌ Error: Phone number required');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/test-twilio-basic.js --phone="+15555555555"');
  console.log('');
  console.log('Example:');
  console.log('  node scripts/test-twilio-basic.js --phone="+18326073630"');
  console.log('');
  process.exit(1);
}

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
  console.log('❌ Error: Missing Twilio credentials in .env');
  console.log('');
  console.log('Please ensure these are set:');
  console.log('  TWILIO_ACCOUNT_SID');
  console.log('  TWILIO_AUTH_TOKEN');
  console.log('  TWILIO_PHONE_NUMBER');
  console.log('');
  process.exit(1);
}

// Initialize Twilio client
const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// Create TwiML (XML) response for the call
// This will be played when the call is answered
const createTwiML = () => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-US">
    Hello! This is a test call from TSHLA Medical's automated system.
    If you can hear this message, your Twilio phone number is working correctly.
    This is just a test. Thank you, and goodbye!
  </Say>
  <Pause length="1"/>
  <Hangup/>
</Response>`;
};

async function makeTestCall() {
  console.log('📞 Test Call Details:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   To: ${testPhone}`);
  console.log(`   From: ${TWILIO_PHONE_NUMBER}`);
  console.log(`   Message: "Hello! This is a test call..."`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  console.log('⏳ Initiating call...');
  console.log('');

  try {
    // Create the call
    const call = await client.calls.create({
      to: testPhone,
      from: TWILIO_PHONE_NUMBER,
      twiml: createTwiML(),
      statusCallback: '', // No callback for basic test
      statusCallbackMethod: 'POST',
      timeout: 30, // Ring for 30 seconds
    });

    console.log('✅ Call initiated successfully!');
    console.log('');
    console.log('📋 Call Details:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Call SID: ${call.sid}`);
    console.log(`   Status: ${call.status}`);
    console.log(`   Direction: ${call.direction}`);
    console.log(`   To: ${call.to}`);
    console.log(`   From: ${call.from}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    console.log('📱 What to Expect:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   1. Your phone will ring in 10-15 seconds');
    console.log('   2. Answer the call');
    console.log('   3. You\'ll hear: "Hello! This is a test call..."');
    console.log('   4. The call will automatically hang up after the message');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    console.log('🔍 Monitor Call Status:');
    console.log(`   Twilio Console: https://console.twilio.com/us1/monitor/logs/calls/${call.sid}`);
    console.log('');

    console.log('⏳ Waiting 5 seconds to check call status...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Fetch updated call status
    const updatedCall = await client.calls(call.sid).fetch();
    console.log('');
    console.log('📊 Call Status Update:');
    console.log(`   Status: ${updatedCall.status}`);
    console.log(`   Duration: ${updatedCall.duration || 'In progress'} seconds`);
    console.log('');

    if (updatedCall.status === 'ringing' || updatedCall.status === 'in-progress' || updatedCall.status === 'completed') {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ TEST PASSED! Twilio is working correctly.');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      console.log('Next Steps:');
      console.log('  1. Verify you received the call and heard the message');
      console.log('  2. If that worked, test the full pre-visit system:');
      console.log('     npx tsx scripts/test-call.ts --phone="' + testPhone + '"');
      console.log('');
      return true;
    } else if (updatedCall.status === 'busy') {
      console.log('⚠️  Call status: BUSY');
      console.log('   The phone number may be busy. Try again in a moment.');
      console.log('');
      return false;
    } else if (updatedCall.status === 'no-answer') {
      console.log('⚠️  Call status: NO ANSWER');
      console.log('   The call rang but was not answered.');
      console.log('   This is normal if you didn\'t answer. Twilio is working!');
      console.log('');
      return true;
    } else if (updatedCall.status === 'failed') {
      console.log('❌ Call status: FAILED');
      console.log('   The call could not be completed.');
      console.log(`   Error: ${updatedCall.errorMessage || 'Unknown'}`);
      console.log('');
      return false;
    } else {
      console.log(`ℹ️  Call status: ${updatedCall.status}`);
      console.log('   Check the Twilio console for more details.');
      console.log('');
      return false;
    }

  } catch (error) {
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('❌ TEST FAILED!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('Error Details:');
    console.log(`   ${error.message}`);
    console.log('');

    if (error.code === 21608) {
      console.log('🔧 Troubleshooting:');
      console.log('   This number is not verified with your Twilio trial account.');
      console.log('   ');
      console.log('   To fix this:');
      console.log('   1. Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/verified');
      console.log('   2. Click "Add a new number"');
      console.log(`   3. Enter: ${testPhone}`);
      console.log('   4. Complete the verification process');
      console.log('   5. Run this test again');
      console.log('');
      console.log('   OR upgrade your Twilio account to call any number without verification.');
      console.log('');
    } else if (error.code === 21614) {
      console.log('🔧 Troubleshooting:');
      console.log('   The "To" phone number is not a valid phone number.');
      console.log('   ');
      console.log('   Make sure:');
      console.log('   - Phone number is in E.164 format: +1XXXYYYZZZZ');
      console.log('   - Include country code (+1 for US)');
      console.log('   - No spaces or dashes');
      console.log('');
    } else if (error.code === 20003) {
      console.log('🔧 Troubleshooting:');
      console.log('   Authentication failed - invalid credentials.');
      console.log('   ');
      console.log('   Check your .env file:');
      console.log('   1. TWILIO_ACCOUNT_SID should start with "AC"');
      console.log('   2. TWILIO_AUTH_TOKEN should be 32 characters');
      console.log('   3. Both should match your Twilio console values');
      console.log('');
      console.log('   Get credentials at: https://console.twilio.com/');
      console.log('');
    } else {
      console.log('🔧 Troubleshooting:');
      console.log('   1. Run verification first: node scripts/verify-twilio.js');
      console.log('   2. Check Twilio console: https://console.twilio.com/');
      console.log('   3. Verify billing is up to date');
      console.log('   4. Check account balance');
      console.log('');
    }

    return false;
  }
}

// Run the test
makeTestCall()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('\n💥 Fatal Error:', error);
    process.exit(1);
  });
