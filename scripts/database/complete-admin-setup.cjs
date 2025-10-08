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
  console.log('🔧 Completing admin setup for patelcyfair@yahoo.com\n');

  const authUserId = '44358086-2a2f-4254-a143-6243826d8978';
  const email = 'patelcyfair@yahoo.com';

  try {
    // Create with all required fields
    const data = {
      email: email,
      username: 'patelcyfair',
      first_name: 'Rakesh',
      last_name: 'Patel',
      role: 'admin',
      auth_user_id: authUserId,
      is_active: true,
      is_admin: true
    };

    console.log('Creating medical_staff record...');

    const result = await makeRequest('POST', '/rest/v1/medical_staff', data);

    console.log('\n🎉 SUCCESS!');
    console.log('\n✅ Admin account is now ready!');
    console.log('\nLogin at: https://www.tshla.ai/login');
    console.log('Email: patelcyfair@yahoo.com');
    console.log('Password: (the one you created)');
    console.log('\nLeave verification code blank when logging in.\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
