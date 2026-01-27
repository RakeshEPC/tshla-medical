const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data: dict } = await supabase.from('dictated_notes').select('ai_summary').eq('id', 128).single();
  const newSummary = dict.ai_summary.replace(
    'If you notice any errors in this summary, please let us know.',
    "If there were any errors, please let us know. We're still in beta and testing it out!"
  );
  console.log('Updated:', newSummary.substring(newSummary.length - 100));
  const ar = await axios.post('https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL',
    { text: newSummary, model_id: 'eleven_monolingual_v1', voice_settings: { stability: 0.5, similarity_boost: 0.75 } },
    { headers: { 'Accept': 'audio/mpeg', 'Content-Type': 'application/json', 'xi-api-key': process.env.ELEVENLABS_API_KEY }, responseType: 'arraybuffer' }
  );
  const audioBuffer = Buffer.from(ar.data);
  console.log('Audio:', (audioBuffer.length / 1024).toFixed(1), 'KB');
  await supabase.storage.from('patient-audio').upload('dictations/TSH692273/128.mp3', audioBuffer, { contentType: 'audio/mpeg', cacheControl: '0', upsert: true });
  const { data: urlData } = supabase.storage.from('patient-audio').getPublicUrl('dictations/TSH692273/128.mp3');
  await supabase.from('dictated_notes').update({ ai_summary: newSummary, audio_url: urlData.publicUrl + '?v=' + Date.now() }).eq('id', 128);
  console.log('Done! Hard refresh browser.');
})();
