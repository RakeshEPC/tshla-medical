# Infrastructure Change Checklist

## Purpose
This checklist prevents breaking changes when deploying new services or infrastructure updates. **USE THIS BEFORE EVERY DEPLOYMENT** that involves new services, APIs, proxies, or authentication changes.

---

## New Service Deployment Checklist

### ✅ Before Deploying a New Container App / API / Proxy

- [ ] **Add URL to Content Security Policy**
  - File: `public/staticwebapp.config.json`
  - Add to `connect-src` directive if it's an API/WebSocket
  - Add to `frame-src` if it needs to be embedded
  - Add both `https://` and `wss://` versions for WebSocket services

  Example:
  ```json
  "connect-src": "... https://new-service.redpebble-e4551b7a.eastus.azurecontainerapps.io wss://new-service.redpebble-e4551b7a.eastus.azurecontainerapps.io"
  ```

- [ ] **Test CSP in staging/local**
  - Open browser DevTools (F12)
  - Check Console for CSP violations
  - Verify service is reachable
  - Test WebSocket connections if applicable

- [ ] **Update environment variables**
  - Add to `.env` for local development
  - Add to Azure Static Web Apps configuration
  - Add to Azure Container Apps secrets if needed
  - Document in `docs/ENVIRONMENT_VARIABLES.md`

- [ ] **Update deployment documentation**
  - Add service to `docs/DEPLOYMENT_GUIDE.md`
  - Document health check endpoint
  - Note any dependencies on other services

---

## Authentication/Security Changes Checklist

### ✅ Before Deploying Auth Changes (MFA, Password Policies, Session Management)

- [ ] **Document password impact**
  - Will this force password resets? → Document in commit message
  - Will this invalidate existing sessions? → Warn users in advance
  - Will this change login flow? → Update login documentation

- [ ] **Communicate to users**
  - Email all staff members 24-48 hours before deployment
  - Provide password reset instructions
  - Include login troubleshooting steps
  - Set up support channel (Slack/email) for questions

- [ ] **Test password reset flow**
  - Verify `scripts/reset-admin-password.ts` still works
  - Test `scripts/find-and-fix-admin.cjs` with new auth system
  - Ensure medical_staff ↔ auth.users linkage remains intact

- [ ] **Update auth documentation**
  - Document new auth flow in `docs/AUTHENTICATION.md`
  - Note breaking changes in CHANGELOG.md
  - Update password requirements if changed

---

## Database Schema Changes Checklist

### ✅ Before Deploying Database Migrations

- [ ] **Backup database**
  - Run backup script before migration
  - Test restore process
  - Document backup location

- [ ] **Test migration locally**
  - Run migration on local Supabase
  - Verify data integrity
  - Test rollback procedure

- [ ] **Check RLS policies**
  - Ensure new columns/tables have proper RLS
  - Test with different user roles
  - Verify HIPAA compliance maintained

- [ ] **Update TypeScript types**
  - Regenerate types if using supabase-js
  - Update interface definitions
  - Fix TypeScript errors

---

## Content Security Policy (CSP) Quick Reference

### Common CSP Violations & Fixes

**Error**: `Refused to connect to 'https://new-service...' because it violates CSP`

**Fix**: Add URL to `public/staticwebapp.config.json`:

```json
{
  "globalHeaders": {
    "Content-Security-Policy": "... connect-src 'self' https://new-service... ..."
  }
}
```

### Current Approved Domains (as of Jan 2026)

**APIs**:
- `https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io`
- `https://tshla-pump-api-container.redpebble-e4551b7a.eastus.azurecontainerapps.io`
- `https://tshla-deepgram-proxy.redpebble-e4551b7a.eastus.azurecontainerapps.io`

**External Services**:
- `https://api.deepgram.com` (wss:// also)
- `https://api.openai.com`
- `https://api.stripe.com`
- `https://minvvjdflezibmgkplqb.supabase.co` (wss:// also)

**Azure OpenAI**:
- `https://tshla-openai-prod.openai.azure.com`
- `https://tshla-openai-prod-eastus2.openai.azure.com`

---

## Post-Deployment Verification

### ✅ After Every Deployment

- [ ] **Check deployment status**
  ```bash
  gh run list --workflow=deploy-frontend.yml --limit 1
  gh run list --workflow=deploy-unified-container-app.yml --limit 1
  ```

- [ ] **Verify health endpoints**
  ```bash
  curl https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/health
  curl https://tshla-deepgram-proxy.redpebble-e4551b7a.eastus.azurecontainerapps.io/health
  ```

- [ ] **Test critical user flows**
  - Login as staff (admin@tshla.ai)
  - Load templates page
  - Test dictation if Deepgram changed
  - Test payment flow if Stripe/pump report changed

- [ ] **Monitor logs for errors**
  ```bash
  az containerapp logs show --name tshla-unified-api --resource-group tshla-backend-rg --follow
  ```

---

## Emergency Rollback Procedures

### If Deployment Breaks Production

1. **Immediate**: Revert last commit
   ```bash
   git revert HEAD
   git push
   ```

2. **Check deployment**: Wait for auto-deploy to complete (~5 min)

3. **Verify fix**: Test broken flow again

4. **If still broken**: Deploy previous working version
   ```bash
   git log --oneline | head -10  # Find last working commit
   git reset --hard <commit-hash>
   git push --force
   ```

5. **Document incident**: Add to `docs/INCIDENTS.md`

---

## Historical Issues Prevented by This Checklist

### Jan 11, 2026: Deepgram Proxy CSP Violation
- **Issue**: Deepgram proxy deployed Jan 4 but CSP not updated until Jan 11
- **Impact**: Dictation broken for 7 days
- **Prevention**: Step 1 of "New Service Deployment" checklist

### Jan 8, 2026: MFA Password Reset
- **Issue**: MFA implementation reset all passwords without warning
- **Impact**: All staff locked out, needed manual password resets
- **Prevention**: "Authentication Changes" checklist + user communication

### Dec 2025: Multiple Container Crashes
- **Issue**: Missing dependencies in Docker builds
- **Impact**: Backend down for hours
- **Prevention**: Pre-deployment testing + health check verification

---

## Automation Status

- [x] GitHub Actions auto-deploy on push to main
- [x] Pre-commit hooks for TypeScript validation
- [ ] **TODO**: CSP validation script (see `scripts/validate-csp.js`)
- [ ] **TODO**: Automated health check after deployment
- [ ] **TODO**: Slack notifications on deployment failure

---

## Questions?

Contact: rakesh@tshla.ai

**Remember**: Taking 5 minutes for this checklist prevents hours of debugging and user frustration.
