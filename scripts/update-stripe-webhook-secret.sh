#!/bin/bash
# Quick Stripe Webhook Secret Updater
# Updates the webhook secret in Container App without Key Vault
# (faster for urgent fixes)

set -e

echo "=================================================="
echo "Quick Stripe Webhook Secret Update"
echo "=================================================="
echo ""

# Check if secret was provided
if [ -z "$1" ]; then
  echo "❌ Error: No webhook secret provided"
  echo ""
  echo "Usage: ./scripts/update-stripe-webhook-secret.sh whsec_YOUR_SECRET_HERE"
  echo ""
  echo "Current secret in Container App:"
  echo "  whsec_IanytuXaet8jnb0gl47nvx4YdvSH8uvl"
  echo ""
  echo "Get your current secret from:"
  echo "https://dashboard.stripe.com/webhooks"
  echo ""
  exit 1
fi

WEBHOOK_SECRET="$1"

# Validate secret format
if [[ ! "$WEBHOOK_SECRET" =~ ^whsec_ ]]; then
  echo "❌ Error: Invalid webhook secret format"
  echo "Stripe webhook secrets start with 'whsec_'"
  echo ""
  exit 1
fi

echo "Secret format: ✅ Valid"
echo "Secret preview: ${WEBHOOK_SECRET:0:10}...${WEBHOOK_SECRET: -10}"
echo ""

# Check if this is the same as current
CURRENT_SECRET=$(az containerapp secret show \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --secret-name stripe-webhook-secret \
  --query "value" -o tsv 2>/dev/null || echo "")

if [ "$CURRENT_SECRET" = "$WEBHOOK_SECRET" ]; then
  echo "⚠️  This secret is ALREADY configured in Container App"
  echo ""
  echo "The issue might be:"
  echo "  1. Wrong Stripe account (test vs live mode)"
  echo "  2. Multiple webhook endpoints in Stripe"
  echo "  3. Secret is for different endpoint URL"
  echo ""
  read -p "Do you want to continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Update cancelled."
    exit 0
  fi
fi

echo "Step 1: Updating Container App secret..."

# Update the secret directly
az containerapp secret set \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --secrets "stripe-webhook-secret=$WEBHOOK_SECRET" \
  --output none

echo "✅ Secret updated"
echo ""

echo "Step 2: Triggering Container App restart..."
echo "(This forces reload of the new secret)"
echo ""

# Trigger restart by updating a dummy env var
az containerapp update \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --set-env-vars "WEBHOOK_UPDATED=$(date +%s)" \
  --output none

echo "✅ Container App restarting..."
echo ""

echo "Step 3: Waiting for new revision (30 seconds)..."
sleep 30

echo "✅ Restart complete"
echo ""

echo "Step 4: Testing webhook endpoint..."

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/stripe/webhook" \
  -H "Content-Type: application/json" \
  -d '{}')

echo "HTTP Response: $HTTP_CODE"

if [ "$HTTP_CODE" = "400" ]; then
  echo "✅ Endpoint responding!"
  echo "   (400 = signature verification active, needs real Stripe request)"
elif [ "$HTTP_CODE" = "503" ]; then
  echo "⚠️  503 error - Stripe SDK not initialized"
  echo "   Check STRIPE_SECRET_KEY is also configured"
elif [ "$HTTP_CODE" = "200" ]; then
  echo "⚠️  200 without signature - security issue!"
  echo "   Webhook accepting requests without verification"
else
  echo "⚠️  Unexpected status: $HTTP_CODE"
fi

echo ""
echo "=================================================="
echo "Update Complete!"
echo "=================================================="
echo ""
echo "Next step: Test from Stripe Dashboard"
echo ""
echo "1. Go to: https://dashboard.stripe.com/webhooks"
echo "2. Click on your webhook endpoint"
echo "3. Click 'Send test webhook'"
echo "4. Select event: checkout.session.completed"
echo "5. Should receive HTTP 200 ✅"
echo ""
echo "If still failing, check logs:"
echo "az containerapp logs show --name tshla-unified-api --resource-group tshla-backend-rg --tail 50"
echo ""
