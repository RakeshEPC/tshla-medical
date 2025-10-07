const { createClient } = require('@supabase/supabase-js');
const https = require('https');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

(async () => {
  console.log('🔑 Logging in as admin...');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'admin@tshla.ai',
    password: 'TshlaAdmin2025!'
  });

  if (error) {
    console.error('❌ Login error:', error.message);
    process.exit(1);
  }

  const token = data.session.access_token;
  console.log('✅ Got token\n');

  console.log('🌐 Testing production API...');
  const url = 'https://tshla-pump-api-container.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/admin/pump-comparison-data';

  https.get(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }, (res) => {
    console.log('HTTP Status:', res.statusCode);

    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log('\nResponse (first 300 chars):');
      console.log(body.substring(0, 300));

      if (res.statusCode === 200) {
        const json = JSON.parse(body);
        console.log('\n✅ SUCCESS!');
        console.log(`   Dimensions count: ${json.count}`);
      } else {
        console.log('\n❌ FAILED');
      }
    });
  }).on('error', (err) => {
    console.error('❌ Request error:', err.message);
  });
})();
