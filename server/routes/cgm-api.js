/**
 * CGM Data API Routes
 * Nightscout integration endpoints
 *
 * Routes:
 * - POST /api/cgm/config - Configure Nightscout for a patient
 * - GET /api/cgm/config/:phone - Get patient's Nightscout config
 * - POST /api/cgm/test-connection - Test Nightscout connection
 * - GET /api/cgm/current/:phone - Get current glucose reading
 * - GET /api/cgm/readings/:phone - Get recent glucose readings
 * - GET /api/cgm/stats/:phone - Get glucose statistics
 * - POST /api/cgm/sync/:phone - Manually trigger sync for a patient
 *
 * Created: 2026-02-02
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const nightscoutService = require('../services/nightscout.service');

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/cgm/config
 * Configure Nightscout connection for a patient
 */
router.post('/config', async (req, res) => {
  try {
    const {
      patientPhone,
      patientMrn,
      patientName,
      nightscoutUrl,
      apiSecret,
      providerId,
      providerName,
      syncEnabled = true,
      syncIntervalMinutes = 15,
    } = req.body;


    // Validate required fields
    if (!patientPhone || !nightscoutUrl || !apiSecret) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: patientPhone, nightscoutUrl, apiSecret',
      });
    }

    // Test connection first
    const connectionTest = await nightscoutService.testConnection(nightscoutUrl, apiSecret);
    if (!connectionTest.success) {
      return res.status(400).json({
        success: false,
        error: connectionTest.message,
      });
    }

    // Encrypt API secret
    const encryptedSecret = nightscoutService.encryptApiSecret(apiSecret);
    const normalizedUrl = nightscoutService.normalizeNightscoutUrl(nightscoutUrl);

    // Check if config already exists
    const { data: existingConfig } = await supabase
      .from('patient_nightscout_config')
      .select('*')
      .eq('patient_phone', patientPhone)
      .single();

    let result;

    if (existingConfig) {
      // Update existing config
      const { data, error } = await supabase
        .from('patient_nightscout_config')
        .update({
          nightscout_url: normalizedUrl,
          api_secret_encrypted: encryptedSecret,
          sync_enabled: syncEnabled,
          sync_interval_minutes: syncIntervalMinutes,
          connection_status: 'active',
          last_connection_test_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          patient_mrn: patientMrn,
          patient_name: patientName,
          provider_id: providerId,
          configured_by_provider_name: providerName,
        })
        .eq('patient_phone', patientPhone)
        .select()
        .single();

      if (error) throw error;
      result = data;

    } else {
      // Insert new config
      const { data, error } = await supabase
        .from('patient_nightscout_config')
        .insert({
          patient_phone: patientPhone,
          patient_mrn: patientMrn,
          patient_name: patientName,
          nightscout_url: normalizedUrl,
          api_secret_encrypted: encryptedSecret,
          sync_enabled: syncEnabled,
          sync_interval_minutes: syncIntervalMinutes,
          connection_status: 'active',
          last_connection_test_at: new Date().toISOString(),
          provider_id: providerId,
          configured_by_provider_name: providerName,
        })
        .select()
        .single();

      if (error) throw error;
      result = data;

    }

    // Trigger initial sync
    try {
      await syncPatientData(patientPhone);
    } catch (syncError) {
    }

    res.json({
      success: true,
      message: 'Nightscout configured successfully',
      config: {
        id: result.id,
        patientPhone: result.patient_phone,
        nightscoutUrl: result.nightscout_url,
        syncEnabled: result.sync_enabled,
        connectionStatus: result.connection_status,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to configure Nightscout',
      details: error.message,
    });
  }
});

/**
 * GET /api/cgm/config/:phone
 * Get patient's Nightscout configuration
 */
router.get('/config/:phone', async (req, res) => {
  try {
    const { phone } = req.params;

    const { data, error } = await supabase
      .from('patient_nightscout_config')
      .select('id, patient_phone, patient_mrn, patient_name, nightscout_url, sync_enabled, sync_interval_minutes, connection_status, last_sync_at, last_successful_sync_at, last_error, created_at, updated_at')
      .eq('patient_phone', phone)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No config found
        return res.json({
          success: true,
          configured: false,
        });
      }
      throw error;
    }

    res.json({
      success: true,
      configured: true,
      config: data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch configuration',
    });
  }
});

/**
 * POST /api/cgm/test-connection
 * Test Nightscout connection without saving
 */
router.post('/test-connection', async (req, res) => {
  try {
    const { nightscoutUrl, apiSecret } = req.body;

    if (!nightscoutUrl || !apiSecret) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: nightscoutUrl, apiSecret',
      });
    }

    const result = await nightscoutService.testConnection(nightscoutUrl, apiSecret);

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Connection test failed',
      details: error.message,
    });
  }
});

/**
 * GET /api/cgm/current/:phone
 * Get current (most recent) glucose reading for a patient
 */
router.get('/current/:phone', async (req, res) => {
  try {
    const { phone } = req.params;

    // Get patient's config
    const { data: config, error: configError } = await supabase
      .from('patient_nightscout_config')
      .select('*')
      .eq('patient_phone', phone)
      .single();

    if (configError || !config) {
      return res.status(404).json({
        success: false,
        error: 'Patient Nightscout not configured',
      });
    }

    // Decrypt API secret
    const apiSecret = nightscoutService.decryptApiSecret(config.api_secret_encrypted);

    // Fetch current glucose
    const currentGlucose = await nightscoutService.getCurrentGlucose(config.nightscout_url, apiSecret);

    if (!currentGlucose) {
      return res.json({
        success: true,
        current: null,
        message: 'No recent glucose readings found',
      });
    }

    res.json({
      success: true,
      current: currentGlucose,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch current glucose',
    });
  }
});

/**
 * GET /api/cgm/readings/:phone
 * Get recent glucose readings for a patient
 */
router.get('/readings/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const { hours = 24 } = req.query;

    // Get from database
    const { data: readings, error } = await supabase
      .from('cgm_readings')
      .select('*')
      .eq('patient_phone', phone)
      .gte('reading_timestamp', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
      .order('reading_timestamp', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      readings: readings || [],
      count: readings?.length || 0,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch readings',
    });
  }
});

/**
 * GET /api/cgm/stats/:phone
 * Get glucose statistics for a patient
 */
router.get('/stats/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const { days = 14 } = req.query;

    // Get readings from database
    const { data: readings, error } = await supabase
      .from('cgm_readings')
      .select('glucose_value')
      .eq('patient_phone', phone)
      .gte('reading_timestamp', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .order('reading_timestamp', { ascending: false });

    if (error) throw error;

    // Calculate statistics
    const stats = nightscoutService.calculateStatistics(
      readings.map(r => ({ glucoseValue: r.glucose_value }))
    );

    res.json({
      success: true,
      stats,
      period: `Last ${days} days`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to calculate statistics',
    });
  }
});

/**
 * POST /api/cgm/sync/:phone
 * Manually trigger sync for a patient
 */
router.post('/sync/:phone', async (req, res) => {
  try {
    const { phone } = req.params;

    await syncPatientData(phone);

    res.json({
      success: true,
      message: 'Sync completed successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Sync failed',
      details: error.message,
    });
  }
});

/**
 * Helper function to sync patient's CGM data
 */
async function syncPatientData(patientPhone) {

  // Get patient's config
  const { data: config, error: configError } = await supabase
    .from('patient_nightscout_config')
    .select('*')
    .eq('patient_phone', patientPhone)
    .single();

  if (configError || !config) {
    throw new Error('Patient Nightscout not configured');
  }

  if (!config.sync_enabled) {
    return;
  }

  try {
    // Decrypt API secret
    const apiSecret = nightscoutService.decryptApiSecret(config.api_secret_encrypted);

    // Fetch last 24 hours of data
    const entries = await nightscoutService.getGlucoseEntries(config.nightscout_url, apiSecret, 24);


    // Insert/update readings in database
    let insertedCount = 0;
    for (const entry of entries) {
      const { error } = await supabase
        .from('cgm_readings')
        .upsert(
          {
            patient_phone: patientPhone,
            patient_mrn: config.patient_mrn,
            patient_name: config.patient_name,
            glucose_value: entry.glucoseValue,
            glucose_units: entry.glucoseUnits,
            trend_direction: entry.trendDirection,
            trend_arrow: entry.trendArrow,
            reading_timestamp: entry.readingTimestamp,
            device_name: entry.deviceName,
            nightscout_id: entry.nightscoutId,
            nightscout_url: config.nightscout_url,
            noise_level: entry.noiseLevel,
          },
          {
            onConflict: 'nightscout_id',
            ignoreDuplicates: true,
          }
        );

      if (!error) {
        insertedCount++;
      }
    }

    // Update config with sync status
    await supabase
      .from('patient_nightscout_config')
      .update({
        last_sync_at: new Date().toISOString(),
        last_successful_sync_at: new Date().toISOString(),
        connection_status: 'active',
        sync_error_count: 0,
        last_error: null,
      })
      .eq('patient_phone', patientPhone);

  } catch (error) {

    // Update config with error
    await supabase
      .from('patient_nightscout_config')
      .update({
        last_sync_at: new Date().toISOString(),
        connection_status: 'error',
        sync_error_count: config.sync_error_count + 1,
        last_error: error.message,
      })
      .eq('patient_phone', patientPhone);

    throw error;
  }
}

module.exports = router;
