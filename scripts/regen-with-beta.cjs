const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('🔄 Regenerating with BETA DISCLAIMER\n');
  
  const { data: dict } = await supabase.from('dictated_notes').select('processed_note, patient_name, provider_name').eq('id', 128).single();
  const firstName = dict.patient_name.split(' ')[0];
  const doctorLastName = dict.provider_name.split(' ').pop();
  
  const prompt = `You are converting a medical SOAP note into a patient-friendly summary.

PATIENT: ${firstName} | DOCTOR: ${doctorLastName}

CRITICAL RULES:
1. START: "Hi ${firstName}, this is a summary from Dr. ${doctorLastName}'s office."
2. END: "If there were any errors, please let us know. We're still in beta and testing it out!"
3. 100-150 words, warm conversational tone
4. Plain English, no jargon
5. Include: reason for visit, findings, meds, tests, follow-up

SOAP: ${dict.processed_note}

ONLY output the spoken words - no labels or headers.`;

  const r = await axios.post(\`\${process.env.VITE_AZURE_OPENAI_ENDPOINT}/openai/deployments/\${process.env.VITE_AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=2024-02-01\`,
    { messages: [{ role: 'user', content: prompt }], max_tokens: 500, temperature: 0.7 },
    { headers: { 'Content-Type': 'application/json', 'api-key': process.env.AZURE_OPENAI_KEY } }
  );
  
  const summary = r.data.choices[0].message.content.trim();
  console.log('✅ Summary:\n');
  console.log(summary);
  console.log('\n🎙️  Generating audio...');
  
  const ar = await axios.post('https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL',
    { text: summary, model_id: 'eleven_monolingual_v1', voice_settings: { stability: 0.5, similarity_boost: 0.75 } },
    { headers: { 'Accept': 'audio/mpeg', 'Content-Type': 'application/json', 'xi-api-key': process.env.ELEVENLABS_API_KEY }, responseType: 'arraybuffer' }
  );
  
  const audioBuffer = Buffer.from(ar.data);
  console.log(\`✅ Audio: \${(audioBuffer.length / 1024).toFixed(1)} KB\`);
  
  await supabase.storage.from('patient-audio').upload('dictations/TSH692273/128.mp3', audioBuffer, { contentType: 'audio/mpeg', cacheControl: '0', upsert: true });
  const { data: urlData } = supabase.storage.from('patient-audio').getPublicUrl('dictations/TSH692273/128.mp3');
  
  await supabase.from('dictated_notes').update({ ai_summary: summary, audio_url: \`\${urlData.publicUrl}?v=\${Date.now()}\`, audio_generated_at: new Date().toISOString() }).eq('id', 128);
  
  console.log('✅ Done! Hard refresh (Cmd+Shift+R)');
})();
