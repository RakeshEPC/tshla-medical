const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM'
);

async function main() {
  console.log('\n📚 ACCOUNT CREATION HISTORY - WHO MADE WHAT AND WHEN\n');
  console.log('='.repeat(100) + '\n');

  const emails = ['rakesh@tshla.ai', 'shannon@tshla.ai', 'elizabeth@tshla.ai'];

  // Get all auth users
  const { data: authUsersData } = await supabase.auth.admin.listUsers();
  
  // Get all medical staff
  const { data: allStaff } = await supabase.from('medical_staff').select('*');

  console.log('CURRENT DATABASE STATE:');
  console.log('─'.repeat(100) + '\n');

  for (const email of emails) {
    const authUser = authUsersData.users.find(u => u.email === email);
    const staffRecords = allStaff.filter(s => s.email === email);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(email.toUpperCase());
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // AUTH ACCOUNT
    console.log('🔐 AUTHENTICATION ACCOUNT (Supabase Auth):');
    if (authUser) {
      console.log('   STATUS: EXISTS ✅');
      console.log('   Created: ' + new Date(authUser.created_at).toLocaleString('en-US', { 
        dateStyle: 'full', 
        timeStyle: 'short' 
      }));
      console.log('   Auth ID: ' + authUser.id);
      console.log('   Email Confirmed: ' + (authUser.email_confirmed_at ? 'Yes ✅' : 'No ❌'));
      console.log('   Last Sign In: ' + (authUser.last_sign_in_at 
        ? new Date(authUser.last_sign_in_at).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })
        : 'Never'));
      
      // Calculate days since creation
      const daysSinceCreation = Math.floor((Date.now() - new Date(authUser.created_at).getTime()) / (1000 * 60 * 60 * 24));
      console.log('   Age: ' + daysSinceCreation + ' days old');
    } else {
      console.log('   STATUS: DOES NOT EXIST ❌');
      console.log('   No authentication account was ever created');
    }

    // MEDICAL STAFF RECORDS
    console.log('\n👥 MEDICAL STAFF RECORD (Provider Profile):');
    if (staffRecords.length > 0) {
      staffRecords.forEach((staff, index) => {
        if (index > 0) console.log('\n   --- DUPLICATE RECORD ' + (index + 1) + ' ---');
        console.log('   STATUS: EXISTS ✅');
        console.log('   Created: ' + (staff.created_at 
          ? new Date(staff.created_at).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })
          : 'Unknown'));
        console.log('   Staff ID: ' + staff.id);
        console.log('   Name: ' + (staff.first_name || '') + ' ' + (staff.last_name || ''));
        console.log('   Role: ' + (staff.role || 'None'));
        console.log('   Specialty: ' + (staff.specialty || 'None'));
        console.log('   Linked to Auth ID: ' + (staff.auth_user_id || 'NOT LINKED ⚠️'));
        console.log('   Active: ' + (staff.is_active ? 'Yes ✅' : 'No ❌'));
        console.log('   Verified: ' + (staff.is_verified ? 'Yes ✅' : 'No ❌'));
        
        // Check if the linked auth ID exists
        if (staff.auth_user_id) {
          const linkedAuthExists = authUsersData.users.some(u => u.id === staff.auth_user_id);
          if (!linkedAuthExists) {
            console.log('   ⚠️  WARNING: Linked to auth ID that does not exist (orphaned link)');
          } else if (authUser && staff.auth_user_id === authUser.id) {
            console.log('   ✅ Correctly linked to existing auth account');
          } else {
            console.log('   ⚠️  WARNING: Linked to different auth account');
          }
        }
      });
    } else {
      console.log('   STATUS: DOES NOT EXIST ❌');
      console.log('   No provider profile was ever created');
    }

    // DIAGNOSIS
    console.log('\n🔍 WHAT HAPPENED:');
    if (!authUser && !staffRecords.length) {
      console.log('   → Nobody ever created any account for this email');
      console.log('   → This person was never set up in the system');
    } else if (authUser && !staffRecords.length) {
      console.log('   → Someone created the AUTH account (login credentials)');
      console.log('   → But forgot to create the MEDICAL_STAFF profile');
      console.log('   → Result: Can enter password but gets kicked out immediately');
    } else if (!authUser && staffRecords.length) {
      console.log('   → Someone created the MEDICAL_STAFF profile');
      console.log('   → But did NOT create the AUTH account (no login credentials)');
      console.log('   → Result: Cannot login at all (no password to enter)');
      
      // Check if they have an orphaned auth_user_id
      if (staffRecords[0].auth_user_id) {
        console.log('   → The staff record points to auth ID: ' + staffRecords[0].auth_user_id);
        console.log('   → But that auth account was deleted or never existed');
        console.log('   → This is called an "orphaned link"');
      }
    } else if (authUser && staffRecords.length) {
      const linked = staffRecords.some(s => s.auth_user_id === authUser.id);
      if (linked) {
        console.log('   → Both accounts exist and are properly linked ✅');
        console.log('   → This person SHOULD be able to login');
      } else {
        console.log('   → Both accounts exist but they are NOT linked');
        console.log('   → Someone created them separately without connecting them');
      }
    }
  }

  console.log('\n\n' + '='.repeat(100));
  console.log('🎯 SUMMARY: WHY ARE THEY DIFFERENT?');
  console.log('='.repeat(100) + '\n');

  console.log('These accounts were likely created at different times by different processes:\n');
  
  console.log('RAKESH:');
  console.log('  • Has medical_staff record (created by a script or migration)');
  console.log('  • NO auth account (was never created, or was deleted)');
  console.log('  • The staff record has an orphaned auth_user_id');
  console.log('  → Likely: Staff record created first, auth account never followed\n');

  console.log('SHANNON:');
  console.log('  • Has NOTHING');
  console.log('  • Never set up in the system at all');
  console.log('  → Likely: Was never added to the provider list\n');

  console.log('ELIZABETH:');
  console.log('  • Has auth account (someone created login credentials)');
  console.log('  • NO medical_staff record (profile never created)');
  console.log('  • Has logged in recently (tried to use the system)');
  console.log('  → Likely: Auth account created manually or through signup, but staff profile forgotten\n');

  console.log('\n');
}

main().catch(console.error);
