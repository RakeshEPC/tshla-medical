/**
 * CGM Sync Service
 * Shared logic for syncing CGM data from Dexcom Share into Supabase
 * Used by both the API route (manual sync) and the scheduled job (auto sync)
 *
 * Created: 2026-02-03
 */

const { createClient } = require('@supabase/supabase-js');
const dexcomShareService = require('./dexcomShare.service');
const nightscoutService = require('./nightscout.service');
const libreLinkUpService = require('./libreLinkUp.service');
const { toNormalized, toE164 } = require('../utils/phoneNormalize');
const logger = require('../logger');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

class CGMSyncService {
  /**
   * Sync a single patient's CGM data from Dexcom Share (or Nightscout) into Supabase
   * @param {string} patientPhone - Phone in any format
   * @param {Object} options
   * @param {boolean} options.backfill - If true, pull 14 days instead of 3 days
   * @returns {Promise<{synced: number, total: number}>}
   */
  async syncPatientData(patientPhone, { backfill = false } = {}) {
    const phoneE164 = toE164(patientPhone);
    const phoneNormalized = toNormalized(patientPhone);

    // Find config using either phone format
    const { data: config, error: configError } = await supabase
      .from('patient_nightscout_config')
      .select('*')
      .or(`patient_phone.eq.${phoneE164},patient_phone.eq.${phoneNormalized}`)
      .limit(1)
      .single();

    if (configError || !config) {
      throw new Error('Patient CGM not configured');
    }

    if (!config.sync_enabled) {
      return { synced: 0, total: 0, message: 'Sync disabled' };
    }

    // Resolve unified_patient_id if not already linked
    let unifiedPatientId = config.unified_patient_id;
    if (!unifiedPatientId && phoneNormalized) {
      const { data: patient } = await supabase
        .from('unified_patients')
        .select('id')
        .eq('phone_primary', phoneNormalized)
        .single();

      if (patient) {
        unifiedPatientId = patient.id;
        await supabase
          .from('patient_nightscout_config')
          .update({ unified_patient_id: unifiedPatientId })
          .eq('id', config.id);
      }
    }

    try {
      let entries = [];

      // Try Dexcom Share first
      if (config.dexcom_username && config.dexcom_password_encrypted) {
        const dexcomPassword = nightscoutService.decryptApiSecret(config.dexcom_password_encrypted);
        const minutes = backfill ? 20160 : 4320;  // 14 days vs 3 days
        const maxCount = backfill ? 4032 : 864;
        entries = await dexcomShareService.getGlucoseReadings(config.dexcom_username, dexcomPassword, minutes, maxCount);
      }
      // Try LibreLinkUp (FreeStyle Libre direct)
      else if (config.libre_linkup_email && config.libre_linkup_password_encrypted) {
        const librePassword = nightscoutService.decryptApiSecret(config.libre_linkup_password_encrypted);
        entries = await libreLinkUpService.getGlucoseReadings(
          config.libre_linkup_email, librePassword, config.libre_linkup_region || 'US'
        );
      }
      // Fall back to Nightscout
      else if (config.nightscout_url && config.api_secret_encrypted) {
        const apiSecret = nightscoutService.decryptApiSecret(config.api_secret_encrypted);
        entries = await nightscoutService.getGlucoseEntries(config.nightscout_url, apiSecret, 24);
      } else {
        throw new Error('No data source configured');
      }

      if (entries.length === 0) {
        await supabase
          .from('patient_nightscout_config')
          .update({
            last_sync_at: new Date().toISOString(),
            connection_status: 'active',
            last_error: 'No readings available from source',
          })
          .eq('id', config.id);

        return { synced: 0, total: 0, message: 'No readings available' };
      }

      // Insert readings
      let insertedCount = 0;
      for (const entry of entries) {
        const readingId = entry.nightscoutId || `${config.patient_phone}_${entry.readingTimestamp.getTime()}`;

        const record = {
          patient_phone: config.patient_phone,
          patient_mrn: config.patient_mrn,
          patient_name: config.patient_name,
          glucose_value: entry.glucoseValue,
          glucose_units: entry.glucoseUnits,
          trend_direction: entry.trendDirection,
          trend_arrow: entry.trendArrow,
          reading_timestamp: entry.readingTimestamp.toISOString(),
          device_name: entry.deviceName || (entry.source === 'libre_linkup' ? 'FreeStyle Libre' : 'Dexcom Share'),
          nightscout_id: readingId,
          nightscout_url: config.nightscout_url || entry.source || 'dexcom_share',
        };

        if (unifiedPatientId) {
          record.unified_patient_id = unifiedPatientId;
        }

        const { error } = await supabase
          .from('cgm_readings')
          .upsert(record, { onConflict: 'nightscout_id', ignoreDuplicates: true });

        if (!error) insertedCount++;
      }

      // Update sync status
      await supabase
        .from('patient_nightscout_config')
        .update({
          last_sync_at: new Date().toISOString(),
          last_successful_sync_at: new Date().toISOString(),
          connection_status: 'active',
          sync_error_count: 0,
          last_error: null,
        })
        .eq('id', config.id);

      return { synced: insertedCount, total: entries.length };

    } catch (error) {
      const errorCount = (config.sync_error_count || 0) + 1;
      const errorMsg = error.message || '';

      // Determine error type and appropriate status
      const isAuthError = errorMsg.includes('auth') ||
                          errorMsg.includes('unauthorized') ||
                          errorMsg.includes('invalid') ||
                          errorMsg.includes('401') ||
                          errorMsg.includes('credentials');

      // Graduated error handling:
      // - Auth errors immediately set 'unauthorized' (needs user action)
      // - Transient errors keep 'active' for first 2 failures
      // - 3+ consecutive failures set 'error'
      let newStatus = config.connection_status;
      if (isAuthError) {
        newStatus = 'unauthorized';
      } else if (errorCount >= 3) {
        newStatus = 'error';
      }
      // Otherwise keep current status (likely 'active') for transient failures

      await supabase
        .from('patient_nightscout_config')
        .update({
          last_sync_at: new Date().toISOString(),
          connection_status: newStatus,
          sync_error_count: errorCount,
          last_error: errorMsg,
        })
        .eq('id', config.id);

      throw error;
    }
  }

  /**
   * Sync all patients with sync_enabled = true
   */
  async syncAllPatients() {
    const { data: configs } = await supabase
      .from('patient_nightscout_config')
      .select('patient_phone, patient_name')
      .eq('sync_enabled', true)
      .in('connection_status', ['active', 'error']);

    if (!configs || configs.length === 0) return { synced: 0, patients: 0 };

    let totalSynced = 0;
    let successCount = 0;

    for (const config of configs) {
      try {
        const result = await this.syncPatientData(config.patient_phone);
        totalSynced += result.synced;
        successCount++;
      } catch (err) {
        logger.error('CGMSync', 'Sync failed for patient', { error: err.message });
      }
    }

    return { synced: totalSynced, patients: successCount, total: configs.length };
  }
}

module.exports = new CGMSyncService();
