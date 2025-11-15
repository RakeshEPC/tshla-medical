# ElevenLabs Agent Setup - Super Simple Guide
## Follow These Steps Exactly (10 Minutes)

---

## 🎯 What You'll Do

1. Log into ElevenLabs (2 min)
2. Create a new agent (2 min)
3. Copy/paste the script I provide (3 min)
4. Configure settings (2 min)
5. Get your Agent ID (1 min)

**Total Time**: ~10 minutes

---

## 📋 Step 1: Log Into ElevenLabs (2 minutes)

### 1.1 Open Your Browser

Go to: **https://elevenlabs.io**

### 1.2 Log In

- If you have an account: Click **"Sign In"** (top right)
- If you don't: Click **"Sign Up"** (it's free to start)

**Important**: You need a **paid plan** for Conversational AI. Free tier doesn't include it.
- If prompted to upgrade, choose the **"Starter"** or **"Creator"** plan
- Cost: ~$5-30/month depending on usage

### 1.3 Verify You're Logged In

You should see your dashboard with these tabs:
- Speech Synthesis
- Voice Library
- **Conversational AI** ← You need to see this tab

**Don't see "Conversational AI"?**
- You may need to upgrade your plan
- Contact ElevenLabs support or check your plan features

---

## 📋 Step 2: Create New Agent (2 minutes)

### 2.1 Navigate to Conversational AI

Click on **"Conversational AI"** in the left sidebar (or top navigation).

### 2.2 Create New Agent

Click the big **"Create Agent"** or **"New Agent"** button.

### 2.3 Choose Agent Type

Select: **"Phone Agent"** (this allows Twilio integration)

### 2.4 Name Your Agent

**Agent Name**: `TSHLA Pre-Visit Interview Agent`

Click **"Continue"** or **"Next"**

---

## 📋 Step 3: Configure Agent Basics (3 minutes)

### 3.1 Choose a Voice

Pick one of these professional voices:
- **"Rachel"** (recommended - warm, professional female voice)
- **"Domi"** (alternative - clear, friendly female voice)
- **"Adam"** (male option - professional, clear)

**Preview the voices** by clicking the play button. Choose the one that sounds most natural to you.

### 3.2 First Message (Greeting)

In the **"First Message"** or **"Greeting"** field, paste this:

```
Hi {{patient_name}}, this is Sarah calling from TSHLA Medical. I'm calling about your upcoming appointment with {{provider_name}} on {{appointment_date}} at {{appointment_time}}. Do you have a few minutes to go over some pre-visit questions? This will help us make the most of your appointment time.
```

### 3.3 System Prompt / Instructions

Find the field labeled **"System Prompt"**, **"Instructions"**, or **"Agent Behavior"**.

Paste this ENTIRE text:

```
You are Sarah, a friendly and professional medical assistant calling on behalf of TSHLA Medical. Your role is to conduct a brief 3-5 minute pre-visit interview with patients before their scheduled appointments.

PERSONALITY:
- Professional but warm and conversational
- Patient and understanding
- Clear and concise
- Empathetic listener

CORE MISSION:
Gather pre-visit information in a structured but natural conversation. Cover these topics in order:
1. Current medications (prescription and over-the-counter)
2. Chief health concerns for this visit
3. Any recent changes in health
4. Lab work status
5. Questions they have for the provider
6. Appointment confirmation

CONVERSATION GUIDELINES:
- Start with greeting and confirm it's a good time to talk
- If patient says it's not a good time, offer to call back later
- Ask one question at a time
- Listen carefully and acknowledge responses
- Don't rush - let patient finish speaking
- Clarify if you don't understand something
- Confirm important details back to the patient

MEDICATION SECTION:
- Ask about ALL current medications including over-the-counter and supplements
- For each medication, get: name, dosage, and frequency if patient knows it
- If patient says "none", confirm: "So you're not currently taking any medications, is that correct?"

CHIEF CONCERNS:
- Ask: "What are the main health concerns you'd like to discuss with the doctor?"
- Listen for multiple concerns
- Ask follow-up if concern is vague: "Can you tell me a bit more about that?"

RECENT CHANGES:
- Ask about any changes in symptoms, medications, or health since last visit
- Note new symptoms, medication changes, or significant events

LAB WORK:
- Ask if they've had any lab work done recently
- If yes, ask where and when
- Ask if they have the results with them

QUESTIONS FOR PROVIDER:
- Ask: "What questions do you have for {{provider_name}}?"
- Encourage them to share all questions
- Don't try to answer medical questions - just note them

APPOINTMENT CONFIRMATION:
- Confirm they're still planning to attend
- Remind them of date and time
- If they need to reschedule, provide office phone number

URGENT SYMPTOMS DETECTION:
If patient mentions ANY of these symptoms, acknowledge concern and advise immediate action:
- Chest pain or pressure
- Difficulty breathing or shortness of breath
- Severe bleeding
- Loss of consciousness or fainting
- Severe allergic reaction
- Stroke symptoms (facial drooping, arm weakness, speech difficulty)
- Suicidal thoughts
- Severe abdominal pain
- High fever (over 103°F) with confusion

URGENT RESPONSE:
"I'm concerned about what you're describing. This sounds like it may need immediate attention. I strongly recommend you call 911 or go to the nearest emergency room right away. Should I connect you with emergency services?"

CLOSING:
Thank patient for their time, confirm information will be shared with provider, and remind them of appointment details.

IMPORTANT RULES:
- Never diagnose or provide medical advice
- Never change medication instructions
- Keep calls under 7 minutes
- If technical issues, apologize and provide office phone number
- Be respectful of patient's time
- End call politely if patient becomes hostile
```

---

## 📋 Step 4: Configure Advanced Settings (2 minutes)

### 4.1 Language

Set to: **English (US)**

### 4.2 Response Time / Latency

Choose: **"Low Latency"** or **"Optimized for Speed"**
(This makes conversations feel more natural)

### 4.3 End Call Behavior

Choose: **"Agent can end call"**

**End Call Phrase**: `Thank you for your time. We'll see you at your appointment. Goodbye!`

### 4.4 Max Call Duration

Set to: **7 minutes** (safety limit)

### 4.5 Enable Interruptions

Toggle ON: **"Allow user to interrupt agent"**
(Makes conversation feel natural - patient can speak over agent)

### 4.6 Background Noise Suppression

Toggle ON: **"Enable noise suppression"**
(Helps with phone quality)

---

## 📋 Step 5: Configure Webhooks (IMPORTANT - 2 minutes)

This is how the conversation transcript gets sent back to your system.

### 5.1 Find Webhook Settings

Look for section labeled:
- **"Webhooks"**
- **"Integrations"**
- **"Event Notifications"**

### 5.2 Add Webhook URL

**For Local Testing** (if using ngrok):
```
https://YOUR-NGROK-URL.ngrok.io/api/elevenlabs/conversation-complete
```

**For Production**:
```
https://your-production-domain.com/api/elevenlabs/conversation-complete
```

**For Now** (placeholder):
```
https://tshla-medical.com/api/elevenlabs/conversation-complete
```

We'll update this later when you deploy.

### 5.3 Select Events to Send

Check these boxes:
- ✅ **"Conversation Complete"**
- ✅ **"Conversation Started"** (optional)
- ✅ **"Conversation Failed"** (optional)

### 5.4 Webhook Method

Select: **POST**

### 5.5 Authentication (if available)

If ElevenLabs asks for webhook authentication:
- Leave blank for now, or
- Add a simple API key you create

---

## 📋 Step 6: Test in Playground (Optional - 3 minutes)

Before deploying, test your agent!

### 6.1 Find the "Test" or "Playground" Button

Should be in the top right or bottom of the page.

### 6.2 Have a Test Conversation

Click to start a conversation. Say:

**You**: "Hi"

**Agent**: Should introduce itself and ask if it's a good time.

**You**: "Yes, now is fine."

**Agent**: Should ask about medications.

**You**: "I'm taking Metformin 500mg twice a day."

**Agent**: Should acknowledge and ask about health concerns.

**You**: "My blood sugar has been high lately."

**Agent**: Should acknowledge and continue through the script.

### 6.3 Verify It Works

✅ Agent speaks clearly
✅ Agent follows the script
✅ Agent asks questions in order
✅ Agent listens and responds appropriately

If something seems off, adjust the system prompt or settings.

---

## 📋 Step 7: Save and Deploy (1 minute)

### 7.1 Save Your Agent

Click **"Save"** or **"Save Draft"**

### 7.2 Deploy the Agent

Click **"Deploy"** or **"Publish"**

**Important**: Agent must be "Deployed" (not "Draft") to work with Twilio!

### 7.3 Get Your Agent ID

After deploying, you should see an **Agent ID** displayed.

It looks like: `agent_abc123xyz456def789`

**COPY THIS ID** - you'll need it in the next step!

---

## 📋 Step 8: Update Your .env File (1 minute)

### 8.1 Open Your Terminal

```bash
cd /Users/rakeshpatel/Desktop/tshla-medical
```

### 8.2 Edit .env File

```bash
# Open in your text editor
nano .env
# OR
code .env
# OR
open -e .env
```

### 8.3 Find This Line

Look for line 157 (or search for "ELEVENLABS_AGENT_ID"):

```env
ELEVENLABS_AGENT_ID=placeholder_create_agent
```

### 8.4 Replace With Your Real Agent ID

```env
ELEVENLABS_AGENT_ID=agent_abc123xyz456def789
```

**Use YOUR actual Agent ID** from step 7.3!

### 8.5 Save the File

- If using nano: Press `Ctrl+X`, then `Y`, then `Enter`
- If using VS Code: Press `Cmd+S`
- If using TextEdit: Press `Cmd+S`

---

## 📋 Step 9: Restart Your System (1 minute)

### 9.1 Kill Old Processes

```bash
cd /Users/rakeshpatel/Desktop/tshla-medical

pkill -f "previsit-api-server"
lsof -ti:3100 | xargs kill -9 2>/dev/null

echo "✅ Old processes killed"
```

### 9.2 Start API Server

```bash
npm run previsit:api:dev &

sleep 5
```

### 9.3 Verify Configuration

```bash
curl http://localhost:3100/health
```

**Expected Output**:
```json
{
  "status": "healthy",
  "services": {
    "elevenlabs": "✅ Configured (agent_abc123...)"
  }
}
```

**If you still see "placeholder_create_agent"**:
- Double-check you saved .env file
- Make sure you restarted the server
- Check for typos in Agent ID

---

## 📋 Step 10: Make Your First Test Call! (2 minutes)

### 10.1 Run the Test Script

```bash
cd /Users/rakeshpatel/Desktop/tshla-medical

# Replace with YOUR phone number
npx tsx scripts/test-call.ts \
  --phone="+1YOUR_PHONE_NUMBER" \
  --name="Your Name" \
  --date="2025-01-20" \
  --time="10:00 AM" \
  --provider="Dr. Smith"
```

### 10.2 Answer Your Phone!

Your phone will ring in 10-15 seconds.

**Answer it and have a conversation with the AI!**

### 10.3 Verify Results

**Check Database**:
```
https://app.supabase.com/project/minvvjdflezibmgkplqb/editor
→ Click "previsit_responses" table
→ See your call data!
```

**Check Dashboard**:
```
http://localhost:5173/previsit-analytics
```

---

## 🆘 Troubleshooting

### "I don't see Conversational AI tab"

**Solution**: Your plan doesn't include it.
- Go to Settings → Billing
- Upgrade to "Starter" or "Creator" plan
- Or contact ElevenLabs support

### "Agent creation failed"

**Solution**:
- Check all required fields are filled
- Voice must be selected
- First message must be provided
- System prompt must be provided

### "Call connects but no voice"

**Solutions**:
1. Verify agent is **"Deployed"** (not "Draft")
2. Double-check Agent ID in .env
3. Restart API server
4. Test agent in playground first

### "Transcript not saved"

**Solutions**:
1. Check webhook URL is correct
2. For local testing, use ngrok:
   ```bash
   ngrok http 3100
   # Copy the HTTPS URL
   # Update webhook in ElevenLabs agent settings
   ```
3. Verify webhook events are checked

### "Wrong Agent ID in .env"

**Verify**:
```bash
cat .env | grep ELEVENLABS_AGENT_ID
```

Should show your real agent ID, NOT "placeholder_create_agent"

---

## ✅ Success Checklist

- [ ] Logged into ElevenLabs
- [ ] Created new phone agent
- [ ] Named it "TSHLA Pre-Visit Interview Agent"
- [ ] Selected voice (Rachel, Domi, or Adam)
- [ ] Pasted greeting message
- [ ] Pasted system prompt
- [ ] Configured settings (language, latency, interruptions)
- [ ] Added webhook URL
- [ ] Tested in playground (optional but recommended)
- [ ] Saved and deployed agent
- [ ] Copied Agent ID
- [ ] Updated .env file with Agent ID
- [ ] Restarted API server
- [ ] Verified health check shows agent configured
- [ ] Made test call
- [ ] Call received and AI spoke
- [ ] Transcript saved to database

---

## 🎉 You're Done!

Once you complete these steps, your Pre-Visit Readiness System is **100% operational**!

**Need Help?**
- Re-read the step you're stuck on
- Check the troubleshooting section
- Verify each checkbox above
- Test in ElevenLabs playground first

**It's easier than it looks!** Just follow the steps one by one. You've got this! 💪

---

**Estimated Total Time**: 10-15 minutes
**Difficulty**: Easy (just copy/paste and click buttons)
**Reward**: Fully functional AI pre-visit system! 🚀
