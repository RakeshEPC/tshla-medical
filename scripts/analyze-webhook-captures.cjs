require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const { data, error } = await supabase
    .from('previsit_call_data')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('=== PREVISIT CALL DATA ANALYSIS ===\n');
  console.log(`📊 Total records: ${data.length}\n`);

  // Overall stats
  const withMeds = data.filter(d => d.medications && d.medications.length > 0);
  const withConcerns = data.filter(d => d.concerns && d.concerns.length > 0);
  const withQuestions = data.filter(d => d.questions && d.questions.length > 0);
  const withPhone = data.filter(d => d.phone_number);
  const withValidConvId = data.filter(d => d.conversation_id && d.conversation_id !== 'unknown');
  const missingConvId = data.filter(d => !d.conversation_id || d.conversation_id === 'unknown');

  console.log('📈 Overall Statistics:');
  console.log(`   Records with medications: ${withMeds.length}`);
  console.log(`   Records with concerns: ${withConcerns.length}`);
  console.log(`   Records with questions: ${withQuestions.length}`);
  console.log(`   Records with phone number: ${withPhone.length}`);
  console.log(`   Records with valid conversation_id: ${withValidConvId.length}`);
  console.log(`   Records missing conversation_id: ${missingConvId.length}`);
  console.log('');

  // Show records with actual clinical data
  const withData = data.filter(d =>
    (d.medications && d.medications.length > 0) ||
    (d.concerns && d.concerns.length > 0) ||
    (d.questions && d.questions.length > 0)
  );

  console.log(`📋 ${withData.length} Records with Clinical Data:\n`);
  withData.slice(0, 10).forEach((d, i) => {
    console.log(`${i+1}. Conversation: ${d.conversation_id || 'MISSING'}`);
    console.log(`   Phone: ${d.phone_number || 'N/A'}`);
    console.log(`   Created: ${new Date(d.created_at).toLocaleString()}`);
    if (d.medications && d.medications.length > 0) {
      console.log(`   💊 Medications: ${d.medications.join(', ')}`);
    }
    if (d.concerns && d.concerns.length > 0) {
      console.log(`   ⚠️  Concerns: ${d.concerns.join(', ')}`);
    }
    if (d.questions && d.questions.length > 0) {
      console.log(`   ❓ Questions: ${d.questions.join(', ')}`);
    }
    console.log('');
  });

  // Key finding
  console.log('\n=== KEY FINDING ===');
  if (missingConvId.length > 0) {
    console.log('⚠️  ISSUE: Some records are missing conversation_id');
    console.log(`   ${missingConvId.length} records have conversation_id = "unknown" or NULL`);
    console.log('   This means ElevenLabs webhooks are not passing conversation_id correctly.');
    console.log('');
    console.log('   🔧 FIX: In ElevenLabs tool configuration, ensure conversation_id is:');
    console.log('      - Type: "dynamic_variable"');
    console.log('      - Variable name: "conversation_id"');
    console.log('      - Required: true');
  }

  if (withValidConvId.length > 0 && missingConvId.length === 0) {
    console.log('✅ All records have valid conversation_id!');
    console.log('✅ Webhooks are configured correctly.');
  }

  if (withData.length > 0) {
    console.log(`\n✅ ${withData.length} calls successfully captured clinical data!`);
  }

  if (data.length > 0 && withData.length === 0) {
    console.log('\n⚠️  WARNING: Records exist but none have clinical data (medications/concerns/questions).');
    console.log('   This might mean:');
    console.log('   - Patients are not mentioning medications/concerns during calls');
    console.log('   - Agent is not calling the webhook tools');
    console.log('   - Agent prompt needs to instruct when to use tools');
  }
})();
