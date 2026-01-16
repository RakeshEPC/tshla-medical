const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM'
);

async function main() {
  const emails = ['elizabeth@tshla.ai', 'shannon@tshla.ai', 'rakesh@tshla.ai'];
  
  const { data: authUsers } = await supabase.auth.admin.listUsers();
  const { data: allStaff } = await supabase.from('medical_staff').select('*').in('email', emails);
  
  console.log('='.repeat(80));
  console.log('ELIZABETH, SHANNON, RAKESH - COMPLETE ACCOUNT ANALYSIS');
  console.log('='.repeat(80));
  
  for (const email of emails) {
    const authUser = authUsers.users.find(u => u.email === email);
    const staffRecords = allStaff ? allStaff.filter(s => s.email === email) : [];
    
    console.log('');
    console.log(email.toUpperCase());
    console.log('-'.repeat(80));
    
    if (authUser) {
      console.log('AUTH: YES - ID:', authUser.id.substring(0, 20) + '...');
      console.log('      Created:', new Date(authUser.created_at).toLocaleDateString());
      console.log('      Last login:', authUser.last_sign_in_at ? new Date(authUser.last_sign_in_at).toLocaleDateString() : 'Never');
    } else {
      console.log('AUTH: NO');
    }
    
    if (staffRecords.length > 0) {
      console.log('STAFF: YES');
      staffRecords.forEach(s => {
        console.log('       Name:', s.first_name, s.last_name);
        console.log('       Role:', s.role);
        console.log('       Active:', s.is_active ? 'Yes' : 'No');
        console.log('       Linked to auth:', s.auth_user_id ? 'Yes' : 'No');
      });
    } else {
      console.log('STAFF: NO');
    }
    
    const hasAuth = !!authUser;
    const hasStaff = staffRecords.length > 0;
    const linked = authUser && staffRecords.find(s => s.auth_user_id === authUser.id);
    
    console.log('');
    if (linked) {
      console.log('STATUS: CAN LOGIN');
    } else if (hasAuth && !hasStaff) {
      console.log('STATUS: GETS KICKED OUT (auth exists, staff missing)');
    } else if (!hasAuth && hasStaff) {
      console.log('STATUS: CANNOT LOGIN (staff exists, auth missing)');
    } else {
      console.log('STATUS: NO ACCOUNT');
    }
  }
  
  console.log('');
  console.log('='.repeat(80));
}

main();
