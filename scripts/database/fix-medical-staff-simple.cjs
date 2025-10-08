#!/usr/bin/env node

const https = require('https');

const SUPABASE_URL = 'https://minvvjdflezibmgkplqb.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM';

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SUPABASE_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=representation'
      }
    };

    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        console.log('Response status:', res.statusCode);
        console.log('Response body:', body);
        try {
          if (body) {
            const json = JSON.parse(body);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(json);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(json)}`));
            }
          } else {
            resolve({});
          }
        } catch (e) {
          reject(new Error(`Parse error: ${body}`));
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function main() {
  console.log('🔧 Creating medical_staff record for patelcyfair@yahoo.com\n');

  const authUserId = '44358086-2a2f-4254-a143-6243826d8978';
  const email = 'patelcyfair@yahoo.com';

  try {
    // Try with minimal fields first
    const data = {
      email: email,
      first_name: 'Rakesh',
      last_name: 'Patel',
      role: 'admin',
      auth_user_id: authUserId,
      is_active: true
    };

    console.log('Sending data:', JSON.stringify(data, null, 2));

    const result = await makeRequest('POST', '/rest/v1/medical_staff', data);

    console.log('\n✅ SUCCESS!');
    console.log('Medical staff record created:', result);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
