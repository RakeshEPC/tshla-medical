/**
 * Check imported medications
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://minvvjdflezibmgkplqb.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMeds() {
  try {
    console.log('🔍 Checking imported medications...\n');

    // Get all medications
    const { data: all, error: allError } = await supabase
      .from('patient_medications')
      .select('id, tshla_id, medication_name, status')
      .limit(10);

    if (allError) {
      console.error('❌ Error:', allError.message);
      return;
    }

    console.log('Total medications in table:', all?.length || 0);

    if (all && all.length > 0) {
      console.log('\nFirst 10 medications:');
      all.forEach((med, i) => {
        console.log(`  ${i + 1}. TSH ID: "${med.tshla_id}" | Med: ${med.medication_name} | Status: ${med.status}`);
      });

      // Check unique TSH IDs
      const uniqueTsh = [...new Set(all.map(m => m.tshla_id))];
      console.log('\nUnique TSH IDs found:');
      uniqueTsh.forEach(tsh => console.log(`  - "${tsh}"`));
    }

    // Try specific searches
    console.log('\n--- Testing Queries ---');

    // Search for TSH123001
    const { data: search1 } = await supabase
      .from('patient_medications')
      .select('count');

console.log(`\nTotal count: ${search1?.[0]?.count || 0}`);

    const { data: search2 } = await supabase
      .from('patient_medications')
      .select('id')
      .eq('tshla_id', 'TSH123001');
    console.log(`Search for "TSH123001": ${search2?.length || 0} results`);

    const { data: search3 } = await supabase
      .from('patient_medications')
      .select('id')
      .eq('tshla_id', 'TSH 123-001');
    console.log(`Search for "TSH 123-001": ${search3?.length || 0} results`);

    // Try OR query
    const { data: search4 } = await supabase
      .from('patient_medications')
      .select('id')
      .or('tshla_id.eq.TSH123001,tshla_id.eq.TSH 123-001');
    console.log(`OR query: ${search4?.length || 0} results`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkMeds();
