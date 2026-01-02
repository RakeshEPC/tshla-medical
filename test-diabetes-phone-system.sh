#!/bin/bash

# ============================================================
# Diabetes Education Phone System - Diagnostic Test Script
# ============================================================
# Tests all components of the diabetes education phone system
# for phone number: 832-400-3930
# ============================================================

set -e

echo "═══════════════════════════════════════════════════════════"
echo "  Diabetes Education Phone System - Diagnostic Tests"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Function to print test result
print_result() {
  local test_name="$1"
  local result="$2"
  local details="$3"

  if [ "$result" = "PASS" ]; then
    echo -e "${GREEN}✓${NC} $test_name"
    [ -n "$details" ] && echo -e "  ${BLUE}→${NC} $details"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗${NC} $test_name"
    [ -n "$details" ] && echo -e "  ${RED}→${NC} $details"
    ((TESTS_FAILED++))
  fi
}

# ============================================================
# TEST 1: Azure Health Check
# ============================================================
echo ""
echo -e "${YELLOW}TEST 1: Azure Unified API Health Check${NC}"
echo "────────────────────────────────────────"

HEALTH_RESPONSE=$(curl -s https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/health)

if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
  print_result "Azure API is healthy" "PASS" "Status: $(echo $HEALTH_RESPONSE | jq -r .status 2>/dev/null || echo 'healthy')"
else
  print_result "Azure API health check" "FAIL" "Response: $HEALTH_RESPONSE"
fi

# ============================================================
# TEST 2: Azure Environment Variables
# ============================================================
echo ""
echo -e "${YELLOW}TEST 2: Azure Environment Variables${NC}"
echo "────────────────────────────────────────"

echo "Checking ElevenLabs configuration..."
ELEVENLABS_VARS=$(az containerapp show \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --query "properties.template.containers[0].env[?starts_with(name, 'ELEVENLABS')].{name:name, secretRef:secretRef}" \
  -o json 2>/dev/null)

if echo "$ELEVENLABS_VARS" | grep -q "ELEVENLABS_API_KEY"; then
  print_result "ELEVENLABS_API_KEY configured" "PASS"
else
  print_result "ELEVENLABS_API_KEY configured" "FAIL" "Missing from Azure environment"
fi

if echo "$ELEVENLABS_VARS" | grep -q "ELEVENLABS_DIABETES_AGENT_EN"; then
  print_result "ELEVENLABS_DIABETES_AGENT_EN configured" "PASS"
else
  print_result "ELEVENLABS_DIABETES_AGENT_EN configured" "FAIL" "Missing from Azure environment"
fi

# ============================================================
# TEST 3: Patient Database Lookup
# ============================================================
echo ""
echo -e "${YELLOW}TEST 3: Patient Registration Check${NC}"
echo "────────────────────────────────────────"

echo "Looking up patient: +18326073630..."

# Check if environment variables are set
if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  print_result "Patient registration check" "SKIP" "Environment variables not set. Run: source .env"
else
  # Run patient check script
  if [ -f "server/check-patient-registration.js" ]; then
    PATIENT_CHECK=$(VITE_SUPABASE_URL="$VITE_SUPABASE_URL" \
                   SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
                   node server/check-patient-registration.js "+18326073630" 2>&1)

    if echo "$PATIENT_CHECK" | grep -q "Patient found"; then
      PATIENT_NAME=$(echo "$PATIENT_CHECK" | grep "Name:" | cut -d: -f2-)
      print_result "Patient +18326073630 registered" "PASS" "Patient:$PATIENT_NAME"
    else
      print_result "Patient +18326073630 registered" "FAIL" "Patient not found in database"
    fi
  else
    print_result "Patient registration check" "SKIP" "check-patient-registration.js not found"
  fi
fi

# ============================================================
# TEST 4: Twilio Webhook Endpoint
# ============================================================
echo ""
echo -e "${YELLOW}TEST 4: Twilio Webhook Endpoints${NC}"
echo "────────────────────────────────────────"

# Test inbound webhook (with test parameters)
WEBHOOK_RESPONSE=$(curl -s -X POST \
  "https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/twilio/diabetes-education-inbound" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "CallSid=TEST_DIAGNOSTIC_123" \
  --data-urlencode "From=+19999999999" \
  --data-urlencode "To=+18324003930" \
  --data-urlencode "CallStatus=ringing" 2>&1)

if echo "$WEBHOOK_RESPONSE" | grep -q "Sorry.*not registered"; then
  print_result "Twilio inbound webhook responding" "PASS" "Correctly rejecting unregistered number"
elif echo "$WEBHOOK_RESPONSE" | grep -q "Response"; then
  print_result "Twilio inbound webhook responding" "PASS" "Webhook is processing requests"
else
  print_result "Twilio inbound webhook responding" "FAIL" "Unexpected response: ${WEBHOOK_RESPONSE:0:100}"
fi

# ============================================================
# TEST 5: ElevenLabs Webhook Endpoint
# ============================================================
echo ""
echo -e "${YELLOW}TEST 5: ElevenLabs Webhook Endpoint${NC}"
echo "────────────────────────────────────────"

ELEVENLABS_WEBHOOK_RESPONSE=$(curl -s -X POST \
  "https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/elevenlabs/diabetes-education-transcript" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "transcription",
    "data": {
      "conversation_id": "test-diagnostic-123",
      "transcript": [{"role": "agent", "message": "Test"}]
    }
  }' 2>&1)

if echo "$ELEVENLABS_WEBHOOK_RESPONSE" | grep -q "success"; then
  print_result "ElevenLabs transcript webhook" "PASS" "Webhook endpoint is functional"
else
  print_result "ElevenLabs transcript webhook" "FAIL" "Response: ${ELEVENLABS_WEBHOOK_RESPONSE:0:100}"
fi

# ============================================================
# TEST 6: Local Environment Configuration
# ============================================================
echo ""
echo -e "${YELLOW}TEST 6: Local Environment Configuration${NC}"
echo "────────────────────────────────────────"

if [ -f ".env" ]; then
  if grep -q "VITE_ELEVENLABS_API_KEY" .env; then
    print_result ".env has VITE_ELEVENLABS_API_KEY" "PASS"
  else
    print_result ".env has VITE_ELEVENLABS_API_KEY" "FAIL" "Missing from .env file"
  fi

  if grep -q "ELEVENLABS_DIABETES_AGENT_EN" .env; then
    AGENT_ID=$(grep "ELEVENLABS_DIABETES_AGENT_EN" .env | cut -d= -f2)
    print_result ".env has ELEVENLABS_DIABETES_AGENT_EN" "PASS" "Agent ID: ${AGENT_ID:0:20}..."
  else
    print_result ".env has ELEVENLABS_DIABETES_AGENT_EN" "FAIL" "Missing from .env file"
  fi
else
  print_result ".env file exists" "FAIL" "No .env file found in project root"
fi

# ============================================================
# TEST SUMMARY
# ============================================================
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Test Summary"
echo "═══════════════════════════════════════════════════════════"
echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed!${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Verify ElevenLabs agent system prompt includes {{patient_context}}"
  echo "2. Make a test call to 832-400-3930 from +18326073630"
  echo "3. Check Azure logs: az containerapp logs show --name tshla-unified-api --resource-group tshla-backend-rg --tail 50"
  exit 0
else
  echo -e "${RED}✗ Some tests failed${NC}"
  echo ""
  echo "Troubleshooting:"
  echo "1. Review failed tests above"
  echo "2. Check DIABETES_PHONE_TROUBLESHOOTING_GUIDE.md for detailed fixes"
  echo "3. Verify Azure secrets are set correctly"
  echo "4. Check Azure logs for specific errors"
  exit 1
fi
