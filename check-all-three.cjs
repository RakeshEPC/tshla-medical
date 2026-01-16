const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM'
);

async function main() {
  const emails = ['elizabeth@tshla.ai', 'shannon@tshla.ai', 'rakesh@tshla.ai'];
  
  console.log('\n📋 PROVIDER LOGIN STATUS FOR:');
  console.log('   • rakesh@tshla.ai');
  console.log('   • shannon@tshla.ai');
  console.log('   • elizabeth@tshla.ai');
  console.log('\n' + '='.repeat(100));
  
  const { data: authUsersData } = await supabase.auth.admin.listUsers();
  const { data: staffData } = await supabase.from('medical_staff').select('*').in('email', emails);
  
  for (const email of emails) {
    const authUser = authUsersData.users.find(u => u.email === email);
    const staffRecord = staffData ? staffData.find(s => s.email === email) : null;
    
    console.log(`\n\n${email.toUpperCase()}`);
    console.log('─'.repeat(100));
    
    console.log('\n1️⃣  AUTHENTICATION ACCOUNT (Supabase Auth):');
    if (authUser) {
      console.log(`   ✅ EXISTS`);
      console.log(`   📧 Email: ${authUser.email}`);
      console.log(`   🆔 ID: ${authUser.id}`);
      console.log(`   📅 Created: ${new Date(authUser.created_at).toLocaleString()}`);
      console.log(`   🔐 Email Confirmed: ${authUser.email_confirmed_at ? 'Yes' : 'No'}`);
      console.log(`   🕐 Last Sign In: ${authUser.last_sign_in_at ? new Date(authUser.last_sign_in_at).toLocaleString() : 'Never'}`);
    } else {
      console.log(`   ❌ DOES NOT EXIST`);
    }
    
    console.log('\n2️⃣  MEDICAL STAFF RECORD (medical_staff table):');
    if (staffRecord) {
      console.log(`   ✅ EXISTS`);
      console.log(`   👤 Name: ${staffRecord.first_name || 'N/A'} ${staffRecord.last_name || 'N/A'}`);
      console.log(`   💼 Role: ${staffRecord.role || 'N/A'}`);
      console.log(`   ✓ Active: ${staffRecord.is_active ? 'Yes' : 'No'}`);
      console.log(`   🔗 Linked Auth ID: ${staffRecord.auth_user_id || 'NOT LINKED'}`);
    } else {
      console.log(`   ❌ DOES NOT EXIST`);
    }
    
    console.log('\n3️⃣  LOGIN STATUS:');
    const hasAuth = !!authUser;
    const hasStaff = !!staffRecord;
    const isLinked = authUser && staffRecord && staffRecord.auth_user_id === authUser.id;
    
    if (isLinked && staffRecord.is_active) {
      console.log(`   ✅ CAN LOGIN SUCCESSFULLY`);
      console.log(`   → Role: ${staffRecord.role}`);
    } else if (hasAuth && !hasStaff) {
      console.log(`   ⚠️  CAN AUTHENTICATE BUT GETS KICKED OUT`);
      console.log(`   → Reason: Auth exists but no medical_staff record`);
    } else if (!hasAuth && hasStaff) {
      console.log(`   ❌ CANNOT LOGIN`);
      console.log(`   → Reason: No authentication account exists`);
    } else if (hasAuth && hasStaff && !isLinked) {
      console.log(`   ⚠️  BOTH EXIST BUT NOT LINKED`);
      console.log(`   → Reason: auth_user_id mismatch`);
    } else {
      console.log(`   ❌ NO ACCOUNT`);
    }
    
    console.log('\n4️⃣  FIXES NEEDED:');
    if (isLinked && staffRecord.is_active) {
      console.log(`   ✅ None - Account properly configured`);
    } else {
      if (!hasAuth) console.log(`   • Create Supabase auth account`);
      if (!hasStaff) console.log(`   • Create medical_staff record`);
      if (hasAuth && hasStaff && !isLinked) console.log(`   • Link accounts (auth_user_id = ${authUser.id})`);
      if (staffRecord && !staffRecord.is_active) console.log(`   • Activate (is_active = true)`);
    }
  }
  
  console.log('\n\n' + '='.repeat(100));
  console.log('📊 SUMMARY');
  console.log('='.repeat(100) + '\n');
}

main().catch(console.error);
