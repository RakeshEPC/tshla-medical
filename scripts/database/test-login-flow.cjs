const { createClient } = require('@supabase/supabase-js');
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
  console.log('✅ Got token');
  console.log('Token (first 50 chars):', token.substring(0, 50));
  
  // Test the pump-comparison-data endpoint
  console.log('\n🌐 Testing /api/admin/pump-comparison-data...');
  const response = await fetch('https://tshla-pump-api-container.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/admin/pump-comparison-data', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  console.log('Status:', response.status);
  const text = await response.text();
  console.log('Response:', text.substring(0, 500));
  
  if (response.status === 200) {
    console.log('\n✅ SUCCESS!');
  } else {
    console.log('\n❌ FAILED');
  }
})();
