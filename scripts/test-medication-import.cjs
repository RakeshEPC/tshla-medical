/**
 * Test medication import for MIKLYN
 */

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testMedImport() {
  console.log('🧪 Testing medication import for MIKLYN\n');

  const tshlaId = 'TSH692273';
  const normalizedId = tshlaId.replace(/[\s-]/g, '').toUpperCase();
  const formattedId = normalizedId.replace(/^TSH(\d{3})(\d{3})$/, 'TSH $1-$2');

  console.log('1️⃣  PATIENT LOOKUP');
  console.log('   Searching for:', tshlaId, 'OR', normalizedId, 'OR', formattedId);

  const { data: patient, error: patientError } = await supabase
    .from('unified_patients')
    .select('id, tshla_id, phone_primary, first_name, last_name')
    .or(`tshla_id.eq.${tshlaId},tshla_id.eq.${normalizedId},tshla_id.eq.${formattedId}`)
    .maybeSingle();

  if (patientError || !patient) {
    console.log('   ❌ Patient not found');
    return;
  }

  console.log('   ✅ Found:', patient.first_name, patient.last_name);
  console.log('   Patient ID:', patient.id);
  console.log('   Phone:', patient.phone_primary);
  console.log('');

  console.log('2️⃣  H&P CHART LOOKUP');
  const { data: hpChart } = await supabase
    .from('patient_comprehensive_chart')
    .select('medications, patient_phone')
    .eq('patient_phone', patient.phone_primary)
    .maybeSingle();

  if (!hpChart) {
    console.log('   ❌ No chart for phone:', patient.phone_primary);
    const { data: hpChart2 } = await supabase
      .from('patient_comprehensive_chart')
      .select('medications, patient_phone')
      .eq('unified_patient_id', patient.id)
      .maybeSingle();

    if (hpChart2) {
      console.log('   ✅ Found by unified_patient_id');
      console.log('   Medications:', hpChart2.medications?.length || 0);
      hpChart2.medications?.forEach((m, i) => {
        console.log(`     ${i+1}. ${m.name}`);
      });
    }
    return;
  }

  console.log('   ✅ Chart found');
  console.log('   Medications:', hpChart.medications?.length || 0);
  hpChart.medications?.forEach((m, i) => {
    console.log(`     ${i+1}. ${m.name}`);
  });
}

testMedImport().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
