/**
 * Test Call Script
 * Makes a test pre-visit call using the Twilio service
 * Usage: npx tsx scripts/test-call.ts --phone="+15555555555" --name="John Doe"
 */

import { initiatePreVisitCall } from '../server/services/twilioService';

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name: string): string | undefined => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg?.split('=')[1];
};

const phoneNumber = getArg('phone');
const patientName = getArg('name') || 'Test Patient';
const appointmentDate = getArg('date') || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
const appointmentTime = getArg('time') || '10:00 AM';
const providerName = getArg('provider') || 'Dr. Smith';

if (!phoneNumber) {
  console.error('❌ Error: Phone number is required');
  console.log('\nUsage:');
  console.log('  npx tsx scripts/test-call.ts --phone="+15555555555" [options]');
  console.log('\nOptions:');
  console.log('  --phone="+15555555555"    Patient phone number (required)');
  console.log('  --name="John Doe"         Patient name (optional)');
  console.log('  --date="2025-01-15"       Appointment date (optional)');
  console.log('  --time="10:00 AM"         Appointment time (optional)');
  console.log('  --provider="Dr. Smith"    Provider name (optional)');
  console.log('\nExample:');
  console.log('  npx tsx scripts/test-call.ts --phone="+15555555555" --name="Jane Doe" --date="2025-01-20"');
  process.exit(1);
}

async function makeTestCall() {
  console.log('🚀 Initiating Pre-Visit Test Call');
  console.log('==================================');
  console.log(`   Patient: ${patientName}`);
  console.log(`   Phone: ${phoneNumber}`);
  console.log(`   Appointment: ${appointmentDate} at ${appointmentTime}`);
  console.log(`   Provider: ${providerName}`);
  console.log('');

  try {
    // For test purposes, we'll create a temporary patient ID
    // In production, this would come from your database
    const testPatientId = `test-${Date.now()}`;
    const testAppointmentId = `appt-${Date.now()}`;

    console.log('📞 Placing call via Twilio...');

    const result = await initiatePreVisitCall({
      patientId: testPatientId,
      patientName: patientName,
      patientPhone: phoneNumber,
      appointmentId: testAppointmentId,
      appointmentDate: appointmentDate,
      appointmentTime: appointmentTime,
      providerName: providerName,
      attemptNumber: 1,
    });

    if (result.success) {
      console.log('✅ Call initiated successfully!');
      console.log(`   Twilio Call SID: ${result.callSid}`);
      console.log('');
      console.log('📋 Next Steps:');
      console.log('   1. Answer the phone when it rings');
      console.log('   2. The AI agent will conduct the interview');
      console.log('   3. After the call, check the dashboard for results');
      console.log('   4. View transcript and extracted data in Supabase');
      console.log('');
      console.log('🔍 Monitor Progress:');
      console.log(`   - API Logs: Check terminal running previsit-api-server`);
      console.log(`   - Twilio Console: https://console.twilio.com/us1/monitor/logs/calls`);
      console.log(`   - Database: Check previsit_responses table in Supabase`);
      console.log(`   - Dashboard: http://localhost:5173/previsit-analytics`);
    } else {
      console.error('❌ Call failed:', result.error);
      console.log('');
      console.log('🔧 Troubleshooting:');
      console.log('   1. Check that API server is running: curl http://localhost:3100/health');
      console.log('   2. Verify Twilio credentials in .env');
      console.log('   3. Ensure phone number is in E.164 format (+15555555555)');
      console.log('   4. Check API server logs for errors');
    }

  } catch (error) {
    console.error('❌ Error making test call:', error);
    console.log('');
    console.log('💡 Common Issues:');
    console.log('   - API server not running → Run: ./start-previsit-api.sh');
    console.log('   - Missing Twilio credentials → Check .env file');
    console.log('   - Invalid phone number → Use E.164 format: +1XXXYYYZZZZ');
    console.log('   - No ElevenLabs Agent ID → Follow docs/ELEVENLABS_AGENT_SETUP.md');
    process.exit(1);
  }
}

// Run the test call
makeTestCall().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
