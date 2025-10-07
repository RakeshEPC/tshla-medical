# Deployment Failure Log

## Purpose
Track every deployment failure, root cause, and prevention added.
**UPDATE THIS FILE whenever something breaks in production.**

---

## Failure #1 - Admin User Missing (2025-10-04)
**What we said:** "Admin user created, login should work"
**What happened:** `401 Unauthorized - Invalid email or password`
**Root cause:** Created user in local database, never verified production database had the user
**Prevention added:**
- `scripts/validate-db-prod.js` - Auto-checks admin user exists before deployment
- GitHub Action step that fails if admin user missing
- Pre-deployment checklist item to verify production DB

**Commit:** c4fe5ab0
**Date:** 2025-10-04

---

## Failure #2 - CORS Errors After "Fix" (2025-10-04)
**What we said:** "CORS fix deployed, APIs should work now"
**What happened:** Still getting CORS errors in production frontend
**Root cause:** Azure Container Apps cached old Docker image, didn't pull new image with CORS fix
**Prevention added:**
- GitHub Action now forces new revision by adding timestamp env var
- Post-deployment step checks revision number incremented
- Health check verifies CORS domain in response headers
- Documentation: Wait 60 seconds after deployment before testing

**Commit:** 7cf82ee4
**Date:** 2025-10-04

---

## Failure #3 - Password Special Characters Break JSON (2025-10-04)
**What we said:** "Admin password set to Admin2025!"
**What happened:** `500 Internal Server Error - JSON parse error on ! character`
**Root cause:** Express JSON middleware had strict validation that rejected escaped `\!`
**Prevention added:**
- Pre-commit hook validates test passwords are alphanumeric only
- API unit tests for special character handling
- Documentation: Use alphanumeric passwords for test/admin accounts
- Updated password to `AdminPass2025` (no special chars)

**Commit:** [manual fix]
**Date:** 2025-10-04

---

## Failure #4 - Azure Container Apps Didn't Pull New Image (2025-10-04)
**What we said:** "Deployed new Docker image with all fixes"
**What happened:** Production still running old code, revision number didn't change
**Root cause:** Azure cached Docker image by digest, `--image latest` didn't force pull
**Prevention added:**
- Add timestamp env var to force new revision: `DEPLOY_TIME=$(date +%s)`
- GitHub Action checks revision number incremented
- Post-deployment verification waits 60s then tests health endpoint
- Script to compare revision numbers before/after deployment

**Commit:** [GitHub Actions update]
**Date:** 2025-10-04

---

## Failure #5 - staticwebapp.config.json Not Deployed (2025-10-04)
**What we said:** "Frontend deployed with PumpComparisonManager, should work"
**What happened:** `404 Not Found` on all `/admin/*` routes
**Root cause:**
- `staticwebapp.config.json` was in root directory
- Vite only copies files from `public/` folder to `dist/`
- GitHub Actions deploys only `dist/` folder
- Azure Static Web Apps had no routing rules, returned 404

**Prevention added:**
- Moved `staticwebapp.config.json` from root to `public/` folder
- Vite plugin validates config exists in `public/` and auto-copies to `dist/`
- `scripts/validate-build.sh` checks `dist/staticwebapp.config.json` exists
- Pre-commit hook blocks commits if config not in `public/`
- GitHub Action runs build validation before deploying
- Post-deployment test curls admin routes to verify 200 (not 404)

**Commit:** [current]
**Date:** 2025-10-04

---

## TEMPLATE - Copy This for Future Failures

```markdown
## Failure #X - [Brief Description] (YYYY-MM-DD)
**What we said:** "[What we claimed would work]"
**What happened:** "[Actual error/behavior]"
**Root cause:** "[Why it actually failed]"
**Prevention added:**
- [Automated check #1]
- [Automated check #2]
- [Documentation update]

**Commit:** [git hash]
**Date:** YYYY-MM-DD
```

---

## Statistics

**Total Failures:** 5
**Failures with Automated Prevention:** 5 (100%)
**Average Time to Fix:** ~30 minutes
**Longest Failure:** #5 (staticwebapp.config) - required multiple attempts

## Lessons Learned

1. **NEVER assume deployment worked** - Always verify with actual production tests
2. **Azure caches aggressively** - Force new revisions with env var changes
3. **Test the artifact** - Verify dist/ folder contains what you expect
4. **Document immediately** - Write down failures while context is fresh
5. **Automate prevention** - Turn every failure into an automated check
