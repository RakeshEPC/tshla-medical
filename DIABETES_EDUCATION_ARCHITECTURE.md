# Diabetes Education Phone System - Complete Architecture

**Phone Number:** 832-400-3930
**Patient:** Raman Patel (+18326073630)

---

## 🏗️ **System Architecture Overview**

```
┌─────────────────────────────────────────────────────────────────────┐
│                          PHONE CALL FLOW                             │
└─────────────────────────────────────────────────────────────────────┘

1. Patient Calls                    2. Twilio Routes           3. Azure API
   832-400-3930                        to Webhook               Processes

   📱 +18326073630  ──────────►   ☁️ Twilio Cloud  ──────►   🔷 Azure Container
   (Raman Patel)                   (832-400-3930)              tshla-unified-api

                                                                    │
                                                                    ▼
                                                              4. Database Lookup
                                                                 Supabase

                                                                    │
                                                                    ▼
                                                              5. Build Context
                                                                Clinical Notes
                                                                Medical Data

                                                                    │
                                                                    ▼
                                                              6. Call ElevenLabs
                                                                 Get TwiML

                                                                    │
                                                                    ▼
                                                              7. Return to Twilio
   📱 Connected to AI  ◄──────────  ☁️ Connects Call  ◄────  🔷 Sends TwiML

   8. Conversation                  9. ElevenLabs              10. Transcript
      (Max 10 min)                     AI Agent                   Saved
```

---

## 📋 **Detailed Component Breakdown**

### **1. Twilio (Phone Infrastructure)**

**What It Does:**
- Owns the phone number: **832-400-3930**
- Receives incoming calls
- Makes webhook request to your server
- Connects the audio stream

**Configuration:**
- **Account:** Your Twilio account (TWILIO_ACCOUNT_SID)
- **Webhook URL:** `https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/twilio/diabetes-education-inbound`
- **Method:** POST
- **Voice:** Alice

**When a call comes in:**
```http
POST /api/twilio/diabetes-education-inbound
Content-Type: application/x-www-form-urlencoded

CallSid=CA123...
From=+18326073630
To=+18324003930
CallStatus=ringing
```

---

### **2. Azure Container App (Your Backend)**

**Service:** `tshla-unified-api`
**Location:** East US
**URL:** `https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io`

**What It Does:**
1. Receives Twilio webhook
2. Authenticates caller by phone number
3. Fetches patient data from database
4. Builds patient context
5. Calls ElevenLabs API
6. Returns TwiML to Twilio

**Code File:** `server/api/twilio/diabetes-education-inbound.js`

---

### **3. Supabase Database (Patient Data Storage)**

**Service:** PostgreSQL Database
**URL:** `https://minvvjdflezibmgkplqb.supabase.co`

**Table:** `diabetes_education_patients`

**Columns:**
```sql
CREATE TABLE diabetes_education_patients (
  id UUID PRIMARY KEY,
  phone_number VARCHAR(20) UNIQUE NOT NULL,  -- +18326073630
  first_name VARCHAR(100),                    -- Raman
  last_name VARCHAR(100),                     -- Patel
  preferred_language VARCHAR(10),             -- en
  date_of_birth DATE,
  clinical_notes TEXT,                        -- 👈 THIS IS WHERE THE DATA COMES FROM
  focus_areas TEXT[],                         -- Array: ["Weight Loss", "Sick Day Management"]
  medical_data JSONB,                         -- Medications, labs, diagnoses
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**How Patient Gets Looked Up:**
```javascript
// Line 399-404 in diabetes-education-inbound.js
const { data: patient } = await supabase
  .from('diabetes_education_patients')
  .select('*')
  .eq('phone_number', '+18326073630')  // ← Phone number from Twilio
  .eq('is_active', true)
  .single();
```

---

### **4. Where the Data Comes From**

#### **A. Web Interface (How Staff Adds Patients)**

**URL:** `https://www.tshla.ai/diabetes-education`
**File:** `src/pages/DiabetesEducationAdmin.tsx`

**What Medical Staff Can Do:**
1. Click "+ Add New Patient"
2. Fill in form:
   - First Name: Raman
   - Last Name: Patel
   - Phone: +18326073630
   - Language: English
   - Date of Birth: (any)
   - **Clinical Notes:** "A1c is 8.7. gained 20 pounds in 2 months..."
   - **Focus Areas:** Weight Loss, Sick Day Management
   - Medical Data (optional JSON):
     ```json
     {
       "medications": [...],
       "labs": {...},
       "diagnoses": [...]
     }
     ```

3. Click Save
4. Data is inserted into Supabase

**This is where the data you see came from!**

---

### **5. Building Patient Context**

**Function:** `buildPatientContext(patient)`
**Location:** Line 62-120 in `diabetes-education-inbound.js`

**What It Does:**
Takes database record and formats it into readable text:

```javascript
// Input: Database row
{
  first_name: "Raman",
  last_name: "Patel",
  clinical_notes: "A1c is 8.7. gained 20 pounds...",
  focus_areas: ["Weight Loss", "Sick Day Management"],
  medical_data: null
}

// Output: Formatted string
`Clinical Notes and Instructions:
A1c is 8.7. gained 20 pounds in 2 months, eating more and got sick.
got flu and sugars went up, need to go over sick day management and
ask about how he is feeling and prevent from getting sick

Focus Areas: Weight Loss, Sick Day Management`
```

This string is 273 characters long (as shown in logs).

---

### **6. ElevenLabs Conversational AI**

**What It Provides:**
- AI voice agent that talks to the patient
- Natural language understanding
- Text-to-speech with realistic voice
- Speech-to-text for patient responses

**API Call:**
```http
POST https://api.elevenlabs.io/v1/convai/twilio/register-call
Headers:
  xi-api-key: sk_c026b470703936e4d8303dbb841e5c55c9eec5835f3500b0
  Content-Type: application/json

Body:
{
  "agent_id": "agent_6101kbk0qsmfefftpw6sf9k0wfyb",
  "from_number": "+18326073630",
  "to_number": "+18324003930",
  "direction": "inbound",
  "conversation_initiation_client_data": {
    "patient_context": "Clinical Notes and Instructions:\nA1c is 8.7...",
    "patient_name": "Raman Patel",
    "patient_language": "en"
  }
}
```

**Response:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://api.elevenlabs.io/v1/convai/conversation/ws?conversation_id=..."/>
  </Stream>
</Response>
```

**Agent Configuration:**
- **Agent ID:** `agent_6101kbk0qsmfefftpw6sf9k0wfyb`
- **Voice:** (You configured this in ElevenLabs dashboard)
- **System Prompt:** Includes `{{patient_context}}` variable
- **Language:** English

**The agent receives the patient context and uses it during conversation!**

---

## 🔄 **Complete Call Flow (Step by Step)**

### **Step 1: Patient Dials**
```
Patient picks up phone
Dials: 832-400-3930
```

### **Step 2: Twilio Receives Call**
```
Twilio Cloud receives call
Looks up webhook URL for this number
Makes HTTP POST to your Azure server
```

### **Step 3: Your Server Processes**
```javascript
// 1. Extract caller info
From: +18326073630
To: +18324003930

// 2. Query database
SELECT * FROM diabetes_education_patients
WHERE phone_number = '+18326073630'
AND is_active = true;

// Result:
{
  id: "4d86fdb6-4090-4910-90f3-b562dc3a7c66",
  first_name: "Raman",
  last_name: "Patel",
  clinical_notes: "A1c is 8.7. gained 20 pounds...",
  focus_areas: ["Weight Loss", "Sick Day Management"]
}

// 3. Build context string
patientContext = buildPatientContext(patient);
// "Clinical Notes and Instructions:\nA1c is 8.7..."

// 4. Determine language and agent
language = "en"
agentId = "agent_6101kbk0qsmfefftpw6sf9k0wfyb"

// 5. Call ElevenLabs API
POST https://api.elevenlabs.io/v1/convai/twilio/register-call
{
  agent_id: agentId,
  from_number: "+18326073630",
  to_number: "+18324003930",
  conversation_initiation_client_data: {
    patient_context: patientContext
  }
}

// 6. Get TwiML response
twiml = "<Response><Connect><Stream url='wss://...'/></Connect></Response>"

// 7. Return to Twilio
res.send(twiml);
```

### **Step 4: Twilio Connects Call**
```
Twilio receives TwiML
Connects audio stream to ElevenLabs WebSocket
Patient hears AI voice
```

### **Step 5: AI Conversation**
```
ElevenLabs Agent:
- Receives patient_context in {{patient_context}} variable
- Knows: A1C is 8.7%, gained weight, flu, sick day management
- Greets patient: "Hello! I'm your diabetes educator..."
- Patient asks: "What is my A1C?"
- AI responds: "Your A1C is 8.7%"
```

### **Step 6: Call Ends**
```
After 10 minutes OR patient hangs up
Twilio sends status webhook
Transcript saved to database
```

---

## 📊 **Data Sources Summary**

| Data Type | Source | How It Gets There |
|-----------|--------|-------------------|
| **Phone Number** | Twilio webhook | Patient dials 832-400-3930 |
| **Patient Name** | Supabase database | Medical staff entered via web interface |
| **Clinical Notes** | Supabase database | Medical staff entered via web interface |
| **Focus Areas** | Supabase database | Medical staff selected checkboxes |
| **Medical Data** | Supabase database | Medical staff uploaded or entered manually |
| **A1C Value** | Inside clinical_notes field | Staff typed: "A1c is 8.7..." |
| **Agent ID** | Azure environment variable | You configured in .env |
| **API Keys** | Azure secrets | You configured via Azure CLI |

---

## 🔒 **Security & Privacy**

### **Data Flow Security:**
1. ✅ **Twilio → Azure:** HTTPS encrypted webhook
2. ✅ **Azure → Supabase:** SSL/TLS encrypted connection
3. ✅ **Azure → ElevenLabs:** HTTPS encrypted API call
4. ✅ **Twilio → ElevenLabs:** Secure WebSocket (WSS)

### **Authentication:**
- **Caller:** Verified by phone number in database
- **Twilio → Azure:** Webhook signature validation (can be enabled)
- **Azure → Supabase:** Service role key authentication
- **Azure → ElevenLabs:** API key authentication

### **Data Storage:**
- **Patient Data:** Supabase PostgreSQL (encrypted at rest)
- **Call Transcripts:** Saved to database after call
- **ElevenLabs:** Processes data per their privacy policy

---

## 🎯 **Where Did That Specific Data Come From?**

The data you saw:
```
A1c is 8.7. gained 20 pounds in 2 months, eating more and got sick.
got flu and sugars went up, need to go over sick day management and
ask about how he is feeling and prevent from getting sick

Focus Areas: Weight Loss, Sick Day Management
```

**This was entered by someone (you or medical staff) at:**
- **Date:** December 4, 2025 at 4:31 PM UTC
- **Method:** Via the web interface at `https://www.tshla.ai/diabetes-education`
- **Stored in:** `diabetes_education_patients` table, `clinical_notes` column
- **Patient:** Raman Patel (+18326073630)

**To verify this is real or test data:**
1. Log into the diabetes education admin portal
2. Look for Raman Patel
3. Check when the record was created
4. See who created it

---

## 🛠️ **System Components**

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Phone Line** | Twilio | Handles phone calls |
| **Backend API** | Node.js (Azure Container) | Processes webhooks, authenticates |
| **Database** | Supabase (PostgreSQL) | Stores patient data |
| **AI Voice Agent** | ElevenLabs Conversational AI | Talks to patients |
| **Admin Portal** | React (Static Web App) | Staff manages patients |

---

## 📁 **Key Files**

| File | Purpose |
|------|---------|
| `server/api/twilio/diabetes-education-inbound.js` | Main webhook handler |
| `src/pages/DiabetesEducationAdmin.tsx` | Admin interface |
| `src/services/diabetesEducation.service.ts` | API service layer |
| `.env` | Configuration (API keys, agent IDs) |

---

## 🎬 **Summary**

**The complete flow:**
1. Medical staff adds patient via web UI → Data stored in Supabase
2. Patient calls 832-400-3930 → Twilio receives
3. Twilio webhooks your Azure API → Server looks up patient
4. Server builds context from database → Calls ElevenLabs
5. ElevenLabs returns TwiML → Twilio connects call
6. AI talks to patient using their medical data → Conversation happens
7. Call ends → Transcript saved to database

**The data (A1C 8.7%, weight gain, etc.) came from:**
- Someone manually typing it into the web interface
- Stored in the `clinical_notes` field of the database
- Retrieved when the patient calls
- Passed to ElevenLabs AI agent
- Used by AI to have informed conversation

---

**Last Updated:** December 31, 2025
