# Pre-Visit System - Testing Guide
## How to Test Everything Right Now

**Last Updated:** January 2025

---

## 🎯 Quick Test Options

You have 3 testing options:
1. **Local Testing (Fastest)** - Test patient service locally (5 minutes)
2. **Local with Webhooks** - Test with ngrok (30 minutes)
3. **Full Integration** - Test complete call flow (1-2 hours)

---

## ✅ Option 1: Test Patient Service Locally (5 minutes)

This tests the patient matching and database without needing any external services.

### Step 1: Deploy SQL Schema to Supabase

1. Go to https://supabase.com/dashboard
2. Select your project: **tshla-medical** (or create one)
3. Click **"SQL Editor"** in left sidebar
4. Click **"New Query"**
5. Open the file:
   ```bash
   cat /Users/rakeshpatel/Desktop/tshla-medical/server/sql/previsit-schema.sql
   ```
6. Copy the entire contents
7. Paste into Supabase SQL Editor
8. Click **"Run"** button
9. You should see: **"Success. No rows returned"**

### Step 2: Add Service Role Key

1. In Supabase Dashboard, go to **Settings → API**
2. Find **"service_role"** key (NOT the anon key)
3. Click the eye icon to reveal it
4. Copy the key

5. Create/update `.env` file:
   ```bash
   cd /Users/rakeshpatel/Desktop/tshla-medical

   # Add to .env:
   echo "SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here" >> .env
   ```

### Step 3: Run Patient Service Test

```bash
cd /Users/rakeshpatel/Desktop/tshla-medical

# Run the test
npx tsx server/test-patient-service.ts
```

**Expected Output:**
```
========================================
TESTING PATIENT SERVICE
========================================

TEST 1: Create new patient
----------------------------
🆕 No match found, creating new patient: John Test Smith
✅ Created new patient: P-2025-0001 - John Test Smith
✅ Created/Found patient UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Patient ID: P-2025-0001
Full Name: John Test Smith
Phone: 5551234567

TEST 2: Match by phone (different format)
----------------------------
✅ Found patient by phone: P-2025-0001 - John Test Smith
✅ Found patient UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Match successful: ✅ YES

TEST 3: Match by name + DOB
----------------------------
✅ Found patient by name+DOB: P-2025-0001 - John Test Smith
✅ Found patient UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Match successful: ✅ YES

TEST 4: Create different patient
----------------------------
🆕 No match found, creating new patient: Jane Test Doe
✅ Created new patient: P-2025-0002 - Jane Test Doe
✅ Created new patient UUID: yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy
Different from first patient: ✅ YES
Patient ID: P-2025-0002
Full Name: Jane Test Doe

TEST 5: Utility functions
----------------------------
Clean phone (555) 123-4567 → 5551234567
Parse first name "John Test Smith" → John
Parse last name "John Test Smith" → Test Smith
Similarity "John Smith" vs "John Smith" → 100%
Similarity "John Smith" vs "Jon Smith" → 91%
Similarity "John Smith" vs "Jane Doe" → 27%

TEST 6: Search patients by name
----------------------------
Found 2 patients with "Test" in name:
  - P-2025-0001: John Test Smith
  - P-2025-0002: Jane Test Doe

========================================
ALL TESTS COMPLETED SUCCESSFULLY ✅
========================================
```

### Step 4: Verify in Supabase

1. Go to Supabase Dashboard → Table Editor
2. Click **"patients"** table
3. You should see 2 test patients:
   - P-2025-0001: John Test Smith
   - P-2025-0002: Jane Test Doe

**✅ If this works, your database and patient service are working perfectly!**

---

## 🔗 Option 2: Test Locally with Webhooks (30 minutes)

This tests the API server and webhooks using ngrok to expose your local server.

### Prerequisites:
- SQL schema deployed (from Option 1)
- Service role key added (from Option 1)

### Step 1: Install Dependencies

```bash
cd /Users/rakeshpatel/Desktop/tshla-medical

# Install required packages
npm install twilio express cors node-cron dotenv

# Install dev dependencies for TypeScript
npm install --save-dev @types/express @types/cors @types/node-cron
```

### Step 2: Install ngrok

```bash
# Using Homebrew (Mac)
brew install ngrok

# Or download from: https://ngrok.com/download
# Sign up for free account at: https://dashboard.ngrok.com/signup
```

### Step 3: Configure ngrok

```bash
# Sign up at ngrok.com and get your auth token
# Then authenticate:
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

### Step 4: Start the API Server

```bash
# In Terminal 1:
cd /Users/rakeshpatel/Desktop/tshla-medical

# Temporarily disable scheduler for testing
export ENABLE_SCHEDULER=false

# Start the server
npm run previsit:api
```

**Expected Output:**
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
   - NODE_ENV: development
   - Supabase: ✅ Configured
   - Twilio: ❌ Not configured
   - 11Labs: ❌ Not configured
   - Klara: ❌ Not configured

   ⏸️  Scheduler disabled (ENABLE_SCHEDULER=false)

======================================================================
```

### Step 5: Expose with ngrok

```bash
# In Terminal 2:
ngrok http 3100
```

**Copy the HTTPS URL** (looks like: `https://a1b2c3d4.ngrok.io`)

### Step 6: Test Health Endpoint

```bash
# In Terminal 3:
curl https://your-ngrok-url.ngrok.io/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "service": "Pre-Visit API Server",
  "timestamp": "2025-01-15T10:00:00.000Z",
  "uptime": 12.345,
  "environment": "development"
}
```

### Step 7: Test Root Endpoint

```bash
curl https://your-ngrok-url.ngrok.io/
```

**Expected Response:**
```json
{
  "service": "TSHLA Medical - Pre-Visit API Server",
  "version": "1.0.0",
  "endpoints": {
    "health": "GET /health",
    "twilio_twiml": "POST /api/twilio/previsit-twiml",
    "twilio_status": "POST /api/twilio/call-status",
    "elevenlabs_complete": "POST /api/elevenlabs/conversation-complete"
  },
  "scheduler": {
    "status": "running",
    "schedule": "Every hour (business hours only)",
    "timezone": "America/New_York"
  }
}
```

**✅ If these work, your API server is running correctly!**

---

## 📞 Option 3: Test Complete Call Flow (1-2 hours)

This tests the entire system end-to-end with real phone calls.

### Prerequisites:
- SQL schema deployed
- API server running with ngrok
- Twilio account (can use trial)
- Your phone number for testing

### Step 1: Sign Up for Twilio Trial

1. Go to https://www.twilio.com/try-twilio
2. Sign up (free trial gives you $15 credit)
3. Verify your phone number
4. Note: Trial can only call verified numbers (perfect for testing!)

### Step 2: Get Twilio Credentials

1. Go to Console → Account → Account Info
2. Copy **Account SID** (starts with AC...)
3. Copy **Auth Token** (click eye icon)

### Step 3: Get a Twilio Phone Number

1. Go to Console → Phone Numbers → Manage → Buy a Number
2. Trial accounts get one free number
3. Select a local number with **Voice** capability
4. Click "Buy" (it's free on trial)
5. Copy the phone number (format: +15555551234)

### Step 4: Update .env File

```bash
cd /Users/rakeshpatel/Desktop/tshla-medical

# Add to .env (replace with your actual values):
cat >> .env << 'EOF'

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+15555551234
OFFICE_PHONE_NUMBER=+15555556789

# API Base URL (your ngrok URL)
API_BASE_URL=https://your-ngrok-url.ngrok.io
EOF
```

### Step 5: Restart API Server

```bash
# Stop the server (Ctrl+C in Terminal 1)
# Restart it:
npm run previsit:api
```

You should now see:
```
   - Twilio: ✅ Configured
```

### Step 6: Configure Twilio Webhooks

1. Go to Console → Phone Numbers → Manage → Active Numbers
2. Click your phone number
3. Scroll to **"Voice & Fax"** section
4. **"A Call Comes In":**
   - Webhook: `https://your-ngrok-url.ngrok.io/api/twilio/previsit-twiml`
   - HTTP POST
5. **"Call Status Changes":**
   - Webhook: `https://your-ngrok-url.ngrok.io/api/twilio/call-status`
   - HTTP POST
6. Click **"Save"**

### Step 7: Create a Test Patient

```bash
# In Supabase SQL Editor, run:
INSERT INTO patients (
  patient_id,
  first_name,
  last_name,
  date_of_birth,
  phone_primary,
  email
) VALUES (
  (SELECT get_next_patient_id()),
  'Your',
  'Name',
  '1985-01-15',
  'YOUR_PHONE_NUMBER',  -- Replace with your phone (digits only, no dashes)
  'your.email@example.com'
) RETURNING *;
```

Copy the returned patient `id` (UUID).

### Step 8: Make a Test Call

Create a test script:

```bash
cat > /Users/rakeshpatel/Desktop/tshla-medical/server/make-test-call.ts << 'EOF'
import twilioService from './services/twilioService';

async function makeTestCall() {
  console.log('🧪 Making test pre-visit call...\n');

  const result = await twilioService.initiatePreVisitCall({
    patientId: 'YOUR_PATIENT_UUID',  // Replace with UUID from Step 7
    patientName: 'Your Name',
    patientPhone: '+1YOUR_PHONE_NUMBER',  // Your actual phone with +1
    appointmentDate: '2025-01-20',
    appointmentTime: '14:00',
    providerName: 'Dr. Test',
    providerId: 'test-provider-id',
    attemptNumber: 1,
  });

  console.log('\n📊 Result:', result);

  if (result.success) {
    console.log('\n✅ Call initiated successfully!');
    console.log('   Call SID:', result.callSid);
    console.log('   You should receive a call shortly...');
  } else {
    console.log('\n❌ Call failed:', result.error);
  }
}

makeTestCall().catch(console.error);
EOF
```

Edit the file and replace:
- `YOUR_PATIENT_UUID` with the UUID from Step 7
- `YOUR_PHONE_NUMBER` with your actual phone number

Then run:

```bash
npx tsx server/make-test-call.ts
```

### Step 9: Answer the Call!

You should receive a call from your Twilio number!

**What you'll hear:**
Since 11Labs is not configured yet, you'll hear a fallback message:
> "Hello Your Name, this is TSHLA Medical calling about your upcoming appointment with Doctor Test. Our automated assistant is currently unavailable. Please call us back at [OFFICE_PHONE] if you need to provide any pre-visit information. Thank you!"

**What to check:**
1. Watch Terminal 1 (API server) for webhook logs:
   ```
   📞 TwiML Webhook Called
      Query params: { patientName: 'Your Name', ... }
   ```

2. Check Supabase → `previsit_call_log` table:
   - You should see a new row with your call attempt

**✅ If you received the call and see the logs, Twilio integration is working!**

---

## 🤖 Optional: Test with 11Labs (Advanced)

To test the full AI conversation, you need to:

### Step 1: Sign Up for 11Labs

1. Go to https://elevenlabs.io
2. Sign up for an account
3. Upgrade to a paid plan (required for Conversational AI)
4. Note: You may need to contact sales for Conversational AI access

### Step 2: Create AI Agent

1. Go to Dashboard → Conversational AI → Create Agent
2. Name: "TSHLA Pre-Visit Assistant"
3. Copy the conversation script from `docs/PREVISIT_READINESS_SYSTEM.md` (lines 100-243)
4. Paste into agent configuration
5. Choose a voice (e.g., "Sarah")
6. Save and copy the **Agent ID**

### Step 3: Get API Key

1. Go to Settings → API Keys
2. Create or copy existing key

### Step 4: Update .env

```bash
# Add to .env:
ELEVENLABS_API_KEY=your_api_key_here
ELEVENLABS_AGENT_ID=agent_xxxxxxxxxxxxx
```

### Step 5: Restart and Test

```bash
# Restart API server
npm run previsit:api

# Make another test call
npx tsx server/make-test-call.ts
```

Now when you answer, you'll hear the full AI conversation!

---

## 🧪 Testing Checklist

Use this to track what you've tested:

### Basic Testing:
- [ ] SQL schema deployed to Supabase
- [ ] Service role key added to .env
- [ ] Patient service test runs successfully
- [ ] Can see test patients in Supabase table

### API Server Testing:
- [ ] Dependencies installed (twilio, express, cors, node-cron)
- [ ] API server starts without errors
- [ ] Health endpoint responds
- [ ] ngrok exposes server publicly

### Twilio Testing:
- [ ] Twilio account created (trial is fine)
- [ ] Phone number purchased/assigned
- [ ] Credentials added to .env
- [ ] Webhooks configured in Twilio console
- [ ] Test call received on your phone
- [ ] Call logs appear in Supabase

### 11Labs Testing (Optional):
- [ ] 11Labs account created
- [ ] AI agent configured
- [ ] API key added to .env
- [ ] AI conversation works on test call

---

## 🐛 Troubleshooting

### "Twilio SDK not installed"
```bash
npm install twilio
```

### "Module not found: express"
```bash
npm install express cors dotenv
npm install --save-dev @types/express @types/cors
```

### "No rows returned" when testing patient service
- Make sure SQL schema is deployed
- Check that SUPABASE_SERVICE_ROLE_KEY is correct
- Verify VITE_SUPABASE_URL is set

### "Call not received"
- Check Twilio console for errors
- Verify phone number format (+1 for US)
- Check that webhooks are saved in Twilio
- Make sure ngrok is still running
- Trial accounts can only call verified numbers

### "Webhook not triggered"
- Check ngrok URL is correct in Twilio
- Make sure API server is running
- Check ngrok hasn't expired (free tier has time limits)
- Look for errors in API server logs

---

## 🎯 Recommended Testing Path

**For today (30 minutes):**
1. ✅ Deploy SQL schema
2. ✅ Test patient service locally
3. ✅ Verify in Supabase

**Tomorrow (1 hour):**
1. ✅ Install dependencies
2. ✅ Start API server with ngrok
3. ✅ Sign up for Twilio trial
4. ✅ Make test call to yourself

**Next week (when ready for production):**
1. ✅ Sign up for 11Labs
2. ✅ Create AI agent
3. ✅ Test full conversation
4. ✅ Deploy to production

---

## 📊 What Gets Created During Testing

After testing, you'll have in Supabase:

**patients table:**
- P-2025-0001: John Test Smith
- P-2025-0002: Jane Test Doe
- P-2025-0003: Your Name (from test call)

**previsit_call_log table:**
- 1 row for your test call attempt

**previsit_responses table:**
- Empty for now (will populate after full AI conversation)

You can always clean up test data:
```sql
-- Delete test patients
DELETE FROM patients WHERE patient_id LIKE 'P-2025-000%';

-- Delete test call logs
DELETE FROM previsit_call_log WHERE patient_id NOT IN (SELECT id FROM patients);
```

---

## ✅ Success Criteria

You'll know it's working when:

1. **Patient Service Test:** All 6 tests pass ✅
2. **API Server:** Health endpoint returns 200 ✅
3. **Twilio:** You receive a call from Twilio number ✅
4. **Webhooks:** Logs appear in API server terminal ✅
5. **Database:** Call logged in previsit_call_log table ✅

---

## 🚀 Ready to Start?

**Fastest path to see it working (5 minutes):**
```bash
cd /Users/rakeshpatel/Desktop/tshla-medical

# 1. Deploy SQL (copy/paste in Supabase SQL Editor)
# 2. Add SUPABASE_SERVICE_ROLE_KEY to .env
# 3. Run:
npx tsx server/test-patient-service.ts
```

**That's it! You'll see the patient matching system in action!**

---

**Questions?** Check:
- Deployment Guide: `docs/PREVISIT_DEPLOYMENT_GUIDE.md`
- Main Documentation: `docs/PREVISIT_READINESS_SYSTEM.md`
- Troubleshooting: Line 2185+ in main doc

**Happy Testing!** 🎉
