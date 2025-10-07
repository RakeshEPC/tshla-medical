#!/usr/bin/env node

/**
 * Create Admin User in Supabase
 * This script creates an admin user in Supabase Auth and links it to medical_staff table
 */

const https = require('https');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Supabase configuration
const SUPABASE_URL = 'https://minvvjdflezibmgkplqb.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM';

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SUPABASE_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
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

async function createAuthUser(email, password) {
  console.log('\n📝 Creating user in Supabase Auth...');

  try {
    const result = await makeRequest('POST', '/auth/v1/admin/users', {
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: 'admin'
      }
    });

    console.log('✅ Auth user created successfully!');
    console.log(`   User ID: ${result.id}`);
    return result.id;
  } catch (error) {
    throw new Error(`Failed to create auth user: ${error.message}`);
  }
}

async function createMedicalStaffRecord(authUserId, email, firstName, lastName) {
  console.log('\n📝 Creating medical_staff record...');

  try {
    const result = await makeRequest('POST', '/rest/v1/medical_staff', {
      email,
      username: email.split('@')[0],
      first_name: firstName,
      last_name: lastName,
      role: 'admin',
      auth_user_id: authUserId,
      is_active: true,
      is_verified: true,
      created_by: 'system'
    });

    console.log('✅ Medical staff record created successfully!');
    return result;
  } catch (error) {
    throw new Error(`Failed to create medical_staff record: ${error.message}`);
  }
}

async function main() {
  console.log('🏥 TSHLA Medical - Create Admin User\n');
  console.log('This will create an admin user in Supabase Auth');
  console.log('and link it to the medical_staff table.\n');

  try {
    // Get user input
    const email = await question('Email address: ');
    const password = await question('Password (min 8 characters): ');
    const firstName = await question('First name: ');
    const lastName = await question('Last name: ');

    console.log('\n📋 Summary:');
    console.log(`   Email: ${email}`);
    console.log(`   Name: ${firstName} ${lastName}`);
    console.log(`   Role: Admin`);

    const confirm = await question('\nProceed? (yes/no): ');

    if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
      console.log('❌ Cancelled');
      rl.close();
      return;
    }

    // Step 1: Create user in Supabase Auth
    const authUserId = await createAuthUser(email, password);

    // Step 2: Create medical_staff record
    await createMedicalStaffRecord(authUserId, email, firstName, lastName);

    console.log('\n🎉 SUCCESS!');
    console.log('\nYour admin account has been created:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   User ID: ${authUserId}`);
    console.log('\n⚠️  IMPORTANT: Save these credentials securely!');
    console.log('\n✅ You can now login at: http://localhost:5173');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
