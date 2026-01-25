/**
 * Check if patient_medications table exists
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://minvvjdflezibmgkplqb.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable() {
  try {
    console.log('🔍 Checking patient_medications table...\n');

    // Try to query the table
    const { data, error } = await supabase
      .from('patient_medications')
      .select('id')
      .limit(1);

    if (error) {
      if (error.code === '42P01') {
        console.log('❌ Table does NOT exist');
        console.log('   Error:', error.message);
        console.log('\n⚠️  You need to run the migration in Supabase dashboard!');
        console.log('   Go to: https://supabase.com/dashboard/project/minvvjdflezibmgkplqb/sql/new');
        console.log('   And run the SQL from: database/migrations/add-patient-medications-management.sql');
      } else {
        console.log('⚠️  Error querying table:', error.message);
        console.log('   Code:', error.code);
      }
    } else {
      console.log('✅ Table EXISTS');
      console.log('   Current row count:', data?.length || 0);

      // Try to get a sample row
      const { data: sample } = await supabase
        .from('patient_medications')
        .select('*')
        .limit(1);

      if (sample && sample.length > 0) {
        console.log('\n📋 Sample row:');
        console.log(JSON.stringify(sample[0], null, 2));
      }
    }

  } catch (error) {
    console.error('❌ Check error:', error.message);
  }
}

checkTable();
