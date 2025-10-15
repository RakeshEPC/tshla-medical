# Action Items & Task Management System - Implementation Guide

**Version:** 1.0
**Created:** January 2025
**Status:** Planning Phase
**Target Practice:** Endocrinology (100+ patients/day)

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Pain Points](#current-pain-points)
3. [Proposed Solution](#proposed-solution)
4. [Doctor Control Settings](#doctor-control-settings)
5. [Template Design](#template-design)
6. [Database Schema](#database-schema)
7. [Action Items Dashboard](#action-items-dashboard)
8. [Patient Portal Integration](#patient-portal-integration)
9. [Email & Communication System](#email--communication-system)
10. [Implementation Phases](#implementation-phases)
11. [Technical Architecture](#technical-architecture)

---

## 📊 Executive Summary

### The Problem
- **100 patients/day** in endocrinology practice
- Lab orders, medication refills, and prior authorizations buried in notes
- MAs must open each note individually to find action items
- No batch processing capability
- No tracking of completion status

### The Solution
**Structured Templates + AI Extraction + Action Items Dashboard + Patient Portal**

- Doctors dictate using structured sections
- AI extracts action items automatically
- MAs see all tasks in one dashboard
- Export to CSV for batch processing
- Patient portal for communication and lab/med tracking
- Doctor-level control over self-service vs MA delegation

### Expected Outcomes
- ⏱️ Reduce task processing from **5 min/patient → 30 sec/patient**
- 📊 Handle 100 patients/day efficiently
- ✅ Better compliance with lab orders and medication refills
- 🔍 Full audit trail of completed tasks
- 👥 Improved patient communication and engagement

---

## 🚨 Current Pain Points

### For Medical Assistants
1. **No centralized task list** - Must open 100 notes individually
2. **No prioritization** - Can't see urgent vs routine tasks
3. **Manual data entry** - Copy/paste from notes to lab systems
4. **No completion tracking** - Don't know what's been done
5. **Inefficient workflow** - 5+ minutes per patient for task extraction

### For Doctors
1. **Some are OCD about labs/meds** - Want personal control over orders
2. **Others want to delegate** - Trust MA staff to handle routine tasks
3. **No consistent format** - Each doctor dictates differently
4. **Follow-up unclear** - Don't know if orders were placed

### For Patients
1. **No visibility** - Don't know what labs/meds were ordered
2. **No reminders** - Forget to complete labs before follow-up
3. **Communication gaps** - Have to call office with questions
4. **No portal integration** - Can't access their own care plan

---

## 💡 Proposed Solution

### Three-Tier System

```
┌─────────────────────────────────────────────────────────────┐
│                    DOCTOR DICTATION                         │
│   (Structured templates with Lab/Med/Prior Auth sections)  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              AI EXTRACTION & CATEGORIZATION                 │
│   • Parse structured sections from note                     │
│   • Extract: Labs, Meds, Prior Auths, Follow-ups           │
│   • Insert into action_items table                          │
│   • Respect doctor's control settings                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
         ┌─────────────┴─────────────┐
         │                           │
         ▼                           ▼
┌──────────────────┐         ┌──────────────────┐
│  MA DASHBOARD    │         │ PATIENT PORTAL   │
│  (If delegated)  │         │ (Always visible) │
│  • Filter tasks  │         │ • View orders    │
│  • Bulk process  │         │ • Track status   │
│  • Mark complete │         │ • Message staff  │
│  • Export CSV    │         │ • Upload results │
└──────────────────┘         └──────────────────┘
```

---

## 🎛️ Doctor Control Settings

### Problem Statement
**Doctors have different preferences:**
- Some want to personally handle ALL lab orders and prescriptions (OCD doctors)
- Others want to delegate routine tasks to MA staff (trusting delegation)
- Preferences may vary by task type (labs vs meds vs prior auth)

### Solution: Per-Doctor Task Delegation Settings

#### Doctor Profile Settings Table
```typescript
interface DoctorTaskPreferences {
  doctorId: string;

  // Lab Orders
  labOrders: {
    delegateToMA: boolean;        // false = doctor handles in EMR
    allowMAOverride: boolean;     // true = MA can see in dashboard anyway
    requireReview: boolean;       // true = doctor reviews before MA submits
  };

  // Medication Refills
  medicationRefills: {
    delegateToMA: boolean;
    allowMAOverride: boolean;
    requireReview: boolean;
  };

  // New Prescriptions
  newPrescriptions: {
    delegateToMA: boolean;        // Usually false (doctor does in EMR)
    allowMAOverride: boolean;
  };

  // Prior Authorizations
  priorAuthorizations: {
    delegateToMA: boolean;        // Usually true (MA handles paperwork)
    requireReview: boolean;       // Doctor reviews before submission
  };

  // Follow-up Appointments
  followUpScheduling: {
    delegateToMA: boolean;        // Usually true
  };
}
```

#### UI: Doctor Settings Page

```
┌────────────────────────────────────────────────────────────┐
│ Task Delegation Settings - Dr. Smith                      │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ Control who handles different types of tasks from your    │
│ clinical notes:                                           │
│                                                            │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ 🔬 LAB ORDERS                                        │ │
│ │                                                      │ │
│ │ ◉ I handle in EMR (default)                         │ │
│ │ ○ Delegate to MA staff                              │ │
│ │ ○ I review, then MA submits                         │ │
│ │                                                      │ │
│ │ ☑ Show in MA dashboard for reference                │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                            │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ 💊 MEDICATION REFILLS                                │ │
│ │                                                      │ │
│ │ ◉ I handle in EMR (default)                         │ │
│ │ ○ Delegate to MA staff                              │ │
│ │ ○ I review, then MA submits                         │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                            │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ 💊 NEW PRESCRIPTIONS                                 │ │
│ │                                                      │ │
│ │ ◉ I always handle (recommended)                     │ │
│ │ ○ Delegate to MA staff                              │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                            │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ 📋 PRIOR AUTHORIZATIONS                              │ │
│ │                                                      │ │
│ │ ○ I handle                                          │ │
│ │ ◉ Delegate to MA staff (recommended)                │ │
│ │ ☑ I review before submission                        │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                            │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ 📅 FOLLOW-UP SCHEDULING                              │ │
│ │                                                      │ │
│ │ ○ I handle                                          │ │
│ │ ◉ Delegate to MA staff (recommended)                │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                            │
│ [💾 Save Preferences]                                     │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

#### During Dictation: Doctor Can Override Per-Visit

**In the dictation UI, add quick toggles:**

```
┌────────────────────────────────────────────────────────────┐
│ Quick Note - Smith, John (MRN: 12345)                     │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ 🎛️ Task Handling for This Visit:                          │
│ ☐ I'll handle labs       ☐ I'll handle meds             │
│ ☑ MA handles labs        ☑ MA handles meds              │
│                                                            │
│ [🎙️ START RECORDING]  [🤖 PROCESS WITH AI]               │
└────────────────────────────────────────────────────────────┘
```

#### MA Dashboard Respects Settings

```typescript
// When MA opens dashboard
const actionItems = await getActionItems(providerId, date, {
  // Only show items delegated to MA
  filterByDelegation: true,

  // Unless "allowMAOverride" is true (show for reference)
  includeReferenceItems: true
});

// Display with visual indicators
// 🟢 = Your task (delegated to you)
// 🔵 = Reference only (doctor is handling)
```

**Example MA Dashboard View:**

```
┌────────────────────────────────────────────────────────────┐
│ Action Items Dashboard - 01/15/2025                       │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ 🔬 LAB ORDERS (42 total, 12 assigned to you)             │
│                                                            │
│ 🟢 Smith, John (12345) - HbA1c, CMP        [✅ Complete]  │
│    ↳ Dr. Jones delegated to MA                            │
│                                                            │
│ 🔵 Doe, Jane (67890) - TSH, Free T4        [Reference]    │
│    ↳ Dr. Smith handling in EMR                            │
│                                                            │
│ 💊 MEDICATION REFILLS (67 total, 45 assigned to you)     │
│                                                            │
│ 🟢 Garcia, Maria (11223) - Metformin      [✅ Complete]  │
│    ↳ Dr. Lee delegated to MA                              │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 📝 Template Design

### Structured Sections for Endocrinology

#### Template: "Diabetes Follow-up - Structured"

```markdown
# SUBJECTIVE
Chief Complaint: [From dictation]
History of Present Illness: [From dictation]
Review of Systems: [From dictation]

# OBJECTIVE
Vitals: [From dictation]
- BP:
- HR:
- Weight:
- BMI:

Physical Examination: [From dictation]

# ASSESSMENT
1. Type 2 Diabetes Mellitus (E11.9)
   - A1C: [value] (target <7%)
   - Currently on [medications]
   - [Assessment details from dictation]

2. Dyslipidemia (E78.5)
   - [Details]

3. Hypertension (I10)
   - [Details]

# PLAN

## 🔬 LAB ORDERS
**Instructions for AI:**
- Extract labs mentioned in dictation
- Determine timing (STAT, today, routine, 3 months, 6 months)
- Note any special instructions (fasting, timing)

**Format:**
☐ HbA1c (Due: 3 months)
☐ Comprehensive Metabolic Panel (Due: 3 months)
☐ Lipid Panel - fasting (Due: 3 months)
☐ Microalbumin/Creatinine Ratio (Due: 6 months)
☐ Vitamin D 25-OH (Due: 6 months)
☐ TSH, Free T4 (Due: as needed)

**Timing:** [Routine / STAT / Today / 1 week / 3 months / 6 months]
**Special Instructions:** [Fasting required / Complete before next visit / etc.]
**Preferred Lab:** [Quest Diagnostics / LabCorp / Hospital Lab]

**Delegation:**
- ☑ MA to order
- ☐ Doctor will order in EMR

---

## 💊 MEDICATION ORDERS

### REFILLS NEEDED:
☐ Metformin 1000mg BID - 90 day supply, 3 refills
☐ Lantus 40 units at bedtime - 90 day supply, 3 refills
☐ Atorvastatin 40mg daily - 90 day supply, 3 refills
☐ Lisinopril 20mg daily - 90 day supply, 3 refills

### NEW PRESCRIPTIONS:
☐ Jardiance 10mg daily - 90 day supply, 3 refills
   **Indication:** SGLT2 inhibitor for cardiovascular and kidney protection
   **Diagnosis Code:** E11.9 (Type 2 Diabetes)

☐ [Medication name, dose, frequency] - [supply], [refills]
   **Indication:** [reason]
   **Diagnosis Code:** [ICD-10]

### MEDICATION CHANGES:
☐ INCREASE Lantus from 40 → 45 units nightly
   **Reason:** A1C 8.2%, titrate basal insulin upward

☐ DISCONTINUE Glipizide 10mg BID
   **Reason:** Starting SGLT2 inhibitor, discontinue sulfonylurea

### MEDICATION ADJUSTMENTS:
- [Details from dictation]

**Delegation:**
- ☑ MA to process refills
- ☐ Doctor will handle in EMR

---

## 📋 PRIOR AUTHORIZATIONS NEEDED

### 1. Ozempic 0.5mg weekly (titrate to 1mg after 4 weeks)
- **Diagnosis Codes:** E11.9 (Type 2 Diabetes), E66.9 (Obesity)
- **Failed Trials:**
  - Metformin 2000mg daily × 18 months
  - Glipizide 10mg BID × 12 months
  - Lantus up to 50 units daily × 8 months
- **Clinical Justification:**
  - A1C 8.2% despite triple therapy (metformin, sulfonylurea, basal insulin)
  - BMI 34.5 with documented weight gain
  - Patient interested in weight reduction
  - Requesting GLP-1 agonist for dual benefit: glycemic control + weight loss
- **Supporting Documentation:**
  - Last 4 A1C values: 8.8%, 8.5%, 8.3%, 8.2%
  - Weight trend: Gained 15 lbs in past 12 months
  - Medication compliance confirmed via pharmacy records
- **Urgency:** ☑ Routine  ☐ STAT  ☐ Expedited
- **Pharmacy:** [Patient's preferred pharmacy]

### 2. [Additional prior auth requests]

**Delegation:**
- ☑ MA to submit paperwork
- ☑ Doctor to review before submission

---

## 📅 FOLLOW-UP INSTRUCTIONS

**Return Visit:** 3 months (April 2025)

**Before Next Visit:**
- Complete fasting labs 1-2 weeks prior
- Continue blood glucose log
- Weight check weekly

**Patient Education Provided:**
- SGLT2 inhibitor: benefits for heart and kidney
- Importance of medication adherence
- Blood glucose monitoring technique reviewed
- Dietary modifications discussed

**Contact Instructions:**
- Call office if blood sugars consistently >250 mg/dL
- Portal message for questions
- Schedule lab draw 2 weeks before next appointment

**Delegation:**
- ☑ MA to schedule follow-up
- ☐ Doctor will schedule

---

## 📊 BILLING & CODING

**ICD-10 Codes:**
- E11.9 - Type 2 Diabetes Mellitus
- E78.5 - Hyperlipidemia
- I10 - Essential Hypertension
- E66.9 - Obesity

**CPT Codes:**
- 99214 - Established patient, moderate complexity
- [Additional codes if applicable]

**Time:** 25 minutes face-to-face

---

# DOCTOR SIGNATURE
Dr. [Name]
Date: [Auto-filled]
Electronic Signature: [From Supabase Auth]
```

---

## 🗄️ Database Schema

### Tables Required

#### 1. `action_items` Table
```sql
CREATE TABLE action_items (
  id SERIAL PRIMARY KEY,

  -- Linkage
  note_id INTEGER REFERENCES dictated_notes(id) ON DELETE CASCADE,
  patient_name VARCHAR(255) NOT NULL,
  patient_mrn VARCHAR(50),
  patient_email VARCHAR(255),

  -- Provider info
  provider_id VARCHAR(255) NOT NULL,
  provider_name VARCHAR(255) NOT NULL,
  visit_date DATE NOT NULL,

  -- Action type
  item_type VARCHAR(50) NOT NULL,
  -- Values: 'lab_order', 'medication_refill', 'new_prescription',
  --         'medication_change', 'prior_auth', 'follow_up_scheduling'

  -- Action details (generic JSON for flexibility)
  item_description TEXT NOT NULL,
  details JSONB, -- Flexible storage for type-specific data

  -- Timing & Priority
  urgency VARCHAR(20) DEFAULT 'routine',
  -- Values: 'STAT', 'today', 'this_week', 'routine', '1_month', '3_months', '6_months'
  due_date DATE,

  -- Medication-specific fields
  medication_name VARCHAR(255),
  medication_dose VARCHAR(100),
  medication_instructions TEXT,
  supply_days INTEGER,
  refills_authorized INTEGER,

  -- Lab-specific fields
  lab_tests TEXT[], -- Array of lab test names
  lab_timing VARCHAR(50),
  lab_instructions TEXT,
  preferred_lab VARCHAR(100),

  -- Prior auth specific
  diagnosis_codes TEXT[],
  failed_therapies TEXT[],
  clinical_justification TEXT,

  -- Delegation settings
  delegated_to VARCHAR(20) DEFAULT 'ma', -- 'doctor', 'ma', 'review_required'
  show_in_ma_dashboard BOOLEAN DEFAULT true,
  requires_doctor_review BOOLEAN DEFAULT false,
  reviewed_by_doctor_at TIMESTAMP,

  -- Status tracking
  status VARCHAR(20) DEFAULT 'pending',
  -- Values: 'pending', 'in_progress', 'completed', 'cancelled', 'needs_review'

  assigned_to VARCHAR(255), -- MA staff member ID/name
  completed_at TIMESTAMP,
  completed_by VARCHAR(255),
  completion_notes TEXT,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Full-text search
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english',
      COALESCE(patient_name, '') || ' ' ||
      COALESCE(patient_mrn, '') || ' ' ||
      COALESCE(item_description, '') || ' ' ||
      COALESCE(medication_name, '')
    )
  ) STORED
);

-- Indexes for performance
CREATE INDEX idx_action_items_status ON action_items(status, provider_id, visit_date);
CREATE INDEX idx_action_items_type ON action_items(item_type, status);
CREATE INDEX idx_action_items_patient ON action_items(patient_mrn, status);
CREATE INDEX idx_action_items_urgency ON action_items(urgency, due_date, status);
CREATE INDEX idx_action_items_delegation ON action_items(delegated_to, show_in_ma_dashboard, status);
CREATE INDEX idx_action_items_search ON action_items USING GIN(search_vector);

-- Trigger to update updated_at
CREATE TRIGGER update_action_items_updated_at
  BEFORE UPDATE ON action_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

#### 2. `doctor_task_preferences` Table
```sql
CREATE TABLE doctor_task_preferences (
  id SERIAL PRIMARY KEY,
  doctor_id VARCHAR(255) UNIQUE NOT NULL,

  -- Lab Orders
  lab_orders_delegate_to_ma BOOLEAN DEFAULT false,
  lab_orders_allow_ma_override BOOLEAN DEFAULT true,
  lab_orders_require_review BOOLEAN DEFAULT false,

  -- Medication Refills
  med_refills_delegate_to_ma BOOLEAN DEFAULT false,
  med_refills_allow_ma_override BOOLEAN DEFAULT true,
  med_refills_require_review BOOLEAN DEFAULT false,

  -- New Prescriptions
  new_rx_delegate_to_ma BOOLEAN DEFAULT false,
  new_rx_allow_ma_override BOOLEAN DEFAULT false,

  -- Prior Authorizations
  prior_auth_delegate_to_ma BOOLEAN DEFAULT true,
  prior_auth_require_review BOOLEAN DEFAULT true,

  -- Follow-up Scheduling
  followup_delegate_to_ma BOOLEAN DEFAULT true,

  -- Notifications
  notify_on_task_completion BOOLEAN DEFAULT true,
  notification_email VARCHAR(255),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_doctor_task_prefs_doctor ON doctor_task_preferences(doctor_id);
```

#### 3. `action_items_log` Table (Audit Trail)
```sql
CREATE TABLE action_items_log (
  id SERIAL PRIMARY KEY,
  action_item_id INTEGER REFERENCES action_items(id) ON DELETE CASCADE,

  action VARCHAR(50) NOT NULL, -- 'created', 'assigned', 'completed', 'cancelled', 'reviewed'
  performed_by VARCHAR(255) NOT NULL,
  performed_at TIMESTAMP DEFAULT NOW(),

  old_status VARCHAR(20),
  new_status VARCHAR(20),

  notes TEXT,

  metadata JSONB -- Additional context
);

CREATE INDEX idx_action_items_log_item ON action_items_log(action_item_id, performed_at);
```

---

## 📊 Action Items Dashboard

### Dashboard Layout

```
┌────────────────────────────────────────────────────────────────────┐
│ TSHLA Medical - Action Items Dashboard                            │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Provider: [Dr. Smith ▼]    Date: [Today ▼]    View: [My Tasks ▼] │
│                                                                    │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐        │
│  │ 🔬 Labs  │ 💊 Meds  │ 📋 Prior │ 📅 F/U   │ ✅ Done  │        │
│  │   42     │   67     │   Auth   │   23     │   89     │        │
│  │          │          │   12     │          │          │        │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘        │
│                                                                    │
│  Quick Filters:                                                   │
│  [ All (144) ] [ Assigned to Me (78) ] [ Needs Review (12) ]     │
│  [ STAT (3) ] [ Today (8) ] [ This Week (34) ]                    │
│                                                                    │
│  Quick Actions:                                                   │
│  [📥 Export to CSV] [✅ Mark Selected Complete] [📧 Email Report] │
│  [🔍 Search Patient] [📊 Analytics]                               │
│                                                                    │
│  ═══════════════════════════════════════════════════════════════  │
│  🔬 LAB ORDERS (42 pending)                                       │
│  ═══════════════════════════════════════════════════════════════  │
│                                                                    │
│  Show: [All] [My Tasks] [Need Review] [Reference Only]           │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ ☐ 🟢 Smith, John (MRN: 12345)              [📋 View Note]  │  │
│  │    Visit: 01/15/2025 | Provider: Dr. Smith                │  │
│  │    ─────────────────────────────────────────────────────── │  │
│  │    Labs: HbA1c, CMP, Lipid Panel (fasting)                │  │
│  │    ⏰ Due: 3 months (by April 15, 2025)                    │  │
│  │    🏥 Quest Diagnostics                                    │  │
│  │    📝 Note: Patient to complete 1-2 weeks before next visit│  │
│  │    ─────────────────────────────────────────────────────── │  │
│  │    Status: 🟢 Assigned to you                              │  │
│  │    Actions: [✅ Mark Complete] [📋 Copy] [📧 Send to Patient]│
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ ☐ 🔵 Doe, Jane (MRN: 67890)                [📋 View Note]  │  │
│  │    Visit: 01/15/2025 | Provider: Dr. Jones                │  │
│  │    ─────────────────────────────────────────────────────── │  │
│  │    Labs: TSH, Free T4                                      │  │
│  │    ⏰ Due: Today 🚨                                         │  │
│  │    ─────────────────────────────────────────────────────── │  │
│  │    Status: 🔵 Reference Only (Dr. Jones handling in EMR)   │  │
│  │    Actions: [📋 Copy] [📧 Send to Patient]                 │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  [Load More...] [1-10 of 42]                                     │
│                                                                    │
│  ═══════════════════════════════════════════════════════════════  │
│  💊 MEDICATION REFILLS (67 pending)                               │
│  ═══════════════════════════════════════════════════════════════  │
│                                                                    │
│  Show: [All] [Refills] [New Rx] [Changes] [Prior Auth]           │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ ☐ 🟢 Garcia, Maria (MRN: 11223)            [📋 View Note]  │  │
│  │    Visit: 01/15/2025 | Provider: Dr. Lee                  │  │
│  │    ─────────────────────────────────────────────────────── │  │
│  │    REFILLS NEEDED:                                         │  │
│  │    • Metformin 1000mg BID - 90 days, 3 refills             │  │
│  │    • Lantus 40u QHS - 90 days, 3 refills                   │  │
│  │    • Atorvastatin 40mg daily - 90 days, 3 refills          │  │
│  │                                                             │  │
│  │    NEW PRESCRIPTIONS:                                      │  │
│  │    • Jardiance 10mg daily - 90 days, 3 refills             │  │
│  │      (SGLT2 inhibitor for kidney protection)               │  │
│  │    ─────────────────────────────────────────────────────── │  │
│  │    Status: 🟢 Assigned to you                              │  │
│  │    Actions: [✅ Mark Complete] [📋 Copy to eRx] [📧 Send] │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Export Formats

#### Lab Orders CSV
```csv
Patient Name,MRN,Labs Ordered,Timing,Special Instructions,Preferred Lab,Provider,Visit Date,Status,Note ID
Smith John,12345,"HbA1c, CMP, Lipid Panel",3 months,"Fasting required, complete 1-2 weeks before next visit",Quest Diagnostics,Dr. Smith,2025-01-15,Pending,789
Doe Jane,67890,"TSH, Free T4",Today,"STAT",Quest Diagnostics,Dr. Jones,2025-01-15,Pending,790
```

#### Medication Orders CSV
```csv
Patient Name,MRN,Medication,Dose,Instructions,Supply Days,Refills,Type,Provider,Visit Date,Status,Note ID
Smith John,12345,Metformin,1000mg,BID,90,3,Refill,Dr. Smith,2025-01-15,Pending,789
Smith John,12345,Jardiance,10mg,Daily,90,3,New Rx,Dr. Smith,2025-01-15,Pending,789
Garcia Maria,11223,Lantus,40 units,At bedtime,90,3,Refill,Dr. Lee,2025-01-15,Pending,791
```

#### Prior Authorization CSV
```csv
Patient Name,MRN,Medication/Item,Diagnosis Codes,Failed Trials,Clinical Justification,Urgency,Provider,Status
Lopez Carlos,33445,Ozempic 1mg,"E11.9, E66.9","Metformin, Glipizide, Lantus","A1C 8.2% despite triple therapy, BMI 34",Routine,Dr. Smith,Pending
```

---

## 🌐 Patient Portal Integration

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    DOCTOR COMPLETES NOTE                    │
│                  (Processes with AI + saves)                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              AUTOMATED EMAIL TO PATIENT                     │
│  Subject: "Visit Summary & Action Items - Dr. Smith"       │
│  Content:                                                   │
│    • Visit summary                                          │
│    • Your action items (labs, meds)                         │
│    • Link to patient portal                                 │
│    • Direct message doctor/staff link                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    PATIENT PORTAL                           │
│  Patient logs in to view:                                  │
│    • Full visit note                                        │
│    • Lab orders with status                                 │
│    • Medications prescribed                                 │
│    • Follow-up appointment                                  │
│    • Secure messaging with staff                            │
│    • Upload lab results                                     │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema for Patient Portal

#### `portal_patients` Table
```sql
CREATE TABLE portal_patients (
  id SERIAL PRIMARY KEY,

  -- Patient identification
  mrn VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,

  -- Authentication (Supabase Auth)
  auth_user_id UUID REFERENCES auth.users(id),

  -- Patient info
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  date_of_birth DATE,
  phone VARCHAR(20),

  -- Portal settings
  portal_activated BOOLEAN DEFAULT false,
  activation_token VARCHAR(255),
  activation_sent_at TIMESTAMP,
  activated_at TIMESTAMP,

  -- Communication preferences
  email_notifications BOOLEAN DEFAULT true,
  sms_notifications BOOLEAN DEFAULT false,

  -- Primary care provider
  primary_provider_id VARCHAR(255),
  primary_provider_name VARCHAR(255),

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP
);

CREATE INDEX idx_portal_patients_mrn ON portal_patients(mrn);
CREATE INDEX idx_portal_patients_email ON portal_patients(email);
CREATE INDEX idx_portal_patients_auth ON portal_patients(auth_user_id);
```

#### `portal_shared_notes` Table
```sql
CREATE TABLE portal_shared_notes (
  id SERIAL PRIMARY KEY,

  -- Linkage
  note_id INTEGER REFERENCES dictated_notes(id),
  patient_mrn VARCHAR(50) NOT NULL,
  provider_id VARCHAR(255) NOT NULL,

  -- Sharing details
  shared_at TIMESTAMP DEFAULT NOW(),
  shared_by VARCHAR(255),

  -- Access control
  patient_can_view BOOLEAN DEFAULT true,
  patient_viewed_at TIMESTAMP,

  -- Redactions (for sensitive info)
  redacted_sections TEXT[], -- e.g., ['psychiatry_notes', 'substance_abuse']

  -- Associated action items
  has_lab_orders BOOLEAN DEFAULT false,
  has_medication_orders BOOLEAN DEFAULT false,
  has_follow_up BOOLEAN DEFAULT false,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_portal_shared_notes_patient ON portal_shared_notes(patient_mrn, shared_at);
CREATE INDEX idx_portal_shared_notes_note ON portal_shared_notes(note_id);
```

#### `portal_messages` Table
```sql
CREATE TABLE portal_messages (
  id SERIAL PRIMARY KEY,

  -- Conversation
  patient_mrn VARCHAR(50) NOT NULL,
  provider_id VARCHAR(255) NOT NULL,

  -- Message details
  from_type VARCHAR(20) NOT NULL, -- 'patient', 'staff', 'provider'
  from_user_id VARCHAR(255) NOT NULL,
  from_user_name VARCHAR(255) NOT NULL,

  to_type VARCHAR(20) NOT NULL,
  to_user_id VARCHAR(255) NOT NULL,

  subject VARCHAR(255),
  message_body TEXT NOT NULL,

  -- Related to
  related_note_id INTEGER REFERENCES dictated_notes(id),
  related_action_item_id INTEGER REFERENCES action_items(id),

  -- Status
  read_at TIMESTAMP,
  replied_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'unread', -- 'unread', 'read', 'replied', 'archived'

  -- Priority
  is_urgent BOOLEAN DEFAULT false,

  -- Attachments
  has_attachments BOOLEAN DEFAULT false,
  attachments JSONB, -- Array of file references

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_portal_messages_patient ON portal_messages(patient_mrn, created_at DESC);
CREATE INDEX idx_portal_messages_provider ON portal_messages(provider_id, status, created_at DESC);
CREATE INDEX idx_portal_messages_status ON portal_messages(status, is_urgent);
```

#### `portal_lab_results` Table
```sql
CREATE TABLE portal_lab_results (
  id SERIAL PRIMARY KEY,

  -- Linkage
  patient_mrn VARCHAR(50) NOT NULL,
  action_item_id INTEGER REFERENCES action_items(id),

  -- Lab details
  lab_name VARCHAR(255) NOT NULL,
  test_date DATE NOT NULL,
  result_value VARCHAR(100),
  result_unit VARCHAR(50),
  reference_range VARCHAR(100),
  abnormal_flag VARCHAR(20), -- 'normal', 'high', 'low', 'critical'

  -- Upload info
  uploaded_by VARCHAR(20), -- 'patient', 'staff', 'lab_interface'
  uploaded_at TIMESTAMP DEFAULT NOW(),

  -- File attachment
  result_file_url TEXT,
  result_file_type VARCHAR(50), -- 'pdf', 'image', 'hl7'

  -- Review status
  reviewed_by_provider VARCHAR(255),
  reviewed_at TIMESTAMP,
  provider_comments TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_portal_lab_results_patient ON portal_lab_results(patient_mrn, test_date DESC);
CREATE INDEX idx_portal_lab_results_action ON portal_lab_results(action_item_id);
```

---

## 📧 Email & Communication System

### Email Template: Visit Summary

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; }
    .header { background: #2563eb; color: white; padding: 20px; }
    .content { padding: 20px; }
    .action-item { background: #f0f9ff; padding: 15px; margin: 10px 0; border-left: 4px solid #2563eb; }
    .button { background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Visit Summary - TSHLA Medical</h1>
    <p>From Dr. Smith | Date: January 15, 2025</p>
  </div>

  <div class="content">
    <h2>Dear John Smith,</h2>

    <p>Thank you for your visit today. Here's a summary of your visit and action items:</p>

    <h3>📋 Visit Summary</h3>
    <p>
      We discussed your diabetes management and made some medication adjustments.
      Your A1C has improved to 7.8% from 8.2%, which shows good progress.
      We're adding a new medication to help with both blood sugar control and kidney protection.
    </p>

    <h3>🔬 Your Lab Orders</h3>
    <div class="action-item">
      <strong>Labs to Complete:</strong>
      <ul>
        <li>HbA1c</li>
        <li>Comprehensive Metabolic Panel (CMP)</li>
        <li>Lipid Panel (fasting)</li>
      </ul>
      <p><strong>When:</strong> Complete 1-2 weeks before your next visit (by April 1, 2025)</p>
      <p><strong>Where:</strong> Quest Diagnostics (any location)</p>
      <p><strong>Special Instructions:</strong> Fasting required (12 hours, water only)</p>
    </div>

    <h3>💊 Your Medications</h3>
    <div class="action-item">
      <strong>Refills Sent to Your Pharmacy:</strong>
      <ul>
        <li>Metformin 1000mg twice daily - 90 day supply</li>
        <li>Lantus 45 units at bedtime - 90 day supply (INCREASED from 40 units)</li>
        <li>Atorvastatin 40mg daily - 90 day supply</li>
      </ul>

      <strong>New Medication:</strong>
      <ul>
        <li>Jardiance 10mg daily - 90 day supply</li>
        <li><em>Why: This medication helps protect your kidneys and heart while improving blood sugar control</em></li>
      </ul>

      <p><strong>Your Pharmacy:</strong> CVS Pharmacy (123 Main St)</p>
      <p><strong>Note:</strong> Prior authorization has been submitted for Jardiance. Your pharmacy will notify you when it's ready (usually 2-3 days).</p>
    </div>

    <h3>📅 Follow-Up Appointment</h3>
    <div class="action-item">
      <strong>Next Visit:</strong> April 15, 2025 at 9:00 AM<br>
      <strong>Provider:</strong> Dr. Smith<br>
      <strong>What to Bring:</strong> Your lab results and blood sugar log
    </div>

    <h3>🌐 Patient Portal Access</h3>
    <p>
      View your complete visit note, track your lab orders, and message our staff securely:
    </p>
    <p>
      <a href="https://portal.tshla.ai/activate?token=abc123xyz" class="button">
        Activate Your Patient Portal
      </a>
    </p>
    <p>
      <small>First time? Click the button above to create your secure patient portal account.</small>
    </p>

    <h3>💬 Questions?</h3>
    <p>
      You can reach us by:
      <ul>
        <li><strong>Patient Portal:</strong> Send a secure message (we reply within 24 hours)</li>
        <li><strong>Phone:</strong> (555) 123-4567 (Mon-Fri, 8am-5pm)</li>
        <li><strong>Urgent Issues:</strong> Call our after-hours line at (555) 999-8888</li>
      </ul>
    </p>

    <hr>

    <p style="color: #666; font-size: 12px;">
      This email was sent from TSHLA Medical as part of your patient care.
      Please do not reply to this email. Use the patient portal for secure communication.
    </p>
  </div>
</body>
</html>
```

### Email Service Integration

```typescript
interface EmailService {
  // Send visit summary email
  sendVisitSummary(params: {
    patientEmail: string;
    patientName: string;
    patientMRN: string;
    providerName: string;
    visitDate: string;
    noteSummary: string;
    labOrders: ActionItem[];
    medications: ActionItem[];
    followUp: ActionItem | null;
    portalActivationToken: string;
  }): Promise<void>;

  // Send lab reminder
  sendLabReminder(params: {
    patientEmail: string;
    patientName: string;
    labTests: string[];
    dueDate: Date;
    portalLink: string;
  }): Promise<void>;

  // Send medication refill reminder
  sendRefillReminder(params: {
    patientEmail: string;
    patientName: string;
    medications: string[];
    expirationDate: Date;
  }): Promise<void>;

  // Send prior auth status update
  sendPriorAuthUpdate(params: {
    patientEmail: string;
    patientName: string;
    medicationName: string;
    status: 'approved' | 'denied' | 'pending';
    nextSteps: string;
  }): Promise<void>;
}
```

### Email Providers (Options)

1. **SendGrid** (Recommended for healthcare)
   - HIPAA-compliant with BAA
   - 100 emails/day free tier
   - Good deliverability
   - Cost: $15/mo for 40,000 emails

2. **Mailgun**
   - HIPAA-compliant
   - Pay-as-you-go pricing
   - Cost: $0.80/1000 emails

3. **Postmark** (Healthcare-focused)
   - HIPAA-compliant by default
   - Excellent deliverability
   - Cost: $15/mo for 10,000 emails

### Implementation Service

```typescript
// services/emailNotification.service.ts

import sgMail from '@sendgrid/mail';

class EmailNotificationService {
  private sendgrid: typeof sgMail;

  constructor() {
    this.sendgrid = sgMail;
    this.sendgrid.setApiKey(process.env.SENDGRID_API_KEY || '');
  }

  async sendVisitSummaryEmail(
    note: DictatedNote,
    actionItems: ActionItem[],
    patientEmail: string
  ): Promise<void> {
    // Group action items by type
    const labs = actionItems.filter(item => item.item_type === 'lab_order');
    const meds = actionItems.filter(item =>
      ['medication_refill', 'new_prescription'].includes(item.item_type)
    );
    const followUp = actionItems.find(item => item.item_type === 'follow_up_scheduling');

    // Generate portal activation token
    const activationToken = await this.generatePortalToken(note.patient_mrn);

    // Render email template
    const emailHtml = this.renderVisitSummaryTemplate({
      patientName: note.patient_name,
      providerName: note.provider_name,
      visitDate: note.visit_date,
      noteSummary: this.extractSummary(note.ai_processed_note),
      labs,
      meds,
      followUp,
      activationToken
    });

    // Send via SendGrid
    await this.sendgrid.send({
      to: patientEmail,
      from: 'noreply@tshla.ai',
      fromName: 'TSHLA Medical',
      subject: `Visit Summary - Dr. ${note.provider_name} | ${note.visit_date}`,
      html: emailHtml,
      trackingSettings: {
        clickTracking: { enable: false }, // HIPAA compliance
        openTracking: { enable: false }
      }
    });

    // Log in database
    await this.logEmailSent({
      patient_mrn: note.patient_mrn,
      email_type: 'visit_summary',
      sent_at: new Date(),
      note_id: note.id
    });
  }

  private async generatePortalToken(patientMRN: string): Promise<string> {
    // Check if patient already has portal access
    const patient = await db.query(
      'SELECT * FROM portal_patients WHERE mrn = $1',
      [patientMRN]
    );

    if (patient.rows.length > 0 && patient.rows[0].portal_activated) {
      // Already activated, return portal login link
      return 'ACTIVATED';
    }

    // Generate activation token
    const token = crypto.randomBytes(32).toString('hex');

    // Store in database
    await db.query(
      `INSERT INTO portal_patients (mrn, activation_token, activation_sent_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (mrn)
       DO UPDATE SET activation_token = $2, activation_sent_at = NOW()`,
      [patientMRN, token]
    );

    return token;
  }
}

export const emailNotificationService = new EmailNotificationService();
```

---

## 🚀 Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
**Goal:** Set up core infrastructure

**Tasks:**
- [ ] Fix template duplication cache bug
- [ ] Create database tables (`action_items`, `doctor_task_preferences`)
- [ ] Build extraction service to parse structured sections from notes
- [ ] Test extraction accuracy with sample notes

**Deliverables:**
- Action items automatically extracted from notes
- Basic database storage working

---

### Phase 2: Doctor Controls (Week 3)
**Goal:** Allow doctors to configure task delegation

**Tasks:**
- [ ] Build doctor task preferences UI
- [ ] Implement per-doctor delegation settings
- [ ] Add per-visit override toggles in dictation UI
- [ ] Update extraction logic to respect delegation settings

**Deliverables:**
- Doctors can choose self-service vs MA delegation
- Extraction service respects doctor preferences

---

### Phase 3: MA Dashboard (Weeks 4-5)
**Goal:** Build the action items dashboard for MA staff

**Tasks:**
- [ ] Create dashboard UI with filtering
- [ ] Implement CSV export functionality
- [ ] Add bulk actions (mark multiple complete)
- [ ] Build search functionality
- [ ] Add task assignment features

**Deliverables:**
- Fully functional MA dashboard
- Export to CSV working
- Task completion tracking

---

### Phase 4: Update Templates (Week 6)
**Goal:** Roll out structured templates to all providers

**Tasks:**
- [ ] Update all endocrinology templates with structured sections
- [ ] Add AI prompts for extraction
- [ ] Test with real dictations
- [ ] Train providers on new template format

**Deliverables:**
- All templates use structured format
- Providers trained and using new format

---

### Phase 5: Patient Portal - Foundation (Weeks 7-9)
**Goal:** Build basic patient portal infrastructure

**Tasks:**
- [ ] Create patient portal database tables
- [ ] Build patient authentication (Supabase Auth)
- [ ] Implement portal activation flow
- [ ] Build patient dashboard UI
- [ ] Implement note viewing (read-only)

**Deliverables:**
- Patients can log in to portal
- Patients can view their visit notes
- Activation via email link working

---

### Phase 6: Email Notifications (Week 10)
**Goal:** Automated email delivery after visits

**Tasks:**
- [ ] Set up SendGrid account (with HIPAA BAA)
- [ ] Build email template rendering
- [ ] Implement visit summary email
- [ ] Add portal activation emails
- [ ] Test email deliverability

**Deliverables:**
- Automated emails sent after each visit
- Portal activation links in emails
- Professional email templates

---

### Phase 7: Patient Portal - Action Items (Weeks 11-12)
**Goal:** Patients can view and track their action items

**Tasks:**
- [ ] Add lab orders section to patient portal
- [ ] Add medications section
- [ ] Add follow-up appointments section
- [ ] Implement status tracking (patient can see "completed" vs "pending")
- [ ] Add lab result upload feature

**Deliverables:**
- Patients can view their lab orders
- Patients can view their medications
- Patients can upload lab results

---

### Phase 8: Secure Messaging (Weeks 13-15)
**Goal:** Two-way communication between patients and staff

**Tasks:**
- [ ] Build messaging UI for patients
- [ ] Build messaging UI for staff
- [ ] Implement real-time notifications
- [ ] Add message threading
- [ ] Add file attachments (lab results, images)
- [ ] Implement read receipts

**Deliverables:**
- Secure messaging system
- Staff can respond to patient messages
- File sharing working

---

### Phase 9: Analytics & Reporting (Week 16)
**Goal:** Track completion rates and identify bottlenecks

**Tasks:**
- [ ] Build analytics dashboard for practice managers
- [ ] Track task completion rates
- [ ] Identify common bottlenecks
- [ ] Generate daily/weekly reports
- [ ] Provider performance metrics

**Deliverables:**
- Analytics dashboard
- Automated reports
- Performance metrics

---

### Phase 10: Advanced Features (Weeks 17-20)
**Goal:** Polish and advanced functionality

**Tasks:**
- [ ] Automated lab reminders (email patients 1 week before due date)
- [ ] Medication refill reminders
- [ ] Prior authorization status tracking
- [ ] Integration with pharmacy systems (optional)
- [ ] Integration with lab systems (optional)
- [ ] Mobile app considerations

**Deliverables:**
- Automated reminders working
- Optional integrations completed
- System fully polished

---

## 🏗️ Technical Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + TypeScript)            │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Doctor     │  │   MA Staff   │  │   Patient    │    │
│  │  Dictation   │  │  Dashboard   │  │   Portal     │    │
│  │     UI       │  │      UI      │  │      UI      │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ REST API / GraphQL
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    BACKEND (Node.js + Express)              │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              API Routes                              │  │
│  │  • /api/notes                                        │  │
│  │  • /api/action-items                                 │  │
│  │  • /api/doctor-preferences                           │  │
│  │  • /api/portal/patients                              │  │
│  │  • /api/portal/messages                              │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Services                                │  │
│  │  • actionItemsExtraction.service.ts                  │  │
│  │  • actionItemsDashboard.service.ts                   │  │
│  │  • emailNotification.service.ts                      │  │
│  │  • portalAuth.service.ts                             │  │
│  │  • secureMessaging.service.ts                        │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE (Supabase PostgreSQL)           │
│                                                             │
│  Tables:                                                    │
│  • dictated_notes                                          │
│  • action_items                                            │
│  • action_items_log                                        │
│  • doctor_task_preferences                                 │
│  • portal_patients                                         │
│  • portal_shared_notes                                     │
│  • portal_messages                                         │
│  • portal_lab_results                                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                        │
│                                                             │
│  • SendGrid (Email delivery)                               │
│  • Twilio (SMS notifications - optional)                   │
│  • Azure AI / OpenAI (Note processing)                     │
│  • Deepgram (Speech-to-text)                               │
│  • Supabase Auth (Authentication)                          │
└─────────────────────────────────────────────────────────────┘
```

### Key Services to Build

#### 1. `actionItemsExtraction.service.ts`
```typescript
class ActionItemsExtractionService {
  // Extract action items from processed note
  async extractActionItems(note: DictatedNote): Promise<ActionItem[]> {
    // Parse structured sections from note
    // Use regex + AI to extract:
    // - Lab orders
    // - Medication orders
    // - Prior auth requests
    // - Follow-up scheduling

    // Respect doctor's delegation preferences
    // Insert into action_items table
    // Return extracted items
  }
}
```

#### 2. `actionItemsDashboard.service.ts`
```typescript
class ActionItemsDashboardService {
  // Get action items for MA dashboard
  async getActionItems(filters: {
    providerId?: string;
    date?: Date;
    status?: string;
    itemType?: string;
    delegatedToMA?: boolean;
  }): Promise<ActionItem[]> {
    // Query database with filters
    // Join with doctor preferences
    // Return only items delegated to MA (or marked as reference)
  }

  // Mark action item as complete
  async markComplete(itemId: number, completedBy: string, notes?: string): Promise<void> {
    // Update status
    // Log in action_items_log
    // Notify provider if needed
  }

  // Export to CSV
  async exportToCSV(filters: any): Promise<string> {
    // Generate CSV from filtered action items
  }
}
```

#### 3. `emailNotification.service.ts`
```typescript
class EmailNotificationService {
  // Send visit summary email
  async sendVisitSummary(note: DictatedNote, actionItems: ActionItem[]): Promise<void> {
    // Render email template
    // Send via SendGrid
    // Log in database
  }

  // Send lab reminder
  async sendLabReminder(patient: Patient, labs: ActionItem[]): Promise<void> {
    // Calculate due date
    // Send reminder email
  }
}
```

---

## 📝 Next Steps

### Immediate Actions (Before Starting Development)

1. **Review this document with stakeholders:**
   - Get doctor feedback on task delegation settings
   - Confirm MA workflow requirements
   - Discuss patient portal features priority

2. **Technical prep:**
   - Set up SendGrid account (with HIPAA BAA)
   - Review Supabase storage limits for attachments
   - Plan database migrations

3. **Training prep:**
   - Create training materials for structured templates
   - Plan MA staff training for dashboard
   - Create patient portal onboarding materials

4. **Pilot program:**
   - Start with 1-2 doctors
   - 2 weeks of testing
   - Gather feedback
   - Iterate before full rollout

---

## 🎯 Success Metrics

### Quantitative Metrics
- **Task processing time:** Target <30 seconds per patient (vs 5 minutes baseline)
- **Completion rate:** >95% of action items completed within due date
- **Patient portal adoption:** >50% of patients activate within 3 months
- **Message response time:** <24 hours for patient messages
- **Lab completion rate:** >80% of patients complete labs before follow-up

### Qualitative Metrics
- Doctor satisfaction with task delegation control
- MA staff satisfaction with workflow efficiency
- Patient satisfaction with communication
- Reduced phone calls to office
- Fewer missed labs/medications

---

## 📚 Appendix

### Sample Structured Note (Full Example)

See separate file: `SAMPLE_STRUCTURED_NOTE.md`

### MA Workflow Diagram

See separate file: `MA_WORKFLOW_DIAGRAM.md`

### Patient Portal Screenshots

See separate file: `PATIENT_PORTAL_MOCKUPS.md`

---

**Document Version:** 1.0
**Last Updated:** January 2025
**Author:** TSHLA Medical Development Team
**Review Schedule:** Quarterly or after major feature releases
