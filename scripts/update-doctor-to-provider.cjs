const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM'
);

async function updateRoles() {
  console.log('\n🔄 Updating all "doctor" roles to "provider"...\n');

  // First, get all accounts with role='doctor'
  const { data: doctorAccounts, error: fetchError } = await supabase
    .from('medical_staff')
    .select('id, email, first_name, last_name, role')
    .eq('role', 'doctor');

  if (fetchError) {
    console.error('❌ Error fetching doctor accounts:', fetchError.message);
    return;
  }

  if (!doctorAccounts || doctorAccounts.length === 0) {
    console.log('✅ No accounts with role="doctor" found. All done!');
    return;
  }

  console.log(`Found ${doctorAccounts.length} accounts with role="doctor":\n`);
  doctorAccounts.forEach((account, index) => {
    console.log(`${index + 1}. ${account.first_name} ${account.last_name} (${account.email})`);
  });

  console.log('\n📝 Updating all to role="provider"...\n');

  // Update all doctor roles to provider
  const { error: updateError } = await supabase
    .from('medical_staff')
    .update({ role: 'provider' })
    .eq('role', 'doctor');

  if (updateError) {
    console.error('❌ Error updating roles:', updateError.message);
    return;
  }

  console.log('✅ Successfully updated all "doctor" roles to "provider"!');
  console.log(`\n📊 Total accounts updated: ${doctorAccounts.length}\n`);
  console.log('ℹ️  Users need to log out and log back in for the change to take effect.\n');
}

updateRoles().catch(console.error);
