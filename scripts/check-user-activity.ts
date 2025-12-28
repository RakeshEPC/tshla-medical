#!/usr/bin/env tsx
/**
 * Check User Activity and Login History
 * Searches for user logins, sessions, and pump assessment activity
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service key for auth access

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials');
  console.log('Need: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkUserActivity() {
  console.log('🔍 Checking user activity and login history...\n');
  console.log('='.repeat(80) + '\n');

  // 1. Check auth.users table for all registered users
  console.log('1️⃣  Checking Supabase Auth Users (auth.users)...');
  try {
    const { data: authUsers, error } = await supabase.auth.admin.listUsers();

    if (error) {
      console.error('  ❌ Error:', error.message);
    } else {
      console.log(`  ✅ Found ${authUsers.users.length} registered user(s)\n`);

      if (authUsers.users.length > 0) {
        authUsers.users.forEach((user: any, index: number) => {
          console.log(`  👤 User #${index + 1}:`);
          console.log(`     ID:           ${user.id}`);
          console.log(`     Email:        ${user.email || 'N/A'}`);
          console.log(`     Created:      ${new Date(user.created_at).toLocaleString()}`);
          console.log(`     Last Sign In: ${user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Never'}`);
          console.log(`     Confirmed:    ${user.email_confirmed_at ? 'Yes' : 'No'}`);

          // Check user metadata
          if (user.user_metadata && Object.keys(user.user_metadata).length > 0) {
            console.log(`     Metadata:     ${JSON.stringify(user.user_metadata)}`);
          }

          // Check app metadata (roles, etc.)
          if (user.app_metadata && Object.keys(user.app_metadata).length > 0) {
            console.log(`     App Data:     ${JSON.stringify(user.app_metadata)}`);
          }

          console.log('');
        });

        // Search for our target patients by email
        console.log('\n  🎯 Searching for target patients in auth.users:');
        const targetEmails = [
          'dummer', 'verma', 'watson', 'kennedy', 'nayak'
        ];

        targetEmails.forEach(keyword => {
          const matches = authUsers.users.filter((u: any) =>
            u.email?.toLowerCase().includes(keyword)
          );
          if (matches.length > 0) {
            console.log(`     ✅ "${keyword}": ${matches.length} match(es)`);
            matches.forEach((m: any) => console.log(`        - ${m.email}`));
          }
        });
      }
    }
  } catch (err) {
    console.error('  ❌ Error:', err);
  }

  console.log('\n' + '='.repeat(80) + '\n');

  // 2. Check audit_logs table
  console.log('2️⃣  Checking Audit Logs...');
  try {
    const { data: logs, error, count } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      if (error.message.includes('does not exist')) {
        console.log('  ⚠️  audit_logs table does not exist');
      } else {
        console.error('  ❌ Error:', error.message);
      }
    } else {
      console.log(`  ✅ Found ${count} log entries`);
      if (logs && logs.length > 0) {
        console.log('\n  Recent activity:');
        logs.slice(0, 10).forEach((log: any) => {
          console.log(`     [${new Date(log.created_at).toLocaleString()}] ${log.action} - ${log.resource_type || 'N/A'}`);
        });
      }
    }
  } catch (err) {
    console.log('  ⚠️  Table does not exist or error accessing');
  }

  console.log('\n' + '='.repeat(80) + '\n');

  // 3. Check access_logs table
  console.log('3️⃣  Checking Access Logs...');
  try {
    const { data: accessLogs, error, count } = await supabase
      .from('access_logs')
      .select('*', { count: 'exact' })
      .order('access_time', { ascending: false })
      .limit(50);

    if (error) {
      if (error.message.includes('does not exist')) {
        console.log('  ⚠️  access_logs table does not exist');
      } else {
        console.error('  ❌ Error:', error.message);
      }
    } else {
      console.log(`  ✅ Found ${count} access log entries`);
      if (accessLogs && accessLogs.length > 0) {
        console.log('\n  Recent logins:');
        accessLogs.slice(0, 10).forEach((log: any) => {
          console.log(`     [${new Date(log.access_time).toLocaleString()}] ${log.patient_name || log.user_id} - ${log.access_type || 'login'}`);
        });
      }
    }
  } catch (err) {
    console.log('  ⚠️  Table does not exist or error accessing');
  }

  console.log('\n' + '='.repeat(80) + '\n');

  // 4. Check pump_assessments with joined patient data
  console.log('4️⃣  Checking Pump Assessments Activity...');
  try {
    const { data: assessments, error } = await supabase
      .from('pump_assessments')
      .select(`
        *,
        patients (
          first_name,
          last_name,
          email
        )
      `)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('  ❌ Error:', error.message);
    } else if (!assessments || assessments.length === 0) {
      console.log('  ⚠️  No pump assessments found');
    } else {
      console.log(`  ✅ Found ${assessments.length} assessment(s)`);
      console.log('\n  Recent assessments:');
      assessments.forEach((a: any, i: number) => {
        const patientInfo = a.patients
          ? `${a.patients.first_name} ${a.patients.last_name} (${a.patients.email})`
          : a.patient_name || 'Unknown';
        console.log(`     ${i + 1}. ${patientInfo}`);
        console.log(`        Date: ${new Date(a.created_at).toLocaleString()}`);
        console.log(`        Top Choice: ${a.first_choice_pump || 'N/A'}`);
      });
    }
  } catch (err) {
    console.error('  ❌ Error:', err);
  }

  console.log('\n' + '='.repeat(80) + '\n');

  // 5. Check for any session or analytics tables
  console.log('5️⃣  Checking for Analytics/Session Tables...');

  const tablesToCheck = [
    'user_sessions',
    'patient_sessions',
    'analytics_events',
    'page_views',
    'pump_assessment_sessions'
  ];

  for (const tableName of tablesToCheck) {
    try {
      const { data, error, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (!error) {
        console.log(`  ✅ ${tableName}: ${count} records`);
      }
    } catch (err) {
      // Table doesn't exist, skip
    }
  }

  console.log('\n' + '='.repeat(80) + '\n');

  // 6. Summary of where to look for user activity
  console.log('📊 SUMMARY: Where to Look for User Activity\n');
  console.log('✓ Supabase Dashboard:');
  console.log('  → https://app.supabase.com/project/minvvjdflezibmgkplqb/auth/users');
  console.log('  → Check "Auth" → "Users" for login history');
  console.log('  → Check "Authentication" → "Logs" for sign-in events\n');

  console.log('✓ Database Tables:');
  console.log('  → auth.users - All registered users and last sign-in times');
  console.log('  → pump_assessments - Completed pump selections');
  console.log('  → patients - Patient records with pumpdrive_last_assessment');
  console.log('  → access_logs - Custom access logging (if exists)');
  console.log('  → audit_logs - Audit trail (if exists)\n');

  console.log('✓ Application Logs:');
  console.log('  → Check /logs directory for server logs');
  console.log('  → Browser console logs (if saved)');
  console.log('  → Server/container logs in Azure\n');

  console.log('✓ Azure/Cloud Platform:');
  console.log('  → Azure Container Apps logs');
  console.log('  → Application Insights (if configured)');
  console.log('  → Azure Monitor logs\n');
}

checkUserActivity().then(() => {
  console.log('\n✅ Activity check complete\n');
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
