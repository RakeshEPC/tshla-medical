# Azure Secrets Management Guide

This document describes all Azure Container App secrets required for the TSHLA Medical application.

## Table of Contents
- [Overview](#overview)
- [Required Secrets](#required-secrets)
- [How to Set Secrets](#how-to-set-secrets)
- [How to Verify Secrets](#how-to-verify-secrets)
- [Troubleshooting](#troubleshooting)

---

## Overview

Azure Container Apps use **secrets** to store sensitive configuration like API keys. Secrets are:
- Encrypted at rest
- Referenced by environment variables in the container
- Not visible in source control
- Require container restart to take effect

**IMPORTANT**: After updating a secret, you **must restart** the Container App for changes to take effect.

---

## Required Secrets

### 1. tshla-deepgram-proxy

**Container App**: `tshla-deepgram-proxy`
**Resource Group**: `tshla-backend-rg`

#### Secret: `deepgram-api-key`

**Purpose**: Authenticates the WebSocket proxy with Deepgram's speech-to-text API

**Why it's needed**:
- Browsers cannot send Authorization headers on WebSocket connections
- The proxy adds the API key before forwarding to Deepgram
- Required for HIPAA compliance (keeps API key server-side only)

**How to get the API key**:
1. Log in to [Deepgram Console](https://console.deepgram.com)
2. Navigate to **API Keys** section
3. Copy your project API key (starts with letters/numbers, ~40 characters)

**Current value location**:
- GitHub Repository Secret: `DEEPGRAM_API_KEY`
- Local `.env` file: `DEEPGRAM_API_KEY=9d8dc821d842119fb67e165910f6242528101a4f`

---

## How to Set Secrets

### Set or Update a Secret

```bash
# Set the Deepgram API key
az containerapp secret set \
  --name tshla-deepgram-proxy \
  --resource-group tshla-backend-rg \
  --secrets deepgram-api-key=YOUR_API_KEY_HERE

# IMPORTANT: Restart the app to load the new secret
az containerapp revision restart \
  --name tshla-deepgram-proxy \
  --resource-group tshla-backend-rg
```

### List All Secrets

```bash
az containerapp secret list \
  --name tshla-deepgram-proxy \
  --resource-group tshla-backend-rg \
  --output table
```

**Note**: You can see secret names but not their values (Azure hides them for security).

### Remove a Secret

```bash
az containerapp secret remove \
  --name tshla-deepgram-proxy \
  --resource-group tshla-backend-rg \
  --secret-names deepgram-api-key
```

---

## How to Verify Secrets

### Method 1: Health Check Endpoint (Recommended)

The Deepgram proxy has an enhanced health check that validates the API key:

```bash
curl https://tshla-deepgram-proxy.redpebble-e4551b7a.eastus.azurecontainerapps.io/health
```

**Expected output (healthy)**:
```json
{
  "status": "healthy",
  "service": "deepgram-proxy",
  "timestamp": "2026-01-05T00:00:00.000Z",
  "checks": {
    "apiKeyConfigured": true,
    "apiKeyValid": true,
    "deepgramReachable": true
  }
}
```

**Unhealthy output examples**:

**API key not set**:
```json
{
  "status": "unhealthy",
  "error": "Deepgram API key not configured",
  "checks": {
    "apiKeyConfigured": false,
    "apiKeyValid": false,
    "deepgramReachable": false
  }
}
```

**API key invalid**:
```json
{
  "status": "degraded",
  "warning": "API key test returned 401",
  "checks": {
    "apiKeyConfigured": true,
    "apiKeyValid": false,
    "deepgramReachable": true
  }
}
```

**Cannot reach Deepgram**:
```json
{
  "status": "degraded",
  "error": "Cannot reach Deepgram: getaddrinfo ENOTFOUND",
  "checks": {
    "apiKeyConfigured": true,
    "apiKeyValid": false,
    "deepgramReachable": false
  }
}
```

### Method 2: Check Container Logs

```bash
# View recent logs
az containerapp logs show \
  --name tshla-deepgram-proxy \
  --resource-group tshla-backend-rg \
  --tail 50

# Look for this on startup:
# ✅ Deepgram Proxy Server
#    API Key: 9d8dc821...1a4f
#    Port: 8080
```

### Method 3: Test Dictation in Browser

1. Go to https://mango-sky-0ba265c0f.1.azurestaticapps.net/dictation
2. Click "Start Dictation"
3. Check browser console:
   - ✅ Should see: `✅ WebSocket onopen fired!`
   - ❌ Should NOT see: 401 errors or `AUTHENTICATION ERROR`

---

## Troubleshooting

### Problem: "Deepgram API key not configured"

**Symptoms**:
- Health check returns `status: "unhealthy"`
- `apiKeyConfigured: false`

**Solution**:
```bash
# Set the API key
az containerapp secret set \
  --name tshla-deepgram-proxy \
  --resource-group tshla-backend-rg \
  --secrets deepgram-api-key=9d8dc821d842119fb67e165910f6242528101a4f

# Restart
az containerapp revision restart \
  --name tshla-deepgram-proxy \
  --resource-group tshla-backend-rg

# Verify (wait 30 seconds for restart)
sleep 30
curl https://tshla-deepgram-proxy.redpebble-e4551b7a.eastus.azurecontainerapps.io/health
```

### Problem: "API key test returned 401"

**Symptoms**:
- Health check returns `status: "degraded"`
- `apiKeyValid: false`
- Dictation gets 401 errors

**Solution**:
1. Verify the API key is correct:
   ```bash
   # Check what's in the local .env
   cat .env | grep DEEPGRAM_API_KEY

   # Should be: 9d8dc821d842119fb67e165910f6242528101a4f
   ```

2. If key is wrong, get a new one from [Deepgram Console](https://console.deepgram.com)

3. Update the secret:
   ```bash
   az containerapp secret set \
     --name tshla-deepgram-proxy \
     --resource-group tshla-backend-rg \
     --secrets deepgram-api-key=NEW_KEY_HERE

   az containerapp revision restart \
     --name tshla-deepgram-proxy \
     --resource-group tshla-backend-rg
   ```

### Problem: "Cannot reach Deepgram"

**Symptoms**:
- Health check returns `status: "degraded"`
- `deepgramReachable: false`
- Error mentions network/DNS issues

**Solution**:
1. Check if Deepgram is down: https://status.deepgram.com
2. Check Azure networking:
   ```bash
   # Verify container is running
   az containerapp show \
     --name tshla-deepgram-proxy \
     --resource-group tshla-backend-rg \
     --query "properties.runningStatus"
   ```
3. Try restarting the container:
   ```bash
   az containerapp revision restart \
     --name tshla-deepgram-proxy \
     --resource-group tshla-backend-rg
   ```

### Problem: Dictation works locally but not in production

**Symptoms**:
- Local development works fine
- Production gets 401 or connection errors

**Checklist**:
1. ✅ Verify `.env.production` has correct proxy URL:
   ```bash
   cat .env.production | grep DEEPGRAM_PROXY
   # Should be: VITE_DEEPGRAM_PROXY_URL=wss://tshla-deepgram-proxy.redpebble-e4551b7a.eastus.azurecontainerapps.io
   ```

2. ✅ Check GitHub secret matches local `.env`:
   ```bash
   gh secret list | grep DEEPGRAM
   ```

3. ✅ Verify proxy health:
   ```bash
   curl https://tshla-deepgram-proxy.redpebble-e4551b7a.eastus.azurecontainerapps.io/health
   ```

4. ✅ Check browser is using proxy (not api.deepgram.com):
   - Open DevTools → Network tab → WS filter
   - Should see: `wss://tshla-deepgram-proxy...`
   - Should NOT see: `wss://api.deepgram.com`

5. ✅ Hard refresh browser to clear cache:
   - Mac: Cmd + Shift + R
   - Windows/Linux: Ctrl + Shift + R

---

## Secret Rotation Best Practices

### When to Rotate API Keys

- **Every 90 days** (recommended)
- When a team member with access leaves
- If you suspect the key has been compromised
- If Deepgram notifies you of a security issue

### How to Rotate Safely

1. **Get new API key** from Deepgram Console
2. **Test locally** first:
   ```bash
   # Update local .env
   DEEPGRAM_API_KEY=new_key_here

   # Test proxy locally
   PORT=8080 node server/deepgram-proxy.js

   # In another terminal
   curl http://localhost:8080/health
   ```

3. **Update Azure secret**:
   ```bash
   az containerapp secret set \
     --name tshla-deepgram-proxy \
     --resource-group tshla-backend-rg \
     --secrets deepgram-api-key=NEW_KEY
   ```

4. **Restart container**:
   ```bash
   az containerapp revision restart \
     --name tshla-deepgram-proxy \
     --resource-group tshla-backend-rg
   ```

5. **Verify health check**:
   ```bash
   sleep 30  # Wait for restart
   curl https://tshla-deepgram-proxy.redpebble-e4551b7a.eastus.azurecontainerapps.io/health
   ```

6. **Test dictation** in production

7. **Update GitHub secret**:
   ```bash
   gh secret set DEEPGRAM_API_KEY --body "NEW_KEY"
   ```

8. **Revoke old API key** in Deepgram Console

---

## Quick Reference

### Essential Commands

```bash
# View secrets (names only)
az containerapp secret list \
  --name tshla-deepgram-proxy \
  --resource-group tshla-backend-rg

# Set/update secret
az containerapp secret set \
  --name tshla-deepgram-proxy \
  --resource-group tshla-backend-rg \
  --secrets deepgram-api-key=YOUR_KEY

# Restart container
az containerapp revision restart \
  --name tshla-deepgram-proxy \
  --resource-group tshla-backend-rg

# Check health
curl https://tshla-deepgram-proxy.redpebble-e4551b7a.eastus.azurecontainerapps.io/health

# View logs
az containerapp logs show \
  --name tshla-deepgram-proxy \
  --resource-group tshla-backend-rg \
  --tail 100
```

### Health Check Status Meanings

| Status | Meaning | Action Required |
|--------|---------|-----------------|
| `healthy` | All checks passed | None |
| `degraded` | API key configured but can't validate | Check Deepgram status, verify API key |
| `unhealthy` | API key not configured | Set the secret and restart |

### Support Resources

- **Deepgram Console**: https://console.deepgram.com
- **Deepgram Status**: https://status.deepgram.com
- **Azure Portal**: https://portal.azure.com
- **GitHub Repo**: https://github.com/RakeshEPC/tshla-medical

---

**Last Updated**: 2026-01-05
**Maintainer**: TSHLA Development Team
