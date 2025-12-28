#!/usr/bin/env tsx
/**
 * Find Specific Patient Pump Assessments
 * Searches for Michael Dummer, Jagdeep Verma, William Watson, Gail Kennedy, Suresh Nayak
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function findSpecificPatients() {
  console.log('🔍 Searching for specific patients...\n');
  console.log('='.repeat(80) + '\n');

  const targetPatients = [
    { firstName: 'michael', lastName: 'dummer', alternate: 'michale' },
    { firstName: 'jagdeep', lastName: 'verma' },
    { firstName: 'william', lastName: 'watson' },
    { firstName: 'gail', lastName: 'kennedy', alternate: 'ken' },
    { firstName: 'suresh', lastName: 'nayak', alternate: 'nayek' },
  ];

  // Get all users first
  const { data: authUsers } = await supabase.auth.admin.listUsers();

  // Get all patients
  const { data: patients } = await supabase
    .from('patients')
    .select('*');

  // Get all pump assessments
  const { data: assessments } = await supabase
    .from('pump_assessments')
    .select('*')
    .order('created_at', { ascending: false });

  console.log(`📊 Database totals:`);
  console.log(`   Auth users: ${authUsers?.users.length || 0}`);
  console.log(`   Patients: ${patients?.length || 0}`);
  console.log(`   Pump assessments: ${assessments?.length || 0}\n`);
  console.log('='.repeat(80) + '\n');

  for (const target of targetPatients) {
    console.log(`🔎 Searching for: ${target.firstName} ${target.lastName}`);
    console.log('─'.repeat(80));

    let found = false;

    // Search in auth.users
    const matchingUsers = authUsers?.users.filter((user: any) => {
      const email = user.email?.toLowerCase() || '';
      const firstName = user.user_metadata?.first_name?.toLowerCase() || '';
      const lastName = user.user_metadata?.last_name?.toLowerCase() || '';
      const fullName = `${firstName} ${lastName}`;

      return (
        email.includes(target.firstName) ||
        firstName.includes(target.firstName) ||
        lastName.includes(target.lastName) ||
        (target.alternate && (
          firstName.includes(target.alternate) ||
          lastName.includes(target.alternate)
        ))
      );
    });

    if (matchingUsers && matchingUsers.length > 0) {
      found = true;
      console.log('\n✅ Found in Auth Users:');
      matchingUsers.forEach((user: any) => {
        console.log(`\n   👤 User ID: ${user.id}`);
        console.log(`      Email: ${user.email}`);
        console.log(`      Name: ${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`);
        console.log(`      Created: ${new Date(user.created_at).toLocaleString()}`);
        console.log(`      Last Sign In: ${user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Never'}`);

        // Look for their assessments
        const userAssessments = assessments?.filter((a: any) =>
          a.patient_id === user.id
        );

        if (userAssessments && userAssessments.length > 0) {
          console.log(`\n      💊 PUMP ASSESSMENTS (${userAssessments.length}):`);
          userAssessments.forEach((assessment: any, idx: number) => {
            console.log(`\n      Assessment #${idx + 1}:`);
            console.log(`         Date: ${new Date(assessment.created_at).toLocaleString()}`);
            console.log(`         1st Choice: ${assessment.first_choice_pump || 'N/A'}`);
            console.log(`         2nd Choice: ${assessment.second_choice_pump || 'N/A'}`);
            console.log(`         3rd Choice: ${assessment.third_choice_pump || 'N/A'}`);

            if (assessment.final_recommendation?.topChoice) {
              const top = assessment.final_recommendation.topChoice;
              console.log(`\n         Top Choice Details:`);
              console.log(`            Pump: ${top.name}`);
              console.log(`            Score: ${top.score || 'N/A'}`);
              if (top.reasons && top.reasons.length > 0) {
                console.log(`            Reasons:`);
                top.reasons.slice(0, 3).forEach((r: string) => {
                  console.log(`               • ${r}`);
                });
              }
            }

            if (assessment.final_recommendation?.personalizedInsights) {
              console.log(`\n         Insights: ${assessment.final_recommendation.personalizedInsights.substring(0, 150)}...`);
            }
          });
        } else {
          console.log(`\n      ⚠️  No pump assessments found for this user`);
        }
      });
    }

    // Search in patients table
    const matchingPatients = patients?.filter((p: any) => {
      const firstName = p.first_name?.toLowerCase() || '';
      const lastName = p.last_name?.toLowerCase() || '';
      const email = p.email?.toLowerCase() || '';

      return (
        firstName.includes(target.firstName) ||
        lastName.includes(target.lastName) ||
        email.includes(target.firstName) ||
        (target.alternate && (
          firstName.includes(target.alternate) ||
          lastName.includes(target.alternate)
        ))
      );
    });

    if (matchingPatients && matchingPatients.length > 0) {
      if (!found) console.log('');
      found = true;
      console.log('\n✅ Found in Patients Table:');
      matchingPatients.forEach((patient: any) => {
        console.log(`\n   👤 Patient ID: ${patient.id}`);
        console.log(`      Name: ${patient.first_name} ${patient.last_name}`);
        console.log(`      Email: ${patient.email || 'N/A'}`);
        console.log(`      PumpDrive Enabled: ${patient.pumpdrive_enabled ? 'Yes' : 'No'}`);
        console.log(`      Last Assessment: ${patient.pumpdrive_last_assessment ? new Date(patient.pumpdrive_last_assessment).toLocaleString() : 'Never'}`);
      });
    }

    if (!found) {
      console.log('\n   ❌ Not found in database');
    }

    console.log('\n' + '='.repeat(80) + '\n');
  }

  // Summary
  console.log('📋 SUMMARY\n');
  console.log('Target Patients:');
  targetPatients.forEach((t, i) => {
    const found = authUsers?.users.some((u: any) => {
      const firstName = u.user_metadata?.first_name?.toLowerCase() || '';
      const lastName = u.user_metadata?.last_name?.toLowerCase() || '';
      return firstName.includes(t.firstName) && lastName.includes(t.lastName);
    });
    console.log(`   ${i + 1}. ${t.firstName} ${t.lastName}: ${found ? '✅ Found' : '❌ Not found'}`);
  });

  console.log('\n📊 Pump Assessment Statistics:');
  if (assessments && assessments.length > 0) {
    const pumpCounts = new Map<string, number>();
    assessments.forEach((a: any) => {
      if (a.first_choice_pump) {
        pumpCounts.set(a.first_choice_pump, (pumpCounts.get(a.first_choice_pump) || 0) + 1);
      }
    });

    console.log('\n   Most Popular 1st Choice Pumps:');
    Array.from(pumpCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([pump, count]) => {
        console.log(`      ${pump}: ${count} selection(s)`);
      });
  }
}

findSpecificPatients().then(() => {
  console.log('\n✅ Search complete\n');
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
