/**
 * Find Dictation Audio Files
 * Deep search through Supabase Storage for audio files from dictations
 * Created: 2026-01-26
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findDictationAudio() {
  console.log('🔍 SEARCHING FOR DICTATION AUDIO FILES\n');
  console.log('=' .repeat(80) + '\n');

  // 1. List all storage buckets
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

  if (bucketsError) {
    console.error('❌ Error listing buckets:', bucketsError.message);
    return;
  }

  console.log(`📦 Found ${buckets.length} storage buckets:\n`);
  buckets.forEach(b => {
    console.log(`   ${b.name} (${b.public ? 'public' : 'private'})`);
  });

  console.log('\n' + '=' .repeat(80) + '\n');

  // 2. Search each bucket thoroughly
  const audioFiles = [];

  for (const bucket of buckets) {
    console.log(`\n📁 Searching bucket: ${bucket.name}\n`);

    try {
      // List root level
      const { data: rootItems, error: rootError } = await supabase.storage
        .from(bucket.name)
        .list('', { limit: 1000 });

      if (rootError) {
        console.error(`   ⚠️  Error: ${rootError.message}`);
        continue;
      }

      console.log(`   Root items: ${rootItems?.length || 0}`);

      if (!rootItems || rootItems.length === 0) {
        console.log('   (empty bucket)');
        continue;
      }

      // Process each item
      for (const item of rootItems) {
        if (item.id) {
          // It's a file
          const isAudio = item.name.match(/\.(mp3|wav|m4a|webm|ogg|aac)$/i);
          console.log(`   ${isAudio ? '🎙️ ' : '📄'} ${item.name} (${formatBytes(item.metadata?.size || 0)})`);

          if (isAudio) {
            audioFiles.push({
              bucket: bucket.name,
              path: item.name,
              name: item.name,
              size: item.metadata?.size || 0,
              updated: item.updated_at
            });
          }
        } else {
          // It's a folder - search inside
          console.log(`   📁 ${item.name}/`);

          const { data: subItems } = await supabase.storage
            .from(bucket.name)
            .list(item.name, { limit: 1000 });

          if (subItems && subItems.length > 0) {
            console.log(`      Items inside: ${subItems.length}`);

            for (const subItem of subItems) {
              const isAudio = subItem.name.match(/\.(mp3|wav|m4a|webm|ogg|aac)$/i);

              if (isAudio) {
                const fullPath = `${item.name}/${subItem.name}`;
                console.log(`      🎙️  ${subItem.name} (${formatBytes(subItem.metadata?.size || 0)})`);

                audioFiles.push({
                  bucket: bucket.name,
                  path: fullPath,
                  name: subItem.name,
                  size: subItem.metadata?.size || 0,
                  updated: subItem.updated_at,
                  folder: item.name
                });
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(`   ❌ Error searching bucket: ${error.message}`);
    }
  }

  // 3. Summary
  console.log('\n' + '=' .repeat(80) + '\n');
  console.log('📊 AUDIO FILES FOUND:\n');

  if (audioFiles.length === 0) {
    console.log('❌ NO audio files found in any bucket!\n');
    console.log('💡 This means:');
    console.log('   • Audio files were not saved during dictation');
    console.log('   • Only transcripts (text) were retained');
    console.log('   • This is why recording_duration_seconds = 0\n');
  } else {
    console.log(`✅ Found ${audioFiles.length} audio files:\n`);

    audioFiles.forEach((file, i) => {
      console.log(`${i + 1}. ${file.name}`);
      console.log(`   Bucket: ${file.bucket}`);
      console.log(`   Path: ${file.path}`);
      console.log(`   Size: ${formatBytes(file.size)}`);
      console.log(`   Updated: ${file.updated}\n`);
    });

    console.log('🎯 NEXT STEPS:\n');
    console.log('1. Match audio files to dictation IDs (by filename pattern)');
    console.log('2. Update dictated_notes with audio URLs');
    console.log('3. Add audio column if needed');
  }

  console.log('=' .repeat(80) + '\n');

  return audioFiles;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Run
findDictationAudio()
  .then(files => {
    console.log(`\n✅ Search complete. Found ${files?.length || 0} audio files.`);
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
