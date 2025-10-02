# PumpDrive Login Fix - Complete Guide

## Problem
- ❌ PumpDrive login returns 401 "Invalid email or password"
- ❌ No test users exist in production `pump_users` table
- ❌ Cannot connect to Azure MySQL from local machine (firewall)

## Solutions

### Option 1: Seed Users via Azure Container (Recommended)

Since the pump API is running as Azure Container App with database access, run the seed script there:

**Step 1: SSH into Azure Container**
```bash
az containerapp exec \
  --name tshla-pump-api-container \
  --resource-group tshla-backend-rg \
  --command /bin/sh
```

**Step 2: Run seed script**
```bash
# Inside container
node /app/server/scripts/seed-pump-users.js
```

This will create 3 test users:
- `demo@pumpdrive.com` / `pumpdrive2025`
- `rakesh@tshla.ai` / `Indianswing44$`
- `test@pumpdrive.com` / `test123`

### Option 2: Use Registration Endpoint

The pump API has a registration endpoint at `/api/auth/register`:

```bash
curl -X POST https://tshla-pump-api-container.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@pumpdrive.com",
    "password": "pumpdrive2025",
    "username": "demo",
    "firstName": "Demo",
    "lastName": "User"
  }'
```

### Option 3: Local Database (Development Only)

If testing locally with MySQL:

```bash
# Run seed script locally
npm run db:seed:pump
```

## Seed Script Details

**File:** `server/scripts/seed-pump-users.js`

**What it does:**
1. Connects to MySQL database
2. Checks if pump_users table exists
3. Creates/updates these test users:
   - Demo user for testing
   - Your admin account
   - Research participant test user
4. Shows all pump users in database

**Run command:**
```bash
npm run db:seed:pump
```

**Environment variables needed:**
- `DB_HOST` - Database host (default: tshla-mysql-prod.mysql.database.azure.com)
- `DB_USER` - Database user (default: tshlaadmin)
- `DB_PASSWORD` - Database password (default: TshlaSecure2025!)
- `DB_DATABASE` - Database name (default: tshla_medical)

## React Router Warnings - FIXED ✅

Added future flags to eliminate v7 migration warnings:

**File:** `src/App.tsx` (line 93)

```typescript
<Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
```

**What this does:**
- ✅ Opts into React Router v7 behavior early
- ✅ Eliminates console warnings
- ✅ Prepares codebase for React Router v7 upgrade

## Test Credentials

After seeding, use these to test PumpDrive login:

### Demo User
- **Email:** demo@pumpdrive.com
- **Password:** pumpdrive2025

### Admin User
- **Email:** rakesh@tshla.ai
- **Password:** Indianswing44$

### Test User (Research Participant)
- **Email:** test@pumpdrive.com
- **Password:** test123

## Verification Steps

### 1. Check if users exist
```bash
# Via API (if container has curl)
curl -X POST https://tshla-pump-api-container.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@pumpdrive.com","password":"pumpdrive2025"}'
```

Expected success response:
```json
{
  "success": true,
  "message": "Login successful",
  "user": { ... },
  "token": "..."
}
```

### 2. Test in browser
1. Go to https://www.tshla.ai/pumpdrive-login
2. Enter: `demo@pumpdrive.com` / `pumpdrive2025`
3. Should redirect to PumpDrive assessment

### 3. Check React Router
- Open browser console
- Should see NO warnings about:
  - `v7_startTransition`
  - `v7_relativeSplatPath`

## Troubleshooting

### Error: "Cannot connect to database"
**Cause:** Database firewall blocking connection

**Solutions:**
1. Run seed script from Azure Container (has DB access)
2. Or add your IP to Azure MySQL firewall rules:
   ```bash
   az mysql flexible-server firewall-rule create \
     --resource-group tshla-backend-rg \
     --name tshla-mysql-prod \
     --rule-name AllowMyIP \
     --start-ip-address YOUR_IP \
     --end-ip-address YOUR_IP
   ```

### Error: "Table pump_users does not exist"
**Cause:** Database schema not created

**Solution:** Run table creation script first:
```bash
node create-all-tables.cjs
```

### Login still returns 401
**Possible causes:**
1. User not created (run seed script)
2. Wrong password (check exact password in seed script)
3. User is_active = 0 (seed script sets to 1)
4. Database connection issue (check API logs)

**Check API logs:**
```bash
az containerapp logs show \
  --name tshla-pump-api-container \
  --resource-group tshla-backend-rg \
  --follow
```

## Summary

### What Was Fixed ✅
1. **React Router warnings** - Added future flags
2. **Created seed script** - `server/scripts/seed-pump-users.js`
3. **Added npm command** - `npm run db:seed:pump`
4. **Documentation** - This guide

### Next Steps
1. **Run seed script** on Azure Container or use registration endpoint
2. **Test login** with demo credentials
3. **Verify** no console warnings

---

**Last Updated:** 2025-10-02
**Status:** Ready to deploy seed script to production
