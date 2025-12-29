# ElevenLabs Agent Configuration - Patient Context Fix

## What Changed

The diabetes education system now passes patient medical data and clinical notes to the ElevenLabs AI agent during phone calls. Previously, the agent was running with NO patient information.

## Required: Update ElevenLabs Agent System Prompt

You need to update your ElevenLabs diabetes education agent(s) to reference the `patient_context` variable that is now being passed.

### Current Agent Setup
Your agent currently has a system prompt like:
```
You are a compassionate diabetes educator AI assistant...
```

### **NEW System Prompt** (Updated)

Go to [ElevenLabs Conversational AI](https://elevenlabs.io/app/conversational-ai) and update your agent's system prompt to:

```
You are a compassionate diabetes educator AI assistant.

PATIENT INFORMATION:
{patient_context}

The patient information above includes:
- Clinical notes and special instructions from their healthcare team
- Focus areas to emphasize (e.g., weight loss, insulin technique)
- Current medications and dosages
- Recent lab results (A1C, glucose levels, etc.)
- Diagnoses and medical conditions
- Allergies

Guidelines:
1. Always reference the patient's actual medical data when answering questions
2. If asked "What is my A1C?", look in the Lab Results section above
3. If asked about medications, reference the Medications section above
4. Pay special attention to the Clinical Notes - these contain important instructions from the care team
5. Focus on the specified Focus Areas during the conversation
6. Speak in a warm, empathetic, and patient-friendly tone
7. At 8 minutes, say: "We have about 2 minutes left. Is there anything else I can help you with?"
8. At 10 minutes, say: "Our time is up for this consultation. Feel free to call back anytime. Take care!"
9. For urgent medical issues, say: "This sounds urgent. Please contact your doctor immediately or go to the emergency room."
10. Never diagnose new conditions or prescribe medications
11. If information is missing from the patient data, encourage them to speak with their healthcare provider
12. If the patient asks about something not in their records, say: "I don't see that information in your current medical records. Let me help you with what I do have..."

Language: English (or Spanish/French for other agents)
```

### Update ALL Language Agents

If you have multiple language agents (English, Spanish, French), update each one:

1. **English Agent**: Use prompt above
2. **Spanish Agent**: Translate the prompt to Spanish
3. **French Agent**: Translate the prompt to French

**IMPORTANT**: The `{patient_context}` variable placeholder must be in the system prompt for the custom data to be injected!

## How It Works Now

### Before (Broken):
```
User calls → Twilio → ElevenLabs Agent (NO patient data)
AI: "I don't have access to your medical records"
```

### After (Fixed):
```
User calls → Twilio → Backend fetches patient data
           → Builds context string with clinical notes + medical data
           → Passes to ElevenLabs via custom_llm_extra_body
           → Agent receives {patient_context}
AI: "I see your A1C was 7.2% on your last test..."
```

## What Gets Passed in `patient_context`

Example of what the AI will receive:

```
Clinical Notes and Instructions:
Focus on weight loss strategies. Patient recently started metformin and needs education on proper timing with meals.

--- Call on Dec 28, 2024 ---
Patient asked about carb counting. Provided basic 15g carb examples.
Concerns: Experiencing afternoon energy crashes
Progress: Successfully reduced A1C from 8.1% to 7.2%
Action items: Start food diary; Schedule follow-up with dietitian

Focus Areas: Weight Loss, Carb Counting, Medication Adherence

Medications:
  - Metformin 500mg twice daily with meals
  - Insulin glargine 20 units at bedtime

Lab Results:
  - a1c: 7.2 % (2024-11-15)
  - glucose_fasting: 135 mg/dL (2024-11-20)

Diagnoses: Type 2 Diabetes Mellitus, Diabetic Neuropathy

ALLERGIES: Penicillin
```

## Testing After Deployment

1. **Update clinical notes** for a test patient at https://www.tshla.ai/diabetes-education
   - Add something like: "Patient's A1C is 7.5%. Focus on diet and exercise."

2. **Deploy the code** (commit and push)

3. **Call 832-400-3930** from your registered number

4. **Ask the AI**: "What is my A1C?"

5. **Expected response**: "I see your A1C was 7.5%..." (using your updated notes)

## Troubleshooting

### If AI still says "I don't have access to your records":

1. **Check ElevenLabs agent prompt**: Make sure `{patient_context}` is in the system prompt
2. **Check Azure logs**:
   ```bash
   az containerapp logs show --name tshla-unified-api --resource-group tshla-rg --tail 50 | grep "DiabetesEdu"
   ```
   Look for: `📋 Patient context prepared: Length: XXX characters`

3. **Verify patient has data**: Check database that `clinical_notes` or `medical_data` exists
4. **Check ElevenLabs API response**: If API returns error, logs will show it

### If ElevenLabs API rejects the request:

The `custom_llm_extra_body` parameter might not be supported in your ElevenLabs plan. Alternative approach:

**Option B: Use WebSocket metadata instead**
This requires modifying the code to use the WebSocket stream with custom headers instead of signed URL. Let me know if Option A doesn't work.

## Deployment Checklist

- [ ] Update ElevenLabs agent system prompt to include `{patient_context}`
- [ ] Commit and push code changes
- [ ] Wait for GitHub Actions deployment (~10 mins)
- [ ] Update clinical notes for test patient
- [ ] Call test number and verify AI uses updated notes
- [ ] Monitor Azure logs for any errors

---

**Files Modified:**
- `server/api/twilio/diabetes-education-inbound.js` (added patient context injection)

**Next Steps:**
1. Update ElevenLabs agent configuration (above)
2. Deploy code to Azure
3. Test by calling and asking about A1C or medications
