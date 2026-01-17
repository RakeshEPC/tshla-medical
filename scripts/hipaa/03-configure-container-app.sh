#!/bin/bash
# TSHLA Medical - Container App Key Vault Configuration
# HIPAA Compliance Task #1: Configure Container App to use Key Vault
# Created: January 17, 2026

set -e

echo "=========================================="
echo "TSHLA Medical - Container App Configuration"
echo "=========================================="
echo ""

KEY_VAULT_NAME="tshla-kv-prod"
RESOURCE_GROUP="tshla-backend-rg"
CONTAINER_APP_NAME="tshla-unified-api"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get subscription ID
SUBSCRIPTION_ID=$(az account show --query id -o tsv)

# Get Key Vault resource ID
VAULT_URI="https://$KEY_VAULT_NAME.vault.azure.net"

echo "Configuration:"
echo "  Container App: $CONTAINER_APP_NAME"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  Key Vault: $KEY_VAULT_NAME"
echo "  Vault URI: $VAULT_URI"
echo ""

# Check Container App exists
if ! az containerapp show --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP &> /dev/null; then
    echo -e "${RED}Error: Container App not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Container App found${NC}"

# Get Managed Identity
PRINCIPAL_ID=$(az containerapp identity show \
    --name $CONTAINER_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --query principalId -o tsv 2>/dev/null || echo "")

if [ -z "$PRINCIPAL_ID" ]; then
    echo -e "${RED}Error: Managed Identity not found${NC}"
    echo "Please run ./scripts/hipaa/01-setup-key-vault.sh first"
    exit 1
fi

echo -e "${GREEN}✓ Managed Identity found: $PRINCIPAL_ID${NC}"
echo ""

echo -e "${YELLOW}This will update the Container App to reference Key Vault secrets${NC}"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Configuration cancelled."
    exit 0
fi

echo ""
echo "Step 1: Configuring secrets to reference Key Vault..."

# Set Container App secrets that reference Key Vault
az containerapp secret set \
    --name $CONTAINER_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --secrets \
        "supabase-service-key=keyvaultref:$VAULT_URI/secrets/SUPABASE-SERVICE-ROLE-KEY,identityref:system" \
        "azure-openai-key=keyvaultref:$VAULT_URI/secrets/AZURE-OPENAI-KEY,identityref:system" \
        "jwt-secret=keyvaultref:$VAULT_URI/secrets/JWT-SECRET,identityref:system" \
        "deepgram-api-key=keyvaultref:$VAULT_URI/secrets/DEEPGRAM-API-KEY,identityref:system" \
        "elevenlabs-api-key=keyvaultref:$VAULT_URI/secrets/ELEVENLABS-API-KEY,identityref:system" \
        "stripe-secret-key=keyvaultref:$VAULT_URI/secrets/STRIPE-SECRET-KEY,identityref:system" \
        "supabase-anon-key=keyvaultref:$VAULT_URI/secrets/SUPABASE-ANON-KEY,identityref:system"

echo -e "${GREEN}✓ Secrets configured${NC}"

echo ""
echo "Step 2: Updating environment variables to reference secrets..."

az containerapp update \
    --name $CONTAINER_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --set-env-vars \
        "SUPABASE_SERVICE_ROLE_KEY=secretref:supabase-service-key" \
        "AZURE_OPENAI_KEY=secretref:azure-openai-key" \
        "JWT_SECRET=secretref:jwt-secret" \
        "VITE_DEEPGRAM_API_KEY=secretref:deepgram-api-key" \
        "ELEVENLABS_API_KEY=secretref:elevenlabs-api-key" \
        "STRIPE_SECRET_KEY=secretref:stripe-secret-key" \
        "VITE_SUPABASE_ANON_KEY=secretref:supabase-anon-key"

echo -e "${GREEN}✓ Environment variables updated${NC}"

echo ""
echo "Step 3: Getting Supabase URL from Key Vault..."
SUPABASE_URL=$(az keyvault secret show --vault-name $KEY_VAULT_NAME --name SUPABASE-URL --query value -o tsv 2>/dev/null || echo "")

if [ -n "$SUPABASE_URL" ]; then
    echo "  Setting VITE_SUPABASE_URL=$SUPABASE_URL"
    az containerapp update \
        --name $CONTAINER_APP_NAME \
        --resource-group $RESOURCE_GROUP \
        --set-env-vars "VITE_SUPABASE_URL=$SUPABASE_URL"
    echo -e "${GREEN}✓ Supabase URL configured${NC}"
else
    echo -e "${YELLOW}⚠ SUPABASE-URL not found in Key Vault, skipping${NC}"
fi

echo ""
echo "=========================================="
echo "Configuration Complete!"
echo "=========================================="
echo ""
echo "The Container App now uses Azure Key Vault for secrets."
echo ""
echo "Next steps:"
echo "  1. Monitor Container App logs for errors"
echo "  2. Test API endpoints"
echo "  3. Verify application functionality"
echo "  4. Secure/remove .env file from working directory"
echo ""
echo "Check Container App status:"
echo "  az containerapp show -n $CONTAINER_APP_NAME -g $RESOURCE_GROUP --query properties.runningStatus"
echo ""
echo "View logs:"
echo "  az containerapp logs show -n $CONTAINER_APP_NAME -g $RESOURCE_GROUP --tail 50"
echo ""
echo "Test health endpoint:"
echo "  curl https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/health"
echo ""
