#!/usr/bin/env node

/**
 * Create Admin User in Supabase (Non-interactive)
 */

const https = require('https');

// Configuration
const SUPABASE_URL = 'https://minvvjdflezibmgkplqb.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM';

// Admin user details (change these!)
const ADMIN_EMAIL = process.argv[2] || 'admin@tshla.ai';
const ADMIN_PASSWORD = process.argv[3] || 'TshlaAdmin2025!';
const FIRST_NAME = process.argv[4] || 'Admin';
const LAST_NAME = process.argv[5] || 'User';

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SUPABASE_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`
      }
    };

    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(json);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(json)}`));
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
  console.log('🏥 Creating Admin User in Supabase...\n');

  try {
    // Step 1: Create user in Supabase Auth
    console.log('📝 Step 1: Creating user in Supabase Auth...');
    const authUser = await makeRequest('POST', '/auth/v1/admin/users', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { role: 'admin' }
    });

    console.log(`✅ Auth user created! User ID: ${authUser.id}\n`);

    // Step 2: Create medical_staff record
    console.log('📝 Step 2: Creating medical_staff record...');
    const staffRecord = await makeRequest('POST', '/rest/v1/medical_staff?select=*', {
      email: ADMIN_EMAIL,
      username: ADMIN_EMAIL.split('@')[0],
      first_name: FIRST_NAME,
      last_name: LAST_NAME,
      role: 'admin',
      auth_user_id: authUser.id,
      is_active: true,
      is_verified: true,
      created_by: 'system'
    });

    console.log('✅ Medical staff record created!\n');

    console.log('🎉 SUCCESS! Admin user created:\n');
    console.log('   Email:', ADMIN_EMAIL);
    console.log('   Password:', ADMIN_PASSWORD);
    console.log('   User ID:', authUser.id);
    console.log('   Name:', `${FIRST_NAME} ${LAST_NAME}`);
    console.log('\n✅ You can now login to the app!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
