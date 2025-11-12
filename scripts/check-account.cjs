const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM'
);

async function checkAccount(email) {
  try {
    console.log(`\n🔍 Checking account: ${email}\n`);

    // Check patient record
    const { data: patientData, error: patientError } = await supabase
      .from('patients')
      .select('*')
      .ilike('email', email)
      .single();

    console.log('=== PATIENT RECORD ===');
    if (patientError) {
      if (patientError.code === 'PGRST116') {
        console.log('❌ No patient record found');
      } else {
        console.log('❌ Error:', patientError.message);
        console.log('   Code:', patientError.code);
      }
    } else if (patientData) {
      console.log('✅ Patient record EXISTS');
      console.log('   ID:', patientData.id);
      console.log('   Name:', patientData.first_name, patientData.last_name);
      console.log('   Email:', patientData.email);
      console.log('   AVA ID:', patientData.ava_id);
      console.log('   MRN:', patientData.mrn);
      console.log('   Active:', patientData.is_active ? '✅ YES' : '❌ NO');
      console.log('   PumpDrive:', patientData.pumpdrive_enabled ? '✅ YES' : '❌ NO');
      console.log('   Auth User ID:', patientData.auth_user_id);
      console.log('   Created:', new Date(patientData.created_at).toLocaleString());
    }

    // Check auth users
    console.log('\n=== AUTH USER (SUPABASE) ===');
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
      console.log('❌ Error listing users:', usersError.message);
    } else {
      const user = users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
      if (user) {
        console.log('✅ Auth user EXISTS');
        console.log('   ID:', user.id);
        console.log('   Email:', user.email);
        console.log('   Email Confirmed:', user.email_confirmed_at ? `✅ YES (${new Date(user.email_confirmed_at).toLocaleString()})` : '❌ NO - NEEDS CONFIRMATION');
        console.log('   Created:', new Date(user.created_at).toLocaleString());
        console.log('   Last Sign In:', user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Never');

        if (!user.email_confirmed_at) {
          console.log('\n⚠️  EMAIL NOT CONFIRMED - This is likely why login fails!');
        }
      } else {
        console.log('❌ No auth user found');
      }
    }

    // Summary
    console.log('\n=== DIAGNOSIS ===');
    const hasAuthUser = users?.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
    const hasPatient = !patientError && patientData;

    if (!hasAuthUser && !hasPatient) {
      console.log('❌ Account does NOT exist');
      console.log('   → Try creating account again');
    } else if (hasAuthUser && !hasPatient) {
      console.log('⚠️  Auth user exists but NO patient record');
      console.log('   → Registration failed partway through');
      console.log('   → Need to create patient record manually');
    } else if (!hasAuthUser && hasPatient) {
      console.log('⚠️  Patient record exists but NO auth user');
      console.log('   → This is unusual, may need to recreate auth user');
    } else {
      const emailConfirmed = hasAuthUser.email_confirmed_at;
      const isActive = patientData.is_active;

      if (!emailConfirmed && isActive) {
        console.log('⚠️  Email NOT confirmed (but account is active)');
        console.log('   → LOGIN WILL FAIL until email is confirmed');
        console.log('   → Check email for confirmation link');
        console.log('   → OR manually confirm in Supabase Dashboard');
      } else if (emailConfirmed && !isActive) {
        console.log('⚠️  Email confirmed but account INACTIVE');
        console.log('   → Need to activate account');
      } else if (!emailConfirmed && !isActive) {
        console.log('❌ Email NOT confirmed AND account inactive');
        console.log('   → Need to confirm email AND activate account');
      } else {
        console.log('✅ Account is fully set up and should work!');
        console.log('   → If login still fails, check browser console for errors');
      }
    }

  } catch (error) {
    console.error('\n❌ Unexpected error:', error.message);
  }
}

// Get email from command line or use default
const email = process.argv[2] || 'Poolpatel@tshla.ai';
checkAccount(email);
