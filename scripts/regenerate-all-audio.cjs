/**
 * Regenerate All Patient Audio Summaries
 * Re-creates all audio files using Rakesh Patel's custom voice
 *
 * Usage: node scripts/regenerate-all-audio.cjs
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const fs = require('fs');
const path = require('path');

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
 * Upload audio to Supabase Storage
 */
async function uploadAudioToSupabase(audioBuffer, filename) {
  const { data, error } = await supabase.storage
    .from('dictation-audio')
    .upload(filename, audioBuffer, {
      contentType: 'audio/mpeg',
      upsert: true
    });

  if (error) {
    throw error;
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('dictation-audio')
    .getPublicUrl(filename);

  return urlData.publicUrl;
}

/**
 * Main regeneration function
 */
async function regenerateAllAudio() {
  console.log('🎙️  Starting audio regeneration with Rakesh Patel voice\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    // Fetch all dictations with final_note (text content)
    console.log('\n📥 Fetching dictations from database...');
    const { data: dictations, error: fetchError } = await supabase
      .from('dictations')
      .select('id, appointment_id, patient_name, final_note, audio_url')
      .not('final_note', 'is', null)
      .is('deleted_at', null) // Only active dictations
      .order('created_at', { ascending: false });

    if (fetchError) {
      throw fetchError;
    }

    console.log(`   Found ${dictations.length} dictations\n`);

    if (dictations.length === 0) {
      console.log('✅ No dictations to regenerate');
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < dictations.length; i++) {
      const dictation = dictations[i];
      const progress = `[${i + 1}/${dictations.length}]`;

      console.log(`\n${progress} Processing: ${dictation.patient_name}`);
      console.log(`   Dictation ID: ${dictation.id}`);
      console.log(`   Text length: ${dictation.final_note.length} chars`);

      try {
        // Generate audio with new voice
        console.log('   🎙️  Generating audio...');
        const audioBuffer = await generateAudio(dictation.final_note);
        console.log(`   ✅ Audio generated (${(audioBuffer.length / 1024).toFixed(1)} KB)`);

        // Upload to Supabase
        const filename = `dictation_${dictation.appointment_id}_${Date.now()}.mp3`;
        console.log('   📤 Uploading to storage...');
        const audioUrl = await uploadAudioToSupabase(audioBuffer, filename);
        console.log(`   ✅ Uploaded: ${audioUrl}`);

        // Update database
        const { error: updateError } = await supabase
          .from('dictations')
          .update({
            audio_url: audioUrl,
            audio_deleted: false,
            audio_deleted_at: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', dictation.id);

        if (updateError) {
          throw updateError;
        }

        console.log('   ✅ Database updated');
        successCount++;

        // Rate limit: wait 1 second between requests
        if (i < dictations.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 REGENERATION SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Total dictations: ${dictations.length}`);
    console.log(`   ✅ Successfully regenerated: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (successCount > 0) {
      console.log('✅ Audio regeneration complete!');
      console.log('   All audio files now use Rakesh Patel\'s voice.');
      console.log('   Patients can hear the new voice immediately.\n');
    }

    if (errorCount > 0) {
      console.log('⚠️  Some regenerations failed. Check errors above.\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the script
regenerateAllAudio()
  .then(() => {
    console.log('✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error.message);
    process.exit(1);
  });
