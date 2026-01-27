/**
 * Find all dictations across all tables
 * Created: 2026-01-26
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findAllDictations() {
  console.log('🔍 Searching for dictations in all tables...\n');

  // Check dictated_notes table
  console.log('1. Checking dictated_notes table...');
  const { data: dictatedNotes, error: dictatedError } = await supabase
    .from('dictated_notes')
    .select('id, patient_phone, patient_name, created_at, audio_url, finalized_text')
    .order('created_at', { ascending: false });

  if (dictatedError) {
    console.log('   Error:', dictatedError.message);
  } else {
    console.log(`   ✅ Found ${dictatedNotes?.length || 0} notes\n`);
  }

  // Check dictations table
  console.log('2. Checking dictations table...');
  const { data: dictations, error: dictationsError } = await supabase
    .from('dictations')
    .select('id, patient_phone, patient_name, created_at, audio_url, raw_transcript')
    .order('created_at', { ascending: false });

  if (dictationsError) {
    console.log('   Error:', dictationsError.message);
  } else {
    console.log(`   ✅ Found ${dictations?.length || 0} dictations\n`);
  }

  // Check saved_dictations table
  console.log('3. Checking saved_dictations table...');
  const { data: savedDictations, error: savedError } = await supabase
    .from('saved_dictations')
    .select('id, patient_phone, patient_name, created_at')
    .order('created_at', { ascending: false });

  if (savedError) {
    console.log('   Error:', savedError.message);
  } else {
    console.log(`   ✅ Found ${savedDictations?.length || 0} saved dictations\n`);
  }

  // Summary
  const totalNotes = (dictatedNotes?.length || 0);
  const totalDictations = (dictations?.length || 0);
  const totalSaved = (savedDictations?.length || 0);
  const total = totalNotes + totalDictations + totalSaved;

  console.log('\n' + '='.repeat(60));
  console.log('FOUND DICTATIONS:');
  console.log('='.repeat(60));
  console.log(`dictated_notes:    ${totalNotes}`);
  console.log(`dictations:        ${totalDictations}`);
  console.log(`saved_dictations:  ${totalSaved}`);
  console.log(`TOTAL:             ${total}`);
  console.log('='.repeat(60));

  // Show sample from dictated_notes (most likely source)
  if (dictatedNotes && dictatedNotes.length > 0) {
    console.log('\n📝 Sample dictated_notes (most recent 10):');
    dictatedNotes.slice(0, 10).forEach((note, i) => {
      console.log(`\n${i + 1}. ${note.patient_name || note.patient_phone || 'Unknown'}`);
      console.log(`   Date: ${note.created_at?.substring(0, 10)}`);
      console.log(`   Audio: ${note.audio_url ? 'Yes' : 'No'}`);
      console.log(`   Text: ${note.finalized_text ? 'Yes (' + note.finalized_text.substring(0, 50) + '...)' : 'No'}`);
    });
  }

  // Show sample from dictations
  if (dictations && dictations.length > 0) {
    console.log('\n📝 Sample dictations (most recent 10):');
    dictations.slice(0, 10).forEach((dict, i) => {
      console.log(`\n${i + 1}. ${dict.patient_name || dict.patient_phone || 'Unknown'}`);
      console.log(`   Date: ${dict.created_at?.substring(0, 10)}`);
      console.log(`   Audio: ${dict.audio_url ? 'Yes' : 'No'}`);
      console.log(`   Transcript: ${dict.raw_transcript ? 'Yes' : 'No'}`);
    });
  }

  return {
    dictated_notes: dictatedNotes || [],
    dictations: dictations || [],
    saved_dictations: savedDictations || []
  };
}

findAllDictations()
  .then(result => {
    const total = result.dictated_notes.length + result.dictations.length + result.saved_dictations.length;
    console.log(`\n\n✅ Search complete. Total dictations found: ${total}`);
  })
  .catch(console.error);
