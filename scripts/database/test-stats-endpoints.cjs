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

  const endpoints = [
    '/api/admin/pumpdrive-stats',
    '/api/admin/pumpdrive-users'
  ];

  for (const endpoint of endpoints) {
    console.log(`\n🌐 Testing: ${endpoint}`);
    const url = `https://tshla-pump-api-container.redpebble-e4551b7a.eastus.azurecontainerapps.io${endpoint}`;

    await new Promise((resolve) => {
      https.get(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, (res) => {
        console.log('   HTTP Status:', res.statusCode);

        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            const json = JSON.parse(body);
            console.log('   ✅ SUCCESS!');
            if (json.stats) console.log('   Stats:', JSON.stringify(json.stats));
            if (json.users) console.log('   Users count:', json.users.length);
          } else {
            console.log('   ❌ FAILED');
            console.log('   Response:', body.substring(0, 200));
          }
          resolve();
        });
      }).on('error', (err) => {
        console.error('   ❌ Request error:', err.message);
        resolve();
      });
    });
  }
})();
