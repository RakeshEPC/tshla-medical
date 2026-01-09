# Disaster Recovery Plan
## TSHLA Medical

**Last Updated:** January 9, 2026
**HIPAA:** §164.308(a)(7) - Contingency Plan

## Recovery Objectives
- **RTO (Recovery Time Objective):** 4 hours
- **RPO (Recovery Point Objective):** 1 hour
- **Maximum Tolerable Downtime:** 8 hours

## Infrastructure

### Critical Systems
1. **Supabase Database** (Primary PHI storage)
2. **Azure Container Apps** (Application hosting)
3. **Authentication Services** (Supabase Auth)
4. **Azure OpenAI** (AI processing)

### Backup Strategy
- **Database:** Supabase automatic daily backups + point-in-time recovery
- **Code:** GitHub repository (multiple copies)
- **Configuration:** Azure Key Vault + GitHub Secrets
- **Audit Logs:** 7-year retention in Supabase

## Disaster Scenarios

### Scenario 1: Database Failure
**Impact:** Complete loss of patient data access
**Recovery Steps:**
1. Verify Supabase status dashboard
2. Contact Supabase support (priority ticket)
3. If Supabase down: Restore from backup (see BACKUP-PROCEDURES.md)
4. If corruption: Point-in-time recovery to last known good state
5. Verify data integrity after restoration
6. Resume operations

### Scenario 2: Application Failure
**Impact:** Users cannot access application
**Recovery Steps:**
1. Check Azure Container Apps status
2. Review application logs
3. If deployment issue: Rollback to previous version
4. If infrastructure issue: Redeploy to new container
5. Verify health checks pass
6. Resume operations

### Scenario 3: Cyber Attack/Breach
**Impact:** Security compromise, possible data exposure
**Recovery Steps:**
1. Activate BREACH-RESPONSE-PLAN.md immediately
2. Isolate affected systems
3. Preserve evidence
4. Restore from clean backup
5. Patch vulnerabilities
6. Enhanced monitoring for 30 days

### Scenario 4: Regional Azure Outage
**Impact:** Complete service unavailability
**Recovery Steps:**
1. Confirm outage scope via Azure status
2. If extended outage: Deploy to alternate region
3. Update DNS to point to new region
4. Restore database from backup to new region
5. Verify all services operational

## Contact Information
- **Supabase Support:** support@supabase.com (Priority: High)
- **Azure Support:** https://portal.azure.com (Submit ticket)
- **Deepgram Support:** support@deepgram.com
- **Internal IT Lead:** [Phone Number]

## Testing Schedule
- **Quarterly:** Backup restoration test
- **Annually:** Full DR drill
- **After Changes:** Mini-drill for affected systems

## Communication Plan
During disaster:
1. Alert all staff via [communication channel]
2. Post status updates every hour
3. Notify patients if downtime >4 hours
4. Document all actions taken

See: [RECOVERY-PROCEDURES.md](./RECOVERY-PROCEDURES.md) for step-by-step recovery instructions.
