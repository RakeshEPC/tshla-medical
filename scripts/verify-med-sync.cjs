/**
 * Verify medications synced from H&P to patient portal
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifySync() {
  console.log('✅ Verifying medications are now in patient portal...\n');

  const { data: meds } = await supabase
    .from('patient_medications')
    .select('tshla_id, medication_name, dosage, frequency, source, status')
    .eq('source', 'hp_import')
    .order('tshla_id', { ascending: true });

  console.log('Medications imported from H&P dictations:\n');

  let currentPatient = '';
  meds.forEach(med => {
    if (med.tshla_id !== currentPatient) {
      currentPatient = med.tshla_id;
      console.log(`\n👤 Patient: ${med.tshla_id}`);
    }
    console.log(`   💊 ${med.medication_name} ${med.dosage || ''} ${med.frequency || ''}`);
    console.log(`      Status: ${med.status}, Source: ${med.source}`);
  });

  console.log(`\n\n📊 Total medications from dictations: ${meds.length}`);
}

verifySync().catch(console.error);
