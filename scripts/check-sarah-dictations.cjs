require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('🔍 Checking Sarah Wehe in dictations table...\n');

  // Check dictations table
  const { data: dictations } = await supabase
    .from('dictations')
    .select('*')
    .ilike('patient_name', '%SARAH%WEHE%');

  console.log('📝 Dictations found:', dictations?.length || 0);

  if (dictations && dictations.length > 0) {
    dictations.forEach((d, i) => {
      console.log(`\n   Dictation ${i + 1}:`);
      console.log('     ID:', d.id);
      console.log('     Patient:', d.patient_name);
      console.log('     Patient ID:', d.patient_id);
      console.log('     Visit:', d.visit_date);
      console.log('     Has final_note:', d.final_note ? 'Yes' : 'No');
      console.log('     Note length:', d.final_note?.length || 0);
      console.log('     Has audio:', d.audio_url ? 'Yes' : 'No');

      // Check if this patient has a matching unified_patients record
      supabase
        .from('unified_patients')
        .select('tshla_id, phone_primary')
        .eq('id', d.patient_id)
        .single()
        .then(({ data: patient }) => {
          if (patient) {
            console.log('     Patient TSHLA ID:', patient.tshla_id);
            console.log('     Patient Phone:', patient.phone_primary);
          }
        });
    });

    // Wait a bit for async lookups
    await new Promise(r => setTimeout(r, 1000));
  }
})();
