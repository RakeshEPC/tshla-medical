#!/bin/bash

# TSHLA Medical - Production Deployment Validator
# Tests all production URLs return 200 OK
# This script should be run AFTER deployment to verify success

set -e

echo "🔍 Validating Production Deployment..."
echo ""

FAILED=0

# Production URLs
FRONTEND_URL="https://mango-sky-0ba265c0f.1.azurestaticapps.net"
PUMP_API_URL="https://tshla-pump-api-container.redpebble-e4551b7a.eastus.azurecontainerapps.io"
AUTH_API_URL="https://tshla-auth-api-container.redpebble-e4551b7a.eastus.azurecontainerapps.io"
SCHEDULE_API_URL="https://tshla-schedule-api-container.redpebble-e4551b7a.eastus.azurecontainerapps.io"

# Function to test URL
test_url() {
    local url=$1
    local description=$2

    echo -n "Testing $description... "

    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$url" --max-time 10)

    if [ "$HTTP_CODE" = "200" ]; then
        echo "✅ $HTTP_CODE"
    else
        echo "❌ $HTTP_CODE"
        FAILED=$((FAILED + 1))
    fi
}

# Test Frontend
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Frontend Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_url "$FRONTEND_URL" "Frontend Root"
test_url "$FRONTEND_URL/login" "Login Page"
test_url "$FRONTEND_URL/admin/accounts" "Admin Accounts Page"
test_url "$FRONTEND_URL/admin/pump-comparison" "Pump Comparison Page (CRITICAL)"
echo ""

# Test API Health Endpoints
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "API Health Checks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_url "$PUMP_API_URL/health" "Pump API Health"
test_url "$AUTH_API_URL/health" "Auth API Health"
test_url "$SCHEDULE_API_URL/health" "Schedule API Health"
echo ""

# Test CORS Headers
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "CORS Header Checks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo -n "Checking Pump API CORS... "
CORS_HEADER=$(curl -s -H "Origin: $FRONTEND_URL" -I "$PUMP_API_URL/health" | grep -i "access-control-allow-origin" || echo "")
if [ -z "$CORS_HEADER" ]; then
    echo "❌ No CORS headers found"
    FAILED=$((FAILED + 1))
else
    echo "✅ CORS configured"
fi

echo -n "Checking Auth API CORS... "
CORS_HEADER=$(curl -s -H "Origin: $FRONTEND_URL" -I "$AUTH_API_URL/health" | grep -i "access-control-allow-origin" || echo "")
if [ -z "$CORS_HEADER" ]; then
    echo "❌ No CORS headers found"
    FAILED=$((FAILED + 1))
else
    echo "✅ CORS configured"
fi

echo ""

# Check staticwebapp.config.json is deployed
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Configuration File Checks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo -n "Checking staticwebapp.config.json exists... "
CONFIG_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/staticwebapp.config.json" --max-time 10)
if [ "$CONFIG_RESPONSE" = "200" ]; then
    echo "✅ Found"
else
    echo "❌ Missing (404 errors will occur on /admin/* routes)"
    FAILED=$((FAILED + 1))
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Final result
if [ $FAILED -eq 0 ]; then
    echo "✅ All deployment validation checks passed!"
    echo ""
    echo "Production is ready to use:"
    echo "   👉 $FRONTEND_URL"
    echo ""
    exit 0
else
    echo "❌ $FAILED validation check(s) failed!"
    echo ""
    echo "DO NOT mark deployment as successful."
    echo "Fix the issues above and redeploy."
    echo ""
    exit 1
fi
