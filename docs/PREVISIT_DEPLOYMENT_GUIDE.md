# Pre-Visit Readiness System - Deployment Guide

**Last Updated:** January 2025

---

## 📋 Overview

This guide will help you deploy the Pre-Visit Readiness System from development to production.

**What you're deploying:**
- SQL database schema to Supabase
- 4 backend services (Patient, Twilio, AI Extraction, Klara)
- 3 API webhooks (Twilio TwiML, Call Status, 11Labs)
- 1 cron job scheduler
- Express API server

---

## ✅ Prerequisites Checklist

Before starting deployment:

- [ ] **Supabase Project** - Active project with database access
- [ ] **Twilio Account** - Sign up, purchase phone number, sign HIPAA BAA
- [ ] **11Labs Account** - Sign up for Conversational AI, sign HIPAA BAA
- [ ] **Klara Account** - API access enabled (or use Twilio SMS fallback)
- [ ] **Server/Host** - For running API server (Azure, AWS, or local)
- [ ] **Domain Name** - For webhook URLs (or use ngrok for testing)

---

## 🚀 Deployment Steps

### Step 1: Deploy SQL Schema (10 minutes)

#### 1.1 Open Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **"SQL Editor"** in left sidebar

#### 1.2 Run Schema
1. Click **"New Query"**
2. Copy entire contents of `server/sql/previsit-schema.sql`
3. Paste into query editor
4. Click **"Run"** button
5. Should see: "Success. No rows returned"

#### 1.3 Verify Deployment
Run these verification queries:

```sql
-- Check tables created
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('patients', 'previsit_responses', 'previsit_call_log', 'previsit_notification_log');
-- Should return 4 rows

-- Test patient ID generation
SELECT get_next_patient_id();
-- Should return: P-2025-0001

-- Check indexes
SELECT indexname FROM pg_indexes
WHERE tablename = 'patients';
-- Should return 7 indexes

-- Check RLS enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE tablename = 'patients';
-- rowsecurity should be 't' (true)
```

---

### Step 2: Set Up Twilio (15 minutes)

#### 2.1 Create Twilio Account
1. Go to https://www.twilio.com/try-twilio
2. Sign up and verify your account
3. Upgrade from trial to paid account (required for production)

#### 2.2 Purchase Phone Number
1. Go to Console → Phone Numbers → Buy a Number
2. Select a local number with **Voice** capability
3. Cost: ~$1/month
4. Note the phone number (format: +15555551234)

#### 2.3 Sign HIPAA BAA
1. Contact Twilio sales or support
2. Request HIPAA Business Associate Agreement
3. Sign and return
4. Confirm HIPAA-eligible services activated

#### 2.4 Get Credentials
1. Go to Console → Account → Account Info
2. Copy **Account SID** (starts with AC...)
3. Copy **Auth Token** (click eye icon to reveal)

#### 2.5 Configure Webhooks (After deploying API server)
1. Go to Console → Phone Numbers → Manage → Active Numbers
2. Click your purchased number
3. Scroll to **Voice & Fax** section
4. Set **"A Call Comes In"** to:
   - Webhook: `https://your-domain.com/api/twilio/previsit-twiml`
   - HTTP POST
5. Set **"Call Status Changes"** to:
   - Webhook: `https://your-domain.com/api/twilio/call-status`
   - HTTP POST
6. Save

---

### Step 3: Set Up 11Labs (20 minutes)

#### 3.1 Create 11Labs Account
1. Go to https://elevenlabs.io
2. Sign up for account
3. Upgrade to paid plan (Conversational AI requires paid tier)

#### 3.2 Sign HIPAA BAA
1. Contact 11Labs support
2. Request HIPAA Business Associate Agreement
3. Confirm Conversational AI product is HIPAA-compliant
4. Sign and return

#### 3.3 Create AI Agent
1. Go to Dashboard → Conversational AI → Create Agent
2. Name: **"TSHLA Pre-Visit Assistant"**
3. **System Prompt** (copy from `PREVISIT_READINESS_SYSTEM.md` lines 100-106):
   ```
   You are a professional medical assistant AI calling on behalf of TSHLA Medical.
   Your goal is to efficiently gather pre-visit information in a warm, friendly manner.
   Keep responses concise. If patient wants to skip a section, respect that.
   If you detect urgent medical concerns (chest pain, breathing problems, suicidal thoughts),
   immediately say: "That sounds urgent. Please hang up and call 911 or go to the emergency room."
   Always speak clearly and allow patient time to respond.
   ```

4. **Conversation Script** (copy from lines 112-243 in main doc)
5. **Voice Selection:**
   - Choose professional, warm female voice
   - Recommended: "Sarah" or "Rachel"
   - Test with sample conversation

6. **Settings:**
   - Max conversation duration: 10 minutes
   - Enable transcript logging: Yes
   - Enable audio recording: Yes
   - Response latency: Low (for faster responses)

7. Copy **Agent ID** (format: agent_xxxxxxxxxxxxx)

#### 3.4 Get API Key
1. Go to Dashboard → Settings → API Keys
2. Create new API key or copy existing
3. Copy key (starts with your account ID)

#### 3.5 Configure Webhook
1. In Agent settings, find "Webhook URL" field
2. Set to: `https://your-domain.com/api/elevenlabs/conversation-complete`
3. Set trigger: "On conversation complete"
4. Save

---

### Step 4: Set Up Klara (Optional - 10 minutes)

#### 4.1 Check Existing Access
- If you already use Klara, check if API access is enabled
- Contact Klara support to request API credentials

#### 4.2 Get API Credentials
1. Login to Klara dashboard
2. Go to Settings → API Settings
3. Copy **API Key**
4. Copy **Organization ID**

#### 4.3 Alternative: Use Twilio SMS
- If Klara not available, the system automatically falls back to Twilio SMS
- No additional setup needed (uses same Twilio credentials)

---

### Step 5: Configure Environment Variables (5 minutes)

Create or update `.env` file:

```env
# =====================================================
# SUPABASE
# =====================================================
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
# Get from: Supabase Dashboard → Settings → API

# =====================================================
# TWILIO
# =====================================================
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+15555551234
OFFICE_PHONE_NUMBER=+15555556789
# Get from: Twilio Console → Account Info

# =====================================================
# 11LABS
# =====================================================
ELEVENLABS_API_KEY=your_api_key_here
ELEVENLABS_AGENT_ID=agent_xxxxxxxxxxxxx
# Get from: 11Labs Dashboard → Settings → API Keys

# =====================================================
# KLARA (Optional - uses Twilio SMS fallback if not set)
# =====================================================
KLARA_API_KEY=your_klara_api_key
KLARA_ORG_ID=your_organization_id

# =====================================================
# OPENAI (Already configured for AI extraction)
# =====================================================
VITE_OPENAI_API_KEY=your_existing_key
VITE_OPENAI_MODEL_STAGE6=gpt-4o

# =====================================================
# API SERVER
# =====================================================
PREVISIT_API_PORT=3100
API_BASE_URL=https://your-domain.com
# For local testing with ngrok: https://xxxxx.ngrok.io

# =====================================================
# OPTIONAL
# =====================================================
NODE_ENV=production
ENABLE_SCHEDULER=true
# Set to 'false' to disable cron scheduler
```

**⚠️ Security Note:**
- NEVER commit `.env` to git
- Add `.env` and `.env.local` to `.gitignore`
- Use Azure Key Vault or AWS Secrets Manager in production

---

### Step 6: Install Dependencies (3 minutes)

```bash
cd /Users/rakeshpatel/Desktop/tshla-medical

# Install new dependencies
npm install twilio express cors node-cron

# Install TypeScript types
npm install --save-dev @types/express @types/cors @types/node-cron

# Verify installation
npm list twilio express cors node-cron
```

---

### Step 7: Test Locally (15 minutes)

#### 7.1 Test Patient Service
```bash
npx tsx server/test-patient-service.ts
```

Expected output:
```
========================================
TESTING PATIENT SERVICE
========================================

TEST 1: Create new patient
----------------------------
✅ Created/Found patient UUID: xxxxxxxx
Patient ID: P-2025-0001
...
ALL TESTS COMPLETED SUCCESSFULLY ✅
```

#### 7.2 Start API Server Locally
```bash
npx tsx server/previsit-api-server.ts
```

Expected output:
```
======================================================================
🚀 PRE-VISIT API SERVER STARTED
======================================================================

   Server: http://localhost:3100
   Health Check: http://localhost:3100/health

   Endpoints:
   - POST /api/twilio/previsit-twiml
   - POST /api/twilio/call-status
   - POST /api/elevenlabs/conversation-complete

   Environment:
   - Supabase: ✅ Configured
   - Twilio: ✅ Configured
   - 11Labs: ✅ Configured
   - Klara: ✅ Configured

   Starting cron scheduler...
✅ Scheduler started

======================================================================
```

#### 7.3 Test Health Endpoint
```bash
curl http://localhost:3100/health
```

Should return:
```json
{
  "status": "healthy",
  "service": "Pre-Visit API Server",
  "timestamp": "2025-01-15T10:00:00.000Z",
  "uptime": 5.123
}
```

#### 7.4 Expose Local Server with ngrok (For Testing Webhooks)
```bash
# Install ngrok: https://ngrok.com/download
# Or: brew install ngrok

# Start ngrok
ngrok http 3100
```

Copy the HTTPS URL (e.g., `https://a1b2c3.ngrok.io`)

Update your `.env`:
```env
API_BASE_URL=https://a1b2c3.ngrok.io
```

Update Twilio webhook URLs to use ngrok URL.

---

### Step 8: Make Test Call (10 minutes)

#### 8.1 Create Test Script
```bash
# Create test-previsit-call.ts
npx tsx server/test-previsit-call.ts
```

Test script content:
```typescript
import twilioService from './services/twilioService';

async function testCall() {
  const result = await twilioService.initiatePreVisitCall({
    patientId: 'test-patient-uuid',
    patientName: 'Test Patient',
    patientPhone: 'YOUR_PHONE_NUMBER', // Use your real phone
    appointmentDate: '2025-01-20',
    appointmentTime: '14:00',
    providerName: 'Dr. Smith',
    providerId: 'test-provider-id',
    attemptNumber: 1,
  });

  console.log('Call result:', result);
}

testCall();
```

#### 8.2 Run Test
```bash
npx tsx server/test-previsit-call.ts
```

You should receive a call from your Twilio number!

#### 8.3 Verify
- [ ] Call received on your phone
- [ ] TwiML webhook logs show in terminal
- [ ] Call status webhook triggered
- [ ] Call logged in `previsit_call_log` table

---

### Step 9: Deploy to Production (30 minutes)

#### Option A: Azure Container Apps (Recommended)

1. **Build Docker image:**
```bash
# Create Dockerfile
cat > Dockerfile.previsit << 'EOF'
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY server/ ./server/
COPY tsconfig.json ./
CMD ["npx", "tsx", "server/previsit-api-server.ts"]
EXPOSE 3100
EOF

# Build
docker build -f Dockerfile.previsit -t tshla-previsit-api .
```

2. **Push to Azure Container Registry:**
```bash
az acr login --name your-registry
docker tag tshla-previsit-api your-registry.azurecr.io/tshla-previsit-api:latest
docker push your-registry.azurecr.io/tshla-previsit-api:latest
```

3. **Deploy to Container App:**
```bash
az containerapp create \
  --name tshla-previsit-api \
  --resource-group tshla-medical \
  --image your-registry.azurecr.io/tshla-previsit-api:latest \
  --target-port 3100 \
  --ingress external \
  --env-vars \
    VITE_SUPABASE_URL="$VITE_SUPABASE_URL" \
    SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
    TWILIO_ACCOUNT_SID="$TWILIO_ACCOUNT_SID" \
    TWILIO_AUTH_TOKEN="$TWILIO_AUTH_TOKEN" \
    ELEVENLABS_API_KEY="$ELEVENLABS_API_KEY"
    # ... add all env vars
```

#### Option B: PM2 on VPS

```bash
# Install PM2 globally
npm install -g pm2

# Start server with PM2
pm2 start server/previsit-api-server.ts --name previsit-api --interpreter tsx

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
pm2 startup

# Monitor
pm2 logs previsit-api
pm2 monit
```

---

### Step 10: Update Webhook URLs (5 minutes)

Once deployed to production, update webhooks:

#### Twilio:
1. Go to Console → Phone Numbers → Your Number
2. Update webhooks to production URLs:
   - TwiML: `https://your-domain.com/api/twilio/previsit-twiml`
   - Status: `https://your-domain.com/api/twilio/call-status`

#### 11Labs:
1. Go to Agent Settings
2. Update webhook: `https://your-domain.com/api/elevenlabs/conversation-complete`

---

### Step 11: Verify Production Deployment (10 minutes)

#### 11.1 Health Check
```bash
curl https://your-domain.com/health
```

#### 11.2 Check Scheduler Running
```bash
# View PM2 logs
pm2 logs previsit-api --lines 50

# Should see scheduler logs every hour
```

#### 11.3 Database Check
```sql
-- Check for recent activity
SELECT COUNT(*) FROM previsit_call_log WHERE created_at > NOW() - INTERVAL '24 hours';
SELECT COUNT(*) FROM previsit_notification_log WHERE sent_at > NOW() - INTERVAL '24 hours';
```

---

## 📊 Monitoring & Maintenance

### Daily Checks
- [ ] Check PM2 process status: `pm2 status`
- [ ] Review scheduler logs: `pm2 logs previsit-api | grep -i error`
- [ ] Check call completion rates in database
- [ ] Review urgent flags: `SELECT * FROM previsit_responses WHERE requires_urgent_callback = true`

### Weekly Checks
- [ ] Review cost (Twilio + 11Labs)
- [ ] Check for failed calls/retries
- [ ] Provider feedback on data quality
- [ ] Update AI prompts if needed

### Monthly Tasks
- [ ] Analyze ROI metrics
- [ ] Review and update conversation script
- [ ] Check BAA compliance
- [ ] Audit PHI access logs

---

## 🐛 Troubleshooting

### Issue: Webhooks Not Receiving Requests

**Check:**
1. Is server running? `pm2 status` or `curl http://localhost:3100/health`
2. Are webhook URLs correct in Twilio/11Labs?
3. Is firewall blocking incoming requests?
4. Is HTTPS certificate valid?

**Fix:**
- Test with ngrok first
- Check nginx/reverse proxy configuration
- Verify webhook URLs in Twilio console
- Check server logs: `pm2 logs previsit-api`

---

### Issue: Calls Not Being Made

**Check:**
1. Is scheduler running? Check logs
2. Are there appointments in database for tomorrow?
3. Check business hours (8 AM - 7 PM, no Sundays)
4. Are patients opted out?

**Fix:**
```bash
# Manually trigger scheduler
npx tsx server/jobs/schedulePreVisitCalls.ts

# Check appointments needing calls
# Run in Supabase SQL Editor:
SELECT * FROM get_appointments_needing_previsit_calls(CURRENT_DATE + 1);
```

---

### Issue: AI Extraction Failing

**Check:**
1. Is OpenAI API key valid?
2. Are you hitting rate limits?
3. Check transcript quality

**Fix:**
- Verify `VITE_OPENAI_API_KEY` in .env
- Check OpenAI usage dashboard
- Review failed transcripts in database
- Adjust AI prompt if needed

---

## ✅ Post-Deployment Checklist

- [ ] SQL schema deployed to Supabase
- [ ] All environment variables set
- [ ] Twilio account configured + BAA signed
- [ ] 11Labs agent created + BAA signed
- [ ] API server deployed and running
- [ ] Webhooks tested and working
- [ ] Cron scheduler running
- [ ] Test call completed successfully
- [ ] Monitoring set up
- [ ] Team trained on system
- [ ] Documentation reviewed

---

## 📞 Support & Resources

**Documentation:**
- Main doc: `docs/PREVISIT_READINESS_SYSTEM.md`
- Implementation status: `docs/PREVISIT_IMPLEMENTATION_STATUS.md`
- Session summary: `docs/PREVISIT_SESSION_SUMMARY.md`

**Twilio Support:** https://www.twilio.com/help/contact
**11Labs Support:** support@elevenlabs.io
**Supabase Support:** https://supabase.com/support

---

**Deployment Status:** Ready for Production
**Estimated Deployment Time:** 2-3 hours
**Required Access:** Supabase, Twilio, 11Labs, Azure/AWS

---

**Last Updated:** January 2025
**Next Review:** After first week of production use
