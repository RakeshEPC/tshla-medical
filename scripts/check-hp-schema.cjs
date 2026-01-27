/**
 * Check patient_comprehensive_chart schema
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  console.log('🔍 Checking patient_comprehensive_chart schema\n');

  // Get one existing record to see structure
  const { data, error } = await supabase
    .from('patient_comprehensive_chart')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  if (data && data.length > 0) {
    console.log('✅ Sample record found:');
    console.log(JSON.stringify(data[0], null, 2));
  } else {
    console.log('⚠️  No records found in table');

    // Try to insert a minimal record to see what columns are required
    console.log('\n📝 Attempting minimal insert to see required fields...');

    const { error: insertError } = await supabase
      .from('patient_comprehensive_chart')
      .insert({
        patient_phone: 'test-phone',
        medications: [],
        diagnoses: [],
        labs: {},
        allergies: [],
        vitals: {}
      });

    if (insertError) {
      console.error('❌ Insert error:', insertError.message);
      console.log('Details:', insertError.details);
      console.log('Hint:', insertError.hint);
    } else {
      console.log('✅ Insert successful - now let\'s check:');

      const { data: newData } = await supabase
        .from('patient_comprehensive_chart')
        .select('*')
        .eq('patient_phone', 'test-phone')
        .single();

      console.log(JSON.stringify(newData, null, 2));

      // Clean up
      await supabase
        .from('patient_comprehensive_chart')
        .delete()
        .eq('patient_phone', 'test-phone');
    }
  }
}

checkSchema()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
