/**
 * CGM Data API Routes
 * Dexcom Share + Nightscout integration endpoints
 *
 * Routes:
 * - POST /api/cgm/config - Configure CGM data source for a patient
 * - GET /api/cgm/config/:phone - Get patient's CGM config
 * - POST /api/cgm/test-connection - Test connection (Nightscout or Dexcom Share)
 * - GET /api/cgm/current/:phone - Get current glucose reading
 * - GET /api/cgm/readings/:phone - Get recent glucose readings
 * - GET /api/cgm/stats/:phone - Get glucose statistics
 * - POST /api/cgm/sync/:phone - Manually trigger sync for a patient
 * - GET /api/cgm/dexcom-live/:phone - Get live data directly from Dexcom Share
 *
 * Created: 2026-02-02
 * Updated: 2026-02-03 - Added direct Dexcom Share support, phone normalization
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const logger = require('../logger');
const nightscoutService = require('../services/nightscout.service');
const dexcomShareService = require('../services/dexcomShare.service');
const cgmSyncService = require('../services/cgmSync.service');
const cgmPatternsService = require('../services/cgmPatterns.service');
const patientMatchingService = require('../services/patientMatching.service');
const { toNormalized, toE164, allFormats } = require('../utils/phoneNormalize');

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Helper: find config by phone in any format
 */
async function findConfigByPhone(phone) {
  const formats = allFormats(phone);
  if (formats.length === 0) return null;

  const orFilter = formats.map(f => `patient_phone.eq.${f}`).join(',');
  const { data } = await supabase
    .from('patient_nightscout_config')
    .select('*')
    .or(orFilter)
    .limit(1)
    .single();

  return data;
}

/**
 * Helper: find readings by phone in any format
 */
function readingsQuery(phone) {
  const formats = allFormats(phone);
  const orFilter = formats.map(f => `patient_phone.eq.${f}`).join(',');
  return orFilter;
}

/**
 * POST /api/cgm/config
 * Configure CGM data source for a patient
 */
router.post('/config', async (req, res) => {
  try {
    const {
      patientPhone,
      patientMrn,
      patientName,
      nightscoutUrl,
      apiSecret,
      dexcomUsername,
      dexcomPassword,
      dataSource = 'dexcom_share',
      providerId,
      providerName,
      syncEnabled = true,
      syncIntervalMinutes = 15,
      cgmDeviceBrand,
      configuredBy = 'provider',
    } = req.body;

    if (!patientPhone) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: patientPhone',
      });
    }

    // Basic session validation for patient self-service
    if (configuredBy === 'patient') {
      const sessionId = req.headers['x-session-id'];
      if (!sessionId) {
        return res.status(401).json({
          success: false,
          error: 'Patient session required. Please log in to the patient portal.',
        });
      }
    }

    // Test connection based on data source
    if (dataSource === 'dexcom_share') {
      if (!dexcomUsername || !dexcomPassword) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: dexcomUsername, dexcomPassword',
        });
      }
      const test = await dexcomShareService.testConnection(dexcomUsername, dexcomPassword);
      if (!test.success) {
        return res.status(400).json({ success: false, error: test.message });
      }
    } else {
      if (!nightscoutUrl || !apiSecret) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: nightscoutUrl, apiSecret',
        });
      }
      const test = await nightscoutService.testConnection(nightscoutUrl, apiSecret);
      if (!test.success) {
        return res.status(400).json({ success: false, error: test.message });
      }
    }

    // Resolve unified_patient_id
    const phoneNormalized = toNormalized(patientPhone);
    let unifiedPatientId = null;
    if (phoneNormalized) {
      const { data: patient } = await supabase
        .from('unified_patients')
        .select('id')
        .eq('phone_primary', phoneNormalized)
        .single();
      if (patient) unifiedPatientId = patient.id;
    }

    // Build config record
    const configRecord = {
      patient_phone: patientPhone,
      patient_mrn: patientMrn,
      patient_name: patientName,
      sync_enabled: syncEnabled,
      sync_interval_minutes: syncIntervalMinutes,
      connection_status: 'active',
      last_connection_test_at: new Date().toISOString(),
      provider_id: providerId,
      configured_by_provider_name: providerName,
      data_source: dataSource,
      cgm_device_brand: cgmDeviceBrand || null,
      configured_by: configuredBy,
    };

    if (unifiedPatientId) configRecord.unified_patient_id = unifiedPatientId;

    if (dataSource === 'dexcom_share') {
      configRecord.dexcom_username = dexcomUsername;
      configRecord.dexcom_password_encrypted = nightscoutService.encryptApiSecret(dexcomPassword);
    }
    if (nightscoutUrl) {
      configRecord.nightscout_url = nightscoutService.normalizeNightscoutUrl(nightscoutUrl);
    }
    if (apiSecret) {
      configRecord.api_secret_encrypted = nightscoutService.encryptApiSecret(apiSecret);
    }

    // Upsert config
    const existingConfig = await findConfigByPhone(patientPhone);
    let result;

    if (existingConfig) {
      configRecord.updated_at = new Date().toISOString();
      const { data, error } = await supabase
        .from('patient_nightscout_config')
        .update(configRecord)
        .eq('id', existingConfig.id)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from('patient_nightscout_config')
        .insert(configRecord)
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    // Trigger initial sync with backfill (pulls 14 days of history)
    try {
      await cgmSyncService.syncPatientData(patientPhone, { backfill: true });
    } catch (syncError) {
      logger.warn('CGM', 'Initial sync failed', { error: syncError.message });
    }

    res.json({
      success: true,
      message: `CGM configured successfully (source: ${dataSource})`,
      config: {
        id: result.id,
        patientPhone: result.patient_phone,
        dataSource: result.data_source,
        nightscoutUrl: result.nightscout_url,
        syncEnabled: result.sync_enabled,
        connectionStatus: result.connection_status,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to configure CGM',
      details: error.message,
    });
  }
});

/**
 * GET /api/cgm/config/:phone
 */
router.get('/config/:phone', async (req, res) => {
  try {
    const config = await findConfigByPhone(req.params.phone);

    if (!config) {
      return res.json({ success: true, configured: false });
    }

    // Don't return encrypted fields
    const { api_secret_encrypted, dexcom_password_encrypted, ...safeConfig } = config;
    res.json({ success: true, configured: true, config: safeConfig });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch configuration' });
  }
});

/**
 * GET /api/cgm/summary/:phone
 * Get full CGM summary: config status, current glucose, 14-day stats, visit comparison
 */
router.get('/summary/:phone', async (req, res) => {
  try {
    const phone = req.params.phone;
    const config = await findConfigByPhone(phone);

    if (!config) {
      return res.json({ success: true, summary: { configured: false } });
    }

    // Resolve unified_patient_id for visit comparison
    const phoneNormalized = toNormalized(phone);
    let patientId = config.unified_patient_id || null;
    if (!patientId && phoneNormalized) {
      const { data: patient } = await supabase
        .from('unified_patients')
        .select('id')
        .eq('phone_primary', phoneNormalized)
        .single();
      if (patient) patientId = patient.id;
    }

    const summary = await patientMatchingService.getCGMSummary(patientId, phoneNormalized || phone);
    res.json({ success: true, summary: summary || { configured: false } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch CGM summary', details: error.message });
  }
});

/**
 * POST /api/cgm/test-connection
 */
router.post('/test-connection', async (req, res) => {
  try {
    const { nightscoutUrl, apiSecret, dexcomUsername, dexcomPassword, dataSource = 'dexcom_share' } = req.body;

    let result;
    if (dataSource === 'dexcom_share') {
      if (!dexcomUsername || !dexcomPassword) {
        return res.status(400).json({ success: false, error: 'Missing: dexcomUsername, dexcomPassword' });
      }
      result = await dexcomShareService.testConnection(dexcomUsername, dexcomPassword);
    } else {
      if (!nightscoutUrl || !apiSecret) {
        return res.status(400).json({ success: false, error: 'Missing: nightscoutUrl, apiSecret' });
      }
      result = await nightscoutService.testConnection(nightscoutUrl, apiSecret);
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Connection test failed', details: error.message });
  }
});

/**
 * GET /api/cgm/current/:phone
 * Get current glucose reading (live from Dexcom Share)
 */
router.get('/current/:phone', async (req, res) => {
  try {
    const config = await findConfigByPhone(req.params.phone);

    if (!config) {
      return res.status(404).json({ success: false, error: 'Patient CGM not configured' });
    }

    let currentGlucose = null;

    if (config.data_source === 'dexcom_share' && config.dexcom_username && config.dexcom_password_encrypted) {
      const dexcomPassword = nightscoutService.decryptApiSecret(config.dexcom_password_encrypted);
      currentGlucose = await dexcomShareService.getCurrentGlucose(config.dexcom_username, dexcomPassword);
    } else if (config.nightscout_url && config.api_secret_encrypted) {
      const apiSecret = nightscoutService.decryptApiSecret(config.api_secret_encrypted);
      currentGlucose = await nightscoutService.getCurrentGlucose(config.nightscout_url, apiSecret);
    }

    if (!currentGlucose) {
      return res.json({ success: true, current: null, message: 'No recent glucose readings found' });
    }

    res.json({ success: true, current: currentGlucose });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch current glucose', details: error.message });
  }
});

/**
 * GET /api/cgm/readings/:phone
 * Get recent glucose readings from database
 */
router.get('/readings/:phone', async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    const orFilter = readingsQuery(req.params.phone);

    const { data: readings, error } = await supabase
      .from('cgm_readings')
      .select('*')
      .or(orFilter)
      .gte('reading_timestamp', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
      .order('reading_timestamp', { ascending: false });

    if (error) throw error;

    res.json({ success: true, readings: readings || [], count: readings?.length || 0 });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch readings' });
  }
});

/**
 * GET /api/cgm/stats/:phone
 * Get glucose statistics
 */
router.get('/stats/:phone', async (req, res) => {
  try {
    const { days = 14 } = req.query;
    const orFilter = readingsQuery(req.params.phone);

    const { data: readings, error } = await supabase
      .from('cgm_readings')
      .select('glucose_value')
      .or(orFilter)
      .gte('reading_timestamp', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .order('reading_timestamp', { ascending: false });

    if (error) throw error;

    const stats = nightscoutService.calculateStatistics(
      readings.map(r => ({ glucoseValue: r.glucose_value }))
    );

    res.json({ success: true, stats, period: `Last ${days} days` });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to calculate statistics' });
  }
});

/**
 * GET /api/cgm/dexcom-live/:phone
 * Get live glucose data directly from Dexcom Share
 */
router.get('/dexcom-live/:phone', async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    const config = await findConfigByPhone(req.params.phone);

    if (!config) {
      return res.status(404).json({ success: false, error: 'Patient CGM not configured' });
    }
    if (!config.dexcom_username || !config.dexcom_password_encrypted) {
      return res.status(400).json({ success: false, error: 'Dexcom Share credentials not configured' });
    }

    const dexcomPassword = nightscoutService.decryptApiSecret(config.dexcom_password_encrypted);
    const readings = await dexcomShareService.getGlucoseReadings(
      config.dexcom_username, dexcomPassword, hours * 60, hours * 12
    );

    const stats = nightscoutService.calculateStatistics(readings);

    res.json({ success: true, readings, count: readings.length, stats, source: 'dexcom_share_live' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch Dexcom Share data', details: error.message });
  }
});

/**
 * POST /api/cgm/sync/:phone
 * Manually trigger sync
 */
router.post('/sync/:phone', async (req, res) => {
  try {
    const result = await cgmSyncService.syncPatientData(req.params.phone);
    res.json({ success: true, message: 'Sync completed successfully', ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Sync failed', details: error.message });
  }
});

/**
 * POST /api/cgm/backfill/:phone
 * Pull up to 14 days of historical data from Dexcom Share
 */
router.post('/backfill/:phone', async (req, res) => {
  try {
    const result = await cgmSyncService.syncPatientData(req.params.phone, { backfill: true });
    res.json({ success: true, message: `Backfill complete: ${result.synced} new readings from up to 14 days`, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Backfill failed', details: error.message });
  }
});

/**
 * GET /api/cgm/patterns/:phone
 * Detect recurring glucose patterns for a patient
 */
router.get('/patterns/:phone', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 14;
    const patterns = await cgmPatternsService.detectPatterns(req.params.phone, days);
    res.json({ success: true, patterns, count: patterns.length });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Pattern detection failed', details: error.message });
  }
});

/**
 * GET /api/cgm/events/:phone
 * Get logged events (meals, insulin, exercise, notes) for a patient
 */
router.get('/events/:phone', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const phones = allFormats(req.params.phone);

    const { data, error } = await supabase
      .from('cgm_events')
      .select('*')
      .or(phones.map(p => `patient_phone.eq.${p}`).join(','))
      .gte('event_timestamp', since)
      .order('event_timestamp', { ascending: false });

    if (error) throw error;
    res.json({ success: true, events: data || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch events', details: error.message });
  }
});

/**
 * POST /api/cgm/events
 * Log a new event (meal, insulin, exercise, note)
 */
router.post('/events', async (req, res) => {
  try {
    const { patient_phone, event_type, event_timestamp, ...fields } = req.body;
    if (!patient_phone || !event_type) {
      return res.status(400).json({ success: false, error: 'patient_phone and event_type are required' });
    }

    const record = {
      patient_phone: toE164(patient_phone),
      event_type,
      event_timestamp: event_timestamp || new Date().toISOString(),
      ...fields,
    };

    const { data, error } = await supabase.from('cgm_events').insert(record).select().single();
    if (error) throw error;
    res.json({ success: true, event: data });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to log event', details: error.message });
  }
});

/**
 * DELETE /api/cgm/events/:id
 * Delete a logged event
 */
router.delete('/events/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('cgm_events').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete event', details: error.message });
  }
});

/**
 * GET /api/cgm/panel
 * Get all CGM-connected patients for provider triage dashboard
 */
router.get('/panel', async (req, res) => {
  try {
    // Get all configured CGM patients
    const { data: configs, error: cfgErr } = await supabase
      .from('patient_nightscout_config')
      .select('patient_phone, patient_name, unified_patient_id, data_source, connection_status, sync_enabled, last_sync_at')
      .eq('connection_status', 'active');

    if (cfgErr) throw cfgErr;
    if (!configs || configs.length === 0) {
      return res.json({ success: true, patients: [] });
    }

    const patients = [];

    for (const config of configs) {
      const phones = allFormats(config.patient_phone);

      // Get latest reading
      const { data: latestReading } = await supabase
        .from('cgm_readings')
        .select('glucose_value, trend_direction, trend_arrow, reading_timestamp')
        .or(phones.map(p => `patient_phone.eq.${p}`).join(','))
        .order('reading_timestamp', { ascending: false })
        .limit(1)
        .single();

      // Get 14-day stats
      const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const { data: readings14d } = await supabase
        .from('cgm_readings')
        .select('glucose_value')
        .or(phones.map(p => `patient_phone.eq.${p}`).join(','))
        .gte('reading_timestamp', since14d);

      let stats14day = null;
      if (readings14d && readings14d.length > 0) {
        const values = readings14d.map(r => r.glucose_value);
        const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
        const inRange = values.filter(v => v >= 70 && v <= 180).length;
        const tir = Math.round((inRange / values.length) * 100);
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
        const cv = Math.round((Math.sqrt(variance) / mean) * 100);
        const gmi = Math.round((3.31 + 0.02392 * avg) * 10) / 10;

        stats14day = { avgGlucose: avg, timeInRangePercent: tir, estimatedA1c: gmi, cv };
      }

      // Get pattern count
      const patterns = await cgmPatternsService.detectPatterns(config.patient_phone, 14);

      // Risk scoring
      let riskScore = 'low';
      if (stats14day) {
        const urgentLows = readings14d?.filter(r => r.glucose_value < 54).length || 0;
        if (stats14day.timeInRangePercent < 50 || urgentLows > 0 || stats14day.cv > 40) {
          riskScore = 'high';
        } else if (stats14day.timeInRangePercent < 70 || stats14day.cv > 33) {
          riskScore = 'medium';
        }
      }

      const currentGlucose = latestReading ? {
        value: latestReading.glucose_value,
        trend: latestReading.trend_arrow,
        minutesAgo: Math.round((Date.now() - new Date(latestReading.reading_timestamp).getTime()) / 60000),
      } : null;

      patients.push({
        patientPhone: config.patient_phone,
        patientName: config.patient_name,
        unifiedPatientId: config.unified_patient_id,
        dataSource: config.data_source,
        connectionStatus: config.connection_status,
        lastSync: config.last_sync_at,
        currentGlucose,
        stats14day,
        patternCount: patterns.length,
        riskScore,
      });
    }

    // Sort by risk (high first), then TIR ascending
    const riskOrder = { high: 0, medium: 1, low: 2 };
    patients.sort((a, b) => {
      const riskDiff = (riskOrder[a.riskScore] || 2) - (riskOrder[b.riskScore] || 2);
      if (riskDiff !== 0) return riskDiff;
      return (a.stats14day?.timeInRangePercent || 100) - (b.stats14day?.timeInRangePercent || 100);
    });

    res.json({ success: true, patients });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch panel data', details: error.message });
  }
});

module.exports = router;
