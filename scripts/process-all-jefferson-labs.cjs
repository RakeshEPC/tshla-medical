/**
 * Process all lab uploads for Jefferson Udall and add to chart
 * Merges with existing lab data to create trends
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PATIENT_ID = '32cddaea-5a92-40c5-a3f1-2cd4b076038b';
const TSHLA_ID = 'TSH 412-376';

// Parse Quest Diagnostics lab format
function parseQuestLabs(text) {
  const labs = [];
  const lines = text.split('\n');

  // Look for date in header (e.g., "6/24/2025 9:03am")
  let reportDate = null;
  const dateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
  if (dateMatch) {
    const parts = dateMatch[1].split('/');
    reportDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
  }

  for (const line of lines) {
    // Pattern 1: Specific for HEMOGLOBIN A1C (with "OF TOTAL HGB" and other text)
    const a1cMatch = line.match(/^(HEMOGLOBIN A1C)\s+(\d+\.?\d*)\s+([\d<>\.=\-\s]+)\s+(%)\s+(?:OF\s+TOTAL\s+HGB\s+)?(NORMAL|HIGH|LOW)/i);

    // Pattern 2: TEST_NAME value refrange unit status
    const labMatch = line.match(/^([A-Z][A-Z\s,\/-]+?)\s+(\d+\.?\d*|\w+)\s+([\d<>\.=\-\s]+)\s+([A-Z\/\s\(\)]+?)\s+(NORMAL|HIGH|LOW|SEE NOTE)/i);

    // Pattern 3: Compact format
    const compactMatch = line.match(/^([A-Z][A-Z\s]+?)\s+(\d+\.?\d*)\s+([\d<>\.=\-\s]+)\s+(%|MG\/DL|G\/DL|MMOL\/L|U\/L|NG\/ML|PG\/ML)(?:\s+OF\s+TOTAL\s+HGB)?\s+(NORMAL|HIGH|LOW)/i);

    if (a1cMatch) {
      labs.push({
        name: a1cMatch[1],
        value: a1cMatch[2],
        unit: a1cMatch[4],
        reference_range: a1cMatch[3].trim(),
        status: a1cMatch[5],
        date: reportDate || new Date().toISOString().split('T')[0]
      });
    } else if (labMatch) {
      const testName = labMatch[1].trim();
      const value = labMatch[2];
      const refRange = labMatch[3].trim();
      const unit = labMatch[4].trim();
      const status = labMatch[5];

      // Filter out invalid entries
      if (testName.length > 3 && !testName.includes('Final') && !testName.includes('Report')) {
        labs.push({
          name: testName,
          value: value,
          unit: unit,
          reference_range: refRange,
          status: status,
          date: reportDate || new Date().toISOString().split('T')[0]
        });
      }
    } else if (compactMatch) {
      const testName = compactMatch[1].trim();
      const value = compactMatch[2];
      const refRange = compactMatch[3].trim();
      const unit = compactMatch[4].trim();
      const status = compactMatch[5];

      // Filter out invalid entries
      if (testName.length > 3 && !testName.includes('Final') && !testName.includes('Report')) {
        labs.push({
          name: testName,
          value: value,
          unit: unit,
          reference_range: refRange,
          status: status,
          date: reportDate || new Date().toISOString().split('T')[0]
        });
      }
    }
  }

  return labs;
}

async function processAllLabs() {
  console.log('\n📊 Processing all lab uploads for Jefferson Udall\n');

  // Get all unprocessed text uploads
  const { data: uploads, error: uploadError } = await supabase
    .from('patient_document_uploads')
    .select('*')
    .eq('patient_id', PATIENT_ID)
    .eq('upload_method', 'text')
    .order('created_at', { ascending: true });

  if (uploadError) {
    console.error('❌ Error fetching uploads:', uploadError.message);
    return;
  }

  console.log(`Found ${uploads.length} text uploads\n`);

  // Get existing labs from chart
  const { data: chartData, error: chartError } = await supabase
    .from('patient_comprehensive_chart')
    .select('labs')
    .eq('tshla_id', TSHLA_ID)
    .single();

  if (chartError) {
    console.error('❌ Error fetching chart:', chartError.message);
    return;
  }

  // Start with existing labs (object format: {testName: [values]})
  const allLabs = chartData.labs || {};

  console.log('Current chart has', Object.keys(allLabs).length, 'test types\n');

  // Process each upload
  for (const upload of uploads) {
    console.log(`Processing upload from ${upload.created_at}...`);

    if (!upload.raw_content) {
      console.log('  ⚠️  No content, skipping\n');
      continue;
    }

    const extractedLabs = parseQuestLabs(upload.raw_content);
    console.log(`  Found ${extractedLabs.length} lab results`);

    // Add to labs object
    for (const lab of extractedLabs) {
      // Normalize test name (handle variations)
      let testName = lab.name;

      // Normalize common variations
      if (testName.includes('CHOLESTEROL, TOTAL')) testName = 'Cholesterol Total';
      if (testName.includes('HDL CHOLESTEROL')) testName = 'HDL Cholesterol';
      if (testName.includes('LDL')) testName = 'LDL Cholesterol';
      if (testName.includes('TRIGLYCERIDES')) testName = 'Triglycerides';
      if (testName.includes('HEMOGLOBIN A1C') || testName.includes('A1C')) testName = 'Hemoglobin A1C';
      if (testName.includes('GLUCOSE')) testName = 'Glucose';
      if (testName.includes('CREATININE') && !testName.includes('eGFR')) testName = 'Creatinine';
      if (testName.includes('eGFR')) testName = 'eGFR';
      if (testName.includes('TSH')) testName = 'TSH';
      if (testName.includes('TESTOSTERONE')) testName = 'Testosterone Total';
      if (testName.includes('PSA')) testName = 'PSA Total';

      // Initialize array if doesn't exist
      if (!allLabs[testName]) {
        allLabs[testName] = [];
      }

      // Check if this date already exists for this test (avoid duplicates)
      const exists = allLabs[testName].some(existing => existing.date === lab.date);

      if (!exists) {
        allLabs[testName].push({
          value: lab.value,
          date: lab.date,
          unit: lab.unit,
          status: lab.status,
          reference_range: lab.reference_range
        });
        console.log(`    ✅ ${testName}: ${lab.value} ${lab.unit} (${lab.date})`);
      } else {
        console.log(`    ⏭️  ${testName}: Already have data for ${lab.date}`);
      }
    }

    console.log('');
  }

  // Sort each lab array by date (oldest to newest for graphing)
  Object.keys(allLabs).forEach(testName => {
    allLabs[testName].sort((a, b) => new Date(a.date) - new Date(b.date));
  });

  console.log('📈 Final lab summary:');
  Object.keys(allLabs).sort().forEach(testName => {
    console.log(`  ${testName}: ${allLabs[testName].length} data point(s)`);
  });

  // Update chart
  console.log('\n💾 Updating chart...');
  const { error: updateError } = await supabase
    .from('patient_comprehensive_chart')
    .update({ labs: allLabs })
    .eq('tshla_id', TSHLA_ID);

  if (updateError) {
    console.error('❌ Error updating chart:', updateError.message);
  } else {
    console.log('✅ Successfully updated chart with all lab data!');
  }
}

processAllLabs().catch(console.error);
