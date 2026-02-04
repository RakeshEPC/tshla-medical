/**
 * CGM Auto-Sync Job
 * Runs on an interval to sync all patients' CGM data from Dexcom Share into Supabase
 *
 * Created: 2026-02-03
 */

const cgmSyncService = require('../services/cgmSync.service');
const logger = require('../logger');

const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
let intervalHandle = null;

async function runSync() {
  try {
    logger.info('CGMSync', 'Starting scheduled CGM sync for all patients');
    const result = await cgmSyncService.syncAllPatients();
    logger.info('CGMSync', 'Scheduled sync completed', {
      synced: result.synced,
      patients: result.patients,
      total: result.total,
    });
  } catch (error) {
    logger.error('CGMSync', 'Scheduled sync failed', { error: error.message });
  }
}

function start() {
  if (intervalHandle) return;
  logger.info('CGMSync', `Auto-sync started (every ${SYNC_INTERVAL_MS / 60000} minutes)`);
  intervalHandle = setInterval(runSync, SYNC_INTERVAL_MS);
  // Run first sync after a short delay to let the server finish starting
  setTimeout(runSync, 10000);
}

function stop() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    logger.info('CGMSync', 'Auto-sync stopped');
  }
}

module.exports = { start, stop };
