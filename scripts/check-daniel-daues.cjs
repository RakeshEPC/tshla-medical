const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('🔍 Searching for DANIEL DAUES...\n');

  // Check unified_patients
  const { data: patients } = await supabase
    .from('unified_patients')
    .select('tshla_id, first_name, last_name, phone_primary')
    .ilike('first_name', 'DANIEL')
    .ilike('last_name', 'DAUES');

  console.log('Patients found:', patients?.length || 0);
  patients?.forEach(p => console.log('  ', p.tshla_id, '-', p.first_name, p.last_name, '-', p.phone_primary));

  if (patients && patients.length > 0) {
    const tshlaId = patients[0].tshla_id;
    console.log('\n📋 Checking medications for', tshlaId, '...\n');

    const { data: meds } = await supabase
      .from('patient_medications')
      .select('medication_name, dosage, frequency, source')
      .eq('tshla_id', tshlaId);

    console.log('Medications found:', meds?.length || 0);
    meds?.forEach(m => console.log('  -', m.medication_name, m.dosage || '', m.frequency || '', '(source:', m.source + ')'));
  }

  // Also check what TSH785121 points to
  console.log('\n🔍 Checking TSH785121...\n');
  const { data: patient785 } = await supabase
    .from('unified_patients')
    .select('tshla_id, first_name, last_name, phone_primary')
    .eq('tshla_id', 'TSH785121')
    .maybeSingle();

  if (patient785) {
    console.log('Found:', patient785.tshla_id, '-', patient785.first_name, patient785.last_name);

    const { data: meds785 } = await supabase
      .from('patient_medications')
      .select('medication_name, source')
      .eq('tshla_id', 'TSH785121');

    console.log('Medications:', meds785?.length || 0);
  } else {
    console.log('TSH785121 not found in unified_patients');
  }
})();
