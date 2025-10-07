# 🚀 Production Deployment Guide - Admin Dashboard Fix

## What Needs to be Deployed

### Local Changes Made:
1. ✅ Created admin account in local database
2. ✅ Added `pump_reports` table
3. ✅ Added `email_verified` column to `pump_users`
4. ⚠️ No code changes required - all backend code already supports this!

### Production Requirements:
1. Create admin account in production database
2. Ensure `pump_reports` table exists
3. Ensure `pump_users` has required columns

---

## Production Database Info

**Host:** `tshla-mysql-staging.mysql.database.azure.com`
**Database:** `tshla_medical_staging` (based on .env files)
**User:** `tshlaadmin`
**Password:** `TshlaSecure2025!`

---

## 📋 Deployment Checklist

### ✅ Step 1: Verify Production Database Tables

First, check what tables exist in production:

```bash
mysql -h tshla-mysql-staging.mysql.database.azure.com \
  -u tshlaadmin \
  -p'TshlaSecure2025!' \
  tshla_medical_staging \
  -e "SHOW TABLES LIKE 'pump%';"
```

### ✅ Step 2: Create Missing Tables (if needed)

Run the production database setup script:

```bash
node create-production-tables.cjs
```

### ✅ Step 3: Create Admin Account in Production

Run the production admin creation script:

```bash
node create-production-admin.cjs
```

### ✅ Step 4: Deploy Frontend (Optional)

**The frontend doesn't need changes** - it already has the admin dashboard code!

But if you want to trigger a deployment:

```bash
git add .
git commit -m "Add admin account setup scripts and documentation"
git push origin main
```

This will trigger the GitHub Actions workflow to deploy to Azure Static Web Apps.

---

## 📝 Production Setup Scripts

I've created two scripts for you:

### 1. **create-production-tables.cjs**
Creates `pump_reports` table and adds missing columns to production database.

### 2. **create-production-admin.cjs**
Creates admin account `rakesh@tshla.ai` with password `TshlaSecure2025!` in production.

---

## 🔐 Production Login

Once deployed, login at:
- **URL:** https://www.tshla.ai/login
- **Email:** `rakesh@tshla.ai`
- **Password:** `TshlaSecure2025!`

Then access:
- **Admin Dashboard:** https://www.tshla.ai/admin/pumpdrive-users

---

## ⚠️ Important Notes

### Security Considerations:
1. **Change the default password** in production after first login
2. **Use environment variables** for sensitive data (already configured)
3. **JWT secret** is already unified across services

### Database Firewall:
- Production database may have firewall rules
- You may need to add your IP to Azure MySQL firewall
- Or run scripts from Azure Cloud Shell / GitHub Actions

### GitHub Secrets Required:
- ✅ `AZURE_STATIC_WEB_APPS_API_TOKEN` (for frontend)
- ✅ Database credentials in Azure Container Apps env vars (already set)

---

## 🎯 Quick Deploy (No Code Changes Needed)

Since **no code changes were made** (only database setup), you can:

### Option 1: Manual Database Setup
1. Run `create-production-tables.cjs`
2. Run `create-production-admin.cjs`
3. Login at https://www.tshla.ai/login

### Option 2: Commit Scripts & Docs
```bash
git add create-production-*.cjs DEPLOYMENT_GUIDE.md
git commit -m "Add production database setup scripts for admin dashboard"
git push origin main
```

Frontend will auto-deploy, but you still need to run the database scripts manually.

---

## 🔍 Verify Production Deployment

### Test Authentication:
```bash
curl -X POST https://tshla-auth-api-container.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/medical/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"rakesh@tshla.ai","password":"TshlaSecure2025!"}'
```

Should return:
```json
{
  "success": true,
  "user": {
    "role": "admin",
    ...
  },
  "token": "eyJ..."
}
```

### Test Admin API:
```bash
TOKEN="<token from above>"
curl -H "Authorization: Bearer $TOKEN" \
  https://tshla-pump-api-container.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/admin/pumpdrive-users
```

Should return user list with pump selections.

---

## 📊 Current Status

### Local Environment ✅
- Admin account: Working
- Database tables: Created
- Authentication: Working
- Admin dashboard: Accessible

### Production Environment ⏳
- Admin account: **Needs creation**
- Database tables: **Needs verification**
- Authentication: Already configured
- Admin dashboard: Code already deployed

---

## Next Steps

1. **Run production table script** (creates tables if missing)
2. **Run production admin script** (creates admin account)
3. **Test login** at https://www.tshla.ai/login
4. **Access dashboard** at https://www.tshla.ai/admin/pumpdrive-users

**That's it!** No code deployment needed - everything is already there! 🎉
