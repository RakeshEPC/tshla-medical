# Environment Variables Documentation

## Overview

This document lists all required environment variables for the TSHLA Medical application (frontend and backend).

**Why this matters:** Environment variables getting out of sync between local development and Azure production is a common cause of deployment failures. This document ensures consistency.

---

## 🔐 Secrets (Sensitive - Store in Azure Key Vault / GitHub Secrets)

These should **NEVER** be committed to git. They are stored as secrets in Azure Container App.

| Variable Name | Purpose | Where Used | Example Format |
|---------------|---------|------------|----------------|
| `VITE_OPENAI_API_KEY` | OpenAI API for AI processing | Backend (echo, dictation) | `sk-proj-...` |
| `VITE_ELEVENLABS_API_KEY` | ElevenLabs text-to-speech | Backend (echo audio) | `sk_...` |
| `ELEVENLABS_API_KEY` | ElevenLabs (alternate) | Backend | `sk_...` |
| `DEEPGRAM_API_KEY` | Deepgram speech-to-text | Backend (dictation) | `...` |
| `VITE_DEEPGRAM_API_KEY` | Deepgram (frontend) | Frontend | `...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin access | Backend | `eyJ...` |
| `JWT_SECRET` | JWT token signing | Backend (auth) | Random 32+ char string |

---

## 🌍 Public Environment Variables (Non-sensitive)

These can be plain text in Azure Container App configuration.

### Supabase Configuration

| Variable | Value | Purpose |
|----------|-------|---------|
| `VITE_SUPABASE_URL` | `https://minvvjdflezibmgkplqb.supabase.co` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Public anon key (safe to expose) |

### AI Model Configuration

| Variable | Value | Purpose |
|----------|-------|---------|
| `VITE_OPENAI_MODEL_STAGE4` | `gpt-4o-mini` | OpenAI model for stage 4 processing |
| `VITE_OPENAI_MODEL_STAGE5` | `gpt-4o` | OpenAI model for stage 5 processing |
| `VITE_OPENAI_MODEL_STAGE6` | `gpt-4o` | OpenAI model for stage 6 processing |
| `VITE_PRIMARY_AI_PROVIDER` | `openai` or `azure` | Which AI provider to use |

### Speech-to-Text Configuration

| Variable | Value | Purpose |
|----------|-------|---------|
| `VITE_DEEPGRAM_MODEL` | `nova-3-medical` | Deepgram medical model |
| `VITE_DEEPGRAM_LANGUAGE` | `en-US` | Language for transcription |
| `VITE_DEEPGRAM_TIER` | `enhanced` | Deepgram tier |
| `VITE_PRIMARY_STT_PROVIDER` | `deepgram` | Speech-to-text provider |
| `VITE_USE_DEEPGRAM_SDK` | `true` | Use Deepgram SDK vs proxy |

### ElevenLabs Configuration

| Variable | Value | Purpose |
|----------|-------|---------|
| `VITE_ELEVENLABS_DEFAULT_VOICE_ID` | `cgSgspJ2msm6clMCkdW9` | Default voice (Jessica) |

### Backend Configuration

| Variable | Value | Purpose |
|----------|-------|---------|
| `NODE_ENV` | `production` | Node environment |
| `PORT` | `3000` | Server port |
| `CLINIC_PHONE_NUMBER` | `+18325938100` | Clinic phone for transfers |

---

## 📍 Where Variables Are Used

### Frontend (Static Web App)
Uses variables prefixed with `VITE_*` - these are baked into the build at compile time.

**Files:**
- `.env` - Local development
- `.env.production` - Production build

**Deployment:**
- Managed by Azure Static Web Apps
- Set in GitHub Actions workflow during build

### Backend (Container App)
Uses all variables (with and without `VITE_` prefix).

**Deployment:**
- Managed by Azure Container Apps
- Set via Azure CLI or Portal
- **Use the sync script:** `./scripts/sync-env-to-azure.sh`

---

## 🚀 How to Sync Environment Variables

### Automatic Sync (Recommended)

Run the sync script to automatically update Azure Container App with all variables from `.env`:

```bash
./scripts/sync-env-to-azure.sh
```

This script will:
1. ✅ Read variables from `.env`
2. ✅ Set secrets in Azure Container App
3. ✅ Set environment variables
4. ✅ Restart the container to apply changes

### Manual Sync

If you prefer manual setup:

```bash
# Set a secret
az containerapp secret set \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --secrets openai-api-key="sk-proj-..."

# Set environment variable referencing secret
az containerapp update \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --set-env-vars "VITE_OPENAI_API_KEY=secretref:openai-api-key"

# Restart to apply
az containerapp revision restart \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --revision [REVISION_NAME]
```

---

## 🔍 Troubleshooting

### Problem: "Failed to generate preview" error

**Cause:** Missing `VITE_OPENAI_API_KEY` or `VITE_ELEVENLABS_API_KEY`

**Solution:**
```bash
./scripts/sync-env-to-azure.sh
```

### Problem: Container app crashes on startup

**Check logs:**
```bash
az containerapp logs show \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --follow false \
  --tail 100
```

**Common causes:**
- Missing environment variable (shows `MODULE_NOT_FOUND` or similar)
- Invalid API key (shows `401 Unauthorized`)
- Missing config files in Docker image

### Problem: Environment variables not updating after deploy

**Cause:** New Docker image deployed without updating env vars

**Solution:**
1. Run sync script after every deployment
2. OR add env var sync to GitHub Actions workflow (see below)

---

## 🤖 GitHub Actions Integration

To automatically sync env vars on every backend deployment, add this to `.github/workflows/deploy-unified-container-app.yml`:

```yaml
- name: Sync Environment Variables
  run: |
    # Set secrets
    az containerapp secret set \
      --name tshla-unified-api \
      --resource-group tshla-backend-rg \
      --secrets \
        openai-api-key="${{ secrets.OPENAI_API_KEY }}" \
        vite-elevenlabs-api-key="${{ secrets.ELEVENLABS_API_KEY }}" \
        deepgram-api-key="${{ secrets.DEEPGRAM_API_KEY }}" \
        supabase-service-role-key="${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
        jwt-secret="${{ secrets.JWT_SECRET }}"

    # Set environment variables
    az containerapp update \
      --name tshla-unified-api \
      --resource-group tshla-backend-rg \
      --set-env-vars \
        "VITE_SUPABASE_URL=${{ secrets.SUPABASE_URL }}" \
        "VITE_OPENAI_API_KEY=secretref:openai-api-key" \
        "VITE_ELEVENLABS_API_KEY=secretref:vite-elevenlabs-api-key" \
        # ... etc
```

---

## 📋 Checklist for New Environment Variables

When adding a new environment variable:

- [ ] Add to `.env` (local development)
- [ ] Add to `.env.production` (if frontend variable)
- [ ] Add to this documentation
- [ ] Add to `scripts/sync-env-to-azure.sh`
- [ ] Add to GitHub Secrets (if sensitive)
- [ ] Add to GitHub Actions workflow (if using auto-sync)
- [ ] Run sync script to deploy: `./scripts/sync-env-to-azure.sh`
- [ ] Test in production

---

## 🆘 Getting Help

If environment variables are causing issues:

1. **Check this documentation** - Is the variable documented here?
2. **Check .env file** - Is the variable set correctly locally?
3. **Run sync script** - `./scripts/sync-env-to-azure.sh`
4. **Check Azure Portal** - Container Apps → tshla-unified-api → Environment variables
5. **Check logs** - `az containerapp logs show ...`

---

**Last Updated:** January 17, 2025
**Maintained by:** Development Team
