import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://minvvjdflezibmgkplqb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkwNDE1OTAsImV4cCI6MjA1NDYxNzU5MH0.UVrmcvVl9Vv_j-s-f3D_P2LOHnTCRv7qd9mPWW0nZ5w';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTemplates() {
  console.log('🔍 Checking templates table...\n');
  
  // Query all templates
  const { data, error } = await supabase
    .from('templates')
    .select('id, name, staff_id, created_at, updated_at')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }
  
  console.log(`✅ Found ${data.length} templates:\n`);
  data.forEach((t, i) => {
    console.log(`${i + 1}. Name: "${t.name}"`);
    console.log(`   ID: ${t.id}`);
    console.log(`   Staff ID: ${t.staff_id}`);
    console.log(`   Created: ${t.created_at}`);
    console.log(`   Updated: ${t.updated_at}`);
    console.log('');
  });
  
  // Check for "rakesh" template
  const rakeshTemplate = data.find(t => t.name.toLowerCase().includes('rakesh'));
  if (rakeshTemplate) {
    console.log('✅ Found "rakesh" template!');
    console.log(JSON.stringify(rakeshTemplate, null, 2));
  } else {
    console.log('❌ No template with "rakesh" in the name found');
  }
}

checkTemplates();
