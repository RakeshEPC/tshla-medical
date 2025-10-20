# Quick Test Guide - Dictation Enhancements

**Purpose**: Test the new features for saving without patient name and multiple AI processing

---

## 🚀 Before You Start

### **Step 1: Update Database**
Run the migration script to allow NULL patient names:

```bash
cd /Users/rakeshpatel/Desktop/tshla-medical

# Connect to Supabase and run:
# Copy contents of database/migrations/alter-dictated-notes-allow-null-patient.sql
# Paste into Supabase SQL Editor
# Execute
```

### **Step 2: Start Backend API**
```bash
# Make sure backend is running on port 3003
node server/enhanced-schedule-notes-api.js
```

Expected output:
```
✅ Server running on http://localhost:3003
```

### **Step 3: Start Frontend**
```bash
npm run dev
```

Expected output:
```
➜  Local:   http://localhost:5173/
```

---

## ✅ Test 1: Save WITHOUT Patient Name

### **Goal**: Verify dictation can be saved to database without patient name

### **Steps**:
1. Navigate to http://localhost:5173
2. Login as a doctor
3. Go to "Quick Note" or "Medical Dictation"
4. **DO NOT** enter patient name (leave empty)
5. Click "Start Recording" (or type in transcript)
6. Dictate: "Patient presents with headache for 3 days"
7. Click "Stop Recording"
8. Click "Process with AI"
9. Wait for processed note to appear

### **Expected Results**:
- ✅ Yellow warning banner appears: "⚠️ No Patient Name"
- ✅ Warning says: "This note is being auto-saved as 'Unidentified Patient'"
- ✅ "Add Patient Name" button visible in warning banner
- ✅ After 30 seconds, auto-save indicator shows "Database saved [time]"

### **Action**: Click "Save to Database" button

### **Expected Results**:
- ✅ Confirmation dialog appears: "⚠️ No Patient Name Entered"
- ✅ Dialog explains note will be saved as "Unidentified Patient"
- ✅ Dialog shows: "Continue saving?"

### **Action**: Click "OK" to confirm

### **Expected Results**:
- ✅ Success message: "Note saved to database!"
- ✅ Note ID displayed

### **Verification**: Check Supabase
1. Open Supabase dashboard
2. Go to Table Editor → dictated_notes
3. Find the most recent note

### **Expected in Database**:
```
patient_name: "[Unidentified Patient - 2025-10-17 14:35]"
requires_patient_identification: true
raw_transcript: "Patient presents with headache..."
processed_note: "SUBJECTIVE: Patient presents..."
```

**Result**: ✅ PASS / ❌ FAIL

---

## ✅ Test 2: Add Patient Name Later

### **Goal**: Verify patient name can be added after initial save

### **Steps**:
1. Continue from Test 1 (note saved without patient name)
2. Yellow warning banner should still be visible
3. Scroll to bottom of page
4. Find "Patient Information" section
5. Enter patient name: "John Test"
6. Wait 30 seconds (auto-save)

### **Expected Results**:
- ✅ Yellow warning banner **disappears**
- ✅ Auto-save indicator shows "Database saved [time]"
- ✅ Save button tooltip changes to normal

### **Verification**: Check Supabase
1. Refresh Supabase dashboard
2. Find the same note (by ID)

### **Expected in Database**:
```
patient_name: "John Test"
requires_patient_identification: false
```

**Result**: ✅ PASS / ❌ FAIL

---

## ✅ Test 3: Multiple AI Processing with Version History

### **Goal**: Verify multiple AI processing saves all versions

### **Steps**:
1. Start new dictation (with or without patient name)
2. Dictate: "Patient is a 45 year old male with history of diabetes. Blood sugar has been elevated. HbA1c is 8.5."
3. Stop recording
4. Select template: "Endocrinology Template" (or any template)
5. Click "Process with AI"
6. **Wait for result** → Output 1 appears

### **Expected Results**:
- ✅ Processed note appears
- ✅ "Versions" button **NOT visible yet** (need 2+ versions)

### **Steps Continue**:
7. Change template to: "Primary Care Template" (different template)
8. Click "Process with AI" **again**
9. Wait for result → Output 2 appears

### **Expected Results**:
- ✅ New processed note appears (different from Output 1)
- ✅ **"📚 Versions (2)" button now visible** near Copy/Print buttons
- ✅ Button shows number "2" in parentheses

### **Action**: Click "Versions (2)" button

### **Expected Results**:
- ✅ Version History panel opens below processed note
- ✅ Panel has purple border
- ✅ Shows "📚 Processing History (2 versions)"
- ✅ **Version 2** listed first (current, highlighted in purple)
  - Shows: Template name
  - Shows: Timestamp
  - Shows: Preview of content (first 200 chars)
  - Shows: "(Current)" label
- ✅ **Version 1** listed second
  - Shows: Template name
  - Shows: Timestamp
  - Shows: Preview of content
  - Shows: "Load This Version" button

### **Action**: Click "Load This Version" on Version 1

### **Expected Results**:
- ✅ Version History panel closes
- ✅ Processed note changes back to Version 1 content
- ✅ "Versions (2)" button still visible

### **Steps Continue**:
10. Change template to: "Psychiatry Template" (3rd template)
11. Click "Process with AI" again
12. Click "Versions" button

### **Expected Results**:
- ✅ **"📚 Versions (3)" button** now shows
- ✅ Version History shows 3 versions
- ✅ All 3 versions have different timestamps and template names
- ✅ Can load any previous version

**Result**: ✅ PASS / ❌ FAIL

---

## ✅ Test 4: Combined Test (No Patient + Multiple Processing)

### **Goal**: Verify both features work together

### **Steps**:
1. Start new dictation
2. **DO NOT** enter patient name
3. Dictate something
4. Process with Template A
5. Process with Template B
6. Process with Template C
7. Wait 30 seconds (auto-save)

### **Expected Results**:
- ✅ Yellow warning banner visible entire time
- ✅ "Versions (3)" button visible
- ✅ Auto-save indicator shows "Database saved"
- ✅ All 3 versions in history with different templates

### **Action**: Click "Save to Database"

### **Expected Results**:
- ✅ Confirmation dialog about no patient name
- ✅ After confirming, note saves with current version
- ✅ Note ID returned

### **Action**: Add patient name "Jane Doe"

### **Expected Results**:
- ✅ Warning banner disappears
- ✅ Auto-save updates database
- ✅ Version history still available (session-only)

**Result**: ✅ PASS / ❌ FAIL

---

## 🐛 Common Issues & Solutions

### **Issue 1: "Auto-save not working"**
**Symptom**: No purple "Database saved" indicator after 30 seconds
**Check**:
```bash
lsof -i:3003  # Should show node process
```
**Solution**: Restart backend API

---

### **Issue 2: "Versions button not appearing"**
**Symptom**: Processed note appears but no "Versions" button
**Check**: Need to process at least **twice**
**Solution**: Click "Process with AI" a second time

---

### **Issue 3: "Warning banner not disappearing"**
**Symptom**: Added patient name but yellow banner still visible
**Solution**:
- Make sure patient name field is **at bottom of page**
- Enter name in the "Patient Information" section
- Wait 30 seconds for auto-save
- Refresh page if needed

---

### **Issue 4: "Version history disappeared after refresh"**
**Symptom**: Refreshed page and version history is gone
**Expected Behavior**: Version history is **session-only** (not saved to database)
**Design**: Only current version saved to database, history is for current session
**Workaround**: Keep browser tab open while working

---

## 📊 Success Criteria

All tests should show:
- ✅ Can save without patient name
- ✅ Yellow warning appears when patient name missing
- ✅ Placeholder patient name in database
- ✅ `requires_patient_identification` flag set correctly
- ✅ Can add patient name later
- ✅ Warning disappears after adding patient name
- ✅ Multiple AI processing saves all versions
- ✅ Version history UI shows correctly
- ✅ Can load previous versions
- ✅ Both features work together

---

## 📝 Test Report Template

```
TSHLA Medical - Dictation Enhancements Test Report
Date: __________
Tester: __________

Test 1: Save WITHOUT Patient Name
  [ ] Warning banner appears
  [ ] Auto-save works
  [ ] Confirmation dialog shown
  [ ] Note saved with placeholder
  [ ] Database flag set correctly
  Result: PASS / FAIL
  Notes: _________________________

Test 2: Add Patient Name Later
  [ ] Warning disappears
  [ ] Database updated
  [ ] Flag cleared
  Result: PASS / FAIL
  Notes: _________________________

Test 3: Multiple AI Processing
  [ ] Versions button appears (2+)
  [ ] Version history panel opens
  [ ] All versions listed
  [ ] Can load previous versions
  [ ] Template names correct
  Result: PASS / FAIL
  Notes: _________________________

Test 4: Combined Test
  [ ] Warning + Versions work together
  [ ] Auto-save with placeholder
  [ ] All features functional
  Result: PASS / FAIL
  Notes: _________________________

Overall Status: ✅ ALL PASS / ⚠️ SOME ISSUES / ❌ MAJOR ISSUES
```

---

## 🎯 Next Steps After Testing

### **If All Tests Pass:**
1. Deploy to production
2. Train providers on new features
3. Monitor for unidentified notes
4. Create dashboard for unidentified notes management

### **If Tests Fail:**
1. Document specific failures
2. Check browser console for errors
3. Check backend logs
4. Review DICTATION_ENHANCEMENTS_SUMMARY.md for troubleshooting
5. Report issues with details

---

**Ready to Test!** 🚀

Start with Test 1 and work through sequentially.
