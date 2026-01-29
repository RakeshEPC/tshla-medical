require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('🔍 Checking AI Summary Coverage...\n');

  // Get all dictated_notes
  const { data: notes } = await supabase
    .from('dictated_notes')
    .select('id, patient_name, ai_summary, processed_note, raw_transcript, audio_url, audio_deleted')
    .order('id', { ascending: true });

  let hasAiSummary = 0;
  let missingAiSummary = 0;
  let hasAudioCount = 0;
  let missingAudio = 0;

  const needsSummary = [];
  const needsAudio = [];

  notes?.forEach(note => {
    const hasAudio = !!(note.audio_url && !note.audio_deleted);
    const hasSummary = !!(note.ai_summary && note.ai_summary.trim().length > 0);

    if (hasSummary) {
      hasAiSummary++;
    } else {
      missingAiSummary++;
      needsSummary.push({
        id: note.id,
        name: note.patient_name || 'Unknown',
        hasProcessedNote: !!(note.processed_note),
        hasRawTranscript: !!(note.raw_transcript)
      });
    }

    if (hasAudio) {
      hasAudioCount++;
    } else {
      missingAudio++;
      needsAudio.push({
        id: note.id,
        name: note.patient_name || 'Unknown'
      });
    }
  });

  console.log('📊 Overall Statistics:');
  console.log(`   Total dictations: ${notes?.length || 0}`);
  console.log(`   ✅ Has AI Summary: ${hasAiSummary}`);
  console.log(`   ❌ Missing AI Summary: ${missingAiSummary}`);
  console.log(`   ✅ Has Audio: ${hasAudioCount}`);
  console.log(`   ❌ Missing Audio: ${missingAudio}`);

  if (needsSummary.length > 0) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 Records Missing Patient-Friendly AI Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    needsSummary.forEach((note, i) => {
      console.log(`   ${i + 1}. ${note.name} (ID: ${note.id})`);
      console.log(`      Has processed note: ${note.hasProcessedNote ? 'Yes' : 'No'}`);
      console.log(`      Has raw transcript: ${note.hasRawTranscript ? 'Yes' : 'No'}`);
    });
  }

  if (needsAudio.length > 0) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔊 Records Missing Audio:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    needsAudio.forEach((note, i) => {
      console.log(`   ${i + 1}. ${note.name} (ID: ${note.id})`);
    });
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Analysis complete!');
})();
