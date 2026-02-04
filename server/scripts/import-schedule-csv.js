/**
 * Direct Schedule CSV Import Script
 * Parses the Athena CSV and imports into provider_schedules with TSH ID linkage.
 *
 * Usage: node server/scripts/import-schedule-csv.js <csv-file-path>
 */

// Load both .env files (root has SUPABASE keys, server/.env has other config)
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env'), override: false });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const logger = require('../logger');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Provider name mapping (matches athenaScheduleParser.service.ts)
const PROVIDER_MAP = {
  // Radha Bernander
  'gc_epc_bernander_r': { id: '962fbea3-3820-4b43-aad3-b31cdd27af83', fullName: 'Dr. Radha Bernander', specialty: 'Endo' },
  'bernander, radha': { id: '962fbea3-3820-4b43-aad3-b31cdd27af83', fullName: 'Dr. Radha Bernander', specialty: 'Endo' },
  // Tess Chamakkala
  'gc_epc_chamakkala_t': { id: 'bef2b22e-588e-44fd-aefb-8ccbd4c634f3', fullName: 'Dr. Tess Chamakkala', specialty: 'Family Medicine' },
  'chamakkala, tess': { id: 'bef2b22e-588e-44fd-aefb-8ccbd4c634f3', fullName: 'Dr. Tess Chamakkala', specialty: 'Family Medicine' },
  // Shannon Gregorek
  'gc_epc_gregorek_s': { id: '84513525-64d0-4a21-9d87-15b31cdcd4ea', fullName: 'Dr. Shannon Gregorek', specialty: 'Endocrinology' },
  'gregorek, shannon': { id: '84513525-64d0-4a21-9d87-15b31cdcd4ea', fullName: 'Dr. Shannon Gregorek', specialty: 'Endocrinology' },
  // Cindy Laverde
  'gc_epc_laverde_c': { id: '357ab91f-3727-4d1f-b605-3c9ff70e4133', fullName: 'Dr. Cindy Laverde', specialty: 'Pediatrics' },
  'laverde, cindy': { id: '357ab91f-3727-4d1f-b605-3c9ff70e4133', fullName: 'Dr. Cindy Laverde', specialty: 'Pediatrics' },
  // Vanessa Laverde
  'gc_epc_laverde_v': { id: '7298c46a-6e8b-4d7c-ae00-46ee3b154543', fullName: 'Dr. Vanessa Laverde', specialty: 'Pediatrics' },
  'laverde, vanessa': { id: '7298c46a-6e8b-4d7c-ae00-46ee3b154543', fullName: 'Dr. Vanessa Laverde', specialty: 'Pediatrics' },
  // Rakesh Patel
  'gc_epc_patel_r': { id: '652d519e-1d9d-4cdb-9768-111d4ccc03da', fullName: 'Dr. Rakesh Patel', specialty: 'Endocrinology' },
  'patel, rakesh': { id: '652d519e-1d9d-4cdb-9768-111d4ccc03da', fullName: 'Dr. Rakesh Patel', specialty: 'Endocrinology' },
  'gc_epc_patel-konasag': { id: '652d519e-1d9d-4cdb-9768-111d4ccc03da', fullName: 'Dr. Patel-Konasag', specialty: 'Endocrinology' },
  // Neha Patel
  'gc_epc_patel_n': { id: '59bb5994-5c0d-4e1b-975a-eec141dccda8', fullName: 'Dr. Neha Patel', specialty: 'Psychiatry' },
  // Elinia Shakya
  'gc_epc_shakya_e': { id: '96306043-2e3e-4323-a07e-d11e1f1b76fc', fullName: 'Dr. Elinia Shakya', specialty: 'Family Medicine' },
  'shakya, elinia': { id: '96306043-2e3e-4323-a07e-d11e1f1b76fc', fullName: 'Dr. Elinia Shakya', specialty: 'Family Medicine' },
  // Ghislaine Tonye
  'gc_epc_tonye_g': { id: '88382368-a7bc-4294-9ee0-47edfc62b22f', fullName: 'Dr. Ghislaine Tonye', specialty: 'Family Medicine' },
  'tonye, ghislaine': { id: '88382368-a7bc-4294-9ee0-47edfc62b22f', fullName: 'Dr. Ghislaine Tonye', specialty: 'Family Medicine' },
  // Adeleke A
  'gc_epc_adeleke_a': { id: 'd24f32c8-3af2-49a2-88bd-34d56d4cf131', fullName: 'Dr. Adeleke A', specialty: 'Endocrinology' },
  // Kamili Wade-Reescano
  'gc_epc_wade-reescano': { id: 'ff53319a-40fe-4011-a314-ceabbdb3180f', fullName: 'Dr. Kamili Wade-Reescano', specialty: 'Mental Health' },
  'wade-reescano, kamili': { id: 'ff53319a-40fe-4011-a314-ceabbdb3180f', fullName: 'Dr. Kamili Wade-Reescano', specialty: 'Mental Health' },
  // Veena Watwe
  'gc_epc_watwe_v': { id: '628aaeed-3e11-4745-bc48-cb6996701265', fullName: 'Dr. Veena Watwe', specialty: 'Pediatrics' },
  'watwe, veena': { id: '628aaeed-3e11-4745-bc48-cb6996701265', fullName: 'Dr. Veena Watwe', specialty: 'Pediatrics' },
  // Nadia Younus
  'gc_epc_younus_n': { id: 'd552f692-acf3-49e3-b238-6cc4f147013e', fullName: 'Dr. Nadia Younus', specialty: 'Internal Medicine' },
  'younus, nadia': { id: 'd552f692-acf3-49e3-b238-6cc4f147013e', fullName: 'Dr. Nadia Younus', specialty: 'Internal Medicine' },
  // Nebeolisa O
  'gc_epc_nebeolisa_o': { id: 'nebeolisa-o-uuid', fullName: 'Dr. Nebeolisa O', specialty: 'Medicine' },
  // Leal E
  'gc_epc_leal_e': { id: 'leal-e-uuid', fullName: 'Dr. Leal E', specialty: 'Medicine' },
  // Subawalla D
  'gc_epc_subawalla_d': { id: 'subawalla-d-uuid', fullName: 'Dr. Subawalla D', specialty: 'Medicine' },
  // Program providers
  'gc_epc_idealprotein': { id: 'idealprotein-uuid', fullName: 'Ideal Protein', specialty: 'Weight Management' },
  'gc_epc_thrive': { id: 'thrive-uuid', fullName: 'Thrive', specialty: 'Wellness' },
};

/**
 * Parse CSV row handling quoted fields
 */
function parseCSVRow(row) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Map column headers to known fields (with the FIX applied)
 */
function mapColumns(headers) {
  const mapping = {};
  headers.forEach((header, index) => {
    const normalized = header.toLowerCase().trim();

    // Date - exclude cancelled dates
    if (normalized === 'apptdate' || (normalized.includes('date') && !normalized.includes('birth') && !normalized.includes('dob') && !normalized.includes('cancelled'))) {
      mapping['date'] = index;
    }
    // Time - exclude cancelled/schedule times
    else if (normalized === 'apptstarttime' || (normalized.includes('time') && !normalized.includes('cancelled') && !normalized.includes('schedule')) || (normalized.includes('start') && !normalized.includes('cancelled'))) {
      mapping['time'] = index;
    }
    // Provider
    else if (normalized === 'rndrng prvdr' || normalized === 'appt schdlng prvdr' || normalized.includes('schdlng prvdr') || normalized.includes('rndrng') || normalized.includes('provider') || normalized.includes('doctor') || normalized.includes('prvdr')) {
      mapping['provider'] = index;
    }
    // First Name
    else if (normalized.includes('first') && normalized.includes('name')) {
      mapping['firstName'] = index;
    }
    // Last Name
    else if (normalized.includes('last') && normalized.includes('name')) {
      mapping['lastName'] = index;
    }
    // DOB
    else if (normalized.includes('dob') || normalized.includes('birth')) {
      mapping['dob'] = index;
    }
    // MRN - exact match or exclude chart/middle/initial
    else if (normalized.includes('mrn') || normalized === 'patientid' || (normalized.includes('patient') && normalized.includes('id') && !normalized.includes('chart') && !normalized.includes('middle') && !normalized.includes('initial'))) {
      mapping['mrn'] = index;
    }
    // Phone
    else if (normalized === 'patient mobile no' || normalized.includes('mobile') || (normalized.includes('phone') && !normalized.includes('home'))) {
      mapping['phone'] = index;
    }
    // Email
    else if (normalized.includes('email')) {
      mapping['email'] = index;
    }
    // Visit Status
    else if (normalized === 'apptstatus' || normalized === 'appt status') {
      mapping['visitStatus'] = index;
    }
    // Appointment Type
    else if (normalized === 'appttype') {
      mapping['appointmentType'] = index;
    }
    // Cancelled Date
    else if (normalized === 'apptcancelleddate' || normalized.includes('cancelled date')) {
      mapping['cancelledDate'] = index;
    }
    // Cancelled Time
    else if (normalized === 'apptcancelledtime' || normalized.includes('cancelled time')) {
      mapping['cancelledTime'] = index;
    }
  });
  return mapping;
}

/**
 * Parse date string (MM/DD/YYYY)
 */
function parseDate(dateStr) {
  if (!dateStr || !dateStr.trim()) return null;
  const match = dateStr.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, month, day, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return null;
}

/**
 * Parse time string (HH:MM AM/PM -> HH:MM:SS)
 */
function parseTime(timeStr) {
  if (!timeStr || !timeStr.trim()) return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match) {
    let [, hours, minutes, period] = match;
    hours = parseInt(hours);
    if (period.toUpperCase() === 'PM' && hours !== 12) hours += 12;
    if (period.toUpperCase() === 'AM' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${minutes}:00`;
  }
  return null;
}

/**
 * Resolve provider from name string
 */
function resolveProvider(providerStr) {
  if (!providerStr) return { id: 'unknown', name: 'Unknown Provider' };
  const normalized = providerStr.toLowerCase().trim();
  const mapped = PROVIDER_MAP[normalized];
  if (mapped) return { id: mapped.id, name: mapped.fullName };
  return { id: 'unknown', name: providerStr };
}

/**
 * Find or create unified patient
 */
async function findOrCreatePatient(phone, firstName, lastName, dob, email, mrn, providerId, providerName) {
  const normalizedPhone = phone ? phone.replace(/\D/g, '').replace(/^1/, '') : null;

  if (!normalizedPhone) return null;

  // Try to find by phone
  const { data: existingByPhone } = await supabase
    .from('unified_patients')
    .select('id, tshla_id')
    .eq('phone_primary', normalizedPhone)
    .maybeSingle();

  if (existingByPhone) {
    logger.info('ScheduleImport', 'Found existing patient by phone', { patient: `${firstName} ${lastName}`, tshId: existingByPhone.tshla_id });
    return existingByPhone.id;
  }

  // Try by MRN
  if (mrn) {
    const { data: existingByMRN } = await supabase
      .from('unified_patients')
      .select('id, tshla_id')
      .eq('mrn', mrn)
      .maybeSingle();

    if (existingByMRN) {
      // Update phone
      if (normalizedPhone) {
        await supabase.from('unified_patients').update({ phone_primary: normalizedPhone }).eq('id', existingByMRN.id);
      }
      logger.info('ScheduleImport', 'Found patient by MRN', { patient: `${firstName} ${lastName}`, tshId: existingByMRN.tshla_id });
      return existingByMRN.id;
    }
  }

  // Create via backend API
  try {
    const response = await fetch('http://localhost:3002/api/patients/find-or-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        patientData: {
          firstName,
          lastName,
          dob,
          email,
          mrn,
          provider_id: providerId,
          provider_name: providerName
        },
        source: 'schedule'
      })
    });

    if (response.ok) {
      const result = await response.json();
      logger.info('ScheduleImport', 'Created new patient', { patient: `${firstName} ${lastName}`, tshId: result.patient?.tshla_id || result.patient?.patient_id });
      return result.patient?.id;
    } else {
      logger.error('ScheduleImport', 'API error creating patient', { patient: `${firstName} ${lastName}`, status: response.status });
    }
  } catch (err) {
    logger.error('ScheduleImport', 'API call failed', { patient: `${firstName} ${lastName}`, error: err.message });
  }

  return null;
}

async function importCSV(filePath) {
  logger.startup('Schedule CSV Import');
  logger.info('ScheduleImport', 'Starting import', { file: filePath });

  const content = fs.readFileSync(filePath, 'utf-8');
  let lines = content.trim().split('\n');

  // Skip report title line
  if (lines[0].toLowerCase().includes('report name')) {
    logger.info('ScheduleImport', 'Skipping report title line', { title: lines[0].trim() });
    lines = lines.slice(1);
  }

  // Parse headers
  const headers = parseCSVRow(lines[0]);
  const columnMapping = mapColumns(headers);

  logger.info('ScheduleImport', 'Column mapping resolved', columnMapping);

  // Validate critical mappings
  const criticalFields = ['date', 'time', 'provider', 'firstName', 'lastName'];
  const missingFields = criticalFields.filter(f => columnMapping[f] === undefined);
  if (missingFields.length > 0) {
    logger.error('ScheduleImport', 'Missing critical column mappings', { missing: missingFields });
    process.exit(1);
  }

  // Parse data rows
  const appointments = [];
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVRow(line);
    const getValue = (key) => {
      const idx = columnMapping[key];
      return idx !== undefined ? (values[idx] || '') : '';
    };

    const dateStr = getValue('date');
    const timeStr = getValue('time');
    const date = parseDate(dateStr);
    const time = parseTime(timeStr);

    if (!date) {
      errors.push({ row: i + 1, message: `Invalid date: "${dateStr}"` });
      continue;
    }
    if (!time) {
      errors.push({ row: i + 1, message: `Invalid time: "${timeStr}"` });
      continue;
    }

    const providerStr = getValue('provider');
    const provider = resolveProvider(providerStr);
    const firstName = getValue('firstName');
    const lastName = getValue('lastName');
    const dob = parseDate(getValue('dob'));
    const phone = getValue('phone');
    const email = getValue('email');
    const mrn = getValue('mrn');
    const visitStatus = getValue('visitStatus') || 'None';
    const appointmentType = getValue('appointmentType') || 'office-visit';
    const cancelledDate = getValue('cancelledDate');

    // Skip cancelled appointments
    if (cancelledDate && cancelledDate.trim() !== '') {
      continue;
    }

    // Skip empty/blocked time slots (no patient name)
    if (!firstName && !lastName) {
      continue;
    }

    appointments.push({
      date, time, provider, firstName, lastName, dob,
      phone, email, mrn, visitStatus, appointmentType, status: 'scheduled',
    });
  }

  logger.info('ScheduleImport', 'Parsing complete', { appointments: appointments.length, errors: errors.length });
  if (errors.length > 0) {
    errors.forEach(e => logger.warn('ScheduleImport', 'Parse error', { row: e.row, message: e.message }));
  }

  if (appointments.length === 0) {
    logger.error('ScheduleImport', 'No appointments to import');
    process.exit(1);
  }

  // Get the schedule date from first appointment
  const scheduleDate = appointments[0].date;
  logger.info('ScheduleImport', 'Schedule date', { date: scheduleDate });

  // Clear existing appointments for this date
  logger.info('ScheduleImport', 'Clearing existing schedule for this date');
  const { error: deleteError, count: deleteCount } = await supabase
    .from('provider_schedules')
    .delete()
    .eq('scheduled_date', scheduleDate)
    .select('id');

  if (deleteError) {
    logger.error('ScheduleImport', 'Failed to clear schedule', { error: deleteError.message });
  } else {
    logger.info('ScheduleImport', 'Cleared existing records', { deleted: deleteCount?.length || 0 });
  }

  // Import batch ID
  const batchId = require('crypto').randomUUID();

  // Import each appointment
  let successCount = 0;
  let failCount = 0;

  logger.info('ScheduleImport', 'Importing appointments');

  for (const apt of appointments) {
    const patientName = `${apt.firstName} ${apt.lastName}`;

    // Find or create unified patient
    const unifiedPatientId = await findOrCreatePatient(
      apt.phone, apt.firstName, apt.lastName, apt.dob, apt.email, apt.mrn,
      apt.provider.id, apt.provider.name
    );

    const isTelehealth = apt.appointmentType?.toLowerCase().includes('telehealth') ||
                          apt.appointmentType?.toLowerCase().includes('virtual');

    const insertData = {
      provider_id: apt.provider.id,
      provider_name: apt.provider.name,
      patient_name: patientName,
      scheduled_date: apt.date,
      start_time: apt.time,
      duration_minutes: 30,
      status: apt.status,
      urgency_level: 'routine',
      is_telehealth: isTelehealth || false,
      imported_by: 'script-import',
      imported_at: new Date().toISOString(),
      import_batch_id: batchId,
    };

    // Optional fields
    if (apt.dob) insertData.patient_dob = apt.dob;
    if (apt.phone) insertData.patient_phone = apt.phone;
    if (apt.email) insertData.patient_email = apt.email;
    if (apt.mrn) insertData.patient_mrn = apt.mrn;
    if (unifiedPatientId) insertData.unified_patient_id = unifiedPatientId;
    if (apt.appointmentType) insertData.appointment_type = apt.appointmentType;

    const { data, error } = await supabase
      .from('provider_schedules')
      .insert(insertData)
      .select('id')
      .single();

    if (error) {
      logger.error('ScheduleImport', 'Insert failed', { patient: patientName, error: error.message });
      failCount++;
    } else {
      successCount++;
      if (!unifiedPatientId) {
        logger.warn('ScheduleImport', 'No TSH ID linked', { patient: patientName });
      }
    }
  }

  logger.info('ScheduleImport', 'Import complete', { imported: successCount, failed: failCount });

  // Verify TSH IDs
  logger.info('ScheduleImport', 'Verifying TSH ID linkage');
  const { data: imported } = await supabase
    .from('provider_schedules')
    .select('patient_name, unified_patient_id, patient_phone, patient_mrn, status')
    .eq('scheduled_date', scheduleDate)
    .order('start_time');

  let linkedCount = 0;
  let unlinkedCount = 0;

  for (const rec of (imported || [])) {
    if (rec.unified_patient_id) {
      const { data: patient } = await supabase
        .from('unified_patients')
        .select('tshla_id')
        .eq('id', rec.unified_patient_id)
        .single();

      logger.info('ScheduleImport', 'Linked', { patient: rec.patient_name, tshId: patient?.tshla_id, status: rec.status });
      linkedCount++;
    } else {
      logger.warn('ScheduleImport', 'Unlinked', { patient: rec.patient_name, status: rec.status });
      unlinkedCount++;
    }
  }

  logger.info('ScheduleImport', 'TSH ID summary', { linked: linkedCount, unlinked: unlinkedCount, total: (imported || []).length });
  logger.info('ScheduleImport', 'Done');
}

// Run
const csvPath = process.argv[2] || path.resolve(__dirname, '../../Downloads/printcsvreports - 20260204_09-01.csv');
if (!fs.existsSync(csvPath)) {
  logger.error('ScheduleImport', 'File not found', { path: csvPath });
  process.exit(1);
}

importCSV(csvPath)
  .then(() => process.exit(0))
  .catch(err => {
    logger.error('ScheduleImport', 'Fatal error', { error: err.message });
    process.exit(1);
  });
