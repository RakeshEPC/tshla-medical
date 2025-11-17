# Quick Start Guide - Unified Patient System

## 🚀 Get Started in 5 Minutes

### Step 1: Deploy Database (2 minutes)

1. Open https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor**
4. Click **New Query**
5. Copy/paste entire file: `database/migrations/unified-patients-consolidation.sql`
6. Click **Run** (or press Cmd+Enter)
7. Wait for "Success. No rows returned"

**Verify:**
```sql
SELECT table_name FROM information_schema.tables
WHERE table_name = 'unified_patients';
-- Should return: unified_patients
```

### Step 2: Install Dependencies (1 minute)

```bash
cd /Users/rakeshpatel/Desktop/tshla-medical
npm install bcrypt
```

### Step 3: Restart Server (1 minute)

```bash
# Kill existing server
pkill -f "node server/unified-api"

# Start fresh
npm run dev:unified-api

# OR with PM2:
pm2 restart unified-api
```

### Step 4: Test It (1 minute)

Open a new terminal and run:

```bash
# Test patient creation via dictation
curl -X POST http://localhost:3000/api/dictated-notes \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": "test-001",
    "provider_name": "Dr. Test",
    "patient_name": "John Test",
    "patient_phone": "555-111-2222",
    "visit_date": "2025-01-16",
    "raw_transcript": "Test dictation",
    "processed_note": "Test note",
    "status": "draft"
  }'
```

**Look for in console logs:**
```
🆕 Creating new patient from dictation
✅ Created new patient: PT-2025-0001
📱 New PIN: 123456 (example)
✅ Linked dictation to patient
```

### Step 5: View Patient Chart

```bash
curl http://localhost:3000/api/patient-chart/5551112222
```

**You should see:**
```json
{
  "success": true,
  "chart": {
    "patient": {
      "patient_id": "PT-2025-0001",
      "full_name": "John Test",
      "phone_display": "(555) 111-2222",
      ...
    },
    "dictations": [{ ... }],
    "stats": { "totalVisits": 1 }
  }
}
```

---

## ✅ That's It!

Your system is now:

✅ **Auto-creating patients** from dictations
✅ **Auto-creating patients** from pre-visit calls
✅ **Auto-creating patients** from schedule uploads
✅ **Auto-creating patients** from PDF uploads
✅ **Preventing duplicates** via phone matching
✅ **Merging data** intelligently from all sources
✅ **Ready for patient portal** login (phone + PIN)

---

## 📊 View All Patients in Database

```sql
-- In Supabase SQL Editor:
SELECT
  patient_id,
  full_name,
  phone_display,
  created_from,
  data_sources,
  data_completeness_score,
  created_at
FROM unified_patients
ORDER BY created_at DESC;
```

---

## 🧪 Test All 4 Data Sources

### 1. Test Dictation (Already done above) ✅

### 2. Test Schedule Upload

```bash
# Create appointment via API
curl -X POST http://localhost:3000/api/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": "doc-001",
    "provider_name": "Dr. Smith",
    "patient_name": "Jane Doe",
    "patient_phone": "555-333-4444",
    "scheduled_date": "2025-01-20",
    "start_time": "10:00 AM",
    "end_time": "10:30 AM"
  }'
```

**Check logs for:**
```
✅ Linked appointment to patient PT-2025-0002
```

### 3. Test Pre-Visit Call (Simulated)

Pre-visit requires actual Twilio/ElevenLabs call, but you can simulate by calling the webhook directly:

```bash
curl -X POST http://localhost:3000/api/elevenlabs/conversation-complete \
  -H "Content-Type: application/json" \
  -d '{
    "conversation_id": "test-123",
    "transcript": "I am taking metformin 500mg twice daily",
    "duration_seconds": 120,
    "status": "completed",
    "metadata": {
      "patient_id": "test-patient",
      "patient_name": "Bob Wilson",
      "patient_phone": "555-555-6666"
    }
  }'
```

### 4. Test PDF Upload

```bash
# Upload a test PDF (must have patient phone in it)
curl -X POST http://localhost:3000/api/patient-profile/upload \
  -F "pdf=@/path/to/test-progress-note.pdf"
```

---

## 📱 Test Patient Portal Login

```bash
# Get PIN from console logs when patient was created
# Then test login:

curl -X POST http://localhost:3000/api/patient-chart/portal/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "5551112222",
    "pin": "123456"
  }'
```

---

## 🔍 Search Patients

```bash
curl "http://localhost:3000/api/patient-chart/search/query?q=John"
```

---

## 📈 View Statistics

```bash
curl http://localhost:3000/api/patient-chart/stats/overview
```

---

## 🎯 What Happens Automatically Now

Every time you:

| Action | What Happens |
|--------|--------------|
| Save dictation | → Patient created/updated, dictation linked |
| Complete pre-visit call | → Patient created/updated, call data merged |
| Upload schedule CSV | → Patient created for each appointment |
| Upload progress note PDF | → Patient created, conditions/meds extracted |

**All using phone number as the unique key!**

---

## 🐛 Troubleshooting

### "Cannot find module 'bcrypt'"
```bash
npm install bcrypt
pm2 restart unified-api
```

### "Database function not found"
- Re-run the SQL migration
- Check Supabase connection in .env

### "Patient not created"
- Check server logs: `pm2 logs unified-api`
- Verify phone number is in request
- Test patient service directly

### "PIN not showing"
- Check console output (logged for now)
- Future: Will be sent via SMS

---

## 📚 Full Documentation

- **Complete Guide:** `PATIENT_CHART_CONSOLIDATION_README.md`
- **Implementation Details:** `IMPLEMENTATION_COMPLETE_SUMMARY.md`
- **Database Schema:** `database/migrations/unified-patients-consolidation.sql`

---

## 🎉 You're Done!

The system is live and working. Every patient interaction now automatically builds a unified patient chart.

**Next:** Build the frontend UI (patient portal + doctor chart view)

---

**Questions?** Check the troubleshooting section in `PATIENT_CHART_CONSOLIDATION_README.md`
