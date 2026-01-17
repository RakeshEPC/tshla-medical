# HIPAA Compliance - High Priority Implementation Guide
**TSHLA Medical**
**Created:** January 17, 2026
**Status:** Ready to Execute

## Overview

This guide provides step-by-step instructions for implementing the 3 highest priority HIPAA compliance tasks:

1. **Migrate Secrets to Azure Key Vault** (3-5 days)
2. **Backup Restoration Test** (2-3 days)
3. **Console.log → Logger Migration** (7-10 days)

**Total Timeline:** 15 days (can run tasks in parallel)

---

## Task 1: Migrate Secrets to Azure Key Vault

### Priority: 🔴 CRITICAL
**HIPAA Requirement:** §164.312(a)(2)(iv) - Encryption and Key Management
**Current Risk:** `.env` file in working directory could be accidentally committed
**Timeline:** 3-5 days

### Prerequisites
- Azure CLI installed and configured
- Access to Azure subscription
- Container App deployed and running
- `.env` file with current secrets

### Step-by-Step Instructions

#### Day 1: Setup Azure Key Vault (2 hours)

```bash
# Navigate to project directory
cd /Users/rakeshpatel/Desktop/tshla-medical

# Run setup script
./scripts/hipaa/01-setup-key-vault.sh
```

**What this does:**
- Creates Azure Key Vault: `tshla-kv-prod`
- Enables purge protection (90-day recovery)
- Configures your user access
- Enables Managed Identity on Container App
- Grants Container App access to Key Vault

**Verification:**
```bash
# Check Key Vault exists
az keyvault show --name tshla-kv-prod

# Check Managed Identity enabled
az containerapp identity show \
  --name tshla-unified-api \
  --resource-group tshla-medical-rg
```

#### Day 2: Migrate Secrets (3 hours)

```bash
# Run migration script
./scripts/hipaa/02-migrate-secrets.sh
```

**Secrets migrated:**
- `SUPABASE_SERVICE_ROLE_KEY` → Full database access
- `AZURE_OPENAI_KEY` → AI processing
- `JWT_SECRET` → Authentication
- `VITE_DEEPGRAM_API_KEY` → Medical transcription
- `ELEVENLABS_API_KEY` → AI voice
- `STRIPE_SECRET_KEY` → Payment processing
- `VITE_SUPABASE_ANON_KEY` → Public key
- `VITE_SUPABASE_URL` → Public URL

**Verification:**
```bash
# List secrets in Key Vault
az keyvault secret list --vault-name tshla-kv-prod -o table

# View a secret (test access)
az keyvault secret show --vault-name tshla-kv-prod --name JWT-SECRET --query value
```

#### Day 3: Configure Container App (2 hours)

```bash
# Run configuration script
./scripts/hipaa/03-configure-container-app.sh
```

**What this does:**
- Configures Container App secrets to reference Key Vault
- Updates environment variables to use secret references
- Triggers Container App restart with new configuration

**Verification:**
```bash
# Check Container App status
az containerapp show \
  --name tshla-unified-api \
  --resource-group tshla-medical-rg \
  --query properties.runningStatus

# Should return: "Running"
```

#### Day 4-5: Test & Validate (4 hours)

**Health Check:**
```bash
# Test main health endpoint
curl https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/health

# Expected response:
# {"status":"healthy","service":"tshla-unified-api",...}
```

**API Testing:**
```bash
# Test authentication endpoint
curl -X POST https://tshla-unified-api.../api/medical/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'

# Should return: JWT token or appropriate error
```

**Monitor Logs:**
```bash
# Check for errors
az containerapp logs show \
  --name tshla-unified-api \
  --resource-group tshla-medical-rg \
  --tail 100 | grep -i error

# Should show no Key Vault-related errors
```

**Functional Tests:**
- [ ] User login works
- [ ] Patient data loads
- [ ] Appointments display
- [ ] Dictation transcription works
- [ ] Pump recommendations generate
- [ ] No 500 errors in logs

#### Day 5: Secure .env Files (1 hour)

**IMPORTANT:** Only do this after all tests pass!

```bash
# Backup .env file (encrypted)
gpg --encrypt --recipient security@tshla.ai .env
mv .env.gpg ~/secure-backups/tshla-env-backup-$(date +%Y-%m-%d).gpg

# Remove from working directory
rm .env
rm .env.production

# Verify .gitignore contains .env
cat .gitignore | grep "^.env"

# Create local dev override (optional)
cat > .env.local <<EOF
# Local development only - NOT committed
# Production uses Azure Key Vault
VITE_SUPABASE_URL=https://minvvjdflezibmgkplqb.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJ... # Safe to use locally
# Add other non-sensitive dev values
EOF
```

### Success Criteria
- ✅ Azure Key Vault created: `tshla-kv-prod`
- ✅ 8 secrets migrated successfully
- ✅ Container App using Managed Identity
- ✅ All API endpoints functional
- ✅ `.env` files removed from working directory
- ✅ Encrypted backup stored securely

### Troubleshooting

**Issue:** Container App won't start
```bash
# Check logs for specific error
az containerapp logs show -n tshla-unified-api -g tshla-medical-rg --tail 200

# Common causes:
# 1. Secret name mismatch - verify exact names in Key Vault
# 2. Access policy issue - re-run step 1 script
# 3. Invalid secret value - check secret in portal
```

**Issue:** "Forbidden" errors accessing Key Vault
```bash
# Re-grant access
PRINCIPAL_ID=$(az containerapp identity show \
  --name tshla-unified-api \
  --resource-group tshla-medical-rg \
  --query principalId -o tsv)

az keyvault set-policy \
  --name tshla-kv-prod \
  --object-id $PRINCIPAL_ID \
  --secret-permissions get list
```

---

## Task 2: Backup Restoration Test

### Priority: 🟠 HIGH
**HIPAA Requirement:** §164.308(a)(7)(ii)(B) - Tested Contingency Plan
**Objective:** Verify RTO (4 hours) and RPO (1 hour) targets
**Timeline:** 2-3 days

### Prerequisites
- Access to Supabase Dashboard
- Production database credentials
- `psql` installed (optional)

### Step-by-Step Instructions

#### Day 1: Create Test Environment (3 hours)

**Option A: Supabase Point-in-Time Recovery (Recommended)**

1. Login to Supabase Dashboard: https://supabase.com/dashboard
2. Select production project: `minvvjdflezibmgkplqb`
3. Navigate to: **Database** → **Backups**
4. Click: **Point in Time Recovery**
5. Select: Yesterday's date/time
6. Click: **Restore to new project**
7. Name: `tshla-dr-test-2026-01-17`
8. Wait: 15-30 minutes for completion

**Option B: Manual SQL Dump**

```bash
# Export from production
pg_dump "postgresql://postgres:[PROD_PASSWORD]@db.minvvjdflezibmgkplqb.supabase.co:5432/postgres" \
  > backup_dr_test_$(date +%Y%m%d).sql

# Create new Supabase project via dashboard
# Then import:
psql "postgresql://postgres:[TEST_PASSWORD]@db.[test-project].supabase.co:5432/postgres" \
  < backup_dr_test_20260117.sql
```

**Record Start Time:** Document when restoration began (for RTO calculation)

#### Day 2: Run Validation (3 hours)

```bash
# Navigate to test project in Supabase Dashboard
# Go to: SQL Editor → New Query

# Copy and paste entire contents of:
# scripts/hipaa/04-validate-dr-restore.sql

# Or run via psql:
psql "postgresql://postgres:[TEST_PASSWORD]@db.[test-project].supabase.co:5432/postgres" \
  -f scripts/hipaa/04-validate-dr-restore.sql \
  > tests/dr-validation-results-$(date +%Y-%m-%d).txt
```

**Review Results:**

Check for:
- ✅ All tables present (~40 tables)
- ✅ RLS policies intact on PHI tables
- ✅ Data is fresh (< 24 hours old)
- ✅ Audit logs contain recent activity
- ✅ No null IDs or data corruption
- ✅ User accounts restored

**Record End Time:** Document when validation completed (for RTO calculation)

#### Day 3: Document & Cleanup (2 hours)

**Create Test Report:**

```markdown
# Disaster Recovery Test Report
**Date:** January 17, 2026
**Performed By:** [Your Name]
**Test Type:** Full Backup Restoration

## Test Results

### Metrics
| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Restoration Time (RTO) | < 4 hours | [X.X] hours | ✅/❌ |
| Data Loss (RPO) | < 1 hour | [X] hours | ✅/❌ |
| Tables Restored | 100% | [X]% | ✅/❌ |
| RLS Policies | 100% | [X]% | ✅/❌ |
| Records Validated | 100% | [X]% | ✅/❌ |

### Data Validation
- Total tables: [X]
- Total records: [X]
- RLS policies: [X]
- Latest data timestamp: [YYYY-MM-DD HH:MM]
- Audit log events (7 days): [X]

### Issues Found
[None / List any issues]

### Recommendations
1. [Any improvements]
2. Schedule next test: April 17, 2026
3. [Other recommendations]

**Test Status:** ✅ PASSED / ❌ FAILED

**Signed:**
- IT Lead: _____________ Date: _______
- Compliance Officer: _____________ Date: _______
```

**Save as:** `tests/dr-tests/2026-01-17/DR_TEST_REPORT.md`

**Cleanup Test Environment:**
```bash
# Delete test Supabase project
# Dashboard → Settings → General → Danger Zone → Delete Project

# Archive test results
mkdir -p tests/dr-tests/2026-01-17/
mv tests/dr-validation-results-*.txt tests/dr-tests/2026-01-17/
```

**Update Documentation:**

Edit: `docs/policies/BACKUP-PROCEDURES.md`
```markdown
## Restoration Testing
- **Last Test:** January 17, 2026 - ✅ PASSED
- **RTO Achieved:** [X.X] hours (Target: 4 hours)
- **RPO Achieved:** [X] hours (Target: 1 hour)
- **Next Test:** April 17, 2026
```

### Success Criteria
- ✅ Backup restored to test environment
- ✅ All tables present (100%)
- ✅ RLS policies verified (100%)
- ✅ Data freshness < 24 hours
- ✅ RTO met (< 4 hours)
- ✅ RPO met (< 1 hour)
- ✅ Test documented and signed
- ✅ Next test scheduled

---

## Task 3: Console.log → Logger Migration

### Priority: 🟡 MEDIUM-HIGH
**HIPAA Requirement:** §164.308(a)(1)(ii)(D) - Proper Logging Controls
**Current Issue:** 1,612 console statements may expose PHI
**Timeline:** 7-10 days

### Strategy: Focus on Top 10 Critical Files

We'll migrate only the **most critical PHI-handling files** first:

**Priority 1 (Critical):**
1. `server/api/patient-chart-api.js` - Patient medical records
2. `server/routes/patient-summaries-api.js` - Clinical summaries
3. `server/medical-auth-api.js` - Authentication logs
4. `server/unified-api.js` - Main API (all traffic)
5. `server/pump-report-api.js` - Insulin pump reports

**Priority 2 (High):**
6. `server/patient-summary-api.js` - Patient summaries
7. `server/services/patient-extraction.js` - Extract patient data
8. `server/services/patientMatching.service.js` - Match records
9. `server/services/call-database.js` - Call logs with PHI
10. `server/services/patient.service.ts` - Core patient service

### Safe Logging Patterns

**✅ SAFE to log:**
- Patient ID (UUID/numeric)
- Resource type ('patient', 'appointment')
- Action ('create', 'update', 'delete')
- Aggregate counts
- Timestamps
- Error codes (sanitized)
- IP addresses
- User IDs

**❌ NEVER log:**
- Patient names
- Date of birth
- SSN / MRN
- Addresses / Phone / Email
- Diagnoses / Conditions
- Medications
- Lab results
- Clinical notes content
- Passwords / API keys

### Migration Pattern

**Before (❌ PHI exposure):**
```javascript
console.log('Fetching patient:', patient.name, patient.dob);
console.log('Patient data:', patient);
console.error('Failed:', error);
```

**After (✅ HIPAA-compliant):**
```javascript
const logger = require('../logger');

logger.info('PatientChart', 'Fetching patient chart', {
  patientId: patient.id,  // ✅ ID is OK
  userId: req.user.id     // ✅ Who accessed
  // ❌ DO NOT log: name, dob, ssn, diagnosis
});

logger.debug('PatientChart', 'Chart retrieved', {
  patientId: patient.id,
  fieldCount: Object.keys(patient).length  // ✅ Aggregate
  // ❌ DO NOT log: actual patient data
});

logger.error('PatientChart', 'Failed to fetch', {
  patientId: patient.id,
  error: error.message,  // Message only
  errorCode: error.code
  // ❌ DO NOT log: stack traces with data
});
```

### Step-by-Step Instructions

#### Day 1: Preparation (1 hour)

```bash
# Run prep script
./scripts/hipaa/05-migrate-console-logs.sh
```

This creates backups and reports console usage.

#### Day 2-9: File-by-File Migration (~1 hour per file)

**For each file:**

1. **Add logger import** (if not present):
```javascript
const logger = require('../logger');  // Adjust path as needed
```

2. **Replace console.log**:
```javascript
// Find:
console.log('message', data);

// Replace with:
logger.info('ModuleName', 'message', { sanitizedData });
```

3. **Replace console.error**:
```javascript
// Find:
console.error('error', error);

// Replace with:
logger.error('ModuleName', 'error occurred', {
  error: error.message,
  code: error.code
});
```

4. **Sanitize all data**:
```javascript
// Create sanitize function
function sanitizePatient(patient) {
  return {
    id: patient.id,                    // ✅ OK
    hasRecords: !!patient.records,     // ✅ Boolean
    recordCount: patient.records?.length  // ✅ Count
    // ❌ Exclude: name, dob, ssn, etc.
  };
}

logger.info('Module', 'Patient accessed', sanitizePatient(patient));
```

5. **Test the file**:
```bash
# Restart server
npm run server:start

# Test the specific endpoint
curl http://localhost:3000/[endpoint]

# Check logs for proper format
tail -f server/logs/combined.log
```

6. **Move to next file**

**Daily Target:** 1-2 files per day

#### Day 10: Add Linting (1 hour)

**Update ESLint config:**

Create/edit: `.eslintrc.js` or `eslint.config.js`
```javascript
module.exports = {
  rules: {
    'no-console': ['warn', {
      allow: []  // No console allowed in production code
    }]
  },
  overrides: [
    {
      files: ['scripts/**', 'tests/**'],
      rules: {
        'no-console': 'off'  // Allow in scripts/tests
      }
    }
  ]
};
```

**Test linting:**
```bash
npm run lint

# Should show warnings for any remaining console statements
```

### Success Criteria
- ✅ 10 critical files migrated
- ✅ Logger imported in all files
- ✅ console.log → logger.info/debug
- ✅ console.error → logger.error
- ✅ PHI sanitized (no names/DOB/SSN)
- ✅ ESLint rules added
- ✅ All tests passing

---

## Timeline Summary

| Week | Tasks | Effort |
|------|-------|--------|
| **Week 1** | Key Vault setup, secret migration, Container App config | 12 hours |
| **Week 2** | Key Vault testing, DR test setup & execution | 10 hours |
| **Week 3** | Logging migration (2 files/day), ESLint, final testing | 12 hours |

**Total:** 34 hours over 15 days

---

## Contact & Support

**For Issues:**
- Azure Key Vault: Azure Portal Support
- Supabase: support@supabase.com
- HIPAA Compliance: compliance@tshla.ai

**Emergency Rollback:**
- Key Vault: Restore from GitHub Secrets temporarily
- DR Test: No impact (test environment only)
- Logging: Restore from .pre-migration.bak files

---

**Document Version:** 1.0
**Last Updated:** January 17, 2026
**Next Review:** February 17, 2026
