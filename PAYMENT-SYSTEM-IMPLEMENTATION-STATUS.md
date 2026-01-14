# Patient Payment System - Implementation Status

**Session Date**: January 14, 2026
**Status**: Phase 1 Complete (Backend) - Frontend Pending
**Commit**: `7b96488d`

---

## 🎯 PROJECT OVERVIEW

Build complete online payment system for patient copays, deductibles, and balances:
- Staff creates payment requests from pre-visit prep page
- Staff copies payment link to send via Klara
- Patient pays online via Stripe on their summary portal
- Real-time status updates (pending → paid)
- Staff tracks/reconciles payments in dedicated dashboard
- "Posted in EMR" workflow for archiving

**Key Requirement**: Single Stripe account with metadata differentiation
- `type: 'pump_report'` - Existing PumpDrive payments ($4.99)
- `type: 'office_visit_copay'` - NEW office visit payments (variable amounts)

---

## ✅ PHASE 1: BACKEND (100% COMPLETE)

### Database Migrations (MUST RUN FIRST!)

**Files Created**:
1. `database/migrations/create-patient-payment-requests.sql`
2. `database/migrations/update-previsit-billing-for-payments.sql`

**ACTION REQUIRED**: Run in Supabase SQL Editor before continuing!

### Backend API (COMPLETE)

**New File**: `server/routes/patient-payment-api.js` (434 lines)

**Endpoints**:
```javascript
POST   /api/payment-requests/create                    // Create payment request
GET    /api/payment-requests/by-tshla-id/:tshlaId     // Get patient payments
POST   /api/payment-requests/:id/checkout              // Initiate Stripe
GET    /api/payment-requests/list                      // List all (with filters)
PATCH  /api/payment-requests/:id/mark-posted          // Mark as posted
DELETE /api/payment-requests/:id                       // Cancel request
GET    /api/payment-requests/reports/daily-summary    // Daily report
GET    /api/payment-requests/reports/unposted         // Unposted report
GET    /api/payment-requests/reports/outstanding      // Outstanding report
```

**Modified Files**:
- `server/unified-api.js` - Mounted `/api/payment-requests/*`
- `server/pump-report-api.js` - Updated webhook to handle both payment types

### Stripe Webhook Integration (COMPLETE)

**Location**: `server/pump-report-api.js` lines 1216-1285

**Handles Two Payment Types**:

```javascript
// Existing: PumpDrive payments
if (metadata.type === 'pump_report') {
  // Update pump_assessments.payment_status = 'paid'
}

// NEW: Office visit payments
if (metadata.type === 'office_visit_copay') {
  // Update patient_payment_requests.payment_status = 'paid'
  // Update previsit_data.patient_paid = true
}
```

### TypeScript Types & Services (COMPLETE)

**Files**:
- `src/types/payment.types.ts` - All interfaces
- `src/services/paymentRequest.service.ts` - API client

---

## 🚧 PHASE 2: STAFF INTERFACE (PENDING)

### File 1: Update StaffPreVisitPrep.tsx

**Location**: `src/pages/StaffPreVisitPrep.tsx`

**What to Add**:

After the existing billing section (after "Billing & Payment" card), add:

```tsx
{/* Payment Request Generator - NEW SECTION */}
<div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg shadow-md p-6 mt-6 border-2 border-green-300">
  <h3 className="text-lg font-bold text-gray-900 mb-3">💳 Online Payment Request</h3>

  {/* Amount Input */}
  <div className="mb-4">
    <label>Amount to Charge Patient</label>
    <input type="text" value={paymentAmount} onChange={...} />
  </div>

  {/* Payment Type Dropdown */}
  <div className="mb-4">
    <label>Payment Type</label>
    <select value={paymentType} onChange={...}>
      <option value="copay">Copay</option>
      <option value="deductible">Deductible</option>
      <option value="balance">Balance</option>
    </select>
  </div>

  {/* Generate Button */}
  <button onClick={handleGeneratePaymentRequest}>
    Generate Payment Request
  </button>

  {/* Payment Link (after generation) */}
  {paymentLink && (
    <div>
      <label>Payment Link (Copy to Klara)</label>
      <div className="flex gap-2">
        <input readOnly value={paymentLink} />
        <button onClick={() => navigator.clipboard.writeText(paymentLink)}>
          Copy
        </button>
      </div>
    </div>
  )}

  {/* Status Display */}
  {paymentStatus === 'pending' && <p>⏳ Payment Pending</p>}
  {paymentStatus === 'paid' && <p>✅ Paid ${amountPaid} on {paidDate}</p>}
</div>
```

**State to Add**:
```typescript
const [paymentAmount, setPaymentAmount] = useState('');
const [paymentType, setPaymentType] = useState<'copay' | 'deductible' | 'balance'>('copay');
const [paymentLink, setPaymentLink] = useState('');
const [activePaymentRequest, setActivePaymentRequest] = useState<PaymentRequest | null>(null);
```

**Handler Function**:
```typescript
const handleGeneratePaymentRequest = async () => {
  const amountCents = Math.round(parseFloat(paymentAmount) * 100);

  const result = await paymentRequestService.createPaymentRequest({
    previsit_id: appointmentId, // OR get from state
    tshla_id: appointment.tsh_id,
    share_link_id: shareLinkId, // Need to get this
    patient_name: appointment.patient_name,
    patient_phone: appointment.patient_phone,
    athena_mrn: appointment.old_emr_number,
    amount_cents: amountCents,
    payment_type: paymentType,
    em_code: billing.emCode,
    provider_name: appointment.provider_name,
    visit_date: appointment.scheduled_date,
  });

  setPaymentLink(result.paymentLink);
  setActivePaymentRequest(result.paymentRequest);
};
```

**Important**: Need to fetch `share_link_id` from `patient_audio_summaries` table by TSHLA ID

---

### File 2: Create StaffPaymentDashboard.tsx

**Location**: `src/pages/StaffPaymentDashboard.tsx` (NEW FILE)

**Purpose**: Main payment tracking dashboard for staff

**Components Needed**:

1. **Summary Cards** (top):
   - Total Pending (amount + count)
   - Total Paid (amount + count)
   - Not Posted in EMR (amount + count)

2. **Filters**:
   - Status dropdown (All, Pending, Paid, Canceled)
   - Posted dropdown (All, Posted, Not Posted)
   - Date range picker
   - Search box (patient name, MRN, TSHLA ID)

3. **Payment Table**:
   ```
   | Date | Patient | Athena MRN | TSHLA ID | Amount | Status | Posted | Actions |
   ```

4. **Actions**:
   - View details
   - Copy link (for pending)
   - Mark as Posted (for paid)
   - Cancel (for pending)

**Key Functions**:
```typescript
const loadPayments = async () => {
  const data = await paymentRequestService.listPayments(filters);
  setPayments(data.payments);
  setSummary(data.summary);
};

const handleMarkAsPosted = async (paymentId: string) => {
  await paymentRequestService.markAsPosted(paymentId, staffId);
  await loadPayments(); // Refresh
};

const handleCancelPayment = async (paymentId: string) => {
  if (confirm('Cancel this payment request?')) {
    await paymentRequestService.cancelPayment(paymentId);
    await loadPayments();
  }
};
```

**Styling**: Use same style as `StaffPatientSummaries.tsx` for consistency

---

### File 3: Create PatientPaymentReports.tsx

**Location**: `src/pages/PatientPaymentReports.tsx` (NEW FILE)

**Purpose**: Reports and exports for accounting

**Tabs**:
1. Daily Summary
2. Unposted Payments
3. Outstanding Payments
4. Custom Report

**Export Buttons**: CSV, PDF (future)

---

## 🚧 PHASE 3: PATIENT INTERFACE (PENDING)

### File 4: Update PatientSummaryPortal.tsx

**Location**: `src/pages/PatientSummaryPortal.tsx`

**What to Add**: At TOP of page (before audio player), add payment cards section:

```tsx
{/* NEW: Outstanding Payments Section */}
{pendingPayments.length > 0 && (
  <div className="mb-6 bg-yellow-50 border-2 border-yellow-400 rounded-lg p-6">
    <h2 className="text-xl font-bold text-gray-900 mb-4">
      💳 Outstanding Payments
    </h2>
    <p className="text-sm text-gray-600 mb-4">
      You have {pendingPayments.length} pending payment(s)
    </p>

    <div className="space-y-4">
      {pendingPayments.map(payment => (
        <PatientPaymentCard
          key={payment.id}
          payment={payment}
          onPay={handlePayment}
        />
      ))}
    </div>
  </div>
)}

{/* Existing: Audio player and summary */}
```

**Load Payments on Mount**:
```typescript
useEffect(() => {
  const loadPayments = async () => {
    if (tshlaId) {
      const payments = await paymentRequestService.getPaymentsByTshlaId(tshlaId);
      setPendingPayments(payments.filter(p => p.payment_status === 'pending'));
    }
  };
  loadPayments();
}, [tshlaId]);
```

**Payment Handler**:
```typescript
const handlePayment = async (paymentRequestId: string) => {
  const result = await paymentRequestService.initiateCheckout(paymentRequestId);
  window.location.href = result.checkoutUrl; // Redirect to Stripe
};
```

---

### File 5: Create PatientPaymentCard Component

**Location**: `src/components/payments/PatientPaymentCard.tsx` (NEW FILE)

**Props**:
```typescript
interface Props {
  payment: PaymentRequest;
  onPay: (paymentId: string) => void;
}
```

**UI**:
```tsx
<div className="bg-white border-2 border-gray-300 rounded-lg p-4">
  <div className="flex justify-between items-start">
    <div>
      <p className="text-sm text-gray-600">
        {formatDate(payment.visit_date)} - {payment.payment_type}
      </p>
      <p className="text-2xl font-bold text-gray-900">
        ${(payment.amount_cents / 100).toFixed(2)}
      </p>
      <p className="text-sm text-gray-600">{payment.provider_name}</p>
    </div>
    <button
      onClick={() => onPay(payment.id)}
      className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
    >
      Pay ${(payment.amount_cents / 100).toFixed(2)} Now
    </button>
  </div>
</div>
```

---

## 🚧 PHASE 4: INTEGRATION (PENDING)

### File 6: Update App.tsx

**Location**: `src/App.tsx`

**Add Routes**:
```typescript
// In lazy imports section
const StaffPaymentDashboard = lazy(() => import('./pages/StaffPaymentDashboard'));
const PatientPaymentReports = lazy(() => import('./pages/PatientPaymentReports'));

// In <Routes> section
<Route
  path="/patient-payments"
  element={
    <ProtectedRoute>
      <Suspense fallback={<LoadingSpinner />}>
        <StaffPaymentDashboard />
      </Suspense>
    </ProtectedRoute>
  }
/>
<Route
  path="/patient-payments/reports"
  element={
    <ProtectedRoute>
      <Suspense fallback={<LoadingSpinner />}>
        <PatientPaymentReports />
      </Suspense>
    </ProtectedRoute>
  }
/>
```

---

### File 7: Update DoctorDashboardUnified.tsx

**Location**: `src/pages/DoctorDashboardUnified.tsx`

**Add Tab**:
```tsx
// In navigation tabs
<button onClick={() => navigate('/patient-payments')}>
  💳 Patient Payments
</button>
```

---

## 📊 TESTING PLAN (After Frontend Complete)

### Test Scenario 1: Create Payment Request
1. Navigate to `/staff-previsit-prep?appointmentId=57904`
2. Enter amount: `$25.00`
3. Select type: "Copay"
4. Click "Generate Payment Request"
5. ✅ Payment link appears
6. ✅ Copy link works
7. ✅ Status shows "⏳ Pending"

### Test Scenario 2: Patient Payment
1. Open payment link in incognito window
2. Enter TSHLA ID
3. ✅ Payment card appears at top
4. Click "Pay $25.00 Now"
5. ✅ Redirects to Stripe checkout
6. Enter test card: `4242 4242 4242 4242`
7. Complete payment
8. ✅ Redirects back to summary portal
9. ✅ Payment card shows "✅ Paid"

### Test Scenario 3: Staff Dashboard Update
1. Return to `/staff-previsit-prep?appointmentId=57904`
2. ✅ Status updates to "✅ Paid $25.00 on [date]"
3. Navigate to `/patient-payments`
4. ✅ Payment appears in dashboard
5. ✅ Status shows "Paid"
6. ✅ Summary cards update

### Test Scenario 4: Post to EMR
1. In payment dashboard, find paid payment
2. Click "Post to EMR"
3. Confirm dialog
4. ✅ Checkbox checked
5. ✅ Row archived (moves to Posted filter)

### Test Scenario 5: Stripe Dashboard
1. Login to Stripe dashboard
2. Go to Payments → All payments
3. ✅ Payment appears with metadata
4. Filter by `type = "office_visit_copay"`
5. ✅ Shows only office visit payments
6. Filter by `type = "pump_report"`
7. ✅ Shows only pump report payments

---

## 🔑 KEY IMPLEMENTATION NOTES

### Important Data Links

**Getting Share Link ID for Payment**:
```sql
-- Need to query patient_audio_summaries by TSHLA ID
SELECT share_link_id
FROM patient_audio_summaries
WHERE tshla_id = 'TSH-2026-0123'
ORDER BY created_at DESC
LIMIT 1;
```

**Or create new share link if none exists**:
```sql
INSERT INTO patient_audio_summaries (
  share_link_id,
  tshla_id,
  patient_name,
  patient_phone,
  -- other fields...
) VALUES (
  generate_unique_share_link_id(),
  'TSH-2026-0123',
  'John Doe',
  '+18325551234'
);
```

### Real-Time Updates

**Webhook Flow**:
1. Patient completes Stripe checkout
2. Stripe sends webhook to `/api/stripe/webhook`
3. Backend updates `patient_payment_requests.payment_status = 'paid'`
4. Backend updates `previsit_data.patient_paid = true`
5. Frontend polls for status change OR use websockets (future enhancement)

**Current Implementation**: Manual refresh required on staff page
**Future Enhancement**: WebSocket or SSE for real-time updates

### Amount Handling

**IMPORTANT**: All amounts stored in cents in database
- User enters: `$25.00`
- Convert to cents: `2500`
- Store in DB: `2500`
- Display: `$25.00` (divide by 100)

### Multiple Payments Per Patient

**Supported**: Patient can have multiple pending payments
- Newest displayed first
- Each has unique payment link
- All use same TSHLA ID for portal access
- Each payment card has own "Pay Now" button

---

## 🚨 CRITICAL REMINDERS

### Before Starting Frontend

1. **Run database migrations** in Supabase (MUST DO FIRST!)
2. **Deploy backend** (triggered - check GitHub Actions)
3. **Test API endpoints** with Postman/curl
4. **Verify Stripe webhook** is receiving events

### Import Statements Needed

```typescript
// In frontend files
import { paymentRequestService } from '../services/paymentRequest.service';
import type { PaymentRequest, CreatePaymentRequestData } from '../types/payment.types';
```

### Environment Variables Required

**Already Set** (verify in `.env`):
- `STRIPE_SECRET_KEY` - Backend Stripe key
- `VITE_STRIPE_PUBLISHABLE_KEY` - Frontend Stripe key
- `STRIPE_WEBHOOK_SECRET` - Webhook signing secret

---

## 📝 SESSION CONTINUITY CHECKLIST

**For Next Session, Start With**:

- [ ] Verify backend deployment completed successfully
- [ ] Verify database migrations ran successfully
- [ ] Test `/api/payment-requests/create` endpoint
- [ ] Test `/api/payment-requests/list` endpoint
- [ ] Begin Phase 2: Update `StaffPreVisitPrep.tsx`
- [ ] Create `StaffPaymentDashboard.tsx`
- [ ] Create `PatientPaymentCard.tsx`
- [ ] Update `PatientSummaryPortal.tsx`
- [ ] Add routes in `App.tsx`
- [ ] End-to-end testing
- [ ] Final deployment

---

## 📂 FILES MODIFIED IN THIS SESSION

**Created**:
1. `database/migrations/create-patient-payment-requests.sql`
2. `database/migrations/update-previsit-billing-for-payments.sql`
3. `database/migrations/add-billing-to-previsit.sql` (earlier in session)
4. `server/routes/patient-payment-api.js`
5. `src/types/payment.types.ts`
6. `src/services/paymentRequest.service.ts`

**Modified**:
1. `server/unified-api.js` - Mounted payment API
2. `server/pump-report-api.js` - Updated webhook
3. `src/pages/StaffPreVisitPrep.tsx` - Added billing section (earlier)

**Committed**: ✅ All backend files pushed to GitHub

---

## 🎯 SUCCESS CRITERIA

System is complete when:
- ✅ Staff can generate payment requests
- ✅ Payment link copies to clipboard
- ✅ Patient sees pending payments on portal
- ✅ Patient can pay via Stripe
- ✅ Real-time status updates work
- ✅ Staff dashboard shows all payments
- ✅ Filtering/search works
- ✅ "Post to EMR" workflow works
- ✅ Reports generate correctly
- ✅ Stripe dashboard differentiates payment types

---

**Last Updated**: January 14, 2026 2:30 PM CST
**Next Session**: Continue with Phase 2 (Staff UI)
