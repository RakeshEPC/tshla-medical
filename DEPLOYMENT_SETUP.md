# TSHLA Medical - Azure Container Apps Deployment Setup

## 🔧 GitHub Secrets Configuration

The new deployment workflows require the following GitHub secret to be configured:

### Required Secret: `AZURE_CREDENTIALS`

This secret contains the Azure Service Principal credentials in JSON format. Follow these steps to create it:

#### Step 1: Create Azure Service Principal

Run this command in Azure CLI (you need Owner or Contributor access to the subscription):

```bash
az ad sp create-for-rbac \
  --name "tshla-github-actions" \
  --role contributor \
  --scopes /subscriptions/YOUR_SUBSCRIPTION_ID/resourceGroups/tshla-backend-rg \
  --sdk-auth
```

Replace `YOUR_SUBSCRIPTION_ID` with your actual Azure subscription ID. You can find it by running:
```bash
az account show --query id -o tsv
```

#### Step 2: Copy the JSON Output

The command will output JSON similar to this:

```json
{
  "clientId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "clientSecret": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "subscriptionId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "tenantId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "activeDirectoryEndpointUrl": "https://login.microsoftonline.com",
  "resourceManagerEndpointUrl": "https://management.azure.com/",
  "activeDirectoryGraphResourceId": "https://graph.windows.net/",
  "sqlManagementEndpointUrl": "https://management.core.windows.net:8443/",
  "galleryEndpointUrl": "https://gallery.azure.com/",
  "managementEndpointUrl": "https://management.core.windows.net/"
}
```

**⚠️ IMPORTANT:** Copy this entire JSON output - you'll need it in the next step!

#### Step 3: Add Secret to GitHub

1. Go to your GitHub repository: https://github.com/RakeshEPC/tshla-medical
2. Click on **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `AZURE_CREDENTIALS`
5. Value: Paste the entire JSON from Step 2
6. Click **Add secret**

### Optional: Remove Old Secrets

The following old secrets are no longer needed and can be deleted:
- `AZURE_PUMP_API_PUBLISH_PROFILE`
- `AZURE_SCHEDULE_API_PUBLISH_PROFILE`
- `AZURE_AUTH_API_PUBLISH_PROFILE`

---

## 🚀 Deployment Architecture

### Current Infrastructure

**Azure Container Registry:**
- Name: `tshlaregistry`
- Server: `tshlaregistry.azurecr.io`
- Resource Group: `tshla-backend-rg`

**Container Apps:**
1. **Auth API**
   - Name: `tshla-auth-api-container`
   - URL: https://tshla-auth-api-container.redpebble-e4551b7a.eastus.azurecontainerapps.io
   - Image: `tshlaregistry.azurecr.io/tshla-auth-api:latest`
   - Dockerfile: `server/Dockerfile.auth`

2. **Schedule API**
   - Name: `tshla-schedule-api-container`
   - URL: https://tshla-schedule-api-container.redpebble-e4551b7a.eastus.azurecontainerapps.io
   - Image: `tshlaregistry.azurecr.io/tshla-schedule-api:latest`
   - Dockerfile: `server/Dockerfile.schedule`

3. **Pump API**
   - Name: `tshla-pump-api-container`
   - URL: https://tshla-pump-api-container.redpebble-e4551b7a.eastus.azurecontainerapps.io
   - Image: `tshlaregistry.azurecr.io/tshla-pump-api:latest`
   - Dockerfile: `server/Dockerfile.pump`

---

## 📋 Deployment Workflows

### Workflow Files

Three GitHub Actions workflows handle automatic deployments:

1. **[.github/workflows/deploy-auth-api-container.yml](.github/workflows/deploy-auth-api-container.yml)**
   - Triggers on changes to `server/medical-auth-api.js`, services, utils, or Dockerfile
   - Builds Docker image using `Dockerfile.auth`
   - Pushes to ACR
   - Updates Container App

2. **[.github/workflows/deploy-schedule-api-container.yml](.github/workflows/deploy-schedule-api-container.yml)**
   - Triggers on changes to `server/enhanced-schedule-notes-api.js`, services, utils, or Dockerfile
   - Builds Docker image using `Dockerfile.schedule`
   - Pushes to ACR
   - Updates Container App

3. **[.github/workflows/deploy-pump-api-container.yml](.github/workflows/deploy-pump-api-container.yml)**
   - Triggers on changes to `server/pump-report-api.js`, services, utils, or Dockerfile
   - Builds Docker image using `Dockerfile.pump`
   - Pushes to ACR
   - Updates Container App

### Deployment Process

Each workflow:
1. ✅ Checks out code
2. ✅ Logs into Azure using Service Principal
3. ✅ Logs into Azure Container Registry
4. ✅ Builds Docker image with commit SHA tag
5. ✅ Tags image as `latest`
6. ✅ Pushes both tags to ACR
7. ✅ Updates Container App with new image
8. ✅ Verifies deployment with health check

---

## 🧪 Testing Deployments

### Manual Deployment Trigger

You can manually trigger any workflow:

1. Go to **Actions** tab in GitHub
2. Select the workflow (e.g., "Deploy Pump API to Azure Container Apps")
3. Click **Run workflow**
4. Select branch `main`
5. Click **Run workflow**

### Health Check Endpoints

Test the APIs after deployment:

```bash
# Auth API
curl https://tshla-auth-api-container.redpebble-e4551b7a.eastus.azurecontainerapps.io/health

# Schedule API
curl https://tshla-schedule-api-container.redpebble-e4551b7a.eastus.azurecontainerapps.io/health

# Pump API
curl https://tshla-pump-api-container.redpebble-e4551b7a.eastus.azurecontainerapps.io/health
```

Expected response: `200 OK`

---

## 🔍 Troubleshooting

### View Container App Logs

```bash
# Auth API logs
az containerapp logs show \
  --name tshla-auth-api-container \
  --resource-group tshla-backend-rg \
  --follow

# Schedule API logs
az containerapp logs show \
  --name tshla-schedule-api-container \
  --resource-group tshla-backend-rg \
  --follow

# Pump API logs
az containerapp logs show \
  --name tshla-pump-api-container \
  --resource-group tshla-backend-rg \
  --follow
```

### Check Container App Status

```bash
az containerapp show \
  --name tshla-pump-api-container \
  --resource-group tshla-backend-rg \
  --query "{Name:name, Status:properties.provisioningState, RunningState:properties.runningStatus, Image:properties.template.containers[0].image}"
```

### View ACR Images

```bash
# List all images
az acr repository list --name tshlaregistry --output table

# Show tags for specific image
az acr repository show-tags \
  --name tshlaregistry \
  --repository tshla-pump-api \
  --output table
```

### Common Issues

**Issue: Workflow fails with "AZURE_CREDENTIALS not found"**
- Solution: Make sure you've added the `AZURE_CREDENTIALS` secret to GitHub as described above

**Issue: Docker build fails**
- Solution: Check the Dockerfile exists in `server/` directory
- Verify dependencies in `server/package.json`

**Issue: Health check fails after deployment**
- Solution: Container may still be starting, wait 30-60 seconds
- Check Container App logs for errors

**Issue: Service Principal permissions error**
- Solution: Ensure the Service Principal has "Contributor" role on the resource group

---

## 📚 Additional Resources

- [Azure Container Apps Documentation](https://learn.microsoft.com/en-us/azure/container-apps/)
- [GitHub Actions for Azure](https://github.com/Azure/actions)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)

---

## ✅ Verification Checklist

After setup, verify:

- [ ] `AZURE_CREDENTIALS` secret added to GitHub
- [ ] Old publish profile secrets removed (optional)
- [ ] All three workflow files exist in `.github/workflows/`
- [ ] Workflows can be manually triggered from GitHub Actions
- [ ] All three Container Apps are running (`az containerapp list`)
- [ ] Health endpoints return 200 OK
- [ ] Frontend `.env.production` points to Container App URLs

---

**Last Updated:** 2025-10-01
**Maintainer:** TSHLA Medical Team
