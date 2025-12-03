# Diabetes Education AI Phone System - Implementation Guide

**Created:** December 3, 2025
**Status:** ✅ Complete - Ready for Configuration & Deployment

---

## 🎯 Overview

The Diabetes Education AI Phone System enables patients to call a dedicated phone number 24/7 and speak with an AI diabetes educator that knows their medications, lab results, and medical history. The system uses:

- **Phone Number Authentication**: No username/password required
- **Multi-Language Support**: English, Spanish, French
- **10-Minute Call Limit**: Automatic disconnect after 10 minutes
- **Clinic-Side Account Creation**: Staff uploads medical documents and creates patient accounts
- **AI-Powered Medical Data Extraction**: OpenAI extracts meds/labs from uploaded documents

---

## 📁 Files Created/Modified

### ✅ New Files Created

#### **Database**
1. **[database/migrations/006_add_diabetes_education.sql](database/migrations/006_add_diabetes_education.sql)**
   - `diabetes_education_patients` table
   - `diabetes_education_calls` table
   - Indexes, triggers, RLS policies
   - Helper functions for analytics

#### **Backend APIs**
2. **[server/diabetes-education-api.js](server/diabetes-education-api.js)**
   - Patient CRUD endpoints
   - Call logging endpoints
   - Medical document upload & AI extraction
   - Staff authentication middleware

3. **[server/api/twilio/diabetes-education-inbound.ts](server/api/twilio/diabetes-education-inbound.ts)**
   - Inbound call handler (authenticates by phone number)
   - Call status webhook
   - Call completion webhook (receives transcript)
   - 10-minute timeout enforcement

#### **Frontend**
4. **[src/services/diabetesEducation.service.ts](src/services/diabetesEducation.service.ts)**
   - TypeScript service for API calls
   - Patient management functions
   - Call history functions
   - Utility formatters

5. **[src/pages/DiabetesEducationAdmin.tsx](src/pages/DiabetesEducationAdmin.tsx)**
   - Staff admin portal
   - Patient list with stats dashboard
   - Create patient modal with document upload
   - Call history modal per patient

### ✅ Files Modified

6. **[src/pages/LandingPage.tsx](src/pages/LandingPage.tsx)** *(Lines 124-212)*
   - Added "Diabetes Education" section
   - Displays phone number and how-to instructions
   - Tesla-style design matching existing aesthetic

7. **[server/unified-api.js](server/unified-api.js)** *(Lines 1214, 1252-1253, 167-171)*
   - Imported `diabetes-education-api.js`
   - Mounted API at `/api/diabetes-education/*`
   - Registered Twilio webhook routes

8. **[src/App.tsx](src/App.tsx)** *(Lines 122, 701-710)*
   - Lazy-loaded `DiabetesEducationAdmin` component
   - Added route at `/diabetes-education`

9. **[.env.production](.env.production)** *(Lines 39-48)*
   - Added Twilio configuration variables
   - Added ElevenLabs agent IDs for each language

10. **[.github/workflows/deploy-unified-container-app.yml](.github/workflows/deploy-unified-container-app.yml)** *(Lines 129-132, 152-155)*
    - Added GitHub secrets for Twilio & ElevenLabs
    - Configured environment variables in Azure Container App

---

## 🔧 Configuration Steps

### **Step 1: Run Database Migration**

Run the SQL migration in Supabase SQL Editor:

```bash
# Navigate to Supabase dashboard
# https://supabase.com/dashboard/project/[your-project-id]/sql

# Copy contents of database/migrations/006_add_diabetes_education.sql
# Paste and execute in SQL Editor
```

**Verify:**
```sql
SELECT * FROM diabetes_education_patients LIMIT 1;
SELECT * FROM diabetes_education_calls LIMIT 1;
```

---

### **Step 2: Get a Second Twilio Number**

1. Go to [Twilio Console](https://console.twilio.com/)
2. **Phone Numbers** → **Buy a Number**
3. Search for a US number
4. Purchase number
5. **Copy the phone number** (format: +1XXXXXXXXXX)

---

### **Step 3: Create ElevenLabs AI Agents**

You need to create **3 AI agents** (one per language).

#### **Agent Configuration (All Languages)**

**System Prompt Template:**
```
You are a compassionate diabetes educator AI assistant. You have access to the patient's medical information including:
- Current medications and dosages
- Recent lab results (A1C, glucose levels, etc.)
- Diabetes type and complications
- Allergies

Guidelines:
1. Answer questions about diabetes management, medications, diet, and complications
2. Use the patient's medical data to provide personalized guidance
3. Speak in a warm, empathetic, and patient-friendly tone
4. At 8 minutes, say: "We have about 2 minutes left. Is there anything else I can help you with?"
5. At 10 minutes, say: "Our time is up for this consultation. Feel free to call back anytime. Take care!"
6. For urgent medical issues, say: "This sounds urgent. Please contact your doctor immediately or go to the emergency room."
7. Never diagnose new conditions or prescribe medications
8. If unsure, encourage the patient to speak with their healthcare provider

Language: [ENGLISH/SPANISH/FRENCH]

Patient Context (will be provided):
{medical_data}
```

#### **Create Each Agent:**

**English Agent:**
1. Go to [ElevenLabs Conversational AI](https://elevenlabs.io/app/conversational-ai)
2. Click **"Create Agent"**
3. **Name:** "Diabetes Educator - English"
4. **Voice:** Select a warm, professional voice (e.g., "Rachel" or "Nicole")
5. **System Prompt:** Paste template above (set Language: English)
6. **First Message:** "Hi! I'm your diabetes educator. I have your medical records here. What questions do you have today?"
7. **Save** → Copy **Agent ID** (starts with `agent_`)

**Spanish Agent:**
- Repeat above steps
- **Name:** "Diabetes Educator - Spanish"
- **Voice:** Select Spanish voice (e.g., "Matilda" or "Diego")
- **Language:** Spanish
- **First Message:** "¡Hola! Soy tu educador de diabetes. Tengo tus registros médicos. ¿Qué preguntas tienes hoy?"

**French Agent:**
- Repeat above steps
- **Name:** "Diabetes Educator - French"
- **Voice:** Select French voice
- **Language:** French
- **First Message:** "Bonjour! Je suis votre éducateur en diabète. J'ai vos dossiers médicaux. Quelles questions avez-vous aujourd'hui?"

---

### **Step 4: Configure GitHub Secrets**

Add these secrets in GitHub:
**Settings** → **Secrets and variables** → **Actions** → **New repository secret**

```
TWILIO_ACCOUNT_SID          = [Your Twilio Account SID]
TWILIO_AUTH_TOKEN           = [Your Twilio Auth Token]
TWILIO_PHONE_NUMBER         = [Existing Twilio number]
TWILIO_DIABETES_EDUCATION_NUMBER = [New Twilio number from Step 2]

ELEVENLABS_DIABETES_AGENT_EN = [English Agent ID]
ELEVENLABS_DIABETES_AGENT_ES = [Spanish Agent ID]
ELEVENLABS_DIABETES_AGENT_FR = [French Agent ID]
```

---

### **Step 5: Configure Twilio Webhooks**

1. Go to [Twilio Console](https://console.twilio.com/)
2. **Phone Numbers** → **Manage** → **Active Numbers**
3. Click on your **new diabetes education number**
4. Scroll to **"Voice & Fax"** section
5. **A CALL COMES IN:**
   - Select **"Webhook"**
   - URL: `https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/twilio/diabetes-education-inbound`
   - Method: **POST**
6. **CALL STATUS CHANGES:**
   - Select **"Webhook"**
   - URL: `https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/twilio/diabetes-education-status`
   - Method: **POST**
7. **Save**

---

### **Step 6: Deploy to Azure**

```bash
cd /Users/rakeshpatel/Desktop/tshla-medical

# Commit changes
git add .
git commit -m "Add Diabetes Education AI Phone System"

# Push to trigger deployment
git push origin main
```

**Monitor deployment:**
- Go to GitHub Actions tab
- Wait for "Deploy Unified Container App" workflow to complete (~10 minutes)

---

### **Step 7: Update Landing Page Phone Number**

After deployment, update the phone number on the landing page:

**Edit:** [src/pages/LandingPage.tsx:177](src/pages/LandingPage.tsx#L177)

**Change:**
```tsx
+1 (XXX) XXX-XXXX
```

**To:**
```tsx
{YOUR_ACTUAL_DIABETES_EDUCATION_NUMBER}
```

Example:
```tsx
+1 (555) 123-4567
```

---

## 🧪 Testing

### **Test 1: Create a Patient Account**

1. Navigate to: `https://www.tshla.ai/diabetes-education`
2. Login as medical staff
3. Click **"New Patient"**
4. Fill in:
   - First Name: John
   - Last Name: Doe
   - DOB: 1975-05-15
   - Phone: `[Your personal phone number for testing]`
   - Language: English
   - Upload: A sample medical document (PDF or image with medication/lab info)
5. Click **"Create Patient"**
6. **Verify:** Patient appears in list with "Medical data loaded" badge

### **Test 2: Make a Test Call**

1. From your registered phone number, call: `[TWILIO_DIABETES_EDUCATION_NUMBER]`
2. **Expected:**
   - You hear: "Connecting you to your diabetes educator. Please wait."
   - AI greets you: "Hi! I'm your diabetes educator. I have your medical records here. What questions do you have today?"
3. Ask questions:
   - "What medications am I on?"
   - "What was my last A1C?"
   - "What foods should I avoid?"
4. **Verify:** AI responds with personalized answers based on your medical data

### **Test 3: Test 10-Minute Limit**

1. Call the number
2. Have a conversation for 8+ minutes
3. **At 8 minutes:** AI warns: "We have about 2 minutes left..."
4. **At 10 minutes:** Call automatically disconnects

### **Test 4: View Call History**

1. Go to: `https://www.tshla.ai/diabetes-education`
2. Click **"View Calls"** next to your test patient
3. **Verify:** Your test call appears with:
   - Timestamp
   - Duration
   - Call status (completed)
   - AI-generated summary
   - Full transcript (if available)

### **Test 5: Test Unauthenticated Caller**

1. Call from a phone number **NOT registered** in the system
2. **Expected:** You hear: "Sorry, your phone number is not registered in our diabetes education system. Please contact your clinic to enroll."
3. Call disconnects

---

## 📊 Database Schema

### **`diabetes_education_patients`**

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `phone_number` | VARCHAR(20) | E.164 format (e.g., +15551234567) |
| `first_name` | VARCHAR(100) | Patient first name |
| `last_name` | VARCHAR(100) | Patient last name |
| `date_of_birth` | DATE | Patient DOB |
| `preferred_language` | VARCHAR(10) | `'en'`, `'es'`, `'fr'` |
| `medical_document_url` | TEXT | URL to uploaded PDF/image |
| `medical_data` | JSONB | Extracted meds, labs, diagnoses |
| `created_at` | TIMESTAMPTZ | Account creation timestamp |
| `created_by_staff_id` | UUID | FK to medical_staff table |
| `is_active` | BOOLEAN | Account active status |

### **`diabetes_education_calls`**

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `patient_id` | UUID | FK to diabetes_education_patients |
| `twilio_call_sid` | VARCHAR(255) | Twilio unique call ID |
| `elevenlabs_conversation_id` | VARCHAR(255) | ElevenLabs conversation ID |
| `language` | VARCHAR(10) | Language used for call |
| `call_started_at` | TIMESTAMPTZ | Call start time |
| `call_ended_at` | TIMESTAMPTZ | Call end time |
| `duration_seconds` | INT | Call duration (max 600) |
| `transcript` | TEXT | Full conversation transcript |
| `summary` | TEXT | AI-generated call summary |
| `topics_discussed` | JSONB | Array of topics |
| `call_status` | VARCHAR(50) | `'completed'`, `'failed'`, etc. |
| `disconnect_reason` | VARCHAR(100) | `'timeout-10min'`, `'caller-hangup'` |

---

## 🔐 Security & Compliance

### **Authentication**
- **Phone Number Verification:** Twilio provides caller ID (ANI)
- **No passwords:** Reduces phishing/credential theft risk
- **RLS Policies:** Staff can only see patients they created

### **Data Encryption**
- **At Rest:** Supabase encrypts all JSONB medical_data
- **In Transit:** All API calls use HTTPS/WSS
- **Twilio:** All calls encrypted via TLS

### **HIPAA Compliance**
- **Audit Trail:** All calls logged with timestamps
- **Access Control:** RLS ensures staff can't access other clinics' data
- **Call Recording:** Optional (configure in Twilio)

### **Rate Limiting**
- **10-minute call limit:** Prevents abuse
- **No tiered access:** All patients get equal service

---

## 📱 User Flow

### **For Staff (Creating Patient Account)**

1. Staff logs into TSHLA portal
2. Navigates to `/diabetes-education`
3. Clicks **"New Patient"**
4. Enters patient details:
   - Name, DOB, phone number
   - Selects preferred language
   - Uploads medical document (PDF/image)
5. AI extracts medications, labs, diagnoses from document
6. Staff reviews/edits extracted data
7. Clicks **"Create Patient"**
8. Patient account created and phone number registered

### **For Patients (Using the Service)**

1. Patient visits `https://www.tshla.ai`
2. Sees "Diabetes Education" section with phone number
3. Patient calls number from their registered phone
4. Twilio authenticates caller by phone number
5. Call connected to language-specific ElevenLabs agent
6. AI greets patient with medical context
7. Patient asks questions about:
   - Medications and side effects
   - Lab results (A1C, glucose, etc.)
   - Diet and lifestyle
   - Diabetes complications
8. AI provides personalized answers
9. At 8 minutes: AI warns of remaining time
10. At 10 minutes: Call automatically disconnects
11. Call transcript and summary saved to database

---

## 🛠️ Troubleshooting

### **Issue: Patient call not connecting**

**Check:**
1. Phone number format in database (must be E.164: +1XXXXXXXXXX)
2. Twilio webhook URL configured correctly
3. Azure Container App environment variables set
4. Check logs in Azure: `az containerapp logs show --name tshla-unified-api --resource-group tshla-rg`

### **Issue: AI not speaking correct language**

**Check:**
1. Patient's `preferred_language` in database
2. Correct ElevenLabs Agent ID for that language
3. Agent ID environment variable set correctly

### **Issue: Call disconnects before 10 minutes**

**Check:**
1. Twilio call timeout configured (should be 600 seconds)
2. Check disconnect_reason in database
3. Review Twilio call logs

### **Issue: Medical data not extracted from document**

**Check:**
1. OpenAI API key configured
2. Document is clear/readable PDF or image
3. Check server logs for extraction errors
4. Staff can manually enter data if AI fails

---

## 📈 Analytics Queries

### **Total Calls Today**
```sql
SELECT COUNT(*)
FROM diabetes_education_calls
WHERE DATE(call_started_at) = CURRENT_DATE;
```

### **Average Call Duration**
```sql
SELECT AVG(duration_seconds) / 60 AS avg_minutes
FROM diabetes_education_calls
WHERE call_status = 'completed';
```

### **Top Topics Discussed**
```sql
SELECT
  jsonb_array_elements_text(topics_discussed) AS topic,
  COUNT(*) AS frequency
FROM diabetes_education_calls
WHERE topics_discussed IS NOT NULL
GROUP BY topic
ORDER BY frequency DESC
LIMIT 10;
```

### **Patients by Language**
```sql
SELECT
  preferred_language,
  COUNT(*) AS patient_count
FROM diabetes_education_patients
WHERE is_active = TRUE
GROUP BY preferred_language;
```

---

## 🎉 Success Criteria

- ✅ Database migration runs without errors
- ✅ Staff can create patient accounts
- ✅ AI extracts medical data from uploaded documents
- ✅ Patients can call and receive personalized answers
- ✅ Multi-language support works (EN, ES, FR)
- ✅ 10-minute call limit enforced
- ✅ Call history viewable in admin portal
- ✅ Transcripts and summaries saved
- ✅ Unauthenticated callers rejected
- ✅ Landing page displays phone number

---

## 🚀 Next Steps (Future Enhancements)

1. **SMS Reminders:** "You haven't called your diabetes educator in 30 days"
2. **Voice Biometric Auth:** Add DOB verification for extra security
3. **Appointment Booking:** AI can schedule follow-up appointments
4. **Multilingual Expansion:** Add more languages (Hindi, Mandarin, etc.)
5. **Call Recordings:** Save audio files for quality assurance
6. **Patient Satisfaction Surveys:** Ask patients to rate call after disconnect
7. **Integration with CGM Data:** Pull real-time glucose data from Dexcom/Libre
8. **Provider Notifications:** Alert doctor if patient asks concerning questions

---

## 📞 Support

**For issues:**
- Check Azure logs: `az containerapp logs show --name tshla-unified-api`
- Check Twilio logs: [https://console.twilio.com/](https://console.twilio.com/)
- Check Supabase logs: [https://supabase.com/dashboard/](https://supabase.com/dashboard/)

**Questions?**
- Email: support@tshla.ai
- Documentation: https://docs.tshla.ai

---

**Implementation Complete! 🎊**

The Diabetes Education AI Phone System is now fully integrated and ready for use. Follow the configuration steps above to activate the system.
