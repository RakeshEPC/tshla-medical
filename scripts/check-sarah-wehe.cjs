require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('🔍 Checking Sarah Wehe records...\n');

  // Find patient
  const { data: patient } = await supabase
    .from('unified_patients')
    .select('*')
    .ilike('first_name', '%SARAH%')
    .ilike('last_name', '%WEHE%')
    .maybeSingle();

  if (!patient) {
    console.log('❌ Patient not found');
    return;
  }

  console.log('✅ Patient found:');
  console.log('   TSHLA ID:', patient.tshla_id);
  console.log('   Phone:', patient.phone_primary);
  console.log('   Phone Display:', patient.phone_display);

  // Check dictated_notes with phone variations
  const phoneVariations = [
    patient.phone_primary,
    patient.phone_display,
    '(903) 519-6092' // Known format in dictated_notes
  ];

  const { data: notes } = await supabase
    .from('dictated_notes')
    .select('*')
    .in('patient_phone', phoneVariations);

  console.log('\n📝 Dictated notes:', notes?.length || 0);
  if (notes && notes.length > 0) {
    notes.forEach((note, i) => {
      console.log(`\n   Note ${i + 1}:`);
      console.log('     ID:', note.id);
      console.log('     Visit:', note.visit_date);
      console.log('     Has AI Summary:', note.ai_summary ? 'Yes' : 'No');
      console.log('     AI Summary length:', note.ai_summary?.length || 0);
      console.log('     Has audio:', note.audio_url ? 'Yes' : 'No');
      console.log('     Audio deleted:', note.audio_deleted || false);
      if (note.audio_url) {
        const isDataUrl = note.audio_url.startsWith('data:');
        const isSupabaseUrl = note.audio_url.includes('supabase.co');
        console.log('     Audio type:', isDataUrl ? '❌ Data URL (CSP issue)' : isSupabaseUrl ? '✅ Supabase Storage' : '⚠️  Unknown');
        console.log('     Audio URL:', note.audio_url.substring(0, 100) + (note.audio_url.length > 100 ? '...' : ''));
      }
    });
  }
})();
