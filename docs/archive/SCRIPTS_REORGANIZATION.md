# Script Reorganization Plan

## Current Root Scripts (15 files)

### Database Scripts → Move to `scripts/database/`
- `add-admin-column.cjs` - Add is_admin column to pump_users
- `add-missing-columns.cjs` - Database schema updates  
- `create-access-logs-now.cjs` - Create access_logs table
- `create-all-tables.cjs` - DUPLICATE - can be removed
- `create-medical-staff-table.cjs` - Create medical_staff table
- `create-production-admin.cjs` - Create admin user in production
- `create-production-tables.cjs` - DUPLICATE - can be removed  
- `create-rakesh-admin.cjs` - Create rakesh admin user
- `setup-database.cjs` - MASTER script - keep in root or scripts/

### Deployment Scripts → Move to `scripts/deployment/`
- `deploy-frontend.sh` - Deploy to Azure Static Web Apps
- `query-via-api.sh` - Test database via API

### Server Management → Move to `scripts/server/`
- `manage-servers.sh` - PM2 server management
- `pm2-setup-startup.sh` - PM2 startup configuration  
- `start-pump-api.sh` - Start pump API locally

### Keep in Root
- `ecosystem.config.cjs` - PM2 configuration (standard location)

## Recommended Actions

1. **Consolidate Duplicates**:
   - Delete `create-all-tables.cjs` and `create-production-tables.cjs`
   - Keep only `setup-database.cjs` as master setup script

2. **Move Scripts**:
```bash
# Database scripts
mv add-admin-column.cjs scripts/database/
mv add-missing-columns.cjs scripts/database/
mv create-access-logs-now.cjs scripts/database/
mv create-medical-staff-table.cjs scripts/database/
mv create-production-admin.cjs scripts/database/
mv create-rakesh-admin.cjs scripts/database/
mv setup-database.cjs scripts/database/

# Deployment scripts  
mv deploy-frontend.sh scripts/deployment/
mv query-via-api.sh scripts/deployment/

# Server scripts
mv manage-servers.sh scripts/server/
mv pm2-setup-startup.sh scripts/server/
mv start-pump-api.sh scripts/server/

# Delete duplicates
rm create-all-tables.cjs create-production-tables.cjs
```

3. **Update .gitignore** to keep directories:
```
!scripts/database/.gitkeep
!scripts/deployment/.gitkeep
!scripts/server/.gitkeep
```

## Result
- Root directory: 1 file (ecosystem.config.cjs)
- scripts/database/: 7 files
- scripts/deployment/: 2 files
- scripts/server/: 3 files
- Total: 13 files (down from 15, removed 2 duplicates)
