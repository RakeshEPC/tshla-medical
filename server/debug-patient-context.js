/**
 * Debug Patient Context for Diabetes Education AI
 * Shows exactly what data is stored and what the AI sees
 */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Build patient context exactly as the AI webhook does
 * This is copied from server/api/twilio/diabetes-education-inbound.js
 */
function buildPatientContext(patient) {
  const sections = [];

  // Add focus areas first
  if (patient.focus_areas && Array.isArray(patient.focus_areas) && patient.focus_areas.length > 0) {
    sections.push(`Focus Areas: ${patient.focus_areas.join(', ')}`);
  }

  // Add medical data (historical/baseline information)
  if (patient.medical_data) {
    const medicalSections = [];

    // Medications
    if (patient.medical_data.medications && patient.medical_data.medications.length > 0) {
      const meds = patient.medical_data.medications
        .map(m => `  - ${m.name} ${m.dose} ${m.frequency}`)
        .join('\n');
      medicalSections.push(`Medications:\n${meds}`);
    }

    // Lab values
    if (patient.medical_data.labs && Object.keys(patient.medical_data.labs).length > 0) {
      const labs = Object.entries(patient.medical_data.labs)
        .map(([key, val]) => `  - ${key}: ${val.value} ${val.unit}${val.date ? ` (${val.date})` : ''}`)
        .join('\n');
      medicalSections.push(`Lab Results:\n${labs}`);
    }

    // Diagnoses
    if (patient.medical_data.diagnoses && patient.medical_data.diagnoses.length > 0) {
      medicalSections.push(`Diagnoses: ${patient.medical_data.diagnoses.join(', ')}`);
    }

    // Allergies
    if (patient.medical_data.allergies && patient.medical_data.allergies.length > 0) {
      medicalSections.push(`ALLERGIES: ${patient.medical_data.allergies.join(', ')}`);
    }

    // Additional notes from medical document
    if (patient.medical_data.notes && patient.medical_data.notes.trim()) {
      medicalSections.push(`Additional Notes:\n${patient.medical_data.notes.trim()}`);
    }

    if (medicalSections.length > 0) {
      sections.push(medicalSections.join('\n\n'));
    }
  }

  // Add clinical notes LAST with emphasis - this overrides any conflicting data above
  if (patient.clinical_notes && patient.clinical_notes.trim()) {
    sections.push(`IMPORTANT - UPDATED CLINICAL INFORMATION:\n${patient.clinical_notes.trim()}`);
  }

  return sections.join('\n\n');
}

async function debugPatient(phoneNumber) {
  console.log('\n🔍 DIABETES EDUCATION PATIENT DEBUG');
  console.log('=====================================');
  console.log('Phone Number:', phoneNumber);
  console.log('');

  const { data, error } = await supabase
    .from('diabetes_education_patients')
    .select('*')
    .eq('phone_number', phoneNumber)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    console.error('❌ Patient not found or error:', error);
    return;
  }

  console.log('✅ PATIENT FOUND');
  console.log('─────────────────────────────────────');
  console.log('ID:', data.id);
  console.log('Name:', data.first_name, data.last_name);
  console.log('DOB:', data.date_of_birth);
  console.log('Language:', data.preferred_language);
  console.log('Active:', data.is_active);
  console.log('Created:', data.created_at);
  console.log('Updated:', data.updated_at);
  console.log('');

  console.log('📋 CLINICAL NOTES');
  console.log('─────────────────────────────────────');
  if (data.clinical_notes) {
    console.log(data.clinical_notes);
    console.log('');
    console.log('Length:', data.clinical_notes.length, 'characters');
  } else {
    console.log('(No clinical notes)');
  }
  console.log('');

  console.log('🏷️  FOCUS AREAS');
  console.log('─────────────────────────────────────');
  if (data.focus_areas && data.focus_areas.length > 0) {
    data.focus_areas.forEach((area, i) => {
      console.log(`${i + 1}. ${area}`);
    });
  } else {
    console.log('(No focus areas)');
  }
  console.log('');

  console.log('🧬 MEDICAL DATA (JSONB)');
  console.log('─────────────────────────────────────');
  if (data.medical_data) {
    console.log(JSON.stringify(data.medical_data, null, 2));
    console.log('');

    // Highlight A1C specifically
    if (data.medical_data.labs && data.medical_data.labs.a1c) {
      console.log('🩺 A1C VALUE FROM MEDICAL_DATA:');
      console.log('   Value:', data.medical_data.labs.a1c.value);
      console.log('   Unit:', data.medical_data.labs.a1c.unit);
      console.log('   Date:', data.medical_data.labs.a1c.date);
    }
  } else {
    console.log('(No medical data)');
  }
  console.log('');

  console.log('🤖 AI CONTEXT (What the AI sees)');
  console.log('─────────────────────────────────────');
  const context = buildPatientContext(data);
  console.log(context);
  console.log('');
  console.log('Context Length:', context.length, 'characters');
  console.log('');

  console.log('🔍 A1C ANALYSIS');
  console.log('─────────────────────────────────────');

  // Check for A1C mentions in clinical notes
  if (data.clinical_notes) {
    const a1cMatches = data.clinical_notes.match(/a1c.*?(\d+\.?\d*)/gi);
    if (a1cMatches) {
      console.log('A1C mentioned in clinical notes:');
      a1cMatches.forEach(match => {
        console.log('  -', match);
      });
    } else {
      console.log('No A1C mentioned in clinical notes');
    }
  }

  // Check medical_data
  if (data.medical_data?.labs?.a1c) {
    console.log('A1C in medical_data.labs.a1c:', data.medical_data.labs.a1c.value);
  } else {
    console.log('No A1C in medical_data.labs');
  }

  console.log('');
  console.log('✅ DEBUG COMPLETE');
  console.log('=====================================');
}

async function main() {
  const phoneToCheck = process.argv[2] || '+18326073630';
  await debugPatient(phoneToCheck);
  process.exit(0);
}

main();
