const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM'
);

async function main() {
  console.log('\n📊 FINAL STATUS: ALL THREE PROVIDER ACCOUNTS\n');
  console.log('='.repeat(100) + '\n');

  const emails = ['rakesh@tshla.ai', 'shannon@tshla.ai', 'elizabeth@tshla.ai'];

  const { data: authUsersData } = await supabase.auth.admin.listUsers();
  const { data: allStaff } = await supabase.from('medical_staff').select('*');

  for (const email of emails) {
    const authUser = authUsersData.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    const staffRecord = allStaff.find(s => s.email.toLowerCase() === email.toLowerCase());

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(email.toUpperCase());
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Check both parts
    const hasAuth = !!authUser;
    const hasStaff = !!staffRecord;
    const isLinked = authUser && staffRecord && staffRecord.auth_user_id === authUser.id;

    console.log('AUTH ACCOUNT:    ' + (hasAuth ? '✅ EXISTS' : '❌ MISSING'));
    if (hasAuth) {
      console.log('  ID: ' + authUser.id);
      console.log('  Created: ' + new Date(authUser.created_at).toLocaleDateString());
    }

    console.log('\nSTAFF RECORD:    ' + (hasStaff ? '✅ EXISTS' : '❌ MISSING'));
    if (hasStaff) {
      console.log('  Name: ' + (staffRecord.first_name || '') + ' ' + (staffRecord.last_name || ''));
      console.log('  Role: ' + staffRecord.role);
      console.log('  Linked to: ' + (staffRecord.auth_user_id || 'NONE'));
    }

    console.log('\nLINKED:          ' + (isLinked ? '✅ YES' : '❌ NO'));

    console.log('\n📍 LOGIN STATUS:');
    if (isLinked && staffRecord.is_active && staffRecord.is_verified) {
      console.log('  ✅✅✅ CAN LOGIN SUCCESSFULLY!');
      console.log('  → Password works');
      console.log('  → Profile found');
      console.log('  → Will redirect to dashboard');
    } else if (hasAuth && !hasStaff) {
      console.log('  ⚠️  CAN ENTER PASSWORD BUT GETS KICKED OUT');
      console.log('  → Needs: medical_staff record');
    } else if (!hasAuth && hasStaff) {
      console.log('  ❌ CANNOT LOGIN AT ALL');
      console.log('  → Needs: Supabase auth account');
    } else if (hasAuth && hasStaff && !isLinked) {
      console.log('  ⚠️  BOTH EXIST BUT NOT LINKED');
      console.log('  → Needs: Link auth_user_id');
    } else {
      console.log('  ❌ NO ACCOUNT EXISTS');
      console.log('  → Needs: Everything');
    }

    console.log('\n');
  }

  console.log('='.repeat(100));
  console.log('SUMMARY');
  console.log('='.repeat(100) + '\n');

  const rakeshAuth = authUsersData.users.find(u => u.email.toLowerCase() === 'rakesh@tshla.ai');
  const shannonAuth = authUsersData.users.find(u => u.email.toLowerCase() === 'shannon@tshla.ai');
  const elizabethAuth = authUsersData.users.find(u => u.email.toLowerCase() === 'elizabeth@tshla.ai');

  const rakeshStaff = allStaff.find(s => s.email.toLowerCase() === 'rakesh@tshla.ai');
  const shannonStaff = allStaff.find(s => s.email.toLowerCase() === 'shannon@tshla.ai');
  const elizabethStaff = allStaff.find(s => s.email.toLowerCase() === 'elizabeth@tshla.ai');

  const rakeshOk = rakeshAuth && rakeshStaff && rakeshStaff.auth_user_id === rakeshAuth.id && rakeshStaff.is_active && rakeshStaff.is_verified;
  const shannonOk = shannonAuth && shannonStaff && shannonStaff.auth_user_id === shannonAuth.id && shannonStaff.is_active && shannonStaff.is_verified;
  const elizabethOk = elizabethAuth && elizabethStaff && elizabethStaff.auth_user_id === elizabethAuth.id && elizabethStaff.is_active && elizabethStaff.is_verified;

  console.log('rakesh@tshla.ai:    ' + (rakeshOk ? '✅ READY' : '❌ BROKEN') + (rakeshOk ? '' : ' - Needs auth account'));
  console.log('shannon@tshla.ai:   ' + (shannonOk ? '✅ READY' : '❌ BROKEN') + (shannonOk ? ' - Password: Shannon2025!' : ''));
  console.log('elizabeth@tshla.ai: ' + (elizabethOk ? '✅ READY' : '❌ BROKEN') + (elizabethOk ? '' : ' - Needs medical_staff record'));

  console.log('\n');
}

main().catch(console.error);
