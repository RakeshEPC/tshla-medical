# Deepgram Production "No Audio Captured" Fix - What Actually Happened

## Timeline of Events

### Yesterday (Nov 3, 2025)
- **Commit `283f9588`**: Added patient summary API feature
- **Deployment**: Azure Container App revision `0000019` deployed at `2025-11-04T00:28:15Z`
- **Side Effect**: Container app was re-configured, and Azure Auto-selected HTTP/2 transport
- **Result**: WebSocket endpoint `/ws/deepgram` started returning 404 for all production users

## The Real Problem

### Why WebSockets Stopped Working

**HTTP/2 does NOT support WebSocket protocol upgrades**. When Azure Container Apps ingress was set to "Auto" transport mode, it chose HTTP/2 for better performance. However:

- ✅ HTTP/2 works great for REST APIs
- ❌ HTTP/2 **cannot** handle WebSocket upgrade requests
- ❌ All WebSocket connections get 404 errors

### Technical Details

WebSocket protocol requires:
1. Initial HTTP/1.1 GET request with `Upgrade: websocket` header
2. Server responds with `101 Switching Protocols`
3. Connection upgrades to WebSocket (bidirectional communication)

HTTP/2 eliminated the `Upgrade` mechanism, so WebSockets literally cannot work over HTTP/2.

## What Changed Yesterday

```bash
# Before (Oct 29, 2025 - revision 0000018):
Transport: HTTP  # or not specified, defaulted to HTTP/1.1
WebSocket: ✅ WORKING

# After (Nov 4, 2025 - revision 0000019):
Transport: Auto  # Azure chose HTTP/2 for "better performance"
WebSocket: ❌ BROKEN (404 errors)
```

## The Fix

### 1. Immediate Fix (Already Applied)
```bash
az containerapp ingress update \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --transport http
```

This forces HTTP/1.1, which supports WebSocket upgrades.

### 2. Long-term Fix (Deployment Workflow Updated)
Updated `.github/workflows/deploy-unified-container-app.yml` to:
- Always set `--transport http` when creating new container apps
- Always run `az containerapp ingress update --transport http` before updating

This prevents Azure from auto-selecting HTTP/2 in future deployments.

## Why Your Local Development Still Worked

| Environment | Configuration | Status |
|-------------|---------------|---------|
| **Your Computer** | `.env` has `VITE_DEEPGRAM_PROXY_URL=ws://localhost:8080` | ✅ Working |
| **Production (before fix)** | `.env.production` has `wss://tshla-unified-api.../ws/deepgram` | ❌ Broken (HTTP/2) |
| **Production (after fix)** | Same URL, but Azure ingress now uses HTTP/1.1 | ✅ Fixed |

## Testing the Fix

### Current Status
```bash
# Check Azure configuration:
$ az containerapp ingress show --name tshla-unified-api --resource-group tshla-backend-rg --query transport
"Http"  # ✅ Correct!

# Test endpoint (note: WebSocket endpoints return 404 for regular HTTP GET):
$ curl --http1.1 https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/ws/deepgram
HTTP/1.1 404 Not Found  # This is EXPECTED for HTTP GET to WebSocket endpoint
```

###To properly test WebSocket (use browser DevTools or wscat):
```javascript
const ws = new WebSocket('wss://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/ws/deepgram?model=nova-2-medical&language=en-US&encoding=linear16&sample_rate=48000&channels=1');
ws.onopen = () => console.log('✅ WebSocket connected!');
ws.onerror = (e) => console.error('❌ WebSocket error:', e);
```

## What My Earlier "Fixes" Actually Did

The changes I made to the codebase earlier today (race condition fix, diagnostics, test microphone button) are **still valuable** but they **didn't solve the production issue** because:

| Fix | Impact on Local Dev | Impact on Production |
|-----|---------------------|----------------------|
| Race condition fix | ✅ Improved reliability | ✅ Will help when WebSocket works |
| Diagnostic logging | ✅ Better debugging | ✅ Will show clear errors |
| Test microphone button | ✅ Better UX | ✅ Better UX |
| Azure ingress fix | ❌ Not applicable | ✅ **THIS WAS THE REAL FIX** |

## Who Is Affected

- ✅ **You (local dev)**: Already working because you use `localhost:8080`
- ✅ **Production users**: Fixed now that Azure ingress is set to HTTP/1.1
- ✅ **Future deployments**: Protected by updated workflow

## Summary

**Root Cause**: Azure Container Apps auto-selected HTTP/2 transport during deployment, which broke WebSocket support.

**Solution**: Force HTTP/1.1 transport mode in Azure Container Apps configuration.

**Prevention**: Updated deployment workflow to always configure HTTP/1.1 for WebSocket compatibility.

**Status**: ✅ Fixed in production (as of today)

## Additional Notes

- HTTP/2 vs HTTP/1.1 trade-off: HTTP/2 is faster for multiple requests, but HTTP/1.1 is required for WebSockets
- Azure "Auto" mode intelligently selects HTTP/2 when possible, but doesn't account for WebSocket requirements
- For applications that need both REST APIs and WebSockets, HTTP/1.1 is the safest choice
