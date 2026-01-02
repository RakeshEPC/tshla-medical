#!/bin/bash

# ============================================================
# Update Azure ElevenLabs Configuration
# ============================================================
# Updates Azure Container App secrets for ElevenLabs integration
# ============================================================

set -e

echo "═══════════════════════════════════════════════════════════"
echo "  Update Azure ElevenLabs Configuration"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f ".env" ]; then
  echo -e "${RED}Error: .env file not found!${NC}"
  echo "Please create a .env file with your ElevenLabs credentials."
  exit 1
fi

# Source .env to get values
source .env

# Validate required variables
MISSING_VARS=""

if [ -z "$VITE_ELEVENLABS_API_KEY" ]; then
  MISSING_VARS="${MISSING_VARS}\n  - VITE_ELEVENLABS_API_KEY"
fi

if [ -z "$ELEVENLABS_DIABETES_AGENT_EN" ]; then
  MISSING_VARS="${MISSING_VARS}\n  - ELEVENLABS_DIABETES_AGENT_EN"
fi

if [ -z "$ELEVENLABS_DIABETES_AGENT_ES" ]; then
  MISSING_VARS="${MISSING_VARS}\n  - ELEVENLABS_DIABETES_AGENT_ES"
fi

if [ -z "$ELEVENLABS_DIABETES_AGENT_HI" ]; then
  MISSING_VARS="${MISSING_VARS}\n  - ELEVENLABS_DIABETES_AGENT_HI"
fi

if [ -n "$MISSING_VARS" ]; then
  echo -e "${RED}Error: Missing required environment variables in .env:${NC}"
  echo -e "${MISSING_VARS}"
  echo ""
  echo "Please add these variables to your .env file:"
  echo ""
  echo "VITE_ELEVENLABS_API_KEY=sk_your_api_key_here"
  echo "ELEVENLABS_DIABETES_AGENT_EN=agent_your_english_agent_id"
  echo "ELEVENLABS_DIABETES_AGENT_ES=agent_your_spanish_agent_id"
  echo "ELEVENLABS_DIABETES_AGENT_HI=agent_your_hindi_agent_id"
  exit 1
fi

echo -e "${BLUE}Configuration to be updated:${NC}"
echo "  API Key: ${VITE_ELEVENLABS_API_KEY:0:10}...${VITE_ELEVENLABS_API_KEY: -10}"
echo "  English Agent: $ELEVENLABS_DIABETES_AGENT_EN"
echo "  Spanish Agent: $ELEVENLABS_DIABETES_AGENT_ES"
echo "  Hindi Agent: $ELEVENLABS_DIABETES_AGENT_HI"
echo ""

# Ask for confirmation
read -p "Update Azure Container App with these values? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cancelled."
  exit 0
fi

echo ""
echo -e "${YELLOW}Updating Azure secrets...${NC}"
echo ""

# Update ElevenLabs API Key
echo -e "${BLUE}1/4${NC} Updating ELEVENLABS_API_KEY..."
az containerapp secret set \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --secrets \
    elevenlabs-api-key="$VITE_ELEVENLABS_API_KEY" \
  > /dev/null 2>&1

if [ $? -eq 0 ]; then
  echo -e "    ${GREEN}✓${NC} API key updated"
else
  echo -e "    ${RED}✗${NC} Failed to update API key"
  exit 1
fi

# Update English Agent ID
echo -e "${BLUE}2/4${NC} Updating ELEVENLABS_DIABETES_AGENT_EN..."
az containerapp secret set \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --secrets \
    elevenlabs-diabetes-agent-en="$ELEVENLABS_DIABETES_AGENT_EN" \
  > /dev/null 2>&1

if [ $? -eq 0 ]; then
  echo -e "    ${GREEN}✓${NC} English agent ID updated"
else
  echo -e "    ${RED}✗${NC} Failed to update English agent ID"
  exit 1
fi

# Update Spanish Agent ID
echo -e "${BLUE}3/4${NC} Updating ELEVENLABS_DIABETES_AGENT_ES..."
az containerapp secret set \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --secrets \
    elevenlabs-diabetes-agent-es="$ELEVENLABS_DIABETES_AGENT_ES" \
  > /dev/null 2>&1

if [ $? -eq 0 ]; then
  echo -e "    ${GREEN}✓${NC} Spanish agent ID updated"
else
  echo -e "    ${RED}✗${NC} Failed to update Spanish agent ID"
  exit 1
fi

# Update Hindi Agent ID
echo -e "${BLUE}4/4${NC} Updating ELEVENLABS_DIABETES_AGENT_HI..."
az containerapp secret set \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --secrets \
    elevenlabs-diabetes-agent-hi="$ELEVENLABS_DIABETES_AGENT_HI" \
  > /dev/null 2>&1

if [ $? -eq 0 ]; then
  echo -e "    ${GREEN}✓${NC} Hindi agent ID updated"
else
  echo -e "    ${RED}✗${NC} Failed to update Hindi agent ID"
  exit 1
fi

echo ""
echo -e "${YELLOW}Restarting Azure Container App...${NC}"
echo ""

# Get latest revision name
REVISION=$(az containerapp revision list \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --query "[0].name" -o tsv)

echo "Latest revision: $REVISION"

# Restart by updating a label (this triggers a new revision with updated secrets)
az containerapp update \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --set-env-vars "CONFIG_UPDATED=$(date +%s)" \
  > /dev/null 2>&1

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓${NC} Container app restarted successfully"
else
  echo -e "${RED}✗${NC} Failed to restart container app"
  exit 1
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Configuration Updated Successfully!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "Next steps:"
echo ""
echo "1. Wait 2-3 minutes for the new revision to deploy"
echo ""
echo "2. Verify configuration:"
echo "   ./test-diabetes-phone-system.sh"
echo ""
echo "3. Check Azure logs during a test call:"
echo "   az containerapp logs show \\"
echo "     --name tshla-unified-api \\"
echo "     --resource-group tshla-backend-rg \\"
echo "     --tail 50 --follow"
echo ""
echo "4. Make a test call to 832-400-3930"
echo ""
echo "5. If still failing, check ElevenLabs agent configuration:"
echo "   - Verify agent IDs exist in ElevenLabs dashboard"
echo "   - Ensure system prompt includes {{patient_context}} variable"
echo "   - Check webhook configuration"
echo ""
