# ElevenLabs Agent Tools Setup Guide

## Overview
This guide shows you how to configure your "Patient intake" ElevenLabs agent to capture structured medical data (medications, concerns, questions) in real-time BEFORE Zero Retention Mode redacts the transcripts.

## Why This Approach?
- ✅ **HIPAA Compliant**: Keeps ZRM enabled for privacy
- ✅ **Structured Data**: Gets organized clinical information, not raw transcripts
- ✅ **Real-Time Capture**: Data is stored during the call, before redaction
- ✅ **More Useful**: Medications list > raw transcript for clinical workflow

---

## Step 1: Configure Tools in ElevenLabs Dashboard

### A. Navigate to Your Agent
1. Go to: **https://elevenlabs.io/conversational-ai**
2. Click **"Agents"** in the left sidebar
3. Click on your **"Patient intake"** agent
4. Click the **"Tools"** tab

### B. Add Tool #1: Store Medications

Click **"Add Tool"** or **"Create Custom Tool"** and enter:

**Tool Name:** `store_medications`

**Description:**
```
Store the patient's current medications list. Call this function when the patient mentions their medications.
```

**URL:**
```
https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/previsit/data/medications
```

**Method:** `POST`

**Parameters (JSON Schema):**
```json
{
  "type": "object",
  "properties": {
    "conversation_id": {
      "type": "string",
      "description": "The current conversation ID"
    },
    "medications": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "List of medications (e.g., ['Metformin 500mg twice daily', 'Lisinopril 10mg once daily'])"
    }
  },
  "required": ["conversation_id", "medications"]
}
```

**When to call:**
- After the patient lists their medications
- When they mention "I'm taking..." or "My medications are..."

---

### C. Add Tool #2: Store Concerns

Click **"Add Tool"** again:

**Tool Name:** `store_concerns`

**Description:**
```
Store the patient's chief concerns or health issues. Call this function when the patient mentions what they want to discuss with their doctor.
```

**URL:**
```
https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/previsit/data/concerns
```

**Method:** `POST`

**Parameters (JSON Schema):**
```json
{
  "type": "object",
  "properties": {
    "conversation_id": {
      "type": "string",
      "description": "The current conversation ID"
    },
    "concerns": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "List of health concerns (e.g., ['High blood pressure', 'Morning dizziness', 'Weight gain'])"
    }
  },
  "required": ["conversation_id", "concerns"]
}
```

**When to call:**
- After patient describes their symptoms or concerns
- When they mention "I'm worried about..." or "I've been experiencing..."

---

### D. Add Tool #3: Store Questions

Click **"Add Tool"** again:

**Tool Name:** `store_questions`

**Description:**
```
Store questions the patient has for their provider. Call this function when the patient asks what they should ask their doctor.
```

**URL:**
```
https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/previsit/data/questions
```

**Method:** `POST`

**Parameters (JSON Schema):**
```json
{
  "type": "object",
  "properties": {
    "conversation_id": {
      "type": "string",
      "description": "The current conversation ID"
    },
    "questions": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "List of questions for the provider (e.g., ['Should I continue my medication?', 'What diet changes do you recommend?'])"
    }
  },
  "required": ["conversation_id", "questions"]
}
```

**When to call:**
- After patient lists their questions
- When they ask "Can I ask about..." or "I want to know..."

---

## Step 2: Update Agent Prompt

Go to the **"Prompt"** or **"Instructions"** section of your agent and add:

```
IMPORTANT: Use the tools to store information:

1. When the patient lists their medications, immediately call store_medications with the list.
2. When the patient describes their health concerns or symptoms, call store_concerns.
3. When the patient has questions for the doctor, call store_questions.

Always call these tools BEFORE moving to the next question, to ensure data is captured.
```

---

## Step 3: Test the Integration

### A. Make a Test Call
Call: **+1 (832) 402-7671**

### B. During the Call, Mention:
- **Medications**: "I'm taking Metformin 500mg twice daily and Lisinopril 10mg"
- **Concerns**: "I've been having high blood pressure and morning dizziness"
- **Questions**: "Should I adjust my medication? What diet changes do you recommend?"

### C. Check if Data Was Captured

After the call, check the Azure API logs or call:
```bash
curl "https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/previsit/session/{conversation_id}"
```

You should see:
```json
{
  "conversation_id": "conv_xxx",
  "medications": ["Metformin 500mg twice daily", "Lisinopril 10mg"],
  "concerns": ["High blood pressure", "Morning dizziness"],
  "questions": ["Should I adjust my medication?", "What diet changes?"]
}
```

---

## Step 4: View Captured Data

### In Your TSHLA Dashboard:
```
http://localhost:5173/previsit-conversations
```

The UI will show:
- ✅ Medications list
- ✅ Chief concerns
- ✅ Questions for provider
- ✅ Call metadata

**No raw transcript needed!** You have structured clinical data.

---

## Troubleshooting

### Tools Not Being Called?
1. Check agent prompt includes instructions to use tools
2. Verify URLs are correct (https://tshla-unified-api...)
3. Check Azure API logs for incoming requests
4. Make sure conversation_id is being passed automatically

### Data Not Showing Up?
1. Check Azure logs: `az containerapp logs show --name tshla-unified-api --resource-group tshla-backend-rg --tail 50`
2. Verify API endpoints are deployed to Azure
3. Test endpoints directly with curl

### Need Help?
- ElevenLabs Tools Documentation: https://elevenlabs.io/docs/conversational-ai/tools
- Check `elevenlabs-agent-tools-config.json` for exact configuration

---

## Next Steps

Once this is working:
1. **Add Database Storage**: Store data in Supabase instead of memory
2. **Link to Patient Records**: Match phone numbers to patient IDs
3. **Pre-populate Visit Notes**: Auto-fill doctor's notes with captured data
4. **Add Urgent Flags**: Detect concerning symptoms and alert staff

---

## Summary

✅ **API Endpoints Created** (already deployed)
✅ **Tool Configuration Ready** (use this guide)
⏳ **Configure in ElevenLabs** (follow Step 1 above)
⏳ **Test** (make a call and verify data capture)

**Result**: Structured medical data captured in real-time, HIPAA-compliant, no raw transcripts needed!
