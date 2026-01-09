# Stripe Setup - Quick Reference Checklist

**⏱ Time Required:** 5-10 minutes
**💰 Cost:** Free to set up, 2.9% + $0.30 per successful transaction
**📄 Full Guide:** [STRIPE_SETUP_GUIDE.md](./STRIPE_SETUP_GUIDE.md)

---

## ✅ Pre-Flight Checklist

Before you start, make sure you have:
- [ ] Stripe account (or sign up at https://stripe.com)
- [ ] Bank account connected to Stripe
- [ ] Access to modify `.env` file
- [ ] Access to Supabase SQL Editor
- [ ] Access to Azure environment variables (for production)

---

## 🚀 Quick Setup Steps

### Step 1: Get Stripe Keys (2 min)

**Test Mode** (for development):
1. Go to: https://dashboard.stripe.com/test/apikeys
2. Copy both keys:
   - ✅ **Publishable key:** `pk_test_...`
   - ✅ **Secret key:** `sk_test_...` (click "Reveal test key")

**Live Mode** (for production):
1. Toggle "Test mode" OFF in Stripe Dashboard
2. Go to: https://dashboard.stripe.com/apikeys
3. Copy both keys:
   - ✅ **Publishable key:** `pk_live_...`
   - ✅ **Secret key:** `sk_live_...`

---

### Step 2: Configure Webhook (2 min)

**Production Only** (skip for local dev):

1. Go to: https://dashboard.stripe.com/test/webhooks (or /webhooks for live)
2. Click "+ Add endpoint"
3. **Endpoint URL:**
   ```
   https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/stripe/webhook
   ```
4. **Events to listen to:**
   - ✅ `checkout.session.completed`
5. Copy **Signing secret:** `whsec_...`

---

### Step 3: Update Environment Variables (1 min)

**Local Development** (`.env` file):
```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET_HERE  # Skip for local dev
VITE_ENABLE_PAYMENT_FLOW=true
```

**Production** (GitHub Secrets or Azure):
```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_KEY_HERE
STRIPE_SECRET_KEY=sk_live_YOUR_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET_HERE
VITE_ENABLE_PAYMENT_FLOW=true
```

---

### Step 4: Run Database Migration (1 min)

1. Go to: https://supabase.com/dashboard
2. Select project: **tshla-medical**
3. Go to: **SQL Editor**
4. Copy contents of: `database/migrations/012_stripe_payment_tables.sql`
5. Paste and click **"Run"**
6. Verify: ✅ "Success. No rows returned"

---

### Step 5: Restart Application (1 min)

**Local:**
```bash
npm run dev
```

**Production:**
```bash
git add .
git commit -m "feat: Configure Stripe payments"
git push origin main
```

---

## 🧪 Test Your Setup (2 min)

1. **Navigate to billing page:**
   ```
   http://localhost:5173/pumpdrive/billing
   ```

2. **Create test account:**
   - Email: `test@example.com`
   - Username: `testuser`
   - Password: Any (min 8 chars)

3. **Complete checkout with test card:**
   - Card: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., `12/30`)
   - CVC: Any 3 digits (e.g., `123`)

4. **Verify success:**
   - Should redirect with `?paid=true`
   - Check Stripe Dashboard: https://dashboard.stripe.com/test/payments
   - Check database:
     ```sql
     SELECT * FROM payment_records ORDER BY created_at DESC LIMIT 1;
     ```

---

## 📊 Key Stripe Test Cards

| Card Number          | Result                      |
|---------------------|-----------------------------|
| 4242 4242 4242 4242 | ✅ Successful payment        |
| 4000 0000 0000 0002 | ❌ Card declined             |
| 4000 0000 0000 9995 | ❌ Insufficient funds        |
| 4000 0025 0000 3155 | ⚠️ Requires authentication   |

**More test cards:** https://stripe.com/docs/testing#cards

---

## 💰 Pricing Calculator

**Your Price:** $9.99 per pump report
**Stripe Fee:** $0.59 (2.9% + $0.30)
**Your Net:** $9.40 per sale

| Monthly Sales | Gross Revenue | Stripe Fees | Your Net   |
|---------------|---------------|-------------|------------|
| 10            | $99.90        | $5.90       | $94.00     |
| 50            | $499.50       | $29.50      | $470.00    |
| 100           | $999.00       | $59.00      | $940.00    |
| 500           | $4,995.00     | $295.00     | $4,700.00  |

---

## 🚨 Common Issues & Fixes

### "Stripe is not configured" error
**Fix:** Check `.env` has real keys (not `pk_test_51example...`)
```bash
cat .env | grep STRIPE
npm run dev  # Restart server
```

### Payment succeeds but database not updated
**Fix:** Configure webhook (see Step 2)

### "Payment service not configured" (503 error)
**Fix:** Verify `STRIPE_SECRET_KEY` starts with `sk_test_` or `sk_live_`

### Webhook returns 400 error
**Fix:** Update `STRIPE_WEBHOOK_SECRET` to match Stripe Dashboard

---

## 🔐 Security Reminders

- ✅ Never commit API keys to git
- ✅ Use test keys for development
- ✅ Use live keys only in production
- ✅ Keep secret keys SECRET (never expose in frontend)
- ✅ Verify webhook signatures (already implemented)

---

## 📞 Support

**Full Documentation:** [STRIPE_SETUP_GUIDE.md](./STRIPE_SETUP_GUIDE.md)
**Stripe Docs:** https://stripe.com/docs
**Stripe Support:** support@stripe.com
**TSHLA Support:** rakesh@tshla.ai

---

## 🎯 Production Deployment Checklist

Before going live:

- [ ] Tested thoroughly in test mode
- [ ] Bank account connected and verified
- [ ] Business information completed in Stripe
- [ ] Live API keys configured in production
- [ ] Webhook configured and tested
- [ ] Made test purchase with real card
- [ ] Refund policy published
- [ ] Terms of service updated

**Ready to go live?** Switch test keys to live keys and set `VITE_ENABLE_PAYMENT_FLOW=true` in production!

---

**Last Updated:** 2026-01-09
