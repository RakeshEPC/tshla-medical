# Recovery Procedures
## Step-by-Step Instructions

**Last Updated:** January 9, 2026

## Database Recovery

### Step 1: Access Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select project: minvvjdflezibmgkplqb
3. Navigate to Settings → Database → Backups

### Step 2: Choose Recovery Point
1. Review available backups (daily for past 30 days)
2. Select backup timestamp before incident
3. Alternative: Use point-in-time recovery if available

### Step 3: Restore Database
1. Click "Restore" on selected backup
2. Confirm restoration (THIS WILL OVERWRITE CURRENT DATA)
3. Wait for restoration to complete (5-15 minutes)
4. Verify restoration success

### Step 4: Verify Data Integrity
```sql
-- Check patient count
SELECT COUNT(*) FROM patients;

-- Check recent audit logs exist
SELECT COUNT(*) FROM audit_logs WHERE timestamp > NOW() - INTERVAL '7 days';

-- Verify RLS policies intact
SELECT * FROM pg_policies WHERE schemaname = 'public';
```

### Step 5: Resume Operations
1. Test login functionality
2. Test patient data access
3. Test critical workflows
4. Notify staff that system is restored
5. Document restoration in incident log

## Application Recovery

### Step 1: Assess Situation
```bash
# Check container status
az containerapp list --resource-group tshla-medical

# Check recent deployments
gh run list --workflow=deploy-frontend.yml --limit 10
```

### Step 2: Rollback to Previous Version
```bash
# Option A: Rollback in Azure Portal
# Go to Container Apps → Revisions → Activate previous revision

# Option B: Redeploy last known good version
git checkout [last-good-commit]
gh workflow run deploy-frontend.yml
```

### Step 3: Verify Health
```bash
# Check health endpoint
curl https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/health

# Check database connectivity
curl https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/health
```

## Configuration Recovery

### Lost Environment Variables
1. Retrieve from Azure Key Vault:
   ```bash
   az keyvault secret list --vault-name tshla-keyvault
   az keyvault secret show --vault-name tshla-keyvault --name [secret-name]
   ```

2. Retrieve from GitHub Secrets:
   - Settings → Secrets and variables → Actions
   - Re-add if necessary

### Lost Database Credentials
1. Reset in Supabase Dashboard
2. Update in Azure Key Vault
3. Update in GitHub Secrets
4. Redeploy application

## Contact Support

### Supabase Issues
- Dashboard: https://supabase.com/dashboard/support
- Email: support@supabase.com
- Include: Project ID, timestamp of issue, error messages

### Azure Issues
- Portal: https://portal.azure.com
- Create support ticket: Support + troubleshooting → New support request
- Include: Subscription ID, resource name, error logs

**CRITICAL:** Document ALL recovery actions in incident report for HIPAA compliance.
