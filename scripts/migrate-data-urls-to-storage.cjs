require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('🔄 Migrating Data URL Audio to Supabase Storage\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Get all notes with data URL audio
  const { data: notes } = await supabase
    .from('dictated_notes')
    .select('id, patient_name, patient_phone, audio_url')
    .not('audio_url', 'is', null)
    .eq('audio_deleted', false);

  const dataUrlNotes = notes?.filter(note => note.audio_url.startsWith('data:')) || [];

  console.log(`\n📊 Found ${dataUrlNotes.length} records to migrate\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const note of dataUrlNotes) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📝 Processing: ${note.patient_name || 'Unknown'} (ID: ${note.id})`);

    try {
      // Extract base64 data from data URL
      const base64Match = note.audio_url.match(/^data:audio\/mpeg;base64,(.+)$/);
      if (!base64Match) {
        console.error('   ❌ Invalid data URL format');
        errorCount++;
        continue;
      }

      const base64Data = base64Match[1];
      const buffer = Buffer.from(base64Data, 'base64');
      const sizeKB = (buffer.length / 1024).toFixed(1);

      console.log(`   Audio size: ${sizeKB} KB`);

      // Generate unique filename
      const timestamp = Date.now();
      const patientSlug = (note.patient_name || 'patient')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-');
      const filename = `dictated-notes/${patientSlug}-${note.id}-${timestamp}.mp3`;

      console.log(`   Uploading to: ${filename}`);

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('patient-audio')
        .upload(filename, buffer, {
          contentType: 'audio/mpeg',
          upsert: false
        });

      if (uploadError) {
        console.error('   ❌ Upload error:', uploadError.message);
        errorCount++;
        continue;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('patient-audio')
        .getPublicUrl(filename);

      const publicUrl = urlData.publicUrl;
      console.log('   ✅ Uploaded successfully');
      console.log('   🌐 Public URL:', publicUrl.substring(0, 80) + '...');

      // Update database
      const { error: updateError } = await supabase
        .from('dictated_notes')
        .update({
          audio_url: publicUrl,
          audio_deleted: false,
          audio_generated_at: new Date().toISOString()
        })
        .eq('id', note.id);

      if (updateError) {
        console.error('   ❌ Database update error:', updateError.message);
        errorCount++;
        continue;
      }

      console.log('   ✅ Database updated');
      successCount++;

    } catch (err) {
      console.error('   ❌ Error:', err.message);
      errorCount++;
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Migration Summary:');
  console.log(`   Total records: ${dataUrlNotes.length}`);
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${errorCount}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
})();
