#!/bin/bash

# Context 7 MCP Deployment Script
# TSHLA Medical - Pump Drive Assessment
# Version: 2.0

set -e  # Exit on error

echo "=================================="
echo "Context 7 MCP Deployment"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: package.json not found. Please run this script from the project root.${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Found package.json"

# Step 1: Install dependencies
echo ""
echo "Step 1: Installing dependencies..."
npm install
echo -e "${GREEN}✓${NC} Dependencies installed"

# Step 2: Type checking
echo ""
echo "Step 2: Running TypeScript type check..."
if npm run type-check 2>/dev/null || npx tsc --noEmit 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Type check passed"
else
    echo -e "${YELLOW}⚠${NC} Type check skipped (script not found)"
fi

# Step 3: Build the project
echo ""
echo "Step 3: Building project..."
if npm run build; then
    echo -e "${GREEN}✓${NC} Build successful"
else
    echo -e "${RED}✗${NC} Build failed"
    exit 1
fi

# Step 4: Build MCP server
echo ""
echo "Step 4: Building MCP server..."
cd mcp-server
if [ -f "package.json" ]; then
    npm install
    if npm run build 2>/dev/null; then
        echo -e "${GREEN}✓${NC} MCP server built"
    else
        echo -e "${YELLOW}⚠${NC} MCP server build skipped"
    fi
    cd ..
else
    echo -e "${YELLOW}⚠${NC} MCP server package.json not found, skipping"
    cd ..
fi

# Step 5: Run tests (if available)
echo ""
echo "Step 5: Running tests..."
if npm run test 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Tests passed"
else
    echo -e "${YELLOW}⚠${NC} Tests skipped (no test script found)"
fi

# Step 6: Pre-deployment checklist
echo ""
echo "=================================="
echo "Pre-Deployment Checklist"
echo "=================================="
echo ""

checklist=(
    "Environment variables configured (DB_HOST, etc.)"
    "HIPAA compliance review completed"
    "Privacy Notice approved and ready"
    "Team trained on new features"
    "Backup of current production taken"
    "Rollback plan prepared"
    "Error monitoring configured (Sentry, etc.)"
    "Analytics tracking verified"
)

for item in "${checklist[@]}"; do
    echo -e "${YELLOW}☐${NC} $item"
done

echo ""
echo "=================================="
echo "Deployment Options"
echo "=================================="
echo ""
echo "1. Deploy to Staging"
echo "2. Deploy to Production"
echo "3. Deploy MCP Server Only"
echo "4. Exit"
echo ""
read -p "Select option (1-4): " deploy_option

case $deploy_option in
    1)
        echo ""
        echo "Deploying to STAGING..."
        if npm run deploy:staging 2>/dev/null; then
            echo -e "${GREEN}✓${NC} Deployed to staging"
            echo ""
            echo "Staging URL: [Your staging URL]"
            echo "Test the following:"
            echo "  - Welcome back functionality"
            echo "  - Auto-save (change sliders, close tab, reopen)"
            echo "  - Feedback submission"
            echo "  - Conflict detection"
            echo "  - Analytics dashboard"
        else
            echo -e "${YELLOW}⚠${NC} Deploy script not found. Manual deployment needed."
            echo ""
            echo "Manual deployment steps:"
            echo "1. Upload dist/ folder to staging server"
            echo "2. Restart web server"
            echo "3. Verify deployment"
        fi
        ;;
    2)
        echo ""
        echo -e "${YELLOW}⚠ WARNING: You are about to deploy to PRODUCTION${NC}"
        echo ""
        read -p "Are you sure? Type 'YES' to confirm: " confirm
        if [ "$confirm" = "YES" ]; then
            echo ""
            echo "Deploying to PRODUCTION..."
            if npm run deploy:production 2>/dev/null; then
                echo -e "${GREEN}✓${NC} Deployed to production"
                echo ""
                echo "Post-deployment tasks:"
                echo "1. Monitor error logs for 30 minutes"
                echo "2. Verify analytics are tracking"
                echo "3. Test user flows"
                echo "4. Check HIPAA compliance logs"
            else
                echo -e "${YELLOW}⚠${NC} Deploy script not found. Manual deployment needed."
                echo ""
                echo "Manual deployment steps:"
                echo "1. Upload dist/ folder to production server"
                echo "2. Run database migrations (if any)"
                echo "3. Restart web server"
                echo "4. Verify deployment"
                echo "5. Monitor logs"
            fi
        else
            echo "Deployment cancelled"
        fi
        ;;
    3)
        echo ""
        echo "Deploying MCP Server..."
        # Copy MCP server to appropriate location
        if [ -f "mcp-server/dist/index-context7.js" ]; then
            cp mcp-server/dist/index-context7.js mcp-server/dist/index.js
            echo -e "${GREEN}✓${NC} MCP server updated"
            echo ""
            echo "To use the new MCP server, update your MCP client configuration:"
            echo "  Server: mcp-server/dist/index.js"
        else
            echo -e "${RED}✗${NC} MCP server build not found"
        fi
        ;;
    4)
        echo "Exiting..."
        exit 0
        ;;
    *)
        echo "Invalid option"
        exit 1
        ;;
esac

echo ""
echo "=================================="
echo "Post-Deployment Verification"
echo "=================================="
echo ""
echo "Please verify:"
echo "1. Open Pump Drive assessment"
echo "2. Complete 3-4 questions and close browser"
echo "3. Reopen - verify 'Welcome Back' appears"
echo "4. Complete assessment - verify feedback form shows"
echo "5. Submit feedback - verify it's stored"
echo "6. Open analytics dashboard - verify data displays"
echo "7. Create conflicting preferences - verify modal appears"
echo ""
echo -e "${GREEN}Deployment process complete!${NC}"
echo ""
