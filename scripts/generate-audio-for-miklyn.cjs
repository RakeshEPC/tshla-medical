/**
 * Generate audio for MIKLYN's dictation (ID 128)
 */

const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// ElevenLabs voice configuration
const VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Bella - professional female voice
const MODEL_ID = 'eleven_monolingual_v1';
const STORAGE_BUCKET = 'patient-audio';
const FOLDER_PREFIX = 'dictations';

// Initialize Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Generate audio from text using ElevenLabs TTS
 */
async function generateAudioFromText(text, voiceId = VOICE_ID) {
  console.log(`   🎙️  Generating audio (${text.length} characters)...`);

  const response = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      text: text,
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

  if (response.status !== 200) {
    throw new Error(`ElevenLabs API error: ${response.status} - ${response.statusText}`);
  }

  // Return audio buffer
  const audioBuffer = Buffer.from(response.data);
  console.log(`   ✅ Audio generated (${(audioBuffer.length / 1024).toFixed(1)} KB)`);
  return audioBuffer;
}

/**
 * Upload audio to Supabase Storage
 */
async function uploadAudioToStorage(audioBuffer, tshlaId, dictationId) {
  const fileName = `${FOLDER_PREFIX}/${tshlaId}/${dictationId}.mp3`;

  console.log(`   ☁️  Uploading to Supabase Storage: ${fileName}...`);

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, audioBuffer, {
      contentType: 'audio/mpeg',
      cacheControl: '3600',
      upsert: true // Overwrite if exists
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(fileName);

  console.log(`   ✅ Uploaded: ${urlData.publicUrl}`);
  return urlData.publicUrl;
}

/**
 * Update dictated_notes with audio URL
 */
async function updateDictationWithAudioUrl(dictationId, audioUrl) {
  const { error } = await supabase
    .from('dictated_notes')
    .update({
      audio_url: audioUrl,
      audio_generated_at: new Date().toISOString()
    })
    .eq('id', dictationId);

  if (error) {
    throw new Error(`Failed to update dictation: ${error.message}`);
  }

  console.log(`   ✅ Updated dictation ${dictationId} with audio URL`);
}

async function main() {
  console.log('🎵 Generating audio for MIKLYN PROVENZANO dictation\n');

  // 1. Get dictation
  const { data: dictation, error } = await supabase
    .from('dictated_notes')
    .select('id, patient_name, processed_note, raw_transcript')
    .eq('id', 128)
    .single();

  if (error || !dictation) {
    console.error('❌ Error: Dictation not found');
    process.exit(1);
  }

  console.log('✅ Found dictation:');
  console.log(`   ID: ${dictation.id}`);
  console.log(`   Patient: ${dictation.patient_name}`);
  console.log('');

  // 2. Get text to convert
  const textToConvert = dictation.processed_note || dictation.raw_transcript;

  if (!textToConvert) {
    console.error('❌ Error: No text found in dictation');
    process.exit(1);
  }

  console.log(`📝 Text length: ${textToConvert.length} characters`);
  console.log('');

  // 3. Generate audio
  const audioBuffer = await generateAudioFromText(textToConvert);

  // 4. Upload to storage
  const audioUrl = await uploadAudioToStorage(audioBuffer, 'TSH692273', dictation.id);

  // 5. Update database
  await updateDictationWithAudioUrl(dictation.id, audioUrl);

  console.log('');
  console.log('✅ Audio generation complete!');
  console.log(`   Audio URL: ${audioUrl}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
