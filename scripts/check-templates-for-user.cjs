#!/usr/bin/env node
/**
 * Check templates for a specific user
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTemplates() {
  const email = 'admin@tshla.ai';

  console.log('🔍 Checking templates for:', email);
  console.log('━'.repeat(60));

  // Step 1: Get medical_staff record
  const { data: staffData, error: staffError } = await supabase
    .from('medical_staff')
    .select('id, email, auth_user_id, first_name, last_name')
    .eq('email', email)
    .single();

  if (staffError) {
    console.error('❌ Error fetching medical_staff:', staffError);
    return;
  }

  console.log('\n✅ Medical Staff Record:');
  console.log('   ID:', staffData.id);
  console.log('   Email:', staffData.email);
  console.log('   Auth User ID:', staffData.auth_user_id);
  console.log('   Name:', staffData.first_name, staffData.last_name);

  // Step 2: Check templates table
  console.log('\n📋 Checking templates table...\n');

  // User templates
  const { data: userTemplates, error: userError } = await supabase
    .from('templates')
    .select('id, name, visit_type, is_system_template, created_by, created_at')
    .eq('created_by', staffData.id);

  if (userError) {
    console.error('❌ Error fetching user templates:', userError);
  } else {
    console.log(`📝 User Templates (created_by = ${staffData.id}):`);
    console.log(`   Count: ${userTemplates?.length || 0}`);
    if (userTemplates && userTemplates.length > 0) {
      userTemplates.forEach(t => {
        console.log(`   - ${t.name} (${t.visit_type || 'general'})`);
      });
    }
  }

  // System templates
  const { data: systemTemplates, error: systemError } = await supabase
    .from('templates')
    .select('id, name, visit_type, is_system_template, created_by, created_at')
    .eq('is_system_template', true);

  if (systemError) {
    console.error('\n❌ Error fetching system templates:', systemError);
  } else {
    console.log(`\n🏥 System Templates (is_system_template = true):`);
    console.log(`   Count: ${systemTemplates?.length || 0}`);
    if (systemTemplates && systemTemplates.length > 0) {
      systemTemplates.slice(0, 5).forEach(t => {
        console.log(`   - ${t.name} (${t.visit_type || 'general'})`);
      });
      if (systemTemplates.length > 5) {
        console.log(`   ... and ${systemTemplates.length - 5} more`);
      }
    }
  }

  // Legacy templates
  const { data: legacyTemplates, error: legacyError } = await supabase
    .from('templates')
    .select('id, name, visit_type, is_system_template, created_by, created_at')
    .is('created_by', null);

  if (legacyError) {
    console.error('\n❌ Error fetching legacy templates:', legacyError);
  } else {
    console.log(`\n📦 Legacy Templates (created_by = null):`);
    console.log(`   Count: ${legacyTemplates?.length || 0}`);
    if (legacyTemplates && legacyTemplates.length > 0) {
      legacyTemplates.slice(0, 5).forEach(t => {
        console.log(`   - ${t.name} (${t.visit_type || 'general'})`);
      });
      if (legacyTemplates.length > 5) {
        console.log(`   ... and ${legacyTemplates.length - 5} more`);
      }
    }
  }

  const totalTemplates = (userTemplates?.length || 0) +
                         (systemTemplates?.length || 0) +
                         (legacyTemplates?.length || 0);

  console.log('\n━'.repeat(60));
  console.log(`📊 TOTAL TEMPLATES: ${totalTemplates}`);
  console.log('━'.repeat(60));

  if (totalTemplates === 0) {
    console.log('\n⚠️  NO TEMPLATES FOUND!');
    console.log('\n💡 Possible causes:');
    console.log('   1. Templates table is empty (needs seeding)');
    console.log('   2. RLS policies blocking queries');
    console.log('   3. Wrong table name or schema');
    console.log('\n🔧 To seed templates:');
    console.log('   npx tsx scripts/seed-templates.ts');
  } else {
    console.log('\n✅ Templates found - should be loading in UI');
    console.log('\n🔍 If templates still not showing:');
    console.log('   1. Check browser console for errors');
    console.log('   2. Check Network tab for failed API calls');
    console.log('   3. Clear localStorage cache:');
    console.log(`      localStorage.removeItem('doctor_profile_${staffData.auth_user_id}')`);
  }

  // Step 3: Check RLS policies
  console.log('\n🔒 Checking RLS policies on templates table...\n');

  const { data: policies, error: policyError } = await supabase
    .rpc('exec_sql', {
      sql: `
        SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
        FROM pg_policies
        WHERE tablename = 'templates'
      `
    })
    .single();

  if (policyError) {
    console.log('⚠️  Could not check RLS policies (requires admin access)');
    console.log('   Check Supabase dashboard → Database → Policies');
  } else {
    console.log('✅ RLS policies exist');
  }
}

checkTemplates().catch(console.error);
