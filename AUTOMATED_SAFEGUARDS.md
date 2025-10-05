# Automated Safeguards

**Purpose:** Document all automated checks that prevent deployment failures.

**Last Updated:** 2025-10-04

---

## Overview

This document tracks all automated safeguards implemented to prevent repeating the deployment failures documented in [DEPLOYMENT_FAILURES.md](./DEPLOYMENT_FAILURES.md).

**Key Principle:** Never rely on manual verification. Automate everything.

---

## 1. Pre-Commit Validation (Git Hooks)

**Status:** ⏳ Pending Implementation

**Purpose:** Prevent bad code from being committed

**Location:** `.husky/pre-commit`

**Checks:**
- ✅ Build completes successfully
- ✅ `staticwebapp.config.json` exists in `public/` folder
- ✅ TypeScript type checking passes
- ✅ ESLint passes
- ✅ No console.log statements in production code
- ✅ No hardcoded credentials

**How to Bypass (Emergency Only):**
```bash
git commit --no-verify -m "message"
```

**Related Failures:** #5 (staticwebapp.config.json in wrong location)

---

## 2. Pre-Push Validation (Git Hooks)

**Status:** ⏳ Pending Implementation

**Purpose:** Prevent pushing broken code to GitHub

**Location:** `.husky/pre-push`

**Checks:**
- ✅ All unit tests pass
- ✅ Build artifacts exist in `dist/`
- ✅ `dist/staticwebapp.config.json` exists
- ✅ No TypeScript errors
- ✅ No merge conflicts

**How to Bypass (Emergency Only):**
```bash
git push --no-verify
```

**Related Failures:** #4, #5

---

## 3. Build Validation Script

**Status:** ✅ Implemented

**Purpose:** Verify build output is complete before deployment

**Location:** `scripts/validate-build.sh`

**Usage:**
```bash
npm run validate:build
```

**Checks:**
- ✅ `dist/` folder exists
- ✅ `dist/staticwebapp.config.json` exists
- ✅ `dist/index.html` exists
- ✅ `dist/assets/AdminBundle-*.js` exists
- ✅ `dist/assets/PumpComparisonManager-*.js` exists
- ✅ Asset files have proper hash suffixes

**Exit Code:** 1 if any check fails

**Related Failures:** #5 (404 on /admin/* routes due to missing config)

---

## 4. Database Validation Script

**Status:** ✅ Implemented

**Purpose:** Verify production database has all required data

**Location:** `scripts/validate-db-prod.js`

**Usage:**
```bash
npm run validate:db:prod
```

**Checks:**
- ✅ Can connect to production database
- ✅ Admin user (admin@tshla.ai) exists
- ✅ Admin user has valid password_hash
- ✅ 23 dimensions exist in `pump_comparison_data`
- ✅ 6 manufacturers exist in `pump_manufacturers`
- ✅ All required tables exist
- ✅ All required columns exist

**Exit Code:** 1 if any check fails

**Related Failures:** #1 (admin user missing), #2 (never verified production)

---

## 5. API Health Validation Script

**Status:** ✅ Implemented

**Purpose:** Comprehensive health checks for all production APIs

**Location:** `scripts/validate-api-health.sh`

**Usage:**
```bash
npm run validate:apis
```

**Checks Per API:**
- ✅ HTTP 200 status code
- ✅ Response time < 5000ms
- ✅ Valid JSON response
- ✅ `{"status": "ok"}` in response
- ✅ CORS headers present
- ✅ OPTIONS preflight request works

**APIs Tested:**
- Pump Report API
- Medical Auth API
- Schedule API

**Exit Code:** 1 if any check fails

**Related Failures:** #3 (CORS errors), #4 (Azure cached old image)

---

## 6. CORS Validation Script

**Status:** ✅ Implemented

**Purpose:** Deep CORS testing to prevent frontend errors

**Location:** `scripts/validate-api-cors.sh`

**Usage:**
```bash
npm run validate:cors
```

**Checks Per API:**
- ✅ `Access-Control-Allow-Origin` header includes production domain
- ✅ `Access-Control-Allow-Credentials: true`
- ✅ OPTIONS preflight returns 200 or 204
- ✅ `Access-Control-Allow-Methods` includes POST, GET, PUT, DELETE
- ✅ `Access-Control-Allow-Headers` includes Authorization, Content-Type
- ✅ Authenticated endpoints return 401 (not CORS error) with invalid token

**Exit Code:** 1 if any check fails

**Related Failures:** #3 (CORS errors in production)

---

## 7. Deployment Validation Script

**Status:** ✅ Implemented

**Purpose:** Verify entire production deployment is successful

**Location:** `scripts/validate-deployment.sh`

**Usage:**
```bash
npm run validate:deployment
```

**Checks:**
- ✅ Frontend root returns 200
- ✅ `/login` page returns 200
- ✅ `/admin/accounts` returns 200
- ✅ `/admin/pump-comparison` returns 200 (CRITICAL)
- ✅ All API health endpoints return 200
- ✅ CORS headers present on all APIs
- ✅ `staticwebapp.config.json` is accessible

**Exit Code:** 1 if any check fails

**Related Failures:** All 5 failures

---

## 8. Complete Validation Suite

**Status:** ✅ Implemented

**Purpose:** Run all validation checks in sequence

**Usage:**
```bash
npm run validate:all
```

**Runs:**
1. Build validation
2. Database validation
3. API health validation
4. CORS validation
5. Deployment validation

**Exit Code:** 1 if ANY check fails

**When to Run:**
- After every deployment
- Before marking deployment as "successful"
- In GitHub Actions workflows

---

## 9. GitHub Actions - Frontend Deployment

**Status:** ⏳ Pending Enhancement

**Purpose:** Automated validation during deployment

**Location:** `.github/workflows/deploy-frontend.yml`

**Planned Enhancements:**

### Pre-Build Validation
```yaml
- name: Validate Config Location
  run: |
    if [ ! -f "public/staticwebapp.config.json" ]; then
      echo "❌ staticwebapp.config.json must be in public/ folder"
      exit 1
    fi
```

### Post-Build Validation
```yaml
- name: Validate Build Output
  run: npm run validate:build
```

### Post-Deployment Validation
```yaml
- name: Wait for Deployment
  run: sleep 30

- name: Validate Deployment
  run: npm run validate:deployment

- name: Run E2E Smoke Tests
  run: npx playwright test --project=production-smoke
```

**Related Failures:** #5 (missing config file)

---

## 10. GitHub Actions - API Deployments

**Status:** ⏳ Pending Enhancement

**Purpose:** Force new container revisions and verify deployment

**Location:**
- `.github/workflows/deploy-pump-api-container.yml`
- `.github/workflows/deploy-auth-api-container.yml`

**Planned Enhancements:**

### Force New Revision
```yaml
- name: Build and Push Docker Image
  run: |
    docker build \
      --platform linux/amd64 \
      --build-arg DEPLOY_TIMESTAMP=$(date +%s) \
      -t $IMAGE_NAME .
    docker push $IMAGE_NAME
```

### Wait for Container Startup
```yaml
- name: Wait for Container Startup
  run: sleep 60
```

### Verify Deployment
```yaml
- name: Verify New Revision
  run: |
    NEW_REVISION=$(az containerapp revision list ...)
    if [ "$NEW_REVISION" == "$OLD_REVISION" ]; then
      echo "❌ Azure did not deploy new revision!"
      exit 1
    fi

- name: Validate API Health
  run: npm run validate:apis

- name: Validate CORS
  run: npm run validate:cors
```

**Related Failures:** #4 (Azure cached old Docker image)

---

## 11. Vite Build Plugin

**Status:** ⏳ Pending Implementation

**Purpose:** Fail build immediately if critical files missing

**Location:** `vite.config.ts`

**Planned Implementation:**
```typescript
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'validate-build',
      closeBundle() {
        const configPath = 'dist/staticwebapp.config.json';
        if (!fs.existsSync(configPath)) {
          throw new Error(
            '❌ staticwebapp.config.json missing from dist/\n' +
            '   This will cause 404 errors on /admin/* routes!\n' +
            '   Ensure file is in public/ folder.'
          );
        }
      }
    }
  ]
});
```

**Related Failures:** #5

---

## 12. Docker Health Checks

**Status:** ⏳ Pending Implementation

**Purpose:** Auto-restart unhealthy containers

**Location:**
- `Dockerfile.pump`
- `Dockerfile.auth`
- `Dockerfile.schedule`

**Planned Implementation:**
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"
```

**Benefits:**
- Azure automatically restarts unhealthy containers
- Prevents serving requests to broken APIs
- Quick detection of database connectivity issues

**Related Failures:** #4 (API deployed but not working)

---

## 13. E2E Production Smoke Tests

**Status:** ⏳ Pending Implementation

**Purpose:** Test critical user paths in production

**Location:** `tests/production-smoke.spec.ts`

**Planned Tests:**
```typescript
test('Admin can login and access pump comparison', async ({ page }) => {
  // Login
  await page.goto('https://mango-sky-0ba265c0f.1.azurestaticapps.net/login');
  await page.fill('[name="email"]', 'admin@tshla.ai');
  await page.fill('[name="password"]', 'AdminPass2025');
  await page.click('button[type="submit"]');

  // Navigate to pump comparison
  await page.goto('.../admin/pump-comparison');

  // Verify page loaded (not 404)
  expect(page.url()).toContain('/admin/pump-comparison');

  // Verify 23 dimensions loaded
  const rows = await page.locator('table tr').count();
  expect(rows).toBe(23);

  // Verify no CORS errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  expect(consoleErrors.filter(e => e.includes('CORS'))).toHaveLength(0);
});
```

**When to Run:**
- After every production deployment
- Before marking deployment as successful
- Scheduled daily at 6am

**Related Failures:** All 5 failures

---

## Enforcement Rules

### ❌ NEVER Say "Deployment Successful" Without:
1. Running `npm run validate:all` ✅
2. All checks passing ✅
3. Manual verification in production ✅
4. Completing [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) ✅
5. Adding entry to DEPLOYMENT_LOG.md ✅

### ❌ NEVER Deploy Without:
1. Pre-commit hooks passing ✅
2. Pre-push hooks passing ✅
3. Build validation passing ✅
4. GitHub Actions validation passing ✅

### ❌ NEVER Assume:
1. "Build succeeded" = "Config file deployed" ❌
2. "Docker image pushed" = "Azure pulled new image" ❌
3. "Code deployed" = "Database has required data" ❌
4. "Works locally" = "Works in production" ❌
5. "No errors in logs" = "CORS configured correctly" ❌

---

## Metrics to Track

### Deployment Success Rate
- **Goal:** 100% of deployments pass all validation checks
- **Current:** TBD (tracking starts after implementation)

### Mean Time to Detection (MTTD)
- **Goal:** < 60 seconds (automated checks detect issues immediately)
- **Current:** ~30 minutes (manual testing)

### False Positives
- **Goal:** < 5% (validation scripts rarely fail when deployment is actually good)

### False Negatives
- **Goal:** 0% (validation scripts NEVER pass when deployment is broken)

---

## Continuous Improvement

This document should be updated when:
1. New automated check is added
2. Existing check is enhanced
3. New failure mode is discovered
4. Validation script is modified

**Document Owner:** Development Team
**Review Cadence:** After every deployment failure
