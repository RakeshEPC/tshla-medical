const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('🎙️  CHECKING AUDIO SUMMARIES FOR PATIENTS\n');
  console.log('=' .repeat(70) + '\n');

  // 1. Check dictated_notes table structure and content
  const { data: dictNotes, error: dictError } = await supabase
    .from('dictated_notes')
    .select('*')
    .limit(3);

  if (dictError) {
    console.error('Error loading dictated_notes:', dictError.message);
    return;
  }

  console.log('📝 dictated_notes table:');
  console.log('Total records:', await getTotalCount('dictated_notes'));
  if (dictNotes && dictNotes.length > 0) {
    console.log('Columns:', Object.keys(dictNotes[0]).join(', '));

    console.log('\nSample records:');
    dictNotes.forEach((note, i) => {
      console.log(`\n${i+1}. ${note.patient_name}`);
      console.log(`   Audio URL: ${note.audio_url || '❌ NONE'}`);
      console.log(`   Has transcript: ${note.raw_transcript ? '✅ YES (' + note.raw_transcript.length + ' chars)' : '❌ NO'}`);
      console.log(`   Has processed: ${note.processed_note ? '✅ YES (' + note.processed_note.length + ' chars)' : '❌ NO'}`);
      console.log(`   Date: ${note.created_at?.substring(0, 10)}`);
    });
  }

  // 2. Check dictations table
  console.log('\n' + '=' .repeat(70) + '\n');

  const { data: dicts } = await supabase
    .from('dictations')
    .select('*')
    .limit(3);

  console.log('📝 dictations table:');
  console.log('Total records:', await getTotalCount('dictations'));
  if (dicts && dicts.length > 0) {
    console.log('Columns:', Object.keys(dicts[0]).join(', '));

    console.log('\nSample records:');
    dicts.forEach((dict, i) => {
      console.log(`\n${i+1}. TSHLA: ${dict.tshla_id}`);
      console.log(`   Audio URL: ${dict.audio_url || '❌ NONE'}`);
      console.log(`   Has transcript: ${dict.transcription_text ? '✅ YES (' + dict.transcription_text.length + ' chars)' : '❌ NO'}`);
      console.log(`   Date: ${dict.created_at?.substring(0, 10)}`);
    });
  }

  // 3. Check DANIEL DAUES specifically
  console.log('\n' + '=' .repeat(70) + '\n');
  console.log('🎯 DANIEL DAUES Audio Check:\n');

  const { data: danielDicts } = await supabase
    .from('dictated_notes')
    .select('id, patient_name, audio_url, raw_transcript, processed_note, created_at')
    .ilike('patient_name', '%DANIEL%')
    .ilike('patient_name', '%DAUES%');

  console.log('Dictations found:', danielDicts?.length || 0);

  if (danielDicts && danielDicts.length > 0) {
    danielDicts.forEach((dict, i) => {
      console.log(`\n${i+1}. Date: ${dict.created_at?.substring(0, 10)}`);
      console.log(`   Audio URL: ${dict.audio_url || '❌ NO AUDIO'}`);
      console.log(`   Transcript: ${dict.raw_transcript ? '✅ YES (' + dict.raw_transcript.length + ' chars)' : '❌ NO'}`);
      console.log(`   Processed: ${dict.processed_note ? '✅ YES (' + dict.processed_note.length + ' chars)' : '❌ NO'}`);
    });
  }

  // 4. Summary of audio availability
  console.log('\n' + '=' .repeat(70) + '\n');
  console.log('📊 AUDIO AVAILABILITY SUMMARY:\n');

  const { data: allDicts } = await supabase
    .from('dictated_notes')
    .select('audio_url, raw_transcript');

  const withAudio = allDicts?.filter(d => d.audio_url) || [];
  const withTranscript = allDicts?.filter(d => d.raw_transcript) || [];

  console.log(`Total dictations: ${allDicts?.length || 0}`);
  console.log(`With audio URL: ${withAudio.length} (${Math.round(withAudio.length / (allDicts?.length || 1) * 100)}%)`);
  console.log(`With transcript: ${withTranscript.length} (${Math.round(withTranscript.length / (allDicts?.length || 1) * 100)}%)`);

  console.log('\n' + '=' .repeat(70));
})();

async function getTotalCount(tableName) {
  const { count } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true });
  return count || 0;
}
