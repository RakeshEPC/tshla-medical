/**
 * Check uploaded documents for patient
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://minvvjdflezibmgkplqb.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const tshlaId = 'TSH 123-001'; // The formatted version from database

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUploads() {
  try {
    console.log('🔍 Checking uploads for patient:', tshlaId, '\n');

    // Get uploads with both TSH ID formats
    const { data: uploads, error } = await supabase
      .from('patient_document_uploads')
      .select('id, tshla_id, upload_method, extracted_data, ai_processing_status, uploaded_at')
      .or('tshla_id.eq.TSH123001,tshla_id.eq.TSH 123-001')
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error('❌ Error:', error.message);
      return;
    }

    console.log(`Found ${uploads?.length || 0} uploads\n`);

    if (uploads && uploads.length > 0) {
      uploads.forEach((upload, i) => {
        console.log(`Upload ${i + 1}:`);
        console.log(`  ID: ${upload.id}`);
        console.log(`  TSH ID: "${upload.tshla_id}"`);
        console.log(`  Method: ${upload.upload_method}`);
        console.log(`  Status: ${upload.ai_processing_status}`);
        console.log(`  Uploaded: ${upload.uploaded_at}`);

        const medications = upload.extracted_data?.medications || [];
        const labs = upload.extracted_data?.labs || [];
        const allergies = upload.extracted_data?.allergies || [];

        console.log(`  Medications: ${medications.length}`);
        console.log(`  Labs: ${labs.length}`);
        console.log(`  Allergies: ${allergies.length}`);

        if (medications.length > 0) {
          console.log(`  Sample meds:`, medications.slice(0, 3).map(m =>
            typeof m === 'string' ? m : m.name
          ));
        }
        console.log('');
      });
    } else {
      console.log('⚠️  No uploads found for this patient');

      // Try searching for any uploads with 123 and 001
      const { data: anyUploads } = await supabase
        .from('patient_document_uploads')
        .select('id, tshla_id')
        .like('tshla_id', '%123%')
        .limit(10);

      if (anyUploads && anyUploads.length > 0) {
        console.log('\nFound uploads with "123" in TSH ID:');
        anyUploads.forEach(u => console.log(`  - "${u.tshla_id}"`));
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkUploads();
