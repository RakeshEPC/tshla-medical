require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function verifyAdmin() {
  try {
    console.log('\n🔍 Checking admin user in Supabase...\n');

    // Check medical_staff table
    const { data: staffData, error: staffError } = await supabase
      .from('medical_staff')
      .select('*')
      .eq('email', 'admin@tshla.ai')
      .single();

    if (staffError) {
      console.error('❌ Error fetching medical_staff:', staffError.message);
      return;
    }

    console.log('✅ Medical staff record found:');
    console.log('   ID:', staffData.id);
    console.log('   Email:', staffData.email);
    console.log('   Username:', staffData.username);
    console.log('   Auth User ID:', staffData.auth_user_id);
    console.log('   Is Admin:', staffData.is_admin);

    // Try to authenticate
    console.log('\n🔐 Testing authentication with password: TshlaAdmin2025!\n');

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'admin@tshla.ai',
      password: 'TshlaAdmin2025!'
    });

    if (authError) {
      console.error('❌ Authentication failed:', authError.message);
      console.error('   Error code:', authError.code);
      console.error('   Status:', authError.status);

      // Check if user exists in auth.users
      console.log('\n🔍 Checking auth.users table...');
      const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

      if (listError) {
        console.error('❌ Error listing users:', listError.message);
      } else {
        const adminUser = users.find(u => u.email === 'admin@tshla.ai');
        if (adminUser) {
          console.log('✅ User exists in auth.users:');
          console.log('   ID:', adminUser.id);
          console.log('   Email:', adminUser.email);
          console.log('   Email confirmed:', adminUser.email_confirmed_at ? 'Yes' : 'No');
        } else {
          console.log('❌ User NOT found in auth.users table');
        }
      }
    } else {
      console.log('✅ Authentication successful!');
      console.log('   User ID:', authData.user.id);
      console.log('   Email:', authData.user.email);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

verifyAdmin();
