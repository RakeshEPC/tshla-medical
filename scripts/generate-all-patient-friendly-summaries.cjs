require('dotenv').config();
const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const RAKESH_VOICE_ID = 'f6qhiUOSRVGsfwvD4oSU';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

async function generatePatientFriendlySummary(clinicalNote, patientName) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a medical communication expert. Convert clinical notes into warm, patient-friendly summaries that patients can understand. Use first-person ("you") and explain medical terms simply. Keep it concise and conversational.`
        },
        {
          role: 'user',
          content: `Convert this clinical note into a patient-friendly audio script for ${patientName}:

${clinicalNote}

Create a warm, conversational summary (2-3 paragraphs max) that:
- Addresses the patient by first name warmly
- Explains the visit purpose and findings simply
- Lists key action items (medications, follow-ups) clearly
- Ends with encouragement
- Is suitable for text-to-speech audio
- Uses simple language a patient can understand`
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    const options = {
      hostname: 'api.openai.com',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 60000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.choices && response.choices[0]) {
            resolve(response.choices[0].message.content);
          } else {
            reject(new Error('Invalid OpenAI response'));
          }
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(postData);
    req.end();
  });
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
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
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
          reject(new Error(`ElevenLabs error: ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(postData);
    req.end();
  });
}

(async () => {
  console.log('🔄 Generating Patient-Friendly Summaries & Audio\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Get all notes missing AI summaries
  const { data: notes } = await supabase
    .from('dictated_notes')
    .select('id, patient_name, processed_note')
    .is('ai_summary', null)
    .not('processed_note', 'is', null)
    .order('id', { ascending: true });

  console.log(`\n📊 Found ${notes?.length || 0} records to process\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const note of notes || []) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📝 Processing: ${note.patient_name || 'Unknown'} (ID: ${note.id})`);

    try {
      // Skip if clinical note is too long (ElevenLabs has limits)
      if (note.processed_note.length > 40000) {
        console.log('   ⚠️  Clinical note too long, truncating...');
        note.processed_note = note.processed_note.substring(0, 40000);
      }

      // Step 1: Generate patient-friendly summary
      console.log('   🤖 Generating patient-friendly summary...');
      const patientFriendlySummary = await generatePatientFriendlySummary(
        note.processed_note,
        note.patient_name || 'Patient'
      );
      console.log(`   ✅ Summary generated: ${patientFriendlySummary.length} chars`);

      // Step 2: Generate audio from summary
      console.log('   🔊 Generating audio with Rakesh voice...');
      const audioBuffer = await generateAudio(patientFriendlySummary);
      const sizeKB = (audioBuffer.length / 1024).toFixed(1);
      console.log(`   ✅ Audio generated: ${sizeKB} KB`);

      // Step 3: Upload to Supabase Storage
      const timestamp = Date.now();
      const patientSlug = (note.patient_name || 'patient')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-');
      const filename = `dictated-notes/${patientSlug}-${note.id}-${timestamp}.mp3`;

      console.log('   ☁️  Uploading to Supabase Storage...');
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('patient-audio')
        .upload(filename, audioBuffer, {
          contentType: 'audio/mpeg',
          upsert: false
        });

      if (uploadError) {
        console.error('   ❌ Upload error:', uploadError.message);
        errorCount++;
        continue;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('patient-audio')
        .getPublicUrl(filename);

      const publicUrl = urlData.publicUrl;
      console.log('   ✅ Uploaded successfully');

      // Step 4: Update database
      const { error: updateError } = await supabase
        .from('dictated_notes')
        .update({
          ai_summary: patientFriendlySummary,
          audio_url: publicUrl,
          audio_deleted: false,
          audio_generated_at: new Date().toISOString()
        })
        .eq('id', note.id);

      if (updateError) {
        console.error('   ❌ Database update error:', updateError.message);
        errorCount++;
        continue;
      }

      console.log('   ✅ Database updated');
      successCount++;

      // Rate limiting - wait between requests
      if (successCount % 10 === 0) {
        console.log('\n   ⏸️  Pausing 5s to respect rate limits...');
        await new Promise(r => setTimeout(r, 5000));
      }

    } catch (err) {
      console.error('   ❌ Error:', err.message);
      errorCount++;

      // Wait on errors too
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Processing Summary:');
  console.log(`   Total records: ${notes?.length || 0}`);
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${errorCount}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
})();
