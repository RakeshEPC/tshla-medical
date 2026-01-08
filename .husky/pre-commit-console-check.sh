#!/bin/bash
# Pre-commit hook to prevent console.log in production code

echo "🔍 Checking for console.log statements in server code..."

# Check for console statements in server files (exclude scripts/)
CONSOLE_FOUND=$(git diff --cached --name-only | grep -E '^server/.*\.(js|ts)$' | xargs grep -l "console\." 2>/dev/null || true)

if [ ! -z "$CONSOLE_FOUND" ]; then
  echo ""
  echo "❌ ERROR: console.log statements found in server code!"
  echo ""
  echo "Files with console statements:"
  echo "$CONSOLE_FOUND" | sed 's/^/  - /'
  echo ""
  echo "HIPAA Compliance: Use logger instead of console:"
  echo "  ✅ logger.info('Category', 'Message', { data })"
  echo "  ✅ logger.error('Category', 'Error', { error: error.message })"
  echo "  ✅ logger.logOperation('Category', 'action', 'resource', success)"
  echo "  ❌ console.log() - exposes PHI in production logs"
  echo ""
  echo "To fix:"
  echo "  1. Replace console.log with logger.info()"
  echo "  2. Replace console.error with logger.error()"
  echo "  3. Use logger.redactPHI() for error messages"
  echo ""
  echo "See: HIPAA-SAFE-LOGGING-GUIDE.md"
  echo ""
  exit 1
fi

echo "✅ No console.log statements found in server code"
