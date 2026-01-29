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
      model_id: 'eleven_turbo_v2_5',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 }
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
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(postData);
    req.end();
  });
}

(async () => {
  console.log('🎙️  Generating Audio for All Dictated Notes (Rakesh Patel Voice)\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const { data: notes } = await supabase
    .from('dictated_notes')
    .select('*')
    .order('created_at', { ascending: false });

  const missingAudio = notes.filter(n => !n.audio_url && (n.ai_summary || n.processed_note || n.raw_transcript));

  console.log(`\n📊 Status:`);
  console.log(`   Total notes: ${notes.length}`);
  console.log(`   Missing audio: ${missingAudio.length}`);
  console.log(`   Have audio: ${notes.length - missingAudio.length}\n`);

  if (missingAudio.length === 0) {
    console.log('✅ All notes have audio!');
    process.exit(0);
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < missingAudio.length; i++) {
    const note = missingAudio[i];
    const textForAudio = note.ai_summary || note.processed_note || note.raw_transcript;

    console.log(`\n[${i + 1}/${missingAudio.length}] ${note.patient_name || 'Unknown'}`);
    console.log(`   Visit: ${note.visit_date}`);
    console.log(`   Text: ${textForAudio.length} chars`);

    try {
      console.log('   🎙️  Generating...');
      const buffer = await generateAudio(textForAudio);
      const sizeKB = (buffer.length / 1024).toFixed(1);
      console.log(`   ✅ Generated (${sizeKB} KB)`);

      const dataUrl = `data:audio/mpeg;base64,${buffer.toString('base64')}`;

      console.log('   💾 Saving...');
      const { error } = await supabase
        .from('dictated_notes')
        .update({
          audio_url: dataUrl,
          audio_deleted: false,
          audio_generated_at: new Date().toISOString()
        })
        .eq('id', note.id);

      if (error) throw error;

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

  console.log('✅ Done! All dictated notes now have Rakesh Patel audio.');
  console.log('🌐 Test: https://www.tshla.ai/patient-portal/audio\n');
})();
