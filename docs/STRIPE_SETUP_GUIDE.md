# Stripe Payment Integration - Complete Setup Guide

**Last Updated:** January 9, 2026
**Product:** TSHLA Medical - Insulin Pump Recommendation Reports
**Price:** $9.99 per report

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start (5 Minutes)](#quick-start)
3. [Detailed Setup Steps](#detailed-setup-steps)
4. [Testing Your Integration](#testing-your-integration)
5. [Production Deployment](#production-deployment)
6. [Troubleshooting](#troubleshooting)
7. [Security Best Practices](#security-best-practices)

---

## Prerequisites

✅ **What You Need:**
- Stripe account (sign up at https://stripe.com - free)
- Bank account connected to Stripe for payouts
- Access to your `.env` file
- Access to Azure Container App environment variables (for production)
- 5-10 minutes of your time

✅ **What's Already Built:**
- Complete checkout flow
- Payment verification
- Webhook handling
- Database integration
- Frontend billing page

---

## Quick Start (5 Minutes)

### Option 1: Test Mode (Development)

```bash
# 1. Get Stripe TEST keys
# Go to: https://dashboard.stripe.com/test/apikeys

# 2. Update .env file
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET_HERE
VITE_ENABLE_PAYMENT_FLOW=true

# 3. Run database migration
# In Supabase SQL Editor, run: database/migrations/012_stripe_payment_tables.sql

# 4. Restart your dev server
npm run dev

# 5. Test checkout at: http://localhost:5173/pumpdrive/billing
```

### Option 2: Production Mode

Same as test mode, but use **live keys** from: https://dashboard.stripe.com/apikeys

⚠️ **Warning:** Only use live keys in production after thorough testing!

---

## Detailed Setup Steps

### Step 1: Create Stripe Account (2 minutes)

1. Go to https://stripe.com
2. Click "Sign up" (top right)
3. Enter your email and create a password
4. Complete business information:
   - Business name: **TSHLA Medical** (or your business name)
   - Business type: **Healthcare** or **Technology**
   - Website: **www.tshla.ai**
5. Add bank account for payouts (required for live mode)

### Step 2: Get Your API Keys (1 minute)

#### For Testing (Development):
1. Go to: https://dashboard.stripe.com/test/apikeys
2. You'll see two keys:
   - **Publishable key** (starts with `pk_test_...`) - Safe to expose
   - **Secret key** (starts with `sk_test_...`) - Keep private!
3. Click "Reveal test key" for the secret key
4. Copy both keys

#### For Production:
1. **Toggle off** "Test mode" in top right of Stripe Dashboard
2. Go to: https://dashboard.stripe.com/apikeys
3. Same process, but keys start with `pk_live_...` and `sk_live_...`

### Step 3: Configure Webhook (2-3 minutes)

Webhooks let Stripe notify your server when payments complete.

#### Development (Local Testing):
Skip this step - you can test without webhooks using the verify endpoint.

#### Production (Required):

1. **Go to Webhooks:**
   - Test Mode: https://dashboard.stripe.com/test/webhooks
   - Live Mode: https://dashboard.stripe.com/webhooks

2. **Add Endpoint:**
   - Click "+ Add endpoint" button

3. **Enter Webhook URL:**
   ```
   https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/stripe/webhook
   ```

4. **Select Events:**
   - Click "Select events"
   - Search for: `checkout.session.completed`
   - Check the box ✅
   - Click "Add events"

5. **Get Signing Secret:**
   - After creating webhook, click on it
   - Find "Signing secret" section
   - Click "Reveal" and copy the secret (starts with `whsec_...`)

### Step 4: Update Environment Variables (1 minute)

#### Local Development (.env file):

```bash
# Stripe Configuration
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_51S2emfCH4zbWwt3mkGhlWg... # Your test publishable key
STRIPE_SECRET_KEY=sk_test_51S2emfCH4zbWwt3mkGhlWg...           # Your test secret key
STRIPE_WEBHOOK_SECRET=whsec_abc123...                           # Your webhook secret
VITE_ENABLE_PAYMENT_FLOW=true                                   # Enable payments!
```

#### Production (Azure Container App):

**Option A: GitHub Secrets (Recommended)**

1. Go to: https://github.com/YOUR_ORG/tshla-medical/settings/secrets/actions
2. Add these secrets:
   ```
   VITE_STRIPE_PUBLISHABLE_KEY = pk_live_...
   STRIPE_SECRET_KEY = sk_live_...
   STRIPE_WEBHOOK_SECRET = whsec_...
   VITE_ENABLE_PAYMENT_FLOW = true
   ```

**Option B: Azure Portal**

1. Go to Azure Portal: https://portal.azure.com
2. Navigate to: Container Apps → tshla-unified-api → Settings → Environment variables
3. Add the same variables as above
4. Click "Save" and restart container

### Step 5: Run Database Migration (1 minute)

1. Go to Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: **tshla-medical**
3. Go to: SQL Editor
4. Click "New query"
5. Paste contents of: `database/migrations/012_stripe_payment_tables.sql`
6. Click "Run" (or press Cmd/Ctrl + Enter)
7. Verify: Should see ✅ "Success. No rows returned"

This creates:
- `payment_records` table
- `pump_assessments.payment_status` column
- Helper functions for payment processing
- RLS policies for security

### Step 6: Restart Your Application

#### Development:
```bash
# Stop server (Ctrl+C)
npm run dev
```

#### Production:
```bash
# Option 1: Push to GitHub (triggers auto-deploy)
git push origin main

# Option 2: Restart in Azure Portal
# Go to Container App → Overview → Restart
```

---

## Testing Your Integration

### Test Card Numbers

Stripe provides test cards that simulate different scenarios:

| Card Number          | Scenario                    | CVC  | Expiry     |
|---------------------|-----------------------------|------|------------|
| 4242 4242 4242 4242 | ✅ Successful payment        | Any  | Any future |
| 4000 0000 0000 0002 | ❌ Card declined             | Any  | Any future |
| 4000 0000 0000 9995 | ❌ Insufficient funds        | Any  | Any future |
| 4000 0025 0000 3155 | ⚠️ Requires authentication   | Any  | Any future |

### Test Flow (Development):

1. **Start Dev Server:**
   ```bash
   npm run dev
   ```

2. **Navigate to Billing Page:**
   ```
   http://localhost:5173/pumpdrive/billing
   ```

3. **Create Account:**
   - Click "Choose Standard Access"
   - Enter test email: `test@example.com`
   - Create username and password

4. **Complete Payment:**
   - You'll be redirected to Stripe Checkout
   - Enter test card: `4242 4242 4242 4242`
   - Enter any future expiry (e.g., 12/30)
   - Enter any 3-digit CVC (e.g., 123)
   - Click "Pay $9.99"

5. **Verify Success:**
   - You should be redirected back with `?paid=true`
   - Check Supabase database:
     ```sql
     SELECT * FROM payment_records ORDER BY created_at DESC LIMIT 5;
     SELECT * FROM pump_assessments WHERE payment_status = 'paid' LIMIT 5;
     ```

6. **Check Stripe Dashboard:**
   - Go to: https://dashboard.stripe.com/test/payments
   - You should see your test payment

### Test Webhook (Production Only):

1. **Make a Test Payment** (using test mode keys)

2. **Check Webhook Logs:**
   - Go to: https://dashboard.stripe.com/test/webhooks
   - Click on your webhook
   - Go to "Logs" tab
   - Verify: Should see `checkout.session.completed` event with ✅ success

3. **If Webhook Failed:**
   - Check webhook URL is correct
   - Verify Azure Container App is running
   - Check webhook secret matches `.env`
   - See [Troubleshooting](#troubleshooting) section

---

## Production Deployment

### Pre-Launch Checklist

Before going live with real payments:

- [ ] **Tested thoroughly** with test mode
- [ ] **Bank account** connected to Stripe
- [ ] **Business information** completed in Stripe
- [ ] **Webhook configured** and tested
- [ ] **Live API keys** added to production environment
- [ ] **SSL certificate** enabled (Azure handles this automatically)
- [ ] **Legal pages** updated (terms of service, refund policy)
- [ ] **Tax settings** configured in Stripe (if applicable)

### Switching to Live Mode

1. **Get Live Keys:**
   - Toggle off "Test mode" in Stripe Dashboard
   - Go to: https://dashboard.stripe.com/apikeys
   - Copy live keys (`pk_live_...` and `sk_live_...`)

2. **Update Production Environment:**
   - **DO NOT** put live keys in `.env` (that's for local dev only!)
   - Add to GitHub Secrets or Azure Container App secrets
   - Restart production server

3. **Configure Live Webhook:**
   - Go to: https://dashboard.stripe.com/webhooks (live mode)
   - Add endpoint (same URL as test mode)
   - Copy live webhook secret
   - Update in production environment

4. **Enable Payment Flow:**
   ```bash
   VITE_ENABLE_PAYMENT_FLOW=true
   ```

5. **Make Test Purchase:**
   - Use a real card (you can refund it immediately)
   - Verify payment shows in live dashboard
   - Verify database is updated
   - Verify webhook fires successfully

### Monitoring

**Check Daily:**
- Stripe Dashboard → Payments
- Failed payments (investigate why)
- Successful payment rate

**Check Weekly:**
- Webhook success rate
- Database payment records vs Stripe records (should match)
- Customer complaints about payment issues

---

## Troubleshooting

### Problem: "Stripe is not configured" Error

**Symptoms:** Error message when trying to checkout
**Cause:** Missing or invalid Stripe keys

**Solution:**
```bash
# 1. Check .env file has real keys (not pk_test_51example...)
cat .env | grep STRIPE

# 2. Restart dev server
npm run dev

# 3. If production, check Azure environment variables
# Azure Portal → Container App → Configuration → Environment variables
```

### Problem: Payment Succeeds but Database Not Updated

**Symptoms:** Stripe shows payment, but `payment_status` still 'pending'
**Cause:** Webhook not configured or failing

**Solution:**
1. Check webhook logs in Stripe Dashboard
2. Verify webhook URL is correct
3. Check webhook secret matches environment variable
4. Look at server logs for errors:
   ```bash
   # Azure
   az containerapp logs show --name tshla-unified-api --resource-group tshla-rg
   ```

### Problem: "Payment service not configured" (503 Error)

**Symptoms:** API returns 503 error
**Cause:** Server can't initialize Stripe with provided secret key

**Solution:**
```bash
# Check server logs
# Look for: "Stripe not initialized - missing secret key"

# Verify STRIPE_SECRET_KEY environment variable
# Must start with sk_test_ or sk_live_ (not sk_test_example...)
```

### Problem: Webhook Returns 400 "Webhook verification failed"

**Symptoms:** Payments succeed but webhook logs show 400 errors
**Cause:** Webhook secret mismatch

**Solution:**
1. Go to Stripe Dashboard → Webhooks
2. Click on your webhook → "Signing secret"
3. Copy the secret
4. Update `STRIPE_WEBHOOK_SECRET` in production environment
5. Restart server
6. Make test payment to verify

### Problem: Payments Work in Test Mode But Not Live Mode

**Symptoms:** Test payments work, live payments fail

**Common Causes:**
1. **Bank account not verified:** Stripe requires verified bank for live mode
2. **Business information incomplete:** Complete in Stripe Dashboard
3. **Using test keys in live mode:** Make sure you have `pk_live_` and `sk_live_` keys
4. **3D Secure required:** Some cards require additional authentication

**Solution:**
Check Stripe Dashboard → Settings → Business settings → Complete all required information

---

## Security Best Practices

### ✅ DO:

- ✅ **Use environment variables** for all keys
- ✅ **Use test mode** for all development
- ✅ **Validate webhook signatures** (already implemented)
- ✅ **Use HTTPS** for webhook endpoint (Azure handles this)
- ✅ **Monitor failed payments** regularly
- ✅ **Keep Stripe SDK updated:** `npm update @stripe/stripe-js stripe`

### ❌ DON'T:

- ❌ **Never commit API keys** to git
- ❌ **Never use live keys** in local development
- ❌ **Never expose secret key** in frontend code
- ❌ **Never skip webhook signature verification**
- ❌ **Never trust client-side payment data** without server verification

### Key Security Features (Already Implemented):

1. **RLS Policies:** Users can only see their own payment records
2. **Server-Side Verification:** All payments verified server-side
3. **Webhook Validation:** Stripe webhook signatures checked
4. **Audit Logging:** All payment attempts logged (HIPAA Phase 7)
5. **Encrypted Data:** PHI encrypted at rest (HIPAA Phase 5)

---

## Costs & Fees

### Stripe Pricing

| Transaction                | Fee                    |
|----------------------------|------------------------|
| Successful card payment    | 2.9% + $0.30          |
| International cards        | +1.5%                 |
| Currency conversion        | +1%                   |
| Refunds                    | Fee returned          |
| Failed/disputed payments   | No fee                |

### Your Pricing

- **Sale Price:** $9.99 per pump report
- **Stripe Fee:** $0.59 (2.9% + $0.30)
- **Your Net:** $9.40 per sale

**Example Monthly Revenue:**
- 10 sales = $94 net ($99.90 gross)
- 50 sales = $470 net ($499.50 gross)
- 100 sales = $940 net ($999 gross)

### Payouts

- **Frequency:** Automatic (default: every 2 business days)
- **Minimum:** $1 (Stripe default)
- **Bank Transfer:** Free
- **Custom Schedule:** Can be configured in Stripe Dashboard

---

## Support & Resources

### Documentation

- **Stripe Official Docs:** https://stripe.com/docs
- **Checkout Guide:** https://stripe.com/docs/payments/checkout
- **Webhook Guide:** https://stripe.com/docs/webhooks
- **Testing Guide:** https://stripe.com/docs/testing

### Getting Help

1. **Stripe Support:**
   - Dashboard → Help
   - Email: support@stripe.com
   - Chat available in dashboard

2. **TSHLA Support:**
   - Check this guide first
   - Review troubleshooting section
   - Check server logs
   - Contact: rakesh@tshla.ai

### Useful Stripe Dashboard Links

- **Test Payments:** https://dashboard.stripe.com/test/payments
- **Live Payments:** https://dashboard.stripe.com/payments
- **Webhooks:** https://dashboard.stripe.com/webhooks
- **API Keys:** https://dashboard.stripe.com/apikeys
- **Customer List:** https://dashboard.stripe.com/customers
- **Revenue Analytics:** https://dashboard.stripe.com/revenue

---

## Next Steps

After completing setup:

1. ✅ **Test thoroughly** with test mode
2. ✅ **Switch to live mode** when ready
3. ✅ **Monitor first few transactions** closely
4. ✅ **Set up email notifications** in Stripe for failed payments
5. ✅ **Review analytics weekly** to track revenue
6. ✅ **Consider Stripe Radar** for fraud prevention (optional, extra cost)

---

## Changelog

- **2026-01-09:** Initial setup guide created
- **Migration Created:** `012_stripe_payment_tables.sql`
- **Integration Status:** ✅ Complete, ready to activate

---

**Questions?** Email rakesh@tshla.ai or open an issue on GitHub.

**Ready to go live?** Follow the [Production Deployment](#production-deployment) checklist above.
