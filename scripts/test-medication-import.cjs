/**
 * Test medication import
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://minvvjdflezibmgkplqb.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const tshlaId = 'TSH123001';

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testImport() {
  try {
    console.log('🔍 Testing medication import for:', tshlaId, '\n');

    // 1. Get patient ID
    console.log('Step 1: Getting patient ID...');
    const { data: patient, error: patientError } = await supabase
      .from('unified_patients')
      .select('id')
      .eq('tshla_id', tshlaId)
      .single();

    if (patientError || !patient) {
      console.error('❌ Patient not found:', patientError?.message);
      return;
    }
    console.log('✅ Patient ID:', patient.id);

    // 2. Get uploads
    console.log('\nStep 2: Getting uploaded documents...');
    const { data: uploads, error: uploadsError } = await supabase
      .from('patient_document_uploads')
      .select('id, extracted_data, uploaded_at')
      .eq('tshla_id', tshlaId)
      .eq('ai_processing_status', 'completed');

    if (uploadsError) {
      console.error('❌ Upload error:', uploadsError.message);
      return;
    }
    console.log('✅ Found', uploads?.length || 0, 'uploads');

    // 3. Extract medications
    console.log('\nStep 3: Extracting medications...');
    const medicationsToImport = [];
    const seenMeds = new Set();

    for (const upload of uploads || []) {
      const meds = upload.extracted_data?.medications || [];
      console.log('  - Upload', upload.id, 'has', meds.length, 'medications');

      for (const med of meds) {
        const medName = typeof med === 'string' ? med : med.name;
        const medKey = medName?.toLowerCase();

        if (medKey && !seenMeds.has(medKey) && medName !== 'AthenaHealth') {
          seenMeds.add(medKey);

          medicationsToImport.push({
            patient_id: patient.id,
            tshla_id: tshlaId,
            medication_name: medName,
            dosage: typeof med === 'object' ? med.dosage || '' : '',
            frequency: typeof med === 'object' ? med.frequency || '' : '',
            route: typeof med === 'object' ? med.route || '' : '',
            sig: typeof med === 'object' ? med.sig || '' : '',
            status: typeof med === 'object' && med.status ? med.status : 'active',
            source: 'ccd_upload',
            source_upload_id: upload.id,
            need_refill: false,
            send_to_pharmacy: false
          });
        }
      }
    }

    console.log('✅ Extracted', medicationsToImport.length, 'unique medications');

    if (medicationsToImport.length > 0) {
      console.log('\nSample medication:');
      console.log(JSON.stringify(medicationsToImport[0], null, 2));
    }

    // 4. Try inserting ONE medication
    console.log('\nStep 4: Testing insert of first medication...');
    if (medicationsToImport.length > 0) {
      const testMed = medicationsToImport[0];

      // Check if exists
      const { data: existing } = await supabase
        .from('patient_medications')
        .select('id')
        .eq('tshla_id', tshlaId)
        .eq('medication_name', testMed.medication_name)
        .maybeSingle();

      if (existing) {
        console.log('⚠️  Medication already exists:', testMed.medication_name);
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('patient_medications')
          .insert(testMed)
          .select();

        if (insertError) {
          console.error('❌ Insert error:', insertError);
          console.error('   Code:', insertError.code);
          console.error('   Message:', insertError.message);
          console.error('   Details:', insertError.details);
          console.error('   Hint:', insertError.hint);
        } else {
          console.log('✅ Successfully inserted:', testMed.medication_name);
          console.log('   ID:', inserted[0]?.id);
        }
      }
    }

  } catch (error) {
    console.error('❌ Test error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testImport();
