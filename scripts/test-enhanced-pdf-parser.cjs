/**
 * Test enhanced PDF parser with actual Jefferson Udall PDF content
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Copy of the enhanced parser function
function parseAthenaCollectorPDF(text) {
  console.log('🔬 Parsing athenaCollector PDF...\n');

  const extractedData = {
    diagnoses: [],
    medications: [],
    procedures: [],
    labs: [],
    allergies: [],
    vitals: {},
    billing_codes: [],
    raw_content: text
  };

  const lines = text.split('\n');
  let currentSection = null;

  // Extract date from document (multiple formats)
  let documentDate = null;
  const dateMatch = text.match(/(?:Date:|DOS:|Collected|Observation date:)\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (dateMatch) {
    const parts = dateMatch[1].split('/');
    documentDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
  }

  // Extract labs from table format
  const labTablePatterns = [
    /^([A-Z][A-Za-z\d\s\/_\-\.]+?)\s+([\d\.]+)\s+(mg\/d[Ll]|g\/d[Ll]|mmol\/L|U\/L|%|mEq\/L|mL\/min\/[\d\.]+m2)/,
    /^([A-Z][A-Za-z\s]+?)\s+([\d\.]+)\s+(mg\/d[Ll]|g\/d[Ll]|mmol\/L|U\/L|%|mEq\/L)\s+([HL])?\s*([\d\-\.]+)?/,
    /^(A1[Cc]|Glucose|Cholesterol|Triglycerides|HDL|LDL|Creatinine|eGFR|TSH|PSA|Testosterone|Hemoglobin|Sodium|Potassium|Chloride|BUN|Calcium|Albumin|Protein|Bilirubin|ALP|ALT|AST|BICARBONATE)\s+[A-Za-z\s]*?\s*([\d\.]+)\s*([A-Za-z\/\d%]+)/i
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line || line.length < 3) continue;

    // Identify sections
    if (line.match(/diagnosis|icd-?10|problem list/i)) {
      currentSection = 'diagnoses';
    } else if (line.match(/medication|prescri|drug|current med/i)) {
      currentSection = 'medications';
    } else if (line.match(/procedure|cpt|billing/i)) {
      currentSection = 'procedures';
    } else if (line.match(/allerg/i)) {
      currentSection = 'allergies';
    } else if (line.match(/lab|result|test|chemistry|hematology/i)) {
      currentSection = 'labs';
    }

    // Try lab table patterns first
    let labExtracted = false;
    for (const pattern of labTablePatterns) {
      const labMatch = pattern.exec(line);
      if (labMatch) {
        const testName = labMatch[1].trim();
        const value = labMatch[2];
        const unit = labMatch[3] || '';

        if (testName.length > 2 && testName.length < 60 &&
            !testName.match(/patient|doctor|provider|page|printed|report|specimen|collected|received|reported/i)) {

          const isDuplicate = extractedData.labs.some(lab =>
            lab.name.toLowerCase() === testName.toLowerCase()
          );

          if (!isDuplicate) {
            extractedData.labs.push({
              name: testName,
              value: value,
              unit: unit,
              date: documentDate || new Date().toISOString().split('T')[0]
            });
            labExtracted = true;
          }
        }
        break;
      }
    }

    if (labExtracted) continue;
  }

  return extractedData;
}

(async () => {
  console.log('📄 Testing Enhanced PDF Parser with Jefferson Udall PDF\n');

  // Fetch the actual PDF raw content
  const { data } = await supabase
    .from('patient_document_uploads')
    .select('raw_content')
    .eq('id', 'fd1692ee-dbb1-4f62-8583-0ff59b5dcf3b')
    .single();

  console.log('✅ Fetched PDF raw content\n');

  // Parse it
  const result = parseAthenaCollectorPDF(data.raw_content);

  console.log('📊 Parsing Results:\n');
  console.log('Labs extracted:', result.labs.length);
  console.log('');

  if (result.labs.length > 0) {
    console.log('🧪 Labs Extracted:');
    result.labs.slice(0, 20).forEach(lab => {
      console.log(`   ${lab.name}: ${lab.value} ${lab.unit}`);
    });

    if (result.labs.length > 20) {
      console.log(`   ... and ${result.labs.length - 20} more labs`);
    }
  }

  console.log('\n✅ Test completed!');
})();
