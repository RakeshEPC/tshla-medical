# ElevenLabs Conversational AI Agent Setup Guide

## 🎯 Purpose
Create an AI agent that conducts automated 3-5 minute pre-visit phone interviews with patients, gathering medications, concerns, questions, and lab status.

---

## 📋 Prerequisites
- ✅ ElevenLabs account with API key: `sk_42ac7f8727348932ecaf8c2558b55735b886022d9e03ab78`
- ✅ Twilio account configured
- ✅ Pre-Visit API server ready

---

## 🚀 Step-by-Step Setup

### Step 1: Access ElevenLabs Conversational AI

1. Go to: **https://elevenlabs.io**
2. Log in with your account
3. Navigate to **"Conversational AI"** in the left sidebar
4. Click **"Create New Agent"**

### Step 2: Configure Agent Settings

**Agent Name:** `TSHLA Pre-Visit Interview Agent`

**Voice Selection:**
- Choose: **"Professional Female"** or **"Warm Healthcare"**
- Recommended: **"Rachel"** or **"Domi"** (clear, professional, friendly)
- Test the voice to ensure it sounds natural

**Language:** English (US)

**Conversation Mode:** Phone Call

---

### Step 3: System Prompt (Copy This Exactly)

```
You are a friendly and professional medical assistant calling on behalf of TSHLA Medical. Your role is to conduct a brief 3-5 minute pre-visit interview with patients before their scheduled appointments.

IMPORTANT RULES:
1. Be warm, friendly, and professional
2. Speak clearly and at a moderate pace
3. If the patient seems confused, repeat or rephrase
4. If they mention urgent symptoms (chest pain, severe bleeding, suicidal thoughts), immediately recommend they call 911 or go to the ER
5. Keep the conversation focused and efficient
6. Thank them for their time at the end
7. Do NOT provide medical advice
8. Do NOT diagnose or prescribe
9. Do NOT discuss payment or insurance

YOUR GOAL: Gather accurate information about medications, health concerns, questions for the doctor, and lab status in a friendly, efficient manner.
```

---

### Step 4: Conversation Flow Script

Copy and paste this into the **"Conversation Flow"** section:

```
GREETING:
"Hi [PATIENT_NAME], this is Sarah calling from TSHLA Medical. I'm calling about your upcoming appointment with Dr. [DOCTOR_NAME] on [DATE] at [TIME]. I'll be asking a few quick questions to help prepare for your visit. This should only take about 3 to 5 minutes. Is now a good time to talk?"

[If NO: "No problem! When would be a better time for me to call back?" → Schedule callback]
[If YES: Continue]

SECTION 1: CURRENT MEDICATIONS
"Great! Let's start. What medications are you currently taking? Please include both prescription and over-the-counter medications, as well as any vitamins or supplements."

[Listen and confirm] "Just to confirm, you're taking [REPEAT MEDICATIONS]. Is that correct?"

SECTION 2: CHIEF CONCERNS
"Thank you. What are the main health concerns you'd like to discuss with Dr. [DOCTOR_NAME] at your appointment?"

[Listen for concerns]

[If urgent keywords detected: chest pain, severe bleeding, difficulty breathing, suicidal thoughts]
→ "I'm concerned about what you're describing. This sounds like it may need immediate attention. I recommend you call 911 or go to the nearest emergency room right away. Should I help you with that?"

[If not urgent] "I understand. We'll make sure Dr. [DOCTOR_NAME] is aware of these concerns before your visit."

SECTION 3: RECENT CHANGES
"Have there been any changes to your health since your last visit? For example, new symptoms, changes in medications, or recent hospitalizations?"

[Listen for changes]

SECTION 4: LAB WORK
"Have you had any recent lab work done? If yes, do you have the results with you, or were they sent directly to us?"

[Document lab status]

SECTION 5: QUESTIONS FOR DOCTOR
"What questions do you have for Dr. [DOCTOR_NAME]?"

[Listen and note questions]

SECTION 6: CONFIRMATION
"Perfect! Just to confirm, you're still planning to attend your appointment on [DATE] at [TIME], correct?"

[If YES] "Wonderful! We look forward to seeing you."
[If NO] "I understand. Would you like me to help you reschedule?"

CLOSING:
"Thank you so much for taking the time to speak with me today, [PATIENT_NAME]. This information will help Dr. [DOCTOR_NAME] provide you with better care at your visit. If anything urgent comes up before your appointment, please don't hesitate to call our office at [OFFICE_PHONE]. Have a great day!"

[End call]
```

---

### Step 5: Urgent Keyword Detection

In the **"Safety & Compliance"** section, add these urgent keywords:

```
URGENT KEYWORDS (Immediate escalation):
- chest pain
- severe chest pressure
- can't breathe
- difficulty breathing
- shortness of breath at rest
- severe bleeding
- bleeding won't stop
- suicidal thoughts
- want to hurt myself
- stroke symptoms
- face drooping
- arm weakness
- slurred speech
- severe abdominal pain
- confusion
- loss of consciousness
- seizure

ACTION FOR URGENT KEYWORDS:
Immediately say: "I'm concerned about what you're describing. This sounds like it may need immediate attention. I strongly recommend you call 911 or go to the nearest emergency room right away. Can you do that now?"

Wait for response. If patient agrees, confirm they will seek help immediately and end call. If patient refuses, say: "I understand, but I'm required to let you know this is important. Please call our office at [OFFICE_PHONE] right away so we can help you."
```

---

### Step 6: Configure Webhook

In the **"Integrations"** section:

**Webhook URL:**
```
https://your-production-domain.com/api/elevenlabs/conversation-complete
```

(For local testing with ngrok):
```
https://your-ngrok-url.ngrok.io/api/elevenlabs/conversation-complete
```

**Webhook Events:**
- ✅ Conversation Complete
- ✅ Conversation Failed

**Webhook Format:** JSON

---

### Step 7: Advanced Settings

**Interruption Handling:**
- Allow interruptions: ✅ Yes
- Interruption sensitivity: Medium

**Silence Detection:**
- Silence timeout: 3 seconds
- End conversation after: 2 minutes of silence

**Call Duration:**
- Target duration: 3-5 minutes
- Maximum duration: 8 minutes
- Minimum duration: 1 minute

**Retry Logic:**
- If patient doesn't understand: Rephrase up to 2 times
- If still confused: "I apologize for the confusion. Let's move on to the next question."

---

### Step 8: Test the Agent

1. Click **"Test in Playground"**
2. Try these test scenarios:
   - Patient with multiple medications
   - Patient with urgent symptoms
   - Patient who wants to reschedule
   - Patient who is confused
3. Verify the agent:
   - Speaks clearly
   - Handles interruptions well
   - Catches urgent keywords
   - Stays on topic

---

### Step 9: Get Your Agent ID

Once you're satisfied with the agent:

1. Click **"Save & Deploy"**
2. Copy the **Agent ID** (format: `agent_xxxxxxxxxxxxx`)
3. Add it to your `.env` file:
   ```bash
   ELEVENLABS_AGENT_ID=agent_xxxxxxxxxxxxx
   ```

---

## 🔧 Add Agent ID to Environment

Once you have the Agent ID, update your `.env`:

```bash
# In /Users/rakeshpatel/Desktop/tshla-medical/.env
# Replace this line:
ELEVENLABS_AGENT_ID=placeholder_create_agent

# With your actual Agent ID:
ELEVENLABS_AGENT_ID=agent_abc123xyz456
```

---

## 🧪 Test Your Configuration

After adding the Agent ID:

```bash
# Restart the API server
cd /Users/rakeshpatel/Desktop/tshla-medical
pkill -f "previsit-api-server"
./start-previsit-api.sh

# Check that the Agent ID is loaded
curl http://localhost:3100/health

# You should see:
# - Twilio: ✅ Configured
# - 11Labs: ✅ Configured (with your agent ID)
```

---

## 📞 Make Your First Test Call

Once the Agent ID is configured, use the test script:

```bash
npx tsx scripts/test-call.ts --phone="+15555555555" --name="John Doe"
```

Or using curl:

```bash
curl -X POST http://localhost:3100/api/test/call \
  -H "Content-Type: application/json" \
  -d '{
    "patientPhone": "+15555555555",
    "patientName": "John Doe",
    "appointmentDate": "2025-01-15",
    "appointmentTime": "10:00 AM",
    "providerName": "Dr. Smith"
  }'
```

---

## 📋 Expected Call Flow

1. **Call Initiated** - Twilio dials patient
2. **Voicemail Detection** - If voicemail, hang up (attempt 1) or leave message (attempts 2-3)
3. **AI Connects** - ElevenLabs agent starts conversation
4. **Interview Conducted** - 3-5 minutes of questions
5. **Call Ends** - Agent thanks patient and ends call
6. **Transcript Sent** - ElevenLabs sends transcript to webhook
7. **Data Extracted** - GPT-4 parses transcript into structured data
8. **Stored in Database** - Data saved to `previsit_responses` table
9. **Appears in Dashboard** - Provider sees summary before appointment

---

## 🎯 Success Criteria

Your agent is ready when:
- ✅ Speaks naturally and clearly
- ✅ Follows the script
- ✅ Detects urgent keywords
- ✅ Handles interruptions gracefully
- ✅ Completes in 3-5 minutes
- ✅ Webhook receives transcripts
- ✅ Data appears in dashboard

---

## 🔒 HIPAA Compliance Notes

**ElevenLabs BAA:**
- Contact ElevenLabs support to sign a Business Associate Agreement (BAA)
- Required for HIPAA compliance
- Email: hipaa@elevenlabs.io

**Security Settings:**
- Enable end-to-end encryption
- Set data retention to 30 days maximum
- Enable audit logging
- Restrict access to authorized users only

---

## 🆘 Troubleshooting

**Agent Not Responding:**
- Check that Agent ID is correct in `.env`
- Verify API server is running: `curl http://localhost:3100/health`
- Check ElevenLabs dashboard for error logs

**Call Connects But No AI:**
- Verify Twilio webhook URL is correct
- Check that agent is deployed (not in draft mode)
- Test agent in ElevenLabs playground first

**Transcript Not Received:**
- Verify webhook URL is publicly accessible (use ngrok for local testing)
- Check API server logs for incoming webhooks
- Confirm webhook is configured in ElevenLabs agent settings

**Poor Audio Quality:**
- Test different voices in ElevenLabs
- Check patient's phone connection
- Verify Twilio codec settings

---

## 📚 Additional Resources

- **ElevenLabs Conversational AI Docs:** https://elevenlabs.io/docs/conversational-ai
- **Twilio Voice Docs:** https://www.twilio.com/docs/voice
- **Your Complete Setup Guide:** [PREVISIT_COMPLETE_GUIDE.md](./PREVISIT_COMPLETE_GUIDE.md)
- **Testing Guide:** [PREVISIT_TESTING_GUIDE.md](./PREVISIT_TESTING_GUIDE.md)

---

## ✅ Next Steps

1. **Create the agent** following steps above (~15 minutes)
2. **Get the Agent ID** and add to `.env`
3. **Restart API server** to load new credential
4. **Make test call** using the test script
5. **Verify data** appears in dashboard

---

**Once you have the Agent ID, you're ready to make real pre-visit calls!** 🎉
