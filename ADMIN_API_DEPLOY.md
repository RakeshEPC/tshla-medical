# Admin Account Creation API - Deployment Guide

## Problem
The AccountManager UI cannot create accounts because Supabase Row Level Security (RLS) policies block inserts when using the anon key from the frontend.

## Solution
A backend API (`server/admin-account-api.js`) that uses the `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS policies.

## Local Testing

1. **Start the API server:**
   ```bash
   PORT=3004 node server/admin-account-api.js
   ```

2. **Start the frontend:**
   ```bash
   npm run dev
   ```

3. **Test account creation:**
   - Login as admin
   - Go to `/admin/account-manager`
   - Create a new account
   - Should work without RLS errors!

## Production Deployment (Azure)

### Option 1: Azure App Service

1. **Create Azure App Service:**
   ```bash
   az webapp create \
     --resource-group tshla-medical-rg \
     --plan tshla-medical-plan \
     --name tshla-admin-account-api \
     --runtime "NODE:18-lts"
   ```

2. **Configure environment variables:**
   ```bash
   az webapp config appsettings set \
     --resource-group tshla-medical-rg \
     --name tshla-admin-account-api \
     --settings \
       VITE_SUPABASE_URL="your-supabase-url" \
       SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   ```

3. **Deploy the app:**
   ```bash
   cd server
   az webapp deploy \
     --resource-group tshla-medical-rg \
     --name tshla-admin-account-api \
     --src-path admin-account-api.js \
     --type static
   ```

4. **Update frontend .env:**
   ```
   VITE_ADMIN_ACCOUNT_API_URL=https://tshla-admin-account-api.azurewebsites.net
   ```

### Option 2: Azure Container Instances

1. **Create Dockerfile:**
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY server/admin-account-api.js .
   COPY package*.json .
   RUN npm install --production
   EXPOSE 3004
   CMD ["node", "admin-account-api.js"]
   ```

2. **Build and push:**
   ```bash
   docker build -t tshlaacr.azurecr.io/admin-account-api:latest .
   docker push tshlaacr.azurecr.io/admin-account-api:latest
   ```

3. **Deploy container:**
   ```bash
   az container create \
     --resource-group tshla-medical-rg \
     --name admin-account-api \
     --image tshlaacr.azurecr.io/admin-account-api:latest \
     --dns-name-label tshla-admin-api \
     --ports 3004 \
     --environment-variables \
       VITE_SUPABASE_URL="your-url" \
       SUPABASE_SERVICE_ROLE_KEY="your-key"
   ```

## Temporary Workaround (Until API is deployed)

If the backend API is not yet deployed, you can fix orphaned accounts:

```bash
npx tsx scripts/fix-orphaned-account.ts
```

This script finds auth users without profile records and creates them.

## API Endpoints

### POST /api/accounts/create
Creates a new account (admin, staff, or patient)

**Headers:**
- `Content-Type: application/json`
- `Authorization: Bearer <supabase-session-token>`

**Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "accountType": "admin|staff|patient",
  "role": "staff|doctor|nurse", // For staff only
  "specialty": "Cardiology", // Optional
  "practice": "TSHLA Medical", // Optional
  "phoneNumber": "555-1234", // For patients
  "dateOfBirth": "1990-01-01", // For patients
  "enablePumpDrive": true // For patients
}
```

**Response:**
```json
{
  "success": true,
  "message": "Account created successfully",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "accountType": "admin",
    "avaId": "AVA 123-456" // For patients only
  }
}
```

### GET /api/health
Health check endpoint

**Response:**
```json
{
  "status": "ok",
  "service": "admin-account-api"
}
```

## Security Notes

- API requires valid Supabase session token in Authorization header
- Token is verified against Supabase auth
- User's role is checked - only admins/super_admins can create accounts
- Uses service role key server-side (never exposed to frontend)
- CORS restricted to trusted domains only

## Files Modified

- `server/admin-account-api.js` - New API server
- `src/pages/admin/AccountManager.tsx` - Updated to call API
- `scripts/fix-orphaned-account.ts` - Utility to fix incomplete accounts
- `.env` - Added `VITE_ADMIN_ACCOUNT_API_URL`
