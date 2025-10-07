require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function resetPassword() {
  try {
    console.log('\n🔐 Resetting admin password...\n');

    // Update the user's password using admin API
    const { data, error } = await supabase.auth.admin.updateUserById(
      '487489b9-f7bd-4e97-ad2d-c1b855445d6d',
      { password: 'TshlaAdmin2025!' }
    );

    if (error) {
      console.error('❌ Error resetting password:', error.message);
      return;
    }

    console.log('✅ Password reset successful!');
    console.log('   Email: admin@tshla.ai');
    console.log('   Password: TshlaAdmin2025!');
    console.log('\nYou can now login with these credentials.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

resetPassword();
