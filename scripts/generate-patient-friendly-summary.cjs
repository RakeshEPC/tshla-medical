/**
 * Generate patient-friendly summary for MIKLYN's dictation
 * Convert medical dictation to 45-60 second patient-friendly audio summary
 */

const { createClient } = require('@supabase/supabase-js');
const { AzureOpenAI } = require('openai');
const axios = require('axios');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const azureClient = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiVersion: '2024-02-01',
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4'
});

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Bella - professional female voice
const MODEL_ID = 'eleven_monolingual_v1';

async function generatePatientSummary() {
  console.log('🏥 Generating Patient-Friendly Summary for MIKLYN\n');

  // 1. Get the dictation
  const { data: dictation } = await supabase
    .from('dictated_notes')
    .select('*')
    .eq('id', 128)
    .single();

  if (!dictation) {
    console.error('❌ Dictation not found');
    return;
  }

  console.log('✅ Dictation found (ID: 128)');
  console.log(`   Patient: ${dictation.patient_name}`);
  console.log(`   Provider: ${dictation.provider_name}`);
  console.log('');

  // 2. Generate patient-friendly summary
  console.log('🤖 Generating patient-friendly summary with AI...');

  const prompt = `You are a medical communication specialist. Convert this medical dictation into a warm, reassuring 45-60 second patient-friendly audio summary.

REQUIREMENTS:
- Address the patient directly (use "you" and "your")
- Use simple, non-technical language
- Be warm and reassuring
- Focus on key points: what was discussed, current medications, lab results, and next steps
- 45-60 seconds when read aloud (approximately 150-200 words)
- Start with a friendly greeting mentioning the visit date
- End with clear next steps

MEDICAL DICTATION:
${dictation.processed_note || dictation.raw_transcript}

OUTPUT: Patient-friendly summary (150-200 words, 45-60 seconds)`;

  const response = await azureClient.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4',
    messages: [
      {
        role: 'system',
        content: 'You are a medical communication specialist who creates warm, patient-friendly summaries.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.7,
    max_tokens: 500
  });

  const patientSummary = response.choices[0].message.content.trim();

  console.log('✅ Patient summary generated:');
  console.log('');
  console.log('─'.repeat(70));
  console.log(patientSummary);
  console.log('─'.repeat(70));
  console.log('');
  console.log(`   Word count: ${patientSummary.split(/\s+/).length}`);
  console.log(`   Estimated duration: ${Math.round(patientSummary.split(/\s+/).length / 2.5)} seconds`);
  console.log('');

  // 3. Generate audio from patient summary
  console.log('🎙️  Generating audio from patient summary...');

  const audioResponse = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
    {
      text: patientSummary,
      model_id: MODEL_ID,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75
      }
    },
    {
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY
      },
      responseType: 'arraybuffer'
    }
  );

  const audioBuffer = Buffer.from(audioResponse.data);
  console.log(`✅ Audio generated: ${(audioBuffer.length / 1024).toFixed(1)} KB`);
  console.log('');

  // 4. Upload audio to Supabase Storage
  console.log('☁️  Uploading to Supabase Storage...');

  const fileName = `dictations/TSH692273/128.mp3`;
  const { error: uploadError } = await supabase.storage
    .from('patient-audio')
    .upload(fileName, audioBuffer, {
      contentType: 'audio/mpeg',
      cacheControl: '3600',
      upsert: true // Overwrite existing
    });

  if (uploadError) {
    console.error('❌ Upload error:', uploadError.message);
    return;
  }

  const { data: urlData } = supabase.storage
    .from('patient-audio')
    .getPublicUrl(fileName);

  console.log(`✅ Uploaded: ${urlData.publicUrl}`);
  console.log('');

  // 5. Update database
  console.log('💾 Updating database...');

  const { error: updateError } = await supabase
    .from('dictated_notes')
    .update({
      ai_summary: patientSummary, // Store patient-friendly summary here
      audio_url: urlData.publicUrl,
      audio_generated_at: new Date().toISOString()
    })
    .eq('id', 128);

  if (updateError) {
    console.error('❌ Database error:', updateError.message);
    return;
  }

  console.log('✅ Database updated');
  console.log('');
  console.log('🎉 Done! MIKLYN now has a patient-friendly audio summary!');
  console.log('');
  console.log('📋 Summary:');
  console.log(`   - Patient summary: ${patientSummary.split(/\s+/).length} words`);
  console.log(`   - Audio size: ${(audioBuffer.length / 1024).toFixed(1)} KB`);
  console.log(`   - Estimated duration: ${Math.round(patientSummary.split(/\s+/).length / 2.5)} seconds`);
}

generatePatientSummary()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
