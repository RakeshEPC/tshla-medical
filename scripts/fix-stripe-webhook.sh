#!/bin/bash
# Fix Stripe Webhook Secret Configuration
# Run this after getting your webhook secret from Stripe Dashboard

set -e

echo "=================================================="
echo "TSHLA Medical - Fix Stripe Webhook Configuration"
echo "=================================================="
echo ""

# Check if secret was provided
if [ -z "$1" ]; then
  echo "❌ Error: No webhook secret provided"
  echo ""
  echo "Usage: ./scripts/fix-stripe-webhook.sh whsec_YOUR_SECRET_HERE"
  echo ""
  echo "Get your webhook secret from:"
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

echo "✅ Webhook secret format is valid"
echo ""

# Step 1: Upload to Key Vault
echo "Step 1: Uploading secret to Azure Key Vault..."
az keyvault secret set \
  --vault-name tshla-kv-prod \
  --name STRIPE-WEBHOOK-SECRET \
  --value "$WEBHOOK_SECRET" \
  --description "Stripe Webhook Signing Secret" \
  --output none

echo "✅ Secret uploaded to Key Vault"
echo ""

# Step 2: Configure Container App secret reference
echo "Step 2: Configuring Container App secret reference..."
az containerapp secret set \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --secrets "stripe-webhook-secret=keyvaultref:https://tshla-kv-prod.vault.azure.net/secrets/STRIPE-WEBHOOK-SECRET,identityref:system" \
  --output none

echo "✅ Container App secret reference configured"
echo ""

# Step 3: Update environment variable
echo "Step 3: Updating environment variable..."
az containerapp update \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --set-env-vars "STRIPE_WEBHOOK_SECRET=secretref:stripe-webhook-secret" \
  --output none

echo "✅ Environment variable updated"
echo ""

# Step 4: Restart Container App
echo "Step 4: Restarting Container App to apply changes..."
echo "This will take ~30 seconds..."

# Get current revision name
CURRENT_REVISION=$(az containerapp revision list \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --query "[0].name" -o tsv)

echo "Current revision: $CURRENT_REVISION"

# Trigger restart by updating with empty env var
az containerapp update \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --set-env-vars "CONFIG_UPDATED=$(date +%s)" \
  --output none

echo "✅ Container App restarted"
echo ""

# Step 5: Wait for new revision
echo "Step 5: Waiting for new revision to be ready..."
sleep 30

# Test webhook endpoint
echo ""
echo "Step 6: Testing webhook endpoint..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/stripe/webhook" \
  -H "Content-Type: application/json" \
  -d '{}')

echo "HTTP Response: $HTTP_CODE"

if [ "$HTTP_CODE" = "400" ]; then
  echo "✅ Endpoint is responding correctly!"
  echo "   (400 = signature verification working, just needs real Stripe webhook)"
elif [ "$HTTP_CODE" = "503" ]; then
  echo "⚠️  Endpoint still returning 503 (Stripe not configured)"
  echo "   Check if STRIPE_SECRET_KEY is also set"
else
  echo "⚠️  Unexpected status code: $HTTP_CODE"
fi

echo ""
echo "=================================================="
echo "Configuration Complete!"
echo "=================================================="
echo ""
echo "Next steps:"
echo "1. Go to Stripe Dashboard: https://dashboard.stripe.com/webhooks"
echo "2. Find your webhook and click 'Send test webhook'"
echo "3. Verify it succeeds (HTTP 200)"
echo ""
echo "If still failing, check Container App logs:"
echo "az containerapp logs show --name tshla-unified-api --resource-group tshla-backend-rg --tail 50"
echo ""
