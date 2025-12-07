/**
 * Reset Admin Password Script
 * Resets or creates admin@tshla.ai user with a new password
 */

const https = require('https');

const SUPABASE_URL = 'minvvjdflezibmgkplqb.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM';
const NEW_PASSWORD = 'TshlaAdmin2025!';

function makeRequest(path, method, data) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: SUPABASE_URL,
      path: path,
      method: method,
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function resetAdminPassword() {
  try {
    console.log('🔍 Looking for rakesh@tshla.ai user...\n');

    // List all users
    const users = await makeRequest('/auth/v1/admin/users', 'GET');

    const adminUser = users.users?.find(u => u.email === 'rakesh@tshla.ai');

    if (adminUser) {
      console.log(`✅ Found admin user: ${adminUser.id}\n`);
      console.log('🔄 Resetting password...\n');

      // Update password
      const result = await makeRequest(
        `/auth/v1/admin/users/${adminUser.id}`,
        'PUT',
        { password: NEW_PASSWORD }
      );

      if (result.id) {
        console.log('✅ Password reset successfully!\n');
        console.log('=================================');
        console.log('Email: rakesh@tshla.ai');
        console.log(`Password: ${NEW_PASSWORD}`);
        console.log('=================================\n');
        console.log('You can now log in at: https://www.tshla.ai/login');
      } else {
        console.error('❌ Error resetting password:', result);
      }
    } else {
      console.log('❌ User not found. Creating new user...\n');

      // Create new admin user
      const result = await makeRequest(
        '/auth/v1/admin/users',
        'POST',
        {
          email: 'rakesh@tshla.ai',
          password: NEW_PASSWORD,
          email_confirm: true,
          user_metadata: {
            role: 'admin',
            name: 'Rakesh Patel'
          }
        }
      );

      if (result.id) {
        console.log('✅ User created successfully!\n');
        console.log('=================================');
        console.log('Email: rakesh@tshla.ai');
        console.log(`Password: ${NEW_PASSWORD}`);
        console.log('=================================\n');
        console.log('You can now log in at: https://www.tshla.ai/login');
      } else {
        console.error('❌ Error creating user:', result);
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

resetAdminPassword();
