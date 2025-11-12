require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTable() {
  console.log('📋 Creating previsit_call_data table...');

  const sql = fs.readFileSync(
    require('path').join(__dirname, 'database', 'create-previsit-data-table.sql'),
    'utf8'
  );

  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    console.error('❌ Error creating table:', error);

    // Try creating directly with individual queries
    console.log('🔄 Trying alternative approach...');

    const { error: createError } = await supabase.from('previsit_call_data').select('*').limit(1);

    if (createError && createError.code === '42P01') {
      // Table doesn't exist, create it manually
      console.log('Creating table using SQL editor approach...');
      console.log('\n⚠️  Please run this SQL in Supabase SQL Editor:');
      console.log('\n' + sql);
      process.exit(0);
    }
  } else {
    console.log('✅ Table created successfully!');
  }
}

createTable();
