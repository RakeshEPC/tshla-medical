require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchema() {
  try {
    // Get a record to see what fields exist
    const { data, error } = await supabase
      .from('medical_staff')
      .select('*')
      .eq('email', 'admin@tshla.ai')
      .single();

    if (error) {
      console.error('Error:', error);
      return;
    }

    console.log('\n📋 Medical Staff Record Fields:');
    console.log(JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkSchema();
