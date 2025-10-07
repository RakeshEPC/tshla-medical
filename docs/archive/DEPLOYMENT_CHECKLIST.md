# Pre-Deployment Checklist

## ⚠️ RULE: Complete ALL items BEFORE saying "deployment successful"

### Stage 1: Local Development ✓
- [ ] Feature works 100% in local browser
- [ ] Test in Chrome incognito mode
- [ ] Clear all browser caches
- [ ] Check browser console for errors (0 errors)
- [ ] Network tab shows 200 responses (no 404/403/500)

### Stage 2: Build Validation ✓
- [ ] Run `npm run build` - completes without errors
- [ ] Run `npm run validate:build` - all checks pass
- [ ] Manually verify `dist/staticwebapp.config.json` exists
- [ ] Manually verify `dist/index.html` exists
- [ ] Check `dist/assets/AdminBundle-*.js` exists
- [ ] Check `dist/assets/PumpComparisonManager-*.js` exists
- [ ] No errors in build output

### Stage 3: Database Verification ✓
- [ ] Run `npm run validate:db:prod`
- [ ] Confirm admin@tshla.ai exists in production
- [ ] Confirm 23 dimensions in pump_comparison_data table
- [ ] Confirm 6 manufacturers in pump_manufacturers table
- [ ] Test actual login with production credentials

### Stage 4: API Deployment ✓
- [ ] Docker images built with `--platform linux/amd64`
- [ ] Images pushed to Azure Container Registry
- [ ] Azure Container App update command succeeded
- [ ] Revision number incremented (check not same as before)
- [ ] Wait 60 seconds for container startup
- [ ] Run `npm run validate:apis`
- [ ] Manually curl health endpoints - verify 200
- [ ] Check CORS headers present in responses

### Stage 5: Frontend Deployment ✓
- [ ] GitHub Action completed with green checkmark
- [ ] Wait 30 seconds for Azure Static Web Apps propagation
- [ ] Run `npm run validate:deployment`
- [ ] Manually curl production root - verify 200
- [ ] Manually curl /admin/pump-comparison - verify 200 (NOT 404)

### Stage 6: End-to-End Testing ✓
- [ ] Open https://mango-sky-0ba265c0f.1.azurestaticapps.net in incognito
- [ ] Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)
- [ ] Login with admin@tshla.ai / AdminPass2025
- [ ] Verify redirect to /admin/accounts
- [ ] Click "PumpDrive Users & Database" button
- [ ] Verify NO 404 error
- [ ] Verify page loads completely
- [ ] Verify API data loads (see 23 dimensions)
- [ ] Check browser console - no errors

### Stage 7: Monitoring ✓
- [ ] Monitor Azure Container App logs for 5 minutes
- [ ] Check container restart count = 0
- [ ] Verify no error spikes

### Stage 8: Documentation ✓
- [ ] Update DEPLOYMENT_FAILURES.md if anything failed
- [ ] Update this checklist if new steps needed

## ✅ ONLY AFTER ALL BOXES CHECKED:
**THEN** you can say "Deployment successful"

## ❌ IF ANY CHECK FAILS:
1. STOP immediately
2. Document in DEPLOYMENT_FAILURES.md
3. Fix root cause
4. Add automated prevention
5. Start checklist from beginning
