require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const { data: note } = await supabase
    .from('dictated_notes')
    .select('*')
    .eq('patient_phone', '9035196092')
    .single();

  if (note) {
    console.log('Sarah Wehe dictated_note fields:');
    console.log('  ID:', note.id);
    console.log('  patient_name:', note.patient_name);
    console.log('  visit_date:', note.visit_date);
    console.log('\nText fields:');
    console.log('  raw_transcript length:', note.raw_transcript?.length || 0);
    console.log('  processed_note length:', note.processed_note?.length || 0);
    console.log('  ai_summary length:', note.ai_summary?.length || 0);
    console.log('\nAudio:');
    console.log('  audio_url:', note.audio_url ? 'Has audio' : 'No audio');
    console.log('  audio_deleted:', note.audio_deleted || false);

    console.log('\n--- Content Preview (first 300 chars) ---');
    const textToUse = note.ai_summary || note.processed_note || note.raw_transcript;
    if (textToUse) {
      console.log(textToUse.substring(0, 300) + '...');
    }
  }
})();
