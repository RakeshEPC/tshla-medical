require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('🔍 Counting audio records by storage type...\n');

  // Check dictated_notes
  const { data: notes } = await supabase
    .from('dictated_notes')
    .select('id, patient_name, audio_url, audio_deleted')
    .not('audio_url', 'is', null)
    .eq('audio_deleted', false);

  let dataUrlCount = 0;
  let supabaseStorageCount = 0;
  let otherCount = 0;

  const dataUrlNotes = [];

  notes?.forEach(note => {
    if (note.audio_url.startsWith('data:')) {
      dataUrlCount++;
      dataUrlNotes.push({
        id: note.id,
        name: note.patient_name,
        urlPreview: note.audio_url.substring(0, 50) + '...'
      });
    } else if (note.audio_url.includes('supabase.co')) {
      supabaseStorageCount++;
    } else {
      otherCount++;
    }
  });

  console.log('📊 dictated_notes table:');
  console.log('   Total records with audio:', notes?.length || 0);
  console.log('   ❌ Data URLs (need migration):', dataUrlCount);
  console.log('   ✅ Supabase Storage:', supabaseStorageCount);
  console.log('   ⚠️  Other:', otherCount);

  if (dataUrlCount > 0) {
    console.log('\n📝 Records needing migration:');
    dataUrlNotes.slice(0, 10).forEach((note, i) => {
      console.log(`   ${i + 1}. ${note.name} (ID: ${note.id})`);
    });
    if (dataUrlCount > 10) {
      console.log(`   ... and ${dataUrlCount - 10} more`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Analysis complete!');
})();
