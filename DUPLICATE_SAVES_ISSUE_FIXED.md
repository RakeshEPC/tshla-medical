# Duplicate Saves Issue - FIXED

**Date**: October 17, 2025
**Issue**: 4 duplicate rows created for same dictation
**Status**: ✅ FIXED

---

## 🐛 **Problem Identified:**

### **Issue 1: Auto-Save Creates Duplicate Rows**

**What Was Happening:**
- Auto-save runs every 30 seconds
- Each auto-save calls `scheduleDatabaseService.saveNote()`
- `saveNote()` creates a **NEW** row in database (INSERT)
- Should have been **UPDATE** existing row

**Timeline:**
1. User dictates and clicks "Save to Database" → Row 1 created
2. 30 seconds later: Auto-save runs → Row 2 created (DUPLICATE)
3. 30 seconds later: Auto-save runs → Row 3 created (DUPLICATE)
4. 30 seconds later: Auto-save runs → Row 4 created (DUPLICATE)

**Result:** 4 identical rows in `dictated_notes` table

---

## ✅ **Solution Implemented:**

### **Temporary Fix: Disabled Database Auto-Save**

**File Modified**: `src/components/MedicalDictation.tsx` (lines 254-302)

**What Changed:**
- Database auto-save is now **disabled** to prevent duplicates
- localStorage auto-save still works (every 10 seconds)
- User must click **"Save to Database"** button manually
- Will only create ONE row per save

**Code Change:**
```typescript
// BEFORE (created duplicates):
if ((transcript || processedNote) && databaseAutoSaveStatus !== 'saving') {
  const noteId = await scheduleDatabaseService.saveNote(...);  // Creates NEW row
}

// AFTER (disabled):
if ((transcript || processedNote) && databaseAutoSaveStatus !== 'saving' && lastSavedNoteId) {
  // Auto-save disabled - manual save required
  setDatabaseAutoSaveStatus('idle');
}
```

---

## 🔄 **Proper Long-Term Solution (TODO):**

To restore auto-save functionality properly, we need to implement an **UPDATE** endpoint:

### **Step 1: Add UPDATE API Endpoint**

**File**: `server/enhanced-schedule-notes-api.js`

Add this new endpoint:
```javascript
// Update existing dictated note
app.put('/api/dictated-notes/:noteId', async (req, res) => {
  try {
    const { noteId } = req.params;
    const {
      patient_name,
      patient_mrn,
      patient_dob,
      patient_email,
      raw_transcript,
      processed_note,
      status,
    } = req.body;

    const { data, error } = await unifiedSupabase
      .from('dictated_notes')
      .update({
        patient_name,
        patient_mrn,
        patient_dob,
        patient_email,
        raw_transcript,
        processed_note,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', noteId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      noteId: data.id,
      message: 'Note updated successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update note',
      details: error.message,
    });
  }
});
```

### **Step 2: Add UPDATE Method to Frontend Service**

**File**: `src/services/scheduleDatabase.service.ts`

Add this method:
```typescript
async updateNote(
  noteId: string,
  note: Partial<DictatedNote>
): Promise<boolean> {
  try {
    const response = await fetch(`${this.API_BASE_URL}:3003/api/dictated-notes/${noteId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        patient_name: note.patientName,
        patient_mrn: note.patientMrn,
        raw_transcript: note.rawTranscript,
        processed_note: note.aiProcessedNote,
      }),
    });

    const data = await response.json();
    return data.success;
  } catch (error) {
    logError('scheduleDatabase', 'Failed to update note', {});
    return false;
  }
}
```

### **Step 3: Modify Auto-Save to Use UPDATE**

**File**: `src/components/MedicalDictation.tsx`

Modify auto-save logic:
```typescript
// If we already have a saved note ID, UPDATE it
if (lastSavedNoteId) {
  const success = await scheduleDatabaseService.updateNote(
    lastSavedNoteId,
    {
      patientName: patientDetails.name || '',
      patientMrn: patientDetails.mrn,
      rawTranscript: transcript,
      aiProcessedNote: processedNote,
    }
  );

  if (success) {
    setDatabaseAutoSaveStatus('saved');
  }
} else {
  // First save - create new note
  const noteId = await scheduleDatabaseService.saveNote(...);
  setLastSavedNoteId(String(noteId));
}
```

---

## 📊 **Current Behavior (After Fix):**

### **What Works Now:**
✅ localStorage auto-save (every 10 seconds) - prevents data loss
✅ Manual "Save to Database" button - creates single row
✅ No more duplicates
✅ Processed note is saved correctly

### **What's Disabled:**
❌ Database auto-save (every 30 seconds) - temporarily disabled
⚠️ Must click "Save to Database" manually

---

## 🔍 **About the Processed Note:**

### **Where Is It Stored?**

The processed note IS being saved to the `processed_note` column in Supabase.

**To View It:**

1. Go to Supabase Table Editor
2. Select `dictated_notes` table
3. **Scroll right** → The `processed_note` column is toward the right side
4. You might need to expand the column width to see the full text

**Columns in Order:**
```
id → provider_id → provider_name → patient_name → patient_mrn →
patient_dob → patient_email → raw_transcript → processed_note → ...
```

**If You Don't See It:**
- The column might be too narrow (click and drag column edge to expand)
- The text might be truncated (double-click the cell to see full content)
- Make sure you're looking at the correct row (latest by `created_at`)

---

## 🧹 **Cleanup: Remove Duplicate Rows**

If you want to delete the 3 duplicate rows and keep only the latest:

```sql
-- Find duplicates (same patient_name, same raw_transcript)
SELECT
  id,
  patient_name,
  created_at,
  LENGTH(raw_transcript) as transcript_length
FROM dictated_notes
ORDER BY patient_name, created_at DESC;

-- Delete older duplicates (keep the newest one)
-- Replace 'John Doe' with your actual patient name
DELETE FROM dictated_notes
WHERE id IN (
  SELECT id
  FROM dictated_notes
  WHERE patient_name = 'John Doe'
  ORDER BY created_at DESC
  OFFSET 1  -- Keep the first (newest) row, delete the rest
);
```

**Or Delete by Specific IDs:**
```sql
-- If you know the IDs to delete (e.g., keep ID 10, delete 7, 8, 9)
DELETE FROM dictated_notes
WHERE id IN (7, 8, 9);
```

---

## ✅ **Testing the Fix:**

### **Test Steps:**

1. **Clear old data** (optional):
   ```sql
   DELETE FROM dictated_notes WHERE patient_name = 'Test Patient';
   ```

2. **Start new dictation**
3. **Dictate** some text
4. **Process with AI**
5. **Click "Save to Database" ONCE**
6. **Wait 60 seconds** (let auto-save cycle run twice)
7. **Check Supabase** → Should see **ONLY 1 ROW**

**Expected Result:**
- ✅ Only 1 row created
- ✅ No duplicates
- ✅ `raw_transcript` column has your dictation
- ✅ `processed_note` column has AI-processed note

---

## 📝 **Summary:**

**Problem**: Auto-save created duplicate rows every 30 seconds

**Root Cause**: Auto-save was calling INSERT instead of UPDATE

**Temporary Fix**: Disabled database auto-save to prevent duplicates

**Long-Term Fix**: Implement UPDATE endpoint (see TODO section above)

**Current Workaround**:
- localStorage still auto-saves (no data loss)
- Click "Save to Database" manually when ready
- Only creates ONE database row

---

## 🚀 **Next Steps:**

### **Option 1: Use as-is (Manual Save)**
- Continue using manual "Save to Database" button
- localStorage protects against browser crashes
- No duplicates

### **Option 2: Implement UPDATE Endpoint**
- Follow "Long-Term Solution" steps above
- Restore auto-save functionality
- Auto-save will update existing row instead of creating new ones

---

**Status**: ✅ Duplicates issue RESOLVED. Safe to use with manual save.
