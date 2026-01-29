/**
 * Import R Patel's schedule from the uploaded CSV
 * Run: node scripts/import-patel-schedule-from-csv.cjs
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// R Patel's provider ID
const PROVIDER_ID = '652d519e-1d9d-4cdb-9768-111d4ccc03da';
const PROVIDER_NAME = 'Dr. Rakesh Patel';

// Path to CSV file
const CSV_PATH = '/Users/rakeshpatel/Downloads/printcsvreports - 20260127_06-28.csv';

// Today's date
const today = '2026-01-27';

function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Add last field
  values.push(current.trim());

  return values;
}

function parseTime(timeStr) {
  // Convert "01:00 PM" to "13:00:00"
  const match = timeStr.match(/(\d+):(\d+)\s+(AM|PM)/);
  if (!match) return null;

  let [, hours, minutes, period] = match;
  hours = parseInt(hours);
  minutes = parseInt(minutes);

  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

function parseDOB(dobStr) {
  // Convert "01/31/1972" to "1972-01-31"
  const parts = dobStr.split('/');
  if (parts.length !== 3) return null;
  return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
}

async function importSchedule() {
  console.log(`\n📅 Importing R Patel schedule for ${today}`);
  console.log(`Reading CSV: ${CSV_PATH}\n`);

  // Read CSV file
  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
  const lines = csvContent.split('\n');

  // Find header row (skip report title if present)
  let headerIndex = 0;
  if (lines[0].includes('REPORT NAME')) {
    headerIndex = 1;
  }

  const headers = parseCSVLine(lines[headerIndex]);
  console.log('Headers:', headers[0], headers[1], headers[2], '...\n');

  // Find column indices
  const colProvider = headers.indexOf('appt schdlng prvdr');
  const colDate = headers.indexOf('apptdate');
  const colTime = headers.indexOf('apptstarttime');
  const colDOB = headers.indexOf('patientdob');
  const colPhone = headers.indexOf('patient mobile no');
  const colEmail = headers.indexOf('patient email');
  const colFirstName = headers.indexOf('patient firstname');
  const colLastName = headers.indexOf('patient lastname');
  const colType = headers.indexOf('appttype');
  const colStatus = headers.indexOf('apptstatus');
  const colCancelDate = headers.indexOf('apptcancelleddate');

  // Parse R Patel appointments for today
  const appointments = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);

    // Check if this is R Patel
    if (values[colProvider] !== 'GC_EPC_Patel_R') continue;

    // Check if this is for today
    if (values[colDate] !== '01/27/2026') continue;

    // Skip empty slots (no patient name)
    if (!values[colFirstName] || !values[colLastName]) continue;

    // Skip cancelled appointments
    if (values[colCancelDate]) continue;

    const time = parseTime(values[colTime]);
    const dob = parseDOB(values[colDOB]);

    if (!time) {
      console.log(`⚠️  Skipping row ${i}: Invalid time format`);
      continue;
    }

    appointments.push({
      provider_id: PROVIDER_ID,
      provider_name: PROVIDER_NAME,
      appointment_date: today,
      appointment_time: time,
      duration_minutes: 15, // Default
      patient_name: `${values[colFirstName]} ${values[colLastName]}`.trim(),
      patient_phone: values[colPhone] || null,
      patient_email: values[colEmail] || null,
      visit_type: values[colType] || 'Established Patient',
      visit_reason: values[colType] || 'Follow Up',
      status: 'scheduled',
      source: 'athena_csv'
    });
  }

  console.log(`Found ${appointments.length} appointments for R Patel\n`);

  // Clear existing appointments for R Patel on this date
  console.log('🗑️  Clearing existing appointments...');
  const { error: deleteError } = await supabase
    .from('appointments')
    .delete()
    .eq('appointment_date', today)
    .eq('provider_id', PROVIDER_ID);

  if (deleteError) {
    console.error('❌ Error clearing appointments:', deleteError.message);
    return;
  }

  console.log('✅ Cleared existing appointments\n');

  // Insert new appointments
  let successCount = 0;
  let errorCount = 0;

  for (const apt of appointments) {
    const { error } = await supabase
      .from('appointments')
      .insert(apt);

    if (error) {
      console.error(`❌ ${apt.appointment_time} - ${apt.patient_name}: ${error.message}`);
      errorCount++;
    } else {
      console.log(`✅ ${apt.appointment_time} - ${apt.patient_name}`);
      successCount++;
    }
  }

  console.log(`\n📊 Import Summary:`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Total: ${appointments.length}`);
}

// Check if CSV file exists
if (!fs.existsSync(CSV_PATH)) {
  console.error(`❌ CSV file not found: ${CSV_PATH}`);
  process.exit(1);
}

importSchedule().catch(console.error);
