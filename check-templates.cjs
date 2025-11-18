const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://minvvjdflezibmgkplqb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNDE5ODgsImV4cCI6MjA3MTYxNzk4OH0.-qzlS3artX2DWOVQgIqwd1jd3Utlnik6yOMFhyGcHl8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTemplates() {
  console.log('Checking templates for shannon@tshla.ai and rakesh@tshla.ai...');
  
  const { data: staff, error: staffError } = await supabase
    .from('medical_staff')
    .select('id, auth_user_id, name, email')
    .in('email', ['shannon@tshla.ai', 'rakesh@tshla.ai']);
  
  if (staffError) {
    console.error('Error fetching staff:', staffError);
    return;
  }
  
  console.log('Found staff members:', staff.length);
  
  for (const member of staff) {
    console.log(`\nTemplates for ${member.name} (${member.email}):`);
    
    const { data: templates, error: templatesError } = await supabase
      .from('templates')
      .select('id, name, specialty, template_type, sections, general_instructions, usage_count')
      .eq('created_by', member.id);
    
    if (templatesError) {
      console.error('Error fetching templates:', templatesError);
      continue;
    }
    
    const count = templates ? templates.length : 0;
    console.log(`Found ${count} custom templates`);
    
    if (templates && templates.length > 0) {
      templates.forEach((t, idx) => {
        console.log(`  ${idx + 1}. ${t.name} (${t.template_type})`);
        const sectionCount = t.sections ? Object.keys(t.sections).length : 0;
        console.log(`     Sections: ${sectionCount}, Usage: ${t.usage_count || 0}`);
      });
    }
  }
}

checkTemplates().catch(console.error);
