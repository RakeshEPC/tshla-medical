# Quick Deployment Guide

**Last Updated:** November 17, 2025

## 🚀 Deploy to Azure (Frontend + Backend)

### Prerequisites Checklist
- ✅ Git changes are ready
- ✅ Unified API server fixed (includes Echo routes)
- ✅ Login credentials reset (admin@tshla.ai / TshlaAdmin2025!)
- ✅ All services tested locally

### Deployment Steps

#### 1. Commit Your Changes
```bash
# Stage all changes
git add .

# Commit with descriptive message
git commit -m "Fix: Add unified API server to startup, fix echo preview generation, update login system

- Updated start-dev.sh to use unified-api.js (includes echo routes)
- Fixed echo audio summary preview generation
- Reset admin passwords to TshlaAdmin2025!
- Created diagnostic tools for login troubleshooting
- Updated stop-dev.sh to handle all ports"

# Push to trigger deployment
git push origin main
```

#### 2. Monitor Deployment

**GitHub Actions:**
```bash
# Open in browser
open https://github.com/YOUR_USERNAME/tshla-medical/actions
```

Or check from command line:
```bash
gh run list
gh run watch
```

#### 3. Verify Deployment

**Frontend:**
- URL: https://mango-sky-0ba265c0f.1.azurestaticapps.net
- Test login with: admin@tshla.ai / TshlaAdmin2025!

**Backend (Unified API):**
- URL: https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io
- Health check: https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/health

### What Gets Deployed

#### Frontend Workflow
- **Trigger:** Push to `main` branch
- **File:** `.github/workflows/deploy-frontend.yml`
- **Target:** Azure Static Web Apps
- **URL:** https://mango-sky-0ba265c0f.1.azurestaticapps.net

#### Backend Workflow
- **Trigger:** Push to `main` branch (unified container app changes)
- **File:** `.github/workflows/deploy-unified-container-app.yml`
- **Target:** Azure Container Apps
- **URL:** https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io

### Important Changes Being Deployed

1. **Unified API Server**
   - Now includes Echo audio summary routes
   - Consolidated all microservices
   - Single entry point on port 3000

2. **Login System**
   - Admin credentials reset
   - Working accounts: admin@tshla.ai, rakesh@tshla.ai
   - Password: TshlaAdmin2025!

3. **Echo Audio Summary**
   - Preview generation now works
   - Routes available at `/api/echo/*`

4. **Development Scripts**
   - `start-dev.sh` uses unified API
   - `stop-dev.sh` handles all ports
   - Diagnostic tools added

### GitHub Secrets Required

Make sure these secrets are set in your GitHub repo:

#### Frontend Secrets
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_OPENAI_API_KEY`
- `VITE_AZURE_OPENAI_ENDPOINT`
- `VITE_AZURE_OPENAI_KEY`
- `VITE_AZURE_OPENAI_DEPLOYMENT`
- `VITE_DEEPGRAM_API_KEY`
- `AZURE_STATIC_WEB_APPS_API_TOKEN`

#### Backend Secrets
- `AZURE_CREDENTIALS` (for container app deployment)
- `SUPABASE_SERVICE_ROLE_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_AGENT_ID`

### Check Secrets
```bash
gh secret list
```

### Post-Deployment Validation

#### 1. Test Frontend
```bash
# Root page
curl -I https://mango-sky-0ba265c0f.1.azurestaticapps.net

# Admin routes (should be 200, not 404)
curl -I https://mango-sky-0ba265c0f.1.azurestaticapps.net/admin/pump-comparison

# Config file
curl -I https://mango-sky-0ba265c0f.1.azurestaticapps.net/staticwebapp.config.json
```

#### 2. Test Backend API
```bash
# Health check
curl https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/health

# Echo preview endpoint
curl -X POST https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/echo/generate-preview \
  -H "Content-Type: application/json" \
  -d '{"soapNote":"Test note"}'
```

#### 3. Test Login
1. Go to https://mango-sky-0ba265c0f.1.azurestaticapps.net
2. Login with: admin@tshla.ai / TshlaAdmin2025!
3. Should redirect to admin dashboard

#### 4. Test Echo Audio Summary
1. Login to production
2. Go to dictation page
3. Complete a dictation
4. Click "Send Patient Summary"
5. Click "Generate Preview"
6. Should work without "Failed to generate preview" error

### Rollback Plan

If deployment fails:

```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Or reset to last working version
git log --oneline  # Find last working commit
git reset --hard <commit-hash>
git push origin main --force
```

### Troubleshooting

#### Frontend not deploying
```bash
# Check GitHub Actions
gh run list

# View specific run
gh run view <run-id>

# Check logs
gh run view <run-id> --log
```

#### Backend not updating
```bash
# Check Azure Container Apps
az containerapp list --resource-group <your-resource-group>

# Check recent revisions
az containerapp revision list \
  --name tshla-unified-api \
  --resource-group <your-resource-group>

# View logs
az containerapp logs show \
  --name tshla-unified-api \
  --resource-group <your-resource-group> \
  --follow
```

#### Echo endpoints still failing
- Check environment variables in Azure Container App
- Verify `VITE_OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, `TWILIO_*` are set
- Check logs for API errors

### Local Testing Before Deploy

```bash
# 1. Stop all services
./stop-dev.sh

# 2. Start with new unified API
./start-dev.sh

# 3. Test in browser
open http://localhost:5173

# 4. Login
# Email: admin@tshla.ai
# Password: TshlaAdmin2025!

# 5. Test echo preview
# - Go to dictation
# - Complete dictation
# - Try "Generate Preview"
# - Should work!
```

### Quick Deploy Command

If everything looks good:

```bash
git add . && \
git commit -m "Deploy: Unified API with Echo routes and login fixes" && \
git push origin main && \
echo "✅ Deployment triggered! Check: https://github.com/YOUR_USERNAME/tshla-medical/actions"
```

---

## 📊 Deployment Checklist

Before deploying, verify:

- [ ] Local tests pass (`./start-dev.sh` works)
- [ ] Login works locally
- [ ] Echo preview generates successfully
- [ ] All new files are committed
- [ ] `.env` not committed (in .gitignore)
- [ ] GitHub secrets are set
- [ ] Ready to push to `main` branch

## 🎯 Expected Results

After deployment:
- ✅ Frontend deployed to Azure Static Web Apps
- ✅ Backend (Unified API) deployed to Azure Container Apps
- ✅ Login works with admin@tshla.ai
- ✅ Echo audio summary preview works
- ✅ All routes functional

---

**Ready to deploy? Run:**
```bash
git add .
git commit -m "Deploy unified API with echo routes"
git push origin main
```
