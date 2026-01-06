/**
 * Athena Patient Import Script
 *
 * Imports patient data from Athena Health EMR CSV/Excel files
 *
 * Features:
 * - Creates patients in unified_patients table
 * - Auto-generates Internal ID (8-digit random) and TSH ID (6-digit random)
 * - Stores Athena Patient ID in mrn field
 * - Creates appointments in provider_schedules table
 * - Links patients to appointments
 * - Handles duplicates gracefully (phone-first matching)
 * - Supports dry-run mode
 *
 * Usage:
 *   node scripts/import-athena-patients.js <csv-file-path> [--dry-run]
 *
 * CSV Columns Expected:
 *   - Appointment Scheduling Provider (appt schdlng prvdr)
 *   - Appointment Date (apptdate)
 *   - Appointment Starttime (apptstarttime)
 *   - Patient Date of Birth (patientdob)
 *   - Patient Mobile Phone Number (patient mobile no)
 *   - Patient Email (patient email)
 *   - Patient ID (patientid) - This is Athena ID
 *   - Patient Middle Initial (patient middleinitial)
 *   - Patient First Name (patient firstname)
 *   - Patient Last Name (patient lastname)
 *   - Patient Address1 (patient address1)
 *   - Patient Address2 (patient address2)
 *   - Patient Zip Code (patient zip)
 *   - Patient City (patient city)
 *   - Patient Driver License Number (license number)
 *   - Patient Employer (employer)
 *   - Patient Ethnicity (ethnicity)
 *   - Patient Race (race)
 *   - Patient Sex (patientsex)
 *   - Patient State (patient state)
 *   - Patient Work Phone (patient workphone)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { createClient } = require('@supabase/supabase-js');
const patientMatchingService = require('../server/services/patientMatching.service');

// Parse command line arguments
const args = process.argv.slice(2);
const csvFilePath = args[0];
const isDryRun = args.includes('--dry-run');

if (!csvFilePath) {
  console.error('❌ Error: CSV file path is required');
  console.log('Usage: node scripts/import-athena-patients.js <csv-file-path> [--dry-run]');
  process.exit(1);
}

if (!fs.existsSync(csvFilePath)) {
  console.error(`❌ Error: File not found: ${csvFilePath}`);
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Column name mapping (handle various CSV header formats)
 */
const COLUMN_MAP = {
  // Appointment fields
  provider: ['appt schdlng prvdr', 'appointment scheduling provider', 'provider', 'provider_name'],
  appointmentDate: ['apptdate', 'appointment date', 'appt_date', 'scheduled_date'],
  appointmentStartTime: ['apptstarttime', 'appointment starttime', 'start_time', 'appt_start_time'],
  appointmentDay: ['apptday', 'appointment day'],
  appointmentMonth: ['apptmnth', 'appointment month'],
  appointmentYear: ['apptyear', 'appointment year'],
  cancelledDate: ['apptcancelleddate', 'appt cancelled date', 'cancelled_date', 'cancellation_date'],
  cancelledTime: ['apptcancelledtime', 'appt cancelled time', 'cancelled_time', 'cancellation_time'],

  // Patient identification
  athenaId: ['patientid', 'patient id', 'patient_id', 'athena_id', 'mrn'],

  // Patient demographics
  firstName: ['patient firstname', 'patientfirstname', 'first_name', 'firstname'],
  middleInitial: ['patient middleinitial', 'patientmiddleinitial', 'middle_initial', 'mi'],
  lastName: ['patient lastname', 'patientlastname', 'last_name', 'lastname'],
  dateOfBirth: ['patientdob', 'patient dob', 'dob', 'date_of_birth', 'patient date of birth'],
  sex: ['patientsex', 'patient sex', 'sex', 'gender'],

  // Contact information
  mobilePhone: ['patient mobile no', 'patientmobileno', 'mobile_phone', 'phone', 'patient mobile phone number'],
  workPhone: ['patient workphone', 'patientworkphone', 'work_phone', 'patient work phone'],
  email: ['patient email', 'patientemail', 'email'],

  // Address
  address1: ['patient address1', 'patientaddress1', 'address1', 'address_line1', 'patient address 1'],
  address2: ['patient address2', 'patientaddress2', 'address2', 'address_line2', 'patient address 2'],
  city: ['patient city', 'patientcity', 'city'],
  state: ['patient state', 'patientstate', 'state'],
  zip: ['patient zip', 'patientzip', 'zip', 'zip_code', 'patient zip code'],

  // Additional demographics
  driversLicense: ['license number', 'licensenumber', 'drivers_license', 'dl', 'patient driver license number'],
  employer: ['employer', 'patient employer'],
  ethnicity: ['ethnicity', 'patient ethnicity'],
  race: ['race', 'patient race']
};

/**
 * Find column value by checking multiple possible column names
 */
function getColumnValue(row, columnKey) {
  const possibleNames = COLUMN_MAP[columnKey] || [];

  for (const name of possibleNames) {
    // Try exact match (case-insensitive)
    const exactMatch = Object.keys(row).find(k => k.toLowerCase() === name.toLowerCase());
    if (exactMatch && row[exactMatch]) {
      return row[exactMatch].trim();
    }

    // Try partial match
    const partialMatch = Object.keys(row).find(k => k.toLowerCase().includes(name.toLowerCase()));
    if (partialMatch && row[partialMatch]) {
      return row[partialMatch].trim();
    }
  }

  return null;
}

/**
 * Parse date in various formats
 */
function parseDate(dateStr) {
  if (!dateStr) return null;

  try {
    // Try MM/DD/YYYY
    if (dateStr.includes('/')) {
      const [month, day, year] = dateStr.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // Try YYYY-MM-DD (already in correct format)
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateStr;
    }

    // Try other formats using Date parsing
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch (error) {
    console.warn(`⚠️  Could not parse date: ${dateStr}`);
  }

  return null;
}

/**
 * Parse time in various formats
 */
function parseTime(timeStr) {
  if (!timeStr) return null;

  try {
    // Already in HH:MM format
    if (timeStr.match(/^\d{1,2}:\d{2}$/)) {
      return timeStr;
    }

    // Handle 12-hour format with AM/PM
    if (timeStr.match(/\d{1,2}:\d{2}\s*(AM|PM)/i)) {
      const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      let hours = parseInt(match[1]);
      const minutes = match[2];
      const period = match[3].toUpperCase();

      if (period === 'PM' && hours !== 12) {
        hours += 12;
      } else if (period === 'AM' && hours === 12) {
        hours = 0;
      }

      return `${String(hours).padStart(2, '0')}:${minutes}`;
    }
  } catch (error) {
    console.warn(`⚠️  Could not parse time: ${timeStr}`);
  }

  return null;
}

/**
 * Import a single patient from CSV row
 */
async function importPatient(row, rowNumber) {
  try {
    // Extract patient data
    const patientData = {
      // Athena ID (stored in mrn)
      athenaId: getColumnValue(row, 'athenaId'),

      // Demographics
      firstName: getColumnValue(row, 'firstName'),
      middleInitial: getColumnValue(row, 'middleInitial'),
      lastName: getColumnValue(row, 'lastName'),
      dateOfBirth: parseDate(getColumnValue(row, 'dateOfBirth')),
      gender: getColumnValue(row, 'sex'),

      // Contact
      mobilePhone: getColumnValue(row, 'mobilePhone'),
      workPhone: getColumnValue(row, 'workPhone'),
      email: getColumnValue(row, 'email'),

      // Address
      address1: getColumnValue(row, 'address1'),
      address2: getColumnValue(row, 'address2'),
      city: getColumnValue(row, 'city'),
      state: getColumnValue(row, 'state'),
      zip: getColumnValue(row, 'zip'),

      // Additional
      driversLicense: getColumnValue(row, 'driversLicense'),
      employer: getColumnValue(row, 'employer'),
      ethnicity: getColumnValue(row, 'ethnicity'),
      race: getColumnValue(row, 'race')
    };

    // Appointment data
    const appointmentData = {
      provider: getColumnValue(row, 'provider'),
      date: parseDate(getColumnValue(row, 'appointmentDate')),
      startTime: parseTime(getColumnValue(row, 'appointmentStartTime')),
      cancelledDate: getColumnValue(row, 'cancelledDate'),
      cancelledTime: getColumnValue(row, 'cancelledTime')
    };

    console.log(`\n[Row ${rowNumber}] Processing patient: ${patientData.firstName} ${patientData.lastName}`);
    console.log(`   Athena ID: ${patientData.athenaId || 'N/A'}`);
    console.log(`   Phone: ${patientData.mobilePhone || 'N/A'}`);
    console.log(`   DOB: ${patientData.dateOfBirth || 'N/A'}`);

    // Validate required fields
    if (!patientData.mobilePhone) {
      console.error(`   ❌ Skipping: No mobile phone number`);
      return { success: false, error: 'Missing mobile phone' };
    }

    if (!patientData.firstName || !patientData.lastName) {
      console.error(`   ❌ Skipping: Missing first or last name`);
      return { success: false, error: 'Missing name' };
    }

    if (isDryRun) {
      console.log(`   [DRY RUN] Would create/update patient and appointment`);
      return { success: true, dryRun: true };
    }

    // Use patientMatching service to find or create patient
    const patient = await patientMatchingService.findOrCreatePatient(
      patientData.mobilePhone,
      {
        firstName: patientData.firstName,
        lastName: patientData.lastName,
        middle_initial: patientData.middleInitial,
        date_of_birth: patientData.dateOfBirth,
        gender: patientData.gender,
        email: patientData.email,
        phone_secondary: patientData.workPhone, // Work phone goes to phone_secondary
        address: patientData.address1,
        address_line2: patientData.address2,
        city: patientData.city,
        state: patientData.state,
        zip: patientData.zip,
        mrn: patientData.athenaId, // Athena ID goes to mrn
        drivers_license: patientData.driversLicense,
        employer: patientData.employer,
        ethnicity: patientData.ethnicity,
        race: patientData.race
      },
      'athena-import'
    );

    console.log(`   ✅ Patient processed: Internal ID ${patient.patient_id}, TSH ID ${patient.tshla_id}`);

    // Create appointment if date/time provided
    if (appointmentData.date && appointmentData.startTime && appointmentData.provider) {
      // Check if appointment was cancelled
      const isCancelled = appointmentData.cancelledDate && appointmentData.cancelledDate.trim() !== '';

      if (isCancelled) {
        console.log(`   ⚠️  Skipping cancelled appointment (cancelled on ${appointmentData.cancelledDate})`);
        return { success: true, skipped: true, reason: 'cancelled', patient };
      }

      const { error: apptError } = await supabase
        .from('provider_schedules')
        .insert({
          unified_patient_id: patient.id,
          patient_name: `${patientData.firstName} ${patientData.lastName}`,
          patient_phone: patientData.mobilePhone,
          patient_dob: patientData.dateOfBirth,
          provider_id: appointmentData.provider, // Use provider name as ID
          provider_name: appointmentData.provider,
          scheduled_date: appointmentData.date,
          start_time: appointmentData.startTime,
          status: 'scheduled',
          imported_from: 'athena-csv',
          created_from: 'athena-import'
        });

      if (apptError) {
        console.warn(`   ⚠️  Could not create appointment: ${apptError.message}`);
      } else {
        console.log(`   ✅ Appointment created: ${appointmentData.date} at ${appointmentData.startTime}`);
      }
    }

    return { success: true, patient };

  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Main import function
 */
async function importAthenaPatients() {
  console.log('🏥 Athena Patient Import');
  console.log('========================\n');
  console.log(`📄 File: ${csvFilePath}`);

  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  }

  const results = {
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: []
  };

  const rows = [];
  let lineCount = 0;

  // Read CSV file - skip first line (report title)
  await new Promise((resolve, reject) => {
    fs.createReadStream(csvFilePath)
      .pipe(csv({ skip_lines_with_error: true }))
      .on('data', (row) => {
        lineCount++;
        // Skip the first data row which has the report title as column headers
        if (lineCount > 1 || row['appt schdlng prvdr']) {
          rows.push(row);
        }
      })
      .on('end', resolve)
      .on('error', reject);
  });

  console.log(`\n📊 Found ${rows.length} rows in CSV file\n`);

  // Process each row
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 1;
    results.total++;

    const result = await importPatient(row, rowNumber);

    if (result.success) {
      results.success++;
    } else {
      results.failed++;
      results.errors.push({
        row: rowNumber,
        error: result.error
      });
    }

    // Small delay to avoid overwhelming the database
    if (!isDryRun && i < rows.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Print summary
  console.log('\n\n========================');
  console.log('📊 Import Summary');
  console.log('========================');
  console.log(`Total rows: ${results.total}`);
  console.log(`✅ Successful: ${results.success}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`⏭️  Skipped: ${results.skipped}`);

  if (results.errors.length > 0) {
    console.log('\n❌ Errors:');
    results.errors.slice(0, 10).forEach(err => {
      console.log(`   Row ${err.row}: ${err.error}`);
    });
    if (results.errors.length > 10) {
      console.log(`   ... and ${results.errors.length - 10} more errors`);
    }
  }

  if (isDryRun) {
    console.log('\n⚠️  This was a DRY RUN - no changes were made');
    console.log('   Run without --dry-run to apply changes');
  } else {
    console.log('\n✅ Import complete!');
  }
}

// Run import
importAthenaPatients()
  .catch(error => {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  });
