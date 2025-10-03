#!/bin/bash

# TSHLA Medical Frontend Deployment Script
# Deploys production build to Azure Static Web Apps

set -e

echo "🚀 TSHLA Medical Frontend Deployment"
echo "===================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
STATIC_WEB_APP_NAME="tshla-medical-frontend"
RESOURCE_GROUP="tshla-backend-rg"

# Step 1: Check if Azure CLI is installed
echo "📋 Step 1: Checking prerequisites..."
if ! command -v az &> /dev/null; then
    echo -e "${RED}❌ Azure CLI is not installed${NC}"
    echo "Install it from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Step 2: Check if logged in to Azure
echo "🔐 Step 2: Checking Azure login..."
if ! az account show &> /dev/null; then
    echo -e "${RED}❌ Not logged in to Azure${NC}"
    echo "Please run: az login"
    exit 1
fi

# Step 3: Build production
echo "🔨 Step 3: Building production bundle..."
echo ""
npm run build

if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Build failed - dist folder not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build successful${NC}"
echo ""

# Step 4: Get deployment token
echo "🔑 Step 4: Getting deployment token..."
DEPLOYMENT_TOKEN=$(az staticwebapp secrets list \
    --name "$STATIC_WEB_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query 'properties.apiKey' \
    -o tsv 2>/dev/null)

if [ -z "$DEPLOYMENT_TOKEN" ]; then
    echo -e "${RED}❌ Failed to get deployment token${NC}"
    echo "Make sure you have access to the Static Web App resource"
    exit 1
fi

echo -e "${GREEN}✅ Token retrieved${NC}"
echo ""

# Step 5: Check if SWA CLI is installed
echo "📦 Step 5: Checking Azure Static Web Apps CLI..."
if ! command -v swa &> /dev/null; then
    echo -e "${YELLOW}⚠️  Azure Static Web Apps CLI not installed${NC}"
    echo "Installing globally..."
    npm install -g @azure/static-web-apps-cli
fi

echo -e "${GREEN}✅ SWA CLI ready${NC}"
echo ""

# Step 6: Deploy to Azure
echo "🚀 Step 6: Deploying to Azure Static Web Apps..."
echo ""
echo "Deploying to: https://www.tshla.ai"
echo "Static Web App: $STATIC_WEB_APP_NAME"
echo ""

swa deploy ./dist \
    --deployment-token "$DEPLOYMENT_TOKEN" \
    --env production

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    echo ""
    echo "🌐 Your site is now live at:"
    echo "   https://www.tshla.ai"
    echo ""
    echo "📊 Verify deployment:"
    echo "   1. Visit the URL above"
    echo "   2. Check browser console for errors"
    echo "   3. Test login functionality"
    echo ""
else
    echo -e "${RED}❌ Deployment failed${NC}"
    echo ""
    echo "Manual deployment options:"
    echo "1. Azure Portal: https://portal.azure.com"
    echo "2. Or use: npm install -g @azure/static-web-apps-cli && swa deploy"
    exit 1
fi
