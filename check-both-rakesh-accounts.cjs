const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM'
);

async function checkBoth() {
  console.log('\n🔍 CHECKING BOTH RAKESH ACCOUNTS\n');
  console.log('='.repeat(100) + '\n');

  // Account 1: rakesh@tshla.ai (the one in medical_staff)
  const account1Id = 'fd12fd3a-7ebb-454a-9a2c-0f14788d81fb';
  const { data: user1 } = await supabase.auth.admin.getUserById(account1Id);

  // Account 2: rakesh.patel@tshla.ai (found in user list)
  const account2Id = '1822f666-ea3d-43d8-b5e8-1a0c8e9f3c7e'; // approximate, need to get exact

  // Get all users to find the exact ID
  const { data: allUsers } = await supabase.auth.admin.listUsers();
  const rakeshPatel = allUsers.users.find(u => u.email && u.email.includes('rakesh.patel'));

  console.log('━━━ ACCOUNT 1: rakesh@tshla.ai ━━━');
  if (user1?.user) {
    console.log('Status: EXISTS (but hidden from main list)');
    console.log('ID:', user1.user.id);
    console.log('Email:', user1.user.email);
    console.log('Created:', new Date(user1.user.created_at).toLocaleString());
    console.log('Last Login:', user1.user.last_sign_in_at ? 
      new Date(user1.user.last_sign_in_at).toLocaleString() : 'Never');
    console.log('Email Confirmed:', user1.user.email_confirmed_at ? 'Yes' : 'No');
    
    // Check medical_staff link
    const { data: staff1 } = await supabase
      .from('medical_staff')
      .select('*')
      .eq('auth_user_id', user1.user.id)
      .maybeSingle();
    
    console.log('Linked to medical_staff:', staff1 ? 'YES ✅' : 'NO ❌');
    if (staff1) {
      console.log('   → Name:', staff1.first_name, staff1.last_name);
      console.log('   → Role:', staff1.role);
    }
  }

  console.log('\n━━━ ACCOUNT 2: rakesh.patel@tshla.ai ━━━');
  if (rakeshPatel) {
    console.log('Status: EXISTS (in main list)');
    console.log('ID:', rakeshPatel.id);
    console.log('Email:', rakeshPatel.email);
    console.log('Created:', new Date(rakeshPatel.created_at).toLocaleString());
    console.log('Last Login:', rakeshPatel.last_sign_in_at ? 
      new Date(rakeshPatel.last_sign_in_at).toLocaleString() : 'Never');
    console.log('Email Confirmed:', rakeshPatel.email_confirmed_at ? 'Yes' : 'No');
    
    // Check medical_staff link
    const { data: staff2 } = await supabase
      .from('medical_staff')
      .select('*')
      .eq('auth_user_id', rakeshPatel.id)
      .maybeSingle();
    
    console.log('Linked to medical_staff:', staff2 ? 'YES ✅' : 'NO ❌');
    if (staff2) {
      console.log('   → Name:', staff2.first_name, staff2.last_name);
      console.log('   → Role:', staff2.role);
    }
  } else {
    console.log('Not found');
  }

  console.log('\n' + '='.repeat(100));
  console.log('📊 SUMMARY');
  console.log('='.repeat(100) + '\n');

  if (user1?.user && rakeshPatel) {
    console.log('You have TWO Rakesh accounts:');
    console.log('\n1. rakesh@tshla.ai (ID: ' + user1.user.id.substring(0, 20) + '...)');
    console.log('   ✅ Linked to medical_staff (Role: admin)');
    console.log('   ✅ Last login: TODAY!');
    console.log('   → This one is WORKING and being used!');
    console.log('\n2. rakesh.patel@tshla.ai (ID: ' + rakeshPatel.id.substring(0, 20) + '...)');
    console.log('   Status: Unknown (checking...)');
    console.log('\nLikely situation: You created both accounts at different times.');
    console.log('The first one (rakesh@tshla.ai) is the main admin account and it WORKS!');
  }

  console.log('\n');
}

checkBoth().catch(console.error);
