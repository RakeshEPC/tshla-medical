require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const OpenAI = require('openai');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const RAKESH_VOICE_ID = 'f6qhiUOSRVGsfwvD4oSU';

async function generatePatientFriendlySummary(clinicalNote, patientName) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a medical communication expert. Convert clinical notes into warm, patient-friendly summaries that patients can understand. Use first-person ("you") and explain medical terms simply. Keep it conversational and reassuring.`
      },
      {
        role: 'user',
        content: `Convert this clinical note into a patient-friendly audio script for ${patientName}:

${clinicalNote}

Create a warm, conversational summary (2-3 paragraphs max) that:
- Addresses the patient by first name
- Explains the visit purpose and findings simply
- Lists key action items (medications, follow-ups)
- Ends with encouragement
- Is suitable for text-to-speech audio`
      }
    ],
    temperature: 0.7,
    max_tokens: 500
  });

  return response.choices[0].message.content;
}

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
  console.log('🎙️  Creating Patient-Friendly Summary for Sarah Wehe\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Get Sarah's dictated note
  const { data: note } = await supabase
    .from('dictated_notes')
    .select('*')
    .eq('patient_phone', '(903) 519-6092')
    .single();

  if (!note) {
    console.error('❌ Sarah not found');
    process.exit(1);
  }

  console.log('✅ Found note:');
  console.log('   Patient:', note.patient_name);
  console.log('   Visit:', note.visit_date);
  console.log('   Clinical note:', note.processed_note?.length || 0, 'chars');

  // Generate patient-friendly summary
  console.log('\n🤖 Generating patient-friendly summary with GPT-4...');
  const patientSummary = await generatePatientFriendlySummary(
    note.processed_note || note.raw_transcript,
    'Sarah'
  );

  console.log('✅ Generated summary:');
  console.log('   Length:', patientSummary.length, 'chars');
  console.log('\n--- PATIENT-FRIENDLY SUMMARY ---');
  console.log(patientSummary);
  console.log('--- END SUMMARY ---\n');

  // Generate audio
  console.log('🎙️  Generating audio with Rakesh Patel voice...');
  const buffer = await generateAudio(patientSummary);
  const sizeKB = (buffer.length / 1024).toFixed(1);
  console.log('✅ Generated audio:', sizeKB, 'KB');

  const dataUrl = `data:audio/mpeg;base64,${buffer.toString('base64')}`;

  // Save to database
  console.log('💾 Updating database...');
  const { error } = await supabase
    .from('dictated_notes')
    .update({
      ai_summary: patientSummary,
      audio_url: dataUrl,
      audio_deleted: false,
      audio_generated_at: new Date().toISOString()
    })
    .eq('id', note.id);

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  console.log('✅ Saved to database!');
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ SUCCESS!');
  console.log('   Patient-friendly summary created');
  console.log('   Audio generated with Rakesh Patel voice');
  console.log('   Size:', sizeKB, 'KB');
  console.log('\n🌐 Test: https://www.tshla.ai/patient-portal/audio');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
})();
