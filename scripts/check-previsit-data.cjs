/**
 * Check all pre-visit call data in database
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPreVisitData() {
  console.log('🔍 Checking Pre-Visit Call Data in Database');
  console.log('=============================================\n');

  try {
    // Check previsit_call_data table
    console.log('📋 Querying previsit_call_data table...');
    const { data: callData, error: callError, count } = await supabase
      .from('previsit_call_data')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (callError) {
      console.error('❌ Error querying previsit_call_data:', callError);
    } else {
      console.log(`✅ Found ${count} records in previsit_call_data table\n`);

      if (callData && callData.length > 0) {
        console.log('Recent records:');
        callData.slice(0, 10).forEach((record, idx) => {
          console.log(`\n${idx + 1}. Record ID: ${record.id}`);
          console.log(`   Conversation ID: ${record.conversation_id || 'N/A'}`);
          console.log(`   Phone: ${record.phone_number || 'N/A'}`);
          console.log(`   Created: ${record.created_at}`);
          console.log(`   Medications: ${record.medications?.length || 0}`);
          console.log(`   Concerns: ${record.concerns?.length || 0}`);
          console.log(`   Questions: ${record.questions?.length || 0}`);
          console.log(`   Completed: ${record.completed_at ? 'Yes' : 'No'}`);
        });
      }
    }

    // Check if there are records with different structures
    console.log('\n\n📊 Data Structure Analysis:');
    const { data: allRecords } = await supabase
      .from('previsit_call_data')
      .select('*');

    if (allRecords) {
      const withConversationId = allRecords.filter(r => r.conversation_id).length;
      const withPhone = allRecords.filter(r => r.phone_number).length;
      const withMedications = allRecords.filter(r => r.medications && r.medications.length > 0).length;
      const withConcerns = allRecords.filter(r => r.concerns && r.concerns.length > 0).length;
      const withQuestions = allRecords.filter(r => r.questions && r.questions.length > 0).length;
      const completed = allRecords.filter(r => r.completed_at).length;

      console.log(`Total records: ${allRecords.length}`);
      console.log(`With conversation_id: ${withConversationId}`);
      console.log(`With phone_number: ${withPhone}`);
      console.log(`With medications: ${withMedications}`);
      console.log(`With concerns: ${withConcerns}`);
      console.log(`With questions: ${withQuestions}`);
      console.log(`Completed calls: ${completed}`);
    }

    // Check for any linked patient profiles
    console.log('\n\n🔗 Checking Patient Profile Links:');
    const { data: linkedData } = await supabase
      .from('previsit_call_data')
      .select('id, phone_number, patient_profile_id')
      .not('patient_profile_id', 'is', null);

    console.log(`Records linked to patient profiles: ${linkedData?.length || 0}`);
    if (linkedData && linkedData.length > 0) {
      linkedData.forEach(record => {
        console.log(`  - Phone: ${record.phone_number} → Profile ID: ${record.patient_profile_id}`);
      });
    }

    console.log('\n\n=============================================');
    console.log('✅ Database check complete!');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkPreVisitData().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
