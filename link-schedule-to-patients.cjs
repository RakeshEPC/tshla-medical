#!/usr/bin/env node
/**
 * Link Schedule Appointments to Unified Patients
 * Matches by phone number, then MRN, then name
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Normalize phone number (remove all non-digits)
function normalizePhone(phone) {
  if (!phone) return null;
  return phone.replace(/\D/g, '');
}

async function linkAppointments() {
  console.log('\n🔗 Linking Schedule Appointments to Patient Records...\n');

  // Get all appointments in the date range that aren't linked yet
  const { data: appointments, error: aptError } = await supabase
    .from('provider_schedules')
    .select('id, scheduled_date, patient_name, patient_phone, patient_mrn, patient_email, unified_patient_id')
    .gte('scheduled_date', '2026-01-05')
    .lte('scheduled_date', '2026-03-31')
    .is('unified_patient_id', null);

  if (aptError) {
    console.error('❌ Error fetching appointments:', aptError.message);
    return;
  }

  console.log(`📅 Found ${appointments.length} unlinked appointments (Jan 5 - Mar 31, 2026)\n`);

  let linkedCount = 0;
  let notFoundCount = 0;
  const notFound = [];
  let processed = 0;

  for (const apt of appointments) {
    processed++;

    // Only show detailed logs for first 10, then show progress every 50
    const showDetails = processed <= 10 || processed % 50 === 0;

    if (processed % 50 === 0 || processed === 1 || processed === appointments.length) {
      console.log(`\n📊 Progress: ${processed}/${appointments.length} (${linkedCount} linked, ${notFoundCount} not found)`);
    }

    if (showDetails) {
      console.log(`\n🔍 Processing: ${apt.patient_name} (${apt.scheduled_date})`);
    }

    let patientId = null;
    let matchMethod = null;

    // Try 1: Match by phone number (most reliable)
    if (apt.patient_phone) {
      const normalizedPhone = normalizePhone(apt.patient_phone);
      if (showDetails) console.log(`   📞 Searching by phone: ${apt.patient_phone} → ${normalizedPhone}`);

      const { data: phoneMatches } = await supabase
        .from('unified_patients')
        .select('id, patient_id, first_name, last_name, phone_primary, mrn')
        .eq('phone_primary', normalizedPhone)
        .limit(1);

      if (phoneMatches && phoneMatches.length > 0) {
        patientId = phoneMatches[0].id;
        matchMethod = 'phone';
        if (showDetails) console.log(`   ✅ MATCHED by phone → TSH_ID: ${phoneMatches[0].patient_id}`);
      }
    }

    // Try 2: Match by MRN (Athena Patient ID)
    if (!patientId && apt.patient_mrn) {
      if (showDetails) console.log(`   🏥 Searching by MRN: ${apt.patient_mrn}`);

      const { data: mrnMatches } = await supabase
        .from('unified_patients')
        .select('id, patient_id, first_name, last_name, mrn')
        .eq('mrn', apt.patient_mrn)
        .limit(1);

      if (mrnMatches && mrnMatches.length > 0) {
        patientId = mrnMatches[0].id;
        matchMethod = 'mrn';
        if (showDetails) console.log(`   ✅ MATCHED by MRN → TSH_ID: ${mrnMatches[0].patient_id}`);
      }
    }

    // Try 3: Match by name (less reliable, fuzzy match)
    if (!patientId && apt.patient_name) {
      const [firstName, ...lastNameParts] = apt.patient_name.split(' ');
      const lastName = lastNameParts.join(' ');

      if (firstName && lastName) {
        if (showDetails) console.log(`   👤 Searching by name: ${firstName} ${lastName}`);

        const { data: nameMatches } = await supabase
          .from('unified_patients')
          .select('id, patient_id, first_name, last_name, phone_primary, mrn')
          .ilike('first_name', firstName)
          .ilike('last_name', lastName)
          .limit(1);

        if (nameMatches && nameMatches.length > 0) {
          patientId = nameMatches[0].id;
          matchMethod = 'name';
          if (showDetails) {
            console.log(`   ⚠️  MATCHED by name → TSH_ID: ${nameMatches[0].patient_id}`);
            console.log(`      (Phone in DB: ${nameMatches[0].phone_primary}, MRN in DB: ${nameMatches[0].mrn})`);
          }
        }
      }
    }

    // Update appointment with patient link
    if (patientId) {
      const { error: updateError } = await supabase
        .from('provider_schedules')
        .update({ unified_patient_id: patientId })
        .eq('id', apt.id);

      if (updateError) {
        if (showDetails) console.log(`   ❌ Failed to link: ${updateError.message}`);
      } else {
        linkedCount++;
        if (showDetails) console.log(`   ✅ LINKED via ${matchMethod}`);
      }
    } else {
      notFoundCount++;
      notFound.push({
        name: apt.patient_name,
        phone: apt.patient_phone,
        mrn: apt.patient_mrn,
        date: apt.scheduled_date
      });
      if (showDetails) console.log(`   ❌ NO MATCH FOUND`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 LINKING SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Linked: ${linkedCount} appointments`);
  console.log(`❌ Not Found: ${notFoundCount} appointments`);
  console.log(`📊 Total Processed: ${appointments.length}`);

  if (notFound.length > 0) {
    console.log('\n⚠️  Patients Not Found in Database (first 20):');
    notFound.slice(0, 20).forEach(p => {
      console.log(`   - ${p.name} (${p.date})`);
      console.log(`     Phone: ${p.phone || 'N/A'}, MRN: ${p.mrn || 'N/A'}`);
    });
    if (notFound.length > 20) {
      console.log(`\n   ... and ${notFound.length - 20} more`);
    }
    console.log('\n💡 These patients need to be created in unified_patients table.');
  }

  console.log('\n✅ Linking complete!\n');
}

linkAppointments().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
