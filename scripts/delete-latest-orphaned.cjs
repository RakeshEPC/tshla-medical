const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM'
);

async function deleteOrphaned() {
  console.log('\nDeleting orphaned auth accounts created at 19:59-20:00...\n');
  
  const accounts = [
    { email: 'natalya@tshla.ai', id: '2b8ad42e-a937-4b55-8395-9d30fbee8e8c' },
    { email: 'jesie@tshla.ai', id: '01891971-1fca-4da4-a091-6319099a5fbb' }
  ];
  
  for (const account of accounts) {
    console.log('Deleting: ' + account.email);
    
    const { error } = await supabase.auth.admin.deleteUser(account.id);
    
    if (error) {
      console.error('  ❌ Error:', error.message);
    } else {
      console.log('  ✅ Deleted successfully');
    }
  }
  
  console.log('\n✅ Cleanup complete!');
  console.log('\nYou can now recreate the accounts via the admin panel.');
  console.log('The RLS policy is fixed, so they will be created properly this time.\n');
}

deleteOrphaned().catch(console.error);
