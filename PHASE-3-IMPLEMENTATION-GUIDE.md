# Phase 3 Security Hardening - Implementation Guide

**Status:** ✅ CODE COMPLETE - Ready to integrate
**Date:** January 8, 2026

---

## 📦 What Was Created

All security features have been implemented. Here's what's ready:

### 1. ✅ Removed Non-HIPAA Services
- Moved Twilio/Klara services to `_deprecated_external_services/`
- Removed Google TTS from `premiumVoice.service.ts` (was sending PHI to Google)
- Only Azure TTS remains (has BAA)

### 2. ✅ File Upload Validation
**File:** [server/middleware/fileUploadValidator.js](server/middleware/fileUploadValidator.js)
- Prevents XXE attacks
- Validates file size (10MB max)
- Checks MIME types
- Scans for malicious patterns
- Validates XML structure

### 3. ✅ Rate Limiting
**File:** [server/middleware/rateLimiter.js](server/middleware/rateLimiter.js)
- Auth endpoints: 5 attempts / 15 min
- API endpoints: 100 requests / min
- PHI endpoints: 30 requests / min
- Registration: 3 accounts / hour
- File uploads: 10 files / 15 min

### 4. ✅ CORS Security
**File:** [server/middleware/corsConfig.js](server/middleware/corsConfig.js)
- Production: Only `tshla.ai` and Azure Static Apps
- Development: Only localhost
- No more localhost in production!

### 5. ✅ Strong Password Policy
**File:** [server/utils/passwordValidator.js](server/utils/passwordValidator.js)
- Minimum 12 characters
- Requires: uppercase, lowercase, numbers, special chars
- Blocks common passwords
- Blocks sequential/repeated characters
- Password strength scoring

### 6. ✅ Breach Notification System
**File:** [server/services/breachNotification.service.js](server/services/breachNotification.service.js)
- Detects suspicious patterns
- Creates breach incidents
- Tracks 60-day notification deadline
- Alerts administrators
- Generates HIPAA-compliant reports

### 7. ✅ PHI Access Audit Logging
**File:** [server/middleware/auditLogger.js](server/middleware/auditLogger.js)
- Logs all PHI access
- Tracks who, what, when
- Stores in `audit_logs` table
- Generates compliance reports
- Sanitizes sensitive data

### 8. ✅ Database Migration
**File:** [database/migrations/create-breach-incidents-table.sql](database/migrations/create-breach-incidents-table.sql)
- Creates `breach_incidents` table
- RLS policies configured
- Indexes for performance

---

## 🔧 How to Integrate

### Step 1: Install Dependencies

```bash
cd /Users/rakeshpatel/Desktop/tshla-medical
npm install express-rate-limit
```

### Step 2: Apply Database Migration

Run this in Supabase SQL Editor:
```bash
# Copy contents of:
database/migrations/create-breach-incidents-table.sql
```

### Step 3: Update pump-report-api.js

Add these imports at the top:

```javascript
// Add after existing imports
const { corsOptions } = require('./middleware/corsConfig');
const {
  authLimiter,
  apiLimiter,
  phiLimiter,
  registrationLimiter
} = require('./middleware/rateLimiter');
const { validatePassword } = require('./utils/passwordValidator');
const { auditPHIAccess } = require('./middleware/auditLogger');
const cors = require('cors');
```

Replace CORS configuration:

```javascript
// REPLACE THIS:
app.use(cors({
  origin: [
    'http://localhost:5173',
    // ... old config
  ]
}));

// WITH THIS:
app.use(cors(corsOptions));
```

Add rate limiting:

```javascript
// After app.use(express.json())
// Add rate limiting to all API endpoints
app.use('/api/', apiLimiter);

// Add specific rate limiters to routes
app.post('/api/auth/login', authLimiter, ...); // Add authLimiter before handler
app.post('/api/auth/register', registrationLimiter, ...); // Add registrationLimiter

// Add PHI protection
app.use('/api/patients', phiLimiter, auditPHIAccess);
app.use('/api/pump-assessment', phiLimiter, auditPHIAccess);
app.use('/api/pump-report', phiLimiter, auditPHIAccess);
```

Update password validation in registration:

```javascript
// In /api/auth/register endpoint
// REPLACE the password validation section with:

const passwordCheck = validatePassword(password);
if (!passwordCheck.valid) {
  return res.status(400).json({
    error: 'Password does not meet security requirements',
    details: passwordCheck.errors,
    requirements: 'Password must be at least 12 characters with uppercase, lowercase, numbers, and special characters'
  });
}
```

### Step 4: Update unified-api.js

Same changes as Step 3, apply to `server/unified-api.js`

### Step 5: Add File Upload Protection

In any endpoint that accepts file uploads (CCD/XML):

```javascript
const {
  upload,
  validateUploadedXML,
  handleUploadError
} = require('./middleware/fileUploadValidator');

app.post('/api/ccd/upload',
  verifyToken,              // Existing auth
  upload.single('file'),    // NEW: File upload handling
  validateUploadedXML,      // NEW: Validation
  async (req, res) => {
    // Use req.validatedXML instead of req.body
    const xmlContent = req.validatedXML;
    // ... rest of code
  }
);

// Add error handler
app.use(handleUploadError);
```

---

## 🧪 Testing Checklist

### Test Rate Limiting:
```bash
# Test auth rate limit (should block after 5 attempts)
for i in {1..10}; do
  curl -X POST http://localhost:3002/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}'
  echo "Attempt $i"
done
```

### Test CORS:
```bash
# Should be blocked (wrong origin)
curl -X GET http://localhost:3002/api/health \
  -H "Origin: http://evil.com"

# Should work (allowed origin)
curl -X GET http://localhost:3002/api/health \
  -H "Origin: http://localhost:5173"
```

### Test Password Validation:
```bash
# Weak password (should fail)
curl -X POST http://localhost:3002/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"weak","firstName":"Test","lastName":"User"}'

# Strong password (should work)
curl -X POST http://localhost:3002/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test2@test.com","password":"MySecure!Pass123","firstName":"Test","lastName":"User"}'
```

### Test Audit Logging:
```bash
# Make PHI request
curl -X GET http://localhost:3002/api/patients/123 \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check audit_logs table in Supabase
SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 10;
```

---

## 📊 Environment Variables Needed

Add to your `.env`:

```bash
# Already have these:
NODE_ENV=production  # or development
VITE_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

# May need to add:
FRONTEND_URL=https://www.tshla.ai
```

---

## 🚀 Deployment Steps

### 1. Commit Changes
```bash
git add .
git commit -m "Phase 3: Security hardening - rate limiting, CORS, audit logging, breach detection

- Remove Twilio/Klara/Google TTS (no BAA)
- Add file upload validation (XXE protection)
- Implement rate limiting on all endpoints
- Fix CORS for production
- Strong password policy (12+ chars)
- Breach notification system
- PHI access audit logging

HIPAA Compliance improvements"
```

### 2. Push to GitHub
```bash
git push origin main
```

### 3. Verify Deployment
- GitHub Actions should trigger
- Check deployment logs
- Test production endpoints

### 4. Apply Database Migration
- Go to Supabase dashboard
- SQL Editor
- Run `create-breach-incidents-table.sql`

---

## ✅ Verification After Deployment

### 1. Check Security Headers
```bash
curl -I https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/health
# Should see rate limit headers
```

### 2. Test Rate Limits
```bash
# Spam endpoint - should get 429 after limit
for i in {1..150}; do
  curl https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/health
done
```

### 3. Check Audit Logs
```sql
-- In Supabase SQL Editor
SELECT COUNT(*) FROM audit_logs WHERE timestamp > NOW() - INTERVAL '1 hour';
-- Should show recent access logs
```

### 4. Verify CORS
```bash
# From browser console on tshla.ai:
fetch('https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/health')
  .then(r => console.log('CORS works!'))
  .catch(e => console.error('CORS blocked:', e));
```

---

## 📝 What to Tell Users

### Password Requirements Changed:
"Passwords now require:
- Minimum 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (!@#$%^&*)"

### Rate Limits Applied:
"To protect your data:
- Maximum 5 login attempts per 15 minutes
- Maximum 100 API requests per minute
- Maximum 3 account registrations per hour from same IP"

---

## 🎯 Success Criteria

Phase 3 is successfully deployed when:

- [ ] No Google TTS, Twilio, or Klara code in production
- [ ] Rate limiting responds with 429 when exceeded
- [ ] CORS blocks unauthorized origins
- [ ] Weak passwords are rejected
- [ ] audit_logs table populated with PHI access
- [ ] breach_incidents table exists
- [ ] All tests pass
- [ ] Production health check returns 200

---

## 🆘 Troubleshooting

### "Too many requests" errors:
- Rate limits may be too strict for your usage
- Adjust limits in `server/middleware/rateLimiter.js`

### CORS errors:
- Check `NODE_ENV` is set correctly
- Verify origin in `corsConfig.js`
- Check browser console for exact origin

### Audit logs not appearing:
- Check Supabase service role key is set
- Verify `audit_logs` table exists
- Check server logs for errors

### Password validation too strict:
- Requirements can be adjusted in `passwordValidator.js`
- Minimum 12 chars is HIPAA recommendation

---

## 📚 Next Steps After Phase 3

1. **Monitor audit logs** for unusual activity
2. **Review breach detection** alerts weekly
3. **Test disaster recovery** procedures
4. **Complete Phase 2C** (remaining console.log migrations)
5. **Implement MFA** (multi-factor authentication)
6. **Add security headers** (CSP, HSTS)
7. **Automate security scanning** (Snyk, npm audit)

---

**Created:** January 8, 2026
**Status:** Ready for Integration
**Next Review:** After deployment
