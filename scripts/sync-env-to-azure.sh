#!/bin/bash

###############################################################################
# Sync Environment Variables to Azure Container App
#
# This script ensures all required environment variables from .env are
# properly configured in the Azure Container App to prevent deployment issues.
#
# Usage:
#   ./scripts/sync-env-to-azure.sh
#
# Requirements:
#   - Azure CLI installed and logged in (az login)
#   - .env file in project root with all required variables
###############################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Azure Configuration
RESOURCE_GROUP="tshla-backend-rg"
CONTAINER_APP_NAME="tshla-unified-api"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Azure Container App Environment Sync${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ Error: .env file not found in project root${NC}"
    exit 1
fi

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo -e "${RED}❌ Error: Azure CLI not installed${NC}"
    echo "Install: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Check if logged in to Azure
if ! az account show &> /dev/null; then
    echo -e "${RED}❌ Error: Not logged in to Azure${NC}"
    echo "Run: az login"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"
echo ""

# Load .env file
echo -e "${YELLOW}📄 Loading environment variables from .env...${NC}"
source .env

# Define secrets (sensitive values stored as Azure secrets)
declare -A SECRETS=(
    ["openai-api-key"]="$VITE_OPENAI_API_KEY"
    ["vite-elevenlabs-api-key"]="$VITE_ELEVENLABS_API_KEY"
    ["elevenlabs-api-key"]="$ELEVENLABS_API_KEY"
    ["deepgram-api-key"]="$DEEPGRAM_API_KEY"
    ["vite-deepgram-api-key"]="$VITE_DEEPGRAM_API_KEY"
    ["supabase-service-role-key"]="$SUPABASE_SERVICE_ROLE_KEY"
    ["jwt-secret"]="$JWT_SECRET"
)

# Define environment variables (non-sensitive, can be plain text)
declare -A ENV_VARS=(
    ["VITE_SUPABASE_URL"]="$VITE_SUPABASE_URL"
    ["VITE_SUPABASE_ANON_KEY"]="$VITE_SUPABASE_ANON_KEY"
    ["VITE_DEEPGRAM_MODEL"]="$VITE_DEEPGRAM_MODEL"
    ["VITE_DEEPGRAM_LANGUAGE"]="$VITE_DEEPGRAM_LANGUAGE"
    ["VITE_OPENAI_MODEL_STAGE4"]="$VITE_OPENAI_MODEL_STAGE4"
    ["VITE_OPENAI_MODEL_STAGE5"]="$VITE_OPENAI_MODEL_STAGE5"
    ["VITE_OPENAI_MODEL_STAGE6"]="$VITE_OPENAI_MODEL_STAGE6"
    ["VITE_ELEVENLABS_DEFAULT_VOICE_ID"]="$VITE_ELEVENLABS_DEFAULT_VOICE_ID"
    ["NODE_ENV"]="production"
    ["PORT"]="3000"
    ["CLINIC_PHONE_NUMBER"]="$CLINIC_PHONE_NUMBER"
)

# Step 1: Set secrets in Azure Container App
echo -e "${YELLOW}🔐 Setting secrets in Azure Container App...${NC}"

SECRET_ARGS=""
for secret_name in "${!SECRETS[@]}"; do
    secret_value="${SECRETS[$secret_name]}"

    if [ -z "$secret_value" ]; then
        echo -e "${YELLOW}⚠️  Warning: $secret_name is empty, skipping${NC}"
        continue
    fi

    # Build secret arguments
    if [ -n "$SECRET_ARGS" ]; then
        SECRET_ARGS="$SECRET_ARGS "
    fi
    SECRET_ARGS="${SECRET_ARGS}${secret_name}=${secret_value}"

    echo -e "  - ${secret_name}"
done

if [ -n "$SECRET_ARGS" ]; then
    az containerapp secret set \
        --name "$CONTAINER_APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --secrets $SECRET_ARGS \
        > /dev/null 2>&1
    echo -e "${GREEN}✅ Secrets updated successfully${NC}"
else
    echo -e "${YELLOW}⚠️  No secrets to update${NC}"
fi

echo ""

# Step 2: Build environment variable arguments
echo -e "${YELLOW}🌍 Preparing environment variables...${NC}"

ENV_ARGS=""

# Add plain environment variables
for env_name in "${!ENV_VARS[@]}"; do
    env_value="${ENV_VARS[$env_name]}"

    if [ -z "$env_value" ]; then
        echo -e "${YELLOW}⚠️  Warning: $env_name is empty, skipping${NC}"
        continue
    fi

    # Escape special characters
    env_value="${env_value//\"/\\\"}"

    # Build env arguments
    if [ -n "$ENV_ARGS" ]; then
        ENV_ARGS="$ENV_ARGS "
    fi
    ENV_ARGS="${ENV_ARGS}${env_name}=${env_value}"

    echo -e "  - ${env_name}"
done

# Add secret references
echo -e "  ${BLUE}(referencing secrets)${NC}"
if [ -n "$ENV_ARGS" ]; then
    ENV_ARGS="$ENV_ARGS "
fi
ENV_ARGS="${ENV_ARGS}VITE_OPENAI_API_KEY=secretref:openai-api-key"
ENV_ARGS="$ENV_ARGS VITE_ELEVENLABS_API_KEY=secretref:vite-elevenlabs-api-key"
ENV_ARGS="$ENV_ARGS ELEVENLABS_API_KEY=secretref:elevenlabs-api-key"
ENV_ARGS="$ENV_ARGS DEEPGRAM_API_KEY=secretref:deepgram-api-key"
ENV_ARGS="$ENV_ARGS VITE_DEEPGRAM_API_KEY=secretref:vite-deepgram-api-key"
ENV_ARGS="$ENV_ARGS SUPABASE_SERVICE_ROLE_KEY=secretref:supabase-service-role-key"
ENV_ARGS="$ENV_ARGS JWT_SECRET=secretref:jwt-secret"

echo ""

# Step 3: Update container app with environment variables
echo -e "${YELLOW}🚀 Updating Azure Container App...${NC}"

az containerapp update \
    --name "$CONTAINER_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --set-env-vars $ENV_ARGS \
    > /dev/null 2>&1

echo -e "${GREEN}✅ Environment variables updated successfully${NC}"
echo ""

# Step 4: Restart the container app
echo -e "${YELLOW}🔄 Restarting container app to apply changes...${NC}"

LATEST_REVISION=$(az containerapp revision list \
    --name "$CONTAINER_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "[0].name" -o tsv)

az containerapp revision restart \
    --name "$CONTAINER_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --revision "$LATEST_REVISION" \
    > /dev/null 2>&1

echo -e "${GREEN}✅ Container app restarted${NC}"
echo ""

# Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Environment sync completed successfully!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "Container App: ${YELLOW}$CONTAINER_APP_NAME${NC}"
echo -e "Resource Group: ${YELLOW}$RESOURCE_GROUP${NC}"
echo -e "Latest Revision: ${YELLOW}$LATEST_REVISION${NC}"
echo ""
echo -e "${BLUE}🌐 Your app should now be accessible at:${NC}"
echo -e "   https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io"
echo ""
