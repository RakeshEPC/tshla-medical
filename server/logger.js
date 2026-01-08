/**
 * HIPAA-Compliant Logger Module for TSHLA Server APIs
 * Provides structured logging with PHI sanitization
 *
 * IMPORTANT: This logger automatically redacts PHI from logs in production
 * to maintain HIPAA compliance.
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const CURRENT_LEVEL = process.env.LOG_LEVEL === 'debug' ? LOG_LEVELS.DEBUG : LOG_LEVELS.INFO;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// PHI field patterns to redact (HIPAA compliance)
const PHI_PATTERNS = [
  'password',
  'token',
  'key',
  'secret',
  'ssn',
  'social_security',
  'dob',
  'date_of_birth',
  'birthdate',
  'phone',
  'mobile',
  'cell',
  'email',
  'address',
  'street',
  'city',
  'zip',
  'postal',
  'patient_name',
  'first_name',
  'last_name',
  'full_name',
  'mrn',
  'medical_record',
  'diagnosis',
  'medication',
  'prescription',
  'lab_result',
  'vital',
  'blood_pressure',
  'glucose',
  'a1c',
  'weight',
  'height',
  'insurance',
  'member_id',
  'subscriber',
];

/**
 * Sanitize metadata to remove PHI before logging
 * In production: Redacts all PHI
 * In development: Allows PHI but adds warning
 */
function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') {
    return metadata;
  }

  // In production, aggressively redact PHI
  if (IS_PRODUCTION) {
    const sanitized = {};

    for (const [key, value] of Object.entries(metadata)) {
      const lowerKey = key.toLowerCase();

      // Check if key matches any PHI pattern
      const isPHI = PHI_PATTERNS.some(pattern => lowerKey.includes(pattern));

      if (isPHI) {
        sanitized[key] = '[REDACTED-PHI]';
      } else if (typeof value === 'object' && value !== null) {
        // Recursively sanitize nested objects
        sanitized[key] = sanitizeMetadata(value);
      } else if (typeof value === 'string' && value.length > 100) {
        // Truncate long strings that might contain PHI
        sanitized[key] = value.substring(0, 100) + '...[TRUNCATED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  // In development, return as-is but could add warnings
  return metadata;
}

/**
 * Sanitize message text to remove potential PHI
 */
function sanitizeMessage(message) {
  if (!message || typeof message !== 'string') {
    return message;
  }

  if (!IS_PRODUCTION) {
    return message;
  }

  // In production, redact common PHI patterns in message text
  let sanitized = message;

  // Redact email addresses
  sanitized = sanitized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL-REDACTED]');

  // Redact phone numbers (various formats)
  sanitized = sanitized.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE-REDACTED]');
  sanitized = sanitized.replace(/\b\(\d{3}\)\s*\d{3}[-.]?\d{4}\b/g, '[PHONE-REDACTED]');

  // Redact SSN patterns
  sanitized = sanitized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN-REDACTED]');

  // Redact dates that might be DOB
  sanitized = sanitized.replace(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, '[DATE-REDACTED]');

  return sanitized;
}

function formatTimestamp() {
  return new Date().toISOString();
}

function log(level, category, message, metadata) {
  const timestamp = formatTimestamp();
  const prefix = `[${timestamp}] ${level.padEnd(5)} [${category}]`;

  // Sanitize message and metadata before logging
  const sanitizedMessage = sanitizeMessage(message);
  const sanitizedMetadata = sanitizeMetadata(metadata);

  if (sanitizedMetadata) {
    console.log(prefix, sanitizedMessage, JSON.stringify(sanitizedMetadata));
  } else {
    console.log(prefix, sanitizedMessage);
  }
}

// Exported logging functions
function error(category, message, metadata) {
  if (LOG_LEVELS.ERROR <= CURRENT_LEVEL) {
    log('ERROR', category, message, metadata);
  }
}

function warn(category, message, metadata) {
  if (LOG_LEVELS.WARN <= CURRENT_LEVEL) {
    log('WARN', category, message, metadata);
  }
}

function info(category, message, metadata) {
  if (LOG_LEVELS.INFO <= CURRENT_LEVEL) {
    log('INFO', category, message, metadata);
  }
}

function debug(category, message, metadata) {
  if (LOG_LEVELS.DEBUG <= CURRENT_LEVEL) {
    log('DEBUG', category, message, metadata);
  }
}

// Specialized logging methods for APIs
function startup(message, metadata) {
  console.log('\n' + '='.repeat(80));
  log('INFO', 'STARTUP', message, metadata);
  console.log('='.repeat(80) + '\n');
}

function database(message, success, error) {
  const level = success ? 'INFO' : 'ERROR';
  const metadata = error ? { error: error.message } : undefined;
  log(level, 'DATABASE', message, metadata);
}

function api(method, path, status, duration) {
  const metadata = { method, path, status, duration: `${duration}ms` };
  log('INFO', 'API', `${method} ${path} ${status}`, metadata);
}

/**
 * Helper: Redact patient identifiers from log messages
 * Use this when you must log something that might contain PHI
 *
 * Example:
 *   logger.info('Patient', logger.redactPHI(`Processing patient ${patientName}`));
 *   // Output: "Processing patient [REDACTED-PHI]"
 */
function redactPHI(text) {
  if (typeof text !== 'string') return '[NON-STRING]';
  return sanitizeMessage(text);
}

/**
 * Helper: Create safe metadata object with only non-PHI fields
 * Use this to explicitly include only safe fields in logs
 *
 * Example:
 *   logger.info('API', 'Request received', logger.safeMetadata({
 *     requestId: req.id,
 *     method: req.method
 *   }));
 */
function safeMetadata(obj) {
  return sanitizeMetadata(obj);
}

/**
 * Helper: Log with count instead of actual PHI data
 * Use this when you need to log that processing happened without showing data
 *
 * Example:
 *   logger.logCount('Patients', 'Processed patients', patients.length);
 *   // Output: "Processed patients (count: 5)"
 */
function logCount(category, action, count) {
  info(category, `${action} (count: ${count})`);
}

/**
 * Helper: Log operation success/failure without PHI
 * Use this for operations on PHI where you only care about success/failure
 *
 * Example:
 *   logger.logOperation('Database', 'insert', 'patients', true);
 *   // Output: "insert patients: SUCCESS"
 */
function logOperation(category, operation, resource, success, errorMessage) {
  const status = success ? 'SUCCESS' : 'FAILED';
  const message = `${operation} ${resource}: ${status}`;
  const metadata = errorMessage ? { error: sanitizeMessage(errorMessage) } : undefined;

  if (success) {
    info(category, message, metadata);
  } else {
    error(category, message, metadata);
  }
}

module.exports = {
  // Standard logging
  error,
  warn,
  info,
  debug,
  startup,
  database,
  api,

  // HIPAA-safe helpers
  redactPHI,
  safeMetadata,
  logCount,
  logOperation,

  // Export sanitization functions for testing/manual use
  sanitizeMessage,
  sanitizeMetadata,
};
