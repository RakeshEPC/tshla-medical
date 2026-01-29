/**
 * Fix Jefferson Udall's labs format from array to object
 * The component expects: { "Glucose": [{value, date, unit}, ...], "A1C": [...], ... }
 * But we stored: [{name, value, date, unit}, ...]
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixLabsFormat() {
  console.log('\n🔧 Fixing Jefferson Udall labs format...\n');

  // Get current labs
  const { data, error } = await supabase
    .from('patient_comprehensive_chart')
    .select('id, tshla_id, labs')
    .eq('tshla_id', 'TSH 412-376')
    .single();

  if (error) {
    console.error('❌ Error fetching labs:', error.message);
    return;
  }

  console.log('Current labs structure:', typeof data.labs, Array.isArray(data.labs) ? 'Array' : 'Object');

  if (!Array.isArray(data.labs)) {
    console.log('✅ Labs already in correct format (object)');
    return;
  }

  // Convert array to object format
  const labsObject = {};

  data.labs.forEach(lab => {
    const testName = lab.name;

    // Initialize array for this test if doesn't exist
    if (!labsObject[testName]) {
      labsObject[testName] = [];
    }

    // Add this lab value
    labsObject[testName].push({
      value: lab.value,
      date: lab.date,
      unit: lab.unit,
      status: lab.status,
      reference_range: lab.reference_range
    });
  });

  console.log('Converted to object with', Object.keys(labsObject).length, 'test types:\n');
  Object.keys(labsObject).forEach(testName => {
    console.log(`  - ${testName}: ${labsObject[testName].length} result(s)`);
  });

  // Update database
  const { error: updateError } = await supabase
    .from('patient_comprehensive_chart')
    .update({ labs: labsObject })
    .eq('id', data.id);

  if (updateError) {
    console.error('\n❌ Error updating labs:', updateError.message);
  } else {
    console.log('\n✅ Successfully updated labs format!');
  }
}

fixLabsFormat().catch(console.error);
