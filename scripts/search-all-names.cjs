const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM'
);

async function searchAll() {
  console.log('\nSearching for Natalya, John, and Jesie in medical_staff...\n');
  
  const names = ['natalya', 'john', 'jesie', 'jessie'];
  
  for (const name of names) {
    const { data } = await supabase
      .from('medical_staff')
      .select('*')
      .or('first_name.ilike.%' + name + '%,last_name.ilike.%' + name + '%,email.ilike.%' + name + '%')
      .order('created_at', { ascending: false });
    
    if (data && data.length > 0) {
      console.log('Found matches for "' + name + '":');
      data.forEach(s => {
        console.log('  ' + s.first_name + ' ' + s.last_name + ' (' + s.email + ') - verified: ' + s.is_verified);
      });
      console.log('');
    }
  }
  
  console.log('\nSearching in auth.users table...\n');
  
  const { data: authUsers, error } = await supabase.auth.admin.listUsers();
  
  if (authUsers && authUsers.users) {
    const matches = authUsers.users.filter(u => {
      const email = u.email || '';
      const metadata = JSON.stringify(u.user_metadata || {}).toLowerCase();
      return metadata.includes('natalya') || metadata.includes('john') || metadata.includes('jesie') || 
             email.includes('natalya') || email.includes('john') || email.includes('jesie');
    });
    
    if (matches.length > 0) {
      console.log('Found ' + matches.length + ' matching auth users:');
      matches.forEach(u => {
        const name = (u.user_metadata?.first_name || '') + ' ' + (u.user_metadata?.last_name || '');
        console.log('  ' + u.email + ' - ' + name + ' (created: ' + u.created_at + ')');
      });
    } else {
      console.log('No matches in auth.users');
    }
  }
}

searchAll().catch(console.error);
