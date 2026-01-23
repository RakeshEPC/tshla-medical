# Patient Portal Database Setup Guide

## Quick Start

Run these migrations in order via Supabase Dashboard SQL Editor.

### Step 1: Open Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your project: `tshla-medical`
3. Click "SQL Editor" in left sidebar
4. Click "New Query"

### Step 2: Run Migrations in Order

#### Migration 1: Comprehensive H&P Schema
**File:** `add-comprehensive-hp.sql`

**What it creates:**
- `patient_comprehensive_chart` - Main patient medical chart
- `patient_chart_history` - Audit trail for all changes
- `visit_dictations_archive` - Archived dictations (not used in AI)
- `staff_review_queue` - Patient edits awaiting staff approval

**Run:** Copy and paste the contents of `add-comprehensive-hp.sql` into SQL Editor and click "Run"

---

#### Migration 2: AI Chat System
**File:** `add-ai-chat-conversations.sql`

**What it creates:**
- `patient_ai_conversations` - All chat messages (user + assistant)
- `patient_ai_analytics` - Daily aggregated stats per patient
- `patient_urgent_alerts` - Urgent symptom alerts for staff

**Run:** Copy and paste the contents of `add-ai-chat-conversations.sql` into SQL Editor and click "Run"

---

#### Migration 3: Portal Analytics
**File:** `add-patient-portal-analytics.sql`

**What it creates:**
- `patient_portal_sessions` - Session tracking
- `patient_portal_section_views` - Section view analytics
- `patient_portal_daily_stats` - Aggregated daily stats

**Run:** Copy and paste the contents of `add-patient-portal-analytics.sql` into SQL Editor and click "Run"

---

## Verify Migrations

Run this query to verify all tables were created:

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
    'patient_portal_daily_stats'
  )
ORDER BY table_name;
```

**Expected result:** 10 tables

---

## Sample Data (Optional - For Testing)

After running migrations, you can insert sample data:

```sql
-- Sample patient (use existing unified_patients record)
-- Assuming patient with TSH ID 'TSH123-456' exists

-- Insert sample comprehensive H&P
INSERT INTO patient_comprehensive_chart (
  patient_phone,
  tshla_id,
  demographics,
  medications,
  diagnoses,
  labs,
  vitals,
  current_goals,
  full_hp_narrative,
  last_ai_generated,
  version
) VALUES (
  '+18325551234',
  'TSH123-456',
  '{"age": 55, "gender": "M"}',
  '[
    {
      "name": "Metformin",
      "dose": "500mg",
      "frequency": "Twice daily",
      "start_date": "2024-01-15",
      "status": "active"
    },
    {
      "name": "Lisinopril",
      "dose": "10mg",
      "frequency": "Once daily",
      "start_date": "2024-02-01",
      "status": "active"
    }
  ]',
  '[
    {
      "diagnosis": "Type 2 Diabetes Mellitus",
      "icd10": "E11.9",
      "status": "active",
      "onset_date": "2023-06-15"
    },
    {
      "diagnosis": "Hypertension",
      "icd10": "I10",
      "status": "active",
      "onset_date": "2023-08-20"
    }
  ]',
  '{
    "A1C": [
      {"value": 6.8, "date": "2025-01-20", "unit": "%"},
      {"value": 7.2, "date": "2024-10-15", "unit": "%"},
      {"value": 7.5, "date": "2024-07-10", "unit": "%"}
    ],
    "LDL Cholesterol": [
      {"value": 95, "date": "2025-01-20", "unit": "mg/dL"},
      {"value": 110, "date": "2024-10-15", "unit": "mg/dL"}
    ],
    "Serum Creatinine": [
      {"value": 1.0, "date": "2025-01-20", "unit": "mg/dL"},
      {"value": 1.1, "date": "2024-10-15", "unit": "mg/dL"}
    ]
  }',
  '{
    "Blood Pressure": [
      {"systolic": 128, "diastolic": 78, "date": "2025-01-20"},
      {"systolic": 135, "diastolic": 82, "date": "2024-12-15"}
    ],
    "Weight": [
      {"value": 185, "date": "2025-01-20", "unit": "lbs"},
      {"value": 188, "date": "2024-12-15", "unit": "lbs"}
    ]
  }',
  '[
    {
      "category": "Diet",
      "goal": "Reduce carbs to 150g per day",
      "status": "in_progress",
      "added_date": "2025-01-15T10:00:00Z"
    },
    {
      "category": "Exercise",
      "goal": "Walk 30 minutes daily",
      "status": "in_progress",
      "added_date": "2025-01-15T10:00:00Z"
    }
  ]',
  'Patient is a 55-year-old male with Type 2 Diabetes Mellitus and Hypertension. Currently on Metformin 500mg twice daily and Lisinopril 10mg once daily. Most recent A1C is 6.8% (improved from 7.5%). Blood pressure well-controlled at 128/78. Patient working on dietary changes and exercise goals.',
  NOW(),
  1
) ON CONFLICT (patient_phone) DO NOTHING;
```

---

## Environment Variables Setup

Add these to your `.env` file:

```bash
# Azure OpenAI (HIPAA-compliant)
AZURE_OPENAI_API_KEY=your-azure-openai-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o

# ElevenLabs Text-to-Speech (Rachel voice)
ELEVENLABS_API_KEY=your-elevenlabs-key
ELEVENLABS_VOICE_ID=rachel

# Supabase (already configured)
VITE_SUPABASE_URL=https://minvvjdflezibmgkplqb.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## Testing the System

### 1. Test H&P Generation API

```bash
curl -X POST http://localhost:3000/api/hp/generate \
  -H "Content-Type: application/json" \
  -d '{
    "patientPhone": "+18325551234",
    "tshlaId": "TSH123-456"
  }'
```

Expected response:
```json
{
  "success": true,
  "hp": {
    "version": 1,
    "sections": {
      "medications": 2,
      "diagnoses": 2,
      "labs": 3
    }
  }
}
```

### 2. Test AI Chat API

```bash
curl -X POST http://localhost:3000/api/ai-chat/message \
  -H "Content-Type: application/json" \
  -d '{
    "tshlaId": "TSH123-456",
    "message": "What should my A1C goal be?",
    "sessionId": "test-session-123"
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Great question! For most people with Type 2 Diabetes...",
  "audioUrl": null,
  "urgentAlert": false,
  "tokensUsed": 250,
  "costCents": 1,
  "topic": "monitoring"
}
```

### 3. Test Patient Portal Login

1. Start dev server: `npm run dev`
2. Navigate to: `http://localhost:5173/patient-portal-login`
3. Enter TSH ID: `TSH123-456`
4. Enter last 4 of phone: `1234`
5. Should redirect to unified dashboard

---

## Rollback (If Needed)

If you need to undo migrations:

```sql
-- Drop all patient portal tables (CAREFUL - THIS DELETES DATA!)
DROP TABLE IF EXISTS patient_portal_daily_stats CASCADE;
DROP TABLE IF EXISTS patient_portal_section_views CASCADE;
DROP TABLE IF EXISTS patient_portal_sessions CASCADE;
DROP TABLE IF EXISTS patient_urgent_alerts CASCADE;
DROP TABLE IF EXISTS patient_ai_analytics CASCADE;
DROP TABLE IF EXISTS patient_ai_conversations CASCADE;
DROP TABLE IF EXISTS staff_review_queue CASCADE;
DROP TABLE IF EXISTS visit_dictations_archive CASCADE;
DROP TABLE IF EXISTS patient_chart_history CASCADE;
DROP TABLE IF EXISTS patient_comprehensive_chart CASCADE;
```

---

## Troubleshooting

### "relation already exists" error
- This means the table was already created
- Safe to ignore or use `IF NOT EXISTS` clause

### "permission denied" error
- Make sure you're using the service_role key
- Check that RLS policies allow inserts

### "syntax error"
- Make sure you copied the entire SQL file
- Check for missing semicolons
- Try running statements one at a time

### Azure OpenAI not responding
- Verify `AZURE_OPENAI_API_KEY` is set correctly
- Check `AZURE_OPENAI_ENDPOINT` format
- Ensure deployment name matches your Azure resource

---

## Next Steps

Once migrations are complete:

1. ✅ Test H&P generation with sample data
2. ✅ Test AI chat functionality
3. ✅ Test patient portal login flow
4. ✅ Complete ElevenLabs audio integration
5. ✅ Create staff analytics dashboard
6. ✅ Deploy to production

---

## Support

If you encounter issues:
1. Check Supabase logs in Dashboard → Logs
2. Check browser console for frontend errors
3. Check server logs: `npm run dev` terminal output
4. Verify all environment variables are set
