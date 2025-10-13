# Service Layer Cleanup Analysis

**Current State**: 78 services in `src/services/`
**Goal**: Reduce to <30 well-organized services
**Strategy**: Archive, consolidate, and organize

---

## 📊 Service Categories

### 🔐 Authentication (4 services)
- ✅ **supabaseAuth.service.ts** - Primary auth (keep)
- ⚠️ **medicalAuth.service.ts** - Duplicate? (review)
- ⚠️ **unifiedAuth.service.ts** - Deprecated (already marked)
- ✅ **authInterceptor.ts** - HTTP auth interceptor (keep)

**Action**: Remove medicalAuth if duplicate, keep authInterceptor

---

### 🎤 Speech/Dictation (5 services)
- ✅ **deepgramSDK.service.ts** - Primary STT (keep)
- ✅ **speechServiceRouter.service.ts** - Router (keep)
- ⚠️ **dictation.service.ts** - Old/duplicate? (review)
- ⚠️ **highQualityDictation.service.ts** - Experiment? (archive)
- ✅ **browserTTS.service.ts** - Text-to-speech (keep)

**Action**: Archive experiments, consolidate if needed

---

### 🤖 AI Processing (12 services - TOO MANY!)
- ✅ **ai.service.ts** - Main AI service (keep)
- ✅ **openai.service.ts** - OpenAI client (keep)
- ✅ **bedrock.service.ts** - AWS Bedrock (keep if used)
- ⚠️ **highQualityAI.service.ts** - Experiment?
- ⚠️ **clientAIProcessor.service.ts** - Duplicate?
- ⚠️ **improvedNoteProcessor.service.ts** - Experiment?
- ⚠️ **cleanTemplateProcessor.service.ts** - Duplicate?
- ⚠️ **enhancedTemplateProcessor.service.ts** - Duplicate?
- ⚠️ **aiRequestQueue.service.ts** - Unused?
- ⚠️ **aiScheduleParser.service.ts** - Specific use case
- ⚠️ **actionExtraction.service.ts** - Specific use case
- ⚠️ **orderExtraction.service.ts** - Specific use case

**Action**: Consolidate AI services into:
- `ai.service.ts` (main AI orchestration)
- `openai.service.ts` (OpenAI client)
- `bedrock.service.ts` (AWS Bedrock client)
- `aiTemplateProcessor.service.ts` (combine all template processors)
- `aiExtractors.service.ts` (combine action/order extraction)

**Reduction**: 12 → 5 services

---

### 📅 Schedule/Appointments (6 services)
- ✅ **appointment.service.ts** - Main (keep)
- ✅ **centralizedSchedule.service.ts** - Central (keep)
- ⚠️ **scheduleService.ts** - Duplicate?
- ⚠️ **scheduleDatabase.service.ts** - Duplicate?
- ⚠️ **scheduleImport.service.ts** - Specific use case (keep)
- ⚠️ **appointmentBrowser.service.ts** - UI helper (keep)

**Action**: Consolidate schedule* into centralizedSchedule

---

### 📝 Notes/Documentation (8 services)
- ✅ **dictatedNotesService.ts** - Main (keep)
- ✅ **noteActions.service.ts** - Actions (keep)
- ✅ **noteSharing.service.ts** - Sharing (keep)
- ⚠️ **medicalCorrections.service.ts** - Corrections (keep)
- ⚠️ **medicalVocabulary.service.ts** - Vocabulary (keep)
- ⚠️ **medicalVocabularyEnhancer.service.ts** - Duplicate?
- ✅ **maOrders.service.ts** - MA orders (keep)
- ✅ **chart.service.ts** - Charts (keep)

**Action**: Merge vocabulary services

---

### 👤 Patient/User Management (5 services)
- ✅ **patient.service.ts** - Main (keep)
- ✅ **patientData.service.ts** - Data (keep)
- ✅ **doctorProfile.service.ts** - Doctor profiles (keep)
- ⚠️ **accountCreation.service.ts** - Moved to auth?
- ⚠️ **specialty.service.ts** - Keep

**Action**: Move accountCreation logic to auth service

---

### 💊 PumpDrive (15 services - FEATURE-SPECIFIC)
- adminPumpDrive.service.ts
- assessmentHistory.service.ts
- freeTextMCP.service.ts
- pumpChat.service.ts
- pumpComparisonData.service.ts
- pumpDatabase.service.ts
- pumpFeature.service.ts
- pumpProvider.service.ts
- pumpReport.service.ts
- pumpReportAPI.service.ts
- pumpReportCache.service.ts
- pumpReportExport.service.ts
- pumpReportGeneration.service.ts
- pumpReportSharing.service.ts
- pumpRecommendationEngine.ts

**Action**: Group into subdirectory `services/pumpdrive/`
or consolidate into fewer files

---

### 🔧 Utilities (6 services)
- ✅ **logger.service.ts** - Logging (keep)
- ✅ **api.service.ts** - HTTP client (keep)
- ⚠️ **localFallback.service.ts** - Fallback logic (review)
- ✅ **audit.service.ts** - Audit logging (keep)
- ✅ **auditLog.service.ts** - Audit logs (merge with audit?)
- ✅ **sessionMonitoring.service.ts** - Sessions (keep)

**Action**: Merge audit services

---

### 📊 Templates (4 services)
- ✅ **template.service.ts** - Main (keep)
- ✅ **templateImportExport.service.ts** - Import/Export (keep)
- ⚠️ **cleanTemplateProcessor.service.ts** - Moved to AI
- ⚠️ **enhancedTemplateProcessor.service.ts** - Moved to AI

---

## 🗑️ Services to Archive

### Experiments/Old Versions:
1. **highQualityDictation.service.ts** - Experiment
2. **highQualityAI.service.ts** - Experiment
3. **improvedNoteProcessor.service.ts** - Experiment
4. **localFallback.service.ts** - Unused?

### Duplicates:
5. **medicalAuth.service.ts** - Duplicate of supabaseAuth
6. **medicalVocabularyEnhancer.service.ts** - Duplicate
7. **scheduleService.ts** - Duplicate
8. **scheduleDatabase.service.ts** - Duplicate

---

## 📁 Proposed Organization

### Core Services (20 files):
```
src/services/
├── auth/
│   ├── supabaseAuth.service.ts
│   └── authInterceptor.ts
├── speech/
│   ├── deepgramSDK.service.ts
│   ├── speechServiceRouter.service.ts
│   └── browserTTS.service.ts
├── ai/
│   ├── ai.service.ts
│   ├── openai.service.ts
│   ├── bedrock.service.ts
│   └── aiTemplateProcessor.service.ts (consolidated)
├── medical/
│   ├── patient.service.ts
│   ├── doctorProfile.service.ts
│   ├── appointment.service.ts
│   ├── centralizedSchedule.service.ts
│   ├── dictatedNotes.service.ts
│   ├── medicalVocabulary.service.ts
│   └── medicalCorrections.service.ts
├── pumpdrive/
│   ├── pumpCore.service.ts (consolidated)
│   ├── pumpReport.service.ts (consolidated)
│   └── pumpRecommendation.service.ts
└── utils/
    ├── logger.service.ts
    ├── api.service.ts
    ├── audit.service.ts
    └── template.service.ts
```

**Total**: ~25 services (down from 78)

---

## 🎯 Phase 3 Action Plan

### Step 1: Archive Experiments (move 4 files)
- highQualityDictation.service.ts
- highQualityAI.service.ts
- improvedNoteProcessor.service.ts
- localFallback.service.ts

### Step 2: Archive Duplicates (move 4 files)
- medicalAuth.service.ts (if duplicate)
- medicalVocabularyEnhancer.service.ts
- scheduleService.ts
- scheduleDatabase.service.ts

### Step 3: Consolidate AI Services (12 → 4)
- Merge template processors
- Merge extractors

### Step 4: Organize PumpDrive (15 → 3)
- Create pumpdrive/ subdirectory
- Consolidate related services

### Step 5: Create Subdirectories
- Group related services by domain

---

## ✅ Expected Result

**Before**: 78 services (flat structure)
**After**: ~25 services (organized structure)

**Benefits**:
- Easier to find services
- Clear service boundaries
- Less duplication
- Better maintainability
