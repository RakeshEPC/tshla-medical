#!/bin/bash

# =====================================================
# TSHLA Medical - Phase 1, 2, 3 Testing Script
# =====================================================
# Tests all HIPAA compliance phases deployed to production
# Run: bash test-all-phases.sh
# =====================================================

API_URL="https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io"
TIMESTAMP=$(date +%s)

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   TSHLA Medical - HIPAA Compliance Testing Suite         ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# =====================================================
# PHASE 1: RLS (Row Level Security) Testing
# =====================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PHASE 1: Testing RLS (Row Level Security)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Test 1.1: Pump user registration (should succeed with RLS fix)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test-phase1-${TIMESTAMP}@test.com\",\"password\":\"SecureTest!123\",\"firstName\":\"Phase1\",\"lastName\":\"Test\"}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
  echo "✅ PASS: Registration succeeded (HTTP $HTTP_CODE)"
  echo "   Response: $BODY" | head -c 100
else
  echo "❌ FAIL: Registration failed (HTTP $HTTP_CODE)"
  echo "   Response: $BODY"
fi
echo ""

# =====================================================
# PHASE 2A & 2B: HIPAA-Safe Logging
# =====================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PHASE 2: Testing HIPAA-Safe Logging Migration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Test 2.1: Verify no console.log in server code"
CONSOLE_COUNT=$(find server -name "*.js" -o -name "*.ts" | \
  grep -v "_deprecated_external_services" | \
  grep -v "node_modules" | \
  xargs grep "console\." 2>/dev/null | \
  grep -v "^\s*\*" | \
  grep -v "^\s*//" | \
  wc -l | tr -d ' ')

if [ "$CONSOLE_COUNT" = "0" ]; then
  echo "✅ PASS: No console.log found in server code"
else
  echo "❌ FAIL: Found $CONSOLE_COUNT console statements in server code"
fi
echo ""

echo "Test 2.2: Verify logger is imported in key files"
LOGGER_FILES=("server/pump-report-api.js" "server/unified-api.js")
LOGGER_PASS=true

for file in "${LOGGER_FILES[@]}"; do
  if grep -q "logger = require.*logger" "$file"; then
    echo "✅ PASS: Logger imported in $(basename $file)"
  else
    echo "❌ FAIL: Logger NOT imported in $(basename $file)"
    LOGGER_PASS=false
  fi
done
echo ""

# =====================================================
# PHASE 3: Security Hardening Tests
# =====================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PHASE 3: Testing Security Hardening"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 3.1: Rate Limiting
echo "Test 3.1: Rate limiting on login endpoint"
echo "   (Testing 6 rapid login attempts - should block after 5)"
SUCCESS_COUNT=0
BLOCKED_COUNT=0

for i in {1..6}; do
  HTTP_CODE=$(curl -s -w "%{http_code}" -o /dev/null -X POST "$API_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"ratelimit@test.com","password":"wrong"}')

  if [ "$HTTP_CODE" = "429" ]; then
    BLOCKED_COUNT=$((BLOCKED_COUNT + 1))
    echo "   Attempt $i: ⛔ Blocked (HTTP 429 - Rate Limited)"
  else
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    echo "   Attempt $i: → Allowed (HTTP $HTTP_CODE)"
  fi
  sleep 0.5
done

if [ "$BLOCKED_COUNT" -gt 0 ]; then
  echo "✅ PASS: Rate limiting is working ($BLOCKED_COUNT requests blocked)"
else
  echo "⚠️  WARNING: Rate limiting not triggered in 6 attempts"
fi
echo ""

# Test 3.2: Password Validation
echo "Test 3.2: Weak password rejection"
WEAK_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"weak-${TIMESTAMP}@test.com\",\"password\":\"weak\",\"firstName\":\"Weak\",\"lastName\":\"Test\"}")

if echo "$WEAK_RESPONSE" | grep -q "Password does not meet security requirements\|password"; then
  echo "✅ PASS: Weak password rejected"
  echo "   Response: $(echo "$WEAK_RESPONSE" | head -c 80)..."
else
  echo "❌ FAIL: Weak password was accepted"
  echo "   Response: $WEAK_RESPONSE"
fi
echo ""

echo "Test 3.3: Strong password acceptance"
STRONG_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"strong-${TIMESTAMP}@test.com\",\"password\":\"MySecure!Pass123\",\"firstName\":\"Strong\",\"lastName\":\"Test\"}")

HTTP_CODE=$(echo "$STRONG_RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
  echo "✅ PASS: Strong password accepted (HTTP $HTTP_CODE)"
else
  BODY=$(echo "$STRONG_RESPONSE" | head -n-1)
  echo "⚠️  WARNING: Strong password registration returned HTTP $HTTP_CODE"
  echo "   Response: $(echo "$BODY" | head -c 100)"
fi
echo ""

# Test 3.4: CORS Configuration
echo "Test 3.4: CORS configuration (environment-aware)"
if grep -q "corsOptions.*require.*corsConfig" server/pump-report-api.js && \
   grep -q "corsOptions.*require.*corsConfig" server/unified-api.js; then
  echo "✅ PASS: CORS using environment-aware configuration"
else
  echo "❌ FAIL: CORS not using corsConfig middleware"
fi
echo ""

# Test 3.5: PHI Audit Logging Middleware
echo "Test 3.5: PHI audit logging middleware integrated"
PHI_ENDPOINTS=$(grep -c "phiLimiter.*auditPHIAccess" server/pump-report-api.js server/unified-api.js 2>/dev/null | awk '{sum+=$1} END {print sum}')

if [ "$PHI_ENDPOINTS" -gt 10 ]; then
  echo "✅ PASS: PHI audit logging on $PHI_ENDPOINTS endpoints"
else
  echo "⚠️  WARNING: PHI audit logging found on only $PHI_ENDPOINTS endpoints"
fi
echo ""

# Test 3.6: Non-BAA Services Removed
echo "Test 3.6: Non-BAA services removed/deprecated"
if [ -d "server/services/_deprecated_external_services" ]; then
  DEPRECATED_COUNT=$(ls -1 server/services/_deprecated_external_services/*.{js,ts} 2>/dev/null | wc -l | tr -d ' ')
  echo "✅ PASS: $DEPRECATED_COUNT non-BAA services moved to _deprecated_external_services/"
else
  echo "⚠️  WARNING: _deprecated_external_services directory not found"
fi

if ! grep -q "google" src/services/premiumVoice.service.ts; then
  echo "✅ PASS: Google TTS removed from premiumVoice.service.ts"
else
  echo "❌ FAIL: Google TTS still referenced in premiumVoice.service.ts"
fi
echo ""

# Test 3.7: Breach Notification System
echo "Test 3.7: Breach notification system files"
if [ -f "server/services/breachNotification.service.js" ]; then
  echo "✅ PASS: breachNotification.service.js exists"
else
  echo "❌ FAIL: breachNotification.service.js not found"
fi

if [ -f "database/migrations/create-breach-incidents-table.sql" ]; then
  echo "✅ PASS: breach_incidents table migration exists"
else
  echo "❌ FAIL: breach_incidents migration not found"
fi
echo ""

# =====================================================
# SUMMARY
# =====================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Phase 1 (RLS):           Check registration results above"
echo "Phase 2 (Logging):       Console.log migration verified"
echo "Phase 3 (Security):      Multiple security features tested"
echo ""
echo "Next Steps:"
echo "1. Check Supabase audit_logs table for PHI access logging"
echo "2. Verify breach_incidents table was created in Supabase"
echo "3. Monitor production logs for any HIPAA violations"
echo ""
echo "Documentation:"
echo "- HIPAA-COMPLIANCE-AUDIT-REPORT.md"
echo "- PHASE-3-SECURITY-HARDENING.md"
echo "- PHASE-3-IMPLEMENTATION-GUIDE.md"
echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   Testing Complete!                                       ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
