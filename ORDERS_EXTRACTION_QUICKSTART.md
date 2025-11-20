# Orders Extraction - Quick Start Guide

## 🚀 Quick Start (3 Steps)

### Step 1: Run Database Migration ⚠️ REQUIRED

The orders extraction feature requires database changes. Run this migration in your Supabase SQL Editor:

**File:** `database/migrations/add-extracted-orders-support.sql`

```bash
# Option 1: Copy and paste the SQL file content into Supabase SQL Editor
# Navigate to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new
# Paste the entire contents of: database/migrations/add-extracted-orders-support.sql
# Click "Run"

# Option 2: Use Supabase CLI (if installed)
supabase db push database/migrations/add-extracted-orders-support.sql
```

**What this creates:**
- ✅ `extracted_orders` JSONB column in `dictated_notes` table
- ✅ New `extracted_orders` table for MA workflow
- ✅ Indexes for fast queries
- ✅ RLS policies for security
- ✅ Helper functions for MA dashboard
- ✅ Views for common queries

**Verify migration succeeded:**
```sql
-- Run this query in Supabase SQL Editor
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'dictated_notes'
AND column_name = 'extracted_orders';

-- Should return one row showing the extracted_orders JSONB column
```

### Step 2: Build and Run Application

```bash
cd /Users/rakeshpatel/Desktop/tshla-medical

# Install dependencies (if not already done)
npm install

# Run type check (should pass with no errors)
npm run typecheck

# Start development server
npm run dev
```

### Step 3: Test the Feature

1. **Open the app** and navigate to Medical Dictation
2. **Dictate a note** with some orders, for example:
   ```
   Patient is a 55-year-old with type 2 diabetes.
   Blood sugar is 180 today.
   Start metformin 500mg twice daily with meals.
   Order A1C, CMP, and lipid panel fasting.
   Follow up in 4 weeks.
   ```
3. **Click "Process with AI"**
4. **Scroll down** below the processed note to see:
   ```
   ┌────────────────────────────────────┐
   │  📋 Orders for Staff               │
   │  ├─ 1 Medication Order             │
   │  │  └─ START: Metformin 500mg...  │
   │  └─ 1 Lab Order                    │
   │     └─ Order A1C, CMP...           │
   └────────────────────────────────────┘
   ```
5. **Try the copy button** to copy orders to clipboard
6. **Check confidence scores** - should be >80% for well-formed orders

## 📋 Sample Dictations for Testing

### Test 1: Basic Medication Orders
```
Start metformin 500mg twice daily.
Increase lisinopril to 20mg once daily.
Continue atorvastatin 40mg at bedtime.
```

**Expected:** 3 medication orders with high confidence

### Test 2: Lab Orders
```
Order A1C, CMP, and lipid panel fasting.
STAT CBC and troponin.
Check TSH level.
```

**Expected:** 3 lab orders, one marked STAT

### Test 3: Mixed Orders
```
Patient with chest pain.
STAT EKG and troponin.
Start aspirin 81mg daily.
Schedule stress test.
Refer to cardiology.
```

**Expected:** 1 lab (STAT), 1 medication, 1 imaging, 1 referral

### Test 4: Complex Diabetes Case
```
Patient presents with poorly controlled type 2 diabetes.
Blood sugar 240 this morning.
Start metformin 1000mg twice daily.
Start lantus 10 units at bedtime.
Order A1C, CMP, urinalysis.
Refer to diabetes education.
Follow up in 2 weeks.
```

**Expected:** 2 medications, 1 lab order (multiple tests), 1 referral

## 🎯 What to Look For

### ✅ Good Extraction (High Confidence)
- Specific medication names mentioned
- Dosages included (500mg, 10 units, etc.)
- Frequency stated (twice daily, at bedtime)
- Clear action words (start, order, check)
- **Confidence score: 85-95%**

### ⚠️ Needs Verification (Low Confidence)
- Vague language ("maybe start", "consider ordering")
- No specific medication/test names
- Questions ("should we check?")
- Historical references ("patient was on metformin")
- **Confidence score: <80%** - Yellow warning badge shown

## 🔧 Troubleshooting

### Orders Not Showing Up?

**Check 1:** Is AI processing working?
- Make sure processed note appears
- Check browser console for errors

**Check 2:** Are there actual orders in the dictation?
- Must have action words (start, order, check)
- Must mention specific medications or tests

**Check 3:** Check extractedOrders state
- Open React DevTools
- Find MedicalDictation component
- Check `extractedOrders` state value

### Database Migration Failed?

**Check Supabase Connection:**
```sql
-- Run in SQL Editor to test connection
SELECT NOW();
```

**Check for Existing Tables:**
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('dictated_notes', 'extracted_orders');
```

**Re-run Migration:**
- Copy the entire SQL file again
- Run in a new SQL Editor query tab
- Check for error messages

### TypeScript Errors?

```bash
# Clean and rebuild
rm -rf node_modules package-lock.json
npm install
npm run typecheck
```

## 📊 Verify Database Setup

Run these queries in Supabase SQL Editor:

### Check extracted_orders column exists
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'dictated_notes'
AND column_name = 'extracted_orders';
```

### Check extracted_orders table exists
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'extracted_orders'
ORDER BY ordinal_position;
```

### Check indexes were created
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('dictated_notes', 'extracted_orders')
AND indexname LIKE '%order%';
```

### Test the helper function
```sql
-- Get order statistics
SELECT * FROM get_order_statistics(NULL, CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE);
```

## 🎨 Feature Highlights

When working correctly, you should see:

### 1. Color-Coded Order Display
- 🟢 **Green** - Medication orders
- 🔵 **Blue** - Lab orders
- 🟣 **Purple** - Imaging orders
- 🟠 **Orange** - Prior authorizations
- 🟢 **Teal** - Referrals

### 2. Action Badges
- `START` - New medication
- `STOP` - Discontinue medication
- `CONTINUE` - Keep existing medication
- `INCREASE` - Higher dose
- `DECREASE` - Lower dose
- `ORDER` - Lab/imaging order

### 3. Urgency Badges
- 🔴 **STAT** - Immediate (red badge)
- 🟠 **URGENT** - Soon (orange badge)
- ⚪ **ROUTINE** - No badge (default)

### 4. Copy Functionality
- "Copy All Orders" - Copies everything formatted
- "Copy Section" - Copy individual categories
- Includes patient name, timestamps

### 5. Low Confidence Warnings
- Yellow badge for orders <80% confidence
- Reminds staff to verify against full note
- Shows actual confidence percentage

## 📱 User Interface Flow

```
┌──────────────────────────────────────┐
│ 1. Dictate Note                      │
│    [Microphone interface]            │
└────────────────┬─────────────────────┘
                 ↓
┌──────────────────────────────────────┐
│ 2. Process with AI Button            │
│    [Processing indicator...]         │
└────────────────┬─────────────────────┘
                 ↓
┌──────────────────────────────────────┐
│ 3. Processed Clinical Note           │
│    [Full SOAP note displayed]        │
└────────────────┬─────────────────────┘
                 ↓
┌──────────────────────────────────────┐
│ 4. Orders for Staff ⭐ NEW           │
│    ┌──────────────────────────────┐ │
│    │ 📊 Quick Stats               │ │
│    │ ├─ 2 Medications             │ │
│    │ └─ 3 Labs                    │ │
│    └──────────────────────────────┘ │
│    ┌──────────────────────────────┐ │
│    │ 🟢 MEDICATION ORDERS         │ │
│    │ 1. START: Metformin 500mg... │ │
│    │ 2. INCREASE: Lisinopril...   │ │
│    └──────────────────────────────┘ │
│    ┌──────────────────────────────┐ │
│    │ 🔵 LAB ORDERS                │ │
│    │ 1. Order A1C, CMP (STAT)     │ │
│    │ 2. Check TSH                 │ │
│    └──────────────────────────────┘ │
│    [Copy All Orders]  [Collapse]    │
└──────────────────────────────────────┘
```

## 🎓 Tips for Best Results

### For Providers

1. **Be Explicit with Actions**
   - ✅ "Start metformin 500mg"
   - ❌ "Patient on metformin"

2. **Include Dosage Details**
   - ✅ "Metformin 500mg twice daily with meals"
   - ❌ "Metformin"

3. **Use Clear Order Language**
   - ✅ "Order A1C and CMP"
   - ❌ "Check diabetes control"

4. **Separate New vs Existing**
   - ✅ "Continue atorvastatin, start aspirin"
   - ❌ "Atorvastatin and aspirin"

### For Medical Assistants

1. **Always Verify Low Confidence Orders**
   - Yellow badge = needs manual verification
   - Cross-reference with full note

2. **Check Urgency Badges**
   - STAT orders process first
   - Urgent orders same day

3. **Use Copy Function**
   - Copy to EMR/pharmacy system
   - Saves typing, reduces errors

## 🐛 Common Issues & Solutions

### Issue: No orders extracted
**Solution:** Dictate more explicitly
- Add action words (start, order, check)
- Mention specific drug/test names
- Include dosages for medications

### Issue: Low confidence scores
**Solution:** Add more detail
- Include dosage amounts
- Add frequency (daily, twice daily)
- Use specific test names (A1C vs "diabetes test")

### Issue: Wrong orders extracted
**Solution:** Check for ambiguity
- Historical meds may be extracted
- Questions may be interpreted as orders
- Review full transcript for context

### Issue: Orders not saving to database
**Solution:** Check database migration
- Verify SQL migration ran successfully
- Check browser console for save errors
- Test with a simple dictation first

## 📚 Next Steps

Once basic orders extraction is working:

1. **Explore Confidence Scoring**
   - Review how different phrasings affect confidence
   - Adjust dictation style for better accuracy

2. **Test Edge Cases**
   - Very long orders
   - Multiple orders in one sentence
   - Complex medication regimens

3. **Prepare for MA Dashboard** (Phase 4)
   - MA role assignment
   - Order queue management
   - Completion tracking

4. **API Integration** (Phase 5)
   - Backend endpoints for order management
   - Real-time updates
   - Analytics dashboard

## 📖 Documentation

- **Full Implementation Guide**: `ORDERS_EXTRACTION_IMPLEMENTATION.md`
- **Database Migration**: `database/migrations/add-extracted-orders-support.sql`
- **Component Source**: `src/components/OrdersDisplay.tsx`
- **Service Code**: `src/services/orderExtraction.service.ts`

## 🆘 Getting Help

If you encounter issues:

1. Check browser console for errors
2. Verify database migration succeeded
3. Review `ORDERS_EXTRACTION_IMPLEMENTATION.md` for details
4. Test with the sample dictations above
5. Check confidence scores for problematic orders

## ✅ Success Criteria

You'll know it's working when:

- ✅ Orders appear in color-coded boxes below processed note
- ✅ Copy buttons work and format orders nicely
- ✅ Confidence scores are shown for each order
- ✅ STAT/URGENT badges appear appropriately
- ✅ Low confidence orders show yellow warning badge
- ✅ No TypeScript or console errors
- ✅ Orders persist when saving note to database

---

**Ready to Go!** 🎉

Start with Step 1 (database migration), then test with the sample dictations. The feature should work immediately after the migration runs.

For detailed information, see `ORDERS_EXTRACTION_IMPLEMENTATION.md`.
