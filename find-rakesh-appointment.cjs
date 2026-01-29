const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findRakeshAppointment() {
  console.log('\n🔍 Searching for Rakesh Patel appointments...\n');

  // Search by MRN
  const { data: appointments, error } = await supabase
    .from('provider_schedules')
    .select('*')
    .eq('patient_mrn', '8610109')
    .order('scheduled_date', { ascending: false });

  if (error) {
    console.log('❌ Error:', error.message);
    return;
  }

  if (!appointments || appointments.length === 0) {
    console.log('⚠️  No appointments found for MRN 8610109');
    return;
  }

  console.log(`✅ Found ${appointments.length} appointment(s) for Rakesh Patel (MRN: 8610109):\n`);

  for (const apt of appointments) {
    console.log(`Appointment ID: ${apt.id}`);
    console.log(`  Patient: ${apt.patient_name}`);
    console.log(`  Date: ${apt.scheduled_date}`);
    console.log(`  Time: ${apt.start_time}`);
    console.log(`  Status: ${apt.status}`);
    console.log(`  Provider ID: ${apt.provider_id}`);
    console.log(`  Unified Patient ID: ${apt.unified_patient_id || 'NULL'}`);
    console.log('');
  }

  // Now check for notes for this patient
  console.log('🔍 Checking for dictated notes for Rakesh Patel...\n');

  const { data: notes, error: notesError } = await supabase
    .from('dictated_notes')
    .select('id, patient_name, patient_mrn, raw_transcript, processed_note, created_at, provider_name')
    .eq('patient_mrn', '8610109')
    .order('created_at', { ascending: false });

  if (notesError) {
    console.log('❌ Error checking notes:', notesError.message);
    return;
  }

  if (!notes || notes.length === 0) {
    console.log('⚠️  No dictated notes found for MRN 8610109');
  } else {
    console.log(`✅ Found ${notes.length} note(s) for Rakesh Patel:\n`);

    notes.forEach((note, idx) => {
      console.log(`Note ${idx + 1} (ID: ${note.id}):`);
      console.log(`  Patient: ${note.patient_name}`);
      console.log(`  Provider: ${note.provider_name}`);
      console.log(`  Created: ${note.created_at}`);
      console.log(`  Has Transcript: ${!!note.raw_transcript} (${note.raw_transcript?.length || 0} chars)`);
      console.log(`  Has Processed Note: ${!!note.processed_note} (${note.processed_note?.length || 0} chars)`);

      if (note.raw_transcript) {
        console.log(`  Transcript Preview: ${note.raw_transcript.substring(0, 100)}...`);
      }

      if (note.processed_note) {
        console.log(`  Processed Note Preview: ${note.processed_note.substring(0, 150)}...`);
      } else {
        console.log(`  ⚠️  WARNING: No processed note!`);
      }
      console.log('');
    });
  }
}

findRakeshAppointment().catch(console.error);
