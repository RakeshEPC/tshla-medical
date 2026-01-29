/**
 * Update Miklyn's dictation audio quickly
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
      model_id: 'eleven_monolingual_v1',
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
      timeout: 60000 // 60 second timeout
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(Buffer.concat(chunks));
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
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
  console.log('🎙️  Updating Miklyn Provenzano dictation audio...\n');

  // Find Miklyn's dictation
  const { data: dictations } = await supabase
    .from('dictations')
    .select('*')
    .ilike('patient_name', '%MIKLYN%')
    .order('visit_date', { ascending: false })
    .limit(1);

  if (!dictations || dictations.length === 0) {
    console.error('❌ Miklyn not found');
    process.exit(1);
  }

  const dictation = dictations[0];
  console.log(`✅ Found: ${dictation.patient_name}`);
  console.log(`   Visit: ${dictation.visit_date}`);
  console.log(`   Note: ${dictation.final_note.length} chars\n`);

  console.log('🎙️  Generating audio with Rakesh Patel voice...');
  const audioBuffer = await generateAudio(dictation.final_note);
  console.log(`✅ Generated (${(audioBuffer.length / 1024).toFixed(1)} KB)\n`);

  const base64Audio = audioBuffer.toString('base64');
  const audioDataUrl = `data:audio/mpeg;base64,${base64Audio}`;

  console.log('💾 Updating database...');
  await supabase
    .from('dictations')
    .update({ audio_url: audioDataUrl })
    .eq('id', dictation.id);

  console.log('✅ Done! Miklyn\'s audio now uses Rakesh Patel voice.\n');
  console.log('🌐 Test at: https://www.tshla.ai/patient-portal/audio');
})();
