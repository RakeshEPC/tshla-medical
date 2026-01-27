/**
 * Check if audio file exists in storage and update database
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STORAGE_BUCKET = 'patient-audio';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  console.log('🔍 Checking for MIKLYN audio file in storage\n');

  // Check if file exists
  const fileName = 'dictations/TSH692273/128.mp3';

  const { data: fileList, error: listError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .list('dictations/TSH692273');

  if (listError) {
    console.error('❌ Error listing files:', listError.message);
    process.exit(1);
  }

  console.log('📁 Files in dictations/TSH692273:');
  if (fileList && fileList.length > 0) {
    fileList.forEach(file => {
      console.log(`   - ${file.name} (${(file.metadata?.size / 1024).toFixed(1)} KB)`);
    });
  } else {
    console.log('   (empty)');
  }
  console.log('');

  // Check if 128.mp3 exists
  const audioFile = fileList?.find(f => f.name === '128.mp3');

  if (audioFile) {
    console.log('✅ Audio file found!');
    console.log(`   Size: ${(audioFile.metadata?.size / 1024).toFixed(1)} KB`);

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(fileName);

    const audioUrl = urlData.publicUrl;
    console.log(`   URL: ${audioUrl}`);
    console.log('');

    // Update database
    console.log('💾 Updating database...');
    const { error: updateError } = await supabase
      .from('dictated_notes')
      .update({
        audio_url: audioUrl,
        audio_generated_at: new Date().toISOString()
      })
      .eq('id', 128);

    if (updateError) {
      console.error('❌ Error updating database:', updateError.message);
      process.exit(1);
    }

    console.log('✅ Database updated successfully!');
    console.log('');
    console.log('🎉 MIKLYN can now listen to her audio summary!');
  } else {
    console.log('❌ Audio file not found in storage');
    console.log('   The upload may have failed. Try running the generation script again.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
