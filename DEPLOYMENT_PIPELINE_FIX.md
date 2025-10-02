# 🚨 Deployment Pipeline Issue - FOUND ROOT CAUSE

## Problem Summary

**GitHub Actions is running the WRONG workflow** that tries to deploy to a non-existent Azure Web App.

---

## 🔍 Investigation Findings

### **Current Workflow Structure**:

```
.github/workflows/
├── deploy-pump-api-container.yml       ✅ CORRECT (Container Apps)
├── deploy-schedule-api-container.yml   ✅ CORRECT (Container Apps)
├── deploy-auth-api-container.yml       ✅ CORRECT (Container Apps)
└── .github/workflows/                  ❌ NESTED DIRECTORY (shouldn't exist)
    ├── deploy-pump-api.yml             ❌ WRONG (targets Web App)
    ├── deploy-schedule-api.yml         ❌ WRONG (targets Web App)
    └── deploy-auth-api.yml             ❌ WRONG (targets Web App)
```

### **The Issue**:

There are **DUPLICATE workflows** in a nested `.github/workflows/.github/workflows/` directory. These old workflows:

1. Target **Azure Web App**: `tshla-pump-api.azurewebsites.net` (doesn't exist)
2. Use `azure/webapps-deploy@v2` action (wrong)
3. Create `web.config` for IIS (not needed for containers)
4. Fail with `ENOTFOUND` error

### **The Correct Workflows**:

The correct workflows (in `/Users/rakeshpatel/Desktop/tshla-medical/.github/workflows/`) target:

1. **Azure Container Apps**: `tshla-pump-api-container.redpebble-e4551b7a.eastus.azurecontainerapps.io` ✅
2. Use `az containerapp update` command ✅
3. Build Docker images ✅
4. Push to Azure Container Registry ✅

---

## 🎯 Evidence of the Problem

### **Failed Deployment Log**:

```
2025-10-02T00:25:28.8350808Z ##[error]ENOTFOUND
2025-10-02T00:25:28.8353352Z ##[error]Failed to deploy web package to App Service.
2025-10-02T00:25:28.8356403Z ##[error]Deployment Failed, Error: Failed to deploy web package to App Service.
getaddrinfo ENOTFOUND tshla-pump-api.scm.azurewebsites.net
```

**Translation**: The workflow tried to connect to `tshla-pump-api.scm.azurewebsites.net` (doesn't exist).

### **Verification**:

```bash
# Check if Web App exists (it doesn't)
$ az webapp show --name tshla-pump-api --resource-group tshla-backend-rg
ERROR: ResourceNotFound

# Check if Container App exists (it does)
$ az containerapp show --name tshla-pump-api-container --resource-group tshla-backend-rg
✅ SUCCESS - Running on revision 0000004
```

---

## ✅ THE FIX

### **Option 1: Delete Nested Workflows** (Recommended)

```bash
# Navigate to project
cd /Users/rakeshpatel/Desktop/tshla-medical

# Remove the nested workflow directory entirely
rm -rf .github/workflows/.github

# Commit and push
git add -A
git commit -m "Fix: Remove duplicate nested workflows targeting Web App"
git push origin main
```

**Why this works**:
- Removes the broken workflows
- Keeps the correct Container App workflows
- GitHub Actions will only run the correct workflows

---

### **Option 2: Move Them to Archive** (Safer)

```bash
# Create archive directory
mkdir -p .github/workflows-archive

# Move old workflows
mv .github/workflows/.github .github/workflows-archive/old-webapp-workflows

# Commit and push
git add -A
git commit -m "Archive: Move old Web App workflows to archive folder"
git push origin main
```

**Why this works**:
- Workflows in non-standard directories won't run
- You keep the old workflows for reference
- Can restore if needed

---

### **Option 3: Disable Workflows** (Most Conservative)

Rename the bad workflows to `.yml.disabled`:

```bash
cd /Users/rakeshpatel/Desktop/tshla-medical/.github/workflows/.github/workflows

# Disable each workflow
mv deploy-pump-api.yml deploy-pump-api.yml.disabled
mv deploy-auth-api.yml deploy-auth-api.yml.disabled
mv deploy-schedule-api.yml deploy-schedule-api.yml.disabled

# Commit
cd /Users/rakeshpatel/Desktop/tshla-medical
git add -A
git commit -m "Disable: Old Web App deployment workflows"
git push origin main
```

---

## 🧪 Testing the Fix

After applying the fix:

1. **Trigger a deployment**:
   ```bash
   # Make a trivial change
   cd /Users/rakeshpatel/Desktop/tshla-medical
   echo "# Deployment test" >> README.md
   git add README.md
   git commit -m "Test deployment pipeline fix"
   git push origin main
   ```

2. **Watch the workflow**:
   ```bash
   gh run watch
   ```

3. **Expected Result**:
   - ✅ Workflow name: "Deploy Pump API to Azure Container Apps"
   - ✅ Steps: Build Docker image → Push to ACR → Update Container App
   - ✅ No `ENOTFOUND` errors
   - ✅ Deployment completes successfully

---

## 📋 Why This Happened

### **Root Cause**:

Someone created a nested `.github/workflows/` directory **inside** the main `.github/workflows/` directory. This likely happened during:

1. A refactoring/reorganization
2. Accidental copy-paste of directory structure
3. Git merge conflict resolution gone wrong

### **How GitHub Actions Works**:

GitHub Actions **recursively searches** for `.yml` files in `.github/workflows/`, so it found BOTH:
- The correct workflows in `.github/workflows/*.yml`
- The old workflows in `.github/workflows/.github/workflows/*.yml`

When both workflows trigger on the same event (push to main), **both run**, but the old one fails.

---

## 🎓 Prevention

To prevent this in the future:

1. **Add `.github/workflows` to `.gitignore`?** ❌ No, we need to track workflows
2. **Use workflow naming conventions**? ✅ Yes - prefix with `containerapp-` or `webapp-`
3. **Add CI lint check**? ✅ Yes - validate no nested workflows
4. **Document deployment process**? ✅ Yes - create DEPLOYMENT.md

### **Suggested .github workflow lint script**:

```bash
#!/bin/bash
# .github/scripts/validate-workflows.sh

echo "🔍 Checking for nested workflow directories..."

if [ -d ".github/workflows/.github" ]; then
  echo "❌ ERROR: Nested .github directory found!"
  echo "   Location: .github/workflows/.github"
  echo "   This causes duplicate workflow runs."
  exit 1
fi

echo "✅ No nested workflows found"
exit 0
```

Add to GitHub Actions:

```yaml
# .github/workflows/validate-structure.yml
name: Validate Repository Structure
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: bash .github/scripts/validate-workflows.sh
```

---

## 📝 Recommended Action

**I recommend Option 1 (Delete)** because:

1. ✅ Clean and simple
2. ✅ Removes the problem entirely
3. ✅ Old workflows are in git history if needed
4. ✅ No confusion about which workflows are active

**Ready to execute?** I can run the commands for you.

---

## 🚀 Next Steps After Fix

Once deployment pipeline is fixed:

1. **Verify all 3 container apps deploy correctly**:
   - Pump API
   - Auth API
   - Schedule API

2. **Set up deployment notifications**:
   - Discord/Slack webhook for deployment status
   - Email on deployment failure

3. **Add deployment health checks**:
   - Workflow should call `/api/health` after deployment
   - Fail if health check returns non-200

4. **Document the deployment process**:
   - What triggers deployment
   - How long it takes
   - How to rollback

---

**End of Analysis**

Ready to apply the fix? Choose an option (1, 2, or 3).
