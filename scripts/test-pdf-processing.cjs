/**
 * Test PDF processing implementation
 * Tests the new athenaCollector PDF parser
 */

const pdf = require('pdf-parse');

// Sample athenaCollector text content (simulated)
const sampleAthenaText = `
athenaCollector v25.11 VA - Privia Health [8042]
GC - EPC - Endocrine and Psychiatry Center [3288]

Date: 01/27/2026
Patient: Jefferson Udall
DOB: 01/11/1978

DIAGNOSES:
E11.9 Type 2 diabetes mellitus without complications
E78.5 Hyperlipidemia, unspecified
I10 Essential (primary) hypertension

MEDICATIONS:
atorvastatin 40 mg tablet once daily
metformin 1000 mg tablet twice daily
lisinopril 10 mg tablet once daily
Mounjaro 2.5 mg/0.5 mL subcutaneous pen injector once weekly

PROCEDURES:
99213 Office visit, established patient, 15 min
36415 Routine venipuncture

VITALS:
BP: 132/84
Weight: 185 lbs
Temperature: 98.2 F
Pulse: 76

LABS ORDERED:
A1C
Lipid Panel
Comprehensive Metabolic Panel

ALLERGIES:
Penicillin - Rash
Sulfa drugs - Hives
`;

/**
 * Parse athenaCollector PDF files for medical data
 * (Copy of function from patient-portal-api.js for testing)
 */
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

  // Extract date from document
  let documentDate = null;
  const dateMatch = text.match(/(?:Date:|DOS:)?\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
  if (dateMatch) {
    const parts = dateMatch[1].split('/');
    documentDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Identify sections
    if (line.match(/diagnosis|icd-?10/i)) {
      currentSection = 'diagnoses';
    } else if (line.match(/medication|prescri|drug/i)) {
      currentSection = 'medications';
    } else if (line.match(/procedure|cpt/i)) {
      currentSection = 'procedures';
    } else if (line.match(/allerg/i)) {
      currentSection = 'allergies';
    }

    // Extract ICD-10 codes and diagnoses
    const icdMatch = line.match(/([A-Z]\d{2}(?:\.\d{1,3})?)\s+(.+)/);
    if (icdMatch && icdMatch[2].length > 5) {
      extractedData.diagnoses.push({
        icd_code: icdMatch[1],
        name: icdMatch[2].trim(),
        status: 'active'
      });
    }

    // Extract CPT codes and procedures
    const cptMatch = line.match(/(\d{5})\s+(.+)/);
    if (cptMatch && cptMatch[2].length > 5 && !line.match(/\d{5}\s+\d/)) {
      extractedData.procedures.push({
        cpt_code: cptMatch[1],
        name: cptMatch[2].trim(),
        date: documentDate || new Date().toISOString().split('T')[0]
      });
    }

    // Extract medications
    const medMatch = line.match(/^([A-Za-z][A-Za-z\s]+?)\s+([\d\.\/]+\s*mg(?:\/[\d\.]+\s*m[Ll])?)\s*(tablet|capsule|injection|subcutaneous|oral)?/i);
    if (medMatch) {
      const medObj = {
        name: medMatch[1].trim(),
        dosage: medMatch[2].trim(),
        route: medMatch[3] ? medMatch[3].toLowerCase() : '',
        frequency: '',
        sig: line,
        status: 'active'
      };

      const freqMatch = line.match(/\b(once daily|twice daily|three times daily|once weekly|bid|tid|qid|q\d+h)\b/i);
      if (freqMatch) {
        medObj.frequency = freqMatch[1];
      }

      extractedData.medications.push(medObj);
    }

    // Extract allergies
    if (currentSection === 'allergies' && line.length > 3 && !line.match(/allerg|none|nkda/i)) {
      const allergyMatch = line.match(/^([A-Za-z\s]+?)(?:\s*-\s*(.+))?$/);
      if (allergyMatch) {
        extractedData.allergies.push({
          allergen: allergyMatch[1].trim(),
          reaction: allergyMatch[2] ? allergyMatch[2].trim() : ''
        });
      }
    }

    // Extract vitals
    const bpMatch = line.match(/\b(?:BP|Blood Pressure):\s*(\d{2,3})\/(\d{2,3})/i);
    if (bpMatch) {
      extractedData.vitals.systolic_bp = { value: bpMatch[1], unit: 'mmHg' };
      extractedData.vitals.diastolic_bp = { value: bpMatch[2], unit: 'mmHg' };
    }

    const weightMatch = line.match(/\b(?:Weight|Wt):\s*([\d\.]+)\s*(lbs?|kg)/i);
    if (weightMatch) {
      extractedData.vitals.weight = { value: weightMatch[1], unit: weightMatch[2] };
    }

    const heightMatch = line.match(/\b(?:Height|Ht):\s*([\d'"\s]+)/i);
    if (heightMatch) {
      extractedData.vitals.height = { value: heightMatch[1].trim(), unit: '' };
    }

    const tempMatch = line.match(/\b(?:Temp|Temperature):\s*([\d\.]+)\s*°?F?/i);
    if (tempMatch) {
      extractedData.vitals.temperature = { value: tempMatch[1], unit: '°F' };
    }

    const pulseMatch = line.match(/\b(?:Pulse|HR|Heart Rate):\s*(\d+)/i);
    if (pulseMatch) {
      extractedData.vitals.pulse = { value: pulseMatch[1], unit: 'bpm' };
    }

    // Extract lab orders
    const labMatch = line.match(/^([A-Za-z][A-Za-z\d\s]+?):\s*([\d\.]+)\s*([%A-Za-z\/]+)?/);
    if (labMatch && !line.match(/date|time|patient|doctor|provider/i)) {
      const testName = labMatch[1].trim();
      if (testName.length > 2 && testName.length < 50) {
        extractedData.labs.push({
          name: testName,
          value: labMatch[2],
          unit: labMatch[3] ? labMatch[3].trim() : '',
          date: documentDate || new Date().toISOString().split('T')[0]
        });
      }
    }
  }

  // Remove duplicates
  extractedData.diagnoses = extractedData.diagnoses.filter((dx, index, self) =>
    index === self.findIndex(d => d.icd_code === dx.icd_code)
  );

  extractedData.medications = extractedData.medications.filter((med, index, self) =>
    index === self.findIndex(m => m.name.toLowerCase() === med.name.toLowerCase())
  );

  return extractedData;
}

// Test the parser
console.log('📄 Testing athenaCollector PDF Parser\n');

const result = parseAthenaCollectorPDF(sampleAthenaText);

console.log('✅ Parsing Results:\n');
console.log('📋 Diagnoses:', result.diagnoses.length);
result.diagnoses.forEach(dx => {
  console.log(`   - ${dx.icd_code}: ${dx.name}`);
});

console.log('\n💊 Medications:', result.medications.length);
result.medications.forEach(med => {
  console.log(`   - ${med.name} ${med.dosage} ${med.frequency}`);
});

console.log('\n🏥 Procedures:', result.procedures.length);
result.procedures.forEach(proc => {
  console.log(`   - ${proc.cpt_code}: ${proc.name}`);
});

console.log('\n🩺 Vitals:', Object.keys(result.vitals).length);
Object.keys(result.vitals).forEach(vital => {
  console.log(`   - ${vital}: ${result.vitals[vital].value} ${result.vitals[vital].unit}`);
});

console.log('\n🧪 Lab Orders:', result.labs.length);
result.labs.forEach(lab => {
  console.log(`   - ${lab.name}`);
});

console.log('\n⚠️  Allergies:', result.allergies.length);
result.allergies.forEach(allergy => {
  console.log(`   - ${allergy.allergen}: ${allergy.reaction}`);
});

console.log('\n✅ Test completed successfully!');
