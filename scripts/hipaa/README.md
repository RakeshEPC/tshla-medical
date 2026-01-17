# HIPAA Compliance Scripts

This directory contains automated scripts for implementing high-priority HIPAA compliance tasks.

## 📁 Scripts Overview

| Script | Purpose | Duration | Prerequisites |
|--------|---------|----------|---------------|
| `01-setup-key-vault.sh` | Create Azure Key Vault | ~30 min | Azure CLI, logged in |
| `02-migrate-secrets.sh` | Migrate secrets from .env | ~20 min | Script #1 complete, .env file |
| `03-configure-container-app.sh` | Configure Container App | ~15 min | Scripts #1-2 complete |
| `04-validate-dr-restore.sql` | Validate backup restoration | ~10 min | Test DB restored |
| `05-migrate-console-logs.sh` | Prep logging migration | ~10 min | None |

## 🚀 Quick Start

### Task 1: Azure Key Vault Migration

```bash
# Execute in order:
./01-setup-key-vault.sh
./02-migrate-secrets.sh
./03-configure-container-app.sh

# Then test:
curl https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/health
```

### Task 2: DR Test Validation

```bash
# After restoring backup to test DB:
psql "postgresql://postgres:[PWD]@[test-db].supabase.co:5432/postgres" \
  -f 04-validate-dr-restore.sql \
  > ../tests/dr-results-$(date +%Y-%m-%d).txt
```

### Task 3: Logging Migration

```bash
# Prep files:
./05-migrate-console-logs.sh

# Then manually migrate each file
# See: ../docs/HIPAA_HIGH_PRIORITY_IMPLEMENTATION.md
```

## 📋 Execution Order

```
┌─────────────────────────────────────┐
│  TASK 1: Azure Key Vault            │
│  ─────────────────────────────────  │
│  1. 01-setup-key-vault.sh          │
│  2. 02-migrate-secrets.sh          │
│  3. 03-configure-container-app.sh  │
│  4. Test & Validate                 │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  TASK 2: DR Test                    │
│  ─────────────────────────────────  │
│  1. Create test DB (manual)         │
│  2. 04-validate-dr-restore.sql     │
│  3. Document results                │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  TASK 3: Logging Migration          │
│  ─────────────────────────────────  │
│  1. 05-migrate-console-logs.sh     │
│  2. Manual file migration           │
│  3. Add ESLint rules                │
└─────────────────────────────────────┘
```

## ⚙️ Script Details

### 01-setup-key-vault.sh

**Purpose:** Creates and configures Azure Key Vault for HIPAA-compliant secret storage

**What it does:**
- Creates Key Vault: `tshla-kv-prod`
- Enables purge protection (90 days)
- Configures access policies
- Enables Managed Identity on Container App
- Grants Container App access to Key Vault

**Usage:**
```bash
./01-setup-key-vault.sh
```

**Output:**
- Key Vault created at: `https://tshla-kv-prod.vault.azure.net`
- Managed Identity enabled
- Access policies configured

---

### 02-migrate-secrets.sh

**Purpose:** Migrates secrets from `.env` file to Azure Key Vault

**What it does:**
- Reads secrets from `.env` file
- Uploads to Key Vault with proper naming
- Masks sensitive values in output
- Verifies successful migration

**Secrets migrated:**
- `SUPABASE_SERVICE_ROLE_KEY`
- `AZURE_OPENAI_KEY`
- `JWT_SECRET`
- `VITE_DEEPGRAM_API_KEY`
- `ELEVENLABS_API_KEY`
- `STRIPE_SECRET_KEY`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_URL`

**Usage:**
```bash
./02-migrate-secrets.sh
```

**Prerequisites:**
- `.env` file exists
- Key Vault created (script #1)

---

### 03-configure-container-app.sh

**Purpose:** Configures Container App to use Key Vault secrets

**What it does:**
- Sets up secret references to Key Vault
- Updates environment variables
- Triggers Container App restart

**Usage:**
```bash
./03-configure-container-app.sh
```

**Prerequisites:**
- Secrets in Key Vault (script #2)
- Container App deployed

**Verification:**
```bash
az containerapp show -n tshla-unified-api -g tshla-medical-rg \
  --query properties.runningStatus
```

---

### 04-validate-dr-restore.sql

**Purpose:** Comprehensive validation of restored database backup

**What it tests:**
1. Table count (should be ~40 tables)
2. Record counts in critical tables
3. RLS policy verification
4. Data freshness (RPO check)
5. Audit log integrity
6. User account restoration
7. Database statistics
8. Data corruption detection

**Usage:**
```bash
# Via psql:
psql "postgresql://postgres:[PWD]@[test-db].supabase.co:5432/postgres" \
  -f 04-validate-dr-restore.sql

# Or via Supabase Dashboard:
# Copy contents and paste into SQL Editor
```

**Output:**
- Detailed validation results
- Pass/fail status for each test
- Recommendations

---

### 05-migrate-console-logs.sh

**Purpose:** Prepares files for console.log → logger migration

**What it does:**
- Identifies console usage in critical files
- Creates backup files (.pre-migration.bak)
- Reports migration status
- Shows sample console usage

**Usage:**
```bash
./05-migrate-console-logs.sh
```

**Note:** This is a PREP script. Manual migration still required.

**Next steps:**
- Review each file manually
- Add logger imports
- Replace console.* with logger.*
- Sanitize PHI

---

## 🔒 Security Notes

**Important:**
- Never commit `.env` files to Git
- Rotate secrets after migration
- Keep backup .env encrypted
- Review logs for sensitive data

**Emergency Rollback:**
```bash
# Restore a file from backup:
cp file.js.pre-migration.bak file.js

# Restore .env from encrypted backup:
gpg --decrypt tshla-env-backup-*.gpg > .env
```

## 📞 Support

**Issues with scripts:**
- Check Azure CLI version: `az --version`
- Verify logged in: `az account show`
- Check permissions: `az role assignment list`

**Questions:**
- See: `../docs/HIPAA_HIGH_PRIORITY_IMPLEMENTATION.md`
- Contact: compliance@tshla.ai

---

**Created:** January 17, 2026
**Maintained by:** DevOps Team
