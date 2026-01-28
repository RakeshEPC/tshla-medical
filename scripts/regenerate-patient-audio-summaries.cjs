/**
 * Regenerate Patient Audio Summaries with Rakesh Patel Voice
 * Re-creates audio files in patient_audio_summaries table
 *
 * Usage: node scripts/regenerate-patient-audio-summaries.cjs
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const https = require('https');

// Initialize Supabase
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const RAKESH_VOICE_ID = 'f6qhiUOSRVGsfwvD4oSU'; // Rakesh Patel custom voice

if (!ELEVENLABS_API_KEY) {
  console.error('❌ Missing ELEVENLABS_API_KEY');
  process.exit(1);
}

/**
 * Generate audio from text using ElevenLabs
 */
async function generateAudio(text) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      text: text,
      model_id: 'eleven_monolingual_v1',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true
      }
    });

    const options = {
      hostname: 'api.elevenlabs.io',
      port: 443,
      path: `/v1/text-to-speech/${RAKESH_VOICE_ID}`,
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 30000
    };

    const req = https.request(options, (res) => {
      const chunks = [];

      res.on('data', (chunk) => {
        chunks.push(chunk);
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          const buffer = Buffer.concat(chunks);
          resolve(buffer);
        } else {
          const errorText = Buffer.concat(chunks).toString();
          reject(new Error(`ElevenLabs error ${res.statusCode}: ${errorText}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Main regeneration function
 */
async function regenerateAllAudio() {
  console.log('🎙️  Regenerating Patient Audio Summaries with Rakesh Patel Voice\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    // Fetch all patient summaries with text
    console.log('\n📥 Fetching patient summaries...');
    const { data: summaries, error: fetchError } = await supabase
      .from('patient_audio_summaries')
      .select('id, patient_name, patient_phone, summary_script, audio_blob_url, voice_id')
      .not('summary_script', 'is', null)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (fetchError) {
      throw fetchError;
    }

    console.log(`   Found ${summaries.length} summaries\n`);

    if (summaries.length === 0) {
      console.log('✅ No summaries to regenerate');
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < summaries.length; i++) {
      const summary = summaries[i];
      const progress = `[${i + 1}/${summaries.length}]`;

      console.log(`\n${progress} ${summary.patient_name || 'Unknown'}`);
      console.log(`   ID: ${summary.id}`);
      console.log(`   Phone: ${summary.patient_phone}`);
      console.log(`   Text: ${summary.summary_script.length} chars`);
      console.log(`   Current voice: ${summary.voice_id || 'none'}`);

      // Skip if already using Rakesh Patel voice
      if (summary.voice_id === RAKESH_VOICE_ID) {
        console.log('   ⏭️  Already using Rakesh Patel voice, skipping');
        skippedCount++;
        continue;
      }

      try {
        // Generate audio with new voice
        console.log('   🎙️  Generating audio...');
        const audioBuffer = await generateAudio(summary.summary_script);
        const audioSizeKB = (audioBuffer.length / 1024).toFixed(1);
        console.log(`   ✅ Generated (${audioSizeKB} KB)`);

        // Convert to base64 data URL for storage
        const base64Audio = audioBuffer.toString('base64');
        const audioDataUrl = `data:audio/mpeg;base64,${base64Audio}`;

        // Update database
        console.log('   💾 Updating database...');
        const { error: updateError } = await supabase
          .from('patient_audio_summaries')
          .update({
            audio_blob_url: audioDataUrl,
            voice_id: RAKESH_VOICE_ID,
            audio_generated_at: new Date().toISOString(),
            audio_file_size_kb: Math.round(parseFloat(audioSizeKB)), // Convert to integer
            updated_at: new Date().toISOString()
          })
          .eq('id', summary.id);

        if (updateError) {
          throw updateError;
        }

        console.log('   ✅ Updated successfully');
        successCount++;

        // Rate limit: wait 1.5 seconds between requests
        if (i < summaries.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }

      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        errorCount++;

        // Continue with next on rate limit errors
        if (error.message.includes('429') || error.message.includes('timeout')) {
          console.log('   ⏸️  Waiting 10 seconds before continuing...');
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 REGENERATION SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Total summaries: ${summaries.length}`);
    console.log(`   ✅ Successfully regenerated: ${successCount}`);
    console.log(`   ⏭️  Already using new voice: ${skippedCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (successCount > 0) {
      console.log('✅ Audio regeneration complete!');
      console.log('   Patients can now hear Rakesh Patel\'s voice.\n');
    }

    if (errorCount > 0) {
      console.log(`⚠️  ${errorCount} regenerations failed. Check errors above.\n`);
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
regenerateAllAudio()
  .then(() => {
    console.log('✅ Script completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error.message);
    process.exit(1);
  });
