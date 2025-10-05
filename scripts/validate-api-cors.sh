#!/bin/bash

# TSHLA Medical - CORS Configuration Validator
# Tests that production frontend domain is properly whitelisted in all APIs
# This would have caught Failure #3 from DEPLOYMENT_FAILURES.md

set -e

echo "🌐 Validating CORS Configuration..."
echo ""

FAILED=0

# URLs
FRONTEND_URL="https://mango-sky-0ba265c0f.1.azurestaticapps.net"
PUMP_API_URL="https://tshla-pump-api-container.redpebble-e4551b7a.eastus.azurecontainerapps.io"
AUTH_API_URL="https://tshla-auth-api-container.redpebble-e4551b7a.eastus.azurecontainerapps.io"
SCHEDULE_API_URL="https://tshla-schedule-api-container.redpebble-e4551b7a.eastus.azurecontainerapps.io"

# Function to test CORS
test_cors() {
    local api_url=$1
    local api_name=$2

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Testing $api_name"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Test 1: Access-Control-Allow-Origin header
    echo -n "1. Access-Control-Allow-Origin... "
    RESPONSE=$(curl -s -I -H "Origin: $FRONTEND_URL" "$api_url/health" 2>&1)
    CORS_ORIGIN=$(echo "$RESPONSE" | grep -i "access-control-allow-origin" | cut -d: -f2- | tr -d ' \r\n' || echo "")

    if [ -z "$CORS_ORIGIN" ]; then
        echo "❌ MISSING"
        echo "   └─ Frontend will get CORS error: \"has been blocked by CORS policy\""
        echo "   └─ Add to CORS config: '$FRONTEND_URL'"
        FAILED=$((FAILED + 1))
    elif [ "$CORS_ORIGIN" = "$FRONTEND_URL" ] || [ "$CORS_ORIGIN" = "*" ]; then
        echo "✅ $CORS_ORIGIN"
    else
        echo "⚠️  $CORS_ORIGIN"
        echo "   └─ Frontend URL '$FRONTEND_URL' may not be allowed"
    fi

    # Test 2: Access-Control-Allow-Credentials
    echo -n "2. Access-Control-Allow-Credentials... "
    CORS_CREDS=$(echo "$RESPONSE" | grep -i "access-control-allow-credentials" | cut -d: -f2- | tr -d ' \r\n' || echo "")

    if [ -z "$CORS_CREDS" ]; then
        echo "⚠️  Missing (may cause issues with auth cookies)"
    else
        echo "✅ $CORS_CREDS"
    fi

    # Test 3: OPTIONS preflight request
    echo -n "3. Preflight OPTIONS Request... "
    OPTIONS_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        -X OPTIONS \
        -H "Origin: $FRONTEND_URL" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: Content-Type,Authorization" \
        "$api_url/health" \
        --max-time 10)

    if [ "$OPTIONS_CODE" = "200" ] || [ "$OPTIONS_CODE" = "204" ]; then
        echo "✅ $OPTIONS_CODE"
    else
        echo "❌ $OPTIONS_CODE (expected 200 or 204)"
        echo "   └─ Preflight requests will fail"
        FAILED=$((FAILED + 1))
    fi

    # Test 4: Access-Control-Allow-Methods
    echo -n "4. Access-Control-Allow-Methods... "
    OPTIONS_RESPONSE=$(curl -s -I \
        -X OPTIONS \
        -H "Origin: $FRONTEND_URL" \
        -H "Access-Control-Request-Method: POST" \
        "$api_url/health" 2>&1)
    ALLOW_METHODS=$(echo "$OPTIONS_RESPONSE" | grep -i "access-control-allow-methods" | cut -d: -f2- | tr -d ' \r\n' || echo "")

    if [ -z "$ALLOW_METHODS" ]; then
        echo "⚠️  Missing"
    else
        echo "✅ $ALLOW_METHODS"
    fi

    # Test 5: Access-Control-Allow-Headers
    echo -n "5. Access-Control-Allow-Headers... "
    ALLOW_HEADERS=$(echo "$OPTIONS_RESPONSE" | grep -i "access-control-allow-headers" | cut -d: -f2- | tr -d ' \r\n' || echo "")

    if [ -z "$ALLOW_HEADERS" ]; then
        echo "⚠️  Missing"
    else
        echo "✅ Present"
        # Check for required headers
        if echo "$ALLOW_HEADERS" | grep -qi "authorization"; then
            echo "   └─ Authorization: ✅"
        else
            echo "   └─ Authorization: ❌ Missing (auth requests will fail)"
            FAILED=$((FAILED + 1))
        fi
    fi

    echo ""
}

# Test all APIs
test_cors "$PUMP_API_URL" "Pump Report API"
test_cors "$AUTH_API_URL" "Medical Auth API"
test_cors "$SCHEDULE_API_URL" "Schedule API"

# Test actual API endpoint with auth (should get 401, not CORS error)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Real-World CORS Test (with Authorization)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo -n "Testing authenticated endpoint... "
RESPONSE=$(curl -s -w "\n%{http_code}" \
    -H "Origin: $FRONTEND_URL" \
    -H "Authorization: Bearer fake-token" \
    "$PUMP_API_URL/api/admin/pump-comparison-data" 2>&1)

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
    echo "✅ $HTTP_CODE (CORS working, auth required)"
elif echo "$BODY" | grep -qi "cors"; then
    echo "❌ CORS Error Found in Response"
    echo "   └─ $BODY"
    FAILED=$((FAILED + 1))
else
    echo "⚠️  HTTP $HTTP_CODE (unexpected)"
fi

echo ""

# Final result
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $FAILED -eq 0 ]; then
    echo "✅ All CORS validation checks passed!"
    echo ""
    echo "Frontend can communicate with all APIs without CORS errors."
    echo ""
    exit 0
else
    echo "❌ $FAILED CORS validation check(s) failed!"
    echo ""
    echo "Frontend will get CORS errors when calling APIs."
    echo "Fix CORS configuration in API code and redeploy."
    echo ""
    echo "Required CORS configuration:"
    echo "  origin: ['http://localhost:5173', '$FRONTEND_URL']"
    echo "  credentials: true"
    echo "  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']"
    echo "  allowedHeaders: ['Content-Type', 'Authorization']"
    echo ""
    exit 1
fi
