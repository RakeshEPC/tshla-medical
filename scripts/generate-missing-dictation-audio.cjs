/**
 * Generate Audio for Dictations Missing Audio
 * Creates audio files for dictations that don't have audio yet
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const https = require('https');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const RAKESH_VOICE_ID = 'f6qhiUOSRVGsfwvD4oSU';

async function generateAudio(text) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      text: text,
      model_id: 'eleven_turbo_v2_5', // Faster model
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75
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
        'Content-Type': 'application/json'
      },
      timeout: 90000
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(Buffer.concat(chunks));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${Buffer.concat(chunks).toString()}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });

    req.write(postData);
    req.end();
  });
}

(async () => {
  console.log('🎙️  Generating Audio for Dictations Missing Audio\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Find dictations without audio
  const { data: dictations, error } = await supabase
    .from('dictations')
    .select('id, patient_name, visit_date, final_note, audio_url')
    .not('final_note', 'is', null)
    .is('deleted_at', null)
    .order('visit_date', { ascending: false });

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  // Filter to only those without audio
  const missingAudio = dictations.filter(d => !d.audio_url);

  console.log(`\n📊 Status:`);
  console.log(`   Total dictations: ${dictations.length}`);
  console.log(`   Missing audio: ${missingAudio.length}`);
  console.log(`   Have audio: ${dictations.length - missingAudio.length}\n`);

  if (missingAudio.length === 0) {
    console.log('✅ All dictations have audio!');
    process.exit(0);
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < missingAudio.length; i++) {
    const d = missingAudio[i];
    console.log(`\n[${i + 1}/${missingAudio.length}] ${d.patient_name || 'Unknown'}`);
    console.log(`   Visit: ${d.visit_date}`);
    console.log(`   Note: ${d.final_note.length} chars`);

    try {
      console.log('   🎙️  Generating...');
      const buffer = await generateAudio(d.final_note);
      const sizeKB = (buffer.length / 1024).toFixed(1);
      console.log(`   ✅ Generated (${sizeKB} KB)`);

      const base64 = buffer.toString('base64');
      const dataUrl = `data:audio/mpeg;base64,${base64}`;

      console.log('   💾 Saving...');
      const { error: updateError } = await supabase
        .from('dictations')
        .update({ audio_url: dataUrl })
        .eq('id', d.id);

      if (updateError) throw updateError;

      console.log('   ✅ Saved');
      success++;

      // Rate limit
      if (i < missingAudio.length - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }

    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`);
      failed++;

      if (err.message.includes('429') || err.message.includes('Timeout')) {
        console.log('   ⏸️  Waiting 15s...');
        await new Promise(r => setTimeout(r, 15000));
      }
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   ✅ Success: ${success}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('✅ Done! All dictations now have Rakesh Patel audio.');
  console.log('🌐 Test at: https://www.tshla.ai/patient-portal/audio\n');
})();
