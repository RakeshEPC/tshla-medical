const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM'
);

async function deleteOrphanedAccounts() {
  console.log('\nDeleting orphaned auth accounts...\n');
  
  const accounts = [
    { email: 'natalya@tshla.ai', id: '62d9db3c-0004-4cb8-8332-ac99a8678441' },
    { email: 'jesie@tshla.ai', id: '42127100-4bd2-4cfe-8b79-00aeda1c782f' }
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
  
  console.log('\n✅ Orphaned account cleanup complete!\n');
}

deleteOrphanedAccounts().catch(console.error);
