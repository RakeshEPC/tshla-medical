# Credit Card Last 4 Digits Fix

**Issue**: Card last 4 digits not showing in payment reports
**Date**: February 2, 2026
**Status**: Ready to Deploy

---

## Problem

The payment reports transaction table shows "N/A" for the card last 4 digits column, even though payments were successfully processed through Stripe.

## Root Cause

The `card_last_4` database column was missing from the `patient_payment_requests` table.

---

## Solution

### Part 1: Database Migration (Required First)

**File**: `database/migrations/add-card-last4-column.sql`

**Action Required**: Run this SQL in Supabase SQL Editor

1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `database/migrations/add-card-last4-column.sql`
3. Click **RUN**
4. Verify output shows: `Column card_last_4 added successfully`

This adds the `card_last_4 VARCHAR(4)` column to the table.

---

### Part 2: Improved Webhook Handler

**File**: `server/routes/stripe-webhook.js`

**Changes Made**:
- Enhanced card details extraction logic with multiple fallback methods
- Added better logging to track card retrieval success/failure
- Now tries 3 different paths to get card last 4:
  1. From session.payment_method_details (most reliable)
  2. From PaymentIntent with expanded charges
  3. From charge.source (legacy API)

**Status**: ✅ Already Updated

---

### Part 3: Backfill Existing Payments

**File**: `server/scripts/backfill-card-last4.js`

**Purpose**: Updates existing paid payments to add missing card last 4 digits by querying Stripe

**How to Run** (AFTER running the database migration):

```bash
cd /Users/rakeshpatel/Desktop/tshla-medical
node server/scripts/backfill-card-last4.js
```

**What it does**:
- Finds all paid payments without card_last_4
- Retrieves card details from Stripe for each payment
- Updates the database with the last 4 digits
- Provides summary of successes/failures

---

## Deployment Steps

### Step 1: Run Database Migration ⚠️ DO THIS FIRST

```sql
-- Go to Supabase Dashboard → SQL Editor
-- Copy/paste from: database/migrations/add-card-last4-column.sql
-- Click RUN
```

### Step 2: Restart Backend Server

```bash
# Kill existing server
lsof -ti:3001 | xargs kill -9

# Start server
cd /Users/rakeshpatel/Desktop/tshla-medical
PORT=3001 node server/unified-api.js > logs/unified-api.log 2>&1 &
```

### Step 3: Run Backfill Script (Optional but Recommended)

```bash
node server/scripts/backfill-card-last4.js
```

This will populate card_last_4 for existing payments.

### Step 4: Verify

1. Go to https://www.tshla.ai/patient-payments
2. Click "Reports" → "Daily Summary"
3. Select a date with paid payments
4. Check the "Transaction History" table
5. The "Card" column should now show `****1234` instead of `N/A`

---

## Testing New Payments

After deployment, test with a new payment:

1. Create a new payment request
2. Complete payment via Stripe checkout
3. Wait for webhook to process (~5 seconds)
4. Check logs: `tail -f logs/unified-api.log | grep card`
5. Verify payment reports show the card last 4

---

## Files Modified

1. ✅ `server/routes/stripe-webhook.js` - Enhanced card extraction
2. ✅ `database/migrations/add-card-last4-column.sql` - Database migration
3. ✅ `server/scripts/backfill-card-last4.js` - Backfill utility

## Files Previously Updated (Payment Reports Enhancement)

1. ✅ `src/pages/PatientPaymentReports.tsx` - Transaction table (already shows card_last_4)
2. ✅ `src/types/payment.types.ts` - Type definition (already has card_last_4)
3. ✅ `server/routes/patient-payment-api.js` - Returns transactions array

---

## Expected Results

**Before Fix**:
```
Card column: N/A
Database: card_last_4 = NULL
```

**After Fix**:
```
Card column: ****1234
Database: card_last_4 = "1234"
Logs: "Retrieved card last 4 from charge: 1234"
```

---

## Troubleshooting

### If card still shows N/A after migration:

**Check 1**: Verify column exists
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'patient_payment_requests' AND column_name = 'card_last_4';
```

**Check 2**: Check webhook logs
```bash
tail -f logs/unified-api.log | grep StripeWebhook
```

**Check 3**: Test a new payment
Make a test payment and watch the logs for card extraction

**Check 4**: Run backfill script
```bash
node server/scripts/backfill-card-last4.js
```

---

## Security Note

The `card_last_4` field only stores the last 4 digits (e.g., "1234"), never the full card number. This is PCI-DSS compliant and safe to store.

---

**Status**: ✅ Code Ready - ⚠️ Requires Database Migration
