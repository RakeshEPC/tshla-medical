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
  console.log('🎙️  Uploading Sarah Wehe Audio to Supabase Storage\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Get Sarah's note with patient-friendly summary
  const { data: note } = await supabase
    .from('dictated_notes')
    .select('*')
    .eq('patient_phone', '(903) 519-6092')
    .single();

  if (!note || !note.ai_summary) {
    console.error('❌ No patient-friendly summary found');
    process.exit(1);
  }

  console.log('✅ Found note with patient-friendly summary');
  console.log('   Patient:', note.patient_name);
  console.log('   Summary:', note.ai_summary.length, 'chars');

  // Generate audio
  console.log('\n🎙️  Generating audio...');
  const buffer = await generateAudio(note.ai_summary);
  console.log('✅ Generated:', (buffer.length / 1024).toFixed(1), 'KB');

  // Upload to Supabase Storage
  const filename = `dictated-notes/sarah-wehe-${Date.now()}.mp3`;

  console.log('\n📤 Uploading to Supabase Storage...');
  console.log('   Bucket: patient-audio');
  console.log('   File:', filename);

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('patient-audio')
    .upload(filename, buffer, {
      contentType: 'audio/mpeg',
      upsert: false
    });

  if (uploadError) {
    console.error('❌ Upload error:', uploadError.message);

    // Try creating bucket if it doesn't exist
    if (uploadError.message.includes('not found')) {
      console.log('\n📦 Bucket not found, creating...');
      // Note: Bucket creation requires admin API, may need to create manually
      console.log('⚠️  You may need to create the "patient-audio" bucket in Supabase dashboard');
    }

    process.exit(1);
  }

  console.log('✅ Uploaded successfully');

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('patient-audio')
    .getPublicUrl(filename);

  const publicUrl = urlData.publicUrl;
  console.log('🌐 Public URL:', publicUrl);

  // Update database
  console.log('\n💾 Updating database...');
  const { error: updateError } = await supabase
    .from('dictated_notes')
    .update({
      audio_url: publicUrl,
      audio_deleted: false,
      audio_generated_at: new Date().toISOString()
    })
    .eq('id', note.id);

  if (updateError) {
    console.error('❌ Update error:', updateError);
    process.exit(1);
  }

  console.log('✅ Database updated!');
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ SUCCESS!');
  console.log('   Audio uploaded to Supabase Storage');
  console.log('   URL:', publicUrl);
  console.log('\n🌐 Test: https://www.tshla.ai/patient-portal/audio');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
})();
