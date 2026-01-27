/**
 * Generate Patient Summaries and Audio from Dictations
 *
 * Workflow:
 * 1. Read all dictations with processed_note
 * 2. Generate 45-60 second patient-friendly summary using Azure OpenAI
 * 3. Convert summary to audio using ElevenLabs TTS
 * 4. Upload audio to Supabase Storage
 * 5. Update dictated_notes with patient_summary and audio_url
 *
 * Created: 2026-01-26
 */

const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const AZURE_OPENAI_KEY = process.env.AZURE_OPENAI_KEY;
const AZURE_OPENAI_ENDPOINT = process.env.VITE_AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_DEPLOYMENT = process.env.VITE_AZURE_OPENAI_DEPLOYMENT || 'gpt-4o-mini';
const AZURE_API_VERSION = process.env.VITE_AZURE_OPENAI_API_VERSION || '2024-02-01';

// ElevenLabs voice configuration
const VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Bella - professional female voice
const MODEL_ID = 'eleven_monolingual_v1';
const STORAGE_BUCKET = 'patient-audio';
const FOLDER_PREFIX = 'dictations';

// Initialize Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Generate patient-friendly summary from processed SOAP note
 * Uses existing AI prompt from echo-audio-summary.js
 */
async function generatePatientSummary(processedNote, patientName, providerName) {
  const firstName = patientName ? patientName.split(' ')[0] : null;
  const doctorLastName = providerName ? providerName.split(' ').pop() : null;

  const prompt = `You are converting a medical SOAP note into a patient-friendly summary.

PATIENT INFORMATION:
- Patient's first name: ${firstName || 'Unknown'}
- Doctor's last name: ${doctorLastName || 'your doctor'}

CRITICAL RULES:
1. START with exactly: "Hi ${firstName || 'there'}, this is a summary from Dr. ${doctorLastName || 'your doctor'}'s office."
2. DO NOT use placeholders - use the ACTUAL names provided above
3. Use warm, conversational, natural language (avoid clinical jargon)
4. Say "You came in for [reason]" NOT "Chief complaint was"
5. Include in this order:
   a) Why they came in (conversational)
   b) Key findings (blood sugar, vitals, important results - plain English)
   c) Medication changes (what's new, doses clearly stated)
   d) Tests ordered (labs, imaging - explain what and why simply)
   e) Follow-up plan (when to come back)
   f) What patient should do (take meds, diet, exercise)
6. END with exactly: "If you notice any errors in this summary, please let us know."
7. LENGTH: 100-150 words total (45-60 seconds when spoken)
8. NUMBERS: Say "9 point 5" not "nine point five"
9. MEDICATIONS: Say full name and dose clearly: "Metformin 1500 milligrams twice daily"
10. TONE: Warm but professional

SOAP NOTE:
${processedNote}

IMPORTANT: Your response should be ONLY the words that will be spoken to the patient. Do not include any labels, headers, explanations, or meta-commentary.`;

  try {
    const response = await axios.post(
      `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${AZURE_API_VERSION}`,
      {
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.7
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'api-key': AZURE_OPENAI_KEY
        }
      }
    );

    const summary = response.data.choices[0]?.message?.content?.trim();
    return summary;
  } catch (error) {
    console.error('   ❌ Azure OpenAI error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Generate audio from text using ElevenLabs TTS
 */
async function generateAudioFromText(text, voiceId = VOICE_ID) {
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

  const audioBuffer = Buffer.from(response.data);
  return audioBuffer;
}

/**
 * Upload audio to Supabase Storage
 */
async function uploadAudioToStorage(audioBuffer, tshlaId, dictationId) {
  const fileName = `${FOLDER_PREFIX}/${tshlaId}/${dictationId}.mp3`;

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, audioBuffer, {
      contentType: 'audio/mpeg',
      cacheControl: '3600',
      upsert: true
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

/**
 * Update dictated_notes with audio URL
 * Note: patient_summary column doesn't exist yet - just storing in processed_note for now
 */
async function updateDictation(dictationId, patientSummary, audioUrl) {
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

  // Log the patient summary for reference (will add column later)
  console.log(`   📝 Patient summary: "${patientSummary.substring(0, 80)}..."`);
}

/**
 * Get TSHLA ID from phone number
 */
async function getTshlaId(phone) {
  if (!phone) return 'UNKNOWN';

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
      return patient.tshla_id;
    }
  }

  return 'UNKNOWN';
}

/**
 * Process single dictation
 */
async function processDictation(dictation, index, total) {
  console.log(`\n[${index}/${total}] ${dictation.patient_name}`);
  console.log(`   ID: ${dictation.id}`);
  console.log(`   Date: ${dictation.created_at?.substring(0, 10)}`);

  try {
    // Skip if already has audio
    if (dictation.audio_url && !dictation.audio_deleted) {
      console.log(`   ⏭️  Already has audio, skipping\n`);
      return { status: 'skipped', reason: 'already_complete' };
    }

    // Check if we have processed note
    if (!dictation.processed_note || dictation.processed_note.trim().length === 0) {
      console.log(`   ⚠️  No processed_note, skipping\n`);
      return { status: 'skipped', reason: 'no_processed_note' };
    }

    // Get TSHLA ID
    const tshlaId = await getTshlaId(dictation.patient_phone);
    if (tshlaId !== 'UNKNOWN') {
      console.log(`   ✅ Found TSHLA ID: ${tshlaId}`);
    }

    // Generate patient summary (45-60 seconds)
    console.log(`   🤖 Generating patient-friendly summary...`);
    const patientSummary = await generatePatientSummary(
      dictation.processed_note,
      dictation.patient_name,
      dictation.provider_name
    );
    console.log(`   ✅ Summary generated (${patientSummary.length} characters)`);
    console.log(`   Preview: "${patientSummary.substring(0, 100)}..."`);

    // Generate audio from summary
    console.log(`   🎙️  Converting summary to audio...`);
    const audioBuffer = await generateAudioFromText(patientSummary);
    console.log(`   ✅ Audio generated (${(audioBuffer.length / 1024).toFixed(1)} KB)`);

    // Upload to storage
    console.log(`   ☁️  Uploading to Supabase Storage...`);
    const audioUrl = await uploadAudioToStorage(audioBuffer, tshlaId, dictation.id);
    console.log(`   ✅ Uploaded: ${audioUrl}`);

    // Update database
    console.log(`   💾 Updating database...`);
    await updateDictation(dictation.id, patientSummary, audioUrl);
    console.log(`   ✅ Complete!\n`);

    return { status: 'success' };

  } catch (error) {
    console.error(`   ❌ Error: ${error.message}\n`);
    return { status: 'error', error: error.message };
  }
}

/**
 * Main execution
 */
async function main() {
  console.log(`🎙️  GENERATE PATIENT SUMMARIES AND AUDIO\n`);
  console.log(`=`.repeat(80) + '\n');

  try {
    // Verify environment variables
    if (!AZURE_OPENAI_KEY || !ELEVENLABS_API_KEY) {
      throw new Error('Missing required API keys (AZURE_OPENAI_KEY, ELEVENLABS_API_KEY)');
    }

    // Check storage bucket exists
    console.log(`📦 Checking Supabase Storage bucket...\n`);
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(b => b.name === STORAGE_BUCKET);
    if (bucketExists) {
      console.log(`✅ Bucket '${STORAGE_BUCKET}' exists\n`);
    } else {
      console.log(`⚠️  Bucket '${STORAGE_BUCKET}' not found, creating it...\n`);
      const { error } = await supabase.storage.createBucket(STORAGE_BUCKET, { public: true });
      if (error) {
        throw new Error(`Failed to create bucket: ${error.message}`);
      }
      console.log(`✅ Bucket created\n`);
    }

    // Load all dictations
    console.log(`📋 Loading all dictations...\n`);
    const { data: dictations, error } = await supabase
      .from('dictated_notes')
      .select('id, patient_name, patient_phone, provider_name, processed_note, audio_url, audio_deleted, created_at')
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to load dictations: ${error.message}`);
    }

    console.log(`✅ Loaded ${dictations.length} dictations\n`);
    console.log(`=`.repeat(80) + '\n');

    // Process each dictation
    const results = {
      success: 0,
      skipped: 0,
      errors: 0
    };

    for (let i = 0; i < dictations.length; i++) {
      const result = await processDictation(dictations[i], i + 1, dictations.length);

      if (result.status === 'success') results.success++;
      else if (result.status === 'skipped') results.skipped++;
      else if (result.status === 'error') results.errors++;

      // Rate limiting: 1.2 seconds between requests (50 req/min)
      if (i < dictations.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1200));
      }
    }

    // Summary
    console.log(`\n` + `=`.repeat(80));
    console.log(`\n✅ COMPLETE!\n`);
    console.log(`   Success: ${results.success}`);
    console.log(`   Skipped: ${results.skipped}`);
    console.log(`   Errors: ${results.errors}`);
    console.log(`   Total: ${dictations.length}\n`);
    console.log(`=`.repeat(80) + '\n');

  } catch (error) {
    console.error(`\n❌ Fatal error: ${error.message}\n`);
    process.exit(1);
  }
}

// Run main function
main();
