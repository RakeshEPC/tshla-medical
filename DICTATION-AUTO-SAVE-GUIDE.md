# Dictation Auto-Save & Auto-Fill Implementation Guide

## ✅ What's Already Done

1. ✅ **Database schema created** - `dictations` table ready
2. ✅ **DictationStorageService created** - [src/services/dictationStorage.service.ts](src/services/dictationStorage.service.ts)
3. ✅ **QuickNote enhanced** - Loads appointment data and passes to MedicalDictation
4. ✅ **SQL Migration ready** - Copy/paste from previous message

## 🔧 Manual Changes Needed in MedicalDictation.tsx

Since MedicalDictation.tsx is 1000+ lines, here are the specific changes to make:

### Step 1: Update Interface (around line 29)

**Find this:**
```typescript
interface MedicalDictationProps {
  patientId?: string;
  preloadPatientData?: boolean;
}
```

**Replace with:**
```typescript
interface AppointmentData {
  id: number;
  patient_name: string;
  patient_phone: string;
  scheduled_date: string;
  start_time: string;
  provider_name: string;
  unified_patient_id: string;
  patient_dob?: string;
  patient_mrn?: string;
}

interface MedicalDictationProps {
  patientId?: string;
  preloadPatientData?: boolean;
  appointmentId?: number | null;
  appointmentData?: AppointmentData | null;
}
```

### Step 2: Update Component Signature (around line 34)

**Find this:**
```typescript
export default function MedicalDictation({ patientId, preloadPatientData = false }: MedicalDictationProps) {
```

**Replace with:**
```typescript
export default function MedicalDictation({
  patientId,
  preloadPatientData = false,
  appointmentId,
  appointmentData
}: MedicalDictationProps) {
```

### Step 3: Add Import (top of file, around line 1-26)

**Add this import:**
```typescript
import { dictationStorageService } from '../services/dictationStorage.service';
```

### Step 4: Add State for Dictation ID (around line 36-90)

**Add these state variables after the existing useState declarations:**
```typescript
const [currentDictationId, setCurrentDictationId] = useState<string | null>(null);
const autoSaveManagerRef = useRef<any>(null);
```

### Step 5: Auto-Fill Patient Data from Appointment (around line 97-150)

**Find the `useEffect` that starts with `const loadPatientData = async () => {`**

**Add this AT THE VERY START of that useEffect (before sessionStorage check):**
```typescript
// HIGHEST PRIORITY: Auto-fill from appointmentData prop
if (appointmentData) {
  const age = appointmentData.patient_dob
    ? new Date().getFullYear() - new Date(appointmentData.patient_dob).getFullYear()
    : null;

  setPatientDetails({
    name: appointmentData.patient_name || '',
    mrn: appointmentData.patient_mrn || '',
    dob: appointmentData.patient_dob || '',
    age: age,
    email: '',
    phone: appointmentData.patient_phone || '',
    visitDate: new Date(appointmentData.scheduled_date).toLocaleDateString()
  });

  logInfo('MedicalDictation', '✅ Patient data auto-filled from appointment', {
    patientName: appointmentData.patient_name,
    appointmentId
  });
  return; // Exit early - we have the data
}
```

### Step 6: Initialize Auto-Save (add new useEffect)

**Add this new useEffect somewhere after the patient data loading useEffect:**
```typescript
// Auto-save manager - saves dictation every 30 seconds
useEffect(() => {
  if (!appointmentId) return; // Only auto-save for appointments

  // Create auto-save manager
  const manager = dictationStorageService.createAutoSaveManager(
    // Get current dictation data
    () => ({
      id: currentDictationId || undefined,
      appointment_id: appointmentId,
      patient_id: appointmentData?.unified_patient_id,
      provider_id: providerId,
      patient_name: patientDetails.name,
      patient_dob: patientDetails.dob,
      patient_mrn: patientDetails.mrn,
      visit_date: patientDetails.visitDate,
      transcription_text: transcript,
      final_note: processedNote || transcript,
      status: 'in_progress'
    }),
    // On save success
    (id) => {
      setCurrentDictationId(id);
      setDatabaseAutoSaveStatus('saved');
      setLastDatabaseSaveTime(new Date());
      console.log('✅ Auto-saved dictation:', id);
    },
    // On save error
    (error) => {
      setDatabaseAutoSaveStatus('error');
      console.error('❌ Auto-save failed:', error);
    },
    30000 // 30 seconds
  );

  autoSaveManagerRef.current = manager;
  manager.start();

  // Cleanup on unmount
  return () => {
    manager.stop();
  };
}, [appointmentId, transcript, processedNote, currentDictationId]);
```

### Step 7: Save on Completion

**Find the function that handles saving/completing the note (probably called `handleSaveNote` or similar)**

**Add this code at the END of that function (after it saves to localStorage/other places):**
```typescript
// Save final dictation to database
if (appointmentId && (transcript || processedNote)) {
  const finalSave = await dictationStorageService.saveDictation({
    id: currentDictationId || undefined,
    appointment_id: appointmentId,
    patient_id: appointmentData?.unified_patient_id,
    provider_id: providerId,
    patient_name: patientDetails.name,
    patient_dob: patientDetails.dob,
    patient_mrn: patientDetails.mrn,
    visit_date: patientDetails.visitDate,
    transcription_text: transcript,
    final_note: processedNote || transcript,
    status: 'completed'
  });

  if (finalSave.success && finalSave.id) {
    // Mark appointment as complete
    await dictationStorageService.completeDictation(finalSave.id, appointmentId);
    console.log('✅ Dictation completed and linked to appointment');
  }
}
```

## 🎯 Testing Checklist

Once you've made these changes:

1. ✅ Run the SQL migration in Supabase
2. ✅ Click "Start Dictation" from schedule
3. ✅ Verify patient info auto-fills (name, MRN, DOB, etc.)
4. ✅ Start dictating
5. ✅ Wait 30 seconds, check database for auto-save
6. ✅ Complete dictation
7. ✅ Check `dictations` table for saved note
8. ✅ Check `provider_schedules` has `dictation_complete = true`

## 📊 What You Get

**Auto-Fill:**
- Patient name, MRN, DOB auto-populated from appointment
- Visit date set to appointment date
- No manual entry needed

**Auto-Save:**
- Saves to database every 30 seconds while dictating
- Version tracking built-in
- Recovery from crashes

**Completion Tracking:**
- Final note saved on completion
- Linked to appointment automatically
- Schedule shows "✅ Dictation Done"

## 🆘 If You Get Stuck

The changes are minimal and isolated. If you encounter issues:
1. Check console for error messages
2. Verify the SQL migration ran successfully
3. Ensure Vite dev server was restarted
4. Check that appointmentId is being passed from QuickNote

Let me know if you need help with any specific step!
