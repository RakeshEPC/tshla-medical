require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAuthUsers() {
  try {
    console.log('\n🔍 Checking Supabase Auth users...\n');

    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    if (error) {
      console.error('❌ Error listing users:', error.message);
      return;
    }

    console.log(`Found ${users.length} user(s) in auth.users:\n`);

    users.forEach(user => {
      console.log(`User: ${user.email}`);
      console.log(`  ID: ${user.id}`);
      console.log(`  Created: ${user.created_at}`);
      console.log(`  Email confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}`);
      console.log('');
    });

    // Check for admin specifically
    const adminUser = users.find(u => u.email === 'admin@tshla.ai');
    if (!adminUser) {
      console.log('❌ admin@tshla.ai NOT found in auth.users - needs to be created!');
    } else {
      console.log('✅ admin@tshla.ai exists in auth.users');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkAuthUsers();
