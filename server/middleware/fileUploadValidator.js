/**
 * File Upload Validation Middleware
 * Prevents XXE attacks, malware uploads, and DoS
 * HIPAA Compliance: Validates all uploaded medical documents
 */

const multer = require('multer');
const path = require('path');
const logger = require('../logger');

// Configuration
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  'text/xml',
  'application/xml',
  'text/plain', // CCD files might come as text
  'application/octet-stream' // Some systems send XML as binary
];

const ALLOWED_EXTENSIONS = ['.xml', '.ccd', '.ccda', '.txt'];

/**
 * File filter for multer
 */
function fileFilter(req, file, cb) {
  logger.info('FileUpload', 'Validating file upload', {
    filename: file.originalname,
    mimetype: file.mimetype,
    size: file.size
  });

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    logger.warn('FileUpload', 'Invalid file type rejected', {
      filename: file.originalname,
      mimetype: file.mimetype
    });
    return cb(
      new Error(`Invalid file type: ${file.mimetype}. Only XML files allowed.`),
      false
    );
  }

  // Check file extension
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    logger.warn('FileUpload', 'Invalid file extension rejected', {
      filename: file.originalname,
      extension: ext
    });
    return cb(
      new Error(`Invalid file extension: ${ext}. Only ${ALLOWED_EXTENSIONS.join(', ')} allowed.`),
      false
    );
  }

  cb(null, true);
}

/**
 * Multer configuration
 */
const upload = multer({
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1, // Only one file at a time
    fields: 10, // Limit form fields
    parts: 20 // Limit total parts
  },
  fileFilter: fileFilter,
  storage: multer.memoryStorage() // Store in memory, not disk (more secure)
});

/**
 * Validation middleware for uploaded XML content
 */
function validateUploadedXML(req, res, next) {
  if (!req.file) {
    logger.warn('FileUpload', 'No file in upload request');
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const xmlContent = req.file.buffer.toString('utf8');

  logger.info('FileUpload', 'Validating XML content', {
    filename: req.file.originalname,
    size: xmlContent.length
  });

  // Check for suspicious patterns (XXE attacks, code injection)
  const dangerousPatterns = [
    { pattern: /<!ENTITY/i, name: 'External entities (XXE)' },
    { pattern: /<!DOCTYPE.*SYSTEM/i, name: 'System declarations' },
    { pattern: /<!DOCTYPE.*PUBLIC/i, name: 'Public declarations' },
    { pattern: /<\?php/i, name: 'PHP code' },
    { pattern: /<script/i, name: 'JavaScript' },
    { pattern: /javascript:/i, name: 'JavaScript protocol' },
    { pattern: /on\w+\s*=/i, name: 'Event handlers' },
    { pattern: /eval\s*\(/i, name: 'Eval function' },
    { pattern: /base64_decode/i, name: 'Base64 decode' }
  ];

  for (const { pattern, name } of dangerousPatterns) {
    if (pattern.test(xmlContent)) {
      logger.error('FileUpload', 'Malicious content detected', {
        filename: req.file.originalname,
        threat: name
      });
      return res.status(400).json({
        error: 'File contains potentially malicious content',
        detail: `Detected: ${name}`
      });
    }
  }

  // Check file is valid XML structure
  try {
    const { XMLParser } = require('fast-xml-parser');
    const parser = new XMLParser({
      ignoreAttributes: false,
      parseAttributeValue: true,
      processEntities: false, // CRITICAL: Prevents XXE attacks
      allowBooleanAttributes: true,
      parseTagValue: false, // Don't parse values as numbers
      trimValues: true
    });

    parser.parse(xmlContent);

    logger.info('FileUpload', 'XML validation successful', {
      filename: req.file.originalname
    });
  } catch (error) {
    logger.error('FileUpload', 'Invalid XML structure', {
      filename: req.file.originalname,
      error: error.message
    });
    return res.status(400).json({
      error: 'Invalid XML file',
      detail: 'File is not well-formed XML'
    });
  }

  // Attach validated content to request
  req.validatedXML = xmlContent;

  next();
}

/**
 * Error handler for multer errors
 */
function handleUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      logger.warn('FileUpload', 'File too large', { limit: MAX_FILE_SIZE });
      return res.status(400).json({
        error: 'File too large',
        detail: `Maximum file size is ${MAX_FILE_SIZE / 1024 / 1024}MB`
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files',
        detail: 'Only one file can be uploaded at a time'
      });
    }
    logger.error('FileUpload', 'Multer error', { error: err.message });
    return res.status(400).json({
      error: 'File upload error',
      detail: err.message
    });
  }

  if (err) {
    logger.error('FileUpload', 'Upload error', { error: err.message });
    return res.status(400).json({
      error: 'File upload failed',
      detail: err.message
    });
  }

  next();
}

module.exports = {
  upload,
  validateUploadedXML,
  handleUploadError
};
