# Migration Summary: Container Apps → App Service

## ✅ Completed Tasks

### 1. Created Unified Server
- **File**: `server/unified-api.js`
- **Purpose**: Combines all 5 microservices into one Express application
- **Features**:
  - All API routes from 4 separate services
  - Integrated Deepgram WebSocket proxy
  - Unified health checks
  - Graceful shutdown handling

### 2. Refactored API Files
Modified all API files to support dual-mode (standalone OR imported):
- ✅ `server/pump-report-api.js` - Already had dual mode
- ✅ `server/medical-auth-api.js` - Already had dual mode
- ✅ `server/enhanced-schedule-notes-api.js` - Added dual mode
- ✅ `server/admin-account-api.js` - Added dual mode

Each file now uses:
```javascript
if (require.main === module) {
  // Start standalone server
} else {
  // Export app for unified server
}
module.exports = app;
```

### 3. Created Deployment Files
- ✅ `server/Dockerfile.unified` - Docker build configuration
- ✅ `.github/workflows/deploy-unified-api.yml` - CI/CD workflow

### 4. Updated Configuration
- ✅ `.env.production` - All API URLs now point to `https://tshla-unified-api.azurewebsites.net`
- ✅ Updated hardcoded URLs in 3 source files:
  - `src/services/adminPumpDrive.service.ts`
  - `src/services/pumpAnalytics.service.ts`
  - `src/pages/admin/PumpDriveUserDashboard.tsx`

---

## 📋 Architecture Change

### Before (5 Container Apps)
```
Frontend → 5 different URLs:
├── tshla-pump-api-container.redpebble-e4551b7a.eastus.azurecontainerapps.io
├── tshla-schedule-api-container.redpebble-e4551b7a.eastus.azurecontainerapps.io
├── tshla-auth-api-container.redpebble-e4551b7a.eastus.azurecontainerapps.io
├── tshla-admin-api-container.redpebble-e4551b7a.eastus.azurecontainerapps.io
└── tshla-deepgram-proxy.redpebble-e4551b7a.eastus.azurecontainerapps.io

Cost: ~$250/month
Deployment: 5 workflows
Complexity: High
```

### After (1 App Service)
```
Frontend → 1 unified URL:
└── tshla-unified-api.azurewebsites.net
    ├── /api/pump-* (pump API)
    ├── /api/auth/* (pump auth)
    ├── /api/medical/* (medical auth)
    ├── /api/schedule/* (schedule API)
    ├── /api/notes/* (notes API)
    ├── /api/accounts/* (admin API)
    └── /ws/deepgram (WebSocket proxy)

Cost: ~$75/month
Deployment: 1 workflow
Complexity: Low
Savings: $175/month (~$2,100/year)
```

---

## 🧪 Next Steps: Testing & Deployment

### Step 1: Test Locally (Optional)
```bash
cd /Users/rakeshpatel/Desktop/tshla-medical/server

# Install dependencies if needed
npm install

# Run the unified server
PORT=3000 node unified-api.js
```

Test endpoints:
- http://localhost:3000/health
- http://localhost:3000/api/health
- ws://localhost:3000/ws/deepgram

### Step 2: Commit and Push Changes
```bash
cd /Users/rakeshpatel/Desktop/tshla-medical

# Review changes
git status

# Add all changes
git add server/unified-api.js \
        server/Dockerfile.unified \
        server/enhanced-schedule-notes-api.js \
        server/admin-account-api.js \
        .github/workflows/deploy-unified-api.yml \
        .env.production \
        src/services/adminPumpDrive.service.ts \
        src/services/pumpAnalytics.service.ts \
        src/pages/admin/PumpDriveUserDashboard.tsx

# Commit
git commit -m "Migrate from Container Apps to unified App Service

- Consolidate 5 microservices into 1 unified API server
- Add Dockerfile.unified for App Service deployment
- Update all API URLs to point to unified endpoint
- Create GitHub Actions workflow for App Service
- Estimated cost savings: $175/month

🚀 Generated with Claude Code"

# Push to trigger deployment
git push origin main
```

### Step 3: Monitor Deployment
The GitHub Actions workflow will automatically:
1. Build Docker image
2. Push to Azure Container Registry
3. Create App Service (if not exists)
4. Deploy container to App Service
5. Configure environment variables
6. Run health checks

Monitor at: https://github.com/YOUR_USERNAME/tshla-medical/actions

### Step 4: Verify Deployment
Once deployed, test these endpoints:
```bash
# Health check
curl https://tshla-unified-api.azurewebsites.net/health

# API health
curl https://tshla-unified-api.azurewebsites.net/api/health

# Medical auth health
curl https://tshla-unified-api.azurewebsites.net/api/medical/health
```

WebSocket test:
- URL: `wss://tshla-unified-api.azurewebsites.net/ws/deepgram`

### Step 5: Update Frontend
After verifying the unified API works:
```bash
# Rebuild frontend with new environment
cd /Users/rakeshpatel/Desktop/tshla-medical
npm run build
```

Deploy the frontend to see it connect to the new unified API.

### Step 6: Clean Up Old Resources
Once everything is working, delete the old Container Apps:

```bash
# Delete Container Apps
az containerapp delete --name tshla-pump-api-container --resource-group tshla-backend-rg --yes
az containerapp delete --name tshla-schedule-api-container --resource-group tshla-backend-rg --yes
az containerapp delete --name tshla-auth-api-container --resource-group tshla-backend-rg --yes
az containerapp delete --name tshla-admin-api-container --resource-group tshla-backend-rg --yes
az containerapp delete --name tshla-deepgram-proxy --resource-group tshla-backend-rg --yes

# Delete old GitHub workflows (or disable them)
git rm .github/workflows/deploy-pump-api-container.yml
git rm .github/workflows/deploy-schedule-api-container.yml
git rm .github/workflows/deploy-auth-api-container.yml
git rm .github/workflows/deploy-admin-api-container.yml
git commit -m "Remove old Container Apps workflows"
git push
```

---

## 📊 Cost Comparison

| Resource | Before | After | Savings |
|----------|--------|-------|---------|
| **Compute** | 5 × Container Apps @ $50 | 1 × App Service @ $75 | -$175/mo |
| **Total Monthly** | ~$250 | ~$75 | **$175** |
| **Annual Savings** | - | - | **$2,100** |

---

## 🎯 Benefits

### Cost Savings
- **$175/month** (~$2,100/year) reduction

### Simplified Management
- 1 deployment instead of 5
- 1 URL to manage instead of 5
- 1 set of logs to monitor
- Easier debugging and troubleshooting

### Improved Performance
- No cross-service network latency
- Shared connection pools
- Single process warm-up

### Easier Development
- Local development mirrors production
- Simpler testing
- Faster deployment cycles

---

## 🔧 Troubleshooting

### If deployment fails:
1. Check GitHub Actions logs
2. Verify Azure credentials in repository secrets
3. Ensure App Service Plan exists
4. Check environment variables are set

### If health checks fail:
1. Check App Service logs: `az webapp log tail --name tshla-unified-api --resource-group tshla-backend-rg`
2. Verify environment variables: `az webapp config appsettings list --name tshla-unified-api --resource-group tshla-backend-rg`
3. Check if port 8080 is exposed correctly

### If WebSocket fails:
1. Verify WebSocket is enabled: `az webapp config show --name tshla-unified-api --resource-group tshla-backend-rg --query webSocketsEnabled`
2. Test with: `wscat -c wss://tshla-unified-api.azurewebsites.net/ws/deepgram`

---

## 📝 Files Created/Modified

### Created:
- `server/unified-api.js` (new unified server)
- `server/Dockerfile.unified` (Docker build)
- `.github/workflows/deploy-unified-api.yml` (CI/CD)
- `MIGRATION_SUMMARY_CONTAINER_TO_APP_SERVICE.md` (this file)

### Modified:
- `server/enhanced-schedule-notes-api.js` (added dual-mode support)
- `server/admin-account-api.js` (added dual-mode support)
- `.env.production` (updated all API URLs)
- `src/services/adminPumpDrive.service.ts` (updated hardcoded URL)
- `src/services/pumpAnalytics.service.ts` (updated hardcoded URL)
- `src/pages/admin/PumpDriveUserDashboard.tsx` (updated hardcoded URL)

---

## ✅ Ready to Deploy!

The migration is complete and ready for deployment. Just commit and push the changes to trigger the GitHub Actions workflow.

Good luck! 🚀
