/**
 * Nightly Patient Status Job
 *
 * Computes daily status for all portal-enabled patients using the
 * PatientStatusEngine. This powers the HOME screen of the patient portal.
 *
 * Runs:
 * - Automatically at 4:00 AM daily (configurable)
 * - Can be triggered manually via CLI: node nightly-patient-status.js --run
 * - Can target a specific patient: node nightly-patient-status.js --patient=TSH123456
 *
 * Created: 2026-02-06
 */

const patientStatusEngine = require('../services/patientStatusEngine.service');
const { createClient } = require('@supabase/supabase-js');
const logger = require('../logger');

// Initialize Supabase for patient lookup
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configuration
const NIGHTLY_HOUR = 4; // 4:00 AM local time
const NIGHTLY_MINUTE = 0;
let scheduledTimeout = null;

/**
 * Run the nightly job for all patients
 */
async function runNightlyJob() {
  const startTime = Date.now();
  logger.info('NightlyPatientStatus', '=== Starting nightly patient status computation ===');

  try {
    const result = await patientStatusEngine.computeAllPatientStatuses();

    const duration = Math.round((Date.now() - startTime) / 1000);
    logger.info('NightlyPatientStatus', '=== Nightly job completed ===', {
      totalPatients: result.total,
      successful: result.success,
      errors: result.errors,
      durationSeconds: duration
    });

    return result;

  } catch (error) {
    logger.error('NightlyPatientStatus', 'Nightly job failed', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Run status computation for a specific patient
 * @param {string} tshlaId - Patient TSH ID (e.g., "TSH 123-456" or "TSH123456")
 */
async function runForPatient(tshlaId) {
  logger.info('NightlyPatientStatus', `Computing status for patient: ${tshlaId}`);

  try {
    // Normalize TSH ID
    const normalizedId = tshlaId.replace(/[\s-]/g, '').toUpperCase();
    const formattedId = normalizedId.replace(/^TSH(\d{3})(\d{3})$/, 'TSH $1-$2');

    // Look up patient
    const { data: patient, error } = await supabase
      .from('unified_patients')
      .select('id, tshla_id, first_name, last_name')
      .or(`tshla_id.eq.${normalizedId},tshla_id.eq.${formattedId}`)
      .single();

    if (error || !patient) {
      throw new Error(`Patient not found: ${tshlaId}`);
    }

    logger.info('NightlyPatientStatus', `Found patient: ${patient.first_name} ${patient.last_name}`);

    const status = await patientStatusEngine.computePatientStatus(patient.id);

    logger.info('NightlyPatientStatus', 'Status computed successfully', {
      patientId: patient.id,
      tshlaId: patient.tshla_id,
      statusType: status.status_type,
      headline: status.status_headline
    });

    return status;

  } catch (error) {
    logger.error('NightlyPatientStatus', `Failed for patient ${tshlaId}`, {
      error: error.message
    });
    throw error;
  }
}

/**
 * Calculate milliseconds until next scheduled run
 */
function getMillisUntilNextRun() {
  const now = new Date();
  const next = new Date();

  next.setHours(NIGHTLY_HOUR, NIGHTLY_MINUTE, 0, 0);

  // If the time has passed today, schedule for tomorrow
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  return next.getTime() - now.getTime();
}

/**
 * Schedule the next run and set up recurring schedule
 */
function scheduleNextRun() {
  const msUntilNext = getMillisUntilNextRun();
  const nextRunTime = new Date(Date.now() + msUntilNext);

  logger.info('NightlyPatientStatus', `Next run scheduled for ${nextRunTime.toLocaleString()}`);

  scheduledTimeout = setTimeout(async () => {
    await runNightlyJob();
    scheduleNextRun(); // Schedule the next one
  }, msUntilNext);
}

/**
 * Start the scheduled job
 */
function start() {
  if (scheduledTimeout) {
    logger.warn('NightlyPatientStatus', 'Job already scheduled, skipping');
    return;
  }

  logger.info('NightlyPatientStatus', `Nightly job scheduler started (runs at ${NIGHTLY_HOUR}:${String(NIGHTLY_MINUTE).padStart(2, '0')} daily)`);
  scheduleNextRun();
}

/**
 * Stop the scheduled job
 */
function stop() {
  if (scheduledTimeout) {
    clearTimeout(scheduledTimeout);
    scheduledTimeout = null;
    logger.info('NightlyPatientStatus', 'Nightly job scheduler stopped');
  }
}

// CLI Support
if (require.main === module) {
  const args = process.argv.slice(2);

  // Load environment if running standalone
  require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

  const runMode = args.find(a => a === '--run' || a === '-r');
  const patientArg = args.find(a => a.startsWith('--patient='));

  (async () => {
    try {
      if (patientArg) {
        // Run for specific patient
        const tshlaId = patientArg.split('=')[1];
        const result = await runForPatient(tshlaId);
        logger.info('NightlyPatientStatus', 'CLI: Status computed successfully', { result });
        process.stdout.write('\n✅ Status computed successfully:\n');
        process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      } else if (runMode) {
        // Run for all patients
        const result = await runNightlyJob();
        logger.info('NightlyPatientStatus', 'CLI: Nightly job completed', result);
        process.stdout.write('\n✅ Nightly job completed:\n');
        process.stdout.write(`   Total patients: ${result.total}\n`);
        process.stdout.write(`   Successful: ${result.success}\n`);
        process.stdout.write(`   Errors: ${result.errors}\n`);
      } else {
        // Show usage
        process.stdout.write(`
Nightly Patient Status Job
==========================

Usage:
  node nightly-patient-status.js --run              Run for all portal patients
  node nightly-patient-status.js --patient=TSH123456  Run for specific patient

Options:
  --run, -r          Run the nightly job immediately
  --patient=ID       Compute status for a specific patient (by TSH ID)

Examples:
  node nightly-patient-status.js --run
  node nightly-patient-status.js --patient="TSH 123-456"
  node nightly-patient-status.js --patient=TSH123456
\n`);
      }
      process.exit(0);
    } catch (error) {
      logger.error('NightlyPatientStatus', 'CLI: Error', { error: error.message });
      process.stderr.write('\n❌ Error: ' + error.message + '\n');
      process.exit(1);
    }
  })();
}

module.exports = { start, stop, runNightlyJob, runForPatient };
