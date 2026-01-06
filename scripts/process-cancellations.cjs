/**
 * Process Cancellations Script
 *
 * Processes a CSV file containing cancelled appointments and marks them in the database
 *
 * Usage:
 *   node scripts/process-cancellations.cjs <csv-file-path> [--dry-run] [--delete]
 *
 * CSV Format:
 *   patientid,apptcancelleddate,apptcancelledtime
 *   8610053,05/21/2025,07:59 AM
 *
 * Options:
 *   --dry-run: Preview changes without making them
 *   --delete: Delete cancelled appointments instead of marking status='cancelled'
 */

require('dotenv').config();
const fs = require('fs');
const csv = require('csv-parser');
const { createClient } = require('@supabase/supabase-js');

// Parse command line arguments
const args = process.argv.slice(2);
const csvFilePath = args[0];
const isDryRun = args.includes('--dry-run');
const shouldDelete = args.includes('--delete');

if (!csvFilePath) {
  console.error('❌ Error: CSV file path is required');
  console.log('Usage: node scripts/process-cancellations.cjs <csv-file-path> [--dry-run] [--delete]');
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

// Statistics
const stats = {
  totalRows: 0,
  patientsFound: 0,
  patientsNotFound: 0,
  appointmentsCancelled: 0,
  appointmentsDeleted: 0,
  appointmentsNotFound: 0,
  errors: 0
};

/**
 * Parse date from various formats
 */
function parseDate(dateStr) {
  if (!dateStr) return null;

  try {
    // Handle MM/DD/YYYY format
    if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
      const [month, day, year] = dateStr.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  } catch (error) {
    console.warn(`⚠️  Could not parse date: ${dateStr}`);
  }

  return null;
}

/**
 * Process a single cancellation record
 */
async function processCancellation(row, rowNumber) {
  try {
    const patientId = row.patientid?.trim();
    const cancelledDate = parseDate(row.apptcancelleddate?.trim());
    const cancelledTime = row.apptcancelledtime?.trim();

    console.log(`\n[Row ${rowNumber}] Processing cancellation for Patient ID: ${patientId}`);
    console.log(`   Cancelled: ${cancelledDate} at ${cancelledTime}`);

    if (!patientId) {
      console.error(`   ❌ Skipping: No patient ID`);
      stats.errors++;
      return;
    }

    // Find patient by MRN (Athena Patient ID)
    const { data: patients, error: patientError } = await supabase
      .from('unified_patients')
      .select('id, patient_id, tshla_id, first_name, last_name')
      .eq('mrn', patientId);

    if (patientError) {
      console.error(`   ❌ Error finding patient: ${patientError.message}`);
      stats.errors++;
      return;
    }

    if (!patients || patients.length === 0) {
      console.log(`   ⚠️  Patient not found in database (MRN: ${patientId})`);
      stats.patientsNotFound++;
      return;
    }

    const patient = patients[0];
    stats.patientsFound++;
    console.log(`   ✅ Found patient: ${patient.first_name} ${patient.last_name} (${patient.patient_id})`);

    // Find appointments for this patient on or around the cancellation date
    const { data: appointments, error: apptError } = await supabase
      .from('provider_schedules')
      .select('id, scheduled_date, start_time, status, patient_name')
      .eq('unified_patient_id', patient.id)
      .neq('status', 'cancelled'); // Only get non-cancelled appointments

    if (apptError) {
      console.error(`   ❌ Error finding appointments: ${apptError.message}`);
      stats.errors++;
      return;
    }

    if (!appointments || appointments.length === 0) {
      console.log(`   ⚠️  No active appointments found for this patient`);
      stats.appointmentsNotFound++;
      return;
    }

    console.log(`   📅 Found ${appointments.length} active appointment(s) for this patient`);

    // If we have a cancellation date, try to match it
    // Otherwise, we might need to cancel all appointments (or handle differently)
    let appointmentsToCancel = appointments;

    if (cancelledDate) {
      // Try to find appointments on the cancellation date
      appointmentsToCancel = appointments.filter(apt => apt.scheduled_date === cancelledDate);

      if (appointmentsToCancel.length === 0) {
        console.log(`   ⚠️  No appointments found on cancellation date ${cancelledDate}`);
        console.log(`   ℹ️  Patient has appointments on: ${appointments.map(a => a.scheduled_date).join(', ')}`);
        stats.appointmentsNotFound++;
        return;
      }
    }

    // Process each appointment to cancel
    for (const appointment of appointmentsToCancel) {
      if (isDryRun) {
        console.log(`   [DRY RUN] Would ${shouldDelete ? 'delete' : 'cancel'} appointment: ${appointment.scheduled_date} at ${appointment.start_time}`);
        stats.appointmentsCancelled++;
        continue;
      }

      if (shouldDelete) {
        // Delete the appointment
        const { error: deleteError } = await supabase
          .from('provider_schedules')
          .delete()
          .eq('id', appointment.id);

        if (deleteError) {
          console.error(`   ❌ Error deleting appointment: ${deleteError.message}`);
          stats.errors++;
        } else {
          console.log(`   🗑️  Deleted appointment: ${appointment.scheduled_date} at ${appointment.start_time}`);
          stats.appointmentsDeleted++;
        }
      } else {
        // Mark as cancelled (just update status field)
        const { error: updateError } = await supabase
          .from('provider_schedules')
          .update({
            status: 'cancelled'
          })
          .eq('id', appointment.id);

        if (updateError) {
          console.error(`   ❌ Error cancelling appointment: ${updateError.message}`);
          stats.errors++;
        } else {
          console.log(`   ❌ Cancelled appointment: ${appointment.scheduled_date} at ${appointment.start_time}`);
          stats.appointmentsCancelled++;
        }
      }
    }

  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    stats.errors++;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting cancellation processing...');
  console.log(`📁 File: ${csvFilePath}`);
  console.log(`🔧 Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`🗑️  Action: ${shouldDelete ? 'DELETE' : 'MARK AS CANCELLED'}`);
  console.log('');

  const rows = [];

  // Read CSV file
  await new Promise((resolve, reject) => {
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (row) => {
        // Skip title row if exists
        if (row.patientid && row.patientid !== 'REPORT NAME : Tshla schedule') {
          rows.push(row);
        }
      })
      .on('end', resolve)
      .on('error', reject);
  });

  console.log(`📊 Found ${rows.length} cancellation records to process`);
  console.log('');

  // Process each row
  for (let i = 0; i < rows.length; i++) {
    stats.totalRows++;
    await processCancellation(rows[i], i + 1);

    // Add a small delay to avoid overwhelming the database
    if (i % 10 === 0 && i > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Print final statistics
  console.log('\n' + '='.repeat(60));
  console.log('📊 CANCELLATION PROCESSING COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total cancellation records: ${stats.totalRows}`);
  console.log(`Patients found: ${stats.patientsFound}`);
  console.log(`Patients not found: ${stats.patientsNotFound}`);
  console.log(`Appointments cancelled: ${stats.appointmentsCancelled}`);
  console.log(`Appointments deleted: ${stats.appointmentsDeleted}`);
  console.log(`Appointments not found: ${stats.appointmentsNotFound}`);
  console.log(`Errors: ${stats.errors}`);
  console.log('='.repeat(60));

  if (isDryRun) {
    console.log('\n⚠️  This was a DRY RUN. No changes were made to the database.');
    console.log('Remove --dry-run flag to apply changes.');
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
