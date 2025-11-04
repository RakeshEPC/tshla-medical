# Patient-Friendly Visit Summary - Implementation Guide

## 🎯 Feature Overview

**Status:** Beta
**Purpose:** Convert medical SOAP notes into easy-to-understand summaries for patients
**Reading Time:** 15-30 seconds
**Target Audience:** Patients leaving doctor's office

---

## ✅ What Has Been Created

### 1. Database Schema
**File:** `src/lib/db/migrations/add_patient_visit_summaries.sql`

**Table:** `patient_visit_summaries`
- Stores patient-friendly summaries
- Links to visits, patients, providers
- Tracks feedback and quality metrics
- Row Level Security (RLS) policies enforce access control

**Key Features:**
- Provider approval gate (optional - summaries can be auto-approved or require review)
- Patient feedback collection (helpful/not helpful, rating, text feedback)
- Quality analytics (word count, read time, helpfulness)

**To Deploy:**
```bash
# Run migration in Supabase SQL editor
# Copy content from: src/lib/db/migrations/add_patient_visit_summaries.sql
```

### 2. AI Service
**File:** `src/services/patientSummaryGenerator.service.ts`

**Capabilities:**
- Converts SOAP notes to plain English
- Targets 150-200 words (15-30 second read time)
- Extracts structured action items
- Validates quality (no jargon, appropriate length)
- Fallback mode when AI unavailable

**Configuration:**
- Uses OpenAI GPT-4o-mini (cheap: ~$0.0002 per summary)
- Environment variable: `VITE_OPENAI_API_KEY`
- Model can be changed via: `VITE_OPENAI_MODEL_STAGE4`

### 3. Backend API
**File:** `server/patient-summary-api.js`

**Endpoints:**
```
POST   /api/patient-summaries              Generate and save summary
GET    /api/patient-summaries/:id          Get summary by ID
GET    /api/patient-summaries/visit/:visitId   Get summary for visit
GET    /api/patient-summaries/patient/:patientId   Get all patient summaries
PATCH  /api/patient-summaries/:id/approve  Provider approves summary
POST   /api/patient-summaries/:id/feedback Patient submits feedback
GET    /api/patient-summaries/analytics    Admin analytics
```

**Integrated into:** `server/unified-api.js` (line 170)

### 4. Patient UI Component
**File:** `src/components/patient/VisitSummaryBeta.tsx`

**Features:**
- ⚠️ Beta banner with disclaimer
- 📋 Easy-to-read summary
- ✅ Interactive checklist for action items
- 💬 Feedback form (helpful/not helpful, rating, comments)
- 🎉 Completion celebration

### 5. React Hook
**File:** `src/hooks/usePatientSummary.ts`

**Usage:**
```typescript
const { summary, loading, generateSummary, saveSummary } = usePatientSummary();

// Generate from SOAP note
await generateSummary({
  plan: soapNote.plan,
  assessment: soapNote.assessment,
  medications: soapNote.medications
});

// Save to database
await saveSummary(visitId, patientId, providerId);
```

---

## 🚀 Implementation Steps

### Step 1: Deploy Database Schema

1. Open Supabase SQL Editor
2. Copy content from `src/lib/db/migrations/add_patient_visit_summaries.sql`
3. Run the migration
4. Verify table created: `patient_visit_summaries`

### Step 2: Configure Environment

Ensure these variables are set in `.env`:
```bash
VITE_OPENAI_API_KEY=sk-...  # OpenAI API key
VITE_OPENAI_MODEL_STAGE4=gpt-4o-mini  # Model for summaries
```

### Step 3: Restart Backend Server

```bash
# If using PM2
pm2 restart tshla-api

# If running locally
npm run server:unified
```

The patient summary API will be available at:
- Local: `http://localhost:3000/api/patient-summaries`
- Production: `https://your-api.azurecontainerapps.io/api/patient-summaries`

### Step 4: Integrate into Dictation Workflow

**Option A: Automatic Generation (Recommended)**

Modify your dictation save handler to automatically generate summaries:

```typescript
// In your dictation component (e.g., EnhancedDictation.tsx)
import { usePatientSummary } from '../../hooks/usePatientSummary';

function YourDictationComponent() {
  const { generateSummary, saveSummary } = usePatientSummary();

  async function handleSaveNote(soapNote) {
    // 1. Save the SOAP note (existing code)
    await saveSOAPNote(soapNote);

    // 2. Generate patient summary (NEW)
    const summary = await generateSummary({
      plan: soapNote.sections.plan,
      assessment: soapNote.sections.assessment,
      medications: soapNote.sections.medications
    });

    // 3. Save summary to database (NEW)
    if (summary) {
      await saveSummary(visitId, patientId, providerId);
    }
  }
}
```

**Option B: Manual Generation (Provider Button)**

Add a "Generate Patient Summary" button in provider UI:

```typescript
<button onClick={async () => {
  const summary = await generateSummary({ plan, assessment, medications });
  if (summary) {
    // Show preview modal for provider to review
    setPreviewSummary(summary);
  }
}}>
  Generate Patient Summary
</button>
```

### Step 5: Add to Patient Portal

Create a new route/page for patients to view their summaries:

```typescript
// src/pages/MyVisitSummaries.tsx
import VisitSummaryBeta from '../components/patient/VisitSummaryBeta';

export default function MyVisitSummaries() {
  const { visitId } = useParams(); // or load from patient dashboard

  return (
    <div>
      <VisitSummaryBeta visitId={visitId} />
    </div>
  );
}
```

Add to patient navigation:
```typescript
<Link to="/my-visits/summary">
  📋 My Visit Summary
</Link>
```

---

## 🧪 Testing Guide

### Test Case 1: Generate Summary from SOAP Note

**Input:**
```json
{
  "plan": "1. Increase Lantus from 20 units to 25 units at bedtime\n2. Order HbA1c, CMP\n3. Follow up in 3 months\n4. Continue diet and exercise program",
  "assessment": "Type 2 Diabetes Mellitus, poorly controlled. Blood sugar 400 mg/dL, A1C 9.5%",
  "medications": "Lantus 20 units qhs, Metformin 1000mg BID"
}
```

**Expected Output:**
```
What We Talked About:
We discussed your diabetes and high blood sugar levels. Your A1C is 9.5% and blood sugar was 400, so we need to adjust your treatment.

Your Medication Changes:
- Increase your Lantus insulin from 20 units to 25 units at bedtime
- Continue Metformin 1000mg twice daily

Tests We Need:
- Get blood work (A1C and kidney function) within 2 weeks
- Bring results to your next visit

What to Do:
- Check your blood sugar daily before meals and at bedtime
- Continue healthy eating and exercise
- Watch for signs of low blood sugar (shakiness, sweating)

Next Visit:
Schedule follow-up in 3 months. Bring your blood sugar log and lab results.
```

**Quality Checks:**
- ✅ No medical jargon (uses "blood sugar" not "glucose")
- ✅ Uses "you/your" (not "the patient")
- ✅ Word count: 150-200
- ✅ Read time: 15-30 seconds
- ✅ Action items clearly listed

### Test Case 2: Patient Views Summary

1. Log in as patient
2. Navigate to visit summary page
3. Verify:
   - ✅ Beta banner displays at top
   - ✅ Summary is easy to read
   - ✅ Action items have checkboxes
   - ✅ Can provide feedback
   - ✅ Disclaimer at end: "if there were any errors, please let us know"

### Test Case 3: Provider Approval Workflow

1. Generate summary
2. Summary is NOT visible to patient (provider_approved = FALSE)
3. Provider reviews and approves
4. Summary becomes visible to patient

### Test Case 4: Feedback Collection

1. Patient views summary
2. Clicks "Give Feedback"
3. Selects "👍 Yes, very helpful"
4. Rates 5 stars
5. Adds comment: "Very clear, thank you!"
6. Submits feedback
7. Verify feedback saved in database

---

## 📊 Success Metrics

Monitor in Supabase `patient_summary_analytics` view:

```sql
SELECT * FROM patient_summary_analytics;
```

**Target Metrics:**
- ✅ 80%+ patients find summaries helpful
- ✅ <5% error reports
- ✅ Average read time: 15-30 seconds
- ✅ Average word count: 150-200
- ✅ 50%+ patient engagement (viewed summaries)

---

## 🔧 Customization Options

### Adjust Reading Level

Edit prompt in `patientSummaryGenerator.service.ts`:
```typescript
// Current: 6th grade reading level
// To make simpler: 4th grade
// To make more detailed: 8th grade
```

### Change Summary Length

```typescript
// Target: 150-200 words (15-30 seconds)
// Shorter: 100-150 words (10-20 seconds)
// Longer: 200-300 words (30-45 seconds)
```

### Auto-Approval

If you want summaries to be immediately visible (skip provider review):

```typescript
// In server/patient-summary-api.js, line ~70
provider_approved: true  // Change from false to true
```

### Customize AI Model

Use different OpenAI model:
```bash
# .env
VITE_OPENAI_MODEL_STAGE4=gpt-4o  # More accurate but 10x more expensive
VITE_OPENAI_MODEL_STAGE4=gpt-3.5-turbo  # Cheaper but lower quality
```

---

## 🐛 Troubleshooting

### Issue: "OpenAI API key not configured"
**Solution:** Ensure `VITE_OPENAI_API_KEY` is set in `.env` and restart server

### Issue: Summary has medical jargon
**Solution:** Check validation logs, adjust AI prompt to emphasize plain English

### Issue: Patient can't see summary
**Solution:** Check `provider_approved` field - summaries require approval by default

### Issue: Summary too long/short
**Solution:** Review `estimated_read_time_seconds` and `word_count` in database, adjust AI prompt

---

## 💰 Cost Estimate

**OpenAI API Costs (GPT-4o-mini):**
- Input: ~500 tokens (SOAP note excerpt) = $0.00015
- Output: ~300 tokens (summary) = $0.00006
- **Total per summary: ~$0.0002** (very cheap!)

For 1000 summaries/month: **~$0.20/month**

---

## 🔐 Security & Privacy

- ✅ RLS policies ensure patients only see their own summaries
- ✅ Providers can only see summaries for their patients
- ✅ Feedback is encrypted at rest in Supabase
- ✅ No PHI exposed in error logs
- ✅ All API calls authenticated via Supabase JWT

---

## 📈 Future Enhancements

**Phase 2 (Future):**
- 📧 Email summaries to patients
- 📱 SMS notifications when summary ready
- 🔊 Audio version (text-to-speech for accessibility)
- 🌐 Multi-language support (Spanish, etc.)
- 📊 Provider dashboard showing summary engagement
- 🤖 AI learns from feedback to improve quality

---

## 🎉 Launch Checklist

Before releasing to patients:

- [ ] Database schema deployed
- [ ] Backend API tested and working
- [ ] Environment variables configured
- [ ] Sample summaries generated and reviewed
- [ ] Beta disclaimer visible
- [ ] Feedback form working
- [ ] RLS policies tested (patients can't see others' summaries)
- [ ] Provider review workflow tested (if using approval gate)
- [ ] Analytics view accessible
- [ ] Cost monitoring in place (OpenAI usage)
- [ ] User documentation created
- [ ] Staff trained on feature

---

## 📞 Support

If you encounter issues:
1. Check server logs: `pm2 logs tshla-api`
2. Review Supabase logs for RLS policy errors
3. Test API endpoints directly with curl/Postman
4. Validate OpenAI API key with: `curl https://api.openai.com/v1/models -H "Authorization: Bearer $VITE_OPENAI_API_KEY"`

---

**Status:** ✅ Implementation complete, ready for deployment and testing!
