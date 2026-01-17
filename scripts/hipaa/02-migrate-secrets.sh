#!/bin/bash
# TSHLA Medical - Secret Migration Script
# HIPAA Compliance Task #1: Migrate Secrets to Azure Key Vault
# Created: January 17, 2026
#
# This script migrates critical secrets from .env file to Azure Key Vault
# HIPAA Requirement: §164.312(a)(2)(iv) - Secure Key Management

set -e

echo "=================================="
echo "TSHLA Medical - Secret Migration"
echo "=================================="
echo ""

KEY_VAULT_NAME="tshla-kv-prod"
ENV_FILE=".env"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}Error: .env file not found${NC}"
    echo "Please ensure .env file exists in the project root"
    exit 1
fi

echo -e "${GREEN}✓ Found .env file${NC}"

# Check if Key Vault exists
if ! az keyvault show --name $KEY_VAULT_NAME &> /dev/null; then
    echo -e "${RED}Error: Key Vault not found: $KEY_VAULT_NAME${NC}"
    echo "Please run ./scripts/hipaa/01-setup-key-vault.sh first"
    exit 1
fi

echo -e "${GREEN}✓ Key Vault found: $KEY_VAULT_NAME${NC}"
echo ""

echo -e "${YELLOW}WARNING: This script will migrate secrets to Azure Key Vault${NC}"
echo "The following secrets will be migrated:"
echo "  1. SUPABASE_SERVICE_ROLE_KEY (Critical - Full DB access)"
echo "  2. AZURE_OPENAI_KEY (High - AI processing)"
echo "  3. JWT_SECRET (High - Authentication)"
echo "  4. VITE_DEEPGRAM_API_KEY (High - Medical transcription)"
echo "  5. ELEVENLABS_API_KEY (Medium - AI voice)"
echo "  6. STRIPE_SECRET_KEY (Medium - Payments)"
echo "  7. VITE_SUPABASE_ANON_KEY (Low - Public key)"
echo "  8. VITE_SUPABASE_URL (Low - Public URL)"
echo ""

read -p "Continue with migration? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Migration cancelled."
    exit 0
fi

echo ""
echo "Starting migration..."
echo ""

# Function to extract value from .env file
get_env_value() {
    local key=$1
    grep "^${key}=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'"
}

# Function to migrate a secret
migrate_secret() {
    local env_key=$1
    local vault_key=$2
    local description=$3

    echo "Migrating: $description"
    echo "  Source: $env_key"
    echo "  Destination: $vault_key"

    local value=$(get_env_value "$env_key")

    if [ -z "$value" ]; then
        echo -e "  ${YELLOW}⚠ Warning: $env_key not found in .env, skipping${NC}"
        return
    fi

    # Mask value for display (show first/last 4 chars)
    local masked="${value:0:4}...${value: -4}"
    echo "  Value: $masked"

    # Upload to Key Vault
    az keyvault secret set \
        --vault-name $KEY_VAULT_NAME \
        --name "$vault_key" \
        --value "$value" \
        --description "$description" \
        --output none 2>&1 | grep -v "WARNING" || true

    echo -e "  ${GREEN}✓ Migrated successfully${NC}"
    echo ""
}

# Migrate critical secrets
echo "=== Critical Secrets (Priority 1) ==="
echo ""

migrate_secret "SUPABASE_SERVICE_ROLE_KEY" "SUPABASE-SERVICE-ROLE-KEY" "Supabase Service Role - Full DB Access"
migrate_secret "AZURE_OPENAI_KEY" "AZURE-OPENAI-KEY" "Azure OpenAI API Key"
migrate_secret "JWT_SECRET" "JWT-SECRET" "JWT Secret for Authentication"
migrate_secret "VITE_DEEPGRAM_API_KEY" "DEEPGRAM-API-KEY" "Deepgram Medical Transcription API"

echo "=== High Priority Secrets (Priority 2) ==="
echo ""

migrate_secret "ELEVENLABS_API_KEY" "ELEVENLABS-API-KEY" "ElevenLabs AI Voice API"
migrate_secret "STRIPE_SECRET_KEY" "STRIPE-SECRET-KEY" "Stripe Payment Processing"

echo "=== Configuration Secrets (Priority 3) ==="
echo ""

migrate_secret "VITE_SUPABASE_ANON_KEY" "SUPABASE-ANON-KEY" "Supabase Anonymous Key (Public)"
migrate_secret "VITE_SUPABASE_URL" "SUPABASE-URL" "Supabase Project URL"

echo ""
echo "=================================="
echo "Migration Complete!"
echo "=================================="
echo ""
echo "Secrets migrated to: $KEY_VAULT_NAME"
echo ""
echo "Next steps:"
echo "  1. Verify secrets in Azure Portal"
echo "  2. Run: ./scripts/hipaa/03-configure-container-app.sh"
echo "  3. Test application with Key Vault secrets"
echo "  4. Backup and secure .env file"
echo ""
echo "View secrets in portal:"
echo "  https://portal.azure.com/#resource/subscriptions/$(az account show --query id -o tsv)/resourceGroups/tshla-backend-rg/providers/Microsoft.KeyVault/vaults/$KEY_VAULT_NAME/secrets"
echo ""

# List migrated secrets
echo "Migrated secrets:"
az keyvault secret list --vault-name $KEY_VAULT_NAME --query "[].{Name:name,Created:attributes.created}" -o table

echo ""
