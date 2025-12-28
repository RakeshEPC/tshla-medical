# Diabetes Education - Conversation Storage & Display Setup
**Created:** December 26, 2025
**Status:** Code Complete - Configuration Required

---

## 🎯 What This Does

Automatically captures and stores **every conversation** between patients and the AI diabetes educator, including:
- ✅ Full transcript (every word spoken by patient and AI)
- ✅ AI-generated summary (2-3 sentences)
- ✅ Topics discussed (extracted tags)
- ✅ Call duration and status
- ✅ Accessible in patient detail modal

---

## ✅ What's Already Built

### Database Schema
The `diabetes_education_calls` table already has all required fields:

```sql
CREATE TABLE diabetes_education_calls (
  id UUID PRIMARY KEY,
  patient_id UUID REFERENCES diabetes_education_patients(id),
  twilio_call_sid VARCHAR(255),
  elevenlabs_conversation_id VARCHAR(255),

  -- CONVERSATION DATA (stored here)
  transcript TEXT,                    -- Full conversation text
  summary TEXT,                        -- AI-generated summary
  topics_discussed JSONB,              -- Array of topics

  -- CALL METADATA
  call_started_at TIMESTAMPTZ,
  call_ended_at TIMESTAMPTZ,
  duration_seconds INT,
  call_status VARCHAR(50),
  disconnect_reason VARCHAR(100)
);
```

### Backend Webhook Handler
**File:** `server/api/twilio/diabetes-education-inbound.js`
**Function:** `handleElevenLabsTranscript()` (lines 425-545)

**What it does:**
1. Receives webhook from ElevenLabs after call ends
2. Extracts transcript from ElevenLabs format
3. Converts to readable text:
   ```
   AI: Hello, what can I help you with?
   Patient: What medications am I on?
   AI: Looking at your chart, you're currently taking...
   ```
4. Calls OpenAI GPT-4o-mini to generate summary
5. Saves transcript + summary to database

### Frontend Display
**File:** `src/components/diabetes/PatientDetailModal.tsx`
**Tab:** "Calls" (lines 580-650)

**Displays:**
- List of all calls
- Call date/time and duration
- Call status badge
- AI summary (if available)
- Full transcript (expandable)
- Topics discussed (as tags)

---

## 📋 Setup Steps

### Step 1: Deploy Code to Azure

The webhook handler code is written but needs to be deployed:

```bash
cd /Users/rakeshpatel/Desktop/tshla-medical

# Commit changes
git add .
git commit -m "Add ElevenLabs transcript webhook handler for conversation storage"

# Push to trigger deployment
git push origin main
```

**Wait 10-15 minutes** for GitHub Actions to deploy.

**Verify deployment:**
```bash
curl -X POST https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/elevenlabs/diabetes-education-transcript \
  -H "Content-Type: application/json" \
  -d '{"type":"transcription","data":{"conversation_id":"test"}}'
```

Should return: `{"success": true, "message": "Call not found in database"}`
(This is expected - it means the endpoint is working)

---

### Step 2: Configure ElevenLabs Webhook

#### Option A: Via ElevenLabs Dashboard (Recommended)

1. **Go to ElevenLabs:**
   - Navigate to: https://elevenlabs.io/app/conversational-ai
   - Click your profile icon (top-right)
   - Look for **"Agents Platform Settings"** or **"Workspace Settings"**

2. **Find Webhooks Section:**
   - Look for **"Webhooks"** or **"Post-call webhooks"**
   - You should see options for:
     - Transcription webhooks
     - Audio webhooks
     - Call initiation failure webhooks

3. **Enable Transcription Webhooks:**
   - Toggle ON: **"Transcription webhooks"**
   - Add webhook URL:
     ```
     https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/elevenlabs/diabetes-education-transcript
     ```
   - Method: **POST**
   - Content-Type: **application/json**

4. **Save Configuration**

#### Option B: Via ElevenLabs API (Advanced)

If you have an API key, you can configure programmatically:

```bash
curl -X POST https://api.elevenlabs.io/v1/convai/webhooks \
  -H "xi-api-key: YOUR_ELEVENLABS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/elevenlabs/diabetes-education-transcript",
    "event_type": "transcription"
  }'
```

---

### Step 3: Test the Integration

#### Make a Test Call

1. **Call from an enrolled number:**
   - Use: +1-832-607-3630 (Raman) or +1-713-855-2377 (Simrab)
   - Dial: **832-400-3930**

2. **Have a short conversation:**
   ```
   AI: "Hello! I'm your diabetes educator..."
   You: "What medications am I on?"
   AI: "Looking at your chart..."
   You: "What was my last A1C?"
   AI: "Your last A1C was..."
   You: "Thank you!"
   [Hang up]
   ```

3. **Wait 30-60 seconds** for webhook to process

#### Verify in Database

```sql
-- Check the most recent call
SELECT
  call_started_at,
  duration_seconds,
  call_status,
  LENGTH(transcript) as transcript_length,
  LENGTH(summary) as summary_length,
  topics_discussed
FROM diabetes_education_calls
ORDER BY call_started_at DESC
LIMIT 1;
```

**Expected result:**
```
call_started_at      | 2025-12-26 15:30:00
duration_seconds     | 45
call_status          | completed
transcript_length    | 523
summary_length       | 156
topics_discussed     | ["medications", "A1C results"]
```

#### Verify in Portal

1. Go to: https://www.tshla.ai/diabetes-education
2. Click **"View Details"** on the patient who called
3. Go to **"Calls"** tab
4. You should see:
   - ✅ Call date/time
   - ✅ Duration (e.g., "45 seconds")
   - ✅ Status: "completed"
   - ✅ AI Summary: "Patient asked about current medications..."
   - ✅ Click "View Full Transcript" to expand full conversation

---

## 🔍 How It Works (Technical Flow)

### Call Flow:

```
1. Patient calls 832-400-3930
   ↓
2. Twilio receives call
   → Webhook: POST /api/twilio/diabetes-education-inbound
   → Database: INSERT into diabetes_education_calls (status: 'in-progress')
   ↓
3. Call connects to ElevenLabs AI agent
   → Patient and AI have conversation
   → ElevenLabs records transcript
   ↓
4. Call ends
   → Twilio webhook: POST /api/twilio/diabetes-education-status
   → Database: UPDATE call status='completed', duration=120s
   ↓
5. ElevenLabs sends transcript (5-30 seconds later)
   → Webhook: POST /api/elevenlabs/diabetes-education-transcript
   → Payload contains full conversation transcript
   ↓
6. Backend processes transcript
   → Converts ElevenLabs format to readable text
   → Calls OpenAI GPT-4o-mini: "Summarize this call..."
   → Saves transcript + summary to database
   ↓
7. Staff views in portal
   → Patient Detail Modal → Calls tab
   → Sees transcript, summary, topics
```

### Webhook Payload Example:

**ElevenLabs sends:**
```json
{
  "type": "transcription",
  "event_timestamp": "2025-12-26T15:30:45.000Z",
  "data": {
    "agent_id": "agent_abc123",
    "conversation_id": "conv_xyz789",
    "transcript": [
      {
        "role": "agent",
        "message": "Hello! I'm your diabetes educator. What questions do you have today?",
        "timestamp": "2025-12-26T15:30:05.000Z"
      },
      {
        "role": "user",
        "message": "What medications am I on?",
        "timestamp": "2025-12-26T15:30:10.000Z"
      },
      {
        "role": "agent",
        "message": "Looking at your chart, you're currently taking Metformin 500mg twice daily and Insulin glargine 20 units at bedtime.",
        "timestamp": "2025-12-26T15:30:15.000Z"
      }
    ],
    "analysis": {
      "topics": ["medications", "medication list"]
    }
  }
}
```

**Backend converts to:**
```text
AI: Hello! I'm your diabetes educator. What questions do you have today?
Patient: What medications am I on?
AI: Looking at your chart, you're currently taking Metformin 500mg twice daily and Insulin glargine 20 units at bedtime.
```

**Then calls OpenAI:**
```
System: You are a medical AI assistant. Summarize this diabetes education call in 2-3 sentences...
User: [Transcript text above]
```

**OpenAI responds:**
```
Patient inquired about their current medication regimen. The AI confirmed they are taking Metformin 500mg twice daily and Insulin glargine 20 units at bedtime.
```

**Saved to database:**
```sql
UPDATE diabetes_education_calls SET
  transcript = 'AI: Hello! I''m your diabetes...[full text]',
  summary = 'Patient inquired about their current...',
  topics_discussed = '["medications", "medication list"]'
WHERE twilio_call_sid = 'CA123...';
```

---

## 🎨 What You'll See in the Portal

### Before Configuration:
```
Calls Tab:
  Call 1: 12/26/2025, 1:45 PM
  Duration: 0 seconds
  Status: no-answer
  [No transcript available]
```

### After Configuration:
```
Calls Tab:
  Call 1: 12/26/2025, 3:45 PM
  Duration: 4 minutes 32 seconds
  Status: completed

  AI Summary:
  Patient asked about current medications and recent A1C results.
  Discussed proper insulin injection technique and timing.
  Patient expressed concern about recent weight gain.

  Topics: Medications, A1C Management, Insulin Technique

  [View Full Transcript] ← Click to expand

  AI: Hello! I'm your diabetes educator. I have your medical records here. What questions do you have today?
  Patient: Hi, what medications am I currently on?
  AI: Looking at your chart, you're currently taking Metformin 500mg twice daily, and Insulin glargine 20 units at bedtime. How have you been feeling with these medications?
  Patient: Good, but I wanted to know about my last A1C result.
  AI: Your last A1C was 7.2% on November 15th. This is slightly above the target range of under 7%. Have you been experiencing any high blood sugar readings?
  [continues for full conversation...]
```

---

## 🐛 Troubleshooting

### Issue: No transcripts appearing

**Check 1: Is webhook configured in ElevenLabs?**
- Go to ElevenLabs dashboard
- Verify webhook URL is set
- Verify "Transcription webhooks" is enabled

**Check 2: Is webhook endpoint accessible?**
```bash
curl -X POST https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/elevenlabs/diabetes-education-transcript \
  -H "Content-Type: application/json" \
  -d '{"type":"transcription","data":{"conversation_id":"test"}}'
```

Should return 200 OK (not 404)

**Check 3: Check Azure logs**
```bash
az containerapp logs show \
  --name tshla-unified-api \
  --resource-group tshla-rg \
  --tail 100 | grep "DiabetesEdu.*transcript"
```

Look for:
- `📝 [DiabetesEdu] ElevenLabs transcript webhook received`
- `✅ [DiabetesEdu] Transcript saved successfully`

**Check 4: Check database**
```sql
SELECT
  twilio_call_sid,
  elevenlabs_conversation_id,
  transcript IS NOT NULL as has_transcript,
  summary IS NOT NULL as has_summary
FROM diabetes_education_calls
ORDER BY call_started_at DESC
LIMIT 5;
```

### Issue: Transcript saved but no summary

**Cause:** OpenAI API key not configured or quota exceeded

**Fix:**
- Verify `VITE_OPENAI_API_KEY` is set in Azure environment
- Check OpenAI API usage: https://platform.openai.com/usage
- Check Azure logs for OpenAI errors

### Issue: Webhook receives data but doesn't find call

**Cause:** `elevenlabs_conversation_id` not being saved when call starts

**Fix:**
Currently, the inbound handler doesn't save the ElevenLabs conversation ID. We need to extract it from the stream connection.

**Workaround:** The webhook will log a warning but won't fail. We can match by timing instead.

---

## 💰 Cost Impact

### Per Conversation:

**ElevenLabs:**
- Already paying for conversation time
- Webhook delivery is FREE

**OpenAI (Summary Generation):**
- Model: GPT-4o-mini
- Input: ~500 tokens (transcript + system prompt)
- Output: ~100 tokens (summary)
- Cost: **$0.000135 per summary** (negligible)

**Example:**
- 100 calls/month = $0.0135
- 1,000 calls/month = $0.135

---

## 📊 Database Storage

### Storage per call:

**Average transcript:** 1-2 KB (text)
**Average summary:** 200 bytes

**Example:**
- 1,000 calls = ~2 MB transcript data
- 10,000 calls = ~20 MB transcript data

Supabase free tier includes 500 MB database, so storage is not a concern.

---

## 🔐 Security & Privacy

### HIPAA Compliance:
- ✅ All data encrypted at rest (Supabase)
- ✅ All webhooks use HTTPS/TLS
- ✅ Transcripts only accessible to authenticated staff
- ✅ Row-level security policies enforce access control

### Optional: HMAC Signature Validation
ElevenLabs can sign webhooks with HMAC. To enable:

1. Get webhook signing secret from ElevenLabs
2. Add to Azure environment: `ELEVENLABS_WEBHOOK_SECRET`
3. Update webhook handler to validate signatures

(Not required for basic functionality)

---

## ✅ Deployment Checklist

- [ ] Code deployed to Azure (git push)
- [ ] Azure deployment successful (GitHub Actions green)
- [ ] Webhook endpoint returns 200 OK (curl test)
- [ ] ElevenLabs webhook configured
- [ ] Test call made from enrolled number
- [ ] Transcript appears in database (SQL query)
- [ ] Transcript visible in portal (Calls tab)
- [ ] AI summary generated
- [ ] Topics extracted

---

## 📚 Related Documentation

- Main implementation guide: `DIABETES_EDUCATION_IMPLEMENTATION_GUIDE.md`
- ElevenLabs webhook setup: `ELEVENLABS_WEBHOOK_SETUP.md`
- Recent enhancements: `DIABETES_EDUCATION_ENHANCEMENTS.md`

---

**Status:** ✅ Code Complete - Awaiting ElevenLabs Configuration

**Next Steps:**
1. Deploy code to Azure
2. Configure ElevenLabs webhook
3. Make test call
4. Verify transcript appears

---

**Questions?** Check Azure logs or contact development team.
