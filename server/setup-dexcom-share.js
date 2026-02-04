/**
 * Setup Dexcom Share Integration
 * 1. Tests Dexcom Share connection
 * 2. Fetches glucose data from Dexcom Share
 * 3. Syncs glucose data into Supabase cgm_readings table
 * 4. Updates patient config
 *
 * Usage: node server/setup-dexcom-share.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const dexcomShareService = require('./services/dexcomShare.service');
const nightscoutService = require('./services/nightscout.service');
const logger = require('./logger');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PATIENT = {
  phone: '+18326073630',
  name: 'Rakesh Patel',
  dexcomUsername: '+18326073630',
  dexcomPassword: 'Indianswing44$',
  nightscoutUrl: 'https://patelcyfair.nightscoutpro.com',
  nightscoutApiSecret: 'Indianswing44$',
  providerId: 'dr-rakesh-patel',
  providerName: 'Dr. Rakesh Patel',
};

async function run() {
  logger.startup('Dexcom Share Setup');

  // Step 1: Try to add columns using a helper function approach
  logger.info('DexcomSetup', 'Step 1: Adding Dexcom Share columns to database');
  try {
    const createFnResult = await supabase.rpc('add_dexcom_share_columns', {});
    if (createFnResult.error) {
      logger.info('DexcomSetup', 'Migration function not found, trying alternative approach');

      const { error: colTest } = await supabase
        .from('patient_nightscout_config')
        .select('data_source')
        .limit(1);

      if (colTest) {
        logger.warn('DexcomSetup', 'New columns not yet added. Run migration SQL in Supabase SQL Editor');
      } else {
        logger.info('DexcomSetup', 'Columns already exist');
      }
    } else {
      logger.info('DexcomSetup', 'Columns added successfully');
    }
  } catch (err) {
    logger.warn('DexcomSetup', 'Column setup note, continuing anyway', { error: err.message });
  }

  // Step 2: Test Dexcom Share connection
  logger.info('DexcomSetup', 'Step 2: Testing Dexcom Share connection');
  const testResult = await dexcomShareService.testConnection(PATIENT.dexcomUsername, PATIENT.dexcomPassword);
  if (testResult.success) {
    logger.info('DexcomSetup', 'Connection successful', { accountId: testResult.accountId });
  } else {
    logger.error('DexcomSetup', 'Connection failed', { message: testResult.message });
    process.exit(1);
  }

  // Step 3: Fetch current glucose
  logger.info('DexcomSetup', 'Step 3: Fetching current glucose from Dexcom Share');
  const current = await dexcomShareService.getCurrentGlucose(PATIENT.dexcomUsername, PATIENT.dexcomPassword);
  if (current) {
    logger.info('DexcomSetup', 'Current glucose reading', {
      glucose: current.glucoseValue,
      trend: current.trendDirection,
      minutesAgo: current.minutesAgo,
    });
  } else {
    logger.info('DexcomSetup', 'No current glucose reading');
  }

  // Step 4: Fetch 3 days of data
  logger.info('DexcomSetup', 'Step 4: Fetching 3 days of glucose data');
  const entries = await dexcomShareService.getGlucoseReadings(PATIENT.dexcomUsername, PATIENT.dexcomPassword, 4320, 864);
  logger.info('DexcomSetup', 'Readings fetched', { count: entries.length });

  if (entries.length > 0) {
    const values = entries.map(e => e.glucoseValue);
    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const inRange = values.filter(v => v >= 70 && v <= 180).length;
    const tir = Math.round((inRange / values.length) * 100);
    logger.info('DexcomSetup', 'Data summary', { avg, min, max, tir: `${tir}%`, count: entries.length });
  }

  // Step 5: Update patient config
  logger.info('DexcomSetup', 'Step 5: Updating patient config');
  try {
    const encryptedApiSecret = nightscoutService.encryptApiSecret(PATIENT.nightscoutApiSecret);

    const configUpdate = {
      nightscout_url: PATIENT.nightscoutUrl,
      api_secret_encrypted: encryptedApiSecret,
      sync_enabled: true,
      sync_interval_minutes: 15,
      connection_status: 'active',
      last_connection_test_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const configWithDexcom = {
      ...configUpdate,
      data_source: 'dexcom_share',
      dexcom_username: PATIENT.dexcomUsername,
      dexcom_password_encrypted: nightscoutService.encryptApiSecret(PATIENT.dexcomPassword),
    };

    const { data: existing } = await supabase
      .from('patient_nightscout_config')
      .select('id')
      .eq('patient_phone', PATIENT.phone)
      .single();

    if (existing) {
      let { error } = await supabase
        .from('patient_nightscout_config')
        .update(configWithDexcom)
        .eq('patient_phone', PATIENT.phone);

      if (error) {
        logger.info('DexcomSetup', 'New columns not available yet, updating basic config');
        const { error: err2 } = await supabase
          .from('patient_nightscout_config')
          .update(configUpdate)
          .eq('patient_phone', PATIENT.phone);
        if (err2) throw err2;
      }
      logger.info('DexcomSetup', 'Config updated');
    } else {
      logger.warn('DexcomSetup', 'No existing config found');
    }
  } catch (err) {
    logger.error('DexcomSetup', 'Config update error', { error: err.message });
  }

  // Step 6: Sync readings to database
  logger.info('DexcomSetup', 'Step 6: Syncing readings to cgm_readings table', { count: entries.length });
  let syncedCount = 0;
  let errorCount = 0;

  for (const entry of entries) {
    const readingId = `${PATIENT.phone}_${entry.readingTimestamp.getTime()}`;

    const { error } = await supabase
      .from('cgm_readings')
      .upsert(
        {
          patient_phone: PATIENT.phone,
          patient_name: PATIENT.name,
          glucose_value: entry.glucoseValue,
          glucose_units: entry.glucoseUnits,
          trend_direction: entry.trendDirection,
          trend_arrow: entry.trendArrow,
          reading_timestamp: entry.readingTimestamp.toISOString(),
          device_name: 'Dexcom Share',
          nightscout_id: readingId,
          nightscout_url: 'dexcom_share',
        },
        {
          onConflict: 'nightscout_id',
          ignoreDuplicates: true,
        }
      );

    if (error) {
      errorCount++;
      if (errorCount <= 2) logger.error('DexcomSetup', 'Upsert error', { error: error.message });
    } else {
      syncedCount++;
    }
  }

  logger.info('DexcomSetup', 'Sync complete', { synced: syncedCount, errors: errorCount });

  // Update sync timestamp
  await supabase
    .from('patient_nightscout_config')
    .update({
      last_sync_at: new Date().toISOString(),
      last_successful_sync_at: new Date().toISOString(),
      connection_status: 'active',
      sync_error_count: 0,
      last_error: null,
    })
    .eq('patient_phone', PATIENT.phone);

  // Step 7: Verify
  logger.info('DexcomSetup', 'Step 7: Verifying data in database');
  const { data: readings, error: readError } = await supabase
    .from('cgm_readings')
    .select('glucose_value, trend_arrow, reading_timestamp')
    .eq('patient_phone', PATIENT.phone)
    .order('reading_timestamp', { ascending: false })
    .limit(5);

  if (readError) {
    logger.error('DexcomSetup', 'Verification error', { error: readError.message });
  } else if (readings && readings.length > 0) {
    logger.info('DexcomSetup', 'Latest readings verified', { count: readings.length });
  }

  const { count } = await supabase
    .from('cgm_readings')
    .select('*', { count: 'exact', head: true })
    .eq('patient_phone', PATIENT.phone);

  logger.info('DexcomSetup', 'Total readings in database', { count });

  // Calculate stats
  const stats = nightscoutService.calculateStatistics(
    entries.map(e => ({ glucoseValue: e.glucoseValue }))
  );
  logger.info('DexcomSetup', 'Statistics', {
    avgGlucose: stats.avgGlucose,
    tir: stats.timeInRangePercent,
    belowRange: stats.timeBelowRangePercent,
    aboveRange: stats.timeAboveRangePercent,
    estimatedA1c: stats.estimatedA1c,
    lowEvents: stats.lowEventsCount,
    highEvents: stats.highEventsCount,
  });

  logger.info('DexcomSetup', 'Setup complete');
}

run().catch(err => {
  logger.error('DexcomSetup', 'Fatal error', { error: err.message });
  process.exit(1);
});
