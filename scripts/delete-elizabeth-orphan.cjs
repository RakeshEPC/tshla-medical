const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM'
);

async function deleteOrphanedElizabeth() {
  console.log('\n🗑️  Deleting orphaned elizabeth@tshla.ai auth account...\n');

  const userId = '92731640-9fc4-4685-9cbe-e5dfee22b46d';

  // Delete the orphaned auth user
  const { error } = await supabase.auth.admin.deleteUser(userId);

  if (error) {
    console.error('❌ Error deleting auth user:', error.message);
    return;
  }

  console.log('✅ Successfully deleted orphaned auth account for elizabeth@tshla.ai');
  console.log(`   User ID: ${userId}`);
  console.log('\n💡 Now you can recreate the account using the admin panel.');
  console.log('   The new account will have both auth and medical_staff records.\n');
}

deleteOrphanedElizabeth().catch(console.error);
