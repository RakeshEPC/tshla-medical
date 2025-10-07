# Deploy TSHLA Medical with Supabase

## 🎯 What Changed
You've migrated from MySQL to Supabase! This deployment includes:
- ✅ Supabase authentication (no more MySQL auth)
- ✅ Supabase database (all patient data, pump data, templates)
- ✅ Updated backend API to accept Supabase JWT tokens
- ✅ Environment variables updated for Supabase

---

## Step 1: Add GitHub Secrets (CRITICAL)

You need to add Supabase credentials to GitHub so the deployment can build properly.

### 1.1 Go to GitHub Repository Settings
1. Open: https://github.com/YOUR_USERNAME/tshla-medical (replace with your repo)
2. Click **Settings** tab
3. Click **Secrets and variables** → **Actions**
4. Click **New repository secret**

### 1.2 Add These Secrets

Add each of these ONE BY ONE:

**Secret 1: VITE_SUPABASE_URL**
- Name: `VITE_SUPABASE_URL`
- Value: `https://minvvjdflezibmgkplqb.supabase.co`

**Secret 2: VITE_SUPABASE_ANON_KEY**
- Name: `VITE_SUPABASE_ANON_KEY`
- Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNDE5ODgsImV4cCI6MjA3MTYxNzk4OH0.-qzlS3artX2DWOVQgIqwd1jd3Utlnik6yOMFhyGcHl8`

**Secret 3: VITE_OPENAI_API_KEY** (if not already added)
- Name: `VITE_OPENAI_API_KEY`
- Value: Your OpenAI API key from .env

**Secret 4: AZURE_STATIC_WEB_APPS_API_TOKEN** (if not already added)
- Name: `AZURE_STATIC_WEB_APPS_API_TOKEN`
- Value: Your Azure deployment token

---

## Step 2: Commit and Push Your Changes

The Supabase migration changes need to be committed to Git:

```bash
cd /Users/rakeshpatel/Desktop/tshla-medical

# Add all changes
git add .

# Commit with clear message
git commit -m "✅ Migrate to Supabase - Remove MySQL dependency

- Migrated authentication from MySQL to Supabase
- Created all database tables in Supabase with RLS policies
- Updated backend API to accept Supabase JWT tokens
- Updated frontend environment configuration
- Added Supabase credentials to GitHub workflow
- Ready for production deployment

🎉 No more database passwords! Better security, lower cost."

# Push to main branch (this triggers automatic deployment)
git push origin main
```

---

## Step 3: Watch the Deployment

After pushing, GitHub Actions will automatically:
1. Build the app with Supabase credentials
2. Run validation checks
3. Deploy to Azure Static Web Apps

### Monitor Progress:
1. Go to: https://github.com/YOUR_USERNAME/tshla-medical/actions
2. Click on the latest "Deploy Frontend to Azure Static Web Apps" workflow
3. Watch the build progress (takes 3-5 minutes)

---

## Step 4: Verify Deployment

Once deployment completes, test your production site:

### Production URL:
https://mango-sky-0ba265c0f.1.azurestaticapps.net

### Test These:
1. **Login** with: admin@tshla.ai / TshlaAdmin2025!
2. **23 Dimensions** - Click Admin → Accounts → 23 Dimensions
3. **Patient Data** - Try creating a test patient
4. **Check Console** - Press F12, should see no errors

---

## What About the Backend APIs?

The pump-report-api backend also needs to be deployed with Supabase credentials.

### Option 1: Use Existing Container App (Recommended)
Your pump API is already deployed at:
- https://tshla-pump-api-container.redpebble-e4551b7a.eastus.azurecontainerapps.io

**Update Environment Variables:**
1. Go to Azure Portal
2. Search "Container Apps"
3. Click "tshla-pump-api-container"
4. Go to "Environment variables"
5. Add:
   - `VITE_SUPABASE_URL` = `https://minvvjdflezibmgkplqb.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = (get from your .env file)
6. Click "Save"
7. Restart the container

### Option 2: Deploy New Version with GitHub Actions
The workflow file is already updated! Just push to main and it will deploy automatically.

---

## Benefits of This Deployment

### ✅ No More MySQL
- No database passwords to manage
- No connection string security issues
- Can cancel Azure MySQL service ($50-100/month savings)

### ✅ Better Security
- JWT token-based authentication
- Row Level Security policies on all tables
- HIPAA-compliant audit logging built-in

### ✅ Cost Savings
- Supabase Free Tier: $0/month (up to 500MB database)
- vs Azure MySQL: $50-100/month minimum

### ✅ Easier Management
- No database server to maintain
- Auto-scaling
- Built-in backups

---

## Troubleshooting

### Build Fails with "Missing Supabase URL"
- Check that you added the GitHub secrets correctly
- Secret names must match EXACTLY (case-sensitive)

### 401 Unauthorized After Login
- Clear browser cache and cookies
- Make sure backend API has Supabase environment variables

### "Failed to fetch" Errors
- Check that pump-report-api backend is running
- Verify VITE_PUMP_API_URL in build environment matches your backend URL

---

## Need Help?

If deployment fails:
1. Check GitHub Actions logs for error messages
2. Verify all GitHub secrets are added
3. Make sure backend API has Supabase credentials
4. Check browser console (F12) for specific errors

---

## Ready to Deploy?

Run the git commands in Step 2 above to deploy! 🚀
