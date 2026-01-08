# Phase 3: Security Hardening - HIPAA Compliance

**Date Started:** January 8, 2026
**Status:** 🔄 IN PROGRESS
**Priority:** HIGH - Security vulnerabilities

---

## 📋 Tasks Overview

### ✅ Completed:
- [x] Phase 1: OpenAI → Azure OpenAI migration
- [x] Phase 2A: Logger enhancement
- [x] Phase 2B: Console.log migration (high-priority files)
- [x] RLS policies for pump registration

### 🔄 Phase 3 Tasks:

| # | Task | Priority | Status |
|---|------|----------|--------|
| 1 | Remove unused Twilio/Klara code | HIGH | 🔄 In Progress |
| 2 | Remove Google TTS (non-BAA service) | HIGH | ⏳ Pending |
| 3 | Implement file upload validation | HIGH | ⏳ Pending |
| 4 | Fix CORS for production | HIGH | ⏳ Pending |
| 5 | Add rate limiting | HIGH | ⏳ Pending |
| 6 | Implement strong password policy | HIGH | ⏳ Pending |
| 7 | Create breach notification process | HIGH | ⏳ Pending |
| 8 | Implement PHI access audit logging | CRITICAL | ⏳ Pending |

---

## Task 1: Remove Twilio/Klara Code ❌

**Reason:** Not currently in use, third-party services without confirmed BAA

### Files to Remove/Update:

#### Complete Removal (not in use):
- `server/services/twilioService.ts` - DELETE
- `server/services/klaraService.ts` - DELETE
- `server/api/twilio/` - REVIEW and mark as deprecated
- `server/elevenlabs-twilio-bridge.js` - DELETE
- `server/elevenlabs-twilio-relay.js` - DELETE
- `src/services/twilioCall.service.ts` - DELETE

#### Comment Out/Disable:
- `server/unified-api.js` - Twilio endpoints (already marked DISABLED)
- `server/openai-realtime-relay.js` - Remove Twilio references if any
- `server/diabetes-education-api.js` - Disable Twilio integrations

### Action:
```bash
# Move to deprecated folder instead of deleting
mkdir -p server/services/_deprecated_external
mv server/services/twilioService.ts server/services/_deprecated_external/
mv server/services/klaraService.ts server/services/_deprecated_external/
mv server/elevenlabs-twilio-*.js server/services/_deprecated_external/
```

---

## Task 2: Remove Google TTS ❌

**Reason:** Google Cloud TTS does not have a BAA with you (HIPAA violation)

### Files to Fix:

**Primary Issue:**
- `src/services/premiumVoice.service.ts` (Line 370-395)
  - Method: `speakWithGoogle()`
  - Uses: `https://texttospeech.googleapis.com/v1/text:synthesize`
  - **Risk:** Sends PHI (clinical text) to Google without BAA

### Fix Strategy:

**Option A: Remove entirely (recommended)**
```typescript
// DELETE method speakWithGoogle()
// Remove Google TTS option from voice settings

// In premiumVoice.service.ts
private async speak(text: string, settings: VoiceSettings): Promise<void> {
  // Remove Google option
  if (settings.provider === 'elevenlabs') {
    await this.speakWithElevenLabs(text, settings);
  } else if (settings.provider === 'azure') {
    await this.speakWithAzure(text, settings);
  }
  // DELETE: else if (settings.provider === 'google') { ... }
  else {
    throw new Error('Unsupported voice provider');
  }
}
```

**Option B: Replace with Azure TTS (has BAA)**
- Azure Cognitive Services TTS is BAA-covered
- Similar quality to Google TTS
- Already using Azure for OpenAI

---

## Task 3: File Upload Validation ✅

**Purpose:** Prevent malicious file uploads (XXE, malware, DoS)

### Files Affected:
- `server/services/ccdXMLParser.service.js` - Parses uploaded CCD/XML files
- `server/api/ccd-summary-api.js` - Handles file uploads

### Current Risk:
```javascript
// CURRENT - UNSAFE
const parser = new XMLParser({
  ignoreAttributes: false,
  // No XXE protection!
});
const data = parser.parse(xmlContent); // Could execute external entities
```

### Fix Implementation:

```javascript
// FILE: server/middleware/fileUploadValidator.js

const multer = require('multer');
const path = require('path');

// Configuration
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  'text/xml',
  'application/xml',
  'text/plain' // CCD files might come as text
];

// File filter
function fileFilter(req, file, cb) {
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error(`Invalid file type: ${file.mimetype}. Only XML files allowed.`), false);
  }

  // Check file extension
  const ext = path.extname(file.originalname).toLowerCase();
  if (!['.xml', '.ccd', '.ccda', '.txt'].includes(ext)) {
    return cb(new Error(`Invalid file extension: ${ext}`), false);
  }

  cb(null, true);
}

// Multer configuration
const upload = multer({
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1 // Only one file at a time
  },
  fileFilter: fileFilter,
  storage: multer.memoryStorage() // Store in memory, not disk (more secure)
});

// Validation middleware
function validateUploadedXML(req, res, next) {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const xmlContent = req.file.buffer.toString('utf8');

  // Check for suspicious patterns
  const dangerousPatterns = [
    /<!ENTITY/i,          // External entities (XXE)
    /<!DOCTYPE.*SYSTEM/i, // System declarations
    /<!DOCTYPE.*PUBLIC/i, // Public declarations
    /<\?php/i,            // PHP code
    /<script/i,           // JavaScript
    /javascript:/i        // JavaScript protocol
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(xmlContent)) {
      return res.status(400).json({
        error: 'File contains potentially malicious content',
        detail: 'XML file validation failed'
      });
    }
  }

  // Check file is valid XML structure
  try {
    const { XMLParser } = require('fast-xml-parser');
    const parser = new XMLParser({
      ignoreAttributes: false,
      parseAttributeValue: true,
      processEntities: false,  // CRITICAL: Prevents XXE attacks
      allowBooleanAttributes: true
    });

    parser.parse(xmlContent);
  } catch (error) {
    return res.status(400).json({
      error: 'Invalid XML file',
      detail: 'File is not well-formed XML'
    });
  }

  next();
}

module.exports = {
  upload,
  validateUploadedXML
};
```

**Usage in API:**
```javascript
// FILE: server/api/ccd-summary-api.js

const { upload, validateUploadedXML } = require('../middleware/fileUploadValidator');

app.post('/api/ccd/upload',
  verifyToken,              // Require authentication
  upload.single('file'),    // Process file upload
  validateUploadedXML,      // Validate XML content
  async (req, res) => {
    // File is now safe to process
    const xmlContent = req.file.buffer.toString('utf8');
    // ... rest of processing
  }
);
```

---

## Task 4: Fix CORS Configuration 🔒

**Issue:** CORS allows localhost in production (security risk)

### Files to Fix:
- `server/unified-api.js`
- `server/pump-report-api.js`
- `server/medical-auth-api.js`

### Current Issue:
```javascript
// CURRENT - INSECURE
origin: [
  'http://localhost:5173',  // ❌ Shouldn't be in production!
  'http://localhost:5174',
  'http://localhost:5175',
  'https://www.tshla.ai',
  'https://mango-sky-0ba265c0f.1.azurestaticapps.net'
]
```

### Fix:
```javascript
// SECURE - Environment-based CORS

const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [
      'https://www.tshla.ai',
      'https://mango-sky-0ba265c0f.1.azurestaticapps.net',
      process.env.FRONTEND_URL // From environment variable
    ].filter(Boolean)
  : [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175'
    ];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS', 'Blocked origin', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

---

## Task 5: Add Rate Limiting 🚦

**Purpose:** Prevent brute force attacks, API abuse, DoS

### Install Package:
```bash
npm install express-rate-limit
```

### Implementation:

```javascript
// FILE: server/middleware/rateLimiter.js

const rateLimit = require('express-rate-limit');
const logger = require('../logger');

// Strict rate limit for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per 15 minutes
  message: {
    error: 'Too many login attempts',
    message: 'Please try again after 15 minutes',
    retryAfter: 15 * 60
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('RateLimit', 'Auth rate limit exceeded', {
      ip: req.ip,
      path: req.path
    });
    res.status(429).json({
      error: 'Too many login attempts',
      message: 'Please try again after 15 minutes'
    });
  }
});

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: {
    error: 'Too many requests',
    message: 'Please slow down and try again'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Stricter limit for PHI-sensitive endpoints
const phiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: {
    error: 'Too many requests to sensitive endpoint',
    message: 'Rate limit exceeded'
  }
});

// Very strict for registration/account creation
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 account creations per hour per IP
  message: {
    error: 'Too many account creation attempts',
    message: 'Please try again later'
  }
});

module.exports = {
  authLimiter,
  apiLimiter,
  phiLimiter,
  registrationLimiter
};
```

**Usage:**
```javascript
// FILE: server/pump-report-api.js

const {
  authLimiter,
  apiLimiter,
  phiLimiter,
  registrationLimiter
} = require('./middleware/rateLimiter');

// Apply to specific endpoints
app.post('/api/auth/login', authLimiter, loginHandler);
app.post('/api/auth/register', registrationLimiter, registerHandler);

// Apply to all API routes
app.use('/api/', apiLimiter);

// Extra strict for PHI endpoints
app.use('/api/patients', phiLimiter);
app.use('/api/dictated-notes', phiLimiter);
app.use('/api/schedule', phiLimiter);
```

---

## Task 6: Strong Password Policy 🔐

**Current Issue:** Password validation exists but could be stronger

### Files to Fix:
- `server/pump-report-api.js` (lines 401-418)

### Current Password Policy:
```javascript
// CURRENT - WEAK
if (password.length < 8) { ... }
if (!/[A-Z]/.test(password)) { ... }
if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) { ... }
```

### Enhanced Password Policy:
```javascript
// FILE: server/utils/passwordValidator.js

const commonPasswords = require('./common-passwords.json'); // List of 10k common passwords

function validatePassword(password) {
  const errors = [];

  // Length requirement
  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  }

  // Complexity requirements
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*)');
  }

  // Check against common passwords
  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common. Please choose a stronger password');
  }

  // No sequential characters (123, abc, etc.)
  if (/123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz/i.test(password)) {
    errors.push('Password cannot contain sequential characters');
  }

  // No repeated characters (aaa, 111, etc.)
  if (/(.)\1{2,}/.test(password)) {
    errors.push('Password cannot contain repeated characters');
  }

  return {
    valid: errors.length === 0,
    errors,
    strength: calculatePasswordStrength(password)
  };
}

function calculatePasswordStrength(password) {
  let strength = 0;

  // Length bonus
  if (password.length >= 12) strength += 25;
  if (password.length >= 16) strength += 25;

  // Complexity bonus
  if (/[a-z]/.test(password)) strength += 10;
  if (/[A-Z]/.test(password)) strength += 10;
  if (/[0-9]/.test(password)) strength += 10;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) strength += 10;

  // Variety bonus
  const uniqueChars = new Set(password).size;
  strength += Math.min(uniqueChars, 10);

  return Math.min(strength, 100);
}

module.exports = { validatePassword };
```

**Usage:**
```javascript
// In registration endpoint
const { validatePassword } = require('./utils/passwordValidator');

const passwordCheck = validatePassword(password);
if (!passwordCheck.valid) {
  return res.status(400).json({
    error: 'Password does not meet requirements',
    details: passwordCheck.errors
  });
}
```

---

## Task 7: Breach Notification Process 🚨

**Purpose:** HIPAA requires notification within 60 days of discovering a breach

### Create Breach Response System:

```javascript
// FILE: server/services/breachNotification.service.js

const logger = require('../logger');
const { supabase } = require('./supabase');

class BreachNotificationService {

  async detectBreach(event) {
    const suspiciousEvents = {
      'MASS_DATA_EXPORT': {
        threshold: 100, // More than 100 patient records in 5 minutes
        window: 5 * 60 * 1000
      },
      'FAILED_LOGIN_SPIKE': {
        threshold: 50, // More than 50 failed logins in 10 minutes
        window: 10 * 60 * 1000
      },
      'UNAUTHORIZED_ACCESS': {
        threshold: 1, // Any unauthorized access is a breach
        window: 0
      },
      'DATA_MODIFICATION': {
        threshold: 500, // Mass data modification
        window: 10 * 60 * 1000
      }
    };

    // Check if event matches breach criteria
    // Log to breach_incidents table
    // Alert administrators
  }

  async reportBreach(incident) {
    // Create breach report
    const breach = {
      incident_id: incident.id,
      discovered_at: new Date().toISOString(),
      breach_type: incident.type,
      affected_records: incident.affected_count,
      status: 'INVESTIGATING',
      notification_deadline: this.calculateDeadline(incident.discovered_at)
    };

    // Store in breach_incidents table
    await supabase.from('breach_incidents').insert(breach);

    // Send immediate alert to admins
    await this.alertAdministrators(breach);

    logger.error('BreachDetection', 'Potential breach detected', {
      incident_id: incident.id,
      type: incident.type,
      affected: incident.affected_count
    });

    return breach;
  }

  calculateDeadline(discoveryDate) {
    // HIPAA requires notification within 60 days
    const deadline = new Date(discoveryDate);
    deadline.setDate(deadline.getDate() + 60);
    return deadline.toISOString();
  }

  async alertAdministrators(breach) {
    // Send email/SMS to security team
    // Create incident ticket
    // Log to audit trail
  }

  async trackNotificationProgress(breachId) {
    // Track:
    // - Affected individuals notified
    // - HHS notification (if >500 people)
    // - Media notification (if >500 people in same state)
  }
}

module.exports = new BreachNotificationService();
```

**Breach Incident Table:**
```sql
CREATE TABLE breach_incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_type VARCHAR(50) NOT NULL,
  discovered_at TIMESTAMP NOT NULL,
  breach_occurred_at TIMESTAMP,
  affected_patient_count INTEGER,
  affected_patient_ids TEXT[], -- Array of patient IDs
  status VARCHAR(20) DEFAULT 'INVESTIGATING', -- INVESTIGATING, CONFIRMED, MITIGATED, RESOLVED
  notification_deadline TIMESTAMP,
  hhs_notified BOOLEAN DEFAULT false,
  hhs_notification_date TIMESTAMP,
  individuals_notified BOOLEAN DEFAULT false,
  individuals_notification_date TIMESTAMP,
  media_notified BOOLEAN DEFAULT false,
  root_cause TEXT,
  mitigation_steps TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Task 8: PHI Access Audit Logging 📊

**Purpose:** Track all PHI access for HIPAA compliance

### Implementation:

```javascript
// FILE: server/middleware/auditLogger.js

const { supabase } = require('../services/supabase');
const logger = require('../logger');

async function auditPHIAccess(req, res, next) {
  // Capture original res.json
  const originalJson = res.json.bind(res);

  res.json = function(data) {
    // Log PHI access after successful response
    if (res.statusCode === 200 || res.statusCode === 201) {
      logAudit(req, data).catch(err => {
        logger.error('AuditLog', 'Failed to log PHI access', { error: err.message });
      });
    }
    return originalJson(data);
  };

  next();
}

async function logAudit(req, responseData) {
  const auditEntry = {
    user_id: req.user?.userId || req.user?.id || null,
    user_email: req.user?.email || null,
    action: req.method,
    resource: req.path,
    resource_type: determineResourceType(req.path),
    patient_id: extractPatientId(req),
    ip_address: req.ip || req.connection.remoteAddress,
    user_agent: req.get('User-Agent'),
    request_body: sanitizeRequestBody(req.body),
    response_status: 200, // Successful access
    phi_accessed: containsPHI(req.path),
    timestamp: new Date().toISOString()
  };

  // Log to Supabase audit_logs table
  await supabase.from('audit_logs').insert(auditEntry);

  // Also log to file-based logger
  logger.audit('PHI_ACCESS', auditEntry.resource_type, {
    user: auditEntry.user_email,
    resource: auditEntry.resource,
    patient_id: auditEntry.patient_id
  });
}

function determineResourceType(path) {
  if (path.includes('/patients')) return 'PATIENT_RECORD';
  if (path.includes('/dictated-notes')) return 'CLINICAL_NOTE';
  if (path.includes('/schedule')) return 'APPOINTMENT';
  if (path.includes('/pump-assessment')) return 'PUMP_ASSESSMENT';
  if (path.includes('/medical')) return 'MEDICAL_DATA';
  return 'OTHER';
}

function extractPatientId(req) {
  // Try to extract patient ID from various sources
  return req.params.patientId ||
         req.params.id ||
         req.query.patientId ||
         req.body?.patient_id ||
         null;
}

function sanitizeRequestBody(body) {
  // Remove sensitive fields from audit log
  if (!body) return null;

  const sanitized = { ...body };
  delete sanitized.password;
  delete sanitized.ssn;
  delete sanitized.credit_card;

  return JSON.stringify(sanitized).substring(0, 500); // Limit size
}

function containsPHI(path) {
  const phiPaths = [
    '/patients',
    '/dictated-notes',
    '/schedule',
    '/medical',
    '/pump-assessment',
    '/previsit'
  ];

  return phiPaths.some(p => path.includes(p));
}

module.exports = { auditPHIAccess };
```

**Usage:**
```javascript
// Apply to all PHI endpoints
app.use('/api/patients', auditPHIAccess);
app.use('/api/dictated-notes', auditPHIAccess);
app.use('/api/schedule', auditPHIAccess);
app.use('/api/medical', auditPHIAccess);
```

**Audit Log Table:**
```sql
-- Already exists, but ensure it has these columns:
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_email VARCHAR(255);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS resource_type VARCHAR(50);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS patient_id UUID;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS phi_accessed BOOLEAN DEFAULT false;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS request_body TEXT;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_patient ON audit_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_phi ON audit_logs(phi_accessed) WHERE phi_accessed = true;
```

---

## 📊 Implementation Priority

### Week 1 (This Week):
1. ✅ Remove Twilio/Klara code
2. ✅ Remove Google TTS
3. ✅ Fix CORS configuration
4. ✅ Add rate limiting
5. ✅ Implement strong password policy

### Week 2:
6. ✅ Implement file upload validation
7. ✅ Create breach notification process
8. ✅ Implement PHI access audit logging

---

## ✅ Success Criteria

Phase 3 is complete when:
- [ ] No Twilio/Klara code in active codebase
- [ ] No Google TTS usage (PHI not sent to non-BAA service)
- [ ] File uploads validated and sanitized (XXE protection)
- [ ] CORS only allows production domains in production
- [ ] Rate limiting active on all endpoints
- [ ] Password policy enforces 12+ char, complexity, no common passwords
- [ ] Breach detection and notification system operational
- [ ] All PHI access logged to audit_logs table
- [ ] Code deployed to production
- [ ] All changes tested

---

**Created:** January 8, 2026
**Next Review:** January 15, 2026
