# Backup Procedures
## TSHLA Medical

**Last Updated:** January 9, 2026

## Automated Backups

### Supabase Database
- **Frequency:** Daily at 3:00 AM UTC
- **Retention:** 30 days (minimum)
- **Type:** Full database dump + point-in-time recovery
- **Location:** Supabase managed backups (encrypted)
- **Verification:** Automatic integrity checks

### Audit Logs
- **Retention:** 7 years (HIPAA requirement)
- **Archive:** Monthly export to secure storage
- **Format:** JSON with encryption

### Application Code
- **Location:** GitHub repository
- **Branches:** main, develop, feature branches
- **Backup:** GitHub's redundant storage
- **Additional:** Weekly export to secure location

### Configuration
- **Environment Variables:** Azure Key Vault + GitHub Secrets
- **Infrastructure as Code:** Stored in repository
- **Backup:** Manual export monthly

## Manual Backup Procedures

### Emergency Database Export
```bash
# Connect to Supabase and export
pg_dump "postgresql://[connection-string]" > backup_$(date +%Y%m%d_%H%M%S).sql
# Encrypt the backup
gpg --encrypt --recipient tshla-backup@tshla.ai backup_*.sql
# Store securely offsite
```

### Configuration Backup
```bash
# Export GitHub secrets (requires admin access)
# Store in password manager or secure vault
```

## Restoration Testing
- **Monthly:** Verify backups are accessible
- **Quarterly:** Full restoration to test environment
- **Annually:** Complete DR drill with restoration

## Backup Verification Checklist
- [ ] Backup completed successfully
- [ ] Backup size reasonable (not corrupted)
- [ ] Backup accessible and readable
- [ ] Encryption verified
- [ ] Offsite copy confirmed
- [ ] Restoration test passed (quarterly)

**Maintained by:** IT Team
**Next Test:** [Date]
