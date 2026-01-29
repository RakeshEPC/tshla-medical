/**
 * Clean Jefferson Udall's lab data
 * - Remove entries where value is not a number (like "RATIO (CALC)", "TOTAL MG/DL", etc.)
 * - Merge duplicate test names (Sodium vs SODIUM, etc.)
 * - Keep only valid numeric lab values
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TSHLA_ID = 'TSH 412-376';

function isValidValue(value) {
  // Check if value is a valid number (as string)
  if (!value) return false;
  const num = parseFloat(value);
  return !isNaN(num) && isFinite(num);
}

function normalizeTestName(name) {
  // Normalize common variations
  const normalized = name.trim();

  // Map variations to standard names
  const mappings = {
    'SODIUM': 'Sodium',
    'POTASSIUM': 'Potassium',
    'CHLORIDE': 'Chloride',
    'GLUCOSE': 'Glucose',
    'CREATININE': 'Creatinine',
    'HEMOGLOBIN': 'Hemoglobin',
    'HEMOGLOBIN A1C': 'Hemoglobin A1C',
    'TRIGLYCERIDES': 'Triglycerides',
    'CHOLESTEROL, TOTAL': 'Cholesterol Total',
    'CHOLESTEROL TOTAL': 'Cholesterol Total',
    'HDL CHOLESTEROL': 'HDL Cholesterol',
    'LDL CHOLESTEROL': 'LDL Cholesterol',
    'LDL-CHOLESTEROL': 'LDL Cholesterol',
    'TSH': 'TSH',
    'TESTOSTERONE TOTAL': 'Testosterone Total',
    'TESTOSTERONE, TOTAL': 'Testosterone Total',
    'PSA TOTAL': 'PSA Total',
    'eGFR': 'eGFR',
    'EGFR': 'eGFR',
    'ALBUMIN': 'Albumin',
    'CALCIUM': 'Calcium',
    'CARBON DIOXIDE': 'Carbon Dioxide',
    'GLOBULIN': 'Globulin',
    'BILIRUBIN, TOTAL': 'Bilirubin Total',
    'HEMATOCRIT': 'Hematocrit',
    'MCHC': 'MCHC',
    'PLATELET COUNT': 'Platelet Count',
    'WHITE BLOOD CELL COUNT': 'WBC',
    'RED BLOOD CELL COUNT': 'RBC',
  };

  return mappings[normalized.toUpperCase()] || normalized;
}

async function cleanLabs() {
  console.log('\n🧹 Cleaning Jefferson Udall lab data...\n');

  // Get current labs
  const { data: chartData, error } = await supabase
    .from('patient_comprehensive_chart')
    .select('labs')
    .eq('tshla_id', TSHLA_ID)
    .single();

  if (error) {
    console.error('❌ Error fetching labs:', error.message);
    return;
  }

  const oldLabs = chartData.labs;
  const newLabs = {};

  console.log('📋 Processing', Object.keys(oldLabs).length, 'test types\n');

  let removedCount = 0;
  let keptCount = 0;

  // Clean and normalize each test
  Object.keys(oldLabs).forEach(testName => {
    const labValues = oldLabs[testName];
    const normalizedName = normalizeTestName(testName);

    // Filter valid values
    const validValues = labValues.filter(labValue => {
      if (!isValidValue(labValue.value)) {
        console.log(`❌ Removing invalid: ${testName} = "${labValue.value}" (${labValue.date})`);
        removedCount++;
        return false;
      }
      keptCount++;
      return true;
    });

    // Only add if we have valid values
    if (validValues.length > 0) {
      // Merge with existing normalized name if it exists
      if (newLabs[normalizedName]) {
        // Add to existing, avoiding duplicates by date
        validValues.forEach(newValue => {
          const exists = newLabs[normalizedName].some(existing => existing.date === newValue.date);
          if (!exists) {
            newLabs[normalizedName].push(newValue);
          }
        });
      } else {
        newLabs[normalizedName] = validValues;
      }
    }
  });

  // Sort each test's values by date
  Object.keys(newLabs).forEach(testName => {
    newLabs[testName].sort((a, b) => new Date(a.date) - new Date(b.date));
  });

  console.log(`\n📊 Summary:`);
  console.log(`   Original test types: ${Object.keys(oldLabs).length}`);
  console.log(`   Cleaned test types: ${Object.keys(newLabs).length}`);
  console.log(`   Valid lab values: ${keptCount}`);
  console.log(`   Removed invalid values: ${removedCount}`);

  console.log(`\n✨ Cleaned lab tests:`);
  Object.keys(newLabs).sort().forEach(testName => {
    const values = newLabs[testName];
    console.log(`   ${testName}: ${values.length} data point(s)`);
    values.forEach(v => {
      console.log(`      ${v.date}: ${v.value} ${v.unit}`);
    });
  });

  // Update database
  console.log('\n💾 Updating database...');
  const { error: updateError } = await supabase
    .from('patient_comprehensive_chart')
    .update({ labs: newLabs })
    .eq('tshla_id', TSHLA_ID);

  if (updateError) {
    console.error('❌ Error updating:', updateError.message);
  } else {
    console.log('✅ Successfully cleaned lab data!');
  }
}

cleanLabs().catch(console.error);
