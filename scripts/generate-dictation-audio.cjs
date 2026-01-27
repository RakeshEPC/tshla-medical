/**
 * Generate TTS Audio from Dictations
 * Converts all dictation text to audio using ElevenLabs TTS
 * Uploads to Supabase Storage and updates dictated_notes.audio_url
 * Created: 2026-01-26
 */

const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

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
    throw new Error(`Database update failed: ${error.message}`);
  }

  console.log(`   ✅ Database updated with audio URL\n`);
}

/**
 * Process a single dictation
 */
async function processDictation(dictation, index, total) {
  console.log(`\n[${index}/${total}] ${dictation.patient_name}`);
  console.log(`   ID: ${dictation.id}`);
  console.log(`   Date: ${dictation.created_at?.substring(0, 10)}`);

  try {
    // Skip if already has audio URL and not deleted
    if (dictation.audio_url && !dictation.audio_deleted) {
      console.log(`   ⏭️  Already has audio, skipping\n`);
      return { status: 'skipped', reason: 'already_has_audio' };
    }

    // Use processed_note (formatted) or raw_transcript as fallback
    const textContent = dictation.processed_note || dictation.raw_transcript;

    if (!textContent || textContent.trim().length === 0) {
      console.log(`   ⚠️  No text content, skipping\n`);
      return { status: 'skipped', reason: 'no_text' };
    }

    // Truncate very long texts (ElevenLabs has limits)
    const maxChars = 5000;
    const truncatedText = textContent.length > maxChars
      ? textContent.substring(0, maxChars) + '...'
      : textContent;

    if (textContent.length > maxChars) {
      console.log(`   ⚠️  Text truncated from ${textContent.length} to ${maxChars} characters`);
    }

    // Get TSHLA ID from unified_patients via phone (need for storage path)
    let tshlaId = 'UNKNOWN';
    const phone = dictation.patient_phone;
    if (phone) {
      // Try multiple phone format variations
      const phoneDigits = phone.replace(/\D/g, '');
      const phoneVariations = [
        phone,
        phoneDigits,
        `+1${phoneDigits}`,
        phoneDigits.length === 10 ? phoneDigits : phoneDigits.slice(-10)
      ];

      for (const phoneVar of phoneVariations) {
        const { data: patient } = await supabase
          .from('unified_patients')
          .select('tshla_id')
          .eq('phone_primary', phoneVar)
          .maybeSingle();

        if (patient?.tshla_id) {
          tshlaId = patient.tshla_id;
          console.log(`   ✅ Found TSHLA ID: ${tshlaId}`);
          break;
        }
      }
    }

    // Generate audio
    const audioBuffer = await generateAudioFromText(truncatedText);

    // Upload to storage
    const audioUrl = await uploadAudioToStorage(audioBuffer, tshlaId, dictation.id);

    // Update database
    await updateDictationWithAudioUrl(dictation.id, audioUrl);

    // Rate limiting: Wait 1.2 seconds between requests (50 requests/minute)
    await new Promise(resolve => setTimeout(resolve, 1200));

    return { status: 'success', audioUrl };

  } catch (error) {
    console.error(`   ❌ Error: ${error.message}\n`);
    return { status: 'error', error: error.message };
  }
}

/**
 * Main function
 */
async function generateAllDictationAudio() {
  console.log('🎙️  GENERATE DICTATION AUDIO\n');
  console.log('=' .repeat(80) + '\n');

  // Verify environment variables
  if (!ELEVENLABS_API_KEY) {
    console.error('❌ ELEVENLABS_API_KEY not set in environment');
    return;
  }

  // Check if storage bucket exists
  console.log('📦 Checking Supabase Storage bucket...\n');
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some(b => b.name === STORAGE_BUCKET);

  if (!bucketExists) {
    console.error(`❌ Storage bucket '${STORAGE_BUCKET}' does not exist!`);
    console.log('\n💡 Create it in Supabase Dashboard:');
    console.log(`   https://supabase.com/dashboard/project/minvvjdflezibmgkplqb/storage/buckets\n`);
    return;
  }

  console.log(`✅ Bucket '${STORAGE_BUCKET}' exists\n`);

  // Fetch all dictations
  console.log('📋 Loading all dictations...\n');

  const { data: dictations, error } = await supabase
    .from('dictated_notes')
    .select('id, patient_name, patient_phone, raw_transcript, processed_note, audio_url, audio_deleted, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌ Error loading dictations:', error.message);
    return;
  }

  console.log(`✅ Loaded ${dictations.length} dictations\n`);
  console.log('=' .repeat(80));

  // Process each dictation
  const results = {
    success: 0,
    skipped: 0,
    error: 0,
    total: dictations.length
  };

  for (let i = 0; i < dictations.length; i++) {
    const result = await processDictation(dictations[i], i + 1, dictations.length);

    if (result.status === 'success') results.success++;
    else if (result.status === 'skipped') results.skipped++;
    else if (result.status === 'error') results.error++;
  }

  // Summary
  console.log('=' .repeat(80));
  console.log('\n📊 GENERATION SUMMARY\n');
  console.log(`Total dictations: ${results.total}`);
  console.log(`✅ Successfully generated: ${results.success}`);
  console.log(`⏭️  Skipped: ${results.skipped}`);
  console.log(`❌ Errors: ${results.error}`);

  const successRate = ((results.success / results.total) * 100).toFixed(1);
  console.log(`\n📈 Success rate: ${successRate}%`);

  console.log('\n' + '=' .repeat(80));
  console.log('\n✅ Audio generation complete!');
  console.log('\n💡 Next steps:');
  console.log('   1. Test audio playback in patient portal');
  console.log('   2. Verify audio files in Supabase Storage');
  console.log('   3. Update patient portal UI to display dictations\n');
}

// Run
generateAllDictationAudio()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
