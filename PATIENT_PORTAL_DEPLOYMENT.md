# 🚀 Patient Portal Deployment Guide

**System:** Unified Patient Portal with Comprehensive H&P
**Version:** 1.0.0
**Date:** January 23, 2026

---

## ✅ Pre-Deployment Checklist

### 1. Database Migrations

- [ ] Run migration: `add-comprehensive-hp.sql`
- [ ] Run migration: `add-patient-portal-analytics.sql`
- [ ] Verify all tables created successfully
- [ ] Check indexes are in place

**Verification Query:**
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'patient_comprehensive_chart',
    'patient_chart_history',
    'visit_dictations_archive',
    'staff_review_queue',
    'patient_ai_conversations',
    'patient_ai_analytics',
    'patient_urgent_alerts',
    'patient_portal_sessions',
    'patient_portal_section_views',
    'portal_usage_analytics',
    'ai_common_questions'
  )
ORDER BY table_name;
```

Expected: 11 tables

---

### 2. Environment Variables

**Backend (.env or Azure App Settings):**
```bash
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Azure OpenAI (HIPAA-compliant)
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_KEY=your-azure-openai-key
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
AZURE_OPENAI_API_VERSION=2024-08-01-preview

# ElevenLabs (Text-to-Speech)
ELEVENLABS_API_KEY=your-elevenlabs-key
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM  # Rachel voice

# API Configuration
PORT=3000
NODE_ENV=production

# JWT Secret
JWT_SECRET=your-secure-jwt-secret-min-32-chars
```

**Frontend (.env.production):**
```bash
VITE_API_BASE_URL=https://your-api-domain.com
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# OpenAI (for frontend AI features if needed)
VITE_OPENAI_API_KEY=your-openai-key
VITE_OPENAI_MODEL_STAGE4=gpt-4o-mini
VITE_OPENAI_MODEL_STAGE5=gpt-4o
VITE_OPENAI_MODEL_STAGE6=gpt-4o
VITE_PRIMARY_AI_PROVIDER=openai

# Deepgram (if using speech recognition)
VITE_DEEPGRAM_API_KEY=your-deepgram-key
VITE_DEEPGRAM_MODEL=nova-3-medical
VITE_DEEPGRAM_LANGUAGE=en-US
```

---

### 3. Supabase Storage Buckets

Create the following storage buckets:

- [ ] **patient-audio** (for AI chat audio responses)
  - Public access: ✅ Yes
  - File size limit: 10 MB
  - Allowed file types: `audio/mpeg`, `audio/mp3`

- [ ] **patient-documents** (for uploaded lab reports, imaging)
  - Public access: ❌ No
  - File size limit: 25 MB
  - Allowed file types: `application/pdf`, `image/png`, `image/jpeg`

**Create buckets via Supabase Dashboard:**
```
Storage → Create bucket → Configure settings
```

---

### 4. Row Level Security (RLS) Policies

Verify RLS is enabled on all patient tables:

```sql
-- Check RLS status
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'patient_%';
```

**Expected:** All should have `rowsecurity = true`

**If not enabled, run:**
```sql
ALTER TABLE patient_comprehensive_chart ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_chart_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_portal_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_review_queue ENABLE ROW LEVEL SECURITY;
```

---

### 5. Backend API Routes

Verify all API routes are mounted in `unified-api.js`:

- [ ] `/api/hp/*` - Comprehensive H&P API
- [ ] `/api/ai-chat/*` - AI Chat Educator API
- [ ] `/api/portal-auth/*` - Patient portal authentication

**Test endpoints:**
```bash
# Health check
curl https://your-api-domain.com/health

# H&P generation
curl -X POST https://your-api-domain.com/api/hp/generate \
  -H "Content-Type: application/json" \
  -d '{"patientPhone":"+18325551234","tshlaId":"TSH123-456"}'

# AI chat
curl -X POST https://your-api-domain.com/api/ai-chat/message \
  -H "Content-Type: application/json" \
  -d '{"tshlaId":"TSH123-456","message":"What is my A1C?","sessionId":"test-123"}'
```

---

### 6. Frontend Build

- [ ] Run `npm run build`
- [ ] Verify no compilation errors
- [ ] Check build output size (<5 MB total)
- [ ] Test lazy loading works

**Build command:**
```bash
cd /path/to/tshla-medical
npm run build
```

**Expected output:**
```
✓ built in ~5-7s
dist/index.html
dist/assets/*.js
dist/assets/*.css
```

---

### 7. Deploy to Production

**Frontend (Azure Static Web Apps or Azure App Service):**
```bash
# Option 1: Via GitHub Actions (recommended)
git push origin main
# GitHub workflow automatically builds and deploys

# Option 2: Manual deployment
npm run build
az staticwebapp deploy \
  --name tshla-patient-portal \
  --resource-group tshla-prod \
  --source ./dist
```

**Backend (Azure Container Apps):**
```bash
# Build and push Docker image
docker build -t tshla-unified-api:latest .
docker tag tshla-unified-api:latest tshlaregistry.azurecr.io/unified-api:latest
docker push tshlaregistry.azurecr.io/unified-api:latest

# Update container app
az containerapp update \
  --name tshla-unified-api \
  --resource-group tshla-prod \
  --image tshlaregistry.azurecr.io/unified-api:latest
```

---

### 8. Post-Deployment Testing

#### Test Patient Portal Login
1. Navigate to `https://your-domain.com/patient-portal/login`
2. Enter test TSH ID: `TSH123-001`
3. Verify login succeeds
4. Check session is created in `patient_portal_sessions`

#### Test Patient Dashboard
1. Verify all 3 boxes load:
   - ✅ Payment section
   - ✅ Audio summaries section
   - ✅ AI Chat educator section
2. Click each box to navigate to detail pages

#### Test H&P View
1. Navigate to `/patient-portal/hp`
2. Verify labs display in table format
3. Check vitals trend graphs render
4. Verify patient-editable sections are editable

#### Test AI Chat
1. Navigate to `/patient-portal/ai-chat`
2. Send test message: "What should my A1C be?"
3. Verify AI responds appropriately
4. Check audio toggle works (if ElevenLabs configured)
5. Verify rate limiting (20 questions/day)

#### Test Staff Review Queue
1. Login as staff user
2. Navigate to `/staff-review-queue`
3. Verify pending edits appear
4. Test approve/reject actions
5. Check changes apply to patient H&P

---

### 9. Monitoring Setup

#### Azure Application Insights

**Add to backend:**
```javascript
const appInsights = require('applicationinsights');
appInsights.setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
  .setAutoDependencyCorrelation(true)
  .setAutoCollectRequests(true)
  .setAutoCollectPerformance(true)
  .setAutoCollectExceptions(true)
  .setAutoCollectDependencies(true)
  .setAutoCollectConsole(true)
  .start();
```

**Monitor:**
- Request rates
- Response times
- Error rates
- AI chat usage
- H&P generation frequency

#### Supabase Monitoring

Monitor in Supabase Dashboard:
- Database CPU usage
- Connection pool usage
- Query performance
- Storage usage

**Set alerts for:**
- Database CPU > 80%
- API response time > 2s
- Error rate > 5%

---

### 10. Security Verification

- [ ] **HIPAA Compliance:**
  - ✅ All PHI encrypted at rest (Supabase)
  - ✅ All API calls over HTTPS
  - ✅ Azure OpenAI (HIPAA-compliant) used instead of public OpenAI
  - ✅ Audit logging enabled
  - ✅ Session timeouts configured (2 hours)

- [ ] **Authentication:**
  - ✅ TSH ID-based login with rate limiting
  - ✅ Phone verification (optional but recommended)
  - ✅ Session management with expiry
  - ✅ Staff-only routes protected

- [ ] **Data Access:**
  - ✅ RLS policies prevent cross-patient data access
  - ✅ Staff can only access assigned patients
  - ✅ Audit trail for all data changes

---

### 11. Seed Test Data (Optional)

**For testing/demo purposes:**

```bash
cd /path/to/tshla-medical

# Set environment variables
export VITE_SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Run seeding script
node scripts/seed-patient-portal-data.js
```

**Creates 3 test patients:**
- TSH123-001 (John Diabetes) - Active diabetes with good control
- TSH123-002 (Maria Garcia) - Pre-diabetes, weight loss in progress
- TSH123-003 (Robert Chen) - Complex diabetes with complications

---

### 12. Documentation

- [ ] Update user documentation
- [ ] Create staff training materials
- [ ] Document API endpoints
- [ ] Create troubleshooting guide

**Documentation locations:**
- [PATIENT_PORTAL_IMPLEMENTATION_COMPLETE.md](PATIENT_PORTAL_IMPLEMENTATION_COMPLETE.md)
- [STAFF_REVIEW_QUEUE_COMPLETE.md](STAFF_REVIEW_QUEUE_COMPLETE.md)
- [database/migrations/PATIENT_PORTAL_SETUP.md](database/migrations/PATIENT_PORTAL_SETUP.md)

---

## 📊 Production Metrics to Track

### Patient Portal Usage
- Daily active patients
- Average session duration
- Most viewed sections
- Login success rate

### AI Chat Educator
- Questions per day
- Average response time
- Top topics
- Satisfaction rate (thumbs up/down)
- Cost per conversation
- Urgent alerts triggered

### Staff Review Queue
- Pending edits count
- Average review time
- Approval vs rejection rate
- Most common edit types

### H&P System
- Auto-generation success rate
- Average H&P completeness
- Lab data coverage
- Document upload volume

---

## 🚨 Troubleshooting

### Patient can't login
**Symptom:** "Patient not found" error

**Solutions:**
1. Verify TSH ID format (TSH123-XXX)
2. Check `unified_patients` table has correct TSH ID
3. Verify RLS policies not blocking access
4. Check session creation in `patient_portal_sessions`

---

### AI chat not responding
**Symptom:** "Failed to send message" error

**Solutions:**
1. Check Azure OpenAI credentials
2. Verify API base URL is correct
3. Check rate limiting (20 questions/day)
4. Verify patient has H&P data for context
5. Check Application Insights for errors

---

### H&P not generating
**Symptom:** Auto-generation fails after dictation

**Solutions:**
1. Check dictation status is 'completed' or 'signed'
2. Verify patient_id is set on dictation
3. Check API endpoint `/api/hp/generate` is reachable
4. Verify Azure OpenAI key is valid
5. Check logs in `patient_chart_history`

---

### Staff review queue empty
**Symptom:** No pending edits showing

**Solutions:**
1. Verify patient edits are creating queue items
2. Check RLS policies on `staff_review_queue`
3. Verify staff authentication
4. Check filter tabs (pending vs all)

---

## 📞 Support Contacts

**For deployment issues:**
- DevOps Team: devops@tshla.ai
- Technical Lead: Rakesh Patel

**For clinical workflow questions:**
- Clinical Operations: clinical-ops@tshla.ai

**For HIPAA compliance:**
- Compliance Officer: compliance@tshla.ai

---

## ✅ Deployment Sign-Off

- [ ] Database migrations completed
- [ ] Environment variables configured
- [ ] Storage buckets created
- [ ] RLS policies verified
- [ ] Backend API deployed
- [ ] Frontend deployed
- [ ] Post-deployment tests passed
- [ ] Monitoring configured
- [ ] Security verified
- [ ] Documentation updated

**Deployed by:** ___________________
**Date:** ___________________
**Verified by:** ___________________
**Date:** ___________________

---

**🎉 Patient Portal is ready for production!**
