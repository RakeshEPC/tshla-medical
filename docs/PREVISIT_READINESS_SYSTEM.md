# Pre-Visit Readiness System - Complete Implementation Guide

**Project Owner:** Dr. Rakesh Patel, TSHLA Medical
**Created:** January 2025
**Status:** Planning Phase - NOT YET IMPLEMENTED
**Estimated Timeline:** 6-8 weeks
**Expected ROI:** $13,200/month value for 100 patients/day

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Business Requirements](#business-requirements)
3. [Pre-Visit Interview Script](#pre-visit-interview-script)
4. [Patient ID System](#patient-id-system)
5. [Database Schema](#database-schema)
6. [Twilio Integration](#twilio-integration)
7. [11Labs Integration](#11labs-integration)
8. [Call Timing & Retry Strategy](#call-timing--retry-strategy)
9. [Klara Text Notifications](#klara-text-notifications)
10. [Schedule Dashboard Integration](#schedule-dashboard-integration)
11. [Dictation Auto-Population](#dictation-auto-population)
12. [Implementation Phases](#implementation-phases)
13. [Cost Analysis & ROI](#cost-analysis--roi)
14. [HIPAA Compliance](#hipaa-compliance)
15. [Success Metrics](#success-metrics)
16. [Testing Plan](#testing-plan)
17. [Troubleshooting Guide](#troubleshooting-guide)

---

## Executive Summary

### Problem Statement
Providers spend 5-10 minutes at the start of each visit asking routine questions:
- What medications are you taking?
- Do you need refills?
- Did you get your labs done?
- What concerns do you want to discuss?

This is inefficient and delays care delivery.

### Solution
Automated pre-visit phone calls powered by 11Labs AI that:
1. Call patients 1-2 days before their appointment
2. Conduct a 3-5 minute structured interview
3. Gather medications, lab status, concerns, and questions
4. Store structured data in Supabase
5. Auto-populate dictation template with pre-visit information
6. Display summaries on provider schedule dashboard

### Expected Benefits
- **Time Savings:** 3-5 minutes per patient = 200+ minutes/day for 100 patients
- **Better Preparation:** Providers review concerns before visit
- **Reduced No-Shows:** Pre-visit engagement improves attendance
- **Patient Satisfaction:** Patients feel heard before arriving
- **Clinical Quality:** More time for actual care vs. data gathering

---

## Business Requirements

### Must-Have Features (MVP)
1. ✅ Automated outbound calls to patients 1-2 days before appointment
2. ✅ AI-powered conversation to gather structured data
3. ✅ Store data in Supabase with proper patient matching
4. ✅ Display pre-visit summary on schedule dashboard
5. ✅ Auto-populate dictation template with pre-visit data
6. ✅ Klara text notification before automated call
7. ✅ Retry logic (max 3 attempts)
8. ✅ Patient ID system for data continuity

### Nice-to-Have Features (V2)
- Spanish language support
- Patient portal opt-in/opt-out
- Voice sentiment analysis
- Emergency keyword detection with auto-escalation
- Integration with pharmacy for medication verification
- SMS fallback if patient doesn't answer

### Non-Functional Requirements
- HIPAA compliant (BAA with Twilio and 11Labs)
- 99% uptime for call system
- <5 minute call duration
- <2 second latency in AI responses
- Encrypted storage for all PHI
- Audit trail for all calls

---

## Pre-Visit Interview Script

### Optimized Conversation Flow for 11Labs AI

```plaintext
=================================================================
TSHLA MEDICAL PRE-VISIT READINESS AI AGENT SCRIPT
=================================================================

[SYSTEM PROMPT FOR 11LABS]
You are a professional medical assistant AI calling on behalf of TSHLA Medical.
Your goal is to efficiently gather pre-visit information in a warm, friendly manner.
Keep responses concise. If patient wants to skip a section, respect that.
If you detect urgent medical concerns (chest pain, breathing problems, suicidal thoughts),
immediately say: "That sounds urgent. Please hang up and call 911 or go to the emergency room."
Always speak clearly and allow patient time to respond.

=================================================================
CONVERSATION SCRIPT
=================================================================

[OPENING - Identity Verification]
AI: "Hello, this is TSHLA Medical's automated assistant calling about your
    upcoming appointment with Dr. [Provider Name] on [Date] at [Time].
    Am I speaking with [Patient Full Name]?"

    [If NO] → "I apologize for the confusion. Have a great day!" → END CALL
    [If YES] → Continue

AI: "Great! For security, can you please confirm your date of birth?"

    [Verify DOB matches record]
    [If INCORRECT] → "I'm sorry, that doesn't match our records. Please call
                      our office at [phone number] to verify. Goodbye." → END CALL
    [If CORRECT] → Continue

AI: "Perfect! This call will take about 3-5 minutes to help prepare for your visit.
    You can skip any section by saying 'I'll discuss that at the visit.'
    Ready to get started?"

=================================================================
SECTION 1: MEDICATION REVIEW (Most Critical)
=================================================================

AI: "Let's start with your medications. Can you tell me what medications
    you're currently taking? Please include the name and how often you take it."

    [LISTEN - Extract: medication name, dosage, frequency]
    [After each medication mentioned]
    AI: "Got it, [medication name]. Any side effects or problems with this medication?"

    [When patient finishes listing]
    AI: "Thank you. Just to confirm, you mentioned [repeat list]. Is that correct?"

    [CLARIFICATION if needed]

AI: "Do you need refills for any of these medications at your visit?"

    [LISTEN - Extract: which medications need refills, supply remaining]
    [Probe if unclear] "How many days of [medication] do you have left?"

=================================================================
SECTION 2: LAB WORK & TESTS
=================================================================

AI: "Next, lab work. Were you asked to get any blood tests or lab work
    done before this appointment?"

    [If NO] → "Do you need lab orders from the doctor?"
              [Capture YES/NO]

    [If YES] → "Have you completed the lab work?"
               [If completed] "Great! Where did you get it done and when?"
                             [Extract: lab facility name, date]
               [If not completed] "No problem. We'll discuss that at your visit."

AI: "Have you seen any other doctors or specialists since your last visit with us?"

    [If YES] → "Who did you see and for what reason?"
               [Extract: specialist name, reason, date if provided]

=================================================================
SECTION 3: CHIEF CONCERNS & SYMPTOMS
=================================================================

AI: "Now let's talk about your visit. What are the main concerns you want
    to discuss with Dr. [Provider Name]?"

    [LISTEN - Open-ended, allow patient to speak]
    [Extract: list of concerns]

    [For each concern mentioned]
    AI: "On a scale of 1 to 10, with 10 being most urgent, how would you rate
         the urgency of [concern]?"

    [EMERGENCY DETECTION]
    [If patient mentions: chest pain, can't breathe, suicidal thoughts, severe bleeding]
    AI: "That sounds like an emergency. Please hang up immediately and call 911
         or go to your nearest emergency room. Do not wait for your appointment."
    → IMMEDIATE CALL TERMINATION + FLAG FOR URGENT CALLBACK

AI: "Have you noticed any new symptoms or changes in your health since your last visit?"

    [LISTEN - Extract: new symptoms, when started, severity]

=================================================================
SECTION 4: PATIENT NEEDS
=================================================================

AI: "What do you need from this visit? I'll read a few options, just say yes or no."

    "Do you need new prescriptions?" [YES/NO]
    "Do you need referrals to any specialists?" [YES/NO - if yes, which specialty?]
    "Do you need any forms filled out, like FMLA or disability paperwork?" [YES/NO]
    "Do you need medical advice about a specific health topic?" [YES/NO]

=================================================================
SECTION 5: QUESTIONS FOR DOCTOR
=================================================================

AI: "Last thing - do you have any specific questions you want to make sure
    we answer at your visit?"

    [LISTEN - Open-ended]
    [Extract: list of questions]

    AI: "Perfect. I've noted your questions: [repeat back]"

=================================================================
SECTION 6: APPOINTMENT CONFIRMATION
=================================================================

AI: "Just to confirm, your appointment is on [Date] at [Time] at [Location].
    Will you be able to make it?"

    [If NO] → "I understand. Please call our office at [phone number] to reschedule."
              [FLAG: Patient may not attend]

    [If YES] → "Excellent! Please bring your insurance card, photo ID, and
                any medication bottles you have. Is there anything else I can help with?"

=================================================================
CLOSING
=================================================================

AI: "Thank you so much for taking the time to speak with me, [Patient Name].
    Dr. [Provider Name] will review this information before your visit.
    If anything urgent comes up before your appointment, please call us at [phone number].
    We look forward to seeing you on [Date]!"

    "Have a great day, and thank you for being a patient at TSHLA Medical!"

→ END CALL

=================================================================
VOICEMAIL MESSAGE (If no answer after 2 rings)
=================================================================

"Hello, this is TSHLA Medical calling for [Patient Name] about your upcoming
appointment with Dr. [Provider Name] on [Date] at [Time]. We wanted to do a
quick pre-visit call to prepare for your appointment. Please call us back at
[phone number] at your convenience, or we'll see you at your scheduled time.
Thank you!"

=================================================================
DATA EXTRACTION REQUIREMENTS
=================================================================

From the conversation, 11Labs/backend must extract:

STRUCTURED DATA:
- current_medications: [{name, dosage, frequency, side_effects}]
- refills_needed: [{medication, supply_remaining}]
- labs_completed: boolean
- labs_details: string (where/when)
- labs_needed: boolean
- specialist_visits: [{specialist, reason, date}]
- chief_concerns: [{concern, urgency_1_10}]
- new_symptoms: string
- patient_needs: {prescriptions: [], referrals: [], forms: [], advice: boolean}
- patient_questions: string[]
- appointment_confirmed: boolean

RAW DATA:
- full_transcript: string (entire conversation)
- audio_recording_url: string (S3 storage)
- call_duration: integer (seconds)

AI ANALYSIS:
- ai_summary: string (2-3 sentence summary)
- clinical_notes: string (formatted for provider)
- risk_flags: string[] (e.g., ['new-chest-pain', 'medication-confusion'])
- requires_urgent_callback: boolean

=================================================================
```

---

## Patient ID System

### Problem
Current schedule imports don't have persistent patient IDs. Need to:
1. Auto-create patient records from schedule
2. Match existing patients to avoid duplicates
3. Store longitudinal data (pre-visit responses, notes, etc.)

### Solution: Automatic Patient Record Creation

#### Patient ID Format
```
P-[YEAR]-[SEQUENTIAL-4-DIGIT]

Examples:
- P-2025-0001
- P-2025-0002
- P-2025-9999
```

#### Patient Matching Algorithm

When schedule is imported, for each appointment entry:

```typescript
async function findOrCreatePatient(scheduleEntry: {
  patient_name: string;
  patient_phone?: string;
  patient_dob?: string;
  patient_email?: string;
  provider_id: string;
}): Promise<string> { // Returns patient UUID

  // STEP 1: Try exact match by phone (most reliable)
  if (scheduleEntry.patient_phone) {
    const phoneMatch = await supabase
      .from('patients')
      .select('id')
      .eq('phone_primary', cleanPhone(scheduleEntry.patient_phone))
      .single();

    if (phoneMatch.data) {
      await updateLastAppointment(phoneMatch.data.id, scheduleEntry.appointment_date);
      return phoneMatch.data.id;
    }
  }

  // STEP 2: Try match by name + DOB (strong match)
  if (scheduleEntry.patient_dob) {
    const nameDobMatch = await supabase
      .from('patients')
      .select('id')
      .ilike('full_name', scheduleEntry.patient_name)
      .eq('date_of_birth', scheduleEntry.patient_dob)
      .single();

    if (nameDobMatch.data) {
      // Update phone if it was missing
      if (scheduleEntry.patient_phone) {
        await supabase
          .from('patients')
          .update({ phone_primary: cleanPhone(scheduleEntry.patient_phone) })
          .eq('id', nameDobMatch.data.id);
      }
      await updateLastAppointment(nameDobMatch.data.id, scheduleEntry.appointment_date);
      return nameDobMatch.data.id;
    }
  }

  // STEP 3: Try fuzzy name match for same provider (medium confidence)
  const fuzzyMatches = await supabase
    .from('patients')
    .select('id, full_name, phone_primary')
    .eq('provider_id', scheduleEntry.provider_id)
    .ilike('full_name', `%${scheduleEntry.patient_name.split(' ')[0]}%`); // First name match

  // If single match with similar last name, likely same patient
  if (fuzzyMatches.data?.length === 1) {
    const similarity = calculateNameSimilarity(
      scheduleEntry.patient_name,
      fuzzyMatches.data[0].full_name
    );
    if (similarity > 0.85) {
      await updateLastAppointment(fuzzyMatches.data[0].id, scheduleEntry.appointment_date);
      return fuzzyMatches.data[0].id;
    }
  }

  // STEP 4: No match found - create new patient
  const newPatientId = await createNewPatient({
    first_name: parseFirstName(scheduleEntry.patient_name),
    last_name: parseLastName(scheduleEntry.patient_name),
    phone_primary: scheduleEntry.patient_phone ? cleanPhone(scheduleEntry.patient_phone) : null,
    email: scheduleEntry.patient_email,
    date_of_birth: scheduleEntry.patient_dob,
    provider_id: scheduleEntry.provider_id,
    next_appointment_date: scheduleEntry.appointment_date,
  });

  return newPatientId;
}

async function createNewPatient(data: PatientCreateData): Promise<string> {
  // Generate sequential patient ID
  const currentYear = new Date().getFullYear();
  const { data: maxId } = await supabase
    .from('patients')
    .select('patient_id')
    .like('patient_id', `P-${currentYear}-%`)
    .order('patient_id', { ascending: false })
    .limit(1)
    .single();

  let nextNumber = 1;
  if (maxId?.patient_id) {
    const lastNumber = parseInt(maxId.patient_id.split('-')[2]);
    nextNumber = lastNumber + 1;
  }

  const patientId = `P-${currentYear}-${nextNumber.toString().padStart(4, '0')}`;

  const { data: newPatient, error } = await supabase
    .from('patients')
    .insert({
      patient_id: patientId,
      ...data,
    })
    .select('id')
    .single();

  if (error) throw error;
  return newPatient.id;
}
```

### Schedule Import Enhancement

Modify existing schedule import logic:

```typescript
// In scheduleDatabase.service.ts or Athena sync
async function importScheduleWithPatients(
  providerId: string,
  scheduleData: AthenaAppointment[]
): Promise<void> {

  for (const appointment of scheduleData) {
    // Find or create patient
    const patientUUID = await findOrCreatePatient({
      patient_name: appointment.patientName,
      patient_phone: appointment.patientPhone,
      patient_dob: appointment.patientDOB,
      patient_email: appointment.patientEmail,
      provider_id: providerId,
      appointment_date: appointment.date,
    });

    // Create appointment record linked to patient
    await supabase.from('appointments').insert({
      patient_id: patientUUID,
      provider_id: providerId,
      appointment_date: appointment.date,
      appointment_time: appointment.time,
      appointment_type: appointment.type,
      duration_minutes: appointment.duration,
      status: 'scheduled',
      athena_appointment_id: appointment.athenaId, // Keep external ID
    });
  }
}
```

---

## Database Schema

### Complete Supabase Tables

```sql
-- =====================================================
-- PATIENTS TABLE (Core)
-- =====================================================
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  patient_id VARCHAR(50) UNIQUE NOT NULL, -- P-2025-0001 format
  mrn VARCHAR(50) UNIQUE, -- External MRN if available

  -- Demographics
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  full_name VARCHAR(200) GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
  date_of_birth DATE NOT NULL,
  age INTEGER GENERATED ALWAYS AS (
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth))
  ) STORED,
  gender VARCHAR(50),

  -- Contact
  phone_primary VARCHAR(20) NOT NULL,
  phone_secondary VARCHAR(20),
  email VARCHAR(255),
  preferred_contact_method VARCHAR(20) DEFAULT 'phone', -- phone, email, text

  -- Address
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(50),
  zip_code VARCHAR(10),

  -- Insurance
  insurance_provider VARCHAR(255),
  insurance_member_id VARCHAR(100),
  insurance_group_number VARCHAR(100),

  -- Clinical
  primary_language VARCHAR(50) DEFAULT 'English',
  preferred_pharmacy VARCHAR(255),

  -- Relationships
  provider_id UUID REFERENCES medical_staff(id),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_visit_date DATE,
  next_appointment_date DATE,
  total_visits INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  patient_status VARCHAR(50) DEFAULT 'active', -- active, inactive, deceased, transferred

  -- Preferences
  opt_out_automated_calls BOOLEAN DEFAULT FALSE,
  opt_out_text_messages BOOLEAN DEFAULT FALSE,
  opt_out_email BOOLEAN DEFAULT FALSE
);

-- =====================================================
-- PREVISIT RESPONSES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS previsit_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES medical_staff(id),

  -- Call Metadata
  call_sid VARCHAR(100), -- Twilio Call SID
  elevenlabs_conversation_id VARCHAR(100), -- 11Labs Conversation ID
  call_initiated_at TIMESTAMPTZ,
  call_answered_at TIMESTAMPTZ,
  call_completed_at TIMESTAMPTZ,
  call_duration_seconds INTEGER,
  call_status VARCHAR(50) NOT NULL, -- completed, no-answer, failed, patient-declined, voicemail
  call_attempt_number INTEGER DEFAULT 1, -- 1st, 2nd, or 3rd attempt

  -- Structured Data (JSON for flexibility)
  current_medications JSONB DEFAULT '[]',
    -- [{name: string, dosage: string, frequency: string, side_effects: string}]

  refills_needed JSONB DEFAULT '[]',
    -- [{medication: string, supply_remaining: string}]

  labs_completed BOOLEAN,
  labs_details TEXT, -- "Quest Diagnostics, January 15, 2025"
  labs_needed BOOLEAN,

  specialist_visits JSONB DEFAULT '[]',
    -- [{specialist: string, reason: string, date: string}]

  chief_concerns JSONB DEFAULT '[]',
    -- [{concern: string, urgency_1_10: integer, details: string}]

  new_symptoms TEXT,

  patient_needs JSONB DEFAULT '{}',
    -- {prescriptions: string[], referrals: string[], forms: string[], advice: boolean}

  patient_questions TEXT[], -- Array of questions

  -- Raw Data
  full_transcript TEXT, -- Full conversation text
  audio_recording_url TEXT, -- S3/Azure Blob URL

  -- AI Analysis
  ai_summary TEXT, -- 2-3 sentence provider-ready summary
  clinical_notes TEXT, -- Formatted clinical notes
  risk_flags TEXT[] DEFAULT '{}', -- ['new-chest-pain', 'medication-confusion', 'urgent-symptoms']
  requires_urgent_callback BOOLEAN DEFAULT FALSE,
  urgency_level VARCHAR(20) DEFAULT 'routine', -- routine, moderate, high, urgent

  -- Patient Confirmation
  appointment_confirmed BOOLEAN,
  patient_will_attend BOOLEAN,

  -- Provider Review
  reviewed_by_provider BOOLEAN DEFAULT FALSE,
  reviewed_at TIMESTAMPTZ,
  provider_notes TEXT, -- Provider can add notes after reviewing

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PREVISIT CALL LOG (Tracking attempts)
-- =====================================================
CREATE TABLE IF NOT EXISTS previsit_call_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,

  attempt_number INTEGER NOT NULL, -- 1, 2, or 3
  call_time TIMESTAMPTZ DEFAULT NOW(),
  call_status VARCHAR(50) NOT NULL,
    -- answered, no-answer, busy, voicemail-detected, failed, patient-declined

  twilio_call_sid VARCHAR(100),
  call_duration_seconds INTEGER,

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PREVISIT NOTIFICATION LOG (Klara texts)
-- =====================================================
CREATE TABLE IF NOT EXISTS previsit_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id),

  notification_type VARCHAR(50) NOT NULL, -- klara-text, email, push
  notification_status VARCHAR(50) NOT NULL, -- sent, delivered, failed, read

  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,

  message_content TEXT,
  klara_message_id VARCHAR(100),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES for Performance
-- =====================================================

-- Patients
CREATE INDEX idx_patients_phone ON patients(phone_primary);
CREATE INDEX idx_patients_name ON patients(full_name);
CREATE INDEX idx_patients_dob ON patients(date_of_birth);
CREATE INDEX idx_patients_provider ON patients(provider_id);
CREATE INDEX idx_patients_next_appt ON patients(next_appointment_date);
CREATE INDEX idx_patients_patient_id ON patients(patient_id);

-- Pre-visit Responses
CREATE INDEX idx_previsit_patient ON previsit_responses(patient_id);
CREATE INDEX idx_previsit_appointment ON previsit_responses(appointment_id);
CREATE INDEX idx_previsit_provider ON previsit_responses(provider_id);
CREATE INDEX idx_previsit_status ON previsit_responses(call_status);
CREATE INDEX idx_previsit_urgent ON previsit_responses(requires_urgent_callback) WHERE requires_urgent_callback = TRUE;
CREATE INDEX idx_previsit_created ON previsit_responses(created_at DESC);

-- Call Log
CREATE INDEX idx_call_log_patient ON previsit_call_log(patient_id);
CREATE INDEX idx_call_log_appointment ON previsit_call_log(appointment_id);
CREATE INDEX idx_call_log_time ON previsit_call_log(call_time DESC);

-- Notification Log
CREATE INDEX idx_notification_patient ON previsit_notification_log(patient_id);
CREATE INDEX idx_notification_status ON previsit_notification_log(notification_status);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE previsit_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE previsit_call_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE previsit_notification_log ENABLE ROW LEVEL SECURITY;

-- Providers can only see their own patients
CREATE POLICY "Providers see their patients"
  ON patients FOR SELECT
  USING (
    provider_id IN (
      SELECT id FROM medical_staff WHERE auth_user_id = auth.uid()
    )
  );

-- Providers can update their patients
CREATE POLICY "Providers update their patients"
  ON patients FOR UPDATE
  USING (
    provider_id IN (
      SELECT id FROM medical_staff WHERE auth_user_id = auth.uid()
    )
  );

-- Providers can see pre-visit responses for their patients
CREATE POLICY "Providers see their pre-visit responses"
  ON previsit_responses FOR SELECT
  USING (
    provider_id IN (
      SELECT id FROM medical_staff WHERE auth_user_id = auth.uid()
    )
  );

-- System can insert pre-visit responses (service role)
CREATE POLICY "System inserts pre-visit responses"
  ON previsit_responses FOR INSERT
  WITH CHECK (true); -- Service role will handle this

-- Similar policies for call_log and notification_log...

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update patients.updated_at
CREATE OR REPLACE FUNCTION update_patients_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW
  EXECUTE FUNCTION update_patients_updated_at();

-- Update previsit_responses.updated_at
CREATE TRIGGER previsit_responses_updated_at
  BEFORE UPDATE ON previsit_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_patients_updated_at(); -- Reuse same function

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Get today's appointments needing pre-visit calls
CREATE OR REPLACE FUNCTION get_appointments_needing_previsit_calls(
  target_date DATE DEFAULT CURRENT_DATE + INTERVAL '1 day'
)
RETURNS TABLE (
  appointment_id UUID,
  patient_id UUID,
  patient_name TEXT,
  patient_phone TEXT,
  appointment_time TIME,
  already_called BOOLEAN,
  call_attempts INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id as appointment_id,
    p.id as patient_id,
    p.full_name as patient_name,
    p.phone_primary as patient_phone,
    a.appointment_time,
    EXISTS(
      SELECT 1 FROM previsit_responses pr
      WHERE pr.appointment_id = a.id
      AND pr.call_status = 'completed'
    ) as already_called,
    COALESCE((
      SELECT MAX(attempt_number) FROM previsit_call_log pcl
      WHERE pcl.appointment_id = a.id
    ), 0) as call_attempts
  FROM appointments a
  JOIN patients p ON p.id = a.patient_id
  WHERE a.appointment_date = target_date
    AND a.status = 'scheduled'
    AND p.opt_out_automated_calls = FALSE
    AND p.phone_primary IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
```

---

## Twilio Integration

### What You Need

1. **Twilio Account Setup**
   - Sign up at https://www.twilio.com
   - Purchase a phone number (Local number recommended: $1/month)
   - Enable Voice capabilities
   - Upgrade from trial to paid account (required for production)

2. **Required Twilio Services**
   - **Programmable Voice API** - Make outbound calls
   - **TwiML** - Configure call flows
   - **Twilio Studio** (Optional) - Visual flow builder for complex routing

3. **Twilio Credentials Needed**
   ```env
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token_here
   TWILIO_PHONE_NUMBER=+15555551234
   ```

4. **HIPAA Compliance**
   - Sign **Business Associate Agreement (BAA)** with Twilio
   - Use HIPAA-eligible services only (check Twilio docs)
   - Enable encryption for all call recordings

### Implementation Code

#### Step 1: Twilio Client Setup

```typescript
// server/services/twilioService.ts
import twilio from 'twilio';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const BASE_URL = process.env.API_BASE_URL; // e.g., https://api.tshla.ai

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
  throw new Error('Missing Twilio credentials in environment variables');
}

export const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

export interface InitiatePreVisitCallOptions {
  patientId: string;
  patientName: string;
  patientPhone: string;
  appointmentId: string;
  appointmentDate: string;
  appointmentTime: string;
  providerName: string;
  attemptNumber: number;
}

export async function initiatePreVisitCall(
  options: InitiatePreVisitCallOptions
): Promise<{ success: boolean; callSid?: string; error?: string }> {
  try {
    // Create call via Twilio
    const call = await twilioClient.calls.create({
      to: options.patientPhone,
      from: TWILIO_PHONE_NUMBER,
      url: `${BASE_URL}/api/twilio/previsit-twiml`, // TwiML endpoint
      statusCallback: `${BASE_URL}/api/twilio/call-status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',

      // Machine detection (hang up if voicemail on 1st attempt, leave message on 2nd)
      machineDetection: options.attemptNumber === 1 ? 'DetectMessageEnd' : 'Enable',
      asyncAmd: 'true', // Async answering machine detection

      timeout: 30, // Ring for 30 seconds before giving up

      // Pass context data
      sendDigits: '', // Can use for IVR navigation if needed

      // Custom parameters (passed to webhook)
      params: {
        patientId: options.patientId,
        patientName: options.patientName,
        appointmentId: options.appointmentId,
        appointmentDate: options.appointmentDate,
        appointmentTime: options.appointmentTime,
        providerName: options.providerName,
        attemptNumber: options.attemptNumber.toString(),
      },
    });

    // Log call initiation
    await logCallAttempt({
      patientId: options.patientId,
      appointmentId: options.appointmentId,
      attemptNumber: options.attemptNumber,
      twilioCallSid: call.sid,
      status: 'initiated',
    });

    return { success: true, callSid: call.sid };

  } catch (error) {
    console.error('Failed to initiate Twilio call:', error);

    await logCallAttempt({
      patientId: options.patientId,
      appointmentId: options.appointmentId,
      attemptNumber: options.attemptNumber,
      status: 'failed',
      notes: error.message,
    });

    return { success: false, error: error.message };
  }
}
```

#### Step 2: TwiML Webhook (Connect to 11Labs)

```typescript
// server/api/twilio/previsit-twiml.ts
import { Router } from 'express';
import twilio from 'twilio';

const router = Router();
const VoiceResponse = twilio.twiml.VoiceResponse;

router.post('/previsit-twiml', async (req, res) => {
  const {
    patientId,
    patientName,
    appointmentDate,
    appointmentTime,
    providerName,
    attemptNumber,
  } = req.body;

  const twiml = new VoiceResponse();

  // If answering machine detected on 1st attempt, hang up
  if (req.body.AnsweredBy === 'machine_end_beep' && attemptNumber === '1') {
    console.log(`Voicemail detected for ${patientName} - hanging up (attempt 1)`);
    twiml.hangup();
    res.type('text/xml');
    res.send(twiml.toString());
    return;
  }

  // If answering machine on 2nd/3rd attempt, leave voicemail
  if (req.body.AnsweredBy === 'machine_end_beep') {
    console.log(`Voicemail detected for ${patientName} - leaving message`);
    twiml.say({
      voice: 'alice',
      language: 'en-US',
    }, `Hello, this is TSHLA Medical calling for ${patientName} about your upcoming appointment with Dr. ${providerName} on ${appointmentDate} at ${appointmentTime}. We wanted to do a quick pre-visit call to prepare for your appointment. Please call us back at ${process.env.OFFICE_PHONE_NUMBER} at your convenience, or we'll see you at your scheduled time. Thank you!`);
    twiml.hangup();
    res.type('text/xml');
    res.send(twiml.toString());
    return;
  }

  // Human answered - connect to 11Labs
  console.log(`Human answered for ${patientName} - connecting to 11Labs AI`);

  // Use <Connect> to stream audio to 11Labs WebSocket
  const connect = twiml.connect();
  connect.stream({
    url: `wss://api.elevenlabs.io/v1/convai/conversation`,
    parameters: {
      agent_id: process.env.ELEVENLABS_AGENT_ID,
      api_key: process.env.ELEVENLABS_API_KEY,
      // Pass context to 11Labs
      patient_name: patientName,
      appointment_date: appointmentDate,
      appointment_time: appointmentTime,
      provider_name: providerName,
      patient_id: patientId,
    },
  });

  res.type('text/xml');
  res.send(twiml.toString());
});

export default router;
```

#### Step 3: Call Status Webhook

```typescript
// server/api/twilio/call-status.ts
import { Router } from 'express';
import { supabase } from '../../../lib/supabase';

const router = Router();

router.post('/call-status', async (req, res) => {
  const {
    CallSid,
    CallStatus,
    CallDuration,
    patientId,
    appointmentId,
  } = req.body;

  console.log(`Call status update: ${CallSid} - ${CallStatus}`);

  // Update call log
  await supabase
    .from('previsit_call_log')
    .update({
      call_status: CallStatus,
      call_duration_seconds: parseInt(CallDuration) || 0,
    })
    .eq('twilio_call_sid', CallSid);

  // If call completed, trigger transcript processing
  if (CallStatus === 'completed') {
    // This will be handled by 11Labs webhook
    console.log(`Call completed for patient ${patientId}`);
  }

  res.sendStatus(200);
});

export default router;
```

---

## 11Labs Integration

### What You Need

1. **11Labs Account Setup**
   - Sign up at https://elevenlabs.io
   - Upgrade to paid plan (Conversational AI requires paid tier)
   - Create Conversational AI Agent (not just TTS)

2. **11Labs Credentials**
   ```env
   ELEVENLABS_API_KEY=your_api_key_here
   ELEVENLABS_AGENT_ID=agent_xxxxxxxxxxxxx
   ```

3. **HIPAA Compliance**
   - Sign **Business Associate Agreement (BAA)** with 11Labs
   - Confirm their Conversational AI product is HIPAA-compliant
   - Enable encryption for all transcripts and recordings

### Agent Configuration

In 11Labs dashboard, create agent with:

**Agent Name:** TSHLA Pre-Visit Assistant

**System Prompt:** (Paste the script from Section 3)

**Voice:** Choose professional, warm female voice (e.g., "Sarah" or "Rachel")

**Conversation Settings:**
- Max conversation duration: 10 minutes
- Enable transcript logging: Yes
- Enable audio recording: Yes
- Response latency: Low (faster responses)

### Implementation Code

#### Step 1: Process 11Labs Conversation Data

```typescript
// server/api/elevenlabs/conversation-complete.ts
import { Router } from 'express';
import { supabase } from '../../../lib/supabase';

const router = Router();

/**
 * Webhook called by 11Labs when conversation ends
 */
router.post('/conversation-complete', async (req, res) => {
  const {
    conversation_id,
    transcript,
    audio_url,
    duration_seconds,
    metadata, // Contains patient_id, appointment_id passed from Twilio
  } = req.body;

  console.log(`11Labs conversation complete: ${conversation_id}`);

  try {
    // Extract structured data from transcript using AI
    const structuredData = await extractStructuredData(transcript);

    // Store in Supabase
    const { data, error } = await supabase
      .from('previsit_responses')
      .insert({
        patient_id: metadata.patient_id,
        appointment_id: metadata.appointment_id,
        provider_id: metadata.provider_id,

        elevenlabs_conversation_id: conversation_id,
        call_completed_at: new Date().toISOString(),
        call_duration_seconds: duration_seconds,
        call_status: 'completed',

        full_transcript: transcript,
        audio_recording_url: audio_url,

        // Structured data
        current_medications: structuredData.medications || [],
        refills_needed: structuredData.refills || [],
        labs_completed: structuredData.labsCompleted,
        labs_details: structuredData.labsDetails,
        labs_needed: structuredData.labsNeeded,
        chief_concerns: structuredData.concerns || [],
        new_symptoms: structuredData.newSymptoms,
        patient_needs: structuredData.needs || {},
        patient_questions: structuredData.questions || [],

        // AI analysis
        ai_summary: structuredData.aiSummary,
        clinical_notes: structuredData.clinicalNotes,
        risk_flags: structuredData.riskFlags || [],
        requires_urgent_callback: structuredData.urgent || false,

        appointment_confirmed: structuredData.appointmentConfirmed,
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`Pre-visit response stored: ${data.id}`);

    // If urgent, send notification to provider
    if (structuredData.urgent) {
      await sendUrgentAlert(metadata.provider_id, metadata.patient_name, structuredData.riskFlags);
    }

    res.json({ success: true, responseId: data.id });

  } catch (error) {
    console.error('Failed to process 11Labs conversation:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Use Claude/GPT-4 to extract structured data from transcript
 */
async function extractStructuredData(transcript: string): Promise<any> {
  // Call Azure OpenAI or Anthropic Claude
  const prompt = `
You are a medical data extraction expert. Parse this pre-visit phone call transcript
and extract the following structured information in JSON format:

{
  "medications": [{"name": "...", "dosage": "...", "frequency": "...", "side_effects": "..."}],
  "refills": [{"medication": "...", "supply_remaining": "..."}],
  "labsCompleted": true/false,
  "labsDetails": "...",
  "labsNeeded": true/false,
  "concerns": [{"concern": "...", "urgency_1_10": 7, "details": "..."}],
  "newSymptoms": "...",
  "needs": {"prescriptions": [], "referrals": [], "forms": [], "advice": true/false},
  "questions": ["...", "..."],
  "appointmentConfirmed": true/false,
  "aiSummary": "2-3 sentence summary for provider dashboard",
  "clinicalNotes": "Formatted clinical notes",
  "riskFlags": ["new-chest-pain", etc],
  "urgent": true if urgent medical concern detected
}

Transcript:
${transcript}

Return only valid JSON with no markdown formatting.
  `;

  // Implementation depends on your AI service
  const response = await azureAIService.chatCompletion({
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1, // Low temp for consistent extraction
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.content);
}

export default router;
```

---

## Call Timing & Retry Strategy

### Recommended Schedule

**Conservative Approach (Recommended for Launch):**

```
DAY -3 (3 days before appointment)
├─ 10:00 AM: Send Klara text notification
│  └─ "Hi [Patient], you have an appointment with Dr. [Name] on [Date] at [Time].
│      Tomorrow you'll receive an automated call to help prepare for your visit.
│      Please answer - it only takes 3-5 minutes!"

DAY -2 (2 days before appointment)
├─ Attempt #1: Between 10:00 AM - 12:00 PM (patient's local time)
│  ├─ If ANSWERED → Conduct interview
│  ├─ If NO ANSWER → Schedule Attempt #2
│  └─ If VOICEMAIL → Hang up silently (attempt #1 only)

DAY -1 (1 day before appointment)
├─ Attempt #2: Between 2:00 PM - 4:00 PM (if Attempt #1 failed)
│  ├─ If ANSWERED → Conduct interview
│  ├─ If NO ANSWER → Schedule Attempt #3
│  └─ If VOICEMAIL → Leave message

DAY 0 (Morning of appointment)
├─ Attempt #3: Between 8:00 AM - 10:00 AM (if Attempts #1-2 failed)
│  ├─ If ANSWERED → Conduct interview (rushed version)
│  ├─ If NO ANSWER → Give up, flag for manual follow-up
│  └─ If VOICEMAIL → Leave urgent message

ONGOING
└─ Staff dashboard shows "No pre-visit response" for manual outreach
```

### Business Rules

1. **Max 3 Attempts** per appointment
   - Prevents harassment
   - TCPA compliance (Telephone Consumer Protection Act)

2. **Time Windows**
   - Respect 9 AM - 7 PM local time only
   - No calls on Sundays (configurable)
   - Avoid lunch hours (12-1 PM) on first attempt

3. **Voicemail Strategy**
   - Attempt #1: Hang up silently if voicemail detected
   - Attempt #2-3: Leave brief message
   - Reasoning: First attempt might be bad timing, don't annoy with voicemail

4. **Opt-Out Respect**
   - Check `patients.opt_out_automated_calls` before calling
   - Honor Do Not Call registry

5. **Emergency Detection**
   - If urgent keywords detected, terminate call immediately
   - Send alert to provider
   - Flag patient record

### Implementation: Call Scheduler

```typescript
// server/jobs/schedulePreVisitCalls.ts
import { CronJob } from 'cron';
import { supabase } from '../../lib/supabase';
import { initiatePreVisitCall } from '../services/twilioService';
import { sendKlaraNotification } from '../services/klaraService';

/**
 * Cron job runs daily at 8:00 AM server time
 * Schedules pre-visit calls for eligible appointments
 */
export const preVisitCallScheduler = new CronJob(
  '0 8 * * *', // Every day at 8 AM
  async () => {
    console.log('Running pre-visit call scheduler...');

    try {
      // DAY -3: Send Klara notifications
      await sendDay3Notifications();

      // DAY -2: First call attempts
      await makeDay2Calls();

      // DAY -1: Second call attempts
      await makeDay1Calls();

      // DAY 0: Final call attempts
      await makeSameDayCalls();

    } catch (error) {
      console.error('Pre-visit call scheduler error:', error);
    }
  },
  null, // onComplete
  true, // start now
  'America/New_York' // timezone
);

async function sendDay3Notifications() {
  const targetDate = addDays(new Date(), 3); // 3 days from now

  const { data: appointments } = await supabase.rpc(
    'get_appointments_needing_previsit_calls',
    { target_date: targetDate }
  );

  for (const appt of appointments || []) {
    // Skip if already sent notification
    const { data: existingNotif } = await supabase
      .from('previsit_notification_log')
      .select('id')
      .eq('appointment_id', appt.appointment_id)
      .single();

    if (existingNotif) continue;

    // Send Klara text
    await sendKlaraNotification({
      patientPhone: appt.patient_phone,
      patientName: appt.patient_name,
      message: `Hi ${appt.patient_name}, you have an appointment on ${formatDate(targetDate)} at ${appt.appointment_time}. Tomorrow you'll receive an automated call to help prepare for your visit. Please answer - it only takes 3-5 minutes!`,
      appointmentId: appt.appointment_id,
    });
  }
}

async function makeDay2Calls() {
  const targetDate = addDays(new Date(), 2); // 2 days from now

  const { data: appointments } = await supabase.rpc(
    'get_appointments_needing_previsit_calls',
    { target_date: targetDate }
  );

  for (const appt of appointments || []) {
    // Skip if already called successfully or if already 3 attempts
    if (appt.already_called || appt.call_attempts >= 3) continue;

    // Calculate local time for patient (if timezone info available)
    const callTime = calculateOptimalCallTime(appt.appointment_time, 1); // Attempt #1

    // Schedule call at optimal time
    await scheduleCallAt(callTime, {
      patientId: appt.patient_id,
      patientName: appt.patient_name,
      patientPhone: appt.patient_phone,
      appointmentId: appt.appointment_id,
      appointmentDate: targetDate,
      appointmentTime: appt.appointment_time,
      attemptNumber: 1,
    });
  }
}

// Similar for makeDay1Calls() and makeSameDayCalls()...

function calculateOptimalCallTime(appointmentTime: string, attemptNumber: number): Date {
  // Attempt #1: 10 AM - 12 PM
  // Attempt #2: 2 PM - 4 PM
  // Attempt #3: 8 AM - 10 AM

  const now = new Date();
  let targetHour: number;

  switch (attemptNumber) {
    case 1:
      targetHour = 10; // 10 AM
      break;
    case 2:
      targetHour = 14; // 2 PM
      break;
    case 3:
      targetHour = 8; // 8 AM
      break;
    default:
      targetHour = 10;
  }

  // Add randomness (±30 min) to distribute load
  const randomMinutes = Math.floor(Math.random() * 60) - 30;

  const callTime = new Date(now);
  callTime.setHours(targetHour, randomMinutes, 0, 0);

  return callTime;
}
```

---

## Klara Text Notifications

### Klara API Integration

```typescript
// server/services/klaraService.ts

/**
 * Send SMS notification via Klara platform
 * Klara is HIPAA-compliant secure messaging
 */

const KLARA_API_KEY = process.env.KLARA_API_KEY;
const KLARA_ORG_ID = process.env.KLARA_ORG_ID;

export async function sendKlaraNotification(options: {
  patientPhone: string;
  patientName: string;
  message: string;
  appointmentId: string;
}): Promise<{ success: boolean; messageId?: string }> {

  try {
    // Klara API call (check Klara docs for exact endpoint)
    const response = await fetch('https://api.klara.com/v2/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KLARA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        organization_id: KLARA_ORG_ID,
        recipient_phone: options.patientPhone,
        message_text: options.message,
        message_type: 'appointment_reminder',
      }),
    });

    if (!response.ok) {
      throw new Error(`Klara API error: ${response.statusText}`);
    }

    const data = await response.json();

    // Log notification
    await supabase
      .from('previsit_notification_log')
      .insert({
        appointment_id: options.appointmentId,
        notification_type: 'klara-text',
        notification_status: 'sent',
        message_content: options.message,
        klara_message_id: data.message_id,
        sent_at: new Date().toISOString(),
      });

    return { success: true, messageId: data.message_id };

  } catch (error) {
    console.error('Failed to send Klara notification:', error);

    await supabase
      .from('previsit_notification_log')
      .insert({
        appointment_id: options.appointmentId,
        notification_type: 'klara-text',
        notification_status: 'failed',
        message_content: options.message,
      });

    return { success: false };
  }
}
```

---

## Schedule Dashboard Integration

### Visual Design

**Before Pre-Visit (No Data):**
```
┌─────────────────────────────────────────────────────────────┐
│ 9:00 AM - John Smith (P-2025-0123)                         │
│ ⏳ Pre-Visit: Pending (Call scheduled for 1/14)            │
│ [Start Dictation]                                           │
└─────────────────────────────────────────────────────────────┘
```

**After Pre-Visit Complete:**
```
┌─────────────────────────────────────────────────────────────┐
│ 9:00 AM - John Smith (P-2025-0123)                         │
│ ✅ Pre-Visit Complete (1/14 @ 2:34 PM)                     │
│                                                             │
│ 📋 SUMMARY:                                                 │
│    • Refills: Metformin 500mg, Lisinopril 10mg             │
│    • Labs: ✓ Done at Quest (1/12)                          │
│    • Chief Concern: Dizziness when standing (Urgency: 7/10) │
│    • Questions: "Is my blood pressure medication working?"  │
│                                                             │
│ 🚩 FLAGS: new-symptoms                                      │
│                                                             │
│ [View Full Transcript] [Start Dictation]                   │
└─────────────────────────────────────────────────────────────┘
```

**Urgent Case:**
```
┌─────────────────────────────────────────────────────────────┐
│ 2:30 PM - Mary Johnson (P-2025-0456)                       │
│ 🚨 URGENT PRE-VISIT RESPONSE                               │
│                                                             │
│ ⚠️  RISK FLAGS: chest-pain, shortness-of-breath            │
│                                                             │
│ Patient reported: "Sharp chest pain for 2 days,            │
│ worse with exertion. Also short of breath."                │
│                                                             │
│ URGENCY: 9/10                                               │
│                                                             │
│ [CALL PATIENT NOW] [View Full Details]                     │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Code

```typescript
// src/pages/DoctorDashboardUnified.tsx (modify existing)

interface AppointmentWithPreVisit {
  // Existing appointment fields
  id: string;
  patient_name: string;
  patient_id: string;
  appointment_time: string;
  appointment_date: string;

  // NEW: Pre-visit data
  previsit_completed: boolean;
  previsit_call_date?: string;
  previsit_summary?: string;
  previsit_flags?: string[];
  previsit_urgency?: string;
  previsit_response_id?: string;

  // Full pre-visit data (loaded on demand)
  previsit_full?: PreVisitResponse;
}

// Fetch appointments with pre-visit data
async function loadTodaysScheduleWithPreVisit(providerId: string): Promise<AppointmentWithPreVisit[]> {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      patient:patients (
        id,
        patient_id,
        full_name,
        phone_primary
      ),
      previsit:previsit_responses (
        id,
        call_completed_at,
        call_status,
        ai_summary,
        risk_flags,
        urgency_level,
        requires_urgent_callback
      )
    `)
    .eq('provider_id', providerId)
    .eq('appointment_date', today)
    .eq('status', 'scheduled')
    .order('appointment_time', { ascending: true });

  if (error) throw error;

  return data.map(appt => ({
    id: appt.id,
    patient_name: appt.patient.full_name,
    patient_id: appt.patient.id,
    appointment_time: appt.appointment_time,
    appointment_date: appt.appointment_date,

    previsit_completed: appt.previsit?.call_status === 'completed',
    previsit_call_date: appt.previsit?.call_completed_at,
    previsit_summary: appt.previsit?.ai_summary,
    previsit_flags: appt.previsit?.risk_flags || [],
    previsit_urgency: appt.previsit?.urgency_level || 'routine',
    previsit_response_id: appt.previsit?.id,
  }));
}

// Component rendering
function AppointmentCard({ appointment }: { appointment: AppointmentWithPreVisit }) {
  const [showFullPreVisit, setShowFullPreVisit] = useState(false);

  return (
    <div className={`appointment-card ${
      appointment.previsit_urgency === 'urgent' ? 'border-red-500 bg-red-50' : 'bg-white'
    }`}>
      {/* Patient Name & Time */}
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-bold">
            {appointment.appointment_time} - {appointment.patient_name}
          </h3>
          <p className="text-sm text-gray-600">
            Patient ID: {appointment.patient_id}
          </p>
        </div>

        {/* Urgent Badge */}
        {appointment.previsit_urgency === 'urgent' && (
          <span className="px-3 py-1 bg-red-600 text-white text-sm font-bold rounded">
            🚨 URGENT
          </span>
        )}
      </div>

      {/* Pre-Visit Status */}
      <div className="mt-3">
        {!appointment.previsit_completed ? (
          <div className="flex items-center gap-2 text-gray-600">
            <Clock className="w-4 h-4" />
            <span className="text-sm">Pre-Visit: Pending</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-green-600 font-semibold mb-2">
              <CheckCircle className="w-5 h-5" />
              <span>Pre-Visit Complete</span>
              <span className="text-xs text-gray-500">
                ({new Date(appointment.previsit_call_date).toLocaleDateString()} @ {new Date(appointment.previsit_call_date).toLocaleTimeString()})
              </span>
            </div>

            {/* Summary */}
            <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-2">
              <h4 className="text-sm font-semibold mb-1">📋 Summary:</h4>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">
                {appointment.previsit_summary}
              </p>
            </div>

            {/* Risk Flags */}
            {appointment.previsit_flags.length > 0 && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold">🚩 Flags:</span>
                {appointment.previsit_flags.map(flag => (
                  <span key={flag} className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
                    {flag}
                  </span>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setShowFullPreVisit(true)}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                View Full Transcript
              </button>
              <button
                onClick={() => startDictationWithPreVisit(appointment)}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
              >
                Start Dictation
              </button>
            </div>
          </>
        )}
      </div>

      {/* Full Pre-Visit Modal */}
      {showFullPreVisit && (
        <PreVisitModal
          previsitId={appointment.previsit_response_id}
          onClose={() => setShowFullPreVisit(false)}
        />
      )}
    </div>
  );
}
```

---

## Dictation Auto-Population

### How It Works

When provider clicks "Start Dictation" from schedule:
1. Load pre-visit response data
2. Build structured note template
3. Pre-fill transcript textarea
4. Provider can record additional notes or proceed to AI processing

### Implementation

```typescript
// src/components/MedicalDictation.tsx (modify existing)

// Add to useEffect that loads patient data
useEffect(() => {
  const loadPreVisitData = async () => {
    // Get appointment ID from session storage (set when clicking from schedule)
    const appointmentId = sessionStorage.getItem('current_appointment_id');

    if (!appointmentId) return;

    // Fetch pre-visit response
    const { data: previsit, error } = await supabase
      .from('previsit_responses')
      .select('*')
      .eq('appointment_id', appointmentId)
      .eq('call_status', 'completed')
      .single();

    if (error || !previsit) {
      console.log('No pre-visit data available');
      return;
    }

    // Build pre-filled note
    const prefilledNote = buildPreVisitNote(previsit);

    // Set transcript
    setTranscript(prefilledNote);

    // Show notification
    toast.success(`Pre-visit data loaded! Patient was called on ${new Date(previsit.call_completed_at).toLocaleDateString()}`);
  };

  loadPreVisitData();
}, [patientId]);

function buildPreVisitNote(previsit: PreVisitResponse): string {
  const callDate = new Date(previsit.call_completed_at).toLocaleDateString();

  let note = `
╔════════════════════════════════════════════════════════════╗
║  PRE-VISIT READINESS SUMMARY                               ║
║  Automated call completed: ${callDate}                     ║
║  Call duration: ${Math.floor(previsit.call_duration_seconds / 60)} minutes              ║
╚════════════════════════════════════════════════════════════╝

`;

  // MEDICATIONS
  if (previsit.current_medications?.length > 0) {
    note += `\n📋 CURRENT MEDICATIONS (Per Patient):\n`;
    previsit.current_medications.forEach((med: any) => {
      note += `   • ${med.name} ${med.dosage || ''} ${med.frequency || ''}\n`;
      if (med.side_effects) {
        note += `     └─ Side effects: ${med.side_effects}\n`;
      }
    });
  }

  // REFILLS
  if (previsit.refills_needed?.length > 0) {
    note += `\n💊 REFILLS REQUESTED:\n`;
    previsit.refills_needed.forEach((refill: any) => {
      note += `   • ${refill.medication}`;
      if (refill.supply_remaining) {
        note += ` (${refill.supply_remaining} remaining)`;
      }
      note += `\n`;
    });
  }

  // LABS
  note += `\n🔬 LAB WORK:\n`;
  if (previsit.labs_completed) {
    note += `   ✓ Completed - ${previsit.labs_details || 'Details not specified'}\n`;
  } else {
    note += `   ✗ Not completed\n`;
  }
  if (previsit.labs_needed) {
    note += `   Patient requests new lab orders\n`;
  }

  // CHIEF CONCERNS
  if (previsit.chief_concerns?.length > 0) {
    note += `\n⚠️  CHIEF CONCERNS:\n`;
    previsit.chief_concerns.forEach((concern: any, index: number) => {
      note += `   ${index + 1}. ${concern.concern}`;
      if (concern.urgency_1_10) {
        note += ` (Urgency: ${concern.urgency_1_10}/10)`;
      }
      note += `\n`;
      if (concern.details) {
        note += `      Details: ${concern.details}\n`;
      }
    });
  }

  // NEW SYMPTOMS
  if (previsit.new_symptoms) {
    note += `\n🩺 NEW SYMPTOMS:\n   ${previsit.new_symptoms}\n`;
  }

  // PATIENT NEEDS
  const needs = previsit.patient_needs || {};
  if (Object.values(needs).some((arr: any) => arr?.length > 0 || arr === true)) {
    note += `\n📝 PATIENT NEEDS:\n`;
    if (needs.prescriptions?.length > 0) {
      note += `   • Prescriptions: ${needs.prescriptions.join(', ')}\n`;
    }
    if (needs.referrals?.length > 0) {
      note += `   • Referrals: ${needs.referrals.join(', ')}\n`;
    }
    if (needs.forms?.length > 0) {
      note += `   • Forms: ${needs.forms.join(', ')}\n`;
    }
    if (needs.advice) {
      note += `   • Medical advice requested\n`;
    }
  }

  // PATIENT QUESTIONS
  if (previsit.patient_questions?.length > 0) {
    note += `\n❓ PATIENT QUESTIONS:\n`;
    previsit.patient_questions.forEach((q: string, index: number) => {
      note += `   ${index + 1}. ${q}\n`;
    });
  }

  // APPOINTMENT CONFIRMATION
  note += `\n✅ APPOINTMENT STATUS:\n`;
  if (previsit.appointment_confirmed) {
    note += `   Patient confirmed they will attend\n`;
  } else {
    note += `   ⚠️  Patient did NOT confirm attendance\n`;
  }

  // RISK FLAGS
  if (previsit.risk_flags?.length > 0) {
    note += `\n🚩 CLINICAL FLAGS:\n`;
    previsit.risk_flags.forEach((flag: string) => {
      note += `   • ${flag}\n`;
    });
  }

  note += `\n${'─'.repeat(60)}\n`;
  note += `PROVIDER DICTATION BEGINS HERE:\n\n`;

  return note;
}
```

---

## Implementation Phases

### Phase 1: Patient ID System (Week 1-2)
**Goal:** Establish foundation for patient tracking

**Tasks:**
- [ ] Create `patients` table in Supabase (run SQL schema)
- [ ] Build `findOrCreatePatient()` function with matching logic
- [ ] Implement patient ID generation (P-YYYY-####)
- [ ] Modify schedule import to auto-create patients
- [ ] Test with existing schedule data
- [ ] Add UI to view/edit patient records

**Deliverables:**
- Working patient table with RLS policies
- All scheduled appointments link to patient UUIDs
- Patient IDs visible on schedule

**Testing:**
- Import 100 appointments → verify correct patient matching
- Import same schedule again → should NOT create duplicates
- Test fuzzy name matching edge cases

---

### Phase 2: Database Schema & APIs (Week 2-3)
**Goal:** Build data storage infrastructure

**Tasks:**
- [ ] Create `previsit_responses` table
- [ ] Create `previsit_call_log` table
- [ ] Create `previsit_notification_log` table
- [ ] Set up indexes and triggers
- [ ] Build API endpoints:
  - POST `/api/previsit/store-response`
  - GET `/api/previsit/response/:id`
  - GET `/api/previsit/by-appointment/:appointmentId`
- [ ] Test data insertion and retrieval

**Deliverables:**
- Complete database schema deployed
- REST API endpoints functional
- RLS policies working

**Testing:**
- Manually insert mock pre-visit data
- Verify provider can only see their own patients' data
- Performance test with 1000+ records

---

### Phase 3: Twilio Setup (Week 3-4)
**Goal:** Get outbound calling working

**Tasks:**
- [ ] Sign up for Twilio account
- [ ] Purchase phone number
- [ ] Sign HIPAA BAA with Twilio
- [ ] Set up Twilio credentials in environment
- [ ] Build `twilioService.ts`
- [ ] Create `/api/twilio/previsit-twiml` webhook
- [ ] Create `/api/twilio/call-status` webhook
- [ ] Test calling YOUR cell phone first!

**Deliverables:**
- Working outbound call system
- Can call a number and hear TwiML response
- Call status updates logged

**Testing:**
- Call 10 different phone numbers
- Test voicemail detection
- Test with busy signals, no answer, etc.

---

### Phase 4: 11Labs Integration (Week 4-5)
**Goal:** Add AI conversation

**Tasks:**
- [ ] Sign up for 11Labs Conversational AI
- [ ] Sign HIPAA BAA with 11Labs
- [ ] Create AI agent with pre-visit script
- [ ] Test agent via 11Labs dashboard
- [ ] Connect Twilio to 11Labs WebSocket
- [ ] Build conversation data extraction logic (using Claude/GPT-4)
- [ ] Create `/api/elevenlabs/conversation-complete` webhook
- [ ] Test end-to-end: Call → AI conversation → Data stored

**Deliverables:**
- Working AI agent
- Full transcript captured
- Structured data extracted and stored

**Testing:**
- Have 5 staff members role-play patient calls
- Verify data extraction accuracy (>90% accuracy)
- Test edge cases (patient hangs up early, very short responses)

---

### Phase 5: Call Scheduler & Klara Integration (Week 5-6)
**Goal:** Automate the workflow

**Tasks:**
- [ ] Build cron job `schedulePreVisitCalls.ts`
- [ ] Integrate Klara API for text notifications
- [ ] Implement Day -3, Day -2, Day -1 logic
- [ ] Build retry mechanism (max 3 attempts)
- [ ] Add time zone handling
- [ ] Test with small pilot group (5-10 patients)

**Deliverables:**
- Fully automated call system
- Klara texts sending correctly
- Retry logic working

**Testing:**
- Schedule test appointments for tomorrow
- Verify Day -2 calls happen automatically
- Test retry on no-answer

---

### Phase 6: Schedule & Dictation UI (Week 6-7)
**Goal:** Show pre-visit data to providers

**Tasks:**
- [ ] Modify `DoctorDashboardUnified.tsx` to show pre-visit summaries
- [ ] Build `PreVisitModal` component for full transcript
- [ ] Modify `MedicalDictation.tsx` to auto-load pre-visit data
- [ ] Add visual indicators (✅ complete, ⏳ pending, 🚩 urgent)
- [ ] Build provider feedback UI ("Was this helpful?")

**Deliverables:**
- Schedule shows pre-visit summaries
- Dictation auto-populates with pre-visit data
- Providers can view full transcripts

**Testing:**
- Provider logs in and sees schedule with pre-visit data
- Clicks "Start Dictation" and sees pre-filled template
- Can still dictate additional notes

---

### Phase 7: Pilot & Iteration (Week 7-8)
**Goal:** Launch to real patients and optimize

**Tasks:**
- [ ] Start with 10 patients/day
- [ ] Monitor completion rates
- [ ] Gather provider feedback
- [ ] Refine AI script based on real conversations
- [ ] Fix bugs and edge cases
- [ ] Scale to 50 patients/day
- [ ] Scale to 100+ patients/day

**Deliverables:**
- System running in production
- >50% call completion rate
- Providers report time savings
- Documentation complete

**Success Criteria:**
- 60%+ patients complete pre-visit call
- 3+ minutes saved per patient visit
- <5% urgent flags requiring immediate callback
- 95%+ provider satisfaction

---

## Cost Analysis & ROI

### Monthly Costs (100 calls/day)

**Twilio:**
- Phone number: $1/month
- Outbound calls: $0.013/minute × 4 min avg × 100 calls × 22 days = $114/month
- **Total Twilio: ~$115/month**

**11Labs Conversational AI:**
- Estimate: $0.10-0.30 per minute of conversation
- Assuming $0.20/min × 4 min × 100 calls × 22 days = $1,760/month
- **Total 11Labs: ~$1,760/month**

**Klara Text Messages:**
- Estimate: $0.05 per text
- 100 texts/day × 22 days = $110/month
- **Total Klara: ~$110/month**

**Infrastructure (AWS/Azure for storage):**
- Audio storage: ~$50/month
- **Total Infrastructure: ~$50/month**

**TOTAL MONTHLY COST: ~$2,035 for 100 calls/day**

### Return on Investment

**Time Savings:**
- 100 patients/day × 3 minutes saved = 300 minutes = 5 hours/day
- 5 hours × 22 workdays = 110 hours/month
- At $200/hour provider rate = **$22,000/month value**

**Additional Benefits:**
- Reduced no-shows (10% improvement) = ~$5,000/month additional revenue
- Better patient satisfaction = higher retention
- Earlier detection of urgent issues = better outcomes

**NET ROI: $22,000 - $2,035 = $19,965/month profit**
**Payback Period: Immediate (positive ROI from day 1)**

---

## HIPAA Compliance

### Checklist

**Vendor BAAs Required:**
- [ ] Twilio - Sign Business Associate Agreement
- [ ] 11Labs - Sign Business Associate Agreement
- [ ] Klara - Sign Business Associate Agreement (likely already done)
- [ ] Supabase - Already signed (current provider)

**Data Encryption:**
- [ ] All audio recordings encrypted at rest (S3/Azure with encryption)
- [ ] All transcripts encrypted in database
- [ ] TLS/SSL for all API communications
- [ ] No PHI in logs or error messages

**Access Controls:**
- [ ] Row Level Security (RLS) enforced in Supabase
- [ ] Providers can only see their own patients
- [ ] Service role keys secured in environment variables
- [ ] API endpoints require authentication

**Audit Trail:**
- [ ] All calls logged with timestamps
- [ ] All data access logged
- [ ] Provider actions tracked (who viewed what, when)

**Patient Rights:**
- [ ] Patients can opt-out of automated calls
- [ ] Patients can request transcript deletion
- [ ] Data retention policy (delete after 7 years)

**Call Recording Consent:**
- [ ] AI states "This call may be recorded" at start
- [ ] Check state-specific two-party consent laws
- [ ] Document consent in database

**Emergency Protocols:**
- [ ] AI detects urgent keywords and escalates
- [ ] Staff notified immediately of urgent flags
- [ ] Patients instructed to call 911 for emergencies

---

## Success Metrics

### Key Performance Indicators (KPIs)

**Call Metrics:**
- Call Answer Rate: Target >40% (industry standard 30-40%)
- Call Completion Rate: Target >60%
- Average Call Duration: Target 3-5 minutes
- Voicemail Rate: Track (should decrease after attempt 1)

**Data Quality:**
- Medication List Completeness: Target >90%
- Chief Concern Captured: Target >85%
- Transcript Accuracy: Target >95% (manual QA sample)

**Provider Impact:**
- Time Saved Per Visit: Target 3-5 minutes
- Provider Satisfaction: Target >8/10
- Pre-Visit Data Used: Target >80% of cases

**Patient Impact:**
- Patient Satisfaction: Target >7/10 (survey after visit)
- No-Show Rate: Target 10% reduction
- Appointment Confirmation: Target >70%

**Clinical Outcomes:**
- Urgent Issues Detected Early: Track count
- Medication Errors Prevented: Track count
- Labs Completed Before Visit: Target 20% improvement

### Dashboard to Track Metrics

Build admin dashboard showing:
- Daily call volume and completion rates
- Average time savings per day
- Urgent flags requiring attention
- Patient feedback scores
- Cost per call
- ROI calculation

---

## Testing Plan

### Unit Testing

**Phase 3-4: Twilio & 11Labs:**
- [ ] Test call initiation with valid/invalid phone numbers
- [ ] Test voicemail detection accuracy
- [ ] Test 11Labs conversation with various responses
- [ ] Test data extraction with sample transcripts

**Phase 5: Scheduler:**
- [ ] Test cron job triggers at correct times
- [ ] Test retry logic (should stop after 3 attempts)
- [ ] Test time zone calculations

**Phase 6: UI:**
- [ ] Test pre-visit data displays correctly
- [ ] Test dictation auto-population
- [ ] Test modal interactions

### Integration Testing

- [ ] End-to-end test: Schedule import → Patient created → Call scheduled → Call made → Data stored → UI displays
- [ ] Test with real phone calls (use test patients)
- [ ] Test edge cases:
  - Patient hangs up immediately
  - Patient gives incomplete information
  - Patient mentions urgent symptoms
  - Multiple calls for same appointment

### User Acceptance Testing (UAT)

**Week 7:**
- [ ] 5-10 real patients per day
- [ ] Provider reviews pre-visit data daily
- [ ] Gather feedback from providers
- [ ] Gather feedback from patients (post-visit survey)

**Week 8:**
- [ ] Scale to 50 patients/day
- [ ] Monitor error rates
- [ ] Refine AI script based on feedback
- [ ] Fix bugs discovered during pilot

---

## Troubleshooting Guide

### Issue: Calls Not Being Initiated

**Check:**
1. Cron job running? Check logs: `pm2 logs previsit-scheduler`
2. Appointments in database for tomorrow?
3. Patients have valid phone numbers?
4. Twilio credentials correct in `.env`?
5. Twilio account has sufficient balance?

**Fix:**
- Manually trigger scheduler: `node server/jobs/schedulePreVisitCalls.ts`
- Check Supabase query: `SELECT * FROM get_appointments_needing_previsit_calls()`

---

### Issue: 11Labs Not Responding

**Check:**
1. WebSocket connection established? Check Twilio logs
2. 11Labs agent ID correct?
3. 11Labs API key valid?
4. Agent conversation settings correct?

**Fix:**
- Test 11Labs agent directly in dashboard
- Check Twilio TwiML webhook logs for errors
- Verify WebSocket URL format

---

### Issue: Data Not Saving to Supabase

**Check:**
1. `/api/elevenlabs/conversation-complete` webhook receiving data?
2. Data extraction working? Check logs
3. Supabase RLS policies blocking insert?
4. Service role key being used (not user JWT)?

**Fix:**
- Test data insertion manually via Supabase dashboard
- Check Supabase logs for errors
- Verify RLS policies allow system inserts

---

### Issue: Pre-Visit Data Not Showing on Schedule

**Check:**
1. Data exists in `previsit_responses` table?
2. Appointment ID correctly linked?
3. Query joining tables correctly?
4. RLS policies allowing provider to see data?

**Fix:**
- Query directly: `SELECT * FROM previsit_responses WHERE appointment_id = 'xxx'`
- Check `appointment_id` matches between tables
- Test with service role key to bypass RLS

---

## Implementation Checklist

### Phase 1: Database Foundation (Week 1-2) ⏳ IN PROGRESS

#### 1.1 Supabase Schema Setup
- [ ] **Create `patients` table**
  - [ ] Run SQL schema (lines 472-529)
  - [ ] Add patient_id (P-2025-####) with UNIQUE constraint
  - [ ] Add demographics fields (name, DOB, gender)
  - [ ] Add contact fields (phone, email)
  - [ ] Add insurance fields
  - [ ] Add provider_id foreign key
  - [ ] Add opt-out flags for automated calls
  - [ ] Create indexes on phone, name, DOB
  - [ ] Enable RLS policies
  - [ ] Test insert/update operations

- [ ] **Create `previsit_responses` table**
  - [ ] Run SQL schema (lines 534-599)
  - [ ] Add patient_id, appointment_id foreign keys
  - [ ] Add call metadata fields (Twilio SID, 11Labs conversation ID)
  - [ ] Add JSONB fields for structured data (medications, concerns)
  - [ ] Add AI analysis fields (summary, flags, urgency)
  - [ ] Add provider review fields
  - [ ] Create indexes
  - [ ] Enable RLS policies
  - [ ] Test data insertion

- [ ] **Create `previsit_call_log` table**
  - [ ] Run SQL schema (lines 604-621)
  - [ ] Add attempt tracking (1, 2, 3)
  - [ ] Add call status field
  - [ ] Add Twilio call SID
  - [ ] Create indexes
  - [ ] Enable RLS

- [ ] **Create `previsit_notification_log` table**
  - [ ] Run SQL schema (lines 626-643)
  - [ ] Add notification type (klara-text, email)
  - [ ] Add delivery status tracking
  - [ ] Add Klara message ID
  - [ ] Create indexes
  - [ ] Enable RLS

- [ ] **Add Helper Functions**
  - [ ] Create `get_appointments_needing_previsit_calls()` function (lines 746-782)
  - [ ] Test function with sample data
  - [ ] Verify performance with 100+ appointments

#### 1.2 Patient Service Development
- [ ] **Create `server/services/patient.service.ts`**
  - [ ] Import Supabase client
  - [ ] Define TypeScript interfaces (PatientCreateData, etc.)
  - [ ] Build `findOrCreatePatient()` function
    - [ ] Step 1: Try exact match by phone
    - [ ] Step 2: Try match by name + DOB
    - [ ] Step 3: Try fuzzy name match for same provider
    - [ ] Step 4: Create new patient if no match
  - [ ] Build `createNewPatient()` function
    - [ ] Generate sequential patient ID (P-YYYY-####)
    - [ ] Handle concurrent ID generation
    - [ ] Insert patient record
    - [ ] Return patient UUID
  - [ ] Build `updateLastAppointment()` helper
  - [ ] Build `cleanPhone()` utility (strip non-digits)
  - [ ] Build `calculateNameSimilarity()` for fuzzy matching
  - [ ] Export all functions

- [ ] **Unit Tests for Patient Service**
  - [ ] Test exact phone match
  - [ ] Test name+DOB match
  - [ ] Test fuzzy name matching
  - [ ] Test new patient creation
  - [ ] Test duplicate prevention
  - [ ] Test patient ID sequence generation

#### 1.3 Schedule Import Enhancement
- [ ] **Modify `src/services/scheduleDatabase.service.ts`**
  - [ ] Import patient.service
  - [ ] Update `saveAppointment()` method
    - [ ] Call `findOrCreatePatient()` before saving appointment
    - [ ] Store patient UUID in appointment record
    - [ ] Handle patient creation errors gracefully
  - [ ] Update appointment table to include patient_id FK
  - [ ] Add migration script for existing appointments

- [ ] **Test Schedule Import with Patient Creation**
  - [ ] Import 10 test appointments → verify patients created
  - [ ] Import same 10 again → verify no duplicates
  - [ ] Import 100 appointments → check performance (<5 seconds)
  - [ ] Test with missing phone numbers
  - [ ] Test with duplicate names

---

### Phase 2: Twilio Integration (Week 2-3)

#### 2.1 Twilio Account Setup
- [ ] **Sign up and configure Twilio account**
  - [ ] Create account at twilio.com
  - [ ] Upgrade from trial to paid
  - [ ] Purchase phone number ($1/month)
  - [ ] Enable Voice API
  - [ ] Sign HIPAA Business Associate Agreement
  - [ ] Get Account SID and Auth Token
  - [ ] Add credentials to `.env`:
    ```
    TWILIO_ACCOUNT_SID=ACxxxxxxxxxx
    TWILIO_AUTH_TOKEN=xxxxxxxxxx
    TWILIO_PHONE_NUMBER=+15555551234
    OFFICE_PHONE_NUMBER=+15555556789
    ```

- [ ] **Install Twilio SDK**
  - [ ] Run: `npm install twilio --save`
  - [ ] Update package.json

#### 2.2 Twilio Service Development
- [ ] **Create `server/services/twilioService.ts`**
  - [ ] Import twilio SDK
  - [ ] Initialize Twilio client with credentials
  - [ ] Define `InitiatePreVisitCallOptions` interface
  - [ ] Build `initiatePreVisitCall()` function
    - [ ] Create call with Twilio API
    - [ ] Set TwiML webhook URL
    - [ ] Configure machine detection
    - [ ] Pass patient context data
    - [ ] Set timeout (30 seconds)
    - [ ] Handle errors
  - [ ] Build `logCallAttempt()` helper
  - [ ] Export functions

#### 2.3 API Endpoints for Twilio Webhooks
- [ ] **Create `server/api/twilio/previsit-twiml.ts`**
  - [ ] Set up Express router
  - [ ] Import twilio.twiml.VoiceResponse
  - [ ] Handle POST request
  - [ ] Check AnsweredBy for voicemail detection
    - [ ] If machine on attempt 1: hangup
    - [ ] If machine on attempt 2-3: leave voicemail
  - [ ] If human answered: connect to 11Labs WebSocket
  - [ ] Return TwiML XML response

- [ ] **Create `server/api/twilio/call-status.ts`**
  - [ ] Set up Express router
  - [ ] Handle POST request from Twilio
  - [ ] Extract CallSid, CallStatus, CallDuration
  - [ ] Update `previsit_call_log` in Supabase
  - [ ] Log call completion
  - [ ] Return 200 status

- [ ] **Update main server file to mount routes**
  - [ ] Import Twilio route modules
  - [ ] Mount at `/api/twilio/previsit-twiml`
  - [ ] Mount at `/api/twilio/call-status`
  - [ ] Test endpoints with curl

#### 2.4 Testing Twilio Integration
- [ ] **Local testing**
  - [ ] Use ngrok to expose localhost: `ngrok http 3000`
  - [ ] Update Twilio webhook URLs to ngrok URL
  - [ ] Make test call to YOUR phone number
  - [ ] Verify call connects
  - [ ] Verify TwiML response received
  - [ ] Test voicemail detection (let call go to VM)

- [ ] **Integration testing**
  - [ ] Test 10 calls to different numbers
  - [ ] Verify call status updates in database
  - [ ] Test busy signal handling
  - [ ] Test no-answer timeout
  - [ ] Test call failure scenarios

---

### Phase 3: 11Labs AI Integration (Week 3-4)

#### 3.1 11Labs Account Setup
- [ ] **Configure 11Labs**
  - [ ] Sign up at elevenlabs.io
  - [ ] Upgrade to Conversational AI plan (paid)
  - [ ] Sign HIPAA Business Associate Agreement
  - [ ] Get API key
  - [ ] Add to `.env`:
    ```
    ELEVENLABS_API_KEY=xxxxxxxxxx
    ELEVENLABS_AGENT_ID=agent_xxxxxxxxxx
    ```

- [ ] **Create AI Agent in 11Labs Dashboard**
  - [ ] Name: "TSHLA Pre-Visit Assistant"
  - [ ] Copy system prompt from lines 100-106
  - [ ] Copy conversation script from lines 112-243
  - [ ] Select professional voice (e.g., "Sarah" or "Rachel")
  - [ ] Configure settings:
    - [ ] Max duration: 10 minutes
    - [ ] Enable transcript logging
    - [ ] Enable audio recording
    - [ ] Response latency: Low
  - [ ] Test agent with sample conversation
  - [ ] Refine prompts based on testing

#### 3.2 AI Data Extraction Service
- [ ] **Create `server/services/aiExtraction.service.ts`**
  - [ ] Import OpenAI SDK (already in package.json)
  - [ ] Define `ExtractedData` TypeScript interface
  - [ ] Build `extractStructuredData(transcript: string)` function
    - [ ] Create prompt for GPT-4/Claude
    - [ ] Request JSON format output
    - [ ] Parse medications list
    - [ ] Parse refills needed
    - [ ] Parse lab work status
    - [ ] Parse chief concerns with urgency
    - [ ] Parse patient questions
    - [ ] Generate AI summary (2-3 sentences)
    - [ ] Generate clinical notes
    - [ ] Detect risk flags (chest-pain, urgent-symptoms)
    - [ ] Set urgency level
  - [ ] Build `detectUrgentKeywords()` helper
  - [ ] Export functions

- [ ] **Test Data Extraction**
  - [ ] Create 10 sample transcripts
  - [ ] Run extraction on each
  - [ ] Verify >90% accuracy
  - [ ] Test edge cases (incomplete responses, unclear audio)

#### 3.3 11Labs Webhook
- [ ] **Create `server/api/elevenlabs/conversation-complete.ts`**
  - [ ] Set up Express router
  - [ ] Handle POST request from 11Labs
  - [ ] Extract conversation_id, transcript, audio_url, metadata
  - [ ] Call `extractStructuredData(transcript)`
  - [ ] Insert into `previsit_responses` table
    - [ ] Store patient_id, appointment_id
    - [ ] Store call metadata (duration, timestamps)
    - [ ] Store structured data (medications, concerns)
    - [ ] Store AI analysis (summary, flags)
  - [ ] If urgent flag detected:
    - [ ] Send alert to provider (email/SMS)
    - [ ] Log urgent notification
  - [ ] Return success response

- [ ] **Update main server to mount route**
  - [ ] Import 11Labs route module
  - [ ] Mount at `/api/elevenlabs/conversation-complete`
  - [ ] Test with sample POST data

#### 3.4 End-to-End Testing
- [ ] **Complete call flow test**
  - [ ] Trigger call via Twilio
  - [ ] Answer and complete AI interview
  - [ ] Verify transcript saved
  - [ ] Verify data extracted correctly
  - [ ] Verify record in `previsit_responses` table
  - [ ] Verify audio recording URL accessible

- [ ] **Role-play testing**
  - [ ] Have 5 staff members act as patients
  - [ ] Each completes full interview
  - [ ] Review extracted data accuracy
  - [ ] Gather feedback on AI conversation quality
  - [ ] Refine script based on feedback

---

### Phase 4: Call Scheduler & Automation (Week 4-5)

#### 4.1 Klara Integration (Text Notifications)
- [ ] **Create `server/services/klaraService.ts`**
  - [ ] Get Klara API credentials
  - [ ] Add to `.env`:
    ```
    KLARA_API_KEY=xxxxxxxxxx
    KLARA_ORG_ID=xxxxxxxxxx
    ```
  - [ ] Import fetch/axios
  - [ ] Define `KlaraNotificationOptions` interface
  - [ ] Build `sendKlaraNotification()` function
    - [ ] POST to Klara API
    - [ ] Format message text
    - [ ] Handle delivery status
    - [ ] Log to `previsit_notification_log`
  - [ ] Export function

#### 4.2 Cron Job Scheduler
- [ ] **Create `server/jobs/schedulePreVisitCalls.ts`**
  - [ ] Import `node-cron` (already in package.json)
  - [ ] Import all services (twilio, klara, patient)
  - [ ] Define `preVisitCallScheduler` CronJob
    - [ ] Schedule: '0 8 * * *' (8 AM daily)
    - [ ] Timezone: 'America/New_York'
  - [ ] Build `sendDay3Notifications()` function
    - [ ] Query appointments 3 days out
    - [ ] Filter out already notified
    - [ ] Send Klara text to each patient
  - [ ] Build `makeDay2Calls()` function
    - [ ] Query appointments 2 days out
    - [ ] Filter out completed/opt-out
    - [ ] Calculate optimal call time (10 AM-12 PM)
    - [ ] Initiate Twilio calls
  - [ ] Build `makeDay1Calls()` function
    - [ ] Query appointments 1 day out
    - [ ] Only call if attempt #1 failed
    - [ ] Call window: 2-4 PM
  - [ ] Build `makeSameDayCalls()` function
    - [ ] Query today's appointments
    - [ ] Only call if attempts #1-2 failed
    - [ ] Call window: 8-10 AM
  - [ ] Build `calculateOptimalCallTime()` helper
    - [ ] Add randomness (±30 min) to distribute load
    - [ ] Respect time zones
  - [ ] Export scheduler

- [ ] **Configure PM2 for Cron Jobs**
  - [ ] Update `ecosystem.config.cjs`
  - [ ] Add previsit-scheduler process
  - [ ] Set environment variables
  - [ ] Configure restart policy

#### 4.3 Testing Call Scheduler
- [ ] **Local testing**
  - [ ] Create test appointments for tomorrow
  - [ ] Manually trigger scheduler: `node server/jobs/schedulePreVisitCalls.ts`
  - [ ] Verify Day -2 calls triggered
  - [ ] Verify call log entries created

- [ ] **Retry logic testing**
  - [ ] Let first call go to voicemail
  - [ ] Wait for Day -1 scheduler run
  - [ ] Verify second attempt made
  - [ ] Let second call fail
  - [ ] Verify third attempt on Day 0

- [ ] **Production simulation**
  - [ ] Schedule 50 test appointments across 3 days
  - [ ] Let scheduler run for 3 days
  - [ ] Monitor completion rates
  - [ ] Check for errors/crashes

---

### Phase 5: Dashboard & Dictation UI (Week 5-6)

#### 5.1 Schedule Dashboard Updates
- [ ] **Modify `src/pages/DoctorDashboardUnified.tsx`**
  - [ ] Define `AppointmentWithPreVisit` interface
  - [ ] Create `loadTodaysScheduleWithPreVisit()` function
    - [ ] Query appointments with LEFT JOIN to previsit_responses
    - [ ] Include patient data
    - [ ] Include pre-visit summary, flags, urgency
  - [ ] Update state to include pre-visit data
  - [ ] Modify `AppointmentCard` component
    - [ ] Add pre-visit status badge
      - [ ] ✅ Complete (green)
      - [ ] ⏳ Pending (gray)
      - [ ] 🚨 Urgent (red)
    - [ ] Show AI summary in card
    - [ ] Show risk flags as pills
    - [ ] Add "View Full Transcript" button
  - [ ] Style urgent appointments (red border)

- [ ] **Create `src/components/PreVisitModal.tsx`**
  - [ ] Build modal component (using existing modal pattern)
  - [ ] Accept `previsitResponseId` prop
  - [ ] Fetch full pre-visit data on mount
  - [ ] Display sections:
    - [ ] Call metadata (date, duration)
    - [ ] Medications list (formatted)
    - [ ] Refills needed
    - [ ] Lab work status
    - [ ] Chief concerns with urgency
    - [ ] New symptoms
    - [ ] Patient questions
    - [ ] Risk flags
    - [ ] Full transcript (expandable)
    - [ ] Audio playback (if available)
  - [ ] Add provider notes section (editable)
  - [ ] Add "Mark as Reviewed" button
  - [ ] Style with Tailwind

#### 5.2 Dictation Auto-Population
- [ ] **Modify `src/components/MedicalDictation.tsx`**
  - [ ] Add `loadPreVisitData()` function
    - [ ] Get appointmentId from sessionStorage
    - [ ] Query `previsit_responses` for that appointment
    - [ ] If found, call `buildPreVisitNote()`
  - [ ] Build `buildPreVisitNote()` function
    - [ ] Format medications section
    - [ ] Format refills section
    - [ ] Format labs section
    - [ ] Format chief concerns section
    - [ ] Format new symptoms section
    - [ ] Format patient needs section
    - [ ] Format patient questions section
    - [ ] Add separator for provider dictation
  - [ ] Call `loadPreVisitData()` in useEffect
  - [ ] Set formatted note as initial transcript
  - [ ] Show toast notification: "Pre-visit data loaded!"
  - [ ] Keep recording functionality working

- [ ] **Test auto-population**
  - [ ] Create test pre-visit response
  - [ ] Click "Start Dictation" from schedule
  - [ ] Verify transcript pre-filled
  - [ ] Verify can still record additional notes
  - [ ] Verify final note combines pre-visit + dictation

#### 5.3 UI/UX Polish
- [ ] **Visual design**
  - [ ] Use consistent color scheme (green=complete, red=urgent)
  - [ ] Add loading states for all API calls
  - [ ] Add error states with retry buttons
  - [ ] Optimize mobile responsive layout

- [ ] **Accessibility**
  - [ ] Add ARIA labels to all buttons
  - [ ] Ensure keyboard navigation works
  - [ ] Add screen reader support

---

### Phase 6: Analytics & Monitoring (Week 6-7)

#### 6.1 Analytics Dashboard
- [ ] **Create `src/pages/PreVisitAnalytics.tsx`**
  - [ ] Build metrics cards:
    - [ ] Total calls made (today, this week, this month)
    - [ ] Completion rate (answered / attempted)
    - [ ] Average call duration
    - [ ] Time savings (3 min × completed calls)
    - [ ] Cost per call
    - [ ] ROI calculation
  - [ ] Build charts:
    - [ ] Call volume over time (line chart)
    - [ ] Completion rate by day of week (bar chart)
    - [ ] Urgent flags by type (pie chart)
  - [ ] Build tables:
    - [ ] Recent calls log
    - [ ] Urgent cases requiring follow-up
    - [ ] Patients who didn't answer (3 attempts)
  - [ ] Add date range filter
  - [ ] Add export to CSV button

#### 6.2 Provider Feedback System
- [ ] **Add feedback prompt to dictation**
  - [ ] After using pre-visit data, show modal:
    - [ ] "Was the pre-visit data helpful?"
    - [ ] Rating: 1-5 stars
    - [ ] Optional comment field
  - [ ] Store feedback in new table: `previsit_feedback`
  - [ ] Track feedback metrics in analytics

#### 6.3 Error Monitoring
- [ ] **Set up logging**
  - [ ] Use Winston (already in package.json)
  - [ ] Log all Twilio errors
  - [ ] Log all 11Labs errors
  - [ ] Log all Supabase errors
  - [ ] Configure daily log rotation

- [ ] **Set up alerts**
  - [ ] Email alert if call failure rate >20%
  - [ ] Email alert if urgent flag detected
  - [ ] Email alert if cron job fails

---

### Phase 7: Pilot & Production (Week 7-8)

#### 7.1 Pilot Launch (Week 7)
- [ ] **Start with 10 patients/day**
  - [ ] Select 1-2 providers for pilot
  - [ ] Manually select low-risk patients
  - [ ] Monitor completion rates hourly
  - [ ] Gather provider feedback daily

- [ ] **Daily review meetings**
  - [ ] Review call transcripts
  - [ ] Check data extraction accuracy
  - [ ] Identify issues/bugs
  - [ ] Refine AI script as needed

- [ ] **Scale to 50 patients/day (mid-week)**
  - [ ] Add more providers
  - [ ] Monitor system performance
  - [ ] Check Twilio/11Labs costs

#### 7.2 Production Deployment (Week 8)
- [ ] **Environment setup**
  - [ ] Add all credentials to Azure Key Vault
  - [ ] Update GitHub Actions workflows
  - [ ] Deploy cron job to production server
  - [ ] Configure PM2 to start scheduler on boot

- [ ] **Security audit**
  - [ ] Verify all BAAs signed (Twilio, 11Labs, Klara)
  - [ ] Test RLS policies in production
  - [ ] Verify call recording encryption
  - [ ] Audit PHI access logs
  - [ ] Review error logs for exposed PHI

- [ ] **Go live**
  - [ ] Enable for all providers
  - [ ] Scale to 100+ patients/day
  - [ ] Monitor error rates
  - [ ] Set up daily reports

#### 7.3 Documentation
- [ ] **Create user documentation**
  - [ ] Provider guide: How to read pre-visit summaries
  - [ ] Staff guide: How to troubleshoot call issues
  - [ ] Patient FAQ: What to expect from AI call

- [ ] **Update technical documentation**
  - [ ] API documentation for all endpoints
  - [ ] Database schema documentation
  - [ ] Deployment guide
  - [ ] Troubleshooting guide

---

## Next Steps

**Before Implementation:**
1. Review this document with team
2. Get sign-off on costs ($2K/month)
3. Allocate 6-8 weeks of development time
4. Set up staging environment for testing

**To Begin:**
1. Start with Phase 1: Patient ID system
2. Don't skip phases - they build on each other
3. Test thoroughly at each phase
4. Pilot with small group before full rollout

**Questions to Resolve:**
- [ ] Do you want Spanish language support in V1?
- [ ] What's your office phone number for voicemail callback?
- [ ] Which providers will pilot this first?
- [ ] Do you have Klara API access already?

---

## Progress Tracking

**Current Status:** 🟡 Phase 1 In Progress
**Started:** [Date]
**Expected Completion:** [Date + 8 weeks]

### Milestones:
- [ ] Phase 1 Complete: Database Foundation (Week 2)
- [ ] Phase 2 Complete: Twilio Integration (Week 3)
- [ ] Phase 3 Complete: 11Labs AI Integration (Week 4)
- [ ] Phase 4 Complete: Call Scheduler (Week 5)
- [ ] Phase 5 Complete: Dashboard UI (Week 6)
- [ ] Phase 6 Complete: Analytics (Week 7)
- [ ] Phase 7 Complete: Production Launch (Week 8)

---

**Document Version:** 2.0
**Last Updated:** January 2025
**Status:** Implementation In Progress - Phase 1

**Contact:** Dr. Rakesh Patel
**Implementation Lead:** Claude Code
**Estimated Start Date:** January 2025
**Estimated Launch Date:** March 2025 (8 weeks from start)
