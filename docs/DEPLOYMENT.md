# TSHLA Medical - Deployment Guide

## Prerequisites

### Required Accounts
- [x] GitHub account (for CI/CD)
- [x] Azure account (for Container Apps)
- [x] Supabase account (for database & auth)
- [x] OpenAI account (for AI features)
- [x] Deepgram account (for speech-to-text)

### Required Tools
- Node.js 18+ and npm
- Docker (for local testing)
- Git
- Azure CLI (optional, for manual deployment)

## Environment Setup

### 1. Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Create new project
3. Copy your project credentials:
   - Project URL: `https://[project-id].supabase.co`
   - Anon/Public Key: Found in Settings → API
   - Service Role Key: Found in Settings → API (keep secret!)

4. Run database setup SQL:
   - Execute `scripts/database/supabase-auth-tables.sql`
   - Execute `scripts/database/supabase-patient-data-migration.sql`
   - Execute `scripts/database/supabase-pump-comparison-migration.sql`
   - Execute `scripts/database/insert-all-23-dimensions.sql`

5. Create admin user in Supabase Dashboard:
   - Go to Authentication → Users
   - Add User with email/password
   - Link to `medical_staff` table

### 2. Configure Environment Variables

Create `.env` file in project root:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# OpenAI Configuration
VITE_OPENAI_API_KEY=your_openai_api_key_here
VITE_OPENAI_MODEL_STAGE4=gpt-4o-mini
VITE_OPENAI_MODEL_STAGE5=gpt-4o
VITE_OPENAI_MODEL_STAGE6=gpt-4o
VITE_PRIMARY_AI_PROVIDER=openai

# Deepgram Configuration
VITE_DEEPGRAM_API_KEY=your_deepgram_api_key_here
VITE_DEEPGRAM_MODEL=nova-2-medical
VITE_PRIMARY_STT_PROVIDER=deepgram

# API URLs (adjust for production)
VITE_API_URL=http://localhost:3005
VITE_PUMP_API_URL=http://localhost:3005

# Security Settings
JWT_SECRET=your-secure-random-string-here
VITE_SESSION_TIMEOUT_MINUTES=120
VITE_ENABLE_HIPAA_MODE=true

# Optional: Stripe (for payments)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...

# Optional: SendGrid (for emails)
SMTP_PASSWORD=SG.your_sendgrid_api_key
```

See `.env.example` for complete configuration options.

## Local Development

### Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development servers:**
   ```bash
   # Start frontend + all backend APIs
   npm run dev:full

   # Or individually:
   npm run dev              # Frontend only (port 5173)
   npm run api:start        # Pump API (port 3005)
   ```

3. **Access the application:**
   - Frontend: http://localhost:5173
   - Pump API: http://localhost:3005
   - Health check: http://localhost:3005/api/health

### Stop Development Servers

```bash
npm run dev:stop
```

## Production Deployment

### Option 1: Automated Deployment (GitHub Actions)

This project uses GitHub Actions for automated deployment to Azure Container Apps.

#### Setup GitHub Secrets

Add these secrets to your GitHub repository (Settings → Secrets → Actions):

```
AZURE_CREDENTIALS        # Service principal credentials
AZURE_REGISTRY_NAME      # Azure Container Registry name
AZURE_RG                 # Resource group name
VITE_SUPABASE_URL       # Supabase project URL
VITE_SUPABASE_ANON_KEY  # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY # Supabase service role key
VITE_OPENAI_API_KEY     # OpenAI API key
VITE_DEEPGRAM_API_KEY   # Deepgram API key
JWT_SECRET              # JWT secret for auth
```

#### Deploy

1. **Push to main branch:**
   ```bash
   git add .
   git commit -m "Deploy to production"
   git push origin main
   ```

2. **GitHub Actions will automatically:**
   - Build Docker images
   - Push to Azure Container Registry
   - Deploy to Azure Container Apps
   - Run health checks

3. **Monitor deployment:**
   - Go to Actions tab in GitHub
   - Watch deployment workflow progress

### Option 2: Manual Deployment

#### Build Docker Images

```bash
# Frontend
docker build -t tshla-frontend -f Dockerfile .

# Pump API
docker build -t tshla-pump-api -f server/Dockerfile.pump .

# Auth API (optional)
docker build -t tshla-auth-api -f server/Dockerfile.auth .
```

#### Push to Azure Container Registry

```bash
# Login
az acr login --name your-registry-name

# Tag images
docker tag tshla-frontend your-registry.azurecr.io/tshla-frontend:latest
docker tag tshla-pump-api your-registry.azurecr.io/tshla-pump-api:latest

# Push
docker push your-registry.azurecr.io/tshla-frontend:latest
docker push your-registry.azurecr.io/tshla-pump-api:latest
```

#### Deploy to Azure Container Apps

```bash
# Frontend
az containerapp update \
  --name tshla-frontend-container \
  --resource-group your-rg \
  --image your-registry.azurecr.io/tshla-frontend:latest

# Pump API
az containerapp update \
  --name tshla-pump-api-container \
  --resource-group your-rg \
  --image your-registry.azurecr.io/tshla-pump-api:latest
```

## Deployment Verification

### 1. Health Checks

```bash
# Frontend
curl https://your-app.azurecontainerapps.io

# Pump API
curl https://your-pump-api.azurecontainerapps.io/api/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2025-10-07T...",
  "supabase": "connected"
}
```

### 2. Test Authentication

```bash
# Test login
curl -X POST https://your-pump-api.azurecontainerapps.io/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@tshla.ai","password":"your-password"}'
```

### 3. Test PumpDrive API

```bash
# Start assessment
curl -X POST https://your-pump-api.azurecontainerapps.io/api/pumpdrive/start-assessment \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{}'
```

### 4. Validation Scripts

Run automated validation:

```bash
# Validate build
npm run validate:build

# Validate APIs
npm run validate:apis

# Validate database
npm run validate:db:prod

# Validate all
npm run validate:all
```

## Troubleshooting

### Common Issues

#### 1. Supabase Connection Errors
```
Error: Missing Supabase configuration
```
**Solution:** Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in environment.

#### 2. OpenAI API Errors
```
Error: OpenAI API key not configured
```
**Solution:** Set `VITE_OPENAI_API_KEY` in environment variables.

#### 3. CORS Errors
```
Access to fetch blocked by CORS policy
```
**Solution:** Check that backend API allows your frontend origin in CORS settings.

#### 4. Authentication Failures
```
Auth Error: Invalid credentials
```
**Solution:**
- Verify user exists in Supabase Auth
- Check user is linked to `medical_staff` or `pump_users` table
- Ensure password is correct

#### 5. Health Check Fails
```
Health check returned 503
```
**Solution:**
- Check Supabase connection
- Verify environment variables are set
- Check API logs in Azure Portal

### View Logs

#### Azure Container Apps
```bash
az containerapp logs show \
  --name tshla-pump-api-container \
  --resource-group your-rg \
  --follow
```

#### Local Development
```bash
# API logs stored in:
server/logs/

# View latest:
tail -f server/logs/combined.log
```

## Rollback Procedure

If deployment fails:

### Option 1: Rollback via GitHub Actions
1. Go to Actions → Deployments
2. Find last successful deployment
3. Click "Re-run jobs"

### Option 2: Manual Rollback
```bash
# List previous revisions
az containerapp revision list \
  --name tshla-pump-api-container \
  --resource-group your-rg

# Activate previous revision
az containerapp revision activate \
  --name tshla-pump-api-container \
  --resource-group your-rg \
  --revision PREVIOUS_REVISION_NAME
```

## Production Checklist

Before deploying to production:

- [ ] All environment variables configured in GitHub Secrets
- [ ] Supabase database schema applied
- [ ] Admin user created in Supabase
- [ ] OpenAI API key configured with billing
- [ ] Deepgram API key configured
- [ ] HTTPS enabled on Azure Container Apps
- [ ] CORS properly configured
- [ ] HIPAA mode enabled
- [ ] Audit logging enabled
- [ ] Health checks passing locally
- [ ] All validation scripts pass
- [ ] Backup strategy in place

## Monitoring & Maintenance

### Health Monitoring
- Set up Azure Application Insights
- Configure alerts for:
  - API response time > 5 seconds
  - Error rate > 5%
  - CPU usage > 80%
  - Memory usage > 80%

### Database Backups
- Supabase automatic daily backups (enabled by default)
- Manual backup: Export from Supabase Dashboard

### Log Retention
- API logs rotate daily
- Keep logs for 30 days
- Archive audit logs for HIPAA compliance (7 years)

### Cost Monitoring
- Monitor OpenAI usage (should be ~$0.004/patient)
- Track Deepgram transcription minutes
- Review Azure Container Apps costs monthly

## Support & Resources

- **Deployment Scripts:** `scripts/deployment/`
- **Database Scripts:** `scripts/database/`
- **Validation Scripts:** `scripts/validation/`
- **Documentation:** `docs/`

For issues:
1. Check logs first
2. Run validation scripts
3. Review health check endpoints
4. Check environment variables

---

**Last Updated:** October 7, 2025
**Deployment Version:** Production-ready
