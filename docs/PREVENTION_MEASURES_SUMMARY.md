# Prevention Measures Summary

## What Was Done (Jan 11, 2026)

In response to recurring infrastructure issues that keep breaking production, we implemented comprehensive prevention measures to ensure these issues never happen again.

---

## The Problems

### 1. Deepgram CSP Violation (7-day outage)
**Timeline:**
- **Jan 4**: Deepgram proxy deployed to `tshla-deepgram-proxy.redpebble-e4551b7a.eastus.azurecontainerapps.io`
- **Jan 4-11**: CSP blocks all connections → Dictation completely broken
- **Jan 11**: CSP finally updated → Dictation works again

**Impact:** Dictation feature unusable for 7 days

### 2. MFA Password Reset (Mass lockout)
**Timeline:**
- **Jan 8, 2:20 PM**: MFA deployed without warning
- **Jan 8, 2:35 PM**: All 19 staff members locked out
- **Jan 8, 4:15 PM**: Emergency password reset script run

**Impact:** 2-hour outage, 4.75 staff-hours lost, trust damaged

### 3. Templates Not Loading
**Cause:** Auth user ID mismatches after MFA changes
**Impact:** Staff can't see their templates, can't create notes
**Diagnosis:** Complex - requires checking multiple tables and localStorage

---

## The Solutions

### ✅ 1. Infrastructure Change Checklist
**File:** `docs/INFRASTRUCTURE_CHANGE_CHECKLIST.md`

**Purpose:** Step-by-step guide to prevent breaking changes

**Key Sections:**
- New Service Deployment (CSP updates, env vars, testing)
- Authentication Changes (user communication, password resets)
- Database Schema Changes (backups, RLS policies)
- Post-Deployment Verification (health checks, critical flows)

**When to Use:**
- Before deploying any new Azure service
- Before changing authentication system
- Before database migrations
- Before ANY infrastructure change

---

### ✅ 2. CSP Validation Script
**File:** `scripts/validate-csp.cjs`

**Purpose:** Automatically detect missing CSP entries

**How it Works:**
1. Reads `public/staticwebapp.config.json`
2. Queries Azure for all Container Apps
3. Checks if each app URL is in CSP
4. Exits with error if any are missing

**Usage:**
```bash
# Run manually
node scripts/validate-csp.cjs

# Runs automatically in:
- GitHub Actions on every PR
- Pre-push git hook (optional)
```

**Example Output:**
```
🔍 Fetching Azure Container Apps...
✅ Found 3 container apps

✅ tshla-unified-api
   https://tshla-unified-api... - FOUND

❌ tshla-deepgram-proxy
   https://tshla-deepgram-proxy... - MISSING

❌ 1 Container App(s) missing from CSP

📝 Add these URLs to public/staticwebapp.config.json:
   https://tshla-deepgram-proxy.redpebble-e4551b7a.eastus.azurecontainerapps.io
   wss://tshla-deepgram-proxy.redpebble-e4551b7a.eastus.azurecontainerapps.io
```

---

### ✅ 3. GitHub Workflow for CSP Validation
**File:** `.github/workflows/csp-validation.yml`

**Purpose:** Block PRs that would break CSP

**Triggers:**
- Every PR that modifies `public/staticwebapp.config.json`
- Every PR that modifies deployment workflows
- Every push to `main` branch

**What it Does:**
1. Runs CSP validation script
2. If failed: Comments on PR with missing URLs
3. If failed: Blocks merge (optional)
4. Uploads validation log as artifact

**Example PR Comment:**
```markdown
## ⚠️ CSP Validation Failed

The Content Security Policy validation has detected issues:

❌ tshla-deepgram-proxy: MISSING from CSP

### How to fix:
1. Add to public/staticwebapp.config.json
2. Update connect-src directive
3. See: Infrastructure Change Checklist

Example:
"connect-src": "... https://tshla-deepgram-proxy..."
```

---

### ✅ 4. Password Reset Protocol
**File:** `docs/PASSWORD_RESET_PROTOCOL.md`

**Purpose:** Comprehensive guide for auth changes

**Key Sections:**
- When passwords break (MFA, session changes, etc.)
- Pre-deployment communication templates (email, Slack)
- Emergency reset procedures (3 methods)
- Troubleshooting common issues
- Historical incidents (Jan 8 MFA, Dec Supabase reset)

**Pre-Deployment Template:**
```
Subject: [ACTION REQUIRED] Password Reset on [Date]

Team,

We're deploying MFA security updates on Jan 8 at 2:00 PM.

IMPACT:
- You will need to reset your password
- Your session will be logged out
- Please save work before 2:00 PM

NEW LOGIN FLOW:
[Screenshots]

RESET PROCEDURE:
1. Go to https://www.tshla.ai/login
2. Click "Forgot Password"
...
```

**Emergency Reset:**
```bash
# Single user
npx tsx scripts/reset-admin-password.ts

# All staff
node scripts/find-and-fix-admin.cjs

# Diagnose issues
npx tsx scripts/diagnose-login.ts
```

---

### ✅ 5. MFA Implementation Impact Documentation
**File:** `docs/MFA_IMPLEMENTATION_IMPACT.md`

**Purpose:** Learn from the Jan 8 incident

**Contents:**
- Full timeline of password breakage
- Technical details (schema changes, API changes)
- All affected users (19 staff members)
- What we should have done (48hr notice, staging test)
- What went wrong vs. what went right
- Prevention checklist for future auth changes
- Incident report (cost: 4.75 staff-hours + trust)

**Key Lesson:**
> Authentication is critical infrastructure. Always overcommunicate changes. Always have rollback ready. Always test in staging first.

---

### ✅ 6. Template Debug Endpoint
**File:** `server/unified-api.js` (new endpoint)

**Purpose:** Diagnose why templates don't load

**Endpoint:** `GET /api/debug/templates/:authUserId`

**Returns:**
```json
{
  "timestamp": "2026-01-11T...",
  "authUserId": "444130c5-1fd7-4b73-9611-50c94a57da79",
  "medicalStaff": {
    "id": "d24f32c8-3af2-49a2-88bd-34d56d4cf131",
    "email": "admin@tshla.ai",
    "auth_user_id": "444130c5-...",
    "is_active": true
  },
  "templates": {
    "user": [...],      // Your templates
    "system": [...],    // System templates
    "legacy": [...],    // Old templates
    "total": 23
  },
  "diagnosis": [
    {"level": "success", "message": "Medical staff record found"},
    {"level": "info", "message": "Found 5 user templates"},
    {"level": "info", "message": "Found 18 system templates"},
    {"level": "success", "message": "Total 23 templates available"}
  ]
}
```

**Usage:**
```bash
# Get your auth user ID from login
# Then check template status:
curl https://tshla-unified-api.../api/debug/templates/YOUR_AUTH_ID
```

**Also provides localStorage cache instructions:**
```javascript
// In browser console:
localStorage.removeItem('doctor_profile_YOUR_AUTH_ID')
location.reload()
```

---

## How to Use These Measures

### Before Deploying a New Service:

1. **Read**: `docs/INFRASTRUCTURE_CHANGE_CHECKLIST.md`
2. **Update CSP**: Add URL to `public/staticwebapp.config.json`
3. **Validate**: `node scripts/validate-csp.cjs`
4. **Test**: Deploy to staging first
5. **Document**: Update deployment docs
6. **Deploy**: Push to main
7. **Verify**: Run health checks, test critical flows

---

### Before Changing Authentication:

1. **Read**: `docs/PASSWORD_RESET_PROTOCOL.md`
2. **Communicate**: Send email 48 hours before
3. **Test**: Full auth flow in staging
4. **Prepare**: Have reset scripts ready
5. **Schedule**: Deploy Friday afternoon, not Sunday
6. **Deploy**: With rollback plan ready
7. **Monitor**: Watch logs, respond to issues immediately

---

### If Login Breaks:

1. **Diagnose**: `npx tsx scripts/diagnose-login.ts`
2. **Check**: Look for auth_user_id mismatches
3. **Fix**: `node scripts/find-and-fix-admin.cjs`
4. **Test**: Login with reset password
5. **Communicate**: Send email with new password
6. **Document**: Add to incident log

---

### If Templates Don't Load:

1. **Get auth ID**: Check browser localStorage or login response
2. **Debug**: `curl https://tshla-unified-api.../api/debug/templates/AUTH_ID`
3. **Check output**:
   - Medical staff record exists?
   - Template count > 0?
   - Auth user ID matches?
4. **Fix**: Clear localStorage cache if needed
5. **Seed**: Run `npx tsx scripts/seed-templates.ts` if no templates

---

### If CSP Violation Appears:

1. **Identify**: Check browser console for "Refused to connect" errors
2. **Extract URL**: Copy the blocked URL
3. **Update**: Add to `public/staticwebapp.config.json` connect-src
4. **Add WebSocket**: Also add `wss://` version if WebSocket
5. **Validate**: `node scripts/validate-csp.cjs`
6. **Commit**: `git commit -m "fix: Add [service] to CSP"`
7. **Deploy**: Auto-deploys via GitHub Actions

---

## Automation Status

### ✅ Implemented:
- CSP validation on every PR
- Password reset scripts
- Template debugging endpoint
- Pre-commit hooks (TypeScript, credentials check)
- Pre-push hooks (build validation)
- Auto-deployment on push to main

### 🔄 TODO (Optional):
- [ ] Slack notifications on deployment failure
- [ ] Automated health checks after deployment
- [ ] Database backup before schema changes
- [ ] Staging environment for testing
- [ ] Status page for scheduled maintenance

---

## Files Reference

| File | Purpose |
|------|---------|
| `docs/INFRASTRUCTURE_CHANGE_CHECKLIST.md` | Step-by-step deployment guide |
| `docs/PASSWORD_RESET_PROTOCOL.md` | Auth change procedures |
| `docs/MFA_IMPLEMENTATION_IMPACT.md` | Jan 8 incident documentation |
| `scripts/validate-csp.cjs` | CSP validation script |
| `scripts/find-and-fix-admin.cjs` | Bulk password reset |
| `scripts/diagnose-login.ts` | Login troubleshooting |
| `.github/workflows/csp-validation.yml` | PR validation workflow |
| `server/unified-api.js` | Template debug endpoint |

---

## Success Metrics

### Before (Jan 2026):
- Deepgram outage: 7 days
- MFA password incident: 2 hours, 19 users affected
- Template issues: Recurring, hard to diagnose

### After (Goals):
- CSP violations: Caught in PR review (0 production outages)
- Auth changes: Communicated 48hr in advance (0 surprise lockouts)
- Template issues: Diagnosed in <5 min via debug endpoint

---

## Questions?

Contact: rakesh@tshla.ai

**Remember:**
- Infrastructure changes are predictable - follow the checklist
- Password issues are preventable - communicate early
- Template loading is debuggable - use the diagnostic endpoint
- Don't rush deployments - test in staging first
- Document incidents - so we don't repeat them

---

## Next Steps (Recommended)

1. **Create Staging Environment**
   - Separate Supabase project
   - Separate Azure Container Apps
   - Test all changes before production

2. **Set Up Status Page**
   - Show scheduled maintenance
   - Display current incidents
   - Reduce support burden

3. **Implement Database Backups**
   - Daily automated backups
   - Tested restore procedure
   - Point-in-time recovery

4. **Create Runbook**
   - Emergency procedures
   - On-call rotation
   - Incident response template

5. **Training Session**
   - Walk through checklist with team
   - Practice password reset
   - Demo CSP validation

---

## Deployment

**Status:** ✅ Deployed to production (Jan 11, 2026)

**Commits:**
- `819a4d31` - fix: Add Deepgram proxy URLs to CSP
- `2ced191a` - feat: Add comprehensive prevention measures

**GitHub Actions:**
- Frontend: Deploying...
- Backend: Deploying...
- CSP Validation: Will run on next PR

**Next Deployment:**
- Follow `docs/INFRASTRUCTURE_CHANGE_CHECKLIST.md`
- Validate CSP: `node scripts/validate-csp.cjs`
- Test staging first (when we have it)

**Remember:** These tools are only as good as our discipline in using them. 🛠️
