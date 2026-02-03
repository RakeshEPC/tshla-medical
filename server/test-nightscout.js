/**
 * Nightscout Connection Test Script
 * Tests connection to a Nightscout instance and displays glucose data
 *
 * Usage: node test-nightscout.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const nightscoutService = require('./services/nightscout.service');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Test configuration (replace with your Nightscout details)
const TEST_CONFIG = {
  nightscoutUrl: 'patelcyfair.nightscoutpro.com',
  apiSecret: 'Indianswing44$',
  patientPhone: '+18326073630',
  patientName: 'Rakesh Patel',
  providerId: 'dr-rakesh-patel',
  providerName: 'Dr. Rakesh Patel',
};

async function testNightscout() {


  // Test 1: Connection Test
  try {
    const connectionResult = await nightscoutService.testConnection(
      TEST_CONFIG.nightscoutUrl,
      TEST_CONFIG.apiSecret
    );

    if (connectionResult.success) {
    } else {
      process.exit(1);
    }
  } catch (error) {
    process.exit(1);
  }


  // Test 2: Fetch Current Glucose
  try {
    const currentGlucose = await nightscoutService.getCurrentGlucose(
      TEST_CONFIG.nightscoutUrl,
      TEST_CONFIG.apiSecret
    );

    if (currentGlucose) {
      const minutesAgo = Math.floor(
        (new Date() - new Date(currentGlucose.readingTimestamp)) / 1000 / 60
      );


      // Alert check
      const alert = nightscoutService.checkForAlert(currentGlucose.glucoseValue);
      if (alert) {
      } else {
      }
    } else {
    }
  } catch (error) {
  }


  // Test 3: Fetch Last 24 Hours of Data
  try {
    const entries = await nightscoutService.getGlucoseEntries(
      TEST_CONFIG.nightscoutUrl,
      TEST_CONFIG.apiSecret,
      24, // hours
      288 // max count (24h @ 5min intervals)
    );


    if (entries.length > 0) {
      // Show first few entries
      entries.slice(0, 5).forEach((entry, index) => {
        const time = new Date(entry.readingTimestamp).toLocaleTimeString();
      });

      // Calculate and show statistics
      const stats = nightscoutService.calculateStatistics(entries);
    }
  } catch (error) {
  }


  // Test 4: Encryption/Decryption
  try {
    const encrypted = nightscoutService.encryptApiSecret(TEST_CONFIG.apiSecret);

    const decrypted = nightscoutService.decryptApiSecret(encrypted);
    if (decrypted === TEST_CONFIG.apiSecret) {
    } else {
    }
  } catch (error) {
  }


  // Test 5: Save Configuration to Database
  try {
    const encryptedSecret = nightscoutService.encryptApiSecret(TEST_CONFIG.apiSecret);
    const normalizedUrl = nightscoutService.normalizeNightscoutUrl(TEST_CONFIG.nightscoutUrl);

    // Check if config already exists
    const { data: existingConfig } = await supabase
      .from('patient_nightscout_config')
      .select('*')
      .eq('patient_phone', TEST_CONFIG.patientPhone)
      .single();

    if (existingConfig) {
      const { data, error } = await supabase
        .from('patient_nightscout_config')
        .update({
          nightscout_url: normalizedUrl,
          api_secret_encrypted: encryptedSecret,
          sync_enabled: true,
          connection_status: 'active',
          last_connection_test_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('patient_phone', TEST_CONFIG.patientPhone)
        .select()
        .single();

      if (error) {
      } else {
      }
    } else {
      const { data, error } = await supabase
        .from('patient_nightscout_config')
        .insert({
          patient_phone: TEST_CONFIG.patientPhone,
          patient_name: TEST_CONFIG.patientName,
          nightscout_url: normalizedUrl,
          api_secret_encrypted: encryptedSecret,
          sync_enabled: true,
          sync_interval_minutes: 15,
          connection_status: 'active',
          last_connection_test_at: new Date().toISOString(),
          provider_id: TEST_CONFIG.providerId,
          configured_by_provider_name: TEST_CONFIG.providerName,
        })
        .select()
        .single();

      if (error) {
      } else {
      }
    }
  } catch (error) {
  }

}

// Run tests
