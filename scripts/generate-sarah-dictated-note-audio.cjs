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
  console.log('🎙️  Generating Audio for Sarah Wehe Dictated Note\n');

  // Get Sarah's dictated_notes record
  const { data: note } = await supabase
    .from('dictated_notes')
    .select('*')
    .eq('patient_phone', '9035196092')
    .single();

  if (!note) {
    console.error('❌ Sarah Wehe dictated_note not found');
    process.exit(1);
  }

  console.log('✅ Found dictated_note:');
  console.log('   ID:', note.id);
  console.log('   Patient:', note.patient_name);
  console.log('   Visit:', note.visit_date);

  // Use ai_summary (patient-friendly), or fall back to processed_note or raw_transcript
  const textForAudio = note.ai_summary || note.processed_note || note.raw_transcript;

  if (!textForAudio) {
    console.error('❌ No text content available');
    process.exit(1);
  }

  console.log('   Text source:', note.ai_summary ? 'ai_summary' : (note.processed_note ? 'processed_note' : 'raw_transcript'));
  console.log('   Text length:', textForAudio.length, 'chars');
  console.log('\n🎙️  Generating audio with Rakesh Patel voice...');

  const buffer = await generateAudio(textForAudio);
  const sizeKB = (buffer.length / 1024).toFixed(1);
  console.log('✅ Generated:', sizeKB, 'KB');

  const dataUrl = `data:audio/mpeg;base64,${buffer.toString('base64')}`;

  console.log('💾 Saving to database...');
  const { error } = await supabase
    .from('dictated_notes')
    .update({
      audio_url: dataUrl,
      audio_deleted: false,
      audio_generated_at: new Date().toISOString()
    })
    .eq('id', note.id);

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  console.log('✅ Saved successfully!');
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Sarah Wehe dictated_note audio updated!');
  console.log('   Voice: Rakesh Patel');
  console.log('   Size:', sizeKB, 'KB');
  console.log('🌐 Test: https://www.tshla.ai/patient-portal/audio');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
})();
