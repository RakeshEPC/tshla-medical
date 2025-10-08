#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkAccounts() {
  console.log('🔍 Checking all accounts in production database...\n');

  // Check auth.users
  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();

  if (usersError) {
    console.error('❌ Error fetching auth users:', usersError.message);
    return;
  }

  console.log('📧 Auth Users (total: ' + users.length + '):\n');
  users.forEach((user, i) => {
    console.log(`${i + 1}. ${user.email}`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Created: ${new Date(user.created_at).toLocaleString()}`);
    console.log(`   Last sign in: ${user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Never'}`);
    console.log(`   Confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}`);
    console.log('');
  });

  // Check medical_staff
  const { data: staffData, error: staffError } = await supabase
    .from('medical_staff')
    .select('*')
    .order('created_at', { ascending: false });

  if (staffError) {
    console.error('❌ Error fetching medical staff:', staffError.message);
  } else {
    console.log('\n👨‍⚕️ Medical Staff Records (total: ' + (staffData?.length || 0) + '):\n');
    staffData?.forEach((staff, i) => {
      console.log(`${i + 1}. ${staff.email} - ${staff.role}`);
      console.log(`   Name: ${staff.first_name} ${staff.last_name}`);
      console.log(`   Auth ID: ${staff.auth_user_id}`);
      console.log(`   Active: ${staff.is_active ? 'Yes' : 'No'}`);
      console.log(`   Verified: ${staff.is_verified ? 'Yes' : 'No'}`);
      console.log(`   Created: ${new Date(staff.created_at).toLocaleString()}`);
      console.log('');
    });
  }

  // Check patients
  const { data: patientData, error: patientError } = await supabase
    .from('patients')
    .select('*')
    .order('created_at', { ascending: false });

  if (patientError) {
    console.error('❌ Error fetching patients:', patientError.message);
  } else {
    console.log('\n🧑 Patient Records (total: ' + (patientData?.length || 0) + '):\n');
    patientData?.forEach((patient, i) => {
      console.log(`${i + 1}. ${patient.email}`);
      console.log(`   Name: ${patient.first_name} ${patient.last_name}`);
      console.log(`   AVA ID: ${patient.ava_id || 'N/A'}`);
      console.log(`   PumpDrive: ${patient.pumpdrive_enabled ? 'Enabled' : 'Disabled'}`);
      console.log(`   Auth ID: ${patient.auth_user_id}`);
      console.log(`   Created: ${new Date(patient.created_at).toLocaleString()}`);
      console.log('');
    });
  }

  // Check access logs (last 10)
  const { data: logs } = await supabase
    .from('access_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (logs && logs.length > 0) {
    console.log('\n📝 Recent Access Logs (last 10):\n');
    logs.forEach((log, i) => {
      console.log(`${i + 1}. ${log.user_email} - ${log.action}`);
      console.log(`   Type: ${log.user_type}`);
      console.log(`   Success: ${log.success ? 'Yes' : 'No'}`);
      console.log(`   Time: ${new Date(log.created_at).toLocaleString()}`);
      console.log('');
    });
  }
}

checkAccounts();
