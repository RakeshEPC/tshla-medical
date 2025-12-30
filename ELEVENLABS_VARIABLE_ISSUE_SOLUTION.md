# ElevenLabs Patient Context Issue - Root Cause & Solution

## Problem
AI says "A1C is 7.2%" instead of "A1C is 8.7%" from clinical notes.

## Root Cause
**ElevenLabs Conversational AI agents do NOT support dynamic variable injection via API.**

### What We Tried (All Failed):
1. ✅ Backend builds patient context correctly
2. ✅ ElevenLabs prompt has `{{patient_context}}`
3. ❌ But `{{patient_context}}` is NEVER replaced with actual data
4. ❌ ElevenLabs API doesn't support passing variables dynamically

### Why Variables Don't Work:
- `{{patient_context}}` in the prompt is a **template placeholder**
- It's meant to be replaced when you **create/configure the agent** in the UI
- It does NOT get dynamically replaced per-conversation via API
- The `/v1/convai/conversations` endpoint doesn't accept a `variables` parameter

## The Real Solution

### **Option 1: Use ElevenLabs Knowledge Base (RECOMMENDED)**

ElevenLabs agents can access a "Knowledge Base" - a collection of documents they can reference during conversations.

**Implementation:**
1. Create a Knowledge Base in ElevenLabs
2. Before each call, upload patient context as a temporary document
3. Agent reads from Knowledge Base during conversation
4. Delete document after call

**API Flow:**
```javascript
// Before call
POST /v1/knowledge-bases/{kb_id}/documents
{
  "document_id": "patient_18326073630",
  "content": "Clinical Notes: A1c is 8.7..."
}

// During call - agent automatically reads from KB

// After call
DELETE /v1/knowledge-bases/{kb_id}/documents/patient_18326073630
```

**Pros:**
- ✅ Works with existing agent setup
- ✅ No prompt changes needed
- ✅ Agent can reference patient data naturally

**Cons:**
- ❌ Requires Knowledge Base setup
- ❌ Need to manage document lifecycle
- ❌ API calls before/after each phone call

---

### **Option 2: Use ElevenLabs Custom Tools/Functions**

Create a custom tool that the agent can call to fetch patient data.

**Implementation:**
1. Create a tool in ElevenLabs: `get_patient_data`
2. Tool calls your API endpoint with phone number
3. Your API returns clinical notes
4. Agent uses returned data to answer questions

**Tool Definition:**
```json
{
  "name": "get_patient_data",
  "description": "Fetches patient medical information including A1C, medications, etc.",
  "parameters": {
    "phone_number": {
      "type": "string",
      "description": "Patient phone number"
    }
  }
}
```

**API Endpoint:**
```javascript
POST /api/diabetes-education/get-patient-context
{
  "phone_number": "+18326073630"
}

Response:
{
  "clinical_notes": "A1c is 8.7. gained 20 pounds...",
  "focus_areas": ["Weight Loss", "Sick Day Management"]
}
```

**Pros:**
- ✅ Agent actively fetches data when needed
- ✅ Data always fresh
- ✅ Works with phone number from caller ID

**Cons:**
- ❌ Agent must remember to call the tool
- ❌ Adds latency to conversation
- ❌ Requires tool configuration in ElevenLabs

---

### **Option 3: Dedicated Agent Per Patient (NOT RECOMMENDED)**

Create a separate ElevenLabs agent for each patient with hardcoded context.

**Implementation:**
1. When patient enrolls, create agent with their data in system prompt
2. Store agent ID in database
3. During call, use patient-specific agent

**Pros:**
- ✅ Simple - agent has all context built-in

**Cons:**
- ❌ Can't update clinical notes without recreating agent
- ❌ One agent per patient = expensive
- ❌ Doesn't scale (you'd need 100 agents for 100 patients)

---

### **Option 4: Hybrid Approach (BEST FOR NOW)**

Combine manual clinical notes with agent tools:

**Current Setup:**
- Agent has general diabetes education knowledge
- No dynamic patient data

**Short-term Fix:**
1. Update ElevenLabs agent prompt to say:
   ```
   You are a diabetes educator. When asked about specific values:
   - Ask the patient to confirm: "Can you tell me your most recent A1C value?"
   - OR say: "I don't have access to your latest lab results. Please check with your doctor."
   ```

2. For Raman specifically, manually update the agent's system prompt:
   ```
   PATIENT: Raman Patel
   A1C: 8.7%
   Focus: Weight loss, sick day management
   Recent issue: Gained 20 pounds, had flu, sugars went up
   ```

**Long-term:**
- Implement Option 1 (Knowledge Base) or Option 2 (Custom Tools)

---

## Immediate Action Plan

Since you have only 2 patients right now, the **fastest solution** is:

###Human: **Manual Agent Configuration (Temporary)**

1. In ElevenLabs, duplicate your diabetes education agent
2. Name it "Diabetes Educator - Raman Patel"
3. Update system prompt with Raman's specific data:
   ```
   You are Raman Patel's diabetes educator.

   PATIENT INFORMATION:
   - Name: Raman Patel
   - A1C: 8.7% (most recent)
   - Weight: Gained 20 pounds in 2 months
   - Recent issue: Had flu, blood sugars went up
   - Focus areas: Weight loss, sick day management
   - Key concern: Preventing illness and managing sugars when sick

   [Rest of your guidelines...]
   ```

4. Store this new agent ID in database for Raman
5. Backend uses Raman-specific agent when he calls

**For the 2nd patient (Simrab):**
- Create another agent with Simrab's data

**This works NOW but doesn't scale beyond ~5-10 patients.**

---

## Recommended Next Steps

**Immediate (Today):**
- Create patient-specific agent for Raman
- Test call - should say "A1C is 8.7%"

**Short-term (This Week):**
- Implement Option 2 (Custom Tools)
- Agent calls your API to fetch patient data

**Long-term (When you have 10+ patients):**
- Implement Option 1 (Knowledge Base)
- OR migrate to a different AI platform that supports dynamic context (OpenAI Realtime API, etc.)

---

## Code Changes Needed for Manual Agent Approach

**Database:**
```sql
ALTER TABLE diabetes_education_patients
ADD COLUMN custom_agent_id VARCHAR(255);
```

**Backend (`diabetes-education-inbound.js`):**
```javascript
// Instead of using language-based agent:
const agentId = patient.custom_agent_id || ELEVENLABS_DIABETES_AGENTS[language];
```

**Admin UI:**
- Add field to create/link custom agent ID per patient

---

## Why This Is Hard

ElevenLabs Conversational AI is designed for:
- ✅ General purpose assistants
- ✅ Customer service bots
- ✅ FAQ answering

It's NOT designed for:
- ❌ Dynamic per-user context
- ❌ Medical applications requiring patient-specific data
- ❌ Real-time data injection

**Better platforms for this use case:**
- OpenAI Realtime API (supports dynamic context)
- AWS Lex + Lambda (full control)
- Custom Twilio + GPT-4 integration

---

**Do you want me to:**
1. Implement the manual agent-per-patient approach (works in 30 mins)
2. Implement the Custom Tools approach (works in 2 hours)
3. Research alternative AI platforms that support dynamic context?

Let me know!
