const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM'
);

async function verifyAccounts() {
  console.log('\nVerifying staff accounts...\n');
  
  // Get emails from command line args or use defaults
  const emails = process.argv.slice(2);
  
  if (emails.length === 0) {
    console.log('Usage: node verify-staff-accounts.cjs email1@tshla.ai email2@tshla.ai ...');
    console.log('\nOr verify all unverified accounts:');
    console.log('node verify-staff-accounts.cjs --all');
    return;
  }
  
  let accountsToVerify = [];
  
  if (emails[0] === '--all') {
    // Get all unverified accounts
    const { data } = await supabase
      .from('medical_staff')
      .select('id, email, first_name, last_name, is_verified')
      .eq('is_verified', false);
    
    if (data && data.length > 0) {
      accountsToVerify = data;
      console.log(`Found ${data.length} unverified accounts:\n`);
      data.forEach(s => console.log('  - ' + s.email + ' (' + s.first_name + ' ' + s.last_name + ')'));
      console.log('');
    } else {
      console.log('No unverified accounts found.');
      return;
    }
  } else {
    // Get specific accounts by email
    for (const email of emails) {
      const { data } = await supabase
        .from('medical_staff')
        .select('id, email, first_name, last_name, is_verified')
        .eq('email', email)
        .single();
      
      if (data) {
        accountsToVerify.push(data);
      } else {
        console.log('⚠️  Account not found: ' + email);
      }
    }
  }
  
  if (accountsToVerify.length === 0) {
    console.log('No accounts to verify.');
    return;
  }
  
  // Verify the accounts
  console.log('Verifying accounts...\n');
  
  for (const account of accountsToVerify) {
    const { error } = await supabase
      .from('medical_staff')
      .update({ is_verified: true })
      .eq('id', account.id);
    
    if (error) {
      console.log('❌ Failed to verify ' + account.email + ': ' + error.message);
    } else {
      console.log('✅ Verified: ' + account.email + ' (' + account.first_name + ' ' + account.last_name + ')');
    }
  }
  
  console.log('\n✅ Verification complete! These accounts can now login.\n');
}

verifyAccounts().catch(console.error);
