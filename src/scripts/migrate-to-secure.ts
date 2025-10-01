#!/usr/bin/env node

/**
 * Migration script to move from localStorage to secure server storage
 * Run this once to migrate existing data
 */

import { SecureServerStorage } from '../lib/security/secureStorage';
import { encryptPHI } from '../lib/security/encryption';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

const DANGEROUS_KEYS = [
  'tshla_driver_transcript',
  'tshla_driver_soap',
  'tshla_driver_summary',
  'tshla_driver_meta',
  'tshla_driver_soapCombined',
  'tshla_driver_medChanges',
  'tshla_driver_labNotes',
  'tshla_codes',
  'tshla_sp_cc',
  'tshla_sp_hpi',
  'tshla_sp_summary',
  'tshla_sp_medhist',
  'tshla_sp_subjective',
  'tshla_sp_exam',
  'tshla_sp_impression',
  'tshla_sp_plan',
  'guided_pump_state',
  'tshla_patient_preview',
  'tshla_templates',
  'tshla_active_template',
  'tshla_template_sections',
  'pending_pas',
];

async function migrateData() {
  logDebug('App', 'Debug message', {});

  if (typeof window === 'undefined') {
    logError('App', 'Error message', {});
    return;
  }

  const migrationReport = {
    total: 0,
    migrated: 0,
    failed: 0,
    items: [] as any[],
  };

  for (const key of DANGEROUS_KEYS) {
    const data = localStorage.getItem(key);

    if (data) {
      logWarn('App', 'Warning message', {});
      migrationReport.total++;

      try {
        // Parse the data
        let parsedData;
        try {
          parsedData = JSON.parse(data);
        } catch {
          parsedData = data; // Plain string
        }

        // Determine patient ID from the data
        let patientId = 'unknown';
        if (typeof parsedData === 'object' && parsedData !== null) {
          patientId =
            parsedData.email || parsedData.patientId || parsedData.meta?.email || 'unknown';
        }

        // Store securely on server
        await SecureServerStorage.storePatientData(
          key.replace('tshla_', ''),
          parsedData,
          patientId
        );

        // Remove from localStorage
        localStorage.removeItem(key);

        logInfo('App', 'Info message', {});
        migrationReport.migrated++;
        migrationReport.items.push({
          key,
          patientId,
          size: data.length,
          status: 'success',
        });
      } catch (error) {
        logError('App', 'Error message', {});
        migrationReport.failed++;
        migrationReport.items.push({
          key,
          error: error instanceof Error ? error.message : 'Unknown error',
          status: 'failed',
        });
      }
    }
  }

  // Check for any other suspicious keys
  const allKeys = Object.keys(localStorage);
  const suspiciousKeywords = [
    'patient',
    'medical',
    'diagnosis',
    'prescription',
    'treatment',
    'health',
    'clinical',
    'doctor',
  ];

  for (const key of allKeys) {
    const keyLower = key.toLowerCase();
    if (suspiciousKeywords.some(word => keyLower.includes(word))) {
      if (!DANGEROUS_KEYS.includes(key)) {
        logWarn('App', 'Warning message', {});
      }
    }
  }

  // Generate migration report
  logDebug('App', 'Debug message', {});
  logDebug('App', 'Debug message', {});
  logDebug('App', 'Debug message', {});
  logDebug('App', 'Debug message', {});
  logDebug('App', 'Debug message', {});

  if (migrationReport.failed > 0) {
    logDebug('App', 'Debug message', {});
    migrationReport.items
      .filter(item => item.status === 'failed')
      .forEach(item => {
        logDebug('App', 'Debug message', {});
      });
  }

  // Save migration report
  const reportKey = `migration_report_${Date.now()}`;
  sessionStorage.setItem(reportKey, JSON.stringify(migrationReport));
  logDebug('App', 'Debug message', {});

  if (migrationReport.migrated === migrationReport.total) {
    logDebug('App', 'Debug message', {});
    logDebug('App', 'Debug message', {});
  } else {
    logDebug('App', 'Debug message', {});
    logDebug('App', 'Debug message', {});
  }

  // Clear any remaining sensitive data patterns
  logDebug('App', 'Debug message', {});
  const keysToRemove = allKeys.filter(key => {
    const value = localStorage.getItem(key) || '';
    return (
      value.includes('patient') ||
      value.includes('diagnosis') ||
      value.includes('medication') ||
      value.includes('prescription')
    );
  });

  keysToRemove.forEach(key => {
    logDebug('App', 'Debug message', {});
    localStorage.removeItem(key);
  });

  logDebug('App', 'Debug message', {});
  logDebug('App', 'Debug message', {});
  logDebug('App', 'Debug message', {});
  logDebug('App', 'Debug message', {});
  logDebug('App', 'Debug message', {});
  logDebug('App', 'Debug message', {});
}

// Add to window for manual execution
if (typeof window !== 'undefined') {
  (window as any).migrateToSecureStorage = migrateData;
  logDebug('App', 'Debug message', {});
}
