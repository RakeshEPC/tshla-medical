#!/bin/bash

# TSHLA Medical - API Health Validator
# Comprehensive health checks for all production APIs
# Tests endpoints, response times, database connectivity, and CORS

set -e

echo "🏥 Validating API Health..."
echo ""

FAILED=0

# Production API URLs
PUMP_API_URL="https://tshla-pump-api-container.redpebble-e4551b7a.eastus.azurecontainerapps.io"
AUTH_API_URL="https://tshla-auth-api-container.redpebble-e4551b7a.eastus.azurecontainerapps.io"
SCHEDULE_API_URL="https://tshla-schedule-api-container.redpebble-e4551b7a.eastus.azurecontainerapps.io"

# Function to test API health endpoint
test_api_health() {
    local base_url=$1
    local health_path=$2
    local name=$3
    local full_url="$base_url$health_path"

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Testing $name"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Test HTTP status code
    echo -n "1. HTTP Status Code... "
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$full_url" --max-time 10)
    if [ "$HTTP_CODE" = "200" ]; then
        echo "✅ $HTTP_CODE"
    else
        echo "❌ $HTTP_CODE (expected 200)"
        FAILED=$((FAILED + 1))
    fi

    # Test response time
    echo -n "2. Response Time... "
    RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$full_url" --max-time 10)
    RESPONSE_MS=$(echo "$RESPONSE_TIME * 1000" | bc | cut -d. -f1)
    if [ "$RESPONSE_MS" -lt 5000 ]; then
        echo "✅ ${RESPONSE_MS}ms"
    else
        echo "⚠️  ${RESPONSE_MS}ms (slow, expected < 5000ms)"
    fi

    # Test JSON response
    echo -n "3. JSON Response... "
    RESPONSE=$(curl -s "$full_url" --max-time 10)
    if echo "$RESPONSE" | jq . > /dev/null 2>&1; then
        echo "✅ Valid JSON"

        # Check for status field
        STATUS=$(echo "$RESPONSE" | jq -r '.status' 2>/dev/null || echo "missing")
        if [ "$STATUS" = "ok" ]; then
            echo "   └─ Status: ✅ ok"
        else
            echo "   └─ Status: ⚠️  $STATUS (expected 'ok')"
        fi
    else
        echo "❌ Invalid JSON"
        FAILED=$((FAILED + 1))
    fi

    # Test CORS headers
    echo -n "4. CORS Headers... "
    CORS_ORIGIN=$(curl -s -I -H "Origin: https://mango-sky-0ba265c0f.1.azurestaticapps.net" "$full_url" | grep -i "access-control-allow-origin" || echo "")
    if [ -z "$CORS_ORIGIN" ]; then
        echo "❌ Missing"
        echo "   └─ Frontend will get CORS errors!"
        FAILED=$((FAILED + 1))
    else
        echo "✅ Present"
        ALLOWED_ORIGIN=$(echo "$CORS_ORIGIN" | cut -d: -f2- | tr -d ' \r\n')
        echo "   └─ Allowed: $ALLOWED_ORIGIN"
    fi

    # Test OPTIONS request (preflight)
    echo -n "5. CORS Preflight... "
    OPTIONS_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$full_url" --max-time 10)
    if [ "$OPTIONS_CODE" = "200" ] || [ "$OPTIONS_CODE" = "204" ]; then
        echo "✅ $OPTIONS_CODE"
    else
        echo "❌ $OPTIONS_CODE (expected 200 or 204)"
        FAILED=$((FAILED + 1))
    fi

    echo ""
}

# Test all APIs
test_api_health "$PUMP_API_URL" "/api/health" "Pump Report API"
test_api_health "$AUTH_API_URL" "/api/medical/health" "Medical Auth API"
test_api_health "$SCHEDULE_API_URL" "/health" "Schedule API"

# Additional Pump API specific checks
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Pump API Data Validation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Note: These require authentication, so we test the endpoint exists
echo -n "1. Pump Comparison Endpoint... "
ENDPOINT_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$PUMP_API_URL/api/admin/pump-comparison-data" --max-time 10)
if [ "$ENDPOINT_CODE" = "401" ] || [ "$ENDPOINT_CODE" = "403" ]; then
    echo "✅ Exists (requires auth: $ENDPOINT_CODE)"
elif [ "$ENDPOINT_CODE" = "200" ]; then
    echo "✅ Accessible (200)"
else
    echo "❌ $ENDPOINT_CODE (expected 401/403/200)"
    FAILED=$((FAILED + 1))
fi

echo -n "2. PumpDrive Users Endpoint... "
ENDPOINT_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$PUMP_API_URL/api/admin/pumpdrive-users" --max-time 10)
if [ "$ENDPOINT_CODE" = "401" ] || [ "$ENDPOINT_CODE" = "403" ]; then
    echo "✅ Exists (requires auth: $ENDPOINT_CODE)"
elif [ "$ENDPOINT_CODE" = "200" ]; then
    echo "✅ Accessible (200)"
else
    echo "❌ $ENDPOINT_CODE (expected 401/403/200)"
    FAILED=$((FAILED + 1))
fi

echo ""

# Final result
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $FAILED -eq 0 ]; then
    echo "✅ All API health checks passed!"
    echo ""
    echo "APIs are healthy and ready to serve requests."
    echo ""
    exit 0
else
    echo "❌ $FAILED health check(s) failed!"
    echo ""
    echo "APIs are NOT fully operational."
    echo "Fix the issues above before marking deployment as successful."
    echo ""
    exit 1
fi
