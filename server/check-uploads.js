const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM'
);

async function checkUploads() {
  console.log('🔍 Checking recent document uploads...\n');
  
  const { data, error } = await supabase
    .from('patient_document_uploads')
    .select('*')
    .order('uploaded_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('⚠️  No uploads found in database');
    return;
  }

  console.log(`✅ Found ${data.length} recent upload(s):\n`);
  
  data.forEach((upload, index) => {
    console.log(`Upload #${index + 1}:`);
    console.log(`  ID: ${upload.id}`);
    console.log(`  TSH ID: ${upload.tshla_id}`);
    console.log(`  Method: ${upload.upload_method}`);
    console.log(`  Uploaded: ${upload.uploaded_at}`);
    console.log(`  File name: ${upload.file_name || 'N/A'}`);
    console.log(`  AI Status: ${upload.ai_processing_status}`);
    
    if (upload.extracted_data) {
      const data = upload.extracted_data;
      console.log(`  Extracted:`);
      console.log(`    - Diagnoses: ${data.diagnoses?.length || 0}`);
      console.log(`    - Medications: ${data.medications?.length || 0}`);
      console.log(`    - Allergies: ${data.allergies?.length || 0}`);
      
      if (data.diagnoses?.length > 0) {
        console.log(`    Diagnoses: ${data.diagnoses.slice(0, 3).join(', ')}`);
      }
      if (data.medications?.length > 0) {
        console.log(`    Medications: ${data.medications.slice(0, 3).join(', ')}`);
      }
    }
    
    console.log('');
  });
}

checkUploads().catch(console.error);
