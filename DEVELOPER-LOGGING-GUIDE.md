# Developer Guide: HIPAA-Compliant Logging

**IMPORTANT:** This project handles Protected Health Information (PHI). All logging must be HIPAA-compliant.

## 🚫 NEVER Use console.log in Server Code

```javascript
// ❌ WRONG - HIPAA VIOLATION
console.log('Processing patient:', patient.name);
console.log('Phone:', patient.phone);
console.error('Error for patient John Smith:', error);
```

**Why it's wrong:**
- Production logs contain PHI (patient names, phone, DOB, medical data)
- HIPAA violations can result in $50,000+ fines per incident
- PHI exposure is a data breach requiring notification

## ✅ ALWAYS Use the Safe Logger

```javascript
// ✅ CORRECT - HIPAA COMPLIANT
const logger = require('./logger');

logger.info('PatientService', 'Processing patient', { patientId: patient.id });
logger.error('PatientService', 'Database error', { error: error.message });
logger.logOperation('PatientService', 'create', 'patient', true);
```

## Quick Reference

### Basic Logging

```javascript
const logger = require('./logger');

// Info logging (general flow)
logger.info('Category', 'Message', { metadata });

// Error logging
logger.error('Category', 'Error description', { error: error.message });

// Warning
logger.warn('Category', 'Warning message', { details });

// Debug (only in development)
logger.debug('Category', 'Debug info', { data });
```

### Special Cases

```javascript
// Operation logging (create/update/delete)
logger.logOperation('Category', 'create', 'resource', true);  // success
logger.logOperation('Category', 'delete', 'resource', false, 'Not found');  // failure

// Batch operations
logger.logCount('Category', 'process', 'records', count);

// Errors with PHI - automatically redacted
logger.error('Category', 'Error', {
  error: logger.redactPHI(error.message)  // Removes names, phone, DOB, etc.
});
```

## Common Patterns

### Patient Operations

```javascript
// ❌ WRONG
console.log('Created patient:', patient.first_name, patient.last_name);

// ✅ CORRECT
logger.logOperation('PatientService', 'create', 'patient', true);
logger.info('PatientService', 'Patient created', { patientId: patient.id });
```

### Database Errors

```javascript
// ❌ WRONG
console.error('Database error:', error);

// ✅ CORRECT
logger.error('Database', 'Query failed', {
  error: error.message,
  query: 'SELECT FROM patients'  // Don't log actual data
});
```

### API Requests

```javascript
// ❌ WRONG
console.log('Request body:', req.body);

// ✅ CORRECT
logger.info('API', 'Request received', {
  endpoint: req.path,
  method: req.method,
  // Don't log body - may contain PHI
});
```

### Phone/Call Logging

```javascript
// ❌ WRONG
console.log('Call from:', phoneNumber, 'Patient:', patientName);

// ✅ CORRECT
logger.info('Realtime', 'Call started', {
  patientId: patient.id  // ID only, not name/phone
});
```

## Enforcement

### Pre-commit Hook
Automatically blocks commits with console.log in server code:

```bash
🔍 Checking for console.log statements in server code (HIPAA)...
❌ console.log statements found in server code!

   Files with console statements:
     - server/patient-service.js
```

### GitHub Actions
CI/CD pipeline fails if console.log detected:

```yaml
❌ HIPAA VIOLATION: console.log statements found in server code!
```

### ESLint (Optional)
Add to your IDE for real-time warnings:

```json
{
  "rules": {
    "no-console": "error"
  }
}
```

## What Gets Automatically Redacted

The logger automatically removes these patterns:

- **Names:** First, Last, Full names
- **Phone:** All formats (555-1234, (555) 123-4567, +1-555-123-4567)
- **DOB:** MM/DD/YYYY, YYYY-MM-DD
- **Email:** any@email.com
- **SSN:** 123-45-6789
- **Medical Record Numbers (MRN)**
- **Addresses:** Street, City, Zip
- **Insurance IDs**
- **Medical values:** A1C, glucose, medications

Example:
```javascript
const error = new Error('Patient John Smith (555-1234, DOB: 01/15/1980) has A1C: 8.5');

logger.error('Service', 'Error', {
  error: logger.redactPHI(error.message)
});

// Logged as: "Patient [REDACTED] ([REDACTED], DOB: [REDACTED]) has [MEDICAL DATA]"
```

## IDE Snippets

### VS Code
Add to `.vscode/snippets.code-snippets`:

```json
{
  "HIPAA Logger Info": {
    "prefix": "loginfo",
    "body": [
      "logger.info('${1:Category}', '${2:Message}', { ${3:metadata} });"
    ]
  },
  "HIPAA Logger Error": {
    "prefix": "logerror",
    "body": [
      "logger.error('${1:Category}', '${2:Error}', { error: ${3:error}.message });"
    ]
  }
}
```

## Migration Checklist

When adding new code:

- [ ] Import logger: `const logger = require('./logger')`
- [ ] Use logger.info() for general logs
- [ ] Use logger.error() for errors
- [ ] Use logger.logOperation() for CRUD operations
- [ ] Never log full objects (patient, user, etc.)
- [ ] Only log IDs, never names/phone/DOB
- [ ] Test: Does this log contain PHI? If yes, redact it

## FAQs

**Q: Can I use console.log in frontend code?**
A: Yes, frontend logs don't go to production log files. But avoid logging sensitive data that could appear in browser console.

**Q: Can I use console.log in scripts/?**
A: Yes, one-off scripts are excluded from the pre-commit check.

**Q: What if I need to debug with console.log?**
A: Use `logger.debug()` instead - it only logs in development.

**Q: Can I temporarily disable the check?**
A: No. HIPAA compliance is not optional. Use logger.debug() for debugging.

**Q: What about console.warn?**
A: Also blocked. Use `logger.warn()` instead.

## Resources

- [HIPAA-SAFE-LOGGING-GUIDE.md](./HIPAA-SAFE-LOGGING-GUIDE.md) - Comprehensive guide
- [PHASE-2B-PROGRESS-REPORT.md](./PHASE-2B-PROGRESS-REPORT.md) - Migration progress
- [server/logger.js](./server/logger.js) - Logger implementation
- [HHS HIPAA Guidance](https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html)

## Contact

Questions about HIPAA-compliant logging? See HIPAA-SAFE-LOGGING-GUIDE.md or consult the technical lead.

---

**Remember:** Every console.log in server code is a potential HIPAA violation and data breach. When in doubt, use the logger!
