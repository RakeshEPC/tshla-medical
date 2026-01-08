/**
 * Audit Logging Middleware
 * Tracks all PHI access for HIPAA compliance
 * HIPAA Requirement: Must maintain audit trail of all PHI access
 */

const { createClient } = require('@supabase/supabase-js');
const logger = require('../logger');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Middleware to audit PHI access
 */
async function auditPHIAccess(req, res, next) {
  // Capture original res.json to intercept response
  const originalJson = res.json.bind(res);

  // Replace res.json with our wrapper
  res.json = function(data) {
    // Log PHI access after successful response
    if (res.statusCode === 200 || res.statusCode === 201) {
      logAudit(req, res.statusCode, data).catch(err => {
        logger.error('AuditLog', 'Failed to log PHI access', {
          error: err.message,
          path: req.path
        });
      });
    }

    // Call original json method
    return originalJson(data);
  };

  next();
}

/**
 * Log audit entry
 */
async function logAudit(req, statusCode, responseData) {
  try {
    const auditEntry = {
      user_id: req.user?.userId || req.user?.id || null,
      user_email: req.user?.email || null,
      action: req.method,
      resource: req.path,
      resource_type: determineResourceType(req.path),
      patient_id: extractPatientId(req, responseData),
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      request_body: sanitizeRequestBody(req.body),
      response_status: statusCode,
      phi_accessed: containsPHI(req.path),
      timestamp: new Date().toISOString(),
      session_id: req.session?.id || null
    };

    // Log to Supabase audit_logs table
    const { error } = await supabase
      .from('audit_logs')
      .insert(auditEntry);

    if (error) {
      throw error;
    }

    // Also log to file-based logger for redundancy
    logger.audit('PHI_ACCESS', auditEntry.resource_type, {
      user: auditEntry.user_email,
      resource: auditEntry.resource,
      patient_id: auditEntry.patient_id,
      action: auditEntry.action
    });

  } catch (error) {
    // Don't throw - we don't want audit logging to break the app
    logger.error('AuditLog', 'Audit logging failed', {
      error: error.message,
      path: req.path
    });
  }
}

/**
 * Determine resource type from path
 */
function determineResourceType(path) {
  if (path.includes('/patients')) return 'PATIENT_RECORD';
  if (path.includes('/dictated-notes')) return 'CLINICAL_NOTE';
  if (path.includes('/schedule')) return 'APPOINTMENT';
  if (path.includes('/pump-assessment')) return 'PUMP_ASSESSMENT';
  if (path.includes('/pump-report')) return 'PUMP_REPORT';
  if (path.includes('/medical')) return 'MEDICAL_DATA';
  if (path.includes('/previsit')) return 'PREVISIT_DATA';
  if (path.includes('/vitals')) return 'VITALS';
  if (path.includes('/lab')) return 'LAB_RESULTS';
  if (path.includes('/prescription')) return 'PRESCRIPTION';
  if (path.includes('/auth')) return 'AUTHENTICATION';
  return 'OTHER';
}

/**
 * Extract patient ID from request or response
 */
function extractPatientId(req, responseData) {
  // Try to extract patient ID from various sources
  return req.params.patientId ||
         req.params.patient_id ||
         req.params.id ||
         req.query.patientId ||
         req.query.patient_id ||
         req.body?.patient_id ||
         req.body?.patientId ||
         responseData?.patient_id ||
         responseData?.patientId ||
         null;
}

/**
 * Sanitize request body for audit log
 */
function sanitizeRequestBody(body) {
  if (!body) return null;

  // Create copy to avoid modifying original
  const sanitized = { ...body };

  // Remove sensitive fields
  const sensitiveFields = [
    'password',
    'password_hash',
    'passwordHash',
    'ssn',
    'social_security',
    'credit_card',
    'creditCard',
    'cvv',
    'pin'
  ];

  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });

  // Limit size to prevent huge audit logs
  const jsonString = JSON.stringify(sanitized);
  return jsonString.substring(0, 1000);
}

/**
 * Check if path contains PHI
 */
function containsPHI(path) {
  const phiPaths = [
    '/patients',
    '/dictated-notes',
    '/schedule',
    '/medical',
    '/pump-assessment',
    '/pump-report',
    '/previsit',
    '/vitals',
    '/lab',
    '/prescription'
  ];

  return phiPaths.some(p => path.includes(p));
}

/**
 * Log failed access attempt
 */
async function logFailedAccess(req, reason) {
  try {
    const failedEntry = {
      user_id: req.user?.userId || null,
      user_email: req.user?.email || null,
      action: req.method,
      resource: req.path,
      resource_type: 'FAILED_ACCESS',
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
      response_status: 403,
      phi_accessed: false,
      timestamp: new Date().toISOString(),
      failure_reason: reason
    };

    await supabase.from('audit_logs').insert(failedEntry);

    logger.warn('AuditLog', 'Failed access attempt logged', {
      user: failedEntry.user_email,
      path: req.path,
      reason
    });

  } catch (error) {
    logger.error('AuditLog', 'Failed to log failed access', {
      error: error.message
    });
  }
}

/**
 * Generate audit report for a user
 */
async function getUserAuditReport(userId, startDate, endDate) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('timestamp', startDate)
    .lte('timestamp', endDate)
    .order('timestamp', { ascending: false });

  if (error) throw error;

  return data;
}

/**
 * Generate audit report for a patient
 */
async function getPatientAccessReport(patientId, startDate, endDate) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('patient_id', patientId)
    .gte('timestamp', startDate)
    .lte('timestamp', endDate)
    .order('timestamp', { ascending: false});

  if (error) throw error;

  return data;
}

module.exports = {
  auditPHIAccess,
  logFailedAccess,
  getUserAuditReport,
  getPatientAccessReport
};
