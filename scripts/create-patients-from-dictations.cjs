/**
 * Create patient records from dictated_notes
 * Ensures all patients with dictations have unified_patients records and TSHLA IDs
 * Created: 2026-01-26
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Normalize phone number to standard format
 * (281) 781-9856 -> +12817819856
 * 832-541-0196 -> +18325410196
 */
function normalizePhone(phone) {
  if (!phone) return null;

  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');

  // If 10 digits, add +1 prefix (US)
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // If 11 digits starting with 1, add +
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // Return as-is if already formatted or invalid
  return digits.length > 0 ? `+1${digits.slice(-10)}` : null;
}

async function createPatientsFromDictations() {
  console.log('🚀 Creating patient records from dictations...\n');

  // 1. Load all dictations
  const { data: dictations, error: dictationsError } = await supabase
    .from('dictated_notes')
    .select('patient_name, patient_phone, created_at')
    .order('created_at', { ascending: true });

  if (dictationsError) {
    console.error('❌ Error loading dictations:', dictationsError.message);
    return;
  }

  console.log(`📝 Found ${dictations?.length || 0} dictations\n`);

  // 2. Group by patient
  const patientGroups = {};
  dictations.forEach(dict => {
    const normalizedPhone = normalizePhone(dict.patient_phone);
    if (!normalizedPhone) return;

    if (!patientGroups[normalizedPhone]) {
      patientGroups[normalizedPhone] = {
        phone: normalizedPhone,
        originalPhone: dict.patient_phone,
        name: dict.patient_name,
        firstSeen: dict.created_at
      };
    }
  });

  const uniquePatients = Object.values(patientGroups);
  console.log(`👥 Found ${uniquePatients.length} unique patients\n`);
  console.log('=' .repeat(70) + '\n');

  // 3. Get next TSHLA ID number
  const { data: lastPatient } = await supabase
    .from('unified_patients')
    .select('tshla_id')
    .order('tshla_id', { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextNumber = 1;
  if (lastPatient && lastPatient.tshla_id) {
    const match = lastPatient.tshla_id.match(/TSH (\d+)-(\d+)/);
    if (match) {
      nextNumber = parseInt(match[2]) + 1;
    }
  }

  console.log(`Starting TSHLA ID: TSH 001-${String(nextNumber).padStart(3, '0')}\n`);

  // 4. Create patient records
  let createdCount = 0;
  let existingCount = 0;
  let failCount = 0;

  for (const patient of uniquePatients) {
    try {
      // Check if patient already exists
      const { data: existing } = await supabase
        .from('unified_patients')
        .select('tshla_id, phone_primary')
        .eq('phone_primary', patient.phone)
        .maybeSingle();

      if (existing) {
        console.log(`✓ ${patient.name} (${patient.originalPhone}) - Already exists: ${existing.tshla_id}`);
        existingCount++;
        continue;
      }

      // Create new patient
      const tshlaId = `TSH 001-${String(nextNumber).padStart(3, '0')}`;

      // Parse name into first/last
      const nameParts = (patient.name || 'Unknown Patient').trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || firstName;

      const { error: insertError } = await supabase
        .from('unified_patients')
        .insert({
          tshla_id: tshlaId,
          phone_primary: patient.phone,
          phone_display: patient.originalPhone,
          first_name: firstName,
          last_name: lastName,
          full_name: patient.name,
          date_of_birth: null, // Will be filled from dictation later
          created_at: patient.firstSeen || new Date().toISOString(),
          is_active: true,
          patient_status: 'active',
          created_from: 'dictation_import'
        });

      if (insertError) {
        throw new Error(insertError.message);
      }

      console.log(`✅ ${patient.name} (${patient.originalPhone}) -> ${tshlaId}`);
      createdCount++;
      nextNumber++;

    } catch (error) {
      console.error(`❌ ${patient.name} (${patient.originalPhone}): ${error.message}`);
      failCount++;
    }
  }

  // 5. Summary
  console.log('\n' + '=' .repeat(70));
  console.log('\n📊 SUMMARY:\n');
  console.log(`Total patients: ${uniquePatients.length}`);
  console.log(`✅ Created: ${createdCount}`);
  console.log(`ℹ️  Already existed: ${existingCount}`);
  console.log(`❌ Failed: ${failCount}`);

  console.log('\n' + '=' .repeat(70));
  console.log('\n🎯 NEXT STEP:\n');
  console.log('Run: node scripts/generate-hp-from-dictated-notes.cjs\n');

  return { total: uniquePatients.length, created: createdCount, existing: existingCount, failed: failCount };
}

// Run
createPatientsFromDictations()
  .then(stats => {
    process.exit(stats && stats.failed > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  });
