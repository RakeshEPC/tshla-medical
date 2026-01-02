# ElevenLabs Agent Configuration - Complete Setup Instructions

**Date:** December 30, 2025
**For:** Diabetes Education Phone System (832-400-3930)

---

## Overview

This guide walks you through configuring your ElevenLabs Conversational AI agents to work with the TSHLA diabetes education phone system.

**Why this is necessary:**
- The system passes patient-specific medical data to the AI during calls
- The AI needs to be configured to receive and use this data via the `{{patient_context}}` variable
- Without this configuration, the AI will not have access to patient records

---

## Step 1: Access Your ElevenLabs Agents

1. Go to [ElevenLabs Conversational AI Dashboard](https://elevenlabs.io/app/conversational-ai)

2. You should see your three diabetes education agents:
   - **English Diabetes Educator**
   - **Spanish Diabetes Educator** (Educador de Diabetes)
   - **Hindi Diabetes Educator** (मधुमेह शिक्षक)

3. If you don't see these agents, create them first (see "Creating New Agents" section below)

---

## Step 2: Configure English Agent

1. **Click on "English Diabetes Educator"**

2. **Copy the Agent ID** from the URL (format: `agent_XXXXXX...`)
   - Example: `agent_6101kbk0qsmfefftpw6sf9k0wfyb`
   - Save this - you'll need it for Azure configuration

3. **Update System Prompt:**

   Click on the "System Prompt" or "Instructions" section and **replace the entire content** with:

   ```
   You are a diabetes educator AI assistant.

   PATIENT INFORMATION:
   {{patient_context}}

   The patient information above includes their clinical notes, medications, lab results, diagnoses, allergies, and focus areas.

   Guidelines:
   1. **Be concise and direct - get to the answer quickly**
   2. When asked about lab values, state them directly: "Your A1C is 8.7%"
   3. When asked about medications, list them briefly
   4. Skip unnecessary preambles like "according to your notes" or "let me check" - just answer
   5. Keep responses under 3 sentences unless the patient asks for more detail
   6. Use the patient's actual data from the PATIENT INFORMATION section above
   7. Pay attention to Clinical Notes for special instructions from their care team
   8. Focus on their specified Focus Areas during conversation
   9. Be warm but brief - conversational without rambling
   10. At 8 minutes: "We have 2 minutes left. Anything else?"
   11. At 10 minutes: "Time's up. Call back anytime. Take care."
   12. For urgent issues: "This sounds urgent. Contact your doctor now or go to the ER."
   13. Never diagnose new conditions or prescribe medications
   14. If data is missing: "I don't have that in your records. Ask your provider about it."

   Be helpful, friendly, and efficient. Answer quickly and only elaborate if asked.
   ```

4. **CRITICAL CHECK:** Verify `{{patient_context}}` appears with **double braces** `{{}}`, NOT single braces `{}`

5. **Voice Settings:**
   - Voice: Choose a friendly, conversational female voice (e.g., Jessica, Rachel)
   - Language: English (US)
   - Stability: 50-70%
   - Similarity: 70-80%

6. **First Message (Optional):**
   ```
   Hello! I'm your diabetes educator. I have your medical information in front of me. What questions can I help you with today?
   ```

7. **Click Save**

---

## Step 3: Configure Spanish Agent

1. **Click on "Spanish Diabetes Educator"** (or create it - see below)

2. **Copy the Agent ID** and save it

3. **Update System Prompt** (Spanish translation):

   ```
   Eres un asistente de inteligencia artificial educador de diabetes.

   INFORMACIÓN DEL PACIENTE:
   {{patient_context}}

   La información del paciente anterior incluye sus notas clínicas, medicamentos, resultados de laboratorio, diagnósticos, alergias y áreas de enfoque.

   Pautas:
   1. **Sé conciso y directo - llega a la respuesta rápidamente**
   2. Cuando se te pregunte sobre valores de laboratorio, indícalos directamente: "Tu A1C es 8.7%"
   3. Cuando se te pregunte sobre medicamentos, enuméralos brevemente
   4. Omite preámbulos innecesarios como "según tus notas" o "déjame verificar" - solo responde
   5. Mantén las respuestas en menos de 3 oraciones a menos que el paciente pida más detalles
   6. Usa los datos reales del paciente de la sección INFORMACIÓN DEL PACIENTE anterior
   7. Presta atención a las Notas Clínicas para instrucciones especiales del equipo de atención
   8. Enfócate en sus Áreas de Enfoque especificadas durante la conversación
   9. Sé cálido pero breve - conversacional sin divagar
   10. A los 8 minutos: "Nos quedan 2 minutos. ¿Algo más en qué pueda ayudarte?"
   11. A los 10 minutos: "Se acabó nuestro tiempo. Llama cuando quieras. ¡Cuídate!"
   12. Para problemas urgentes: "Esto suena urgente. Contacta a tu doctor ahora o ve a urgencias."
   13. Nunca diagnostiques nuevas condiciones ni recetes medicamentos
   14. Si faltan datos: "No tengo esa información en tus registros. Pregunta a tu proveedor."

   Sé servicial, amable y eficiente. Responde rápidamente y solo elabora si te lo piden.
   ```

4. **Voice Settings:**
   - Voice: Choose a Spanish voice (e.g., Maria, Valentina)
   - Language: Spanish (US or Latin American)

5. **First Message:**
   ```
   ¡Hola! Soy tu educador de diabetes. Tengo tu información médica aquí. ¿En qué puedo ayudarte hoy?
   ```

6. **Click Save**

---

## Step 4: Configure Hindi Agent

1. **Click on "Hindi Diabetes Educator"** (or create it)

2. **Copy the Agent ID** and save it

3. **Update System Prompt** (Hindi translation):

   ```
   आप एक मधुमेह शिक्षक AI सहायक हैं।

   रोगी की जानकारी:
   {{patient_context}}

   उपरोक्त रोगी की जानकारी में उनके क्लिनिकल नोट्स, दवाएं, लैब परिणाम, निदान, एलर्जी और फोकस क्षेत्र शामिल हैं।

   दिशानिर्देश:
   1. **संक्षिप्त और सीधे रहें - जल्दी उत्तर दें**
   2. जब लैब मानों के बारे में पूछा जाए, उन्हें सीधे बताएं: "आपका A1C 8.7% है"
   3. जब दवाओं के बारे में पूछा जाए, उन्हें संक्षेप में सूचीबद्ध करें
   4. अनावश्यक प्रस्तावना जैसे "आपके नोट्स के अनुसार" या "मुझे जांचने दें" छोड़ें - बस उत्तर दें
   5. जब तक रोगी अधिक विवरण न मांगे, उत्तर को 3 वाक्यों से कम रखें
   6. रोगी की जानकारी अनुभाग से रोगी के वास्तविक डेटा का उपयोग करें
   7. देखभाल टीम से विशेष निर्देशों के लिए क्लिनिकल नोट्स पर ध्यान दें
   8. बातचीत के दौरान उनके निर्दिष्ट फोकस क्षेत्रों पर ध्यान केंद्रित करें
   9. गर्मजोशी से लेकिन संक्षिप्त रहें - बातूनी हुए बिना बातचीत करें
   10. 8 मिनट पर: "हमारे पास 2 मिनट बचे हैं। कुछ और?"
   11. 10 मिनट पर: "हमारा समय समाप्त हो गया है। कभी भी कॉल करें। अपना ख्याल रखें!"
   12. तत्काल मुद्दों के लिए: "यह तत्काल लगता है। अभी अपने डॉक्टर से संपर्क करें या ER जाएं।"
   13. नई स्थितियों का निदान न करें और न ही दवाएं लिखें
   14. यदि डेटा गायब है: "मेरे पास आपके रिकॉर्ड में यह जानकारी नहीं है। अपने प्रदाता से पूछें।"

   मददगार, मैत्रीपूर्ण और कुशल रहें। जल्दी उत्तर दें और केवल अनुरोध पर विस्तार करें।
   ```

4. **Voice Settings:**
   - Voice: Choose a Hindi voice
   - Language: Hindi (IN)

5. **First Message:**
   ```
   नमस्ते! मैं आपका मधुमेह शिक्षक हूं। मेरे पास आपकी चिकित्सा जानकारी है। आज मैं आपकी कैसे मदद कर सकता हूं?
   ```

6. **Click Save**

---

## Step 5: Collect Agent IDs

After configuring all three agents, collect their IDs:

1. English Agent ID: `agent_________________`
2. Spanish Agent ID: `agent_________________`
3. Hindi Agent ID: `agent_________________`

You'll need these for the next step.

---

## Step 6: Update Azure Configuration

### Option A: Using the Update Script (Recommended)

1. **Update your local `.env` file** with the agent IDs:

   ```bash
   # Add or update these lines in /Users/rakeshpatel/Desktop/tshla-medical/.env
   ELEVENLABS_DIABETES_AGENT_EN=agent_YOUR_ENGLISH_ID
   ELEVENLABS_DIABETES_AGENT_ES=agent_YOUR_SPANISH_ID
   ELEVENLABS_DIABETES_AGENT_HI=agent_YOUR_HINDI_ID
   ```

2. **Run the update script:**

   ```bash
   cd /Users/rakeshpatel/Desktop/tshla-medical
   ./update-azure-elevenlabs-config.sh
   ```

3. **Wait 2-3 minutes** for Azure to deploy the new configuration

### Option B: Manual Azure CLI Update

```bash
# Update agent IDs
az containerapp secret set \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --secrets \
    elevenlabs-diabetes-agent-en="agent_YOUR_ENGLISH_ID" \
    elevenlabs-diabetes-agent-es="agent_YOUR_SPANISH_ID" \
    elevenlabs-diabetes-agent-hi="agent_YOUR_HINDI_ID"

# Restart container
az containerapp update \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --set-env-vars "CONFIG_UPDATED=$(date +%s)"
```

---

## Step 7: Configure Webhook for Transcripts

1. Go to [ElevenLabs Settings](https://elevenlabs.io/app/settings)

2. Find **"Webhooks"** or **"Platform Settings"**

3. Add a new webhook:
   - **URL:** `https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/elevenlabs/diabetes-education-transcript`
   - **Method:** POST
   - **Event Type:** Transcription / Post-call

4. Enable the webhook

5. **Save**

This webhook will capture call transcripts and save them to the database with AI-generated summaries.

---

## Step 8: Test the Configuration

### Test 1: Run Diagnostic Script

```bash
cd /Users/rakeshpatel/Desktop/tshla-medical
./test-diabetes-phone-system.sh
```

All tests should pass.

### Test 2: Make a Test Call

1. **From phone number:** +18326073630 (must be registered in database)
2. **Dial:** 832-400-3930
3. **Expected:**
   - AI answers: "Hello! I'm your diabetes educator..."
   - NOT: "We're sorry, but our diabetes educator AI is not available"

### Test 3: Test Patient Context

During the call:

1. **Ask:** "What is my A1C?"
2. **Expected:** AI should state the actual A1C from clinical notes (e.g., "Your A1C is 8.7%")
3. **Ask:** "What medications am I taking?"
4. **Expected:** AI should list actual medications from patient record

### Test 4: Check Logs

```bash
az containerapp logs show \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --tail 100 --follow
```

During a call, you should see:
- `📞 [DiabetesEdu] Incoming call received`
- `✅ [DiabetesEdu] Patient authenticated`
- `📋 Patient context prepared: Length: XXX characters`
- `✅ ElevenLabs register_call response received`

### Test 5: Verify Transcript Saved

After the call, check the database:

```sql
SELECT
  call_started_at,
  duration_seconds,
  LENGTH(transcript) as transcript_length,
  summary
FROM diabetes_education_calls
ORDER BY call_started_at DESC
LIMIT 1;
```

You should see:
- Call duration
- Full transcript (formatted as "AI: ..." and "Patient: ...")
- AI-generated summary

---

## Creating New Agents (If Needed)

If you need to create new agents from scratch:

### 1. Create English Agent

1. Go to [ElevenLabs Conversational AI](https://elevenlabs.io/app/conversational-ai)
2. Click **"Create Agent"**
3. **Name:** English Diabetes Educator
4. **Language:** English (US)
5. **Voice:** Choose a friendly female voice
6. **System Prompt:** Copy from "Step 2" above
7. **First Message:** "Hello! I'm your diabetes educator..."
8. **Save** and copy the Agent ID

### 2. Create Spanish Agent

1. Click **"Create Agent"**
2. **Name:** Spanish Diabetes Educator
3. **Language:** Spanish (US)
4. **Voice:** Choose a Spanish voice
5. **System Prompt:** Copy Spanish prompt from "Step 3" above
6. **First Message:** "¡Hola! Soy tu educador de diabetes..."
7. **Save** and copy the Agent ID

### 3. Create Hindi Agent

1. Click **"Create Agent"**
2. **Name:** Hindi Diabetes Educator
3. **Language:** Hindi (IN)
4. **Voice:** Choose a Hindi voice
5. **System Prompt:** Copy Hindi prompt from "Step 4" above
6. **First Message:** "नमस्ते! मैं आपका मधुमेह शिक्षक हूं..."
7. **Save** and copy the Agent ID

---

## Troubleshooting

### Issue: "AI is not available" error on call

**Check:**
1. Agent IDs are correct in Azure secrets
2. ElevenLabs API key is valid
3. Azure logs show the specific error
4. Agent still exists in ElevenLabs dashboard

### Issue: AI says "I don't have access to your records"

**Fix:**
- Verify `{{patient_context}}` (with double braces) is in the system prompt
- Check Azure logs to confirm patient context is being sent
- Test with a patient that has clinical notes or medical data

### Issue: No transcript saved after call

**Fix:**
- Verify webhook is configured in ElevenLabs settings
- Test webhook endpoint manually (see troubleshooting guide)
- Check Azure logs for webhook errors

---

## Summary Checklist

Before going live, verify:

- [ ] All three agents created in ElevenLabs
- [ ] System prompts include `{{patient_context}}` variable
- [ ] Agent IDs collected and saved
- [ ] Local `.env` file updated with agent IDs
- [ ] Azure secrets updated with agent IDs
- [ ] Azure container restarted
- [ ] Webhook configured in ElevenLabs
- [ ] Diagnostic tests pass
- [ ] Test call succeeds
- [ ] AI uses actual patient data in responses
- [ ] Transcript saved to database after call

---

## Additional Resources

- [DIABETES_PHONE_TROUBLESHOOTING_GUIDE.md](DIABETES_PHONE_TROUBLESHOOTING_GUIDE.md) - Comprehensive troubleshooting
- [ELEVENLABS_WEBHOOK_SETUP.md](ELEVENLABS_WEBHOOK_SETUP.md) - Webhook configuration details
- [ELEVENLABS_AGENT_PROMPT_FINAL.md](ELEVENLABS_AGENT_PROMPT_FINAL.md) - Final agent prompt (English only)
- [test-diabetes-phone-system.sh](test-diabetes-phone-system.sh) - Automated diagnostic tests
- [update-azure-elevenlabs-config.sh](update-azure-elevenlabs-config.sh) - Azure update automation

---

**Last Updated:** December 30, 2025
**Version:** 1.0
