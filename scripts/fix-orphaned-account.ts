#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixOrphanedAccount() {
  console.log('🔧 Fixing orphaned auth account...\n');

  // Get all auth users
  const { data: { users } } = await supabase.auth.admin.listUsers();

  // Get all medical_staff records
  const { data: staffRecords } = await supabase
    .from('medical_staff')
    .select('auth_user_id');

  const staffAuthIds = new Set(staffRecords?.map(s => s.auth_user_id) || []);

  // Find orphaned auth users (no medical_staff record)
  const orphanedUsers = users.filter(u => !staffAuthIds.has(u.id));

  if (orphanedUsers.length === 0) {
    console.log('✅ No orphaned accounts found');
    return;
  }

  console.log(`Found ${orphanedUsers.length} orphaned auth user(s):\n`);

  for (const user of orphanedUsers) {
    console.log(`📧 ${user.email}`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Created: ${new Date(user.created_at).toLocaleString()}`);
    console.log(`   Confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}`);

    const metadata = user.user_metadata;
    const accountType = metadata?.account_type || 'staff';
    const firstName = metadata?.first_name || user.email?.split('@')[0] || 'User';
    const lastName = metadata?.last_name || 'Account';

    console.log(`   Creating medical_staff record...`);

    // Create the medical_staff record
    const { data, error } = await supabase
      .from('medical_staff')
      .insert({
        email: user.email,
        username: user.email!.split('@')[0],
        first_name: firstName,
        last_name: lastName,
        role: accountType === 'admin' ? 'admin' : 'staff',
        specialty: 'General',
        practice: 'TSHLA Medical',
        auth_user_id: user.id,
        is_active: true,
        is_verified: accountType === 'admin',
        created_by: 'fix-orphaned-script'
      })
      .select()
      .single();

    if (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
    } else {
      console.log(`   ✅ Created medical_staff record!`);
      console.log(`   Role: ${data.role}`);
      console.log(`   Name: ${data.first_name} ${data.last_name}\n`);
    }
  }

  console.log('✅ Done!');
}

fixOrphanedAccount();
