#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAuditLogs() {
  console.log('\n🔍 Checking audit logs for rakesh@tshla.ai');
  console.log('═'.repeat(60));

  const staffId = '30c21923-cf6a-4cef-991b-808d13a26c5a';

  // Check access_logs
  const { data: accessLogs, error: accessError } = await supabase
    .from('access_logs')
    .select('*')
    .eq('user_email', 'rakesh@tshla.ai')
    .order('created_at', { ascending: false })
    .limit(10);

  if (accessError) {
    console.log('⚠️  Access logs:', accessError.message);
  } else if (accessLogs && accessLogs.length > 0) {
    console.log('\n📋 Recent Access Logs:');
    accessLogs.forEach(log => {
      console.log(`   ${log.created_at}: ${log.action} - ${log.success ? '✅' : '❌'}`);
    });
  } else {
    console.log('   No access logs found');
  }

  // Check medical_staff history
  console.log('\n📋 Medical Staff Record History:');
  const { data: staffData } = await supabase
    .from('medical_staff')
    .select('*')
    .eq('id', staffId)
    .single();

  if (staffData) {
    console.log(`   Created: ${staffData.created_at}`);
    console.log(`   Updated: ${staffData.updated_at}`);
    console.log(`   Last Login: ${staffData.last_login}`);
    console.log(`   Login Count: ${staffData.login_count}`);
    console.log(`   Created By: ${staffData.created_by}`);
    console.log(`   Updated By: ${staffData.updated_by || 'N/A'}`);
  }

  console.log('\n' + '═'.repeat(60));
}

checkAuditLogs().then(() => process.exit(0));
