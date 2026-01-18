# Stripe Webhook Fix Guide

## Problem

Stripe is unable to deliver webhook events to your endpoint because the webhook signing secret is set to a placeholder value.

**Failing endpoint:**
```
https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/stripe/webhook
```

**Error:** 32 failed webhook delivery attempts since January 11, 2026

**Root cause:** `STRIPE_WEBHOOK_SECRET` is set to `"whsec_example..."` instead of the real secret from Stripe Dashboard.

---

## Impact

- **Subscriptions:** Invoice notifications delayed up to 3 days
- **Checkout:** Payment completion events not received
- **Stripe will disable webhook:** By January 20, 2026 at 8:02:20 PM UTC

---

## Solution

### Step 1: Get Your Webhook Secret

1. Go to **[Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)**

2. Find your webhook endpoint:
   ```
   https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/stripe/webhook
   ```

3. Click **"Reveal"** next to **"Signing secret"**

4. Copy the secret (starts with `whsec_`)

---

### Step 2: Run the Fix Script

```bash
cd /Users/rakeshpatel/Desktop/tshla-medical

# Run with your actual webhook secret
./scripts/fix-stripe-webhook.sh whsec_YOUR_ACTUAL_SECRET_HERE
```

The script will:
1. ✅ Upload secret to Azure Key Vault
2. ✅ Configure Container App to use Key Vault reference
3. ✅ Update environment variable
4. ✅ Restart Container App
5. ✅ Test webhook endpoint

**Estimated time:** 2 minutes

---

### Step 3: Verify Fix

1. **In Stripe Dashboard:**
   - Go to your webhook endpoint
   - Click **"Send test webhook"**
   - Select event type: `checkout.session.completed`
   - Should receive **HTTP 200 OK**

2. **Check Container App Logs:**
   ```bash
   az containerapp logs show \
     --name tshla-unified-api \
     --resource-group tshla-backend-rg \
     --tail 50
   ```

   Look for:
   ```
   ✅ Pump report payment completed
   OR
   ✅ Office visit payment completed
   ```

---

## Manual Fix (Alternative)

If you prefer to run commands manually:

```bash
# 1. Set your webhook secret
WEBHOOK_SECRET="whsec_YOUR_ACTUAL_SECRET_HERE"

# 2. Upload to Key Vault
az keyvault secret set \
  --vault-name tshla-kv-prod \
  --name STRIPE-WEBHOOK-SECRET \
  --value "$WEBHOOK_SECRET" \
  --description "Stripe Webhook Signing Secret"

# 3. Configure Container App secret
az containerapp secret set \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --secrets "stripe-webhook-secret=keyvaultref:https://tshla-kv-prod.vault.azure.net/secrets/STRIPE-WEBHOOK-SECRET,identityref:system"

# 4. Update environment variable
az containerapp update \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --set-env-vars "STRIPE_WEBHOOK_SECRET=secretref:stripe-webhook-secret"

# 5. Wait 30 seconds for restart, then test
sleep 30
curl -X POST "https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/stripe/webhook" \
  -H "Content-Type: application/json" \
  -d '{}'
# Should return HTTP 400 (signature verification working)
```

---

## Current Webhook Configuration

**Endpoint URL:**
```
https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/stripe/webhook
```

**Events listened to:**
- `checkout.session.completed` - Payment completion
- (You can add more events in Stripe Dashboard)

**Current status:** ❌ FAILING (placeholder secret)

**Expected status after fix:** ✅ WORKING

---

## What This Webhook Does

When a customer completes payment via Stripe Checkout:

1. **Pump Reports:**
   - Updates `payment_records` table → status: `succeeded`
   - Updates `pump_assessments` table → payment_status: `paid`

2. **Office Visit Copays:**
   - Updates `patient_payment_requests` table → status: `paid`
   - Updates `previsit_data` table → patient_paid: `true`

---

## Troubleshooting

### Issue: Still getting 400 errors after fix

**Cause:** Stripe is sending real webhook signature, but secret doesn't match

**Fix:**
1. Verify you copied the correct secret from Stripe Dashboard
2. Re-run the fix script with the correct secret

### Issue: Getting 503 errors

**Cause:** Stripe SDK not configured (missing `STRIPE_SECRET_KEY`)

**Fix:**
```bash
# Check if STRIPE_SECRET_KEY is set
az containerapp show \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --query "properties.template.containers[0].env[?name=='STRIPE_SECRET_KEY']"
```

If missing, add it to Key Vault and Container App.

### Issue: Webhook delivers but payment not recorded

**Cause:** Database permission issue or wrong event type

**Fix:** Check Container App logs for database errors

---

## Deadline

⚠️ **Stripe will disable this webhook by:** January 20, 2026 at 8:02:20 PM UTC

**Days remaining:** ~3 days

---

## Support

- **Stripe Webhook Docs:** https://stripe.com/docs/webhooks
- **Container App Logs:** `az containerapp logs show --name tshla-unified-api --resource-group tshla-backend-rg`
- **Stripe Dashboard:** https://dashboard.stripe.com/webhooks

---

**Created:** January 17, 2026
**Status:** Ready to fix
**Priority:** HIGH
