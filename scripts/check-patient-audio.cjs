const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('🎙️  PATIENT AUDIO & DICTATION ANALYSIS\n');
  console.log('=' .repeat(70) + '\n');

  // 1. Get all dictations
  const { data: allDicts, error } = await supabase
    .from('dictated_notes')
    .select('id, patient_name, audio_url, raw_transcript, processed_note, created_at');

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log(`📊 Total dictations: ${allDicts.length}\n`);

  // 2. Analyze audio availability
  const withAudioUrl = allDicts.filter(d => d.audio_url && d.audio_url.trim().length > 0);
  const withTranscript = allDicts.filter(d => d.raw_transcript && d.raw_transcript.length > 0);
  const withProcessed = allDicts.filter(d => d.processed_note && d.processed_note.length > 0);

  console.log('Audio URL present:', withAudioUrl.length, `(${Math.round(withAudioUrl.length/allDicts.length*100)}%)`);
  console.log('Raw transcript:', withTranscript.length, `(${Math.round(withTranscript.length/allDicts.length*100)}%)`);
  console.log('Processed note:', withProcessed.length, `(${Math.round(withProcessed.length/allDicts.length*100)}%)`);

  // 3. Show samples with audio URLs
  if (withAudioUrl.length > 0) {
    console.log('\n📁 Dictations WITH audio URLs:\n');
    withAudioUrl.slice(0, 5).forEach((d, i) => {
      console.log(`${i+1}. ${d.patient_name}`);
      console.log(`   URL: ${d.audio_url}`);
      console.log(`   Date: ${d.created_at?.substring(0, 10)}\n`);
    });
  } else {
    console.log('\n⚠️  NO audio URLs found in any dictations!\n');
  }

  // 4. Check DANIEL DAUES
  console.log('=' .repeat(70) + '\n');
  console.log('🎯 DANIEL DAUES Dictations:\n');

  const danielDicts = allDicts.filter(d =>
    d.patient_name && d.patient_name.toUpperCase().includes('DANIEL') &&
    d.patient_name.toUpperCase().includes('DAUES')
  );

  if (danielDicts.length > 0) {
    danielDicts.forEach((d, i) => {
      console.log(`${i+1}. Date: ${d.created_at?.substring(0, 10)}`);
      console.log(`   Audio URL: ${d.audio_url || '❌ NO AUDIO URL'}`);
      console.log(`   Transcript: ${d.raw_transcript ? `✅ ${d.raw_transcript.length} chars` : '❌ NONE'}`);
      console.log(`   Processed: ${d.processed_note ? `✅ ${d.processed_note.length} chars` : '❌ NONE'}\n`);
    });
  } else {
    console.log('No dictations found for DANIEL DAUES\n');
  }

  // 5. Key findings
  console.log('=' .repeat(70) + '\n');
  console.log('💡 KEY FINDINGS:\n');
  console.log(`✅ Dictations exist: ${allDicts.length}`);
  console.log(`${withAudioUrl.length > 0 ? '✅' : '❌'} Audio URLs: ${withAudioUrl.length}`);
  console.log(`✅ Transcripts: ${withTranscript.length} (used for H&P generation)`);
  console.log(`✅ Processed notes: ${withProcessed.length}`);

  console.log('\n📝 RECOMMENDATION:\n');
  if (withAudioUrl.length === 0) {
    console.log('Audio files were NOT stored with dictations.');
    console.log('The system used transcription text for H&P generation.');
    console.log('This is NORMAL - audio storage is optional.');
  } else {
    console.log('Audio files ARE available for', withAudioUrl.length, 'dictations.');
  }

  console.log('\n' + '=' .repeat(70) + '\n');
})();
