#!/bin/bash

# Simple Azure Static Web Apps Deployment Script
# This script will help you deploy your Context 7 MCP build to Azure

echo "========================================="
echo "Azure Static Web Apps Deployment"
echo "Context 7 MCP - TSHLA Medical"
echo "========================================="
echo ""

# Check if dist folder exists
if [ ! -d "dist" ]; then
    echo "❌ Error: dist/ folder not found"
    echo "Please run 'npm run build' first"
    exit 1
fi

echo "✅ Found dist/ folder with your build"
echo ""

# Show deployment options
echo "Choose your deployment method:"
echo ""
echo "1. Azure Portal (Manual Upload - Recommended for first time)"
echo "2. Azure CLI (Automated)"
echo "3. Azure SWA CLI (Static Web Apps specific)"
echo "4. Just show me the folder location"
echo ""
read -p "Select option (1-4): " option

case $option in
    1)
        echo ""
        echo "📋 Manual Azure Portal Deployment Steps:"
        echo ""
        echo "1. Open your browser and go to: https://portal.azure.com"
        echo "2. Sign in to your Azure account"
        echo "3. Search for 'Static Web Apps' in the search bar"
        echo "4. Click on your 'tshla-medical' app (or your app name)"
        echo "5. In the left sidebar, click 'Browse files'"
        echo "6. Click 'Upload' or 'Deploy'"
        echo "7. Select/drag the entire 'dist' folder"
        echo "8. Wait 2-3 minutes for deployment"
        echo "9. Visit your production URL to verify"
        echo ""
        echo "Your dist folder is located at:"
        echo "$(pwd)/dist"
        echo ""
        read -p "Press Enter to open the dist folder in Finder..."
        open dist/
        ;;

    2)
        echo ""
        echo "🔧 Azure CLI Deployment"
        echo ""

        # Check if Azure CLI is installed
        if ! command -v az &> /dev/null; then
            echo "❌ Azure CLI not found"
            echo ""
            echo "Install Azure CLI first:"
            echo "  brew install azure-cli"
            echo ""
            echo "Or download from: https://aka.ms/installazurecliwindows"
            exit 1
        fi

        echo "✅ Azure CLI found"
        echo ""

        # Login check
        echo "Checking Azure login status..."
        if ! az account show &> /dev/null; then
            echo "Please login to Azure:"
            az login
        fi

        echo ""
        read -p "Enter your Static Web App name: " app_name
        read -p "Enter your Resource Group name: " resource_group

        echo ""
        echo "Deploying to Azure..."
        echo ""

        az staticwebapp deploy \
          --name "$app_name" \
          --resource-group "$resource_group" \
          --source dist/

        if [ $? -eq 0 ]; then
            echo ""
            echo "✅ Deployment successful!"
        else
            echo ""
            echo "❌ Deployment failed. Please check the errors above."
        fi
        ;;

    3)
        echo ""
        echo "🔧 Azure SWA CLI Deployment"
        echo ""

        # Check if SWA CLI is installed
        if ! command -v swa &> /dev/null; then
            echo "Installing Azure Static Web Apps CLI..."
            npm install -g @azure/static-web-apps-cli
        fi

        echo "✅ SWA CLI ready"
        echo ""

        read -p "Enter your deployment token (from Azure Portal): " deployment_token

        echo ""
        echo "Deploying to Azure Static Web Apps..."
        echo ""

        npx @azure/static-web-apps-cli deploy ./dist \
          --deployment-token "$deployment_token"

        if [ $? -eq 0 ]; then
            echo ""
            echo "✅ Deployment successful!"
        else
            echo ""
            echo "❌ Deployment failed. Please check the errors above."
        fi
        ;;

    4)
        echo ""
        echo "📁 Your build is ready in the dist/ folder:"
        echo ""
        echo "Location: $(pwd)/dist"
        echo ""
        echo "To deploy manually:"
        echo "1. Go to portal.azure.com"
        echo "2. Find your Static Web App"
        echo "3. Upload this entire folder"
        echo ""
        read -p "Press Enter to open the folder in Finder..."
        open dist/
        ;;

    *)
        echo "Invalid option"
        exit 1
        ;;
esac

echo ""
echo "========================================="
echo "Next Steps After Deployment:"
echo "========================================="
echo ""
echo "1. Wait 2-3 minutes for deployment to complete"
echo "2. Visit your production URL"
echo "3. Test the Welcome Back feature"
echo "4. Test auto-save functionality"
echo "5. Submit feedback to test collection"
echo "6. Create conflicts to test detection"
echo ""
echo "📊 Monitor your metrics for the first 24 hours!"
echo ""
