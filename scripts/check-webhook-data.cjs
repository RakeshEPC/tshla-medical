require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

(async () => {
  console.log('Checking previsit_call_data table for webhook captures...\n');

  const { data, error } = await supabase
    .from('previsit_call_data')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  console.log(`Total records: ${data.length}\n`);

  // Show records with conversation_id = "unknown" (these are webhook captures without conversation_id)
  const unknownConvos = data.filter(d => !d.conversation_id || d.conversation_id === 'unknown');
  console.log(`Records with conversation_id "unknown" or null: ${unknownConvos.length}`);

  if (unknownConvos.length > 0) {
    console.log('\n⚠️ ISSUE FOUND: Webhooks are being called but conversation_id is not being passed!\n');
    console.log('Most recent webhook captures (missing conversation_id):');
    unknownConvos.slice(0, 5).forEach((call, i) => {
      console.log(`\n${i + 1}. ID: ${call.id}`);
      console.log(`   Conversation ID: ${call.conversation_id || 'NULL'}`);
      console.log(`   Phone: ${call.phone_number || 'NULL'}`);
      console.log(`   Medications: ${JSON.stringify(call.medications)}`);
      console.log(`   Concerns: ${JSON.stringify(call.concerns)}`);
      console.log(`   Questions: ${JSON.stringify(call.questions)}`);
      console.log(`   Created: ${call.created_at}`);
    });
  }

  // Show records WITH valid conversation IDs
  const validConvos = data.filter(d => d.conversation_id && d.conversation_id !== 'unknown');
  console.log(`\n\nRecords with valid conversation_id: ${validConvos.length}`);

  if (validConvos.length > 0) {
    console.log('\nMost recent valid conversations:');
    validConvos.slice(0, 5).forEach((call, i) => {
      console.log(`\n${i + 1}. Conversation: ${call.conversation_id}`);
      console.log(`   Phone: ${call.phone_number || 'NULL'}`);
      console.log(`   Medications: ${JSON.stringify(call.medications)}`);
      console.log(`   Concerns: ${JSON.stringify(call.concerns)}`);
      console.log(`   Questions: ${JSON.stringify(call.questions)}`);
      console.log(`   Created: ${call.created_at}`);
    });
  }

  console.log('\n\n=== DIAGNOSIS ===');
  if (unknownConvos.length > 0) {
    console.log('✅ Webhooks ARE being called from ElevenLabs');
    console.log('✅ Data IS being captured (medications, concerns, questions)');
    console.log('❌ BUT conversation_id is NOT being passed correctly');
    console.log('\n🔧 FIX NEEDED:');
    console.log('   In ElevenLabs agent tool configuration, ensure conversation_id is set to:');
    console.log('   - Type: "dynamic_variable"');
    console.log('   - Variable: "conversation_id"');
    console.log('   - Required: true');
  } else if (validConvos.length > 0) {
    console.log('✅ Everything is working correctly!');
    console.log('✅ Webhooks are being called');
    console.log('✅ Conversation IDs are being passed');
    console.log('✅ Data is being captured');
  } else {
    console.log('❓ No webhook data found in database');
    console.log('   This could mean:');
    console.log('   1. No calls have been made yet');
    console.log('   2. Webhooks are not configured in ElevenLabs');
    console.log('   3. Webhooks are failing (check Azure logs)');
  }

})();
