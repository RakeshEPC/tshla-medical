#!/usr/bin/env node

/**
 * Link Existing Supabase Auth User to medical_staff table
 * Use this when auth user exists but medical_staff record is missing
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

async function findAuthUser(email) {
  console.log('\n🔍 Looking for auth user...');

  try {
    // List all users and find by email
    const users = await makeRequest('GET', '/auth/v1/admin/users');
    const user = users.users.find(u => u.email === email);

    if (!user) {
      throw new Error(`No auth user found with email: ${email}`);
    }

    console.log('✅ Found auth user!');
    console.log(`   User ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    return user;
  } catch (error) {
    throw new Error(`Failed to find auth user: ${error.message}`);
  }
}

async function checkMedicalStaffExists(authUserId) {
  console.log('\n🔍 Checking if medical_staff record exists...');

  try {
    const result = await makeRequest('GET', `/rest/v1/medical_staff?auth_user_id=eq.${authUserId}&select=*`);

    if (result && result.length > 0) {
      console.log('⚠️  Medical staff record already exists!');
      console.log(`   ID: ${result[0].id}`);
      console.log(`   Email: ${result[0].email}`);
      console.log(`   Role: ${result[0].role}`);
      return result[0];
    }

    console.log('✅ No medical_staff record found (will create)');
    return null;
  } catch (error) {
    console.log('✅ No medical_staff record found (will create)');
    return null;
  }
}

async function createMedicalStaffRecord(authUserId, email, firstName, lastName, isAdmin) {
  console.log('\n📝 Creating medical_staff record...');

  try {
    const data = {
      email,
      username: email.split('@')[0],
      first_name: firstName,
      last_name: lastName,
      role: isAdmin ? 'admin' : 'doctor',
      auth_user_id: authUserId,
      is_active: true,
      is_verified: true,
      is_admin: isAdmin,
      created_by: 'system'
    };

    const result = await makeRequest('POST', '/rest/v1/medical_staff?select=*', data);

    console.log('✅ Medical staff record created successfully!');
    console.log(`   Role: ${data.role}`);
    console.log(`   Admin: ${data.is_admin}`);
    return result;
  } catch (error) {
    throw new Error(`Failed to create medical_staff record: ${error.message}`);
  }
}

async function main() {
  console.log('🏥 TSHLA Medical - Link Existing Auth User\n');
  console.log('This will link an existing Supabase Auth user');
  console.log('to the medical_staff table.\n');

  try {
    // Get user input
    const email = await question('Email address: ');
    const firstName = await question('First name: ');
    const lastName = await question('Last name: ');
    const adminResponse = await question('Make admin? (yes/no) [yes]: ');
    const isAdmin = !adminResponse || adminResponse.toLowerCase() === 'yes' || adminResponse.toLowerCase() === 'y';

    console.log('\n📋 Summary:');
    console.log(`   Email: ${email}`);
    console.log(`   Name: ${firstName} ${lastName}`);
    console.log(`   Role: ${isAdmin ? 'Admin' : 'Doctor'}`);

    const confirm = await question('\nProceed? (yes/no): ');

    if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
      console.log('❌ Cancelled');
      rl.close();
      return;
    }

    // Step 1: Find existing auth user
    const authUser = await findAuthUser(email);

    // Step 2: Check if medical_staff record exists
    const existingStaff = await checkMedicalStaffExists(authUser.id);

    if (existingStaff) {
      console.log('\n⚠️  This user is already linked to medical_staff!');
      console.log('\n✅ You can now login with this account.');
      rl.close();
      return;
    }

    // Step 3: Create medical_staff record
    await createMedicalStaffRecord(authUser.id, email, firstName, lastName, isAdmin);

    console.log('\n🎉 SUCCESS!');
    console.log('\nYour account has been linked:');
    console.log(`   Email: ${email}`);
    console.log(`   User ID: ${authUser.id}`);
    console.log(`   Role: ${isAdmin ? 'Admin' : 'Doctor'}`);
    console.log('\n✅ You can now login at: https://www.tshla.ai/login');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
