/**
 * Generate Audio for Dictated Notes (Patient-Friendly Summaries)
 * Uses ai_summary field for patient-friendly audio
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
      model_id: 'eleven_turbo_v2_5',
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
  console.log('🎙️  Generating Audio for Dictated Notes (Patient-Friendly)\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Fetch dictated notes
  const { data: notes, error } = await supabase
    .from('dictated_notes')
    .select('id, patient_name, visit_date, ai_summary, audio_url, audio_deleted')
    .not('ai_summary', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  // Filter those without audio or deleted audio
  const needsAudio = notes.filter(n => !n.audio_url || n.audio_deleted);

  console.log(`\n📊 Status:`);
  console.log(`   Total notes: ${notes.length}`);
  console.log(`   Need audio: ${needsAudio.length}`);
  console.log(`   Have audio: ${notes.length - needsAudio.length}\n`);

  if (needsAudio.length === 0) {
    console.log('✅ All notes have audio!');
    process.exit(0);
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < needsAudio.length; i++) {
    const note = needsAudio[i];
    console.log(`\n[${i + 1}/${needsAudio.length}] ${note.patient_name || 'Unknown'}`);
    console.log(`   Visit: ${note.visit_date}`);
    console.log(`   Summary: ${note.ai_summary.length} chars`);

    try {
      console.log('   🎙️  Generating Rakesh Patel audio...');
      const buffer = await generateAudio(note.ai_summary);
      const sizeKB = (buffer.length / 1024).toFixed(1);
      console.log(`   ✅ Generated (${sizeKB} KB)`);

      const base64 = buffer.toString('base64');
      const dataUrl = `data:audio/mpeg;base64,${base64}`;

      console.log('   💾 Saving...');
      const { error: updateError } = await supabase
        .from('dictated_notes')
        .update({
          audio_url: dataUrl,
          audio_deleted: false,
          audio_generated_at: new Date().toISOString()
        })
        .eq('id', note.id);

      if (updateError) throw updateError;

      console.log('   ✅ Saved');
      success++;

      // Rate limit
      if (i < needsAudio.length - 1) {
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

  console.log('✅ Done! Patient-friendly audio now uses Rakesh Patel voice.');
  console.log('🌐 Test at: https://www.tshla.ai/patient-portal/audio\n');
})();
