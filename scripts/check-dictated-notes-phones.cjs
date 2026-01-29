require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('📞 Checking all dictated_notes phone numbers...\n');

  const { data: notes } = await supabase
    .from('dictated_notes')
    .select('id, patient_name, patient_phone, visit_date, audio_url')
    .order('created_at', { ascending: false });

  console.log(`Total dictated_notes: ${notes?.length || 0}\n`);

  if (notes && notes.length > 0) {
    notes.forEach((n, i) => {
      console.log(`${i + 1}. ${n.patient_name || 'Unknown'}`);
      console.log(`   Phone: ${n.patient_phone}`);
      console.log(`   Visit: ${n.visit_date}`);
      console.log(`   Has audio: ${n.audio_url ? 'Yes' : 'No'}`);
      console.log('');
    });
  }
})();
