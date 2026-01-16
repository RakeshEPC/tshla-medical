const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM'
);

async function main() {
  console.log('\n📘 ELIZABETH ACCOUNT - LINKING EXPLANATION\n');
  console.log('='.repeat(80) + '\n');
  
  // Get Elizabeth's auth account
  const { data: authData } = await supabase.auth.admin.listUsers();
  const elizabethAuth = authData.users.find(u => u.email === 'elizabeth@tshla.ai');
  
  // Check medical_staff table
  const { data: staffData } = await supabase
    .from('medical_staff')
    .select('*')
    .eq('email', 'elizabeth@tshla.ai');
  
  console.log('CURRENT STATE:');
  console.log('─'.repeat(80));
  
  console.log('\n1️⃣  SUPABASE AUTH TABLE (auth.users)');
  if (elizabethAuth) {
    console.log('   ✅ Record EXISTS:');
    console.log('   {');
    console.log('     id: "' + elizabethAuth.id + '",');
    console.log('     email: "' + elizabethAuth.email + '",');
    console.log('     email_confirmed: ' + (elizabethAuth.email_confirmed_at ? 'true' : 'false') + ',');
    console.log('     created_at: "' + elizabethAuth.created_at + '",');
    console.log('     last_sign_in: "' + (elizabethAuth.last_sign_in_at || 'never') + '"');
    console.log('   }');
  }
  
  console.log('\n2️⃣  MEDICAL_STAFF TABLE (public.medical_staff)');
  if (staffData && staffData.length > 0) {
    console.log('   ✅ Record EXISTS');
    staffData.forEach(record => {
      console.log('   {');
      console.log('     id: "' + record.id + '",');
      console.log('     email: "' + record.email + '",');
      console.log('     auth_user_id: "' + (record.auth_user_id || 'NULL') + '",  ← LINK FIELD');
      console.log('     first_name: "' + (record.first_name || '') + '",');
      console.log('     last_name: "' + (record.last_name || '') + '",');
      console.log('     role: "' + (record.role || '') + '",');
      console.log('     is_active: ' + record.is_active);
      console.log('   }');
    });
  } else {
    console.log('   ❌ NO RECORD FOUND');
  }
  
  console.log('\n\n' + '='.repeat(80));
  console.log('WHAT NEEDS TO HAPPEN:');
  console.log('='.repeat(80) + '\n');
  
  if (elizabethAuth && (!staffData || staffData.length === 0)) {
    console.log('📝 ELIZABETH HAS AUTH BUT NO MEDICAL_STAFF RECORD\n');
    console.log('We need to CREATE a medical_staff record like this:\n');
    console.log('INSERT INTO medical_staff (');
    console.log('  id,');
    console.log('  email,');
    console.log('  auth_user_id,              ← This links to auth table');
    console.log('  first_name,');
    console.log('  last_name,');
    console.log('  role,');
    console.log('  is_active');
    console.log(') VALUES (');
    console.log('  uuid_generate_v4(),');
    console.log('  \'elizabeth@tshla.ai\',');
    console.log('  \'' + elizabethAuth.id + '\',  ← Auth ID');
    console.log('  \'Elizabeth\',');
    console.log('  \'Leal\',');
    console.log('  \'doctor\',                  ← or \'admin\', \'nurse\', etc.');
    console.log('  true');
    console.log(');\n');
    console.log('The auth_user_id field is the "link" - it tells the app:');
    console.log('"This medical_staff record belongs to auth user ' + elizabethAuth.id.substring(0, 20) + '..."\n');
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('HOW LOGIN WORKS AFTER LINKING:');
  console.log('='.repeat(80) + '\n');
  console.log('1. User enters: elizabeth@tshla.ai + password');
  console.log('2. Supabase checks auth.users table → ✅ Found, password correct');
  console.log('3. App gets auth user ID: ' + (elizabethAuth ? elizabethAuth.id : 'xxx'));
  console.log('4. App queries: SELECT * FROM medical_staff WHERE auth_user_id = \'' + (elizabethAuth ? elizabethAuth.id : 'xxx') + '\'');
  console.log('5. If found → ✅ Redirect to dashboard');
  console.log('   If NOT found → ❌ Kick user out (current situation)\n');
  
  console.log('\n');
}

main().catch(console.error);
