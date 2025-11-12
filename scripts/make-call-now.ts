import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const twilio = require('twilio');

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID;

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
  console.error('❌ Missing Twilio credentials in .env');
  process.exit(1);
}

if (!ELEVENLABS_AGENT_ID || ELEVENLABS_AGENT_ID === 'placeholder_create_agent') {
  console.error('❌ Missing ElevenLabs Agent ID in .env');
  console.error('   Please update ELEVENLABS_AGENT_ID in your .env file');
  process.exit(1);
}

async function makeCall(toPhone: string, patientName: string) {
  console.log('📞 Initiating Pre-Visit Call');
  console.log('================================');
  console.log(`   To: ${toPhone}`);
  console.log(`   Patient: ${patientName}`);
  console.log(`   From: ${TWILIO_PHONE_NUMBER}`);
  console.log(`   Agent ID: ${ELEVENLABS_AGENT_ID}`);
  console.log('================================\n');

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

  try {
    const call = await client.calls.create({
      to: toPhone,
      from: TWILIO_PHONE_NUMBER,
      url: `http://localhost:3100/api/twilio/previsit-twiml?patientName=${encodeURIComponent(patientName)}&agentId=${ELEVENLABS_AGENT_ID}`,
      statusCallback: 'http://localhost:3100/api/twilio/call-status',
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
      machineDetection: 'DetectMessageEnd',
      timeout: 30,
    });

    console.log('✅ Call initiated successfully!');
    console.log(`   Call SID: ${call.sid}`);
    console.log(`   Status: ${call.status}`);
    console.log('\n📱 Your phone should ring in 10-15 seconds!');
    console.log('   Answer it and talk to Sarah from TSHLA Medical\n');

    return call;
  } catch (error: any) {
    console.error('❌ Call failed:', error.message);
    if (error.code === 21608) {
      console.error('\n⚠️  This phone number is not verified with your Twilio trial account');
      console.error('   Please verify it at: https://console.twilio.com/us1/develop/phone-numbers/manage/verified\n');
    }
    throw error;
  }
}

// Get phone number from command line
const phone = process.argv[2] || '+18326073630';
const name = process.argv[3] || 'Rakesh Patel';

makeCall(phone, name)
  .then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error:', error.message);
    process.exit(1);
  });
