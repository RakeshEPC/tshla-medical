#!/bin/bash
# TSHLA Medical - Console.log to Logger Migration Script
# HIPAA Compliance Task #3: Replace console.log with structured logging
# Created: January 17, 2026
#
# This script prepares critical PHI-handling files for logging migration
# HIPAA Requirement: §164.308(a)(1)(ii)(D) - Proper logging controls

set -e

echo "================================================"
echo "TSHLA Medical - Logging Migration Prep"
echo "================================================"
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Priority 1: Critical PHI files
PRIORITY_1_FILES=(
  "server/api/patient-chart-api.js"
  "server/routes/patient-summaries-api.js"
  "server/medical-auth-api.js"
  "server/unified-api.js"
  "server/pump-report-api.js"
)

# Priority 2: High PHI exposure files
PRIORITY_2_FILES=(
  "server/patient-summary-api.js"
  "server/services/patient-extraction.js"
  "server/services/patientMatching.service.js"
  "server/services/call-database.js"
  "server/services/patient.service.ts"
)

echo "This script will:"
echo "  1. Identify console.log usage in critical files"
echo "  2. Create backup files (.pre-migration.bak)"
echo "  3. Report migration status"
echo ""
echo -e "${YELLOW}Note: This is a PREP script. Manual migration still required.${NC}"
echo ""

read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "=== Priority 1: Critical PHI Files ==="
echo ""

TOTAL_CONSOLE=0

for FILE in "${PRIORITY_1_FILES[@]}"; do
  if [ ! -f "$FILE" ]; then
    echo -e "${RED}✗ Not found: $FILE${NC}"
    continue
  fi

  # Count console statements
  CONSOLE_COUNT=$(grep -c "console\." "$FILE" 2>/dev/null || echo "0")
  TOTAL_CONSOLE=$((TOTAL_CONSOLE + CONSOLE_COUNT))

  # Check if logger is imported
  LOGGER_IMPORTED=$(grep -c "require.*logger" "$FILE" 2>/dev/null || echo "0")

  echo "File: $FILE"
  echo "  Console statements: $CONSOLE_COUNT"

  if [ "$LOGGER_IMPORTED" -gt 0 ]; then
    echo -e "  Logger imported: ${GREEN}✓ Yes${NC}"
  else
    echo -e "  Logger imported: ${YELLOW}✗ No${NC} - needs import"
  fi

  # Create backup
  if [ ! -f "$FILE.pre-migration.bak" ]; then
    cp "$FILE" "$FILE.pre-migration.bak"
    echo -e "  Backup created: ${GREEN}✓${NC}"
  else
    echo -e "  Backup exists: ${YELLOW}⚠${NC}"
  fi

  # Show sample console usage
  if [ "$CONSOLE_COUNT" -gt 0 ]; then
    echo "  Sample usage:"
    grep -n "console\." "$FILE" | head -3 | sed 's/^/    /'
  fi

  echo ""
done

echo "=== Priority 2: High PHI Exposure Files ==="
echo ""

for FILE in "${PRIORITY_2_FILES[@]}"; do
  if [ ! -f "$FILE" ]; then
    echo -e "${RED}✗ Not found: $FILE${NC}"
    continue
  fi

  CONSOLE_COUNT=$(grep -c "console\." "$FILE" 2>/dev/null || echo "0")
  TOTAL_CONSOLE=$((TOTAL_CONSOLE + CONSOLE_COUNT))

  echo "File: $FILE"
  echo "  Console statements: $CONSOLE_COUNT"

  if [ ! -f "$FILE.pre-migration.bak" ]; then
    cp "$FILE" "$FILE.pre-migration.bak"
    echo -e "  Backup created: ${GREEN}✓${NC}"
  else
    echo -e "  Backup exists: ${YELLOW}⚠${NC}"
  fi

  echo ""
done

echo "================================================"
echo "Summary"
echo "================================================"
echo ""
echo "Total console statements to migrate: $TOTAL_CONSOLE"
echo "Files to migrate: $(( ${#PRIORITY_1_FILES[@]} + ${#PRIORITY_2_FILES[@]} ))"
echo ""
echo "Next steps:"
echo "  1. Review files listed above"
echo "  2. For each file:"
echo "     a. Add logger import: const logger = require('../logger');"
echo "     b. Replace console.log with logger.info/debug"
echo "     c. Replace console.error with logger.error"
echo "     d. Sanitize all PHI before logging (remove names, DOB, SSN)"
echo "  3. Test each file after migration"
echo "  4. Run: npm run lint"
echo ""
echo "Migration guide:"
echo "  See: scripts/hipaa/LOGGING_MIGRATION_GUIDE.md"
echo ""
echo "Example migration:"
echo -e "${RED}  // BEFORE (PHI exposure risk):${NC}"
echo "  console.log('Patient data:', patient);"
echo ""
echo -e "${GREEN}  // AFTER (HIPAA-compliant):${NC}"
echo "  logger.info('PatientService', 'Patient accessed', {"
echo "    patientId: patient.id,"
echo "    userId: req.user.id"
echo "    // DO NOT log: name, dob, ssn, diagnosis"
echo "  });"
echo ""
echo "Backup files created with .pre-migration.bak extension"
echo "To restore a backup: cp file.js.pre-migration.bak file.js"
echo ""
