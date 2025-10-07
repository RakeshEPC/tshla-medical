# 🚀 Quick Start: Fix TSHLA Medical Deployments

## The Problem (Solved!)

Your deployments were failing because:
- ❌ GitHub workflows tried to deploy to **Azure App Services** that don't exist
- ✅ Your actual infrastructure uses **Azure Container Apps**
- ❌ Workflows used ZIP deployments (for Windows/IIS)
- ✅ Container Apps need Docker images

## The Solution

New workflows have been created that properly deploy to Azure Container Apps using Docker.

---

## ⚡ Quick Setup (5 minutes)

### Step 1: Create Azure Service Principal

```bash
# Get your subscription ID
SUBSCRIPTION_ID=$(az account show --query id -o tsv)

# Create Service Principal for GitHub Actions
az ad sp create-for-rbac \
  --name "tshla-github-actions" \
  --role contributor \
  --scopes /subscriptions/$SUBSCRIPTION_ID/resourceGroups/tshla-backend-rg \
  --sdk-auth
```

### Step 2: Copy the JSON Output

The command outputs JSON like this - **copy everything**:

```json
{
  "clientId": "...",
  "clientSecret": "...",
  "subscriptionId": "...",
  "tenantId": "...",
  ...
}
```

### Step 3: Add to GitHub

1. Go to: https://github.com/RakeshEPC/tshla-medical/settings/secrets/actions
2. Click **New repository secret**
3. Name: `AZURE_CREDENTIALS`
4. Value: **Paste the entire JSON**
5. Click **Add secret**

### Step 4: Commit and Push

```bash
cd /Users/rakeshpatel/Desktop/tshla-medical

# Stage the new workflow files
git add .github/workflows/*.yml
git add DEPLOYMENT_SETUP.md DEPLOYMENT_QUICK_START.md

# Commit
git commit -m "Fix: Replace App Service workflows with Container Apps deployment

- Remove old Azure Web App deployment workflows
- Add new Container Apps workflows with Docker build/push
- Update to use Azure Container Registry (tshlaregistry.azurecr.io)
- Add deployment documentation

Fixes deployment failures caused by targeting non-existent App Services"

# Push to trigger deployments
git push origin main
```

### Step 5: Watch Deployments

Go to: https://github.com/RakeshEPC/tshla-medical/actions

You should see 3 workflows running:
- ✅ Deploy Auth API to Azure Container Apps
- ✅ Deploy Schedule API to Azure Container Apps
- ✅ Deploy Pump API to Azure Container Apps

---

## 🔍 What Changed

### Old Workflows (Deleted)
```
❌ deploy-auth-api.yml → Azure App Service (doesn't exist)
❌ deploy-schedule-api.yml → Azure App Service (doesn't exist)
❌ deploy-pump-api.yml → Azure App Service (doesn't exist)
```

### New Workflows (Created)
```
✅ deploy-auth-api-container.yml → Azure Container Apps
✅ deploy-schedule-api-container.yml → Azure Container Apps
✅ deploy-pump-api-container.yml → Azure Container Apps
```

### Deployment Flow
```
1. Code pushed to main
   ↓
2. GitHub Actions triggered
   ↓
3. Docker image built (using Dockerfiles in server/)
   ↓
4. Image pushed to Azure Container Registry
   ↓
5. Container App updated with new image
   ↓
6. Health check verifies deployment
```

---

## ✅ Verify Everything Works

### Test the APIs

```bash
# Auth API (should return 200 or API response)
curl https://tshla-auth-api-container.redpebble-e4551b7a.eastus.azurecontainerapps.io/health

# Schedule API (should return 200)
curl https://tshla-schedule-api-container.redpebble-e4551b7a.eastus.azurecontainerapps.io/health

# Pump API (should return 200 or API response)
curl https://tshla-pump-api-container.redpebble-e4551b7a.eastus.azurecontainerapps.io/health
```

### Check Container Status

```bash
az containerapp list \
  --query "[?contains(name, 'tshla')].{Name:name, Status:properties.provisioningState, URL:properties.configuration.ingress.fqdn}" \
  --output table
```

Expected output:
```
Name                          Status     URL
----------------------------  ---------  -----------------------------------------------------
tshla-auth-api-container      Succeeded  tshla-auth-api-container.redpebble-e4551b7a.eastus...
tshla-pump-api-container      Succeeded  tshla-pump-api-container.redpebble-e4551b7a.eastus...
tshla-schedule-api-container  Succeeded  tshla-schedule-api-container.redpebble-e4551b7a.e...
```

---

## 📝 Manual Deployment (if needed)

If you need to deploy manually without pushing to main:

1. Go to GitHub Actions: https://github.com/RakeshEPC/tshla-medical/actions
2. Select a workflow (e.g., "Deploy Pump API to Azure Container Apps")
3. Click **Run workflow** button
4. Select branch: `main`
5. Click **Run workflow**

---

## 🐛 Troubleshooting

### Problem: "AZURE_CREDENTIALS not found"
**Solution:** Make sure you added the secret to GitHub (Step 3 above)

### Problem: "Permission denied" or "Unauthorized"
**Solution:** Service Principal needs Contributor role:
```bash
az role assignment create \
  --assignee YOUR_CLIENT_ID_FROM_JSON \
  --role Contributor \
  --scope /subscriptions/$SUBSCRIPTION_ID/resourceGroups/tshla-backend-rg
```

### Problem: Workflow succeeds but API returns 404
**Solution:** Container may still be starting, wait 1-2 minutes and try again

### Problem: Docker build fails
**Solution:**
- Check Dockerfile exists in `server/` directory
- Verify all required files are in the repo
- Check workflow logs for specific error

---

## 📚 Full Documentation

For complete details, see: [DEPLOYMENT_SETUP.md](DEPLOYMENT_SETUP.md)

---

## 🎉 Summary

**What was broken:**
- Workflows deploying to non-existent Azure App Services
- Using wrong deployment method (ZIP instead of Docker)
- DNS failures with `ENOTFOUND` errors

**What's fixed:**
- ✅ New workflows deploy Docker images to Container Apps
- ✅ Proper Azure authentication with Service Principal
- ✅ Automated builds and deployments
- ✅ Health checks verify successful deployments

**Next steps:**
1. Add `AZURE_CREDENTIALS` secret to GitHub
2. Commit and push changes
3. Watch workflows succeed 🚀
