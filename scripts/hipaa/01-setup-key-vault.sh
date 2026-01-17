#!/bin/bash
# TSHLA Medical - Azure Key Vault Setup Script
# HIPAA Compliance Task #1: Migrate Secrets to Azure Key Vault
# Created: January 17, 2026
#
# This script creates and configures Azure Key Vault for secure secret management
# HIPAA Requirement: §164.312(a)(2)(iv) - Encryption and Key Management

set -e  # Exit on error

echo "=================================="
echo "TSHLA Medical - Key Vault Setup"
echo "=================================="
echo ""

# Configuration
RESOURCE_GROUP="tshla-backend-rg"
KEY_VAULT_NAME="tshla-kv-prod"
LOCATION="eastus"
CONTAINER_APP_NAME="tshla-unified-api"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo -e "${RED}Error: Azure CLI is not installed${NC}"
    echo "Please install from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

echo -e "${GREEN}✓ Azure CLI found${NC}"

# Check if logged in
echo "Checking Azure login status..."
if ! az account show &> /dev/null; then
    echo -e "${YELLOW}Not logged in to Azure. Please log in:${NC}"
    az login
fi

CURRENT_ACCOUNT=$(az account show --query name -o tsv)
echo -e "${GREEN}✓ Logged in to Azure${NC}"
echo "  Current account: $CURRENT_ACCOUNT"
echo ""

# Confirm before proceeding
read -p "Continue with Key Vault setup? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Setup cancelled."
    exit 0
fi

echo ""
echo "Step 1: Creating Resource Group (if needed)..."
if az group show --name $RESOURCE_GROUP &> /dev/null; then
    echo -e "${GREEN}✓ Resource group already exists: $RESOURCE_GROUP${NC}"
else
    echo "Creating resource group..."
    az group create \
        --name $RESOURCE_GROUP \
        --location $LOCATION
    echo -e "${GREEN}✓ Resource group created${NC}"
fi

echo ""
echo "Step 2: Creating Azure Key Vault..."
if az keyvault show --name $KEY_VAULT_NAME &> /dev/null; then
    echo -e "${YELLOW}! Key Vault already exists: $KEY_VAULT_NAME${NC}"
    read -p "  Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 0
    fi
else
    az keyvault create \
        --name $KEY_VAULT_NAME \
        --resource-group $RESOURCE_GROUP \
        --location $LOCATION \
        --enable-rbac-authorization false \
        --enabled-for-deployment true \
        --enabled-for-template-deployment true \
        --enable-purge-protection true \
        --retention-days 90

    echo -e "${GREEN}✓ Key Vault created: $KEY_VAULT_NAME${NC}"
fi

echo ""
echo "Step 3: Configuring access policies..."

# Get current user's object ID
USER_ID=$(az ad signed-in-user show --query id -o tsv)
echo "  Your user ID: $USER_ID"

# Grant current user full access
az keyvault set-policy \
    --name $KEY_VAULT_NAME \
    --object-id $USER_ID \
    --secret-permissions get list set delete purge recover backup restore

echo -e "${GREEN}✓ Access policy configured for current user${NC}"

echo ""
echo "Step 4: Enabling Managed Identity on Container App..."

# Check if Container App exists
if az containerapp show --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP &> /dev/null; then
    # Enable system-assigned managed identity
    IDENTITY_OUTPUT=$(az containerapp identity assign \
        --name $CONTAINER_APP_NAME \
        --resource-group $RESOURCE_GROUP \
        --system-assigned 2>&1)

    if echo "$IDENTITY_OUTPUT" | grep -q "already has"; then
        echo -e "${YELLOW}! Managed identity already enabled${NC}"
    else
        echo -e "${GREEN}✓ Managed identity enabled${NC}"
    fi

    # Get the principal ID
    PRINCIPAL_ID=$(az containerapp identity show \
        --name $CONTAINER_APP_NAME \
        --resource-group $RESOURCE_GROUP \
        --query principalId -o tsv)

    echo "  Principal ID: $PRINCIPAL_ID"

    # Grant Container App access to Key Vault
    echo "  Granting Key Vault access to Container App..."
    az keyvault set-policy \
        --name $KEY_VAULT_NAME \
        --object-id $PRINCIPAL_ID \
        --secret-permissions get list

    echo -e "${GREEN}✓ Key Vault access granted to Container App${NC}"
else
    echo -e "${YELLOW}! Container App not found: $CONTAINER_APP_NAME${NC}"
    echo "  You'll need to configure access manually after creating the Container App"
fi

echo ""
echo "=================================="
echo "Key Vault Setup Complete!"
echo "=================================="
echo ""
echo "Summary:"
echo "  Key Vault: $KEY_VAULT_NAME"
echo "  Location: $LOCATION"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  Purge Protection: Enabled (90 days)"
echo ""
echo "Next steps:"
echo "  1. Run: ./scripts/hipaa/02-migrate-secrets.sh"
echo "  2. Review secrets in Azure Portal"
echo "  3. Update Container App environment variables"
echo ""
echo "Key Vault URL:"
echo "  https://$KEY_VAULT_NAME.vault.azure.net"
echo ""
echo "View in Azure Portal:"
echo "  https://portal.azure.com/#resource/subscriptions/$(az account show --query id -o tsv)/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.KeyVault/vaults/$KEY_VAULT_NAME"
echo ""
