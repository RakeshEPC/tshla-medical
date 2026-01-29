const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAppointmentNotes() {
  const appointmentId = 70211;

  console.log(`\n🔍 Checking notes for appointment ${appointmentId}...\n`);

  // 1. Check if appointment exists
  console.log('1️⃣ Checking appointment details...');
  const { data: appointment, error: aptError } = await supabase
    .from('provider_schedules')
    .select('*')
    .eq('id', appointmentId)
    .single();

  if (aptError) {
    console.log('❌ Appointment not found:', aptError.message);
    return;
  }

  console.log('✅ Appointment found:');
  console.log(`   Patient: ${appointment.patient_name}`);
  console.log(`   MRN: ${appointment.patient_mrn}`);
  console.log(`   Phone: ${appointment.patient_phone}`);
  console.log(`   Date: ${appointment.scheduled_date}`);
  console.log(`   Provider ID: ${appointment.provider_id}`);
  console.log(`   Unified Patient ID: ${appointment.unified_patient_id || 'NULL'}`);

  // 2. Check schedule_note_links
  console.log('\n2️⃣ Checking schedule_note_links...');
  const { data: links, error: linksError } = await supabase
    .from('schedule_note_links')
    .select('*')
    .eq('appointment_id', appointmentId);

  if (linksError) {
    console.log('❌ Error checking links:', linksError.message);
  } else if (!links || links.length === 0) {
    console.log('⚠️  No links found for this appointment');
  } else {
    console.log(`✅ Found ${links.length} link(s):`);
    links.forEach(link => {
      console.log(`   Note ID: ${link.note_id}, Created: ${link.created_at}`);
    });
  }

  // 3. Check dictated_notes by patient identifiers
  console.log('\n3️⃣ Checking dictated_notes by patient identifiers...');

  // By MRN
  const { data: mrnNotes, error: mrnError } = await supabase
    .from('dictated_notes')
    .select('id, patient_name, patient_mrn, raw_transcript, processed_note, created_at, provider_id, provider_name')
    .eq('patient_mrn', appointment.patient_mrn)
    .order('created_at', { ascending: false });

  if (mrnError) {
    console.log('❌ Error checking MRN notes:', mrnError.message);
  } else if (!mrnNotes || mrnNotes.length === 0) {
    console.log('⚠️  No notes found for MRN:', appointment.patient_mrn);
  } else {
    console.log(`✅ Found ${mrnNotes.length} note(s) for MRN ${appointment.patient_mrn}:`);
    mrnNotes.forEach((note, idx) => {
      console.log(`\n   Note ${idx + 1}:`);
      console.log(`   - ID: ${note.id}`);
      console.log(`   - Patient: ${note.patient_name}`);
      console.log(`   - Provider: ${note.provider_name} (${note.provider_id})`);
      console.log(`   - Created: ${note.created_at}`);
      console.log(`   - Has Transcript: ${!!note.raw_transcript} (${note.raw_transcript?.length || 0} chars)`);
      console.log(`   - Has Processed Note: ${!!note.processed_note} (${note.processed_note?.length || 0} chars)`);

      if (note.processed_note) {
        console.log(`   - Processed Note Preview: ${note.processed_note.substring(0, 100)}...`);
      }
    });
  }

  // By Phone (normalized)
  if (appointment.patient_phone) {
    const normalizedPhone = appointment.patient_phone.replace(/\D/g, '');
    console.log(`\n4️⃣ Checking by phone (${normalizedPhone})...`);

    const { data: phoneNotes } = await supabase
      .from('dictated_notes')
      .select('id, patient_name, patient_phone, created_at')
      .or(`patient_phone.eq.${appointment.patient_phone},patient_phone.eq.${normalizedPhone}`)
      .order('created_at', { ascending: false });

    if (phoneNotes && phoneNotes.length > 0) {
      console.log(`✅ Found ${phoneNotes.length} note(s) by phone`);
    } else {
      console.log('⚠️  No notes found by phone');
    }
  }

  // 5. If links exist, check the linked notes
  if (links && links.length > 0) {
    console.log('\n5️⃣ Checking linked notes details...');
    const noteIds = links.map(l => l.note_id);

    const { data: linkedNotes, error: linkedError } = await supabase
      .from('dictated_notes')
      .select('*')
      .in('id', noteIds);

    if (linkedError) {
      console.log('❌ Error fetching linked notes:', linkedError.message);
    } else if (!linkedNotes || linkedNotes.length === 0) {
      console.log('❌ Linked notes not found (orphaned links!)');
    } else {
      console.log(`✅ Found ${linkedNotes.length} linked note(s):`);
      linkedNotes.forEach(note => {
        console.log(`\n   Note ID: ${note.id}`);
        console.log(`   - Patient: ${note.patient_name}`);
        console.log(`   - MRN: ${note.patient_mrn}`);
        console.log(`   - Provider: ${note.provider_name}`);
        console.log(`   - Has raw_transcript: ${!!note.raw_transcript} (${note.raw_transcript?.length || 0} chars)`);
        console.log(`   - Has processed_note: ${!!note.processed_note} (${note.processed_note?.length || 0} chars)`);
        console.log(`   - Created: ${note.created_at}`);

        if (note.processed_note) {
          console.log(`   - Processed Note (first 200 chars):`);
          console.log(`     ${note.processed_note.substring(0, 200)}...`);
        } else {
          console.log(`   ⚠️  WARNING: processed_note is NULL or empty!`);
        }
      });
    }
  }

  console.log('\n✅ Diagnosis complete!\n');
}

checkAppointmentNotes().catch(console.error);
