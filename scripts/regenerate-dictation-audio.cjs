/**
 * Regenerate Dictation Audio with Rakesh Patel Voice
 * Updates audio in the dictations table (what patients see on /patient-portal/audio)
 *
 * Usage: node scripts/regenerate-dictation-audio.cjs
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
const RAKESH_VOICE_ID = 'f6qhiUOSRVGsfwvD4oSU';

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
          resolve(Buffer.concat(chunks));
        } else {
          reject(new Error(`ElevenLabs ${res.statusCode}: ${Buffer.concat(chunks).toString()}`));
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

async function regenerateDictationAudio() {
  console.log('🎙️  Regenerating Dictation Audio with Rakesh Patel Voice\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    // Fetch all dictations with final notes
    console.log('\n📥 Fetching dictations...');
    const { data: dictations, error: fetchError } = await supabase
      .from('dictations')
      .select('id, patient_name, patient_id, final_note, audio_url, visit_date')
      .not('final_note', 'is', null)
      .is('deleted_at', null)
      .order('visit_date', { ascending: false });

    if (fetchError) {
      throw fetchError;
    }

    console.log(`   Found ${dictations.length} dictations\n`);

    if (dictations.length === 0) {
      console.log('✅ No dictations to process');
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < dictations.length; i++) {
      const dictation = dictations[i];
      const progress = `[${i + 1}/${dictations.length}]`;

      console.log(`\n${progress} ${dictation.patient_name || 'Unknown'}`);
      console.log(`   ID: ${dictation.id}`);
      console.log(`   Patient ID: ${dictation.patient_id}`);
      console.log(`   Visit: ${dictation.visit_date}`);
      console.log(`   Note: ${dictation.final_note.length} chars`);

      try {
        // Generate audio
        console.log('   🎙️  Generating audio...');
        const audioBuffer = await generateAudio(dictation.final_note);
        const audioSizeKB = (audioBuffer.length / 1024).toFixed(1);
        console.log(`   ✅ Generated (${audioSizeKB} KB)`);

        // Convert to base64 data URL
        const base64Audio = audioBuffer.toString('base64');
        const audioDataUrl = `data:audio/mpeg;base64,${base64Audio}`;

        // Update database
        console.log('   💾 Updating database...');
        const { error: updateError } = await supabase
          .from('dictations')
          .update({
            audio_url: audioDataUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', dictation.id);

        if (updateError) {
          throw updateError;
        }

        console.log('   ✅ Updated successfully');
        successCount++;

        // Rate limit
        if (i < dictations.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }

      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        errorCount++;

        if (error.message.includes('429') || error.message.includes('timeout')) {
          console.log('   ⏸️  Rate limited, waiting 10s...');
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Total: ${dictations.length}`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (successCount > 0) {
      console.log('✅ Dictation audio regenerated!');
      console.log('   Patients will now hear Rakesh Patel\'s voice.\n');
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

regenerateDictationAudio()
  .then(() => {
    console.log('✅ Complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed:', error.message);
    process.exit(1);
  });
