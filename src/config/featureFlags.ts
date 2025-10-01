import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';
/**
 * Feature Flags Configuration
 *
 * Use these flags to safely test new features without breaking
 * existing functionality. Default to stable versions.
 */

interface FeatureFlags {
  // Dictation Features
  USE_DICTATION_V2: boolean; // New dictation mode (experimental)
  USE_AMBIENT_V2: boolean; // New ambient mode (experimental)

  // Processing Features
  USE_AI_PROCESSOR_V2: boolean; // New AI processing (experimental)
  USE_ENHANCED_CORRECTIONS: boolean; // Enhanced medical corrections

  // UI Features
  USE_NEW_LAYOUT: boolean; // New UI layout (experimental)
  USE_ADVANCED_PRINT: boolean; // Advanced print features

  // Voice Features
  USE_ELEVENLABS_V2: boolean; // New ElevenLabs integration
  USE_AZURE_VOICE_V2: boolean; // New Azure voice config

  // Debug Features
  SHOW_DEBUG_INFO: boolean; // Show debug information
  LOG_API_CALLS: boolean; // Log all API calls

  // Safety Features
  ENFORCE_LOCKED_FEATURES: boolean; // Enforce locked feature protection
  REQUIRE_FEATURE_APPROVAL: boolean; // Require approval for new features
}

/**
 * Get feature flag value from environment
 */
function getFeatureFlag(key: string, defaultValue: boolean = false): boolean {
  // In production, always default to stable versions
  if (import.meta.env.MODE === 'production' && !import.meta.env[`VITE_${key}`]) {
    return defaultValue;
  }

  return import.meta.env[`VITE_${key}`] === 'true';
}

/**
 * Current feature flags configuration
 *
 * ⚠️ IMPORTANT: Production defaults to V1 (stable) versions
 */
export const featureFlags: FeatureFlags = {
  // All V2 features OFF by default
  USE_DICTATION_V2: getFeatureFlag('USE_DICTATION_V2', false),
  USE_AMBIENT_V2: getFeatureFlag('USE_AMBIENT_V2', false),
  USE_AI_PROCESSOR_V2: getFeatureFlag('USE_AI_PROCESSOR_V2', false),
  USE_ENHANCED_CORRECTIONS: getFeatureFlag('USE_ENHANCED_CORRECTIONS', false),
  USE_NEW_LAYOUT: getFeatureFlag('USE_NEW_LAYOUT', false),
  USE_ADVANCED_PRINT: getFeatureFlag('USE_ADVANCED_PRINT', false),
  USE_ELEVENLABS_V2: getFeatureFlag('USE_ELEVENLABS_V2', false),
  USE_AZURE_VOICE_V2: getFeatureFlag('USE_AZURE_VOICE_V2', false),

  // Debug features OFF in production
  SHOW_DEBUG_INFO: getFeatureFlag('SHOW_DEBUG_INFO', false),
  LOG_API_CALLS: getFeatureFlag('LOG_API_CALLS', false),

  // Safety features ON by default
  ENFORCE_LOCKED_FEATURES: getFeatureFlag('ENFORCE_LOCKED_FEATURES', true),
  REQUIRE_FEATURE_APPROVAL: getFeatureFlag('REQUIRE_FEATURE_APPROVAL', true),
};

/**
 * Check if we should use V1 (stable) version
 */
export function useStableVersion(feature: keyof FeatureFlags): boolean {
  return !featureFlags[feature];
}

/**
 * Log feature flag status (for debugging)
 */
export function logFeatureFlags(): void {
  if (featureFlags.SHOW_DEBUG_INFO) {
    logDebug('App', 'Debug message', {});
  }
}

/**
 * Validate that locked features are not being overridden
 */
export function validateLockedFeatures(): boolean {
  if (!featureFlags.ENFORCE_LOCKED_FEATURES) {
    logWarn('App', 'Warning message', {});
    return false;
  }

  // Check that V1 features are being used in production
  if (import.meta.env.MODE === 'production') {
    const violations = [];

    if (featureFlags.USE_DICTATION_V2) {
      violations.push('Dictation V2 enabled in production');
    }
    if (featureFlags.USE_AI_PROCESSOR_V2) {
      violations.push('AI Processor V2 enabled in production');
    }

    if (violations.length > 0) {
      logError('App', 'Error message', {});
      return false;
    }
  }

  return true;
}

/**
 * Feature flag groups for easy management
 */
export const featureGroups = {
  // Stable features (V1) - These work perfectly
  stable: {
    dictation: !featureFlags.USE_DICTATION_V2,
    aiProcessor: !featureFlags.USE_AI_PROCESSOR_V2,
    layout: !featureFlags.USE_NEW_LAYOUT,
  },

  // Experimental features (V2) - Under development
  experimental: {
    dictation: featureFlags.USE_DICTATION_V2,
    ambient: featureFlags.USE_AMBIENT_V2,
    aiProcessor: featureFlags.USE_AI_PROCESSOR_V2,
    layout: featureFlags.USE_NEW_LAYOUT,
  },
};

// Validate on load
if (import.meta.env.MODE === 'production') {
  validateLockedFeatures();
}
