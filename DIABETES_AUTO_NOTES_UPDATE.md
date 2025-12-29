# Diabetes Education: Auto-Update Clinical Notes from Calls

**Created:** December 29, 2025
**Feature:** Automatic clinical note extraction and patient record updates from phone calls

---

## Overview

When patients call the diabetes education line (832-400-3930), the system now **automatically extracts clinical insights** from the conversation and **appends them to the patient's clinical notes**. This eliminates the need for manual note-taking after each call.

---

## How It Works

### 1. Patient Makes Call
- Patient calls 832-400-3930
- System authenticates by phone number
- AI diabetes educator engages in conversation

### 2. Call Ends
- ElevenLabs sends transcript to webhook: `/api/elevenlabs/diabetes-education-transcript`
- System processes the full conversation transcript

### 3. AI Extracts Clinical Insights
**Extracted Information:**
- **Clinical Summary**: Brief 2-3 sentence summary of the call
- **Concerns**: New symptoms or issues mentioned by patient
- **Progress Updates**: Changes in existing conditions or focus areas
- **Action Items**: Follow-up tasks or recommendations
- **Suggested Focus Areas**: New topics that emerged during conversation

**Example Extraction:**
```json
{
  "clinical_note": "Patient expressed concern about recent weight gain despite following diet plan. Discussed carb counting strategies and portion control.",
  "concerns": ["Weight gain", "Difficulty with portion control"],
  "progress_updates": ["Started using food scale", "Tracking meals in app"],
  "suggested_focus_areas": ["Portion Control", "Carb Counting"],
  "action_items": ["Schedule follow-up call in 2 weeks", "Review food diary"]
}
```

### 4. Patient Record Updated
The system automatically:
- **Appends to clinical notes** with timestamp
- **Adds new focus areas** if suggested by AI
- **Maintains complete audit trail** of all updates

**Example Updated Note:**
```
Initial notes entered by staff:
Patient needs to focus on weight loss. Recently started insulin pump.

--- Call on Dec 29, 2025 ---
Patient expressed concern about recent weight gain despite following diet plan. Discussed carb counting strategies and portion control.
Concerns: Weight gain; Difficulty with portion control
Progress: Started using food scale; Tracking meals in app
Action items: Schedule follow-up call in 2 weeks; Review food diary
```

---

## Technical Implementation

### Backend Changes

**File:** [server/api/twilio/diabetes-education-inbound.js](server/api/twilio/diabetes-education-inbound.js)

#### New Functions:

1. **`extractClinicalInsights(transcriptText, patientData)`**
   - Uses OpenAI GPT-4o-mini to analyze call transcript
   - Takes patient context (medications, diagnoses, existing notes) into account
   - Returns structured JSON with clinical insights

2. **`updatePatientNotesFromCall(patientId, callId, insights, callDate)`**
   - Fetches current patient record
   - Appends timestamped notes to `clinical_notes` field
   - Merges suggested focus areas with existing `focus_areas`
   - Updates patient record in database

#### Integration Point:
In `handleElevenLabsTranscript()` function, after saving call transcript:
```javascript
// Extract clinical insights and update patient notes
if (transcriptText && transcriptText.length > 50) {
  const patientData = await supabase
    .from('diabetes_education_patients')
    .select('*')
    .eq('id', existingCall.patient_id)
    .single();

  const insights = await extractClinicalInsights(transcriptText, patientData.data);

  if (insights && insights.clinical_note) {
    updatePatientNotesFromCall(
      existingCall.patient_id,
      existingCall.id,
      insights,
      existingCall.call_started_at
    );
  }
}
```

### Frontend Changes

**File:** [src/components/diabetes/PatientDetailModal.tsx](src/components/diabetes/PatientDetailModal.tsx)

#### Updates:
1. **Info Banner** in Clinical Notes tab:
   - Informs staff that notes are auto-updated from calls
   - Explains how the feature works

2. **Increased textarea rows** from 6 to 10:
   - Accommodates longer notes with call history

3. **Focus Areas label enhancement**:
   - Shows "AI may suggest new areas based on calls"
   - Makes it clear that focus areas are dynamic

---

## Database Impact

### Fields Updated Automatically:
- **`diabetes_education_patients.clinical_notes`** (TEXT)
  - Appends timestamped call notes
  - Never overwrites existing notes

- **`diabetes_education_patients.focus_areas`** (JSONB array)
  - Adds new suggested areas
  - Deduplicates to prevent duplicates

- **`diabetes_education_patients.updated_at`** (TIMESTAMPTZ)
  - Updated to current timestamp

### No Database Migration Required
This feature uses existing fields and does not require schema changes.

---

## Usage for Clinical Staff

### Viewing Auto-Generated Notes

1. **Navigate to Diabetes Education Admin:**
   - Go to https://www.tshla.ai/diabetes-education
   - Or click "Diabetes Education Admin" from doctor dashboard

2. **Open Patient Details:**
   - Click "View Details" next to any patient

3. **Go to Clinical Notes Tab:**
   - Click "Clinical Notes" tab

4. **Review Notes:**
   - Manual notes appear at top
   - Call-generated notes appear below with timestamps
   - Format: `--- Call on Dec 29, 2025 ---`

### Editing Notes

You can still **manually edit or add notes** at any time:
- Type directly in the textarea
- Click "Save Notes & Focus Areas"
- Manual edits are preserved
- Future call notes are appended below

### Focus Areas

- **Pre-selected tags** remain as before
- **New AI-suggested tags** automatically appear after calls
- You can **remove unwanted tags** by clicking the X
- **Custom tags** can still be added manually

---

## AI Prompt Details

### System Prompt:
```
You are a clinical documentation assistant for diabetes education. Extract key clinical insights from patient calls.

Extract:
1. New concerns or symptoms mentioned
2. Progress on existing focus areas (weight loss, medication adherence, etc.)
3. Patient questions or confusion areas
4. Important behavioral changes
5. Suggested new focus areas

Patient Context:
[Current medications, diagnoses, previous notes, focus areas]

Return JSON only in this format:
{
  "clinical_note": "Brief clinical note summarizing key points from this call (2-3 sentences)",
  "concerns": ["concern1", "concern2"],
  "progress_updates": ["update1", "update2"],
  "suggested_focus_areas": ["area1", "area2"],
  "action_items": ["action1", "action2"]
}
```

### Model Used:
- **Model:** `gpt-4o-mini`
- **Max Tokens:** 500
- **Temperature:** 0.2 (low randomness for consistency)

---

## Benefits

### For Clinical Staff:
✅ **No manual note-taking** after each call
✅ **Consistent documentation** format
✅ **Complete call history** in one place
✅ **Automatic focus area suggestions** based on patient needs
✅ **Time saved** on administrative tasks

### For Patients:
✅ **Continuity of care** - all conversations tracked
✅ **Personalized AI responses** based on call history
✅ **Focus on their specific needs** identified by AI

### For Quality Assurance:
✅ **Audit trail** of all patient interactions
✅ **Searchable notes** for compliance
✅ **Timestamped entries** for legal documentation

---

## Examples

### Example 1: Weight Management Call

**Call Transcript (excerpt):**
```
Patient: "I've been trying to lose weight but I keep gaining. I'm following the diet you gave me."
AI: "I understand your frustration. Let's talk about your typical daily meals..."
```

**Auto-Generated Note:**
```
--- Call on Dec 29, 2025 ---
Patient expressed frustration with weight gain despite following recommended diet. Discussed typical daily meals and identified areas for improvement in portion control and snacking habits.
Concerns: Weight gain despite diet adherence; Frustration with progress
Progress: Following meal plan; Tracking some foods
Action items: Start using food scale for portions; Track all snacks; Follow-up in 2 weeks
```

**Focus Areas Added:**
- Weight Loss (already existed)
- Portion Control (NEW - suggested by AI)

---

### Example 2: Insulin Technique Call

**Call Transcript (excerpt):**
```
Patient: "I'm not sure I'm injecting my insulin correctly. Sometimes I see blood."
AI: "Let's review the proper injection technique step by step..."
```

**Auto-Generated Note:**
```
--- Call on Dec 29, 2025 ---
Patient has concerns about insulin injection technique, reporting occasional bleeding at injection sites. Reviewed proper technique including rotation of sites and 90-degree angle insertion. Patient will practice and observe for improvement.
Concerns: Bleeding at injection sites; Uncertainty about technique
Progress: Willing to adjust technique; Open to feedback
Action items: Practice proper rotation; Use different needle gauge; Call if bleeding persists
```

**Focus Areas Added:**
- Insulin Technique (NEW - suggested by AI)

---

## Testing

### Manual Test Steps:

1. **Create test patient** in diabetes education system
2. **Add initial clinical note** manually
3. **Simulate call** by sending webhook payload:
   ```bash
   curl -X POST http://localhost:3000/api/elevenlabs/diabetes-education-transcript \
     -H "Content-Type: application/json" \
     -d '{
       "type": "transcription",
       "data": {
         "conversation_id": "test-123",
         "transcript": [
           {"role": "agent", "message": "How are you feeling today?"},
           {"role": "user", "message": "I've been having trouble managing my blood sugar"}
         ]
       }
     }'
   ```
4. **Check patient record** in database
5. **Verify notes updated** with timestamped entry
6. **View in UI** at https://www.tshla.ai/diabetes-education

### Expected Results:
- ✅ Clinical notes field contains new timestamped entry
- ✅ Focus areas array may include new suggestions
- ✅ `updated_at` timestamp is current
- ✅ Original manual notes are preserved

---

## Logging

### Console Logs to Watch:
```
📝 [DiabetesEdu] ElevenLabs transcript webhook received
   Transcript length: 1247 characters
✅ [DiabetesEdu] Generated AI summary
✅ [DiabetesEdu] Transcript saved successfully
   🔍 Extracting clinical insights from transcript...
   ✅ Clinical insights extracted
      Note: Patient expressed frustration with weight gain...
✅ [DiabetesEdu] Patient notes updated from call
   Added 342 characters to clinical notes
   Added 2 new focus areas
```

---

## Error Handling

The system is designed to **never fail the entire webhook** if note extraction fails:

- If AI extraction fails → Call transcript still saved, just no auto-notes
- If patient fetch fails → Webhook succeeds, logs error
- If note update fails → Webhook succeeds, logs warning

**Rationale:** Call transcript is the most important data. Auto-notes are a bonus feature.

---

## Future Enhancements (Optional)

### 1. Note Versioning
- Track history of note changes
- Show "Last edited by" and "Auto-generated from call #X"

### 2. Note Approval Workflow
- AI-generated notes marked as "Draft"
- Staff can review and approve before finalizing

### 3. Analytics
- Track most common concerns across all patients
- Generate monthly reports on focus area trends

### 4. Smart Alerts
- If AI detects urgent concern → notify staff immediately
- Example: "Patient reported severe hypoglycemia episode"

---

## Files Modified

### Backend:
1. **server/api/twilio/diabetes-education-inbound.js**
   - Added `extractClinicalInsights()` function
   - Added `updatePatientNotesFromCall()` function
   - Modified `handleElevenLabsTranscript()` to call new functions

### Frontend:
1. **src/components/diabetes/PatientDetailModal.tsx**
   - Added info banner about auto-updates
   - Increased textarea rows for longer notes
   - Added subtitle to focus areas section

### Documentation:
1. **DIABETES_AUTO_NOTES_UPDATE.md** (this file)

---

## Deployment Checklist

- [x] Backend code updated
- [x] Frontend UI updated
- [x] No database migration needed
- [x] Logging implemented
- [x] Error handling in place
- [x] Documentation created
- [ ] Test with real phone call
- [ ] Deploy to production
- [ ] Monitor logs for first 24 hours

---

## Support

**Questions or Issues?**
- Check Azure logs: `az monitor activity-log list`
- Check webhook logs for diabetes education calls
- Search for `[DiabetesEdu]` in logs
- Contact development team

---

**Status:** ✅ Ready for deployment

**Next Steps:**
1. Test with a real patient call
2. Deploy to Azure
3. Monitor first 5-10 calls closely
4. Gather staff feedback after 1 week
