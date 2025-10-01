/**
 * Simple Logger Module for TSHLA Server APIs
 * Provides structured logging for Auth, Pump, and Schedule APIs
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const CURRENT_LEVEL = process.env.LOG_LEVEL === 'debug' ? LOG_LEVELS.DEBUG : LOG_LEVELS.INFO;

function formatTimestamp() {
  return new Date().toISOString();
}

function log(level, category, message, metadata) {
  const timestamp = formatTimestamp();
  const prefix = `[${timestamp}] ${level.padEnd(5)} [${category}]`;

  if (metadata) {
    console.log(prefix, message, JSON.stringify(metadata));
  } else {
    console.log(prefix, message);
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

module.exports = {
  error,
  warn,
  info,
  debug,
  startup,
  database,
  api,
};
