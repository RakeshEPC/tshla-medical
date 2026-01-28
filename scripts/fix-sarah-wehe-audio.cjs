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
  console.log('🎙️  Fixing Sarah Wehe Audio with Rakesh Patel Voice\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const phone = '9035196092';

  // 1. Fix dictated_notes
  console.log('\n1️⃣ Updating dictated_notes...');
  const { data: note } = await supabase
    .from('dictated_notes')
    .select('*')
    .eq('patient_phone', phone)
    .single();

  if (note && note.ai_summary) {
    console.log('   Patient:', note.patient_name);
    console.log('   Visit:', note.visit_date);
    console.log('   Summary:', note.ai_summary.length, 'chars');

    console.log('   🎙️  Generating audio...');
    const buffer1 = await generateAudio(note.ai_summary);
    console.log('   ✅ Generated:', (buffer1.length / 1024).toFixed(1), 'KB');

    const dataUrl1 = `data:audio/mpeg;base64,${buffer1.toString('base64')}`;

    await supabase
      .from('dictated_notes')
      .update({
        audio_url: dataUrl1,
        audio_deleted: false,
        audio_generated_at: new Date().toISOString()
      })
      .eq('id', note.id);

    console.log('   ✅ Saved to dictated_notes');
  }

  // 2. Fix patient_audio_summaries
  console.log('\n2️⃣ Updating patient_audio_summaries...');
  const { data: summary } = await supabase
    .from('patient_audio_summaries')
    .select('*')
    .eq('patient_phone', `(903) 519-6092`)
    .single();

  if (summary && summary.summary_script) {
    console.log('   Summary script:', summary.summary_script.length, 'chars');

    console.log('   🎙️  Generating audio...');
    const buffer2 = await generateAudio(summary.summary_script);
    const sizeKB = (buffer2.length / 1024).toFixed(1);
    console.log('   ✅ Generated:', sizeKB, 'KB');

    const dataUrl2 = `data:audio/mpeg;base64,${buffer2.toString('base64')}`;

    await supabase
      .from('patient_audio_summaries')
      .update({
        audio_blob_url: dataUrl2,
        voice_id: RAKESH_VOICE_ID,
        audio_generated_at: new Date().toISOString(),
        audio_file_size_kb: Math.round(parseFloat(sizeKB))
      })
      .eq('id', summary.id);

    console.log('   ✅ Saved to patient_audio_summaries');
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Sarah Wehe audio updated with Rakesh Patel voice!');
  console.log('🌐 Test: https://www.tshla.ai/patient-portal/audio');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
})();
